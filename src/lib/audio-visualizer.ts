/**
 * Singleton Web Audio context + analyser + FX chain shared across the app.
 *
 * Audio graph (per attached <audio>):
 *   MediaElementSource
 *     -> EQ band 1..5 (BiquadFilter peaking)
 *     -> Bass Boost (lowshelf)
 *     -> ChannelSplitter -> Merger (Mono/Stereo/Karaoke center-cut routing)
 *     -> StereoPanner (Balance L/R for partial balance only)
 *     -> Convolver wet/dry mix (3D Surround)
 *     -> Master Gain
 *     -> Analyser (visualizer tap)
 *     -> Destination
 *
 * Settings are persisted in localStorage and applied to whichever audio
 * element is currently attached.
 */

import { useEffect, useRef, useState } from "react";

// ---------- Types ----------

export type AudioFxSettings = {
  // EQ — 5 bands, gain in dB (-12..+12)
  eq: [number, number, number, number, number];
  eqPreset: string;
  // Balance: -1 (full L) .. +1 (full R)
  balance: number;
  // Mono toggle
  mono: boolean;
  // Bass boost: 0..12 dB (lowshelf)
  bassBoost: number;
  // 3D Surround wet mix 0..1
  surround: number;
  // Playback rate 0.5..2
  rate: number;
  // Pitch preserve when changing rate
  preservePitch: boolean;
  // Karaoke-only mode: both speakers get vocal-cancelled (L-R) signal with bass restored from (L+R) low-pass
  karaokeOnly?: boolean;
  // Loudness / volume booster (1x = normal, up to 4x). Auto-engages compressor at >1.
  loudness?: number;
  // Hard compressor toggle for extra-loud safe limit.
  compressor?: boolean;
};

export const EQ_FREQS = [60, 250, 1000, 4000, 12000] as const;

export const EQ_PRESETS: Record<string, [number, number, number, number, number]> = {
  Flat:        [0, 0, 0, 0, 0],
  Pop:         [-1, 2, 4, 2, -1],
  Rock:        [4, 2, -1, 2, 4],
  Jazz:        [3, 2, 0, 2, 3],
  Classical:   [3, 2, -2, 2, 3],
  "Bass Boost":[8, 5, 0, 0, 0],
  "Treble Boost":[0, 0, 0, 5, 8],
  Vocal:       [-2, -1, 4, 3, -1],
  Dance:       [5, 3, 0, 3, 5],
  Loud:        [6, 4, 3, 4, 6],
  "Super Loud":[10, 7, 5, 7, 10],
  "Mega Bass": [12, 8, 0, 2, 4],
  Club:        [8, 5, 2, 5, 9],
  "Hip Hop":   [9, 6, 1, 3, 6],
  EDM:         [7, 4, 0, 5, 8],
  Acoustic:    [4, 3, 2, 4, 5],
  Cinematic:   [10, 5, -1, 4, 8],
  Latin:       [6, 3, 0, 4, 7],
  Metal:       [7, 5, 4, 5, 7],
  "Speaker Pecah":[12, 9, 6, 9, 12],
};

const DEFAULT_FX: AudioFxSettings = {
  eq: [0, 0, 0, 0, 0],
  eqPreset: "Flat",
  balance: 0,
  mono: false,
  bassBoost: 0,
  surround: 0,
  rate: 1,
  preservePitch: true,
  karaokeOnly: false,
  loudness: 1,
  compressor: false,
};

const LS_KEY = "audio_fx_settings_v1";

function loadSettings(): AudioFxSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_FX };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FX, ...parsed, eq: Array.isArray(parsed.eq) && parsed.eq.length === 5 ? parsed.eq : [...DEFAULT_FX.eq] };
  } catch {
    return { ...DEFAULT_FX };
  }
}

function saveSettings(s: AudioFxSettings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { void 0; }
}

// ---------- State ----------

type Graph = {
  source: MediaElementAudioSourceNode;
  eqNodes: BiquadFilterNode[];
  bass: BiquadFilterNode;
  splitter: ChannelSplitterNode;
  merger: ChannelMergerNode;
  // Karaoke side-channel nodes
  lGain: GainNode;       // L source passthrough
  rGain: GainNode;       // R source passthrough
  rInvGain: GainNode;    // -R for (L - R) = side/instrumental
  lInvGain: GainNode;    // -L for (R - L) inversion when needed
  vocalLGain: GainNode;  // L contribution to vocal (center) bus
  vocalRGain: GainNode;  // R contribution to vocal (center) bus
  vocalBus: GainNode;    // (L + R) center sum
  instLBus: GainNode;    // (L - R) instrumental bus
  instRBus: GainNode;    // (R - L) instrumental bus (mirror)
  outLGain: GainNode;    // final left output mix
  outRGain: GainNode;    // final right output mix
  panner: StereoPannerNode;
  convolver: ConvolverNode;
  wetGain: GainNode;
  dryGain: GainNode;
  master: GainNode;
  compressor: DynamicsCompressorNode;
  makeup: GainNode;
  analyser: AnalyserNode;
};

type AudioVizState = {
  ctx: AudioContext | null;
  graph: Graph | null;
  element: HTMLAudioElement | null;
  fx: AudioFxSettings;
};

const state: AudioVizState = {
  ctx: null,
  graph: null,
  element: null,
  fx: loadSettings(),
};

type Subscriber = (bands: Float32Array) => void;
const subscribers = new Map<Subscriber, number>();
type FxSubscriber = (s: AudioFxSettings) => void;
const fxSubscribers = new Set<FxSubscriber>();

let rafId: number | null = null;
let lastTick = 0;
const TICK_INTERVAL = 80;
let dataArray: Uint8Array | null = null;

// ---------- Impulse response (synthetic reverb for surround) ----------

function makeImpulseResponse(ctx: AudioContext, duration = 1.6, decay = 2.4): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * duration));
  const ir = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return ir;
}

// ---------- Visualizer loop ----------

function computeBands(bandCount: number, out: Float32Array, time: number) {
  const data = dataArray;
  if (data && data.length > 0 && state.graph?.analyser) {
    const usable = Math.min(data.length, 24);
    const step = usable / bandCount;
    for (let i = 0; i < bandCount; i++) {
      const start = Math.floor(i * step);
      const end = Math.max(start + 1, Math.floor((i + 1) * step));
      let sum = 0;
      for (let j = start; j < end; j++) sum += data[j];
      const avg = sum / (end - start);
      out[i] = Math.min(1, avg / 200);
    }
    return;
  }
  const t = (time / 1000) * 6;
  for (let i = 0; i < bandCount; i++) {
    const a = Math.sin(t * 1.3 + i * 0.9);
    const b = Math.sin(t * 2.1 + i * 1.7 + 1.2);
    const c = Math.sin(t * 0.7 + i * 0.4);
    const raw = (a + b * 0.7 + c * 0.5) / 2.2;
    const v = 0.25 + 0.75 * (0.5 + 0.5 * raw);
    out[i] = Math.max(0.1, Math.min(1, v));
  }
}

function tick(time: number) {
  if (subscribers.size === 0) {
    rafId = null;
    return;
  }
  rafId = requestAnimationFrame(tick);
  if (time - lastTick < TICK_INTERVAL) return;
  lastTick = time;

  if (state.graph?.analyser && dataArray) {
    state.graph.analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
  }
  subscribers.forEach((bandCount, cb) => {
    const buf = new Float32Array(bandCount);
    computeBands(bandCount, buf, time);
    cb(buf);
  });
}

function ensureLoop() {
  if (subscribers.size > 0 && rafId == null) rafId = requestAnimationFrame(tick);
}

// ---------- Build graph ----------

function buildGraph(ctx: AudioContext, audio: HTMLAudioElement): Graph {
  const source = ctx.createMediaElementSource(audio);

  // EQ — 5 peaking filters
  const eqNodes: BiquadFilterNode[] = EQ_FREQS.map((freq, i) => {
    const f = ctx.createBiquadFilter();
    f.type = "peaking";
    f.frequency.value = freq;
    f.Q.value = 1.0;
    f.gain.value = state.fx.eq[i] ?? 0;
    return f;
  });

  // Bass boost (lowshelf)
  const bass = ctx.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 120;
  bass.gain.value = state.fx.bassBoost;

  // Splitter to break stereo into L & R for karaoke channel swap
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  // Source channel taps (post-split) — these are the ONLY nodes connected to splitter outputs.
  const lGain = ctx.createGain(); lGain.gain.value = 1;  // L source
  const rGain = ctx.createGain(); rGain.gain.value = 1;  // R source

  // Mix gains feeding the merger.
  // outL = (lToOutL * L_source) + (rToOutL * R_source)
  // outR = (lToOutR * L_source) + (rToOutR * R_source)
  const lToOutL = ctx.createGain(); lToOutL.gain.value = 1; // L→L (default stereo)
  const rToOutL = ctx.createGain(); rToOutL.gain.value = 0;
  const lToOutR = ctx.createGain(); lToOutR.gain.value = 0;
  const rToOutR = ctx.createGain(); rToOutR.gain.value = 1; // R→R (default stereo)

  // Unused legacy nodes — kept in Graph type to avoid breaking changes; left disconnected.
  const rInvGain = ctx.createGain(); rInvGain.gain.value = 0;
  const lInvGain = ctx.createGain(); lInvGain.gain.value = 0;
  const vocalLGain = ctx.createGain(); vocalLGain.gain.value = 0;
  const vocalRGain = ctx.createGain(); vocalRGain.gain.value = 0;
  const vocalBus = ctx.createGain(); vocalBus.gain.value = 0;
  const instLBus = ctx.createGain(); instLBus.gain.value = 0;
  const instRBus = ctx.createGain(); instRBus.gain.value = 0;
  const outLGain = ctx.createGain(); outLGain.gain.value = 1;
  const outRGain = ctx.createGain(); outRGain.gain.value = 1;

  // Balance (StereoPanner) — kept centered; balance handled by routing gains.
  const panner = ctx.createStereoPanner();
  panner.pan.value = 0;

  // Convolver for surround
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulseResponse(ctx);
  const wetGain = ctx.createGain();
  const dryGain = ctx.createGain();
  wetGain.gain.value = state.fx.surround;
  dryGain.gain.value = 1 - state.fx.surround * 0.4;

  const master = ctx.createGain();
  master.gain.value = 1;

  // Compressor + makeup gain for safe loudness boost
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  const makeup = ctx.createGain();
  makeup.gain.value = state.fx.loudness ?? 1;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.75;

  // Wire EQ chain
  source.connect(eqNodes[0]);
  for (let i = 0; i < eqNodes.length - 1; i++) eqNodes[i].connect(eqNodes[i + 1]);
  const lastEq = eqNodes[eqNodes.length - 1];
  lastEq.connect(bass);

  // Bass -> splitter
  bass.connect(splitter);

  // Tap each source channel ONCE.
  splitter.connect(lGain, 0);
  splitter.connect(rGain, 1);

  // Each source feeds both output sides through dedicated gain nodes.
  lGain.connect(lToOutL);
  lGain.connect(lToOutR);
  rGain.connect(rToOutL);
  rGain.connect(rToOutR);

  // Mix into merger.
  lToOutL.connect(merger, 0, 0);
  rToOutL.connect(merger, 0, 0);
  lToOutR.connect(merger, 0, 1);
  rToOutR.connect(merger, 0, 1);

  // Merger -> panner -> dry/wet split
  merger.connect(panner);
  panner.connect(dryGain);
  panner.connect(convolver);
  convolver.connect(wetGain);

  // Sum -> master -> [compressor?] -> makeup -> analyser -> destination
  dryGain.connect(master);
  wetGain.connect(master);
  // Connect through compressor + makeup gain so loudness boost is safe from clipping
  master.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(analyser);
  analyser.connect(ctx.destination);

  // Stash the routing gains on the graph using legacy slots so the Graph type
  // doesn't need to change. We reuse:
  //   instLBus  = lToOutL
  //   instRBus  = rToOutR
  //   vocalLGain = rToOutL
  //   vocalRGain = lToOutR
  return {
    source, eqNodes, bass, splitter, merger,
    lGain, rGain,
    rInvGain, lInvGain,
    vocalLGain: rToOutL,   // R source → L output
    vocalRGain: lToOutR,   // L source → R output
    vocalBus,
    instLBus: lToOutL,     // L source → L output
    instRBus: rToOutR,     // R source → R output
    outLGain, outRGain,
    panner, convolver, wetGain, dryGain, master,
    compressor, makeup,
    analyser,
  };
}

/**
 * Karaoke center-cut router.
 *   balance = 0  → stereo passthrough (L→L, R→R)
 *   balance = -1 → L speaker = vocal-reduced (L-R), R speaker = original mono (L+R)
 *   balance = +1 → mirrored: L speaker = original mono (L+R), R speaker = vocal-reduced (R-L)
 *   In between we crossfade smoothly.
 *   mono → both speakers get L+R sum.
 */
function rebuildChannelRouting(g: Graph, fx: AudioFxSettings) {
  const ctx = state.ctx!;
  const t = ctx.currentTime;
  const balance = Math.max(-1, Math.min(1, fx.balance));
  const lToOutL = g.instLBus;     // L → L
  const rToOutR = g.instRBus;     // R → R
  const rToOutL = g.vocalLGain;   // R → L (cross)
  const lToOutR = g.vocalRGain;   // L → R (cross)

  if (fx.karaokeOnly) {
    // Both speakers receive (L - R): center-cancelled instrumental.
    // L out = L - R, R out = L - R (mirrored to keep stereo image symmetric).
    lToOutL.gain.setTargetAtTime(1, t, 0.03);
    rToOutL.gain.setTargetAtTime(-1, t, 0.03);
    lToOutR.gain.setTargetAtTime(1, t, 0.03);
    rToOutR.gain.setTargetAtTime(-1, t, 0.03);
    return;
  }

  if (fx.mono) {
    // Both speakers receive L+R at half gain to avoid clipping.
    lToOutL.gain.setTargetAtTime(0.5, t, 0.03);
    rToOutL.gain.setTargetAtTime(0.5, t, 0.03);
    lToOutR.gain.setTargetAtTime(0.5, t, 0.03);
    rToOutR.gain.setTargetAtTime(0.5, t, 0.03);
    return;
  }

  // Vocal-removal balance.
  //   balance = 0  → pure stereo passthrough (L→L, R→R), vocal intact.
  //   |balance| → 1 → progressively subtract the opposite channel from BOTH
  //                    speakers so the centered vocal cancels out. At the extreme
  //                    both speakers output the instrumental (L-R / R-L), so no
  //                    vocal leaks back from the "other" side.
  // The sign only decides which side leads; the end result at full throw is a
  // clean karaoke on both speakers.
  const k = Math.abs(balance);

  if (balance === 0) {
    // Pure stereo passthrough.
    lToOutL.gain.setTargetAtTime(1, t, 0.03);
    rToOutR.gain.setTargetAtTime(1, t, 0.03);
    rToOutL.gain.setTargetAtTime(0, t, 0.03);
    lToOutR.gain.setTargetAtTime(0, t, 0.03);
  } else if (balance < 0) {
    // Karaoke leads on Left: L = L - kR, R fades from full song toward R - kL.
    lToOutL.gain.setTargetAtTime(1, t, 0.03);
    rToOutL.gain.setTargetAtTime(-k, t, 0.03);
    lToOutR.gain.setTargetAtTime(-k, t, 0.03);
    rToOutR.gain.setTargetAtTime(1, t, 0.03);
  } else {
    // Karaoke leads on Right: mirrored, but same cancellation math.
    lToOutL.gain.setTargetAtTime(1, t, 0.03);
    rToOutL.gain.setTargetAtTime(-k, t, 0.03);
    lToOutR.gain.setTargetAtTime(-k, t, 0.03);
    rToOutR.gain.setTargetAtTime(1, t, 0.03);
  }

}

function applyFxToGraph(g: Graph, fx: AudioFxSettings) {
  const ctx = state.ctx!;
  const t = ctx.currentTime;
  for (let i = 0; i < g.eqNodes.length; i++) {
    g.eqNodes[i].gain.setTargetAtTime(fx.eq[i] ?? 0, t, 0.05);
  }
  g.bass.gain.setTargetAtTime(fx.bassBoost, t, 0.05);
  // Balance is now handled inside rebuildChannelRouting (karaoke split). Keep panner centered.
  g.panner.pan.setTargetAtTime(0, t, 0.05);
  const wet = Math.max(0, Math.min(1, fx.surround));
  g.wetGain.gain.setTargetAtTime(wet * 0.6, t, 0.05);
  g.dryGain.gain.setTargetAtTime(1 - wet * 0.4, t, 0.05);

  // Loudness booster (1x..4x). Auto-engage compressor when loudness > 1 OR user toggled.
  const loud = Math.max(1, Math.min(4, fx.loudness ?? 1));
  const useComp = (fx.compressor ?? false) || loud > 1.01;
  g.makeup.gain.setTargetAtTime(loud, t, 0.05);
  // When compressor is "off", relax it so it acts mostly transparent.
  g.compressor.threshold.setTargetAtTime(useComp ? -24 : -6, t, 0.05);
  g.compressor.ratio.setTargetAtTime(useComp ? 12 : 2, t, 0.05);
  g.compressor.knee.setTargetAtTime(useComp ? 30 : 6, t, 0.05);

  rebuildChannelRouting(g, fx);
}

function applyRateToElement(audio: HTMLAudioElement, fx: AudioFxSettings) {
  try {
    audio.playbackRate = Math.max(0.25, Math.min(3, fx.rate));
    // preservesPitch (Chrome) / mozPreservesPitch (Firefox) / preservesPitch (modern)
    const a = audio as HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
    if ("preservesPitch" in a) a.preservesPitch = fx.preservePitch;
    if ("mozPreservesPitch" in a) a.mozPreservesPitch = fx.preservePitch;
    if ("webkitPreservesPitch" in a) a.webkitPreservesPitch = fx.preservePitch;
  } catch { void 0; }
}

// ---------- Public API ----------

export function attachAudioVisualizer(audio: HTMLAudioElement | null) {
  if (!audio) return;
  if (state.element === audio && state.graph) {
    applyRateToElement(audio, state.fx);
    return;
  }

  try {
    if (!state.ctx) {
      const Ctx =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      state.ctx = new Ctx();
    }
    if (state.ctx.state === "suspended") {
      state.ctx.resume().catch(() => {});
    }

    if (!audio.crossOrigin) {
      try { audio.crossOrigin = "anonymous"; } catch { void 0; }
    }

    // Disconnect previous graph if attached to a different element
    if (state.graph && state.element !== audio) {
      try { state.graph.source.disconnect(); } catch { void 0; }
      try { state.graph.master.disconnect(); } catch { void 0; }
      try { state.graph.analyser.disconnect(); } catch { void 0; }
      state.graph = null;
    }

    const graph = buildGraph(state.ctx, audio);
    applyFxToGraph(graph, state.fx);
    applyRateToElement(audio, state.fx);

    state.graph = graph;
    state.element = audio;
    dataArray = new Uint8Array(graph.analyser.frequencyBinCount);
    ensureLoop();
  } catch {
    // Likely: audio element already has a MediaElementSource bound.
    // Fall back silently — FX won't apply for this element.
  }
}

export function getAudioFx(): AudioFxSettings {
  return { ...state.fx, eq: [...state.fx.eq] as AudioFxSettings["eq"] };
}

export function setAudioFx(patch: Partial<AudioFxSettings>) {
  const next: AudioFxSettings = {
    ...state.fx,
    ...patch,
    eq: patch.eq ? ([...patch.eq] as AudioFxSettings["eq"]) : state.fx.eq,
  };
  state.fx = next;
  saveSettings(next);
  if (state.graph) applyFxToGraph(state.graph, next);
  if (state.element) applyRateToElement(state.element, next);
  fxSubscribers.forEach((cb) => { try { cb(next); } catch { void 0; } });
}

export function resetAudioFx() {
  setAudioFx({ ...DEFAULT_FX });
}

export function subscribeAudioFx(cb: FxSubscriber): () => void {
  fxSubscribers.add(cb);
  return () => { fxSubscribers.delete(cb); };
}

export function subscribeBands(bandCount: number, cb: Subscriber): () => void {
  subscribers.set(cb, bandCount);
  ensureLoop();
  return () => { subscribers.delete(cb); };
}

export function useAudioBandsDOM(
  containerRef: React.RefObject<HTMLElement>,
  bandCount: number,
  isPlaying: boolean,
  maxHeight: number
) {
  useEffect(() => {
    if (!isPlaying) {
      const el = containerRef.current;
      if (el) {
        const children = el.children;
        for (let i = 0; i < children.length; i++) {
          (children[i] as HTMLElement).style.height = `2px`;
        }
      }
      return;
    }
    const apply = (bands: Float32Array) => {
      const el = containerRef.current;
      if (!el) return;
      const children = el.children;
      const n = Math.min(children.length, bands.length);
      for (let i = 0; i < n; i++) {
        const h = Math.max(2, Math.round(bands[i] * maxHeight));
        (children[i] as HTMLElement).style.height = `${h}px`;
      }
    };
    const unsub = subscribeBands(bandCount, apply);
    return unsub;
  }, [containerRef, bandCount, isPlaying, maxHeight]);
}

/** React hook to read & update FX settings reactively. */
export function useAudioFx() {
  const [fx, setFxState] = useState<AudioFxSettings>(() => getAudioFx());
  useEffect(() => {
    const unsub = subscribeAudioFx((s) => setFxState({ ...s, eq: [...s.eq] as AudioFxSettings["eq"] }));
    return unsub;
  }, []);
  return { fx, setFx: setAudioFx, reset: resetAudioFx };
}


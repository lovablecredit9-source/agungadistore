/**
 * Singleton Web Audio context + analyser + FX chain shared across the app.
 *
 * Audio graph (per attached <audio>):
 *   MediaElementSource
 *     -> EQ band 1..5 (BiquadFilter peaking)
 *     -> Bass Boost (lowshelf)
 *     -> ChannelSplitter -> Merger (Mono/Stereo/L-source/R-source)
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
const TICK_INTERVAL = 50;
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
  rafId = requestAnimationFrame(tick);
  if (time - lastTick < TICK_INTERVAL) return;
  lastTick = time;

  if (state.graph?.analyser && dataArray) {
    state.graph.analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
  }
  if (subscribers.size === 0) return;
  subscribers.forEach((bandCount, cb) => {
    const buf = new Float32Array(bandCount);
    computeBands(bandCount, buf, time);
    cb(buf);
  });
}

function ensureLoop() {
  if (rafId == null) rafId = requestAnimationFrame(tick);
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

  // Mono splitter/merger
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);

  // Balance (StereoPanner)
  const panner = ctx.createStereoPanner();
  panner.pan.value = state.fx.balance;

  // Convolver for surround
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulseResponse(ctx);
  const wetGain = ctx.createGain();
  const dryGain = ctx.createGain();
  wetGain.gain.value = state.fx.surround;
  dryGain.gain.value = 1 - state.fx.surround * 0.4;

  const master = ctx.createGain();
  master.gain.value = 1;

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
  // Mono mix: by default route L->L, R->R; toggled in applyFx
  splitter.connect(merger, 0, 0);
  splitter.connect(merger, 1, 1);

  // Merger -> panner -> dry/wet split
  merger.connect(panner);
  panner.connect(dryGain);
  panner.connect(convolver);
  convolver.connect(wetGain);

  // Sum -> master -> analyser -> destination
  dryGain.connect(master);
  wetGain.connect(master);
  master.connect(analyser);
  analyser.connect(ctx.destination);

  return { source, eqNodes, bass, splitter, merger, panner, convolver, wetGain, dryGain, master, analyser };
}

function rebuildChannelRouting(g: Graph, fx: AudioFxSettings) {
  try {
    g.splitter.disconnect();
  } catch { void 0; }
  const balance = Math.max(-1, Math.min(1, fx.balance));
  if (fx.mono) {
    g.splitter.connect(g.merger, 0, 0);
    g.splitter.connect(g.merger, 0, 1);
    g.splitter.connect(g.merger, 1, 0);
    g.splitter.connect(g.merger, 1, 1);
  } else if (balance <= -0.95) {
    g.splitter.connect(g.merger, 0, 0);
    g.splitter.connect(g.merger, 0, 1);
  } else if (balance >= 0.95) {
    g.splitter.connect(g.merger, 1, 0);
    g.splitter.connect(g.merger, 1, 1);
  } else {
    g.splitter.connect(g.merger, 0, 0);
    g.splitter.connect(g.merger, 1, 1);
  }
}

function applyFxToGraph(g: Graph, fx: AudioFxSettings) {
  const ctx = state.ctx!;
  const t = ctx.currentTime;
  for (let i = 0; i < g.eqNodes.length; i++) {
    g.eqNodes[i].gain.setTargetAtTime(fx.eq[i] ?? 0, t, 0.05);
  }
  g.bass.gain.setTargetAtTime(fx.bassBoost, t, 0.05);
  const balance = Math.max(-1, Math.min(1, fx.balance));
  const pan = Math.abs(balance) >= 0.95 ? 0 : balance;
  g.panner.pan.setTargetAtTime(pan, t, 0.05);
  const wet = Math.max(0, Math.min(1, fx.surround));
  g.wetGain.gain.setTargetAtTime(wet * 0.6, t, 0.05);
  g.dryGain.gain.setTargetAtTime(1 - wet * 0.4, t, 0.05);
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


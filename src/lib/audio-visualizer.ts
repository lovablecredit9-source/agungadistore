import { useEffect, useRef, useState } from "react";

/**
 * Singleton Web Audio context + analyser shared across the app.
 * Connects once to a given HTMLAudioElement and exposes frequency data.
 *
 * NOTE: HTMLMediaElement can only be connected to ONE MediaElementSource
 * per AudioContext for its entire lifetime. We track which element is
 * already wired and reuse the analyser.
 */

type AudioVizState = {
  ctx: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaElementAudioSourceNode | null;
  element: HTMLAudioElement | null;
};

const state: AudioVizState = {
  ctx: null,
  analyser: null,
  source: null,
  element: null,
};

const subscribers = new Set<() => void>();
let rafId: number | null = null;
let dataArray: Uint8Array | null = null;

function tick() {
  if (state.analyser && dataArray) {
    state.analyser.getByteFrequencyData(dataArray);
    subscribers.forEach((cb) => cb());
  }
  rafId = requestAnimationFrame(tick);
}

function ensureLoop() {
  if (rafId == null) rafId = requestAnimationFrame(tick);
}

export function attachAudioVisualizer(audio: HTMLAudioElement | null) {
  if (!audio) return;
  if (state.element === audio && state.analyser) return; // already wired

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

    // Audio elements created dynamically need crossOrigin to feed the analyser
    // when source is on a different origin. Best-effort.
    if (!audio.crossOrigin) {
      try { audio.crossOrigin = "anonymous"; } catch { /* noop */ }
    }

    // We can't disconnect & re-create source for the same element,
    // so if a different element comes in we just leave the old one (it's GC'd
    // when the audio element is dropped).
    const src = state.ctx.createMediaElementSource(audio);
    const analyser = state.ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    src.connect(analyser);
    analyser.connect(state.ctx.destination);

    state.source = src;
    state.analyser = analyser;
    state.element = audio;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    ensureLoop();
  } catch {
    // Most common failure: cross-origin without CORS headers, or element already
    // attached to another context. Fall back silently — visualizer will use
    // synthetic animation.
  }
}

export function getFrequencyData(): Uint8Array | null {
  return dataArray;
}

/**
 * Hook that returns a snapshot of frequency bands (length = bandCount),
 * normalized 0..1. Works whether or not the analyser is actually wired
 * (falls back to a synthetic pulse so the UI still feels alive).
 */
export function useAudioBands(bandCount: number, isPlaying: boolean): number[] {
  const [bands, setBands] = useState<number[]>(() => new Array(bandCount).fill(0));
  const tRef = useRef(0);

  useEffect(() => {
    let alive = true;

    const update = () => {
      if (!alive) return;
      const data = getFrequencyData();
      if (data && data.length > 0) {
        // Use lower-mid frequencies (more visually pleasing for music)
        const usable = Math.min(data.length, 24);
        const next: number[] = [];
        const step = usable / bandCount;
        for (let i = 0; i < bandCount; i++) {
          const start = Math.floor(i * step);
          const end = Math.max(start + 1, Math.floor((i + 1) * step));
          let sum = 0;
          for (let j = start; j < end; j++) sum += data[j];
          const avg = sum / (end - start);
          next.push(isPlaying ? Math.min(1, avg / 200) : 0);
        }
        setBands(next);
      } else if (isPlaying) {
        // Fallback synthetic animation
        tRef.current += 0.12;
        const next: number[] = [];
        for (let i = 0; i < bandCount; i++) {
          const v = 0.35 + 0.45 * Math.abs(Math.sin(tRef.current + i * 0.7));
          next.push(v);
        }
        setBands(next);
      } else {
        setBands((prev) => prev.map((v) => v * 0.6));
      }
    };

    subscribers.add(update);
    ensureLoop();

    // Also poll on a slow interval as a safety net for the synthetic path
    const id = window.setInterval(update, 80);

    return () => {
      alive = false;
      subscribers.delete(update);
      window.clearInterval(id);
    };
  }, [bandCount, isPlaying]);

  return bands;
}

/**
 * Singleton Web Audio context + analyser shared across the app.
 * Connects once to a given HTMLAudioElement and exposes frequency data.
 *
 * Performance notes:
 * - We DO NOT use React state per frame. Instead, components register a
 *   render callback that mutates DOM directly (style.height) on each tick.
 *   This avoids hundreds of re-renders per second when many equalizer
 *   instances are mounted (e.g. song lists).
 * - A single rAF loop drives ALL subscribers at ~30fps.
 */

import { useEffect, useRef } from "react";

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

type Subscriber = (bands: Float32Array) => void;
const subscribers = new Map<Subscriber, number>(); // callback -> bandCount

let rafId: number | null = null;
let lastTick = 0;
const TICK_INTERVAL = 50; // ms — ~20fps, smooth enough, very cheap
let dataArray: Uint8Array | null = null;

function computeBands(bandCount: number, out: Float32Array, time: number) {
  const data = dataArray;
  if (data && data.length > 0 && state.analyser) {
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
  // Synthetic fallback
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

  if (state.analyser && dataArray) {
    state.analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
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

export function attachAudioVisualizer(audio: HTMLAudioElement | null) {
  if (!audio) return;
  if (state.element === audio && state.analyser) return;

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
      try { audio.crossOrigin = "anonymous"; } catch { /* noop */ }
    }

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
    // silent fallback
  }
}

/**
 * Subscribe to frequency band updates without triggering React re-renders.
 * The callback receives a Float32Array of length `bandCount` with values 0..1.
 */
export function subscribeBands(bandCount: number, cb: Subscriber): () => void {
  subscribers.set(cb, bandCount);
  ensureLoop();
  return () => {
    subscribers.delete(cb);
  };
}

/**
 * Hook variant: receives a ref to a container; mutates child <span> heights
 * directly each frame. Zero React re-renders during animation.
 */
export function useAudioBandsDOM(
  containerRef: React.RefObject<HTMLElement>,
  bandCount: number,
  isPlaying: boolean,
  maxHeight: number
) {
  useEffect(() => {
    if (!isPlaying) {
      // collapse bars to a low resting state
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

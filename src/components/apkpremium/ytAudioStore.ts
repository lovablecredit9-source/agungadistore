import { useSyncExternalStore } from "react";
import type { YtEntry } from "./useYtHistory";

/**
 * One app-wide audio element for YouTube MP3 playback. It lives outside React so
 * switching app tabs (which unmounts APK PREMIUM) never stops the music; only stop() does.
 */
export type YtAudioState = {
  item: YtEntry | null;
  status: "idle" | "loading" | "playing" | "paused" | "error";
  time: number;
  duration: number;
  volume: number;
};

type AudioLike = Pick<HTMLAudioElement, "src" | "currentTime" | "duration" | "volume" | "paused" | "play" | "pause" | "load" | "addEventListener" | "removeAttribute">;

let state: YtAudioState = { item: null, status: "idle", time: 0, duration: 0, volume: 1 };
const listeners = new Set<() => void>();
let audio: AudioLike | null = null;
let factory: () => AudioLike = () => new Audio();
let onFirstPlay: ((it: YtEntry) => void) | null = null;
let loggedId: string | null = null;

const set = (patch: Partial<YtAudioState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

function el(): AudioLike {
  if (audio) return audio;
  const a = factory();
  a.addEventListener("loadedmetadata", () => set({ duration: Number.isFinite(a.duration) ? a.duration : 0, status: state.status === "loading" ? "paused" : state.status }));
  a.addEventListener("timeupdate", () => set({ time: a.currentTime }));
  a.addEventListener("play", () => {
    set({ status: "playing" });
    if (state.item && loggedId !== state.item.id) { loggedId = state.item.id; onFirstPlay?.(state.item); }
  });
  a.addEventListener("pause", () => { if (state.item && state.status !== "error") set({ status: "paused" }); });
  a.addEventListener("ended", () => set({ status: "paused" }));
  a.addEventListener("error", () => { if (state.item) set({ status: "error" }); });
  audio = a;
  return a;
}

export const ytAudio = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  /** Called once per newly played item (used to log "played" in history). */
  setPlayedLogger(fn: ((it: YtEntry) => void) | null) { onFirstPlay = fn; },
  play(item: YtEntry) {
    if (!item.media_url) return;
    const a = el();
    if (state.item?.id !== item.id) {
      set({ item, status: "loading", time: 0, duration: 0 });
      a.src = item.media_url;
      a.load();
    }
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => { if (state.status === "loading") set({ status: "paused" }); });
  },
  toggle() {
    if (!state.item || !audio) return;
    if (audio.paused) this.play(state.item); else audio.pause();
  },
  seek(t: number) { if (audio && state.item) { audio.currentTime = t; set({ time: t }); } },
  setVolume(v: number) { const n = Math.min(1, Math.max(0, v)); if (audio) audio.volume = n; set({ volume: n }); },
  /** Explicit stop: the only way music ends besides finishing. */
  stop() {
    if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
    loggedId = null;
    set({ item: null, status: "idle", time: 0, duration: 0 });
  },
  /** Test hook: replace the audio element factory and reset. */
  __reset(f?: () => AudioLike) { audio = null; loggedId = null; onFirstPlay = null; if (f) factory = f; state = { item: null, status: "idle", time: 0, duration: 0, volume: 1 }; listeners.forEach((l) => l()); },
};

export function useYtAudio() { return useSyncExternalStore(ytAudio.subscribe, ytAudio.get, ytAudio.get); }

export const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

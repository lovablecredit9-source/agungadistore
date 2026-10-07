import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Maximize2, Music, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export interface CinematicLyricLine {
  id: string;
  time_seconds: number;
  text: string;
}

interface SongInfo {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
}

const USER_SCROLL_HOLD_MS = 3500;
const SCROLL_ANIM_MS = 700;
const isInstrumental = (t: string) => !t || !t.trim() || /^[♪♫🎵🎶\s.]+$/.test(t.trim());
const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
};

/** Index of the last line whose timestamp is <= t (binary search), -1 before the first line. */
export function findActiveLyricIndex(lines: CinematicLyricLine[], t: number) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time_seconds <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** Karaoke fill 0..1 for a line: spans the estimated sung length, never past the next line. */
export function karaokeProgress(lines: CinematicLyricLine[], idx: number, t: number, duration: number) {
  if (idx < 0 || idx >= lines.length) return 0;
  const start = lines[idx].time_seconds;
  const next = idx + 1 < lines.length ? lines[idx + 1].time_seconds : Math.max(start + 4, duration || start + 4);
  const words = lines[idx].text.trim().split(/\s+/).filter(Boolean).length || 1;
  const span = Math.max(0.6, Math.min((next - start) * 0.95, words * 0.55 + 0.8));
  return Math.max(0, Math.min(1, (t - start) / span));
}

interface StageProps {
  lines: CinematicLyricLine[];
  audioRef: RefObject<HTMLAudioElement | null>;
  duration: number;
  onSeek: (t: number) => void;
  variant: "card" | "fullscreen";
  songKey: string;
}

/**
 * Lirik berjalan: membaca audio.currentTime tiap frame (bukan timer terpisah), jadi pause/seek
 * langsung diikuti. Baris aktif ditarik ke tengah dengan scroll halus; scroll manual User ditahan dulu.
 */
export const LyricsStage = memo(function LyricsStage({ lines, audioRef, duration, onSeek, variant, songKey }: StageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() => findActiveLyricIndex(lines, audioRef.current?.currentTime ?? 0));
  const [tapped, setTapped] = useState<number | null>(null);
  const activeRef = useRef(active);
  const holdUntil = useRef(0);
  const scrollAnim = useRef<number | null>(null);
  const firstScroll = useRef(true);

  const centerOn = useCallback((idx: number, instant = false) => {
    const c = containerRef.current;
    if (!c) return;
    const el = c.querySelector<HTMLElement>(`[data-lyr="${idx}"]`);
    if (!el) return;
    const target = Math.max(0, Math.min(c.scrollHeight - c.clientHeight, el.offsetTop - c.clientHeight / 2 + el.offsetHeight / 2));
    if (scrollAnim.current) cancelAnimationFrame(scrollAnim.current);
    const from = c.scrollTop;
    if (instant || Math.abs(target - from) < 2) { c.scrollTop = target; return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / SCROLL_ANIM_MS);
      const e = 1 - Math.pow(1 - p, 3);
      c.scrollTop = from + (target - from) * e;
      if (p < 1) scrollAnim.current = requestAnimationFrame(step);
      else scrollAnim.current = null;
    };
    scrollAnim.current = requestAnimationFrame(step);
  }, []);

  // Per-frame sync with the real audio clock.
  useEffect(() => {
    let raf = 0;
    let lastT = -1;
    const loop = () => {
      const a = audioRef.current;
      const t = a ? a.currentTime : 0;
      if (t !== lastT) {
        lastT = t;
        const idx = findActiveLyricIndex(lines, t);
        if (idx !== activeRef.current) { activeRef.current = idx; setActive(idx); }
        const el = containerRef.current?.querySelector<HTMLElement>(`[data-lyr="${idx}"]`);
        if (el) el.style.setProperty("--kp", karaokeProgress(lines, idx, t, duration || a?.duration || 0).toFixed(4));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [lines, audioRef, duration]);

  // Reset when the song changes so old lyrics never linger.
  useEffect(() => {
    firstScroll.current = true;
    holdUntil.current = 0;
    const idx = findActiveLyricIndex(lines, audioRef.current?.currentTime ?? 0);
    activeRef.current = idx;
    setActive(idx);
  }, [songKey, lines, audioRef]);

  useEffect(() => {
    if (performance.now() < holdUntil.current) return;
    const instant = firstScroll.current;
    firstScroll.current = false;
    centerOn(active, instant);
  }, [active, centerOn]);

  // Manual scroll by the user pauses auto-scroll, then it resumes and re-centers.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const hold = () => {
      if (scrollAnim.current) { cancelAnimationFrame(scrollAnim.current); scrollAnim.current = null; }
      holdUntil.current = performance.now() + USER_SCROLL_HOLD_MS;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { holdUntil.current = 0; centerOn(activeRef.current); }, USER_SCROLL_HOLD_MS);
    };
    c.addEventListener("wheel", hold, { passive: true });
    c.addEventListener("touchmove", hold, { passive: true });
    return () => { c.removeEventListener("wheel", hold); c.removeEventListener("touchmove", hold); if (timer) clearTimeout(timer); };
  }, [centerOn]);

  useEffect(() => () => { if (scrollAnim.current) cancelAnimationFrame(scrollAnim.current); }, []);

  const handleTap = (idx: number, t: number) => {
    holdUntil.current = 0;
    setTapped(idx);
    window.setTimeout(() => setTapped(v => (v === idx ? null : v)), 450);
    onSeek(Math.max(0, t));
  };

  const introShown = lines.length > 0 && lines[0].time_seconds > 2.5;
  const fs = variant === "fullscreen";

  return (
    <div
      ref={containerRef}
      className={`lyr-stage relative h-full overflow-y-auto overscroll-contain ${fs ? "lyr-mask-fs" : "lyr-mask-card"}`}
      data-testid={`lyrics-stage-${variant}`}
    >
      <div key={songKey} className={`lyr-enter ${fs ? "px-5 md:px-10 py-[42vh]" : "px-3 py-[110px]"}`}>
        {introShown && (
          <div data-lyr={-1} className={`lyr-line ${active === -1 ? "is-active" : ""} ${fs ? "lyr-fs" : "lyr-card"}`}>
            <span className="lyr-dots" aria-label="Intro musik"><i /><i /><i /></span>
          </div>
        )}
        {lines.map((line, i) => {
          const d = i - active;
          const instr = isInstrumental(line.text);
          const state = d === 0 ? "is-active" : d < 0 ? "is-past" : "is-next";
          const near = Math.abs(d) <= 6;
          return (
            <button
              type="button"
              key={line.id}
              data-lyr={i}
              data-lyric-index={i}
              onClick={() => handleTap(i, line.time_seconds)}
              className={`lyr-line ${state} ${near ? "is-near" : ""} ${tapped === i ? "is-tapped" : ""} ${fs ? "lyr-fs" : "lyr-card"}`}
              aria-current={d === 0 ? "true" : undefined}
              title={`Putar dari ${fmt(line.time_seconds)}`}
            >
              {instr ? (
                <span className="lyr-dots" aria-label="Instrumental"><i /><i /><i /></span>
              ) : (
                <span className="lyr-text">{line.text}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

interface CardProps {
  song: SongInfo;
  lines: CinematicLyricLine[];
  audioRef: RefObject<HTMLAudioElement | null>;
  duration: number;
  onSeek: (t: number) => void;
  onFullscreen: () => void;
}

export function LyricsCard({ song, lines, audioRef, duration, onSeek, onFullscreen }: CardProps) {
  return (
    <div className="lyr-card-shell relative overflow-hidden rounded-3xl">
      {song.cover_url && <img src={song.cover_url} alt="" aria-hidden className="lyr-card-art" />}
      <div className="lyr-card-veil" aria-hidden />
      <div className="relative z-10 p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] lyr-ink-soft">🎵 Lyrics</p>
            <p className="truncate text-base font-extrabold lyr-ink">{song.title}</p>
            <p className="truncate text-xs lyr-ink-soft">{song.artist}</p>
          </div>
          {lines.length > 0 && (
            <button type="button" onClick={onFullscreen} className="lyr-chip" aria-label="Lirik layar penuh">
              <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
            </button>
          )}
        </div>
        {lines.length > 0 ? (
          <div className="mt-2 h-[260px]">
            <LyricsStage lines={lines} audioRef={audioRef} duration={duration} onSeek={onSeek} variant="card" songKey={song.id} />
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed lyr-hairline px-3 py-5 text-center text-xs lyr-ink-soft">
            Lirik belum ditambahkan untuk lagu ini.
          </div>
        )}
      </div>
    </div>
  );
}

interface FullscreenProps {
  song: SongInfo;
  lines: CinematicLyricLine[];
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i * 1.7) % 12}s`,
  dur: `${14 + ((i * 5) % 10)}s`,
  size: 2 + (i % 3),
}));

export function FullscreenLyrics({ song, lines, audioRef, isPlaying, currentTime, duration, onSeek, onToggle, onNext, onPrev, onClose }: FullscreenProps) {
  // Crossfade artwork between songs.
  const [layers, setLayers] = useState<{ key: string; url: string | null; leaving: boolean }[]>(() => [{ key: song.id, url: song.cover_url, leaving: false }]);
  useEffect(() => {
    setLayers(prev => {
      if (prev[prev.length - 1]?.key === song.id) return prev;
      return [...prev.map(l => ({ ...l, leaving: true })), { key: song.id, url: song.cover_url, leaving: false }];
    });
    const t = window.setTimeout(() => setLayers(prev => prev.filter(l => !l.leaving)), 900);
    return () => window.clearTimeout(t);
  }, [song.id, song.cover_url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const particles = useMemo(() => PARTICLES, []);

  return createPortal(
    <div className="lyr-fs-root fixed inset-0 z-[120] flex flex-col overflow-hidden" role="dialog" aria-label={`Lirik ${song.title}`}>
      {/* Background: blurred artwork + veil + ambient light + particles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {layers.map(l => (
          <div key={l.key} className={`lyr-bg-layer ${l.leaving ? "is-leaving" : "is-entering"}`}>
            {l.url ? <img src={l.url} alt="" className="lyr-bg-art" /> : <div className="lyr-bg-fallback" />}
          </div>
        ))}
        <div className="lyr-bg-veil" />
        <div className="lyr-glow lyr-glow-a" />
        <div className="lyr-glow lyr-glow-b" />
        {particles.map((p, i) => (
          <span key={i} className="lyr-particle" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur, width: p.size, height: p.size }} />
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 px-4 pb-2 lyr-safe-top">
        <button type="button" onClick={onClose} className="lyr-icon-btn" aria-label="Tutup lirik">
          <ChevronDown className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] lyr-ink-soft">Lyrics</p>
          <p key={song.id} className="lyr-enter truncate text-sm font-bold lyr-ink">{song.title}</p>
        </div>
        <div className="w-11" />
      </div>

      {/* Lyrics */}
      <div className="relative z-10 min-h-0 flex-1">
        {lines.length > 0 ? (
          <LyricsStage lines={lines} audioRef={audioRef} duration={duration} onSeek={onSeek} variant="fullscreen" songKey={song.id} />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm lyr-ink-soft">Lirik belum ditambahkan untuk lagu ini.</div>
        )}
      </div>

      {/* Bottom player */}
      <div className="relative z-10 px-3 pt-2 lyr-safe-bottom">
        <div className="lyr-glass mx-auto w-full max-w-2xl rounded-3xl p-3 md:p-4">
          <div className="flex items-center gap-3">
            <div key={song.id} className="lyr-enter h-12 w-12 shrink-0 overflow-hidden rounded-xl lyr-art-ring">
              {song.cover_url ? <img src={song.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Music className="h-5 w-5 lyr-ink-soft" /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold lyr-ink">{song.title}</p>
              <p className="truncate text-xs lyr-ink-soft">{song.artist}</p>
            </div>
          </div>
          <div className="mt-3">
            <Slider value={[Math.min(currentTime, duration || currentTime)]} max={duration || 100} step={0.5} onValueChange={v => onSeek(v[0])} className="cursor-pointer" aria-label="Posisi lagu" />
            <div className="mt-1 flex justify-between text-[10px] tabular-nums lyr-ink-soft">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-center gap-6">
            <button type="button" onClick={onPrev} className="lyr-ctrl" aria-label="Lagu sebelumnya"><SkipBack className="h-6 w-6" fill="currentColor" /></button>
            <button type="button" onClick={onToggle} className="lyr-ctrl lyr-ctrl-main" aria-label={isPlaying ? "Jeda" : "Putar"}>
              {isPlaying ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-0.5 h-7 w-7" fill="currentColor" />}
            </button>
            <button type="button" onClick={onNext} className="lyr-ctrl" aria-label="Lagu berikutnya"><SkipForward className="h-6 w-6" fill="currentColor" /></button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

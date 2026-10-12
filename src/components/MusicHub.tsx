import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Play, Pause, SkipBack, SkipForward, Heart, Clock, ListMusic, Music2, Globe, Mic2, Sparkles, X, HardDrive, ChevronRight, Maximize2, Shuffle } from "lucide-react";
import RecentlyPlayed from "@/components/music/RecentlyPlayed";
import MusicHomeSections from "@/components/music/MusicHomeSections";
import { supabase } from "@/integrations/supabase/client";
import MusicPublicTab from "@/components/MusicPublicTab";
import ArtistTab from "@/components/ArtistTab";
import type { PlaybackState } from "@/components/PlaylistTab";

/** home = Untukmu, playlist = library existing (PlaylistTab), hub = level/quest/radio (MusicMegaHub). */
export type MusicSubTab = "home" | "playlist" | "publik" | "artist" | "hub";

type Song = { id: string; title: string; artist: string; file_url: string; cover_url: string | null };

interface MusicHubProps {
  subTab: MusicSubTab;
  onSubTabChange: (s: MusicSubTab) => void;
  onPlayExternal?: (song: Song) => void;
  playlistSlot: React.ReactNode;
  playbackState?: PlaybackState;
  onTogglePlay?: () => void;
  onOpenFullPlayer?: () => void;
}

const TABS: { key: MusicSubTab; label: string; icon: typeof Music2 }[] = [
  { key: "home", label: "Untukmu", icon: Sparkles },
  { key: "playlist", label: "Library", icon: ListMusic },
  { key: "publik", label: "Publik", icon: Globe },
  { key: "artist", label: "Artist", icon: Mic2 },
  { key: "hub", label: "Hub", icon: Music2 },
];

const control = (action: string, value?: number) => window.dispatchEvent(new CustomEvent("music:control", { detail: { action, value } }));
const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const fmt = (s: number) => { if (!Number.isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
const fmtBytes = (b: number) => b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`;

function Art({ src, className = "" }: { src: string | null | undefined; className?: string }) {
  return src
    ? <img src={src} alt="" loading="lazy" decoding="async" className={`object-cover bg-muted ${className}`} />
    : <div className={`grid place-items-center bg-gradient-to-br from-primary/30 to-accent/30 ${className}`}><Music2 className="h-1/3 w-1/3 text-primary" /></div>;
}

export default function MusicHub({ subTab, onSubTabChange, onPlayExternal, playlistSlot, playbackState, onTogglePlay, onOpenFullPlayer }: MusicHubProps) {
  const song = playbackState?.song ?? null;
  const isPlaying = !!playbackState?.isPlaying;
  const cur = playbackState?.currentTime ?? 0;
  const dur = playbackState?.duration ?? 0;
  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;

  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [publicSongs, setPublicSongs] = useState<Song[]>([]);
  const [q, setQ] = useState("");
  const [storage, setStorage] = useState<{ used: number; max: number } | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.from("playlist_songs").select("id, title, artist, file_url, cover_url").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { if (alive) setAllSongs((data || []) as Song[]); });
    return () => { alive = false; };
  }, []);

  // Lagu publik hanya dimuat saat user mulai mencari.
  useEffect(() => {
    if (!q.trim() || publicSongs.length) return;
    supabase.from("public_songs").select("id, title, artist, file_url, cover_url").eq("status", "approved").limit(300)
      .then(({ data }) => setPublicSongs((data || []) as Song[]));
  }, [q, publicSongs.length]);

  useEffect(() => {
    const on = (e: Event) => setStorage((e as CustomEvent<{ used: number; max: number }>).detail);
    window.addEventListener("music:storage", on);
    window.dispatchEvent(new Event("music:storage-request"));
    return () => window.removeEventListener("music:storage", on);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [song?.id, subTab]);

  const results = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    const seen = new Set<string>();
    return [...allSongs, ...publicSongs].filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return norm(`${s.title} ${s.artist}`).includes(t);
    }).slice(0, 30);
  }, [q, allSongs, publicSongs]);

  const play = (s: Song) => onPlayExternal?.(s);
  const playRandom = () => { if (allSongs.length) play(allSongs[Math.floor(Math.random() * allSongs.length)]); };
  const goLibrary = (action: string) => { onSubTabChange("playlist"); setTimeout(() => control(action), 0); };

  return (
    <div className="music-page space-y-4 pb-4">
      {/* Header + search */}
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Musik</h1>
          <p className="text-xs text-muted-foreground">Temukan dan nikmati musik favoritmu</p>
        </div>
        <label className="relative block">
          <span className="sr-only">Cari musik</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari lagu, artis, atau playlist..."
            className="h-11 w-full rounded-2xl border border-border bg-card/70 pl-10 pr-10 text-sm text-foreground backdrop-blur placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60" />
          {q && <button onClick={() => setQ("")} aria-label="Hapus pencarian" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
        </label>
      </header>

      {q.trim() ? (
        <section aria-label="Hasil pencarian" className="space-y-2">
          <p className="text-xs text-muted-foreground">{results.length ? `${results.length} hasil` : "Tidak ada lagu yang cocok."}</p>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card/60">
            {results.map((s) => (
              <li key={s.id}>
                <button onClick={() => play(s)} className="flex h-[68px] w-full items-center gap-3 px-3 text-left hover:bg-muted/50">
                  <Art src={s.cover_url} className="h-12 w-12 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{s.title}</span><span className="block truncate text-xs text-muted-foreground">{s.artist}</span></span>
                  <Play className="h-4 w-4 shrink-0 text-primary" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {/* Desktop: kolom kiri library, kanan konten */}
          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
            <nav aria-label="Library musik" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:sticky lg:top-4 lg:mx-0 lg:mb-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
              {TABS.map(({ key, label, icon: Icon }) => {
                const active = subTab === key;
                return (
                  <button key={key} onClick={() => onSubTabChange(key)} aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-colors lg:rounded-xl lg:py-2.5 lg:text-sm ${active ? "bg-primary text-primary-foreground" : "bg-card/60 text-muted-foreground hover:text-foreground"}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 space-y-5">
              {/* Now Playing */}
              <section ref={heroRef} aria-label="Sedang diputar" className="music-hero relative overflow-hidden rounded-[24px] border border-border/60 p-4 sm:p-5">
                {song ? (
                  <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                    <Art key={song.id} src={song.cover_url} className="aspect-square w-40 shrink-0 rounded-[20px] shadow-2xl animate-fade-in sm:w-36" />
                    <div className="w-full min-w-0 flex-1 space-y-3">
                      <div className="text-center sm:text-left">
                        <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary sm:justify-start">
                          {isPlaying && <span className="music-bars" aria-hidden><i /><i /><i /></span>} Sedang diputar
                        </p>
                        <p className="mt-1 truncate text-lg font-extrabold text-foreground">{song.title}</p>
                        <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
                      </div>
                      <div>
                        <input type="range" min={0} max={dur || 0} step={0.5} value={Math.min(cur, dur || 0)} disabled={!dur}
                          onChange={(e) => control("seek", Number(e.target.value))} aria-label="Posisi lagu"
                          className="music-range w-full" style={{ ["--p" as string]: `${pct}%` }} />
                        <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground"><span>{fmt(cur)}</span><span>{fmt(dur)}</span></div>
                      </div>
                      <div className="flex items-center justify-center gap-5 sm:justify-start">
                        <button onClick={() => control("prev")} aria-label="Lagu sebelumnya" className="grid h-10 w-10 place-items-center rounded-full text-foreground hover:bg-muted"><SkipBack className="h-5 w-5" /></button>
                        <button onClick={onTogglePlay} aria-label={isPlaying ? "Jeda" : "Putar"} className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95">
                          {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
                        </button>
                        <button onClick={() => control("next")} aria-label="Lagu berikutnya" className="grid h-10 w-10 place-items-center rounded-full text-foreground hover:bg-muted"><SkipForward className="h-5 w-5" /></button>
                        <button onClick={onOpenFullPlayer} aria-label="Buka pemutar penuh dan lirik" className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"><Maximize2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] bg-primary/15 text-primary"><Music2 className="h-7 w-7" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground">Belum ada lagu diputar</p>
                      <p className="text-xs text-muted-foreground">Pilih lagu di bawah atau putar acak dari koleksi.</p>
                    </div>
                    <button onClick={playRandom} disabled={!allSongs.length} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50">
                      <Shuffle className="h-4 w-4" /> Acak
                    </button>
                  </div>
                )}
              </section>

              {subTab === "home" && (
                <>
                  {/* Quick access → fitur library existing */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { icon: Heart, label: "Favorit", act: () => goLibrary("open-liked") },
                      { icon: Clock, label: "Terakhir Diputar", act: () => document.getElementById("music-recent")?.scrollIntoView({ behavior: "smooth", block: "center" }) },
                      { icon: ListMusic, label: "Playlist Saya", act: () => goLibrary("open-playlists") },
                      { icon: Music2, label: "Semua Lagu", act: () => goLibrary("open-all") },
                    ].map(({ icon: Icon, label, act }) => (
                      <button key={label} onClick={act} className="flex h-12 items-center gap-2.5 rounded-2xl bg-card/70 px-3 text-left text-[13px] font-semibold text-foreground transition hover:bg-muted">
                        <Icon className="h-4 w-4 shrink-0 text-primary" /> <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>

                  <div id="music-recent"><RecentlyPlayed current={song} pool={allSongs} onPlay={play} /></div>

                  <MusicHomeSections onPlay={play} onOpenPlaylist={() => goLibrary("open-playlists")} onOpenArtists={() => onSubTabChange("artist")} />

                  {/* Storage ringkas — angka dari library existing; pembelian di alur existing */}
                  {storage && storage.max > 0 && (
                    <section aria-label="Music Storage" className="rounded-[20px] border border-border bg-card/70 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><HardDrive className="h-4 w-4 text-primary" /> Music Storage</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">{fmtBytes(storage.used)} / {fmtBytes(storage.max)}</p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (storage.used / storage.max) * 100)}%` }} /></div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground">{fmtBytes(Math.max(0, storage.max - storage.used))} tersedia untuk lagu offline</p>
                        <button onClick={() => goLibrary("open-storage")} className="inline-flex items-center gap-0.5 text-xs font-bold text-primary">Kelola Storage <ChevronRight className="h-3.5 w-3.5" /></button>
                      </div>
                    </section>
                  )}
                </>
              )}

              <div className={subTab === "playlist" ? "animate-fade-in" : "hidden"}>{playlistSlot}</div>
              {subTab === "publik" && <MusicPublicTab onPlaySong={play} />}
              {subTab === "artist" && <ArtistTab onPlaySong={play} />}
            </div>
          </div>
        </>
      )}

      {/* Mini player saat hero tidak terlihat */}
      {song && !heroVisible && (
        <div className="fixed inset-x-3 z-40 mx-auto max-w-xl animate-fade-in" style={{ bottom: "calc(var(--premium-nav-h, 84px) + env(safe-area-inset-bottom) + 8px)" }}>
          <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card/95 p-2 pr-3 shadow-2xl backdrop-blur-xl">
            <button onClick={onOpenFullPlayer} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Buka pemutar penuh">
              <Art src={song.cover_url} className="h-11 w-11 shrink-0 rounded-xl" />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{song.title}</span><span className="block truncate text-xs text-muted-foreground">{song.artist}</span></span>
            </button>
            <button onClick={onTogglePlay} aria-label={isPlaying ? "Jeda" : "Putar"} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

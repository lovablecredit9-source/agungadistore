import { useEffect, useState } from "react";
import { History, Shuffle, Play, Trash2 } from "lucide-react";

export interface RecentSong { id: string; title: string; artist: string; file_url: string; cover_url: string | null }

const KEY = "music_recently_played_v1";
const MAX = 12;

function load(): RecentSong[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((s) => s?.id && s?.file_url).slice(0, MAX) : [];
  } catch { return []; }
}

/** "Baru Diputar" + tombol Putar Acak. Riwayat disimpan di perangkat ini. */
export default function RecentlyPlayed({ current, pool, onPlay }: {
  current: RecentSong | null;
  pool: RecentSong[];
  onPlay?: (s: RecentSong) => void;
}) {
  const [items, setItems] = useState<RecentSong[]>(load);

  // Catat lagu yang sedang diputar (sekali per lagu).
  useEffect(() => {
    if (!current?.id || !current.file_url) return;
    setItems((prev) => {
      if (prev[0]?.id === current.id) return prev;
      const s: RecentSong = { id: current.id, title: current.title, artist: current.artist, file_url: current.file_url, cover_url: current.cover_url ?? null };
      const next = [s, ...prev.filter((p) => p.id !== s.id)].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { void 0; }
      return next;
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shuffle = () => {
    const src = pool.length ? pool : items;
    const choices = src.filter((s) => s.id !== current?.id);
    const pick = (choices.length ? choices : src)[Math.floor(Math.random() * (choices.length || src.length))];
    if (pick) onPlay?.(pick);
  };

  const clear = () => {
    setItems([]);
    try { localStorage.removeItem(KEY); } catch { void 0; }
  };

  return (
    <section aria-label="Baru diputar" className="rounded-2xl border border-border bg-card/80 p-3 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <History className="h-4 w-4 text-primary" aria-hidden /> Baru Diputar
        </h3>
        <div className="flex items-center gap-1.5">
          {items.length > 0 && (
            <button onClick={clear} aria-label="Hapus riwayat putar" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={shuffle} disabled={!pool.length && !items.length}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm transition active:scale-95 disabled:opacity-50">
            <Shuffle className="h-3.5 w-3.5" aria-hidden /> Putar Acak
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">Belum ada lagu diputar. Coba tekan "Putar Acak" 🎧</p>
      ) : (
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {items.map((s) => {
            const playing = current?.id === s.id;
            return (
              <button key={s.id} onClick={() => onPlay?.(s)} aria-label={`Putar ${s.title}`}
                className="group w-[92px] shrink-0 text-left">
                <div className={`relative aspect-square overflow-hidden rounded-xl bg-muted ${playing ? "ring-2 ring-primary" : ""}`}>
                  {s.cover_url
                    ? <img src={s.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-2xl">🎵</div>}
                  <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-90 shadow">
                    <Play className="h-3 w-3 fill-current" aria-hidden />
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] font-semibold text-foreground">{s.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">{playing ? "Sedang diputar" : s.artist}</p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

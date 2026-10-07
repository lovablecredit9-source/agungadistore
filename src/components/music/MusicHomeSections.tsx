import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Play, Star, TrendingUp, Clock, Flame, Sparkles, Mic2, Upload, ListMusic, Activity, Heart, MessageCircle, Music2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export interface HubSong { id: string; title: string; artist: string; file_url: string; cover_url: string | null }
interface Row extends HubSong { created_at: string; is_featured?: boolean; is_trending?: boolean; artist_id?: string | null }
interface Artist { id: string; name: string; photo_url: string | null; genre: string | null }
interface FeedItem { kind: "release" | "upload" | "like" | "comment"; who: string; title: string; song_id: string; cover_url: string | null; at: string }
interface Stats { plays_week: Record<string, number>; plays_all: Record<string, number>; likes: Record<string, number> }

function timeAgo(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
}

const SongCard = memo(function SongCard({ s, badge, onPlay }: { s: HubSong; badge?: string; onPlay: (s: HubSong) => void }) {
  return (
    <button onClick={() => onPlay(s)} aria-label={`Putar ${s.title}`} className="group w-[128px] shrink-0 snap-start text-left">
      <div className="relative aspect-square overflow-hidden rounded-[18px] bg-muted shadow-sm">
        {s.cover_url
          ? <img src={s.cover_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-accent/30"><Music2 className="h-8 w-8 text-primary" /></div>}
        {badge && <span className="absolute left-1.5 top-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[9.5px] font-bold text-foreground backdrop-blur">{badge}</span>}
        <span className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-active:scale-90">
          <Play className="h-3.5 w-3.5 fill-current" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-[12px] font-semibold text-foreground">{s.title}</p>
      <p className="truncate text-[10.5px] text-muted-foreground">{s.artist}</p>
    </button>
  );
});

function Section({ icon: Icon, title, children, empty, loading }: { icon: typeof Star; title: string; children: React.ReactNode; empty?: boolean; loading?: boolean }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[15px] font-extrabold tracking-tight text-foreground"><Icon className="h-4 w-4 text-primary" aria-hidden /> {title}</h3>
      {loading ? (
        <div className="flex gap-3 overflow-hidden">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="w-[128px] shrink-0 space-y-1.5"><Skeleton className="aspect-square w-full rounded-[18px]" /><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-16" /></div>)}</div>
      ) : empty ? (
        <p className="rounded-2xl border border-dashed border-border py-5 text-center text-xs text-muted-foreground">Belum ada lagu di bagian ini.</p>
      ) : (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{children}</div>
      )}
    </section>
  );
}

/** Beranda Musik: semua bagian membaca data asli (lagu admin, statistik putar, like, upload publik, artist). */
export default function MusicHomeSections({ onPlay, onOpenPlaylist, onOpenArtists }: { onPlay: (s: HubSong) => void; onOpenPlaylist: () => void; onOpenArtists: () => void }) {
  const [songs, setSongs] = useState<Row[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [uploads, setUploads] = useState<Row[] | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);

  /* eslint-disable @typescript-eslint/no-explicit-any -- music_feed/music_home_stats RPC rows are not in the generated types */
  const loadFeed = useCallback(async () => {
    const { data } = await (supabase as any).rpc("music_feed", { p_limit: 20 });
    setFeed(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    const db = supabase as any;
    db.from("playlist_songs").select("id, title, artist, file_url, cover_url, created_at, is_featured, is_trending, artist_id").order("created_at", { ascending: false }).limit(300)
      .then(({ data }: any) => setSongs(data || []));
    db.rpc("music_home_stats").then(({ data }: any) => setStats(data || { plays_week: {}, plays_all: {}, likes: {} }));
    db.from("artists").select("id, name, photo_url, genre").limit(50).then(({ data }: any) => setArtists(data || []));
    db.from("public_songs").select("id, title, artist, file_url, cover_url, created_at").eq("status", "approved").order("created_at", { ascending: false }).limit(15)
      .then(({ data }: any) => setUploads(data || []));
    void loadFeed();
    const ch = supabase.channel("music-feed-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "public_songs" }, () => loadFeed())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "playlist_songs" }, () => loadFeed())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadFeed]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const loading = !songs || !stats;
  const sec = useMemo(() => {
    if (!songs || !stats) return null;
    const byId = new Map(songs.map((s) => [s.id, s]));
    const rank = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ s: byId.get(id), n })).filter((x): x is { s: Row; n: number } => !!x.s);
    const week = rank(stats.plays_week);
    const all = rank(stats.plays_all);
    const liked = rank(stats.likes);
    const flagged = songs.filter((s) => s.is_trending);
    const trending = (flagged.length ? flagged.map((s) => ({ s, n: stats.plays_week[s.id] || 0 })) : week).slice(0, 12);
    const weekIds = new Set(week.map((x) => x.s.id));
    const recommended = [...liked, ...all].filter((x, i, arr) => !weekIds.has(x.s.id) && arr.findIndex((y) => y.s.id === x.s.id) === i).slice(0, 12);
    const artistCount = new Map<string, number>();
    songs.forEach((s) => s.artist_id && artistCount.set(s.artist_id, (artistCount.get(s.artist_id) || 0) + (stats.plays_all[s.id] || 0) + 1));
    return {
      featured: songs.filter((s) => s.is_featured).slice(0, 10),
      trending,
      latest: songs.slice(0, 12),
      week: week.slice(0, 12),
      recommended: recommended.length ? recommended : songs.slice(12, 24).map((s) => ({ s, n: 0 })),
      topArtists: [...artists].sort((a, b) => (artistCount.get(b.id) || 0) - (artistCount.get(a.id) || 0)).slice(0, 12),
    };
  }, [songs, stats, artists]);

  return (
    <div className="space-y-5">
      {/* Featured hero */}
      {(loading || (sec && sec.featured.length > 0)) && (
        <section aria-label="Featured Music">
          <h3 className="mb-2 flex items-center gap-1.5 text-[15px] font-extrabold text-foreground"><Star className="h-4 w-4 text-primary" /> Featured Music</h3>
          {loading ? <Skeleton className="h-40 w-full rounded-[22px]" /> : (
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {sec!.featured.map((s) => (
                <button key={s.id} onClick={() => onPlay(s)} className="relative h-40 w-[82%] max-w-[340px] shrink-0 snap-center overflow-hidden rounded-[22px] text-left">
                  {s.cover_url ? <img src={s.cover_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-14">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Pilihan Admin</p>
                    <p className="truncate text-lg font-extrabold text-foreground">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.artist}</p>
                  </div>
                  <span className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"><Play className="h-5 w-5 fill-current" /></span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <Section icon={TrendingUp} title="Trending" loading={loading} empty={!!sec && sec.trending.length === 0}>
        {sec?.trending.map((x, i) => <SongCard key={x.s.id} s={x.s} badge={`#${i + 1}`} onPlay={onPlay} />)}
      </Section>
      <Section icon={Clock} title="Terbaru" loading={loading} empty={!!sec && sec.latest.length === 0}>
        {sec?.latest.map((s) => <SongCard key={s.id} s={s} badge="Baru" onPlay={onPlay} />)}
      </Section>
      <Section icon={Flame} title="Populer Minggu Ini" loading={loading} empty={!!sec && sec.week.length === 0}>
        {sec?.week.map((x) => <SongCard key={x.s.id} s={x.s} badge={`${x.n}× diputar`} onPlay={onPlay} />)}
      </Section>
      <Section icon={Sparkles} title="Recommended For You" loading={loading} empty={!!sec && sec.recommended.length === 0}>
        {sec?.recommended.map((x) => <SongCard key={x.s.id} s={x.s} onPlay={onPlay} />)}
      </Section>

      <button onClick={onOpenPlaylist} className="flex w-full items-center gap-3 rounded-[20px] border border-border bg-card/80 p-3 text-left backdrop-blur-md">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><ListMusic className="h-5 w-5" /></span>
        <span className="flex-1"><span className="block text-sm font-bold text-foreground">Playlist Saya</span><span className="block text-[11px] text-muted-foreground">Buat & kelola playlist, unduh untuk offline</span></span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {sec && sec.topArtists.length > 0 && (
        <section aria-label="Artist Populer" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[15px] font-extrabold text-foreground"><Mic2 className="h-4 w-4 text-primary" /> Artist Populer</h3>
            <button onClick={onOpenArtists} className="text-[11px] font-semibold text-primary">Lihat semua</button>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {sec.topArtists.map((a) => (
              <button key={a.id} onClick={onOpenArtists} className="w-[76px] shrink-0 text-center">
                <div className="mx-auto h-[68px] w-[68px] overflow-hidden rounded-full bg-muted ring-2 ring-primary/30">
                  {a.photo_url ? <img src={a.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-xl">🎤</div>}
                </div>
                <p className="mt-1 truncate text-[11px] font-semibold text-foreground">{a.name}</p>
                {a.genre && <p className="truncate text-[9.5px] text-muted-foreground">{a.genre}</p>}
              </button>
            ))}
          </div>
        </section>
      )}

      <Section icon={Upload} title="Upload Terbaru" loading={!uploads} empty={!!uploads && uploads.length === 0}>
        {uploads?.map((s) => <SongCard key={s.id} s={s} badge="Publik" onPlay={onPlay} />)}
      </Section>

      {/* Music Feed */}
      <section aria-label="Music Feed" className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-[15px] font-extrabold text-foreground"><Activity className="h-4 w-4 text-primary" /> Music Feed <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-label="live" /></h3>
        {!feed ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
          : feed.length === 0 ? <p className="text-center text-xs text-muted-foreground">Belum ada aktivitas.</p>
          : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/80">
              {feed.slice(0, 10).map((f, i) => {
                const song = songs?.find((s) => s.id === f.song_id);
                const Icon = f.kind === "like" ? Heart : f.kind === "comment" ? MessageCircle : f.kind === "upload" ? Upload : Music2;
                const text = f.kind === "release" ? <>merilis lagu <strong>{f.title}</strong></>
                  : f.kind === "upload" ? <>mengupload lagu baru <strong>{f.title}</strong></>
                  : f.kind === "like" ? <>menyukai lagu <strong>{f.title}</strong></>
                  : <>berkomentar: “{f.title}”</>;
                return (
                  <li key={i}>
                    <button disabled={!song} onClick={() => song && onPlay(song)} className="flex w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1 text-[12px] leading-snug text-foreground"><strong>{f.who}</strong> {text}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(f.at)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
      </section>
    </div>
  );
}

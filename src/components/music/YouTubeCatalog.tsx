import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Youtube, X } from "lucide-react";

type Track = { id: string; video_id: string; title: string; artist: string; thumbnail_url: string | null; youtube_url: string; position: number };

/** YouTube-only songs (no licensed audio yet): shown with the official embed player, never copied. */
export default function YouTubeCatalog() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playing, setPlaying] = useState<Track | null>(null);
  useEffect(() => {
    supabase.from("music_youtube_tracks").select("id, video_id, title, artist, thumbnail_url, youtube_url, position")
      .is("song_id", null).order("position").limit(100)
      .then(({ data }) => setTracks((data as Track[]) || []));
  }, []);
  if (!tracks.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="font-bold text-sm flex items-center gap-1.5"><Youtube className="w-4 h-4 text-destructive" /> Putar di YouTube</h3>
      {playing && (
        <div className="relative rounded-2xl overflow-hidden border border-border aspect-video bg-muted">
          <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${playing.video_id}?autoplay=1`} title={playing.title}
            allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          <button aria-label="Tutup video" onClick={() => setPlaying(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
      )}
      <div className="space-y-1.5">
        {tracks.map(t => (
          <button key={t.id} onClick={() => setPlaying(t)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted text-left min-w-0">
            {t.thumbnail_url ? <img src={t.thumbnail_url} alt="" className="w-14 h-10 rounded-lg object-cover shrink-0" /> : <div className="w-14 h-10 rounded-lg bg-muted shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold line-clamp-1 break-words">{t.title}</p>
              <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
            </div>
            <span className="text-[10px] font-bold text-destructive shrink-0">▶ YouTube</span>
          </button>
        ))}
      </div>
    </section>
  );
}

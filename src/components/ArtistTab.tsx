import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Music, Play, ChevronLeft, User } from "lucide-react";

interface Artist {
  id: string;
  name: string;
  bio: string;
  photo_url: string | null;
  genre: string;
}

interface ArtistSong {
  id: string;
  title: string;
  artist: string;
  file_url: string;
  cover_url: string | null;
  duration: number;
}

interface ArtistTabProps {
  onPlaySong?: (song: { id: string; title: string; artist: string; file_url: string; cover_url: string | null }) => void;
}

const ArtistTab = ({ onPlaySong }: ArtistTabProps) => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<ArtistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [artistSongs, setArtistSongs] = useState<ArtistSong[]>([]);

  useEffect(() => {
    loadData();
    try {
      const vid = localStorage.getItem("balance_logged_in") ? localStorage.getItem("balance_visitor_id") : null;
      if (vid) supabase.rpc("bump_music_quest_event" as any, { p_visitor_id: vid, p_quest_type: "open_artist_tab" });
    } catch { /* noop */ }
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [artistRes, songRes] = await Promise.all([
      supabase.from("artists").select("*").order("name"),
      supabase.from("playlist_songs").select("id, title, artist, file_url, cover_url, duration"),
    ]);
    if (artistRes.data) setArtists(artistRes.data as Artist[]);
    if (songRes.data) setSongs(songRes.data as ArtistSong[]);
    setLoading(false);
  };

  const openArtist = (artist: Artist) => {
    setSelectedArtist(artist);
    // Find songs by artist name match
    const matched = songs.filter(s => s.artist.toLowerCase() === artist.name.toLowerCase());
    setArtistSongs(matched);
  };

  const filteredArtists = artists.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  // Also get unique artist names from songs that don't have an artist entry
  const songArtistNames = [...new Set(songs.map(s => s.artist.toLowerCase()))];
  const registeredNames = artists.map(a => a.name.toLowerCase());
  const unregisteredArtists = songArtistNames
    .filter(name => name && !registeredNames.includes(name) && name.toLowerCase().includes(search.toLowerCase()))
    .map(name => ({ name, songCount: songs.filter(s => s.artist.toLowerCase() === name).length }));

  if (selectedArtist) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setSelectedArtist(null)} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Kembali
        </Button>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {selectedArtist.photo_url ? (
                <img src={selectedArtist.photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-7 h-7 text-primary" />
                </div>
              )}
              <div>
                <h2 className="font-bold text-lg">{selectedArtist.name}</h2>
                {selectedArtist.genre && <p className="text-xs text-muted-foreground">{selectedArtist.genre}</p>}
                {selectedArtist.bio && <p className="text-sm text-muted-foreground mt-1">{selectedArtist.bio}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <h3 className="text-sm font-semibold text-muted-foreground">Lagu ({artistSongs.length})</h3>
        {artistSongs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Belum ada lagu dari artis ini</p>}
        {artistSongs.map(song => (
          <Card key={song.id} className="cursor-pointer hover:shadow-md transition" onClick={() => onPlaySong?.(song)}>
            <CardContent className="p-3 flex items-center gap-3">
              {song.cover_url ? (
                <img src={song.cover_url} alt="" className="w-10 h-10 rounded object-cover" />
              ) : (
                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{song.title}</div>
                <div className="text-xs text-muted-foreground">{song.artist}</div>
              </div>
              <Play className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Premium Aurora Header */}
      <div className="relative rounded-2xl p-[1.5px] overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(var(--neon-green)/0.85), hsl(var(--neon-cyan)/0.85) 50%, hsl(var(--neon-purple)/0.85))",
          backgroundSize: "300% 300%",
          animation: "aurora-shift 9s ease infinite",
        }}
      >
        <div className="relative rounded-[14px] bg-background/85 backdrop-blur-xl p-4 overflow-hidden">
          <div className="pointer-events-none absolute -top-8 -left-6 w-32 h-32 rounded-full blur-3xl opacity-40" style={{ background: "hsl(var(--neon-green)/0.6)" }} />
          <div className="pointer-events-none absolute -bottom-10 -right-6 w-36 h-36 rounded-full blur-3xl opacity-30" style={{ background: "hsl(var(--neon-purple)/0.6)" }} />

          <div className="relative flex items-center gap-3 mb-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-70" style={{ background: "linear-gradient(135deg, hsl(var(--neon-cyan)), hsl(var(--neon-purple)))" }} />
              <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, hsl(var(--neon-green)), hsl(var(--neon-cyan)) 50%, hsl(var(--neon-purple)))" }}>
                <User className="w-5 h-5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-extrabold tracking-tight bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(var(--neon-cyan)), hsl(var(--neon-green)))" }}>
                Direktori Artist
              </h2>
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{filteredArtists.length + unregisteredArtists.length} artis · {songs.length} lagu</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari artis..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background/70 backdrop-blur-sm border-white/10 focus-visible:ring-1"
              style={{ boxShadow: "0 0 0 1px hsl(var(--neon-cyan)/0.2)" }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-center text-muted-foreground py-4">Memuat...</p>
      ) : (
        <>
          {filteredArtists.length === 0 && unregisteredArtists.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-8">Tidak ada artis ditemukan</p>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {filteredArtists.map((artist, i) => {
              const palette = ["var(--neon-pink)", "var(--neon-cyan)", "var(--neon-purple)", "var(--neon-yellow)", "var(--neon-green)"];
              const color = palette[i % palette.length];
              const songCount = songs.filter(s => s.artist.toLowerCase() === artist.name.toLowerCase()).length;
              return (
                <div key={artist.id} className="relative rounded-2xl p-[1px] overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:-translate-y-0.5 group"
                  style={{ background: `linear-gradient(135deg, hsl(${color}/0.7), hsl(${color}/0.15))` }}
                  onClick={() => openArtist(artist)}
                >
                  <div className="relative rounded-[15px] bg-background/85 backdrop-blur-xl p-3 text-center overflow-hidden h-full">
                    <div className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity" style={{ background: `hsl(${color}/0.5)` }} />
                    <div className="relative">
                      {artist.photo_url ? (
                        <img src={artist.photo_url} alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-2 ring-2" style={{ boxShadow: `0 0 14px hsl(${color}/0.6)` }} />
                      ) : (
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, hsl(${color}/0.4), hsl(${color}/0.1))`, boxShadow: `0 0 14px hsl(${color}/0.5)` }}>
                          <User className="w-7 h-7" style={{ color: `hsl(${color})` }} />
                        </div>
                      )}
                      <div className="font-bold text-sm truncate">{artist.name}</div>
                      {artist.genre && <div className="text-[10px] text-muted-foreground truncate font-semibold">{artist.genre}</div>}
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-full" style={{ background: `hsl(${color}/0.15)`, color: `hsl(${color})` }}>
                        <Music className="w-2.5 h-2.5" /> {songCount} lagu
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {unregisteredArtists.map((ua, i) => {
              const palette = ["var(--neon-cyan)", "var(--neon-pink)", "var(--neon-purple)", "var(--neon-green)"];
              const color = palette[(filteredArtists.length + i) % palette.length];
              return (
                <div key={ua.name} className="relative rounded-2xl p-[1px] overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:-translate-y-0.5 group"
                  style={{ background: `linear-gradient(135deg, hsl(${color}/0.5), hsl(${color}/0.1))` }}
                  onClick={() => {
                    setSelectedArtist({ id: "", name: ua.name, bio: "", photo_url: null, genre: "" });
                    setArtistSongs(songs.filter(s => s.artist.toLowerCase() === ua.name));
                  }}
                >
                  <div className="relative rounded-[15px] bg-background/85 backdrop-blur-xl p-3 text-center overflow-hidden h-full">
                    <div className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" style={{ background: `hsl(${color}/0.5)` }} />
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: `linear-gradient(135deg, hsl(${color}/0.3), hsl(${color}/0.08))`, boxShadow: `0 0 12px hsl(${color}/0.4)` }}>
                        <Music className="w-6 h-6" style={{ color: `hsl(${color})` }} />
                      </div>
                      <div className="font-bold text-sm truncate capitalize">{ua.name}</div>
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-full" style={{ background: `hsl(${color}/0.15)`, color: `hsl(${color})` }}>
                        <Music className="w-2.5 h-2.5" /> {ua.songCount} lagu
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ArtistTab;

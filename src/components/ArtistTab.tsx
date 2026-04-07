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
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cari artis..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-center text-muted-foreground py-4">Memuat...</p>
      ) : (
        <>
          {filteredArtists.length === 0 && unregisteredArtists.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-4">Tidak ada artis ditemukan</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {filteredArtists.map(artist => (
              <Card key={artist.id} className="cursor-pointer hover:shadow-md transition" onClick={() => openArtist(artist)}>
                <CardContent className="p-3 text-center">
                  {artist.photo_url ? (
                    <img src={artist.photo_url} alt="" className="w-14 h-14 rounded-full object-cover mx-auto mb-2" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="font-medium text-sm truncate">{artist.name}</div>
                  {artist.genre && <div className="text-xs text-muted-foreground truncate">{artist.genre}</div>}
                  <div className="text-xs text-muted-foreground">
                    {songs.filter(s => s.artist.toLowerCase() === artist.name.toLowerCase()).length} lagu
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Unregistered artists from songs */}
            {unregisteredArtists.map(ua => (
              <Card key={ua.name} className="cursor-pointer hover:shadow-md transition" onClick={() => {
                setSelectedArtist({ id: "", name: ua.name, bio: "", photo_url: null, genre: "" });
                setArtistSongs(songs.filter(s => s.artist.toLowerCase() === ua.name));
              }}>
                <CardContent className="p-3 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                    <Music className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="font-medium text-sm truncate capitalize">{ua.name}</div>
                  <div className="text-xs text-muted-foreground">{ua.songCount} lagu</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ArtistTab;

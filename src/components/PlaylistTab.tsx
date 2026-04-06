import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Play, Pause, SkipBack, SkipForward, Download, Volume2, VolumeX, Repeat, Shuffle, Loader2, Globe, HardDrive, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Song {
  id: string;
  title: string;
  artist: string;
  file_url: string;
  cover_url: string | null;
  duration: number;
  file_size: number;
  created_at: string;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PlaylistTab = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSongs();
  }, []);

  async function fetchSongs() {
    setLoading(true);
    const { data } = await supabase.from("playlist_songs").select("*").order("created_at", { ascending: false });
    setSongs((data as Song[]) || []);
    setLoading(false);
  }

  const currentSong = currentIndex >= 0 ? songs[currentIndex] : null;

  const playSong = useCallback((index: number) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(songs[index].file_url);
    audioRef.current = audio;
    audio.volume = muted ? 0 : volume;
    audio.play().catch(() => {});
    setCurrentIndex(index);
    setIsPlaying(true);
    setCurrentTime(0);

    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("ended", () => {
      if (repeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext(index);
      }
    });
  }, [songs, volume, muted, repeat, shuffle]);

  function playNext(fromIndex?: number) {
    const idx = fromIndex ?? currentIndex;
    if (songs.length === 0) return;
    if (shuffle) {
      const nextIdx = Math.floor(Math.random() * songs.length);
      playSong(nextIdx);
    } else if (idx < songs.length - 1) {
      playSong(idx + 1);
    } else {
      playSong(0);
    }
  }

  function playPrev() {
    if (songs.length === 0) return;
    if (currentIndex > 0) playSong(currentIndex - 1);
    else playSong(songs.length - 1);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  function seek(val: number[]) {
    if (audioRef.current) {
      audioRef.current.currentTime = val[0];
      setCurrentTime(val[0]);
    }
  }

  function changeVolume(val: number[]) {
    setVolume(val[0]);
    setMuted(false);
    if (audioRef.current) audioRef.current.volume = val[0];
  }

  function toggleMute() {
    setMuted(!muted);
    if (audioRef.current) audioRef.current.volume = muted ? volume : 0;
  }

  async function downloadSong(song: Song) {
    setDownloading(song.id);
    try {
      const response = await fetch(song.file_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${song.artist} - ${song.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download dimulai", description: `${song.title} sedang diunduh...` });
    } catch {
      toast({ title: "Gagal download", description: "Coba lagi nanti", variant: "destructive" });
    }
    setDownloading(null);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p className="text-sm">Memuat playlist...</p>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Music className="w-16 h-16 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-medium">Belum ada lagu di playlist.</p>
        <p className="text-xs mt-1">Admin bisa upload lagu dari dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold flex items-center gap-2">
        <Music className="w-5 h-5 text-primary" /> Playlist Musik
      </h2>

      {/* Now Playing */}
      {currentSong && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                {currentSong.cover_url ? (
                  <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={seek} className="cursor-pointer" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setShuffle(!shuffle)} className={`p-2 rounded-full transition-colors ${shuffle ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={playPrev} className="p-2 rounded-full text-foreground hover:bg-muted transition-colors">
                <SkipBack className="w-5 h-5" />
              </button>
              <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button onClick={() => playNext()} className="p-2 rounded-full text-foreground hover:bg-muted transition-colors">
                <SkipForward className="w-5 h-5" />
              </button>
              <button onClick={() => setRepeat(!repeat)} className={`p-2 rounded-full transition-colors ${repeat ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <Slider value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={changeVolume} className="flex-1 cursor-pointer" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Song List */}
      <div className="space-y-2">
        {songs.map((song, i) => (
          <Card key={song.id} className={`overflow-hidden transition-all cursor-pointer hover:shadow-md ${currentIndex === i ? "border-primary/40 bg-primary/5" : ""}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <button onClick={() => playSong(i)} className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors">
                {currentIndex === i && isPlaying ? (
                  <Pause className="w-4 h-4 text-primary" />
                ) : (
                  <Play className="w-4 h-4 text-primary ml-0.5" />
                )}
              </button>
              <div className="flex-1 min-w-0" onClick={() => playSong(i)}>
                <p className="font-bold text-sm truncate">{song.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{song.artist} • {song.file_size > 0 ? formatSize(song.file_size) : ""}</p>
              </div>
              <Button size="sm" variant="ghost" className="shrink-0 h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); downloadSong(song); }} disabled={downloading === song.id}>
                {downloading === song.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PlaylistTab;

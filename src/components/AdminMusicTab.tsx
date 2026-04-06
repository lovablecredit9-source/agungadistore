import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_STORAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

function formatStorageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const AdminMusicTab = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { fetchSongs(); }, []);

  async function fetchSongs() {
    setLoading(true);
    const { data } = await supabase.from("playlist_songs").select("*").order("created_at", { ascending: false });
    const songList = (data as Song[]) || [];
    setSongs(songList);
    // Calculate total storage from file sizes
    const totalUsed = songList.reduce((sum, s) => sum + (s.file_size || 0), 0);
    setStorageUsed(totalUsed);
    setLoading(false);
  }

  async function uploadSong() {
    if (!title.trim() || !musicFile) {
      toast({ title: "Isi judul dan pilih file musik", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = musicFile.name.split(".").pop() || "mp3";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("music-files").upload(fileName, musicFile);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("music-files").getPublicUrl(fileName);
      const fileUrl = urlData.publicUrl;

      let coverUrl: string | null = null;
      if (coverFile) {
        const coverExt = coverFile.name.split(".").pop() || "jpg";
        const coverName = `covers/${Date.now()}.${coverExt}`;
        const { error: coverErr } = await supabase.storage.from("music-files").upload(coverName, coverFile);
        if (!coverErr) {
          const { data: coverUrlData } = supabase.storage.from("music-files").getPublicUrl(coverName);
          coverUrl = coverUrlData.publicUrl;
        }
      }

      const { error: insertErr } = await supabase.from("playlist_songs").insert({
        title: title.trim(),
        artist: artist.trim() || "Unknown",
        file_url: fileUrl,
        cover_url: coverUrl,
        file_size: musicFile.size,
      });
      if (insertErr) throw insertErr;

      toast({ title: "Lagu berhasil diupload!" });
      setTitle("");
      setArtist("");
      setMusicFile(null);
      setCoverFile(null);
      if (fileRef.current) fileRef.current.value = "";
      if (coverRef.current) coverRef.current.value = "";
      fetchSongs();
    } catch (err: any) {
      toast({ title: "Gagal upload", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  }

  async function deleteSong(song: Song) {
    if (!confirm(`Hapus "${song.title}"?`)) return;
    // Extract file name from URL
    try {
      const url = new URL(song.file_url);
      const path = url.pathname.split("/music-files/")[1];
      if (path) await supabase.storage.from("music-files").remove([decodeURIComponent(path)]);
    } catch {}
    if (song.cover_url) {
      try {
        const url = new URL(song.cover_url);
        const path = url.pathname.split("/music-files/")[1];
        if (path) await supabase.storage.from("music-files").remove([decodeURIComponent(path)]);
      } catch {}
    }
    await supabase.from("playlist_songs").delete().eq("id", song.id);
    toast({ title: "Lagu dihapus" });
    fetchSongs();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="w-5 h-5" /> Upload Lagu Baru
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Judul lagu *" value={title} onChange={e => setTitle(e.target.value)} />
          <Input placeholder="Artis" value={artist} onChange={e => setArtist(e.target.value)} />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">File Musik (MP3, max 50MB)</label>
            <input ref={fileRef} type="file" accept="audio/*" onChange={e => setMusicFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cover (opsional)</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] || null)}
              className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer" />
          </div>
          <Button className="w-full gap-2" onClick={uploadSong} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {uploading ? "Mengupload..." : "Upload Lagu"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Music className="w-5 h-5" /> Daftar Lagu ({songs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : songs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada lagu.</p>
          ) : (
            songs.map(song => (
              <div key={song.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{song.title}</p>
                  <p className="text-[11px] text-muted-foreground">{song.artist} • {formatSize(song.file_size)}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0 shrink-0" onClick={() => deleteSong(song)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default AdminMusicTab;

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Plus, Trash2, Upload, Loader2, ListMusic, Image as ImageIcon, Edit2, Check, X, Type } from "lucide-react";
import { Wand2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

interface Song {
  id: string;
  title: string;
  artist: string;
  file_url: string;
  cover_url: string | null;
  duration: number;
  file_size: number;
  release_date: string | null;
  created_at: string;
}

interface Playlist {
  id: string;
  name: string;
  cover_url: string | null;
  playlist_type: string;
  created_at: string;
}

interface PlaylistItem {
  id: string;
  playlist_id: string;
  song_id: string;
  item_order: number;
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AdminMusicTab = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Playlist create/edit state
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [plName, setPlName] = useState("");
  const [plCoverFile, setPlCoverFile] = useState<File | null>(null);
  const plCoverRef = useRef<HTMLInputElement>(null);
  const [savingPlaylist, setSavingPlaylist] = useState(false);

  // Manage songs in playlist
  const [manageSongsOpen, setManageSongsOpen] = useState(false);
  const [managingPlaylist, setManagingPlaylist] = useState<Playlist | null>(null);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [savingSongs, setSavingSongs] = useState(false);

  const [activeTab, setActiveTab] = useState<"songs" | "playlists" | "lyrics">("songs");

  // Lyrics state
  const [lyricsDialogOpen, setLyricsDialogOpen] = useState(false);
  const [lyricsSong, setLyricsSong] = useState<Song | null>(null);
  const [lyricsText, setLyricsText] = useState("");
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const lrcFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [songsRes, plRes, piRes] = await Promise.all([
      supabase.from("playlist_songs").select("*").order("created_at", { ascending: false }),
      supabase.from("playlists").select("*").eq("playlist_type", "admin").order("created_at", { ascending: false }),
      supabase.from("playlist_items").select("*"),
    ]);
    setSongs((songsRes.data as Song[]) || []);
    setPlaylists((plRes.data as Playlist[]) || []);
    setPlaylistItems((piRes.data as PlaylistItem[]) || []);
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
        release_date: releaseDate || null,
      });
      if (insertErr) throw insertErr;

      toast({ title: "Lagu berhasil diupload!" });
      setTitle(""); setArtist(""); setReleaseDate(""); setMusicFile(null); setCoverFile(null);
      if (fileRef.current) fileRef.current.value = "";
      if (coverRef.current) coverRef.current.value = "";
      fetchAll();
    } catch (err: any) {
      toast({ title: "Gagal upload", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  }

  async function deleteSong(song: Song) {
    if (!confirm(`Hapus "${song.title}"?`)) return;
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
    fetchAll();
  }

  // --- Playlist CRUD ---
  function openCreatePlaylist() {
    setEditingPlaylist(null);
    setPlName("");
    setPlCoverFile(null);
    setPlaylistDialogOpen(true);
  }

  function openEditPlaylist(pl: Playlist) {
    setEditingPlaylist(pl);
    setPlName(pl.name);
    setPlCoverFile(null);
    setPlaylistDialogOpen(true);
  }

  async function savePlaylist() {
    if (!plName.trim()) {
      toast({ title: "Isi nama playlist", variant: "destructive" });
      return;
    }
    setSavingPlaylist(true);
    try {
      let coverUrl: string | null = editingPlaylist?.cover_url || null;
      if (plCoverFile) {
        const ext = plCoverFile.name.split(".").pop() || "jpg";
        const coverName = `playlist-covers/${Date.now()}.${ext}`;
        const { error: coverErr } = await supabase.storage.from("music-files").upload(coverName, plCoverFile);
        if (!coverErr) {
          const { data } = supabase.storage.from("music-files").getPublicUrl(coverName);
          coverUrl = data.publicUrl;
        }
      }

      if (editingPlaylist) {
        await supabase.from("playlists").update({ name: plName.trim(), cover_url: coverUrl }).eq("id", editingPlaylist.id);
        toast({ title: "Playlist diperbarui" });
      } else {
        await supabase.from("playlists").insert({ name: plName.trim(), cover_url: coverUrl, playlist_type: "admin" });
        toast({ title: "Playlist dibuat!" });
      }
      setPlaylistDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Gagal simpan playlist", description: err.message, variant: "destructive" });
    }
    setSavingPlaylist(false);
  }

  async function deletePlaylist(pl: Playlist) {
    if (!confirm(`Hapus playlist "${pl.name}"?`)) return;
    await supabase.from("playlists").delete().eq("id", pl.id);
    toast({ title: "Playlist dihapus" });
    fetchAll();
  }

  function openManageSongs(pl: Playlist) {
    setManagingPlaylist(pl);
    const existingIds = playlistItems.filter(pi => pi.playlist_id === pl.id).map(pi => pi.song_id);
    setSelectedSongIds(new Set(existingIds));
    setManageSongsOpen(true);
  }

  function toggleSongInPlaylist(songId: string) {
    setSelectedSongIds(prev => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId); else next.add(songId);
      return next;
    });
  }

  async function saveSongsInPlaylist() {
    if (!managingPlaylist) return;
    setSavingSongs(true);
    try {
      // Delete existing items for this playlist
      await supabase.from("playlist_items").delete().eq("playlist_id", managingPlaylist.id);
      // Insert selected ones
      const items = Array.from(selectedSongIds).map((songId, i) => ({
        playlist_id: managingPlaylist.id,
        song_id: songId,
        item_order: i,
      }));
      if (items.length > 0) {
        const { error } = await supabase.from("playlist_items").insert(items);
        if (error) throw error;
      }
      toast({ title: `${items.length} lagu disimpan ke playlist` });
      setManageSongsOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Gagal simpan", description: err.message, variant: "destructive" });
    }
    setSavingSongs(false);
  }

  function getSongCountForPlaylist(plId: string) {
    return playlistItems.filter(pi => pi.playlist_id === plId).length;
  }

  // --- Lyrics ---
  async function openLyricsEditor(song: Song) {
    setLyricsSong(song);
    setLyricsText("Memuat...");
    setLyricsDialogOpen(true);
    const { data } = await supabase.from("song_lyrics").select("*").eq("song_id", song.id).order("time_seconds", { ascending: true });
    if (data && data.length > 0) {
      // Convert to LRC-like format: [mm:ss.xx] text
      const lines = data.map((l: any) => {
        const mins = Math.floor(l.time_seconds / 60);
        const secs = (l.time_seconds % 60).toFixed(2).padStart(5, "0");
        return `[${String(mins).padStart(2, "0")}:${secs}]${l.text}`;
      });
      setLyricsText(lines.join("\n"));
    } else {
      setLyricsText("");
    }
  }

  async function saveLyrics() {
    if (!lyricsSong) return;
    setSavingLyrics(true);
    try {
      await supabase.from("song_lyrics").delete().eq("song_id", lyricsSong.id);
      const lines = lyricsText.split("\n").filter(l => l.trim());
      const parsed: { song_id: string; time_seconds: number; text: string; line_order: number }[] = [];
      lines.forEach((line, i) => {
        const match = line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\](.*)$/);
        if (match) {
          const mins = parseInt(match[1]);
          const secs = parseFloat(match[2]);
          parsed.push({ song_id: lyricsSong.id, time_seconds: mins * 60 + secs, text: match[3].trim(), line_order: i });
        } else {
          parsed.push({ song_id: lyricsSong.id, time_seconds: 0, text: line.trim(), line_order: i });
        }
      });
      if (parsed.length > 0) {
        const { error } = await supabase.from("song_lyrics").insert(parsed);
        if (error) throw error;
      }
      toast({ title: `${parsed.length} baris lirik disimpan` });
      setLyricsDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Gagal simpan lirik", description: err.message, variant: "destructive" });
    }
    setSavingLyrics(false);
  }

  async function generateLyricsFromAudio() {
    if (!lyricsSong) return;
    setGeneratingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lyrics-timestamps", {
        body: {
          song_duration: lyricsSong.duration || 180,
          song_title: lyricsSong.title,
          song_artist: lyricsSong.artist,
          file_url: lyricsSong.file_url,
          mode: "audio_transcribe",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.lrc) {
        setLyricsText(data.lrc);
        toast({ title: "Lirik dari audio berhasil di-generate! ✨" });
      }
    } catch (err: any) {
      toast({ title: "Gagal generate dari audio", description: err.message, variant: "destructive" });
    }
    setGeneratingLyrics(false);
  }

  async function generateTimestampsAI() {
    if (!lyricsSong || !lyricsText.trim()) return;
    setGeneratingLyrics(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lyrics-timestamps", {
        body: {
          lyrics_text: lyricsText.trim(),
          song_duration: lyricsSong.duration || 180,
          song_title: lyricsSong.title,
          song_artist: lyricsSong.artist,
          file_url: lyricsSong.file_url,
          mode: "timestamp_existing",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.lrc) {
        setLyricsText(data.lrc);
        toast({ title: "Timestamp AI berhasil di-generate! ✨" });
      }
    } catch (err: any) {
      toast({ title: "Gagal generate timestamp", description: err.message, variant: "destructive" });
    }
    setGeneratingLyrics(false);
  }

  function handleLrcUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setLyricsText(text.trim());
        toast({ title: "File LRC berhasil dimuat! 📄" });
      }
    };
    reader.readAsText(file);
    if (lrcFileRef.current) lrcFileRef.current.value = "";
  }

  return (
    <>
      {/* Tab Toggle */}
      <div className="flex gap-1.5">
        <Button variant={activeTab === "songs" ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-[11px] px-2" onClick={() => setActiveTab("songs")}>
          <Music className="w-3.5 h-3.5" /> Lagu ({songs.length})
        </Button>
        <Button variant={activeTab === "playlists" ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-[11px] px-2" onClick={() => setActiveTab("playlists")}>
          <ListMusic className="w-3.5 h-3.5" /> Playlist ({playlists.length})
        </Button>
        <Button variant={activeTab === "lyrics" ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-[11px] px-2" onClick={() => setActiveTab("lyrics")}>
          <Type className="w-3.5 h-3.5" /> Lirik
        </Button>
      </div>

      {activeTab === "songs" && (
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
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tanggal rilis (opsional)</label>
                <Input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">File Musik (MP3)</label>
                <input ref={fileRef} type="file" accept="audio/*" onChange={e => setMusicFile(e.target.files?.[0] || null)}
                  className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Thumbnail / Cover (opsional)</label>
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
                      {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" alt="" /> : <Music className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{song.title}</p>
                       <p className="text-[11px] text-muted-foreground">{song.artist}{song.file_size ? ` • ${formatSize(song.file_size)}` : ""}</p>
                       <p className="text-[10px] text-muted-foreground">{song.release_date ? `Rilis ${song.release_date}` : `Upload ${new Date(song.created_at).toLocaleDateString("id-ID")}`}</p>
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
      )}

      {activeTab === "playlists" && (
        <>
          <Button className="w-full gap-2" onClick={openCreatePlaylist}>
            <Plus className="w-4 h-4" /> Buat Playlist Baru
          </Button>

          {loading ? (
            <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : playlists.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Belum ada playlist.</p>
          ) : (
            <div className="space-y-2">
              {playlists.map(pl => (
                <Card key={pl.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {pl.cover_url ? <img src={pl.cover_url} className="w-full h-full object-cover" alt="" /> : <ListMusic className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{pl.name}</p>
                      <p className="text-[11px] text-muted-foreground">{getSongCountForPlaylist(pl.id)} lagu</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openManageSongs(pl)} title="Kelola lagu">
                        <Music className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditPlaylist(pl)} title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => deletePlaylist(pl)} title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Playlist Dialog */}
      <Dialog open={playlistDialogOpen} onOpenChange={setPlaylistDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPlaylist ? "Edit Playlist" : "Buat Playlist Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nama playlist *" value={plName} onChange={e => setPlName(e.target.value)} />
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cover Playlist (opsional)</label>
              <input ref={plCoverRef} type="file" accept="image/*" onChange={e => setPlCoverFile(e.target.files?.[0] || null)}
                className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer" />
            </div>
            {editingPlaylist?.cover_url && !plCoverFile && (
              <div className="flex items-center gap-2">
                <img src={editingPlaylist.cover_url} className="w-10 h-10 rounded object-cover" alt="" />
                <span className="text-xs text-muted-foreground">Cover saat ini</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={savePlaylist} disabled={savingPlaylist} className="w-full gap-2">
              {savingPlaylist ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingPlaylist ? "Simpan Perubahan" : "Buat Playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Songs in Playlist Dialog */}
      <Dialog open={manageSongsOpen} onOpenChange={setManageSongsOpen}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Kelola Lagu — {managingPlaylist?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {songs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Upload lagu dulu.</p>
            ) : (
              songs.map(song => (
                <label key={song.id} className="flex items-center gap-3 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selectedSongIds.has(song.id)} onCheckedChange={() => toggleSongInPlaylist(song.id)} />
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" alt="" /> : <Music className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{song.title}</p>
                    <p className="text-[10px] text-muted-foreground">{song.artist}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveSongsInPlaylist} disabled={savingSongs} className="w-full gap-2">
              {savingSongs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Simpan ({selectedSongIds.size} lagu)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lyrics Tab */}
      {activeTab === "lyrics" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Type className="w-5 h-5" /> Kelola Lirik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : songs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Upload lagu dulu.</p>
            ) : (
              songs.map(song => (
                <div key={song.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" alt="" /> : <Music className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{song.title}</p>
                    <p className="text-[11px] text-muted-foreground">{song.artist}</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" onClick={() => openLyricsEditor(song)}>
                    <Type className="w-3.5 h-3.5" /> Lirik
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Lyrics Editor Dialog */}
      <Dialog open={lyricsDialogOpen} onOpenChange={setLyricsDialogOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Type className="w-4 h-4" /> Lirik — {lyricsSong?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Ambil lirik langsung dari file audio, atau paste lirik untuk membuat timestamp, atau upload file LRC.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs flex-1"
                disabled={generatingLyrics}
                onClick={generateLyricsFromAudio}
              >
                {generatingLyrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {generatingLyrics ? "Generating..." : "Generate dari Audio"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={generatingLyrics || !lyricsText.trim()}
                onClick={generateTimestampsAI}
              >
                <Wand2 className="w-3.5 h-3.5" /> Timestamp AI
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => lrcFileRef.current?.click()}
              >
                <FileUp className="w-3.5 h-3.5" /> Upload LRC
              </Button>
              <input
                ref={lrcFileRef}
                type="file"
                accept=".lrc,.txt"
                className="hidden"
                onChange={handleLrcUpload}
              />
            </div>
            <Textarea
              value={lyricsText}
              onChange={e => setLyricsText(e.target.value)}
              rows={12}
              placeholder="[00:00.00]Masukkan lirik dengan timestamp..."
              className="text-xs font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLyricsDialogOpen(false)}>Batal</Button>
            <Button onClick={saveLyrics} disabled={savingLyrics} className="gap-2">
              {savingLyrics ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Simpan Lirik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminMusicTab;

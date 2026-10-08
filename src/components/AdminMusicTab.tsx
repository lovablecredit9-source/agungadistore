import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, Plus, Trash2, Upload, Loader2, ListMusic, Image as ImageIcon, Edit2, Check, X, Type, Shield, CheckCircle2, XCircle, Clock, Eye, User } from "lucide-react";
import { Wand2, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { parseLrcText, validateLyricLines, formatLrcTime, STATUS_META, type LyricLine, type LyricsReviewStatus } from "@/lib/lyrics-audit";
import YouTubePlaylistImporter from "@/components/music/YouTubePlaylistImporter";

// Durasi asli file audio (detik). Sebelumnya tidak disimpan sehingga semua lagu tercatat 0.
function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (v: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(v) ? Math.round(v) : 0); };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    a.src = url;
  });
}

interface Song {
  id: string;
  title: string;
  artist: string;
  file_url: string;
  cover_url: string | null;
  duration: number;
  file_size: number;
  release_date: string | null;
  is_featured?: boolean;
  is_trending?: boolean;
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

  const [activeTab, setActiveTab] = useState<"songs" | "playlists" | "lyrics" | "review" | "artists">("songs");

  // Review public songs
  const [pendingSongs, setPendingSongs] = useState<any[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const loadPendingSongs = async () => {
    setLoadingReview(true);
    const { data } = await supabase.from("public_songs").select("*").in("status", ["pending", "rejected"]).order("created_at", { ascending: false });
    setPendingSongs(data || []);
    setLoadingReview(false);
  };

  const handleReviewAction = async (songId: string, action: "approved" | "rejected") => {
    await supabase.from("public_songs").update({
      status: action,
      admin_note: reviewNote || (action === "approved" ? "Disetujui admin" : "Ditolak admin"),
    }).eq("id", songId);
    setReviewNote("");
    toast({ title: action === "approved" ? "Lagu disetujui!" : "Lagu ditolak" });
    loadPendingSongs();
  };

  // Artist management
  const [artistList, setArtistList] = useState<any[]>([]);
  const [artistName, setArtistName] = useState("");
  const [artistBio, setArtistBio] = useState("");
  const [artistGenre, setArtistGenre] = useState("");
  const [artistPhotoFile, setArtistPhotoFile] = useState<File | null>(null);
  const artistPhotoRef = useRef<HTMLInputElement>(null);
  const [savingArtist, setSavingArtist] = useState(false);
  const [editingArtist, setEditingArtist] = useState<any>(null);

  const loadArtists = async () => {
    const { data } = await supabase.from("artists").select("*").order("name");
    setArtistList(data || []);
  };

  const handleSaveArtist = async () => {
    if (!artistName.trim()) { toast({ title: "Nama artis wajib", variant: "destructive" }); return; }
    setSavingArtist(true);
    let photoUrl = editingArtist?.photo_url || null;
    if (artistPhotoFile) {
      const ext = artistPhotoFile.name.split(".").pop();
      const path = `artists/${Date.now()}.${ext}`;
      await supabase.storage.from("music-files").upload(path, artistPhotoFile);
      const { data } = supabase.storage.from("music-files").getPublicUrl(path);
      photoUrl = data.publicUrl;
    }
    if (editingArtist) {
      await supabase.from("artists").update({ name: artistName.trim(), bio: artistBio.trim(), genre: artistGenre.trim(), photo_url: photoUrl }).eq("id", editingArtist.id);
    } else {
      await supabase.from("artists").insert({ name: artistName.trim(), bio: artistBio.trim(), genre: artistGenre.trim(), photo_url: photoUrl });
    }
    toast({ title: editingArtist ? "Artis diperbarui!" : "Artis ditambahkan!" });
    setArtistName(""); setArtistBio(""); setArtistGenre(""); setArtistPhotoFile(null); setEditingArtist(null);
    loadArtists();
    setSavingArtist(false);
  };

  const handleDeleteArtist = async (id: string) => {
    await supabase.from("artists").delete().eq("id", id);
    toast({ title: "Artis dihapus" });
    loadArtists();
  };


  const [editSongOpen, setEditSongOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editReleaseDate, setEditReleaseDate] = useState("");
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const editCoverRef = useRef<HTMLInputElement>(null);
  const [savingSong, setSavingSong] = useState(false);

  // Lyrics state
  const [lyricsDialogOpen, setLyricsDialogOpen] = useState(false);
  const [lyricsSong, setLyricsSong] = useState<Song | null>(null);
  const [lyricsText, setLyricsText] = useState("");
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [lyricsIssues, setLyricsIssues] = useState<string[]>([]);
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
        duration: await readAudioDuration(musicFile),
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

  async function toggleSongFlag(song: Song, flag: "is_featured" | "is_trending") {
    const next = !song[flag];
    const { error } = await (supabase as any).from("playlist_songs").update({ [flag]: next }).eq("id", song.id);
    if (error) { toast({ title: "Gagal mengubah", description: error.message, variant: "destructive" }); return; }
    setSongs((prev) => prev.map((x) => (x.id === song.id ? { ...x, [flag]: next } : x)));
    toast({ title: flag === "is_featured" ? (next ? "Masuk Featured ⭐" : "Dihapus dari Featured") : (next ? "Masuk Trending 🔥" : "Dihapus dari Trending") });
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

  // --- Edit Song ---
  function openEditSong(song: Song) {
    setEditingSong(song);
    setEditTitle(song.title);
    setEditArtist(song.artist);
    setEditReleaseDate(song.release_date || "");
    setEditCoverFile(null);
    setEditSongOpen(true);
  }

  async function saveEditSong() {
    if (!editingSong || !editTitle.trim()) {
      toast({ title: "Judul wajib diisi", variant: "destructive" });
      return;
    }
    setSavingSong(true);
    try {
      let coverUrl: string | null = editingSong.cover_url;
      if (editCoverFile) {
        const ext = editCoverFile.name.split(".").pop() || "jpg";
        const coverName = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: coverErr } = await supabase.storage.from("music-files").upload(coverName, editCoverFile);
        if (!coverErr) {
          const { data } = supabase.storage.from("music-files").getPublicUrl(coverName);
          coverUrl = data.publicUrl;
        }
      }
      const { error } = await supabase.from("playlist_songs").update({
        title: editTitle.trim(),
        artist: editArtist.trim() || "Unknown",
        release_date: editReleaseDate || null,
        cover_url: coverUrl,
      }).eq("id", editingSong.id);
      if (error) throw error;
      toast({ title: "Lagu berhasil diperbarui! ✏️" });
      setEditSongOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Gagal menyimpan", description: err.message, variant: "destructive" });
    }
    setSavingSong(false);
  }


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
  const [lyricsSummary, setLyricsSummary] = useState<Record<string, { count: number; first: number; last: number; issues: string[] }>>({});

  async function loadLyricsSummary(songList: Song[] = songs) {
    const rows: LyricLine[] & { song_id?: string }[] = [] as any;
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("song_lyrics").select("song_id,time_seconds,text,line_order").order("song_id").order("line_order").range(from, from + 999);
      if (!data?.length) break;
      rows.push(...(data as any));
      if (data.length < 1000) break;
    }
    const by: Record<string, LyricLine[]> = {};
    (rows as any[]).forEach(r => { (by[r.song_id] ||= []).push({ ...r, time_seconds: Number(r.time_seconds) }); });
    const out: typeof lyricsSummary = {};
    songList.forEach(s => {
      const ls = by[s.id] || [];
      out[s.id] = { count: ls.length, first: ls[0]?.time_seconds ?? 0, last: ls[ls.length - 1]?.time_seconds ?? 0, issues: ls.length ? validateLyricLines(ls, s.duration) : [] };
    });
    setLyricsSummary(out);
    return out;
  }

  useEffect(() => { if (activeTab === "lyrics" && songs.length) loadLyricsSummary(); }, [activeTab, songs.length]);

  async function setReviewStatus(song: Song, status: LyricsReviewStatus, verified = false) {
    const { error } = await (supabase as any).from("playlist_songs").update({ lyrics_review_status: status, lyrics_verified_at: verified ? new Date().toISOString() : null }).eq("id", song.id);
    if (error) { toast({ title: "Gagal update status", description: error.message, variant: "destructive" }); return false; }
    setSongs(prev => prev.map(x => x.id === song.id ? ({ ...x, lyrics_review_status: status, lyrics_verified_at: verified ? new Date().toISOString() : null } as any) : x));
    return true;
  }

  async function checkLyrics(song: Song) {
    const sum = (await loadLyricsSummary())[song.id];
    if (!sum?.count) { await setReviewStatus(song, "missing"); toast({ title: "🔴 Lirik belum ada" }); return; }
    if (sum.issues.length) { await setReviewStatus(song, "needs_review"); toast({ title: "🟡 Timestamp perlu diperbaiki", description: sum.issues.slice(0, 3).join(" · "), variant: "destructive" }); return; }
    toast({ title: "Format & timestamp valid", description: "Dengarkan lagu lalu tekan Verify bila teks & timing cocok dengan audio." });
  }

  async function verifyLyrics(song: Song) {
    const sum = (await loadLyricsSummary())[song.id];
    if (!sum?.count || sum.issues.length) { toast({ title: "Tidak bisa Verify", description: sum?.issues?.slice(0, 3).join(" · ") || "Lirik kosong", variant: "destructive" }); return; }
    if (await setReviewStatus(song, "synced", true)) toast({ title: "🟢 Lirik ditandai Synced" });
  }

  async function openLyricsEditor(song: Song, autoAction?: "sync" | "regen") {
    setLyricsSong(song);
    setLyricsText("Memuat...");
    setLyricsIssues([]);
    setLyricsDialogOpen(true);
    const { data } = await supabase.from("song_lyrics").select("*").eq("song_id", song.id).order("line_order", { ascending: true });
    const text = data && data.length > 0 ? data.map((l: any) => `[${formatLrcTime(Number(l.time_seconds))}]${l.text}`).join("\n") : "";
    setLyricsText(text);
    if (autoAction === "regen") generateLyricsFromAudio(song);
    if (autoAction === "sync" && text) generateTimestampsAI(song, text);
  }

  async function saveLyrics() {
    if (!lyricsSong) return;
    const { lines, untimed } = parseLrcText(lyricsText);
    const issues = validateLyricLines(lines, lyricsSong.duration);
    if (lines.length && (untimed || issues.length)) {
      setLyricsIssues(issues);
      toast({ title: "Lirik belum valid, tidak disimpan", description: issues.slice(0, 3).join(" · "), variant: "destructive" });
      return;
    }
    setSavingLyrics(true);
    try {
      const { error: delErr } = await supabase.from("song_lyrics").delete().eq("song_id", lyricsSong.id);
      if (delErr) throw delErr;
      if (lines.length > 0) {
        const { error } = await supabase.from("song_lyrics").insert(lines.map(l => ({ ...l, song_id: lyricsSong.id })));
        if (error) throw error;
      }
      // Simpan ≠ terverifikasi: hasil AI/manual tetap Needs Review sampai admin Verify.
      await setReviewStatus(lyricsSong, lines.length ? "needs_review" : "missing");
      toast({ title: `${lines.length} baris lirik disimpan`, description: lines.length ? "Status: Needs Review — dengarkan lalu tekan Verify." : undefined });
      setLyricsDialogOpen(false);
      loadLyricsSummary();
    } catch (err: any) {
      toast({ title: "Gagal simpan lirik", description: err.message, variant: "destructive" });
    }
    setSavingLyrics(false);
  }

  async function invokeLyricsFn(song: Song, body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("generate-lyrics-timestamps", {
      body: { song_duration: song.duration || undefined, song_title: song.title, song_artist: song.artist, file_url: song.file_url, ...body },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { lrc?: string; needs_review?: boolean; method?: string; issues?: string[] };
  }

  async function generateLyricsFromAudio(song: Song | null = lyricsSong) {
    if (!song) return;
    setGeneratingLyrics(true);
    try {
      const data = await invokeLyricsFn(song, { mode: "audio_transcribe" });
      if (data?.lrc) {
        setLyricsText(data.lrc);
        setLyricsIssues(validateLyricLines(parseLrcText(data.lrc).lines, song.duration));
        toast({ title: "Lirik dari audio di-generate", description: "Periksa teks dengan mendengarkan lagu sebelum Simpan & Verify." });
      }
    } catch (err: any) {
      toast({ title: "Gagal generate dari audio", description: err.message, variant: "destructive" });
    }
    setGeneratingLyrics(false);
  }

  async function generateTimestampsAI(song: Song | null = lyricsSong, text: string = lyricsText) {
    if (!song || !text.trim()) return;
    setGeneratingLyrics(true);
    try {
      const data = await invokeLyricsFn(song, { lyrics_text: text.trim(), mode: "timestamp_existing" });
      if (data?.lrc) {
        setLyricsText(data.lrc);
        setLyricsIssues(data.issues || []);
        if (data.needs_review) toast({ title: "⚠️ Needs Review", description: (data.issues || []).slice(0, 2).join(" · ") || "Timestamp perlu dicek manual.", variant: "destructive" });
        else toast({ title: "Timestamp disinkronkan dengan audio ✨" });
      }
    } catch (err: any) {
      toast({ title: "Gagal sinkron timestamp", description: err.message, variant: "destructive" });
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
        <Button variant={activeTab === "review" ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-[11px] px-2" onClick={() => { setActiveTab("review"); loadPendingSongs(); }}>
          <Shield className="w-3.5 h-3.5" /> Review
          {pendingSongs.filter(s => s.status === "pending").length > 0 && <span className="bg-destructive/20 text-destructive text-[10px] font-bold px-1 rounded-full">{pendingSongs.filter(s => s.status === "pending").length}</span>}
        </Button>
        <Button variant={activeTab === "artists" ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-[11px] px-2" onClick={() => { setActiveTab("artists"); loadArtists(); }}>
          <User className="w-3.5 h-3.5" /> Artist
        </Button>
      </div>

      {activeTab === "songs" && (
        <>
          <YouTubePlaylistImporter />
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
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant={song.is_featured ? "default" : "ghost"} className="h-8 px-2 text-[11px]" onClick={() => toggleSongFlag(song, "is_featured")} title="Featured di beranda musik">⭐</Button>
                      <Button size="sm" variant={song.is_trending ? "default" : "ghost"} className="h-8 px-2 text-[11px]" onClick={() => toggleSongFlag(song, "is_trending")} title="Tandai Trending">🔥</Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditSong(song)} title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => deleteSong(song)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
            <DialogTitle className="text-sm">Kelola Lagu - {managingPlaylist?.name}</DialogTitle>
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
            <p className="text-[11px] text-muted-foreground">
              {Object.values(lyricsSummary).filter(s => s.count > 0).length}/{songs.length} lagu punya lirik ·
              {" "}{songs.filter(s => (s as any).lyrics_review_status === "synced").length} terverifikasi
            </p>
            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {([
                ["Total Song", songs.length],
                ["Lyrics Ready", songs.filter(s => (s as any).lyrics_review_status === "synced").length],
                ["Missing", songs.filter(s => !(lyricsSummary[s.id]?.count > 0) && (s as any).lyrics_review_status !== "instrumental").length],
                ["Needs Review", songs.filter(s => ["needs_review", "unchecked"].includes((s as any).lyrics_review_status) && lyricsSummary[s.id]?.count > 0).length],
                ["Mismatch", songs.filter(s => (s as any).lyrics_review_status === "mismatch").length],
              ] as const).map(([label, n]) => (
                <div key={label} className="rounded-lg border border-border bg-muted/40 px-1.5 py-1.5 text-center">
                  <div className="text-base font-bold text-foreground leading-none">{n}</div>
                  <div className="text-[9px] text-muted-foreground mt-1 leading-tight">{label}</div>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : songs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Upload lagu dulu.</p>
            ) : (
              songs.map(song => {
                const sum = lyricsSummary[song.id];
                const st = ((song as any).lyrics_review_status || "unchecked") as LyricsReviewStatus;
                const meta = STATUS_META[st] || STATUS_META.unchecked;
                return (
                <div key={song.id} className="p-2 rounded-lg border border-border space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" alt="" /> : <Music className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{song.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <span className="text-[11px] font-semibold shrink-0" data-testid="lyrics-status">{meta.dot} {meta.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {sum?.count || 0} baris · awal {sum?.count ? formatLrcTime(sum.first) : "—"} · akhir {sum?.count ? formatLrcTime(sum.last) : "—"} · durasi {song.duration ? formatLrcTime(song.duration) : "—"}
                    {(song as any).lyrics_verified_at ? ` · diverifikasi ${new Date((song as any).lyrics_verified_at).toLocaleDateString("id-ID")}` : ""}
                  </p>
                  {sum?.issues?.length ? <p className="text-[10px] text-destructive">{sum.issues.slice(0, 2).join(" · ")}{sum.issues.length > 2 ? ` (+${sum.issues.length - 2})` : ""}</p> : null}
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => checkLyrics(song)}>Check Lyrics</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" disabled={!sum?.count} onClick={() => openLyricsEditor(song, "sync")}>Sync with Audio</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => openLyricsEditor(song, "regen")}>Re-Generate</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => openLyricsEditor(song)}>Edit</Button>
                    <Button size="sm" className="h-7 text-[10px] px-2" disabled={!sum?.count} onClick={() => verifyLyrics(song)}>Verify</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setReviewStatus(song, "instrumental")}>Instrumental</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" disabled={!sum?.count} onClick={() => setReviewStatus(song, "mismatch")}>Tandai Mismatch</Button>
                  </div>
                </div>
              );})
            )}
          </CardContent>
        </Card>
      )}

      {/* Lyrics Editor Dialog */}
      <Dialog open={lyricsDialogOpen} onOpenChange={setLyricsDialogOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Type className="w-4 h-4" /> Lirik - {lyricsSong?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Ambil lirik langsung dari file audio, atau paste lirik untuk membuat timestamp, atau upload file LRC.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs flex-1"
                disabled={generatingLyrics}
                onClick={() => generateLyricsFromAudio()}
              >
                {generatingLyrics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {generatingLyrics ? "Generating..." : "Generate dari Audio"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                disabled={generatingLyrics || !lyricsText.trim()}
                onClick={() => generateTimestampsAI()}
              >
                <Wand2 className="w-3.5 h-3.5" /> Sync Audio
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
              onBlur={() => lyricsSong && setLyricsIssues(lyricsText.trim() ? validateLyricLines(parseLrcText(lyricsText).lines, lyricsSong.duration) : [])}
              className="text-xs font-mono"
            />
            {lyricsIssues.length > 0 && (
              <div className="text-[10px] text-destructive space-y-0.5" data-testid="lyrics-issues">
                <p className="font-bold">⚠️ Needs Review ({lyricsIssues.length})</p>
                {lyricsIssues.slice(0, 5).map((i, k) => <p key={k}>• {i}</p>)}
              </div>
            )}
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
      {/* Edit Song Dialog */}
      <Dialog open={editSongOpen} onOpenChange={setEditSongOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Edit2 className="w-4 h-4" /> Edit Lagu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Judul lagu *" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            <Input placeholder="Artis" value={editArtist} onChange={e => setEditArtist(e.target.value)} />
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tanggal rilis (opsional)</label>
              <Input type="date" value={editReleaseDate} onChange={e => setEditReleaseDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ganti Thumbnail (opsional)</label>
              <input ref={editCoverRef} type="file" accept="image/*" onChange={e => setEditCoverFile(e.target.files?.[0] || null)}
                className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer" />
            </div>
            {editingSong?.cover_url && !editCoverFile && (
              <div className="flex items-center gap-2">
                <img src={editingSong.cover_url} className="w-10 h-10 rounded object-cover" alt="" />
                <span className="text-xs text-muted-foreground">Cover saat ini</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditSongOpen(false)}>Batal</Button>
            <Button onClick={saveEditSong} disabled={savingSong} className="gap-2">
              {savingSong ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Tab */}
      {activeTab === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Review Lagu Publik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingReview ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin w-6 h-6" /></div>
            ) : pendingSongs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Tidak ada lagu yang perlu direview</p>
            ) : (
              pendingSongs.map(song => {
                let aiResult: any = null;
                try { aiResult = JSON.parse(song.ai_check_result || "null"); } catch {}
                return (
                  <Card key={song.id} className="overflow-hidden">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        {song.cover_url ? (
                          <img src={song.cover_url} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{song.title}</div>
                          <div className="text-xs text-muted-foreground">{song.artist}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {song.status === "pending" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-yellow-600"><Clock className="w-3 h-3" /> Menunggu</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3" /> Ditolak</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {aiResult && (
                        <div className={`text-xs p-2 rounded ${aiResult.recommendation === "reject" ? "bg-destructive/10 text-destructive" : aiResult.recommendation === "review" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300" : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"}`}>
                          <strong>AI:</strong> {aiResult.reason} (Kepercayaan: {aiResult.confidence})
                        </div>
                      )}
                      {song.description && <p className="text-xs text-muted-foreground">{song.description}</p>}
                      <Input placeholder="Catatan admin (opsional)..." value={reviewNote} onChange={e => setReviewNote(e.target.value)} className="text-xs" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" className="flex-1 gap-1" onClick={() => handleReviewAction(song.id, "approved")}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => handleReviewAction(song.id, "rejected")}>
                          <XCircle className="w-3.5 h-3.5" /> Tolak
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Artist Tab */}
      {activeTab === "artists" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> {editingArtist ? "Edit Artis" : "Tambah Artis"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Nama artis *" value={artistName} onChange={e => setArtistName(e.target.value)} />
            <Input placeholder="Genre (Pop, Rock, dll)" value={artistGenre} onChange={e => setArtistGenre(e.target.value)} />
            <Textarea placeholder="Bio artis..." value={artistBio} onChange={e => setArtistBio(e.target.value)} rows={2} />
            <div>
              <input ref={artistPhotoRef} type="file" accept="image/*" className="hidden" onChange={e => setArtistPhotoFile(e.target.files?.[0] || null)} />
              <Button variant="outline" size="sm" onClick={() => artistPhotoRef.current?.click()} className="w-full gap-1">
                <ImageIcon className="w-3.5 h-3.5" /> {artistPhotoFile ? artistPhotoFile.name : "Foto artis (opsional)"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveArtist} disabled={savingArtist} className="flex-1">
                {savingArtist ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {editingArtist ? "Perbarui" : "Tambah"}
              </Button>
              {editingArtist && <Button variant="outline" onClick={() => { setEditingArtist(null); setArtistName(""); setArtistBio(""); setArtistGenre(""); setArtistPhotoFile(null); }}>Batal</Button>}
            </div>

            <div className="border-t pt-3 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Daftar Artis ({artistList.length})</h4>
              {artistList.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded hover:bg-accent/50">
                  {a.photo_url ? (
                    <img src={a.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{a.name}</div>
                    {a.genre && <div className="text-xs text-muted-foreground">{a.genre}</div>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingArtist(a); setArtistName(a.name); setArtistBio(a.bio || ""); setArtistGenre(a.genre || ""); }}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteArtist(a.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default AdminMusicTab;

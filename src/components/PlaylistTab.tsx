import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Music, Play, Pause, SkipBack, SkipForward, Download, Volume2, VolumeX,
  Repeat, Shuffle, Loader2, HardDrive, Globe, CheckCircle2, Trash2,
  WifiOff, Wifi, Crown, Zap, Clock, ListMusic, Plus, Edit2, Check, Lock,
  FileText, Copyright, Type, ChevronDown, Share2, Timer, Sparkles, List
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

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
  visitor_id: string | null;
  created_at: string;
}

interface PlaylistItemRow {
  id: string;
  playlist_id: string;
  song_id: string;
  item_order: number;
}

interface LyricLine {
  id: string;
  song_id: string;
  time_seconds: number;
  text: string;
  line_order: number;
}

// --- Storage plan system ---
interface StoragePlan {
  name: string;
  addBytes: number;
  pricePerMonth: number;
}

interface ActiveSubscription {
  name: string;
  addBytes: number;
  price: number;
  purchasedAt: string;
  expiresAt: string;
}

const FREE_BYTES = 2 * 1024 * 1024 * 1024;

const PURCHASABLE_PLANS: StoragePlan[] = [
  { name: "Pro 10GB", addBytes: 10 * 1024 * 1024 * 1024, pricePerMonth: 10000 },
  { name: "Pro 100GB", addBytes: 100 * 1024 * 1024 * 1024, pricePerMonth: 100000 },
];

const CACHE_NAME = "playlist-offline-v1";
const META_CACHE_KEY = "/offline-music-meta";
const SUBS_STORAGE_KEY = "playlist-storage-subs";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStorageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatSongDate(dateString: string) {
  if (!dateString) return "";
  if (dateString.includes("T")) {
    return new Date(dateString).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  }

  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// --- Subscription helpers ---
function getActiveSubscriptions(): ActiveSubscription[] {
  try {
    const raw = localStorage.getItem(SUBS_STORAGE_KEY);
    if (!raw) return [];
    const subs: ActiveSubscription[] = JSON.parse(raw);
    const now = new Date().toISOString();
    const active = subs.filter(s => s.expiresAt > now);
    if (active.length !== subs.length) localStorage.setItem(SUBS_STORAGE_KEY, JSON.stringify(active));
    return active;
  } catch { return []; }
}

function saveSub(plan: StoragePlan): ActiveSubscription {
  const subs = getActiveSubscriptions();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const newSub: ActiveSubscription = { name: plan.name, addBytes: plan.addBytes, price: plan.pricePerMonth, purchasedAt: now.toISOString(), expiresAt: expires.toISOString() };
  subs.push(newSub);
  localStorage.setItem(SUBS_STORAGE_KEY, JSON.stringify(subs));
  return newSub;
}

function getTotalMaxBytes(): number {
  return FREE_BYTES + getActiveSubscriptions().reduce((sum, s) => sum + s.addBytes, 0);
}

// --- Cache helpers ---
async function getCachedSongIds(): Promise<Set<string>> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const ids = new Set<string>();
    keys.forEach(req => { const id = new URL(req.url).searchParams.get("songId"); if (id) ids.add(id); });
    return ids;
  } catch { return new Set(); }
}

async function cacheSong(song: Song): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await fetch(song.file_url);
    if (!resp.ok) throw new Error("fetch failed");
    const blob = await resp.blob();
    const cacheResp = new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg", "X-Song-Title": encodeURIComponent(song.title), "X-Song-Artist": encodeURIComponent(song.artist), "X-Song-Size": String(song.file_size || blob.size) } });
    await cache.put(`/offline-music?songId=${song.id}`, cacheResp);
    await saveSongMeta(song);
    return true;
  } catch { return false; }
}

async function removeCachedSong(songId: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(`/offline-music?songId=${songId}`);
    const metas = await loadSongMetas();
    await saveAllSongMetas(metas.filter(m => m.id !== songId));
  } catch {}
}

async function getCachedBlob(songId: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await cache.match(`/offline-music?songId=${songId}`);
    return resp ? await resp.blob() : null;
  } catch { return null; }
}

async function getCachedStorageUsed(songs: Song[], cachedIds: Set<string>): Promise<number> {
  return songs.filter(s => cachedIds.has(s.id)).reduce((sum, s) => sum + (s.file_size || 0), 0);
}

async function saveSongMeta(song: Song): Promise<void> {
  try { const existing = await loadSongMetas(); await saveAllSongMetas([...existing.filter(m => m.id !== song.id), song]); } catch {}
}

async function saveAllSongMetas(songs: Song[]): Promise<void> {
  try { const cache = await caches.open(CACHE_NAME); await cache.put(META_CACHE_KEY, new Response(JSON.stringify(songs), { headers: { "Content-Type": "application/json" } })); } catch {}
}

async function loadSongMetas(): Promise<Song[]> {
  try { const cache = await caches.open(CACHE_NAME); const resp = await cache.match(META_CACHE_KEY); return resp ? await resp.json() : []; } catch { return []; }
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export interface PlaybackState {
  song: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

interface PlaylistTabProps {
  onPlaybackChange?: (state: PlaybackState) => void;
  onTogglePlay?: React.MutableRefObject<(() => void) | null>;
}

// ===== COMPONENT =====
const PlaylistTab = ({ onPlaybackChange, onTogglePlay }: PlaylistTabProps) => {
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
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [downloadedStorage, setDownloadedStorage] = useState(0);
  const [maxBytes, setMaxBytes] = useState(getTotalMaxBytes());
  const [activeSubs, setActiveSubs] = useState<ActiveSubscription[]>(getActiveSubscriptions());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  // Playlists state
  const [adminPlaylists, setAdminPlaylists] = useState<Playlist[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItemRow[]>([]);
  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);

  // User playlist create/edit
  const [userPlDialogOpen, setUserPlDialogOpen] = useState(false);
  const [editingUserPl, setEditingUserPl] = useState<Playlist | null>(null);
  const [userPlName, setUserPlName] = useState("");
  const [savingUserPl, setSavingUserPl] = useState(false);

  // User playlist manage songs
  const [manageUserSongsOpen, setManageUserSongsOpen] = useState(false);
  const [managingUserPl, setManagingUserPl] = useState<Playlist | null>(null);
  const [selectedUserSongIds, setSelectedUserSongIds] = useState<Set<string>>(new Set());
  const [savingUserSongs, setSavingUserSongs] = useState(false);

  const [activeView, setActiveView] = useState<"playlist" | "myplaylists" | "storage">("playlist");

  // Lyrics state
  const [allLyrics, setAllLyrics] = useState<LyricLine[]>([]);
  const [termsOpen, setTermsOpen] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const fullPlayerLyricsRef = useRef<HTMLDivElement>(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);

  // Current playing song list (filtered by playlist or all)
  const displaySongs = viewingPlaylist
    ? songs.filter(s => playlistItems.some(pi => pi.playlist_id === viewingPlaylist.id && pi.song_id === s.id))
    : songs;

  useEffect(() => {
    const interval = setInterval(() => { setActiveSubs(getActiveSubscriptions()); setMaxBytes(getTotalMaxBytes()); }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchSongs(); }, []);

  async function getVisitorIdSafe() {
    const { getVisitorId } = await import("@/lib/visitor-id");
    return getVisitorId();
  }

  async function fetchSongs() {
    setLoading(true);
    const visitorId = await getVisitorIdSafe();

    if (navigator.onLine) {
      const [songsRes, adminPlRes, userPlRes, piRes, lyricsRes] = await Promise.all([
        supabase.from("playlist_songs").select("*").order("created_at", { ascending: false }),
        supabase.from("playlists").select("*").eq("playlist_type", "admin").order("created_at", { ascending: false }),
        supabase.from("playlists").select("*").eq("playlist_type", "user").eq("visitor_id", visitorId).order("created_at", { ascending: false }),
        supabase.from("playlist_items").select("*"),
        supabase.from("song_lyrics").select("*").order("time_seconds", { ascending: true }),
      ]);
      const songList = (songsRes.data as Song[]) || [];
      setSongs(songList);
      setAdminPlaylists((adminPlRes.data as Playlist[]) || []);
      setUserPlaylists((userPlRes.data as Playlist[]) || []);
      setPlaylistItems((piRes.data as PlaylistItemRow[]) || []);
      setAllLyrics((lyricsRes.data as LyricLine[]) || []);
      const ids = await getCachedSongIds();
      setCachedIds(ids);
      setDownloadedStorage(await getCachedStorageUsed(songList, ids));
    } else {
      const cachedMetas = await loadSongMetas();
      const ids = await getCachedSongIds();
      const offlineSongs = cachedMetas.filter(s => ids.has(s.id));
      setSongs(offlineSongs);
      setCachedIds(ids);
      setDownloadedStorage(offlineSongs.reduce((sum, s) => sum + (s.file_size || 0), 0));
    }
    setLoading(false);
  }

  async function refreshCacheInfo(songList?: Song[]) {
    const list = songList || songs;
    const ids = await getCachedSongIds();
    setCachedIds(ids);
    setDownloadedStorage(await getCachedStorageUsed(list, ids));
    setMaxBytes(getTotalMaxBytes());
    setActiveSubs(getActiveSubscriptions());
  }

  const currentSong = currentIndex >= 0 ? displaySongs[currentIndex] : null;

  // Report playback state to parent
  useEffect(() => {
    onPlaybackChange?.({ song: currentSong || null, isPlaying, currentTime, duration });
  }, [currentSong, isPlaying, currentTime, duration]);

  // Expose togglePlay to parent
  useEffect(() => {
    if (onTogglePlay) onTogglePlay.current = togglePlay;
  });

  // Lyrics for current song
  const currentSongLyrics = useMemo(() => {
    if (!currentSong) return [];
    return allLyrics.filter(l => l.song_id === currentSong.id).sort((a, b) => a.time_seconds - b.time_seconds);
  }, [currentSong, allLyrics]);

  const activeLyricIndex = useMemo(() => {
    if (!currentSongLyrics.length) return -1;
    let idx = -1;
    for (let i = 0; i < currentSongLyrics.length; i++) {
      if (currentSongLyrics[i].time_seconds <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [currentSongLyrics, currentTime]);

  // Auto-scroll lyrics
  useEffect(() => {
    if (activeLyricIndex < 0 || !lyricsContainerRef.current) return;
    const el = lyricsContainerRef.current.querySelector(`[data-lyric-index="${activeLyricIndex}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLyricIndex]);

  const playSong = useCallback(async (index: number) => {
    if (audioRef.current) audioRef.current.pause();
    const songList = viewingPlaylist
      ? songs.filter(s => playlistItems.some(pi => pi.playlist_id === viewingPlaylist.id && pi.song_id === s.id))
      : songs;
    const song = songList[index];
    if (!song) return;
    let audioUrl = song.file_url;
    const cachedBlob = await getCachedBlob(song.id);
    if (cachedBlob) { audioUrl = URL.createObjectURL(cachedBlob); }
    else if (!navigator.onLine) { toast({ title: "Tidak tersedia offline", variant: "destructive" }); return; }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.volume = muted ? 0 : volume;
    audio.play().catch(() => {});
    setCurrentIndex(index);
    setIsPlaying(true);
    setCurrentTime(0);
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("ended", () => {
      if (cachedBlob) URL.revokeObjectURL(audioUrl);
      if (repeat) { audio.currentTime = 0; audio.play(); } else { playNextFrom(index, songList); }
    });
  }, [songs, playlistItems, viewingPlaylist, volume, muted, repeat, shuffle]);

  function playNextFrom(fromIndex: number, songList: Song[]) {
    if (songList.length === 0) return;
    if (shuffle) playSong(Math.floor(Math.random() * songList.length));
    else if (fromIndex < songList.length - 1) playSong(fromIndex + 1);
    else playSong(0);
  }

  function playNext() { playNextFrom(currentIndex, displaySongs); }
  function playPrev() {
    if (displaySongs.length === 0) return;
    playSong(currentIndex > 0 ? currentIndex - 1 : displaySongs.length - 1);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setIsPlaying(true); }
  }

  function seek(val: number[]) { if (audioRef.current) { audioRef.current.currentTime = val[0]; setCurrentTime(val[0]); } }
  function changeVolume(val: number[]) { setVolume(val[0]); setMuted(false); if (audioRef.current) audioRef.current.volume = val[0]; }
  function toggleMute() { setMuted(!muted); if (audioRef.current) audioRef.current.volume = muted ? volume : 0; }

  async function downloadToDevice(song: Song) {
    if (!isOnline && !cachedIds.has(song.id)) { toast({ title: "Tidak bisa download", variant: "destructive" }); return; }
    setDownloading(song.id);
    try {
      let blob: Blob | null = await getCachedBlob(song.id);
      if (!blob) { const response = await fetch(song.file_url); blob = await response.blob(); }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${song.artist} - ${song.title}.mp3`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: "Download dimulai 📥" });
    } catch { toast({ title: "Gagal download", variant: "destructive" }); }
    setDownloading(null);
  }

  async function downloadToCache(song: Song) {
    if (!isOnline) { toast({ title: "Tidak bisa simpan offline", variant: "destructive" }); return; }
    if (cachedIds.has(song.id)) { toast({ title: "Sudah tersimpan offline ✅" }); return; }
    const currentMax = getTotalMaxBytes();
    if (downloadedStorage + (song.file_size || 0) > currentMax) { toast({ title: "Penyimpanan penuh!", variant: "destructive" }); return; }
    setDownloading(song.id);
    try {
      const ok = await cacheSong(song);
      if (!ok) throw new Error("cache failed");
      toast({ title: "Tersimpan offline ✅" });
      await refreshCacheInfo();
    } catch { toast({ title: "Gagal menyimpan offline", variant: "destructive" }); }
    setDownloading(null);
  }

  async function removeFromCache(song: Song) {
    await removeCachedSong(song.id);
    toast({ title: "Dihapus dari offline" });
    await refreshCacheInfo();
  }

  async function handleUpgrade() {
    const plan = PURCHASABLE_PLANS[selectedPlanIndex];
    if (!plan) return;
    setUpgrading(true);
    try {
      const visitorId = await getVisitorIdSafe();
      const { data, error } = await supabase.functions.invoke("upgrade-storage", { body: { visitor_id: visitorId, tier_name: plan.name, price: plan.pricePerMonth } });
      if (error) throw error;
      if (data?.error) { toast({ title: "Gagal upgrade", description: data.error, variant: "destructive" }); setUpgrading(false); return; }
      const newSub = saveSub(plan);
      setActiveSubs(getActiveSubscriptions()); setMaxBytes(getTotalMaxBytes()); setUpgradeOpen(false);
      toast({ title: "Upgrade berhasil! 🎉", description: `+${formatStorageSize(plan.addBytes)} aktif sampai ${formatDate(newSub.expiresAt)}` });
    } catch (err: any) { toast({ title: "Gagal upgrade", description: err?.message, variant: "destructive" }); }
    setUpgrading(false);
  }

  // --- User Playlist CRUD ---
  async function createUserPlaylist() {
    if (!userPlName.trim()) { toast({ title: "Isi nama playlist", variant: "destructive" }); return; }
    setSavingUserPl(true);
    try {
      const visitorId = await getVisitorIdSafe();
      if (editingUserPl) {
        await supabase.from("playlists").update({ name: userPlName.trim() }).eq("id", editingUserPl.id);
        toast({ title: "Playlist diperbarui" });
      } else {
        await supabase.from("playlists").insert({ name: userPlName.trim(), playlist_type: "user", visitor_id: visitorId });
        toast({ title: "Playlist dibuat!" });
      }
      setUserPlDialogOpen(false);
      fetchSongs();
    } catch (err: any) { toast({ title: "Gagal", description: err.message, variant: "destructive" }); }
    setSavingUserPl(false);
  }

  async function deleteUserPlaylist(pl: Playlist) {
    if (!confirm(`Hapus playlist "${pl.name}"?`)) return;
    await supabase.from("playlists").delete().eq("id", pl.id);
    toast({ title: "Playlist dihapus" });
    if (viewingPlaylist?.id === pl.id) setViewingPlaylist(null);
    fetchSongs();
  }

  function openManageUserSongs(pl: Playlist) {
    setManagingUserPl(pl);
    const existingIds = playlistItems.filter(pi => pi.playlist_id === pl.id).map(pi => pi.song_id);
    setSelectedUserSongIds(new Set(existingIds));
    setManageUserSongsOpen(true);
  }

  async function saveUserSongsInPlaylist() {
    if (!managingUserPl) return;
    setSavingUserSongs(true);
    try {
      await supabase.from("playlist_items").delete().eq("playlist_id", managingUserPl.id);
      const items = Array.from(selectedUserSongIds).map((songId, i) => ({ playlist_id: managingUserPl.id, song_id: songId, item_order: i }));
      if (items.length > 0) { const { error } = await supabase.from("playlist_items").insert(items); if (error) throw error; }
      toast({ title: `${items.length} lagu disimpan` });
      setManageUserSongsOpen(false);
      fetchSongs();
    } catch (err: any) { toast({ title: "Gagal simpan", description: err.message, variant: "destructive" }); }
    setSavingUserSongs(false);
  }

  function getSongCountForPlaylist(plId: string) {
    return playlistItems.filter(pi => pi.playlist_id === plId).length;
  }

  useEffect(() => { return () => { if (audioRef.current) audioRef.current.pause(); }; }, []);

  const storagePercent = Math.min((downloadedStorage / maxBytes) * 100, 100);
  const isNearLimit = storagePercent > 80;
  const isAtLimit = storagePercent > 95;
  const cachedCount = cachedIds.size;
  const hasSubs = activeSubs.length > 0;
  const currentSongDateLabel = currentSong?.release_date
    ? `Dirilis ${formatSongDate(currentSong.release_date)}`
    : currentSong?.created_at
      ? `Diunggah ${formatDate(currentSong.created_at)}`
      : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p className="text-sm">Memuat playlist...</p>
      </div>
    );
  }

  if (songs.length === 0 && isOnline) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Music className="w-16 h-16 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-medium">Belum ada lagu di playlist.</p>
      </div>
    );
  }

  if (songs.length === 0 && !isOnline) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <WifiOff className="w-16 h-16 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-medium">Kamu sedang offline</p>
        <p className="text-xs mt-1">Belum ada lagu yang disimpan offline.</p>
      </div>
    );
  }

  const renderSongList = (songList: Song[]) => (
    <div className="space-y-2">
      {songList.map((song, i) => {
        const isCached = cachedIds.has(song.id);
        return (
          <Card key={song.id} className={`overflow-hidden transition-all cursor-pointer hover:shadow-md ${currentIndex === i && currentSong?.id === song.id ? "border-primary/40 bg-primary/5" : ""}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <button onClick={() => playSong(i)} className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors relative overflow-hidden">
                {song.cover_url ? <img src={song.cover_url} alt="" className="w-full h-full object-cover absolute inset-0" /> : currentIndex === i && isPlaying ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
                {song.cover_url && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    {currentIndex === i && isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                  </div>
                )}
                {isCached && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center z-10"><CheckCircle2 className="w-2.5 h-2.5 text-accent-foreground" /></span>}
              </button>
              <div className="flex-1 min-w-0" onClick={() => playSong(i)}>
                <p className="font-bold text-sm truncate">{song.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{song.artist}{song.file_size > 0 ? ` • ${formatSize(song.file_size)}` : ""}{isCached && <span className="text-accent font-semibold"> • Offline</span>}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {song.release_date ? `Dirilis ${formatSongDate(song.release_date)}` : `Diunggah ${formatDate(song.created_at)}`}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="shrink-0 h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} disabled={downloading === song.id}>
                    {downloading === song.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <DropdownMenuItem onClick={() => downloadToDevice(song)} className="gap-2 cursor-pointer" disabled={!isOnline && !isCached}>
                    <HardDrive className="w-4 h-4" /> Simpan ke HP
                  </DropdownMenuItem>
                  {!isCached ? (
                    <DropdownMenuItem onClick={() => downloadToCache(song)} className="gap-2 cursor-pointer" disabled={!isOnline}>
                      <Download className="w-4 h-4" /> Simpan Offline
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => removeFromCache(song)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4" /> Hapus dari Offline
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => window.open(song.file_url, "_blank")} className="gap-2 cursor-pointer" disabled={!isOnline}>
                    <Globe className="w-4 h-4" /> Buka di Browser
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" /> Playlist Musik
        </h2>
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isOnline ? "bg-accent/20 text-accent" : "bg-destructive/20 text-destructive"}`}>
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isOnline ? "Online" : "Offline"}
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-1.5">
        <Button variant={activeView === "playlist" ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-[11px] px-2" onClick={() => { setActiveView("playlist"); setViewingPlaylist(null); }}>
          <Music className="w-3.5 h-3.5" /> Semua ({songs.length})
        </Button>
        <Button variant={activeView === "myplaylists" ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-[11px] px-2" onClick={() => { setActiveView("myplaylists"); setViewingPlaylist(null); }}>
          <ListMusic className="w-3.5 h-3.5" /> Playlist
        </Button>
        <Button variant={activeView === "storage" ? "default" : "outline"} size="sm" className="flex-1 gap-1.5 text-[11px] px-2" onClick={() => setActiveView("storage")}>
          <HardDrive className="w-3.5 h-3.5" /> Storage
          {cachedCount > 0 && <span className="bg-accent/20 text-accent text-[10px] font-bold px-1 rounded-full">{cachedCount}</span>}
        </Button>
      </div>

      {!isOnline && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2 text-xs text-destructive">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Mode offline — hanya lagu tersimpan offline yang bisa diputar.</span>
          </CardContent>
        </Card>
      )}

      {/* Now Playing */}
      {currentSong && (
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                {currentSong.cover_url ? <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-6 h-6 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.artist}{cachedIds.has(currentSong.id) && <span className="ml-1 text-accent">• Offline</span>}</p>
                {currentSongDateLabel && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" /> {currentSongDateLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={seek} className="cursor-pointer" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setShuffle(!shuffle)} className={`p-2 rounded-full transition-colors ${shuffle ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}><Shuffle className="w-4 h-4" /></button>
              <button onClick={playPrev} className="p-2 rounded-full text-foreground hover:bg-muted transition-colors"><SkipBack className="w-5 h-5" /></button>
              <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button onClick={playNext} className="p-2 rounded-full text-foreground hover:bg-muted transition-colors"><SkipForward className="w-5 h-5" /></button>
              <button onClick={() => setRepeat(!repeat)} className={`p-2 rounded-full transition-colors ${repeat ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}><Repeat className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
              <Slider value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={changeVolume} className="flex-1 cursor-pointer" />
            </div>
            <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-semibold text-primary">
              <Type className="w-3.5 h-3.5" />
              {currentSongLyrics.length > 0 ? "Lirik sinkron aktif saat lagu diputar" : "Lirik untuk lagu ini belum tersedia"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lyrics Display */}
      {currentSong && (
        <Card className="border-primary/20 overflow-hidden">
          <CardContent className="p-4 space-y-1">
            <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 mb-2"><Type className="w-3.5 h-3.5" /> Lirik — {currentSong.title}</p>
            {currentSongLyrics.length > 0 ? (
              <>
                <div ref={lyricsContainerRef} className="max-h-48 overflow-y-auto space-y-0.5 scroll-smooth">
                  {/* Intro indicator */}
                  {isPlaying && currentSongLyrics.length > 0 && currentTime < currentSongLyrics[0].time_seconds && (
                    <p className="text-xs py-0.5 px-2 rounded text-primary font-bold bg-primary/10 text-center animate-pulse">
                      ♪♪♪
                    </p>
                  )}
                  {currentSongLyrics.map((line, i) => {
                    const isActive = activeLyricIndex === i;
                    const isInstrumental = !line.text || line.text.trim() === "" || /^[♪♫🎵🎶\s]+$/.test(line.text.trim());
                    return (
                      <p
                        key={line.id}
                        data-lyric-index={i}
                        className={`text-xs py-0.5 px-2 rounded transition-all duration-300 ${
                          isActive
                            ? isInstrumental
                              ? "text-primary font-bold bg-primary/10 scale-[1.02] text-center animate-pulse"
                              : "text-primary font-bold bg-primary/10 scale-[1.02]"
                            : "text-muted-foreground"
                        } ${isInstrumental ? "text-center italic" : ""}`}
                      >
                        {isInstrumental ? "♪♪♪" : line.text}
                      </p>
                    );
                  })}
                  {/* Outro indicator */}
                  {isPlaying && activeLyricIndex === currentSongLyrics.length - 1 && currentTime > currentSongLyrics[currentSongLyrics.length - 1].time_seconds + 5 && (
                    <p className="text-xs py-0.5 px-2 rounded text-primary/60 text-center animate-pulse italic">
                      ♪♪♪
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground text-center pt-2 flex items-center justify-center gap-1">
                  <Copyright className="w-3 h-3" /> {currentSong.artist} — Hak cipta dilindungi
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                Lirik belum ditambahkan untuk lagu ini.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== ALL SONGS VIEW ===== */}
      {activeView === "playlist" && !viewingPlaylist && renderSongList(songs)}

      {/* ===== VIEWING A PLAYLIST ===== */}
      {viewingPlaylist && activeView !== "storage" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => { setViewingPlaylist(null); setActiveView("myplaylists"); }}>
              ← Kembali
            </Button>
            <span className="text-sm font-bold truncate">{viewingPlaylist.name}</span>
          </div>
          {displaySongs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada lagu di playlist ini.</p>
          ) : renderSongList(displaySongs)}
        </div>
      )}

      {/* ===== PLAYLISTS VIEW ===== */}
      {activeView === "myplaylists" && !viewingPlaylist && (
        <div className="space-y-4">
          {/* Admin Playlists */}
          {adminPlaylists.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><ListMusic className="w-3.5 h-3.5" /> Playlist Publik</p>
              {adminPlaylists.map(pl => (
                <Card key={pl.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setViewingPlaylist(pl); }}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {pl.cover_url ? <img src={pl.cover_url} className="w-full h-full object-cover" alt="" /> : <ListMusic className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{pl.name}</p>
                      <p className="text-[11px] text-muted-foreground">{getSongCountForPlaylist(pl.id)} lagu</p>
                    </div>
                    <Play className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* User Private Playlists */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Playlist Pribadi</p>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" onClick={() => { setEditingUserPl(null); setUserPlName(""); setUserPlDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5" /> Buat
              </Button>
            </div>
            {userPlaylists.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-4">Belum ada playlist pribadi. Buat satu!</p>
            ) : (
              userPlaylists.map(pl => (
                <Card key={pl.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setViewingPlaylist(pl); }}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{pl.name}</p>
                      <p className="text-[11px] text-muted-foreground">{getSongCountForPlaylist(pl.id)} lagu • Pribadi</p>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openManageUserSongs(pl)} title="Kelola lagu">
                        <Music className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingUserPl(pl); setUserPlName(pl.name); setUserPlDialogOpen(true); }} title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteUserPlaylist(pl)} title="Hapus">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===== STORAGE VIEW ===== */}
      {activeView === "storage" && (
        <div className="space-y-4">
          <Card className={`border-primary/20 ${isAtLimit ? "border-destructive/50" : isNearLimit ? "border-yellow-500/50" : ""}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-primary" /><span className="text-xs font-bold">Penyimpanan Offline</span></div>
                <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${hasSubs ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {hasSubs ? <Crown className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                  {hasSubs ? formatStorageSize(maxBytes) : "Free 2GB"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-background/70 p-2.5 border border-border/60 text-center"><p className="text-[10px] text-muted-foreground">Total</p><p className="text-sm font-extrabold">{songs.length}</p></div>
                <div className="rounded-xl bg-background/70 p-2.5 border border-border/60 text-center"><p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5"><CheckCircle2 className="w-3 h-3 text-accent" /> Offline</p><p className="text-sm font-extrabold text-accent">{cachedCount}</p></div>
                <div className="rounded-xl bg-background/70 p-2.5 border border-border/60 text-center"><p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5"><HardDrive className="w-3 h-3" /> Terpakai</p><p className={`text-sm font-extrabold ${isAtLimit ? "text-destructive" : isNearLimit ? "text-yellow-600" : ""}`}>{formatStorageSize(downloadedStorage)}</p></div>
              </div>
              <div className="space-y-1">
                <Progress value={storagePercent} className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""}`} />
                <div className="flex justify-between text-[10px] text-muted-foreground"><span>{formatStorageSize(downloadedStorage)}</span><span>{formatStorageSize(maxBytes)}</span></div>
              </div>
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-primary/30 hover:bg-primary/10" onClick={() => setUpgradeOpen(true)}>
                <Zap className="w-3.5 h-3.5 text-primary" />
                {hasSubs ? "Tambah / Upgrade Penyimpanan" : "Upgrade Penyimpanan"}
              </Button>
            </CardContent>
          </Card>

          {activeSubs.length > 0 && (
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5"><Crown className="w-4 h-4 text-primary" /> Paket Aktif</p>
                {activeSubs.map((sub, i) => {
                  const daysLeft = Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] rounded-lg bg-primary/5 px-3 py-2 border border-primary/10">
                      <div><span className="font-bold">{sub.name}</span><span className="text-muted-foreground ml-1">• beli {formatDate(sub.purchasedAt)}</span></div>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" /><span className={`font-semibold ${daysLeft <= 3 ? "text-destructive" : "text-muted-foreground"}`}>{daysLeft}h lagi</span></div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {cachedCount > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-accent" /> Lagu Tersimpan Offline ({cachedCount})</p>
                {songs.filter(s => cachedIds.has(s.id)).map(song => (
                  <div key={song.id} className="flex items-center justify-between text-[11px] rounded-lg bg-accent/5 px-3 py-2 border border-accent/10">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {song.cover_url ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <div className="min-w-0"><p className="font-bold truncate">{song.title}</p><p className="text-muted-foreground truncate">{song.artist} • {formatSize(song.file_size)}</p></div>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeFromCache(song)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Upgrade Dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-primary" /> Tambah Penyimpanan</DialogTitle>
            <DialogDescription>Beli paket penyimpanan offline. Setiap paket berlaku 30 hari.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-bold">Kuota Saat Ini</p><p className="text-xs text-muted-foreground">Free 2GB{activeSubs.length > 0 ? ` + ${activeSubs.map(s => s.name).join(" + ")}` : ""}</p></div>
                <span className="text-sm font-extrabold text-primary">{formatStorageSize(maxBytes)}</span>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground">Pilih Paket:</p>
            {PURCHASABLE_PLANS.map((plan, idx) => (
              <div key={plan.name} onClick={() => setSelectedPlanIndex(idx)} className={`rounded-xl border-2 p-3 cursor-pointer transition-all ${selectedPlanIndex === idx ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-bold flex items-center gap-1"><Crown className="w-4 h-4 text-primary" /> {plan.name}</p><p className="text-xs text-muted-foreground">+{formatStorageSize(plan.addBytes)} selama 30 hari</p></div>
                  <span className="text-sm font-extrabold text-primary">{formatCurrency(plan.pricePerMonth)}/bln</span>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">💡 Saldo dipotong {formatCurrency(PURCHASABLE_PLANS[selectedPlanIndex]?.pricePerMonth || 0)}. Paket berlaku 30 hari.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Batal</Button>
            <Button onClick={handleUpgrade} disabled={upgrading || !isOnline} className="gap-2">
              {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {upgrading ? "Memproses..." : "Beli Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Playlist Create/Edit Dialog */}
      <Dialog open={userPlDialogOpen} onOpenChange={setUserPlDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingUserPl ? "Edit Playlist" : "Buat Playlist Pribadi"}</DialogTitle>
          </DialogHeader>
          <Input placeholder="Nama playlist *" value={userPlName} onChange={e => setUserPlName(e.target.value)} />
          <DialogFooter>
            <Button onClick={createUserPlaylist} disabled={savingUserPl} className="w-full gap-2">
              {savingUserPl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingUserPl ? "Simpan" : "Buat Playlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Playlist Manage Songs Dialog */}
      <Dialog open={manageUserSongsOpen} onOpenChange={setManageUserSongsOpen}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Kelola Lagu — {managingUserPl?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {songs.map(song => (
              <label key={song.id} className="flex items-center gap-3 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
                <Checkbox checked={selectedUserSongIds.has(song.id)} onCheckedChange={() => {
                  setSelectedUserSongIds(prev => { const n = new Set(prev); if (n.has(song.id)) n.delete(song.id); else n.add(song.id); return n; });
                }} />
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {song.cover_url ? <img src={song.cover_url} className="w-full h-full object-cover" alt="" /> : <Music className="w-3.5 h-3.5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate">{song.title}</p><p className="text-[10px] text-muted-foreground">{song.artist}</p></div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={saveUserSongsInPlaylist} disabled={savingUserSongs} className="w-full gap-2">
              {savingUserSongs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Simpan ({selectedUserSongIds.size} lagu)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copyright & Terms Footer */}
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <Copyright className="w-3 h-3" />
            <span>Semua musik dilindungi hak cipta masing-masing artis.</span>
          </div>
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1" onClick={() => setTermsOpen(true)}>
              <FileText className="w-3 h-3" /> Syarat & Ketentuan Playlist
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Terms & Privacy Dialog */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><FileText className="w-5 h-5 text-primary" /> Syarat & Ketentuan Playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs text-muted-foreground">
            <div>
              <p className="font-bold text-foreground text-sm mb-1">📋 Syarat & Ketentuan</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Layanan playlist musik disediakan untuk penggunaan pribadi dan non-komersial.</li>
                <li>Pengguna dapat membuat playlist pribadi yang hanya dapat diakses oleh pengguna itu sendiri.</li>
                <li>Playlist publik dikelola oleh admin dan dapat dinikmati semua pengguna.</li>
                <li>Penyimpanan offline tunduk pada batas kuota yang berlaku (Free 2GB, atau sesuai paket aktif).</li>
                <li>Admin berhak menghapus, mengubah, atau menambahkan konten musik kapan saja.</li>
                <li>Dilarang mendistribusikan ulang, menjual, atau menggunakan musik untuk keperluan komersial.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🔒 Kebijakan Privasi</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Data playlist pribadi disimpan menggunakan <code className="bg-muted px-1 rounded">visitor_id</code> unik per perangkat.</li>
                <li>Kami tidak mengumpulkan informasi pribadi (nama, email, dll) untuk fitur playlist.</li>
                <li>Riwayat pemutaran dan preferensi musik hanya tersimpan di perangkat Anda.</li>
                <li>Data offline (lagu yang di-cache) disimpan di penyimpanan lokal browser Anda.</li>
                <li>Kami tidak membagikan data penggunaan playlist kepada pihak ketiga.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">©️ Hak Cipta Musik</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Semua lagu dan lirik yang tersedia dilindungi oleh hak cipta masing-masing artis dan pemegang hak.</li>
                <li>Penggunaan musik hanya untuk streaming dan pemutaran pribadi dalam aplikasi ini.</li>
                <li>Lirik ditampilkan untuk tujuan referensi dan hiburan saja.</li>
                <li>Jika Anda adalah pemegang hak cipta dan ingin konten dihapus, silakan hubungi admin.</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTermsOpen(false)} className="w-full">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlaylistTab;

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Music, Play, Pause, SkipBack, SkipForward, Download, Volume2, VolumeX,
  Repeat, Shuffle, Loader2, HardDrive, Globe, CheckCircle2, Trash2,
  WifiOff, Wifi, Crown, Zap, Clock, Image as ImageIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";

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

const FREE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

const PURCHASABLE_PLANS: StoragePlan[] = [
  { name: "Pro 10GB", addBytes: 10 * 1024 * 1024 * 1024, pricePerMonth: 10000 },
  { name: "Pro 100GB", addBytes: 100 * 1024 * 1024 * 1024, pricePerMonth: 100000 },
];

const CACHE_NAME = "playlist-offline-v1";
const META_CACHE_KEY = "/offline-music-meta";
const SUBS_STORAGE_KEY = "playlist-storage-subs";

// --- Formatting helpers (must be before usage) ---
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

// --- Subscription helpers ---
function getActiveSubscriptions(): ActiveSubscription[] {
  try {
    const raw = localStorage.getItem(SUBS_STORAGE_KEY);
    if (!raw) return [];
    const subs: ActiveSubscription[] = JSON.parse(raw);
    const now = new Date().toISOString();
    const active = subs.filter(s => s.expiresAt > now);
    // Auto-clean expired
    if (active.length !== subs.length) {
      localStorage.setItem(SUBS_STORAGE_KEY, JSON.stringify(active));
    }
    return active;
  } catch {
    return [];
  }
}

function saveSub(plan: StoragePlan): ActiveSubscription {
  const subs = getActiveSubscriptions();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const newSub: ActiveSubscription = {
    name: plan.name,
    addBytes: plan.addBytes,
    price: plan.pricePerMonth,
    purchasedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  subs.push(newSub);
  localStorage.setItem(SUBS_STORAGE_KEY, JSON.stringify(subs));
  return newSub;
}

function getTotalMaxBytes(): number {
  const subs = getActiveSubscriptions();
  return FREE_BYTES + subs.reduce((sum, s) => sum + s.addBytes, 0);
}

// --- Cache helpers ---
async function getCachedSongIds(): Promise<Set<string>> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const ids = new Set<string>();
    keys.forEach(req => {
      const url = new URL(req.url);
      const id = url.searchParams.get("songId");
      if (id) ids.add(id);
    });
    return ids;
  } catch {
    return new Set();
  }
}

async function cacheSong(song: Song): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await fetch(song.file_url);
    if (!resp.ok) throw new Error("fetch failed");
    const blob = await resp.blob();
    const cacheUrl = `/offline-music?songId=${song.id}`;
    const cacheResp = new Response(blob, {
      headers: {
        "Content-Type": blob.type || "audio/mpeg",
        "X-Song-Title": encodeURIComponent(song.title),
        "X-Song-Artist": encodeURIComponent(song.artist),
        "X-Song-Size": String(song.file_size || blob.size),
      },
    });
    await cache.put(cacheUrl, cacheResp);
    await saveSongMeta(song);
    return true;
  } catch {
    return false;
  }
}

async function removeCachedSong(songId: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(`/offline-music?songId=${songId}`);
    const metas = await loadSongMetas();
    const filtered = metas.filter(m => m.id !== songId);
    await saveAllSongMetas(filtered);
  } catch {}
}

async function getCachedBlob(songId: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await cache.match(`/offline-music?songId=${songId}`);
    if (!resp) return null;
    return await resp.blob();
  } catch {
    return null;
  }
}

async function getCachedStorageUsed(songs: Song[], cachedIds: Set<string>): Promise<number> {
  return songs.filter(s => cachedIds.has(s.id)).reduce((sum, s) => sum + (s.file_size || 0), 0);
}

async function saveSongMeta(song: Song): Promise<void> {
  try {
    const existing = await loadSongMetas();
    const filtered = existing.filter(m => m.id !== song.id);
    filtered.push(song);
    await saveAllSongMetas(filtered);
  } catch {}
}

async function saveAllSongMetas(songs: Song[]): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = new Response(JSON.stringify(songs), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put(META_CACHE_KEY, resp);
  } catch {}
}

async function loadSongMetas(): Promise<Song[]> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await cache.match(META_CACHE_KEY);
    if (!resp) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// ===== COMPONENT =====
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

  // Refresh subs periodically (check expiry)
  useEffect(() => {
    const interval = setInterval(() => {
      const subs = getActiveSubscriptions();
      setActiveSubs(subs);
      setMaxBytes(getTotalMaxBytes());
    }, 60000); // every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { fetchSongs(); }, []);

  async function fetchSongs() {
    setLoading(true);
    if (navigator.onLine) {
      const { data } = await supabase.from("playlist_songs").select("*").order("created_at", { ascending: false });
      const songList = (data as Song[]) || [];
      setSongs(songList);
      const ids = await getCachedSongIds();
      setCachedIds(ids);
      const used = await getCachedStorageUsed(songList, ids);
      setDownloadedStorage(used);
    } else {
      const cachedMetas = await loadSongMetas();
      const ids = await getCachedSongIds();
      const offlineSongs = cachedMetas.filter(s => ids.has(s.id));
      setSongs(offlineSongs);
      setCachedIds(ids);
      const used = offlineSongs.reduce((sum, s) => sum + (s.file_size || 0), 0);
      setDownloadedStorage(used);
    }
    setLoading(false);
  }

  async function refreshCacheInfo(songList?: Song[]) {
    const list = songList || songs;
    const ids = await getCachedSongIds();
    setCachedIds(ids);
    const used = await getCachedStorageUsed(list, ids);
    setDownloadedStorage(used);
    setMaxBytes(getTotalMaxBytes());
    setActiveSubs(getActiveSubscriptions());
  }

  const currentSong = currentIndex >= 0 ? songs[currentIndex] : null;

  const playSong = useCallback(async (index: number) => {
    if (audioRef.current) audioRef.current.pause();
    const song = songs[index];
    let audioUrl = song.file_url;
    const cachedBlob = await getCachedBlob(song.id);
    if (cachedBlob) {
      audioUrl = URL.createObjectURL(cachedBlob);
    } else if (!navigator.onLine) {
      toast({ title: "Tidak tersedia offline", description: "Lagu ini belum disimpan offline", variant: "destructive" });
      return;
    }
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
      if (repeat) { audio.currentTime = 0; audio.play(); } else { playNext(index); }
    });
  }, [songs, volume, muted, repeat, shuffle]);

  function playNext(fromIndex?: number) {
    const idx = fromIndex ?? currentIndex;
    if (songs.length === 0) return;
    if (shuffle) { playSong(Math.floor(Math.random() * songs.length)); }
    else if (idx < songs.length - 1) { playSong(idx + 1); }
    else { playSong(0); }
  }

  function playPrev() {
    if (songs.length === 0) return;
    if (currentIndex > 0) playSong(currentIndex - 1);
    else playSong(songs.length - 1);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play().catch(() => {}); setIsPlaying(true); }
  }

  function seek(val: number[]) {
    if (audioRef.current) { audioRef.current.currentTime = val[0]; setCurrentTime(val[0]); }
  }

  function changeVolume(val: number[]) {
    setVolume(val[0]); setMuted(false);
    if (audioRef.current) audioRef.current.volume = val[0];
  }

  function toggleMute() {
    setMuted(!muted);
    if (audioRef.current) audioRef.current.volume = muted ? volume : 0;
  }

  async function downloadToDevice(song: Song) {
    if (!isOnline && !cachedIds.has(song.id)) {
      toast({ title: "Tidak bisa download", description: "Kamu sedang offline.", variant: "destructive" });
      return;
    }
    setDownloading(song.id);
    try {
      let blob: Blob | null = await getCachedBlob(song.id);
      if (!blob) { const response = await fetch(song.file_url); blob = await response.blob(); }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${song.artist} - ${song.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download dimulai 📥", description: `${song.title} disimpan ke HP` });
    } catch {
      toast({ title: "Gagal download", variant: "destructive" });
    }
    setDownloading(null);
  }

  async function downloadToCache(song: Song) {
    if (!isOnline) {
      toast({ title: "Tidak bisa simpan offline", description: "Hubungkan internet dulu.", variant: "destructive" });
      return;
    }
    if (cachedIds.has(song.id)) {
      toast({ title: "Sudah tersimpan offline ✅", description: song.title });
      return;
    }
    const currentMax = getTotalMaxBytes();
    const newUsed = downloadedStorage + (song.file_size || 0);
    if (newUsed > currentMax) {
      toast({ title: "Penyimpanan penuh!", description: `Kuota ${formatStorageSize(currentMax)} habis. Upgrade atau hapus lagu offline.`, variant: "destructive" });
      return;
    }
    setDownloading(song.id);
    try {
      const ok = await cacheSong(song);
      if (!ok) throw new Error("cache failed");
      toast({ title: "Tersimpan offline ✅", description: `${song.title} bisa diputar tanpa internet` });
      await refreshCacheInfo();
    } catch {
      toast({ title: "Gagal menyimpan offline", variant: "destructive" });
    }
    setDownloading(null);
  }

  async function removeFromCache(song: Song) {
    await removeCachedSong(song.id);
    toast({ title: "Dihapus dari offline", description: song.title });
    await refreshCacheInfo();
  }

  // Purchase a storage plan
  async function handleUpgrade() {
    const plan = PURCHASABLE_PLANS[selectedPlanIndex];
    if (!plan) return;
    setUpgrading(true);
    try {
      const { getVisitorId } = await import("@/lib/visitor-id");
      const visitorId = getVisitorId();
      const { data, error } = await supabase.functions.invoke("upgrade-storage", {
        body: { visitor_id: visitorId, tier_name: plan.name, price: plan.pricePerMonth },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Gagal upgrade", description: data.error, variant: "destructive" });
        setUpgrading(false);
        return;
      }
      // Save subscription locally
      const newSub = saveSub(plan);
      setActiveSubs(getActiveSubscriptions());
      setMaxBytes(getTotalMaxBytes());
      setUpgradeOpen(false);
      toast({
        title: "Upgrade berhasil! 🎉",
        description: `+${formatStorageSize(plan.addBytes)} aktif sampai ${formatDate(newSub.expiresAt)}`,
      });
    } catch (err: any) {
      toast({ title: "Gagal upgrade", description: err?.message || "Coba lagi nanti", variant: "destructive" });
    }
    setUpgrading(false);
  }

  useEffect(() => { return () => { if (audioRef.current) audioRef.current.pause(); }; }, []);

  const [activeView, setActiveView] = useState<"playlist" | "storage">("playlist");

  const storagePercent = Math.min((downloadedStorage / maxBytes) * 100, 100);
  const isNearLimit = storagePercent > 80;
  const isAtLimit = storagePercent > 95;
  const cachedCount = cachedIds.size;
  const hasSubs = activeSubs.length > 0;

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
        <p className="text-xs mt-1">Admin bisa upload lagu dari dashboard.</p>
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

      {!isOnline && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2 text-xs text-destructive">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Mode offline — hanya lagu yang sudah disimpan offline yang bisa diputar.</span>
          </CardContent>
        </Card>
      )}

      {/* Storage Card */}
      <Card className={`border-primary/20 ${isAtLimit ? "border-destructive/50" : isNearLimit ? "border-yellow-500/50" : ""}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold">Penyimpanan Offline</span>
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${hasSubs ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {hasSubs ? <Crown className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              {hasSubs ? `${formatStorageSize(maxBytes)}` : "Free 2GB"}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-background/70 p-2.5 border border-border/60 text-center">
              <p className="text-[10px] text-muted-foreground">Total</p>
              <p className="text-sm font-extrabold">{songs.length}</p>
            </div>
            <div className="rounded-xl bg-background/70 p-2.5 border border-border/60 text-center">
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 text-accent" /> Offline
              </p>
              <p className="text-sm font-extrabold text-accent">{cachedCount}</p>
            </div>
            <div className="rounded-xl bg-background/70 p-2.5 border border-border/60 text-center">
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                <HardDrive className="w-3 h-3" /> Terpakai
              </p>
              <p className={`text-sm font-extrabold ${isAtLimit ? "text-destructive" : isNearLimit ? "text-yellow-600" : ""}`}>
                {formatStorageSize(downloadedStorage)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Progress value={storagePercent} className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""}`} />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatStorageSize(downloadedStorage)}</span>
              <span>{formatStorageSize(maxBytes)}</span>
            </div>
          </div>

          {/* Active subscriptions list */}
          {activeSubs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground">Paket Aktif:</p>
              {activeSubs.map((sub, i) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                return (
                  <div key={i} className="flex items-center justify-between text-[11px] rounded-lg bg-primary/5 px-2.5 py-1.5 border border-primary/10">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3 h-3 text-primary" />
                      <span className="font-bold">{sub.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{daysLeft} hari lagi</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs border-primary/30 hover:bg-primary/10"
            onClick={() => setUpgradeOpen(true)}
          >
            <Zap className="w-3.5 h-3.5 text-primary" />
            {hasSubs ? "Tambah / Upgrade Penyimpanan" : "Upgrade Penyimpanan"}
          </Button>

          <p className="text-[10px] text-muted-foreground">
            {isAtLimit
              ? "⚠️ Penyimpanan penuh! Hapus lagu offline atau upgrade."
              : "Simpan lagu ke offline agar bisa diputar tanpa internet."}
          </p>
        </CardContent>
      </Card>

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
                <p className="text-xs text-muted-foreground truncate">
                  {currentSong.artist}
                  {cachedIds.has(currentSong.id) && <span className="ml-1 text-accent">• Offline</span>}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={seek} className="cursor-pointer" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
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
        {songs.map((song, i) => {
          const isCached = cachedIds.has(song.id);
          return (
            <Card key={song.id} className={`overflow-hidden transition-all cursor-pointer hover:shadow-md ${currentIndex === i ? "border-primary/40 bg-primary/5" : ""}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <button onClick={() => playSong(i)} className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors relative overflow-hidden">
                  {song.cover_url ? (
                    <img src={song.cover_url} alt="" className="w-full h-full object-cover absolute inset-0" />
                  ) : currentIndex === i && isPlaying ? (
                    <Pause className="w-4 h-4 text-primary" />
                  ) : (
                    <Play className="w-4 h-4 text-primary ml-0.5" />
                  )}
                  {song.cover_url && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      {currentIndex === i && isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                    </div>
                  )}
                  {isCached && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center z-10">
                      <CheckCircle2 className="w-2.5 h-2.5 text-accent-foreground" />
                    </span>
                  )}
                </button>
                <div className="flex-1 min-w-0" onClick={() => playSong(i)}>
                  <p className="font-bold text-sm truncate">{song.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {song.artist}
                    {song.file_size > 0 ? ` • ${formatSize(song.file_size)}` : ""}
                    {isCached && <span className="text-accent font-semibold"> • Offline</span>}
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
                      {!isOnline && !isCached && <WifiOff className="w-3 h-3 ml-auto text-destructive" />}
                    </DropdownMenuItem>
                    {!isCached ? (
                      <DropdownMenuItem onClick={() => downloadToCache(song)} className="gap-2 cursor-pointer" disabled={!isOnline}>
                        <Download className="w-4 h-4" /> Simpan Offline
                        {!isOnline && <WifiOff className="w-3 h-3 ml-auto text-destructive" />}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => removeFromCache(song)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4" /> Hapus dari Offline
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => window.open(song.file_url, "_blank")} className="gap-2 cursor-pointer" disabled={!isOnline}>
                      <Globe className="w-4 h-4" /> Buka di Browser
                      {!isOnline && <WifiOff className="w-3 h-3 ml-auto text-destructive" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" /> Tambah Penyimpanan
            </DialogTitle>
            <DialogDescription>
              Beli paket penyimpanan offline. Setiap paket berlaku 30 hari dan bisa ditambah kapan saja.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Current storage */}
            <div className="rounded-xl border border-border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Kuota Saat Ini</p>
                  <p className="text-xs text-muted-foreground">
                    Free 2GB{activeSubs.length > 0 ? ` + ${activeSubs.map(s => s.name).join(" + ")}` : ""}
                  </p>
                </div>
                <span className="text-sm font-extrabold text-primary">{formatStorageSize(maxBytes)}</span>
              </div>
            </div>

            {/* Active subs with expiry */}
            {activeSubs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Paket Aktif:</p>
                {activeSubs.map((sub, i) => {
                  const daysLeft = Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] rounded-lg bg-primary/5 px-3 py-2 border border-primary/10">
                      <div>
                        <span className="font-bold">{sub.name}</span>
                        <span className="text-muted-foreground ml-1">• beli {formatDate(sub.purchasedAt)}</span>
                      </div>
                      <span className={`font-semibold ${daysLeft <= 3 ? "text-destructive" : "text-muted-foreground"}`}>
                        {daysLeft}h lagi
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Plan options */}
            <p className="text-[11px] font-semibold text-muted-foreground">Pilih Paket:</p>
            {PURCHASABLE_PLANS.map((plan, idx) => {
              const isSelected = selectedPlanIndex === idx;
              return (
                <div
                  key={plan.name}
                  onClick={() => setSelectedPlanIndex(idx)}
                  className={`rounded-xl border-2 p-3 cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold flex items-center gap-1">
                        <Crown className="w-4 h-4 text-primary" /> {plan.name}
                      </p>
                      <p className="text-xs text-muted-foreground">+{formatStorageSize(plan.addBytes)} selama 30 hari</p>
                    </div>
                    <span className="text-sm font-extrabold text-primary">{formatCurrency(plan.pricePerMonth)}/bln</span>
                  </div>
                </div>
              );
            })}

            <p className="text-[11px] text-muted-foreground">
              💡 Saldo dipotong {formatCurrency(PURCHASABLE_PLANS[selectedPlanIndex]?.pricePerMonth || 0)}. Paket berlaku 30 hari.
              Lagu yang sudah di-download tetap tersimpan meski paket habis, tapi tidak bisa download baru jika melebihi kuota.
            </p>
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
    </div>
  );
};

export default PlaylistTab;

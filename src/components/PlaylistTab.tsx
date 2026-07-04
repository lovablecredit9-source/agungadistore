import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Music, Play, Pause, SkipBack, SkipForward, Download, Volume2, VolumeX,
  Repeat, Shuffle, Loader2, HardDrive, Globe, CheckCircle2, Trash2,
  WifiOff, Wifi, Crown, Zap, Clock, ListMusic, Plus, Edit2, Check, Lock, Heart,
  FileText, Copyright, Type, ChevronDown, Share2, Timer, Sparkles, List, Ticket, Tag, Users, Mic2, Sliders, Search, X
} from "lucide-react";
import MusicPublicTab from "@/components/MusicPublicTab";
import ArtistTab from "@/components/ArtistTab";
import AudioDeviceDetector from "@/components/AudioDeviceDetector";
import MusicEqualizer from "@/components/MusicEqualizer";
import { attachAudioVisualizer } from "@/lib/audio-visualizer";
import AudioFxSettings from "@/components/AudioFxSettings";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import DeviceInfoCard from "@/components/DeviceInfoCard";

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
  id: string;
  name: string;
  addBytes: number;
  pricePerMonth: number;
  storage_mb: number;
}

interface ActiveSubscription {
  name: string;
  addBytes: number;
  price: number;
  purchasedAt: string;
  expiresAt: string;
}

const FREE_BYTES = 2 * 1024 * 1024 * 1024;

const CACHE_NAME = "playlist-offline-v1";
const META_CACHE_KEY = "/offline-music-meta";
const SUBS_STORAGE_KEY = "playlist-storage-subs";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PLAYBACK_REPORT_INTERVAL_MS = 1000;
const CURRENT_TIME_RENDER_INTERVAL_MS = 500;

function canUseWebAudioGraph(audioUrl: string) {
  try {
    const url = new URL(audioUrl, window.location.href);
    return url.origin === window.location.origin || url.protocol === "blob:" || url.protocol === "data:";
  } catch {
    return false;
  }
}

function safelyAttachAudioVisualizer(audio: HTMLAudioElement, audioUrl: string) {
  if (canUseWebAudioGraph(audioUrl)) attachAudioVisualizer(audio);
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

function getTotalMaxBytes(redeemedMb: number = 0): number {
  return FREE_BYTES + getActiveSubscriptions().reduce((sum, s) => sum + s.addBytes, 0) + (redeemedMb * 1024 * 1024);
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
  onOpenFullPlayer?: React.MutableRefObject<(() => void) | null>;
  onPlayExternal?: React.MutableRefObject<((song: { id: string; title: string; artist: string; file_url: string; cover_url: string | null }) => void) | null>;
}

// ===== COMPONENT =====
const PlaylistTab = ({ onPlaybackChange, onTogglePlay, onOpenFullPlayer, onPlayExternal }: PlaylistTabProps) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [externalSong, setExternalSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  // Liked songs
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(new Set());
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [downloadedStorage, setDownloadedStorage] = useState(0);
  const [maxBytes, setMaxBytes] = useState(FREE_BYTES);
  const [activeSubs, setActiveSubs] = useState<ActiveSubscription[]>(getActiveSubscriptions());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [storagePlans, setStoragePlans] = useState<StoragePlan[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackReportRef = useRef({ lastAt: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const currentTimeRenderRef = useRef(0);
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const updateRenderedCurrentTime = useCallback((time: number, force = false) => {
    const now = performance.now();
    if (!force && now - currentTimeRenderRef.current < CURRENT_TIME_RENDER_INTERVAL_MS) return;
    currentTimeRenderRef.current = now;
    setCurrentTime(time);
  }, []);

  // Playlists state
  const [adminPlaylists, setAdminPlaylists] = useState<Playlist[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItemRow[]>([]);
  const [viewingPlaylist, setViewingPlaylist] = useState<Playlist | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const [activeView, setActiveView] = useState<"playlist" | "myplaylists" | "storage" | "liked" | "public" | "artist">("playlist");

  // Voucher redeem
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemedStorages, setRedeemedStorages] = useState<{id: string; storage_mb: number; voucher_code: string; redeemed_at: string; expires_at: string | null}[]>([]);
  // Compute active redeemed MB
  const activeRedeemedMb = useMemo(() => {
    const now = new Date();
    return redeemedStorages
      .filter(rs => !rs.expires_at || new Date(rs.expires_at) >= now)
      .reduce((sum, rs) => sum + rs.storage_mb, 0);
  }, [redeemedStorages]);
  // Discount code for upgrade
  const [upgradeDiscountCode, setUpgradeDiscountCode] = useState("");
  const [upgradeDiscountAmount, setUpgradeDiscountAmount] = useState(0);
  // PIN for upgrade
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [upgradePinInput, setUpgradePinInput] = useState("");
  const [hasPin, setHasPin] = useState(false);

  // Lyrics state
  const [allLyrics, setAllLyrics] = useState<LyricLine[]>([]);
  const [termsOpen, setTermsOpen] = useState(false);
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const fullPlayerLyricsRef = useRef<HTMLDivElement>(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);

  // Listen for global "open audio fx" event so other tabs (e.g. MusicMegaHub) can open it
  useEffect(() => {
    const handler = () => setShowFxSettings(true);
    window.addEventListener("open-audio-fx", handler);
    return () => window.removeEventListener("open-audio-fx", handler);
  }, []);


  // Audio FX & extras
  const [showFxSettings, setShowFxSettings] = useState(false);
  const [crossfadeSec, setCrossfadeSec] = useState<number>(() => {
    try { return Number(localStorage.getItem("audio_crossfade_sec") || "0") || 0; } catch { return 0; }
  });
  useEffect(() => { try { localStorage.setItem("audio_crossfade_sec", String(crossfadeSec)); } catch {} }, [crossfadeSec]);
  const crossfadeRef = useRef(crossfadeSec);
  useEffect(() => { crossfadeRef.current = crossfadeSec; }, [crossfadeSec]);
  const [abLoopEnabled, setAbLoopEnabled] = useState(false);
  const [abLoopA, setAbLoopA] = useState<number | null>(null);
  const [abLoopB, setAbLoopB] = useState<number | null>(null);
  const abRef = useRef({ enabled: false, a: null as number | null, b: null as number | null });
  useEffect(() => { abRef.current = { enabled: abLoopEnabled, a: abLoopA, b: abLoopB }; }, [abLoopEnabled, abLoopA, abLoopB]);

  const buildFallbackRecommendationIds = useCallback((songList: Song[], likedIds: Set<string>) => {
    const likedArtists = new Set(
      songList
        .filter(song => likedIds.has(song.id))
        .map(song => song.artist.trim().toLowerCase())
        .filter(Boolean)
    );

    const unseenSongs = songList.filter(song => !likedIds.has(song.id));
    const artistMatched = unseenSongs.filter(song => likedArtists.has(song.artist.trim().toLowerCase()));
    const remaining = unseenSongs.filter(song => !artistMatched.some(match => match.id === song.id));
    const fallback = [...artistMatched, ...remaining];

    return (fallback.length > 0 ? fallback : songList).slice(0, 6).map(song => song.id);
  }, []);

  const recommendedSongs = useMemo(
    () => aiRecommendedIds
      .map(id => songs.find(song => song.id === id))
      .filter((song): song is Song => Boolean(song)),
    [aiRecommendedIds, songs]
  );

  // Current playing song list (filtered by playlist or all)
  const displaySongs = viewingPlaylist
    ? songs.filter(s => playlistItems.some(pi => pi.playlist_id === viewingPlaylist.id && pi.song_id === s.id))
    : songs;

  useEffect(() => {
    const interval = setInterval(() => { setActiveSubs(getActiveSubscriptions()); setMaxBytes(getTotalMaxBytes(activeRedeemedMb)); }, 60000);
    return () => clearInterval(interval);
  }, [activeRedeemedMb]);

  useEffect(() => { fetchSongs(); fetchRedeemedStorages(); checkPinExists(); fetchLikedSongs(); fetchStoragePlans(); }, []);

  // Refresh storage saat ditebus dari Streak Shop / tempat lain
  useEffect(() => {
    const onStorageUpdated = () => fetchRedeemedStorages();
    window.addEventListener("music-storage-updated", onStorageUpdated);
    return () => window.removeEventListener("music-storage-updated", onStorageUpdated);
  }, []);

  async function fetchStoragePlans() {
    const { data } = await supabase.from("storage_packages" as any).select("*").eq("is_active", true).order("sort_order", { ascending: true });
    if (data && (data as any[]).length > 0) {
      setStoragePlans((data as any[]).map((p: any) => ({
        id: p.id,
        name: p.name,
        storage_mb: p.storage_mb,
        addBytes: p.storage_mb * 1024 * 1024,
        pricePerMonth: p.price,
      })));
    }
  }
  useEffect(() => {
    if (songs.length === 0) return;
    void fetchAiRecommendations();
  }, [songs, likedSongIds]);
  // Update maxBytes when activeRedeemedMb changes
  useEffect(() => { setMaxBytes(getTotalMaxBytes(activeRedeemedMb)); }, [activeRedeemedMb]);

  // Realtime: auto-refresh when admin changes songs/playlists
  useEffect(() => {
    const ch = supabase.channel("music-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_songs" }, () => fetchSongs())
      .on("postgres_changes", { event: "*", schema: "public", table: "playlists" }, () => fetchSongs())
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_items" }, () => fetchSongs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function checkPinExists() {
    const visitorId = await getVisitorIdSafe();
    const { data } = await supabase.functions.invoke("manage-pin", { body: { action: "check", visitorId } });
    if (data) setHasPin(data.hasPin);
  }

  async function fetchRedeemedStorages() {
    const visitorId = await getVisitorIdSafe();
    const { data } = await supabase.from("user_music_storage").select("*").eq("visitor_id", visitorId).order("redeemed_at", { ascending: false });
    if (data) setRedeemedStorages(data as any[]);
  }

  async function redeemStorageVoucher() {
    if (!redeemCode.trim()) { toast({ title: "Masukkan kode voucher", variant: "destructive" }); return; }
    setRedeeming(true);
    try {
      const visitorId = await getVisitorIdSafe();
      const { data, error } = await supabase.functions.invoke("redeem-music-storage", {
        body: { visitor_id: visitorId, code: redeemCode.trim() },
      });
      if (error) throw error;
      if (data?.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setRedeeming(false); return; }
      toast({ title: "Berhasil! 🎉", description: data.message });
      setRedeemCode("");
      fetchRedeemedStorages();
    } catch (err: any) { toast({ title: "Gagal redeem", description: err?.message, variant: "destructive" }); }
    setRedeeming(false);
  }

  async function applyMusicDiscount() {
    if (!upgradeDiscountCode.trim()) { setUpgradeDiscountAmount(0); return; }
    const { data } = await supabase.from("music_discount_vouchers").select("*").eq("code", upgradeDiscountCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
    if (!data) { toast({ title: "Kode diskon tidak valid", variant: "destructive" }); setUpgradeDiscountAmount(0); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { toast({ title: "Kode diskon sudah expired", variant: "destructive" }); setUpgradeDiscountAmount(0); return; }
    if (data.used_count >= data.max_uses) { toast({ title: "Kode diskon sudah habis", variant: "destructive" }); setUpgradeDiscountAmount(0); return; }
    setUpgradeDiscountAmount(data.discount_amount);
    toast({ title: `Diskon Rp${data.discount_amount.toLocaleString()} diterapkan! 🏷️` });
  }

  async function getVisitorIdSafe() {
    const { getVisitorId } = await import("@/lib/visitor-id");
    return getVisitorId();
  }

  async function fetchLikedSongs() {
    const visitorId = await getVisitorIdSafe();
    const { data } = await supabase.from("liked_songs").select("song_id").eq("visitor_id", visitorId);
    if (data) setLikedSongIds(new Set(data.map((d: any) => d.song_id)));
  }

  async function toggleLikeSong(songId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    const visitorId = await getVisitorIdSafe();
    if (likedSongIds.has(songId)) {
      await supabase.from("liked_songs").delete().eq("song_id", songId).eq("visitor_id", visitorId);
      setLikedSongIds(prev => {
        const next = new Set(prev);
        next.delete(songId);
        setTimeout(() => {
          const fallbackIds = buildFallbackRecommendationIds(songs, next);
          setAiRecommendedIds(fallbackIds);
          void fetchAiRecommendations();
        }, 0);
        return next;
      });
    } else {
      await supabase.from("liked_songs").insert({ song_id: songId, visitor_id: visitorId });
      setLikedSongIds(prev => {
        const next = new Set(prev).add(songId);
        setTimeout(() => {
          const fallbackIds = buildFallbackRecommendationIds(songs, next);
          setAiRecommendedIds(fallbackIds);
          void fetchAiRecommendations();
        }, 0);
        return next;
      });
    }
  }

  async function fetchAiRecommendations() {
    setLoadingRecs(true);
    const fallbackIds = buildFallbackRecommendationIds(songs, likedSongIds);
    try {
      const visitorId = await getVisitorIdSafe();
      const { data, error } = await supabase.functions.invoke("recommend-songs", {
        body: { visitor_id: visitorId },
      });
      if (error) throw error;

      const nextIds = Array.isArray(data?.recommended_ids)
        ? data.recommended_ids.filter((id: unknown): id is string => typeof id === "string")
        : [];

      setAiRecommendedIds(nextIds.length > 0 ? nextIds : fallbackIds);
    } catch (err) {
      console.error("AI recommendation error:", err);
      setAiRecommendedIds(fallbackIds);
    } finally {
      setLoadingRecs(false);
    }
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
    setMaxBytes(getTotalMaxBytes(activeRedeemedMb));
    setActiveSubs(getActiveSubscriptions());
  }

  const currentSong = currentIndex >= 0 ? displaySongs[currentIndex] : externalSong;

  // Report playback state to parent, throttled so the huge app shell doesn't re-render on every audio tick
  useEffect(() => {
    if (!onPlaybackChange) return;
    const state = { song: currentSong || null, isPlaying, currentTime, duration };
    if (!isPlaying) {
      if (playbackReportRef.current.timer) clearTimeout(playbackReportRef.current.timer);
      playbackReportRef.current.timer = null;
      playbackReportRef.current.lastAt = Date.now();
      onPlaybackChange(state);
      return;
    }

    const now = Date.now();
    const elapsed = now - playbackReportRef.current.lastAt;
    if (elapsed >= PLAYBACK_REPORT_INTERVAL_MS) {
      playbackReportRef.current.lastAt = now;
      onPlaybackChange(state);
      return;
    }

    if (playbackReportRef.current.timer) return;
    playbackReportRef.current.timer = setTimeout(() => {
      playbackReportRef.current.timer = null;
      playbackReportRef.current.lastAt = Date.now();
      onPlaybackChange({ song: currentSong || null, isPlaying, currentTime, duration });
    }, PLAYBACK_REPORT_INTERVAL_MS - elapsed);

    return () => {
      if (playbackReportRef.current.timer) {
        clearTimeout(playbackReportRef.current.timer);
        playbackReportRef.current.timer = null;
      }
    };
  }, [currentSong, isPlaying, currentTime, duration]);

  // Expose togglePlay, openFullPlayer, and playExternal to parent
  useEffect(() => {
    if (onTogglePlay) onTogglePlay.current = togglePlay;
    if (onOpenFullPlayer) onOpenFullPlayer.current = () => setShowFullPlayer(true);
    if (onPlayExternal) onPlayExternal.current = (song) => {
      // Play an external song (from publik tab) through the main audio system
      if (audioRef.current) audioRef.current.pause();
      const songForPlayback: Song = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        file_url: song.file_url,
        cover_url: song.cover_url,
        duration: 0,
        file_size: 0,
        release_date: null,
        created_at: '',
      };
      const audio = new Audio(song.file_url);
      audioRef.current = audio;
      audio.preload = "auto";
      audio.volume = muted ? 0 : volume;
      safelyAttachAudioVisualizer(audio, song.file_url);
      audio.play().catch(() => {});
      setCurrentIndex(-1);
      setExternalSong(songForPlayback);
      setIsPlaying(true);
      updateRenderedCurrentTime(0, true);
      audio.addEventListener("timeupdate", () => {
        updateRenderedCurrentTime(audio.currentTime);
        // A-B loop
        const ab = abRef.current;
        if (ab.enabled && ab.a != null && ab.b != null && ab.b > ab.a && audio.currentTime >= ab.b) {
          audio.currentTime = ab.a;
        }
        if ("mediaSession" in navigator && "setPositionState" in navigator.mediaSession) {
          try { navigator.mediaSession.setPositionState({ duration: audio.duration || 0, playbackRate: audio.playbackRate, position: audio.currentTime }); } catch {}
        }
      });
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => { setIsPlaying(false); });
      // Media Session
      if ("mediaSession" in navigator) {
        const artworkList: MediaImage[] = song.cover_url
          ? [{ src: song.cover_url, sizes: "192x192", type: "image/jpeg" }, { src: song.cover_url, sizes: "512x512", type: "image/jpeg" }]
          : [];
        navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: "Publik", artwork: artworkList });
        navigator.mediaSession.setActionHandler("play", () => { audioRef.current?.play(); setIsPlaying(true); });
        navigator.mediaSession.setActionHandler("pause", () => { audioRef.current?.pause(); setIsPlaying(false); });
      }
      // Report to parent
      onPlaybackChange?.({ song: songForPlayback, isPlaying: true, currentTime: 0, duration: 0 });
    };
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

  // Auto-scroll lyrics (inline + fullscreen)
  useEffect(() => {
    if (activeLyricIndex < 0) return;
    [lyricsContainerRef.current, fullPlayerLyricsRef.current].forEach(container => {
      if (!container) return;
      const el = container.querySelector(`[data-lyric-index="${activeLyricIndex}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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
    audio.preload = "auto";
    audio.volume = muted ? 0 : volume;
    safelyAttachAudioVisualizer(audio, audioUrl);
    audio.play().catch(() => {});
    setExternalSong(null);
    setCurrentIndex(index);
    setIsPlaying(true);
    updateRenderedCurrentTime(0, true);
    audio.addEventListener("timeupdate", () => {
      updateRenderedCurrentTime(audio.currentTime);
      // A-B loop
      const ab = abRef.current;
      if (ab.enabled && ab.a != null && ab.b != null && ab.b > ab.a && audio.currentTime >= ab.b) {
        audio.currentTime = ab.a;
      }
      // Crossfade: trigger next song slightly early with fade-out
      const xf = crossfadeRef.current;
      if (xf > 0 && audio.duration && !ab.enabled) {
        const remaining = audio.duration - audio.currentTime;
        if (remaining <= xf && remaining > 0 && !(audio as HTMLAudioElement & { __xfading?: boolean }).__xfading) {
          (audio as HTMLAudioElement & { __xfading?: boolean }).__xfading = true;
          // Smooth volume ramp
          const startVol = audio.volume;
          const steps = 10;
          let i = 0;
          const interval = setInterval(() => {
            i++;
            if (!audioRef.current || audioRef.current !== audio) { clearInterval(interval); return; }
            audio.volume = Math.max(0, startVol * (1 - i / steps));
            if (i >= steps) clearInterval(interval);
          }, (remaining * 1000) / steps);
          // Trigger next a bit early
          setTimeout(() => {
            if (audioRef.current === audio) playNextFrom(index, songList);
          }, Math.max(0, (remaining - 0.3) * 1000));
        }
      }
      if ("mediaSession" in navigator && "setPositionState" in navigator.mediaSession) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration || 0,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
          });
        } catch {}
      }
    });
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("ended", () => {
      if (cachedBlob) URL.revokeObjectURL(audioUrl);
      if (repeat) { audio.currentTime = 0; audio.play(); } else { playNextFrom(index, songList); }
    });

    // Media Session API - show song info in system media player
    if ("mediaSession" in navigator) {
      const artworkList: MediaImage[] = song.cover_url
        ? [
            { src: song.cover_url, sizes: "96x96", type: "image/jpeg" },
            { src: song.cover_url, sizes: "128x128", type: "image/jpeg" },
            { src: song.cover_url, sizes: "192x192", type: "image/jpeg" },
            { src: song.cover_url, sizes: "256x256", type: "image/jpeg" },
            { src: song.cover_url, sizes: "384x384", type: "image/jpeg" },
            { src: song.cover_url, sizes: "512x512", type: "image/jpeg" },
          ]
        : [];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: viewingPlaylist?.name || "Playlist",
        artwork: artworkList,
      });
      navigator.mediaSession.setActionHandler("play", () => {
        audioRef.current?.play(); setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause(); setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => playPrev());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });
    }
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
    const currentMax = getTotalMaxBytes(activeRedeemedMb);
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

  function attemptUpgrade() {
    const plan = storagePlans[selectedPlanIndex];
    if (!plan) return;
    if (hasPin) {
      setUpgradePinInput("");
      setShowPinDialog(true);
    } else {
      handleUpgrade();
    }
  }

  async function confirmPinAndUpgrade() {
    const visitorId = await getVisitorIdSafe();
    const { data, error } = await supabase.functions.invoke("manage-pin", {
      body: { action: "verify", visitorId, pin: upgradePinInput },
    });
    if (error || data?.error || !data?.valid) {
      toast({ title: "PIN salah", variant: "destructive" }); return;
    }
    setShowPinDialog(false);
    handleUpgrade();
  }

  async function handleUpgrade() {
    const plan = storagePlans[selectedPlanIndex];
    if (!plan) return;
    setUpgrading(true);
    try {
      const visitorId = await getVisitorIdSafe();
      const finalPrice = Math.max(0, plan.pricePerMonth - upgradeDiscountAmount);
      const { data, error } = await supabase.functions.invoke("upgrade-storage", { body: { visitor_id: visitorId, tier_name: plan.name, price: finalPrice } });
      if (error) throw error;
      if (data?.error) { toast({ title: "Gagal upgrade", description: data.error, variant: "destructive" }); setUpgrading(false); return; }
      // Increment music discount voucher used_count if used
      if (upgradeDiscountAmount > 0 && upgradeDiscountCode.trim()) {
        const { data: vd } = await supabase.from("music_discount_vouchers").select("id, used_count").eq("code", upgradeDiscountCode.trim().toUpperCase()).maybeSingle();
        if (vd) await supabase.from("music_discount_vouchers").update({ used_count: (vd.used_count || 0) + 1 } as any).eq("id", vd.id);
      }
      const newSub = saveSub(plan);
      setActiveSubs(getActiveSubscriptions()); setMaxBytes(getTotalMaxBytes(activeRedeemedMb)); setUpgradeOpen(false);
      setUpgradeDiscountCode(""); setUpgradeDiscountAmount(0);
      toast({ title: "Upgrade berhasil! 🎉", description: `+${formatStorageSize(plan.addBytes)} aktif sampai ${formatDate(newSub.expiresAt)}${upgradeDiscountAmount > 0 ? ` (diskon Rp${upgradeDiscountAmount.toLocaleString()})` : ""}` });
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

  const renderSongList = (songList: Song[], resolveIndex?: (song: Song, i: number) => number) => (
    <div className="space-y-2.5">
      {songList.map((song, i) => {
        const isCached = cachedIds.has(song.id);
        const isActive = currentIndex === i && currentSong?.id === song.id;
        const isLiked = likedSongIds.has(song.id);
        return (
          <Card
            key={song.id}
            className={`group relative overflow-hidden transition-all duration-300 cursor-pointer border ${
              isActive
                ? "border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-500/15 via-purple-500/10 to-indigo-500/15 shadow-[0_0_24px_-6px_hsl(300_90%_60%/0.5)]"
                : "border-border/60 bg-gradient-to-br from-background to-muted/30 hover:border-fuchsia-500/30 hover:shadow-[0_4px_18px_-6px_hsl(300_90%_60%/0.35)]"
            }`}
          >
            {/* Neon accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isActive ? "bg-gradient-to-b from-pink-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_8px_hsl(300_90%_60%)]" : "bg-transparent group-hover:bg-gradient-to-b group-hover:from-pink-500/40 group-hover:to-indigo-500/40"} transition-all`} />
            {/* Shine sweep on active */}
            {isActive && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -inset-x-1 -top-1 h-full opacity-40" style={{ background: "linear-gradient(110deg, transparent 30%, hsl(0 0% 100% / 0.15) 50%, transparent 70%)", animation: "shine-sweep 3s linear infinite" }} />
              </div>
            )}
            <CardContent className="p-3 flex items-center gap-3 relative">
              <button
                onClick={() => playSong(resolveIndex ? resolveIndex(song, i) : i)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all relative overflow-hidden ${
                  isActive
                    ? "bg-gradient-to-br from-pink-500 via-fuchsia-500 to-indigo-500 shadow-[0_0_18px_-2px_hsl(300_90%_60%/0.7)] ring-2 ring-fuchsia-400/40"
                    : "bg-gradient-to-br from-fuchsia-500/20 via-purple-500/15 to-indigo-500/20 hover:from-fuchsia-500/40 hover:to-indigo-500/40 ring-1 ring-fuchsia-500/20"
                }`}
              >
                {song.cover_url ? (
                  <img
                    src={song.cover_url}
                    alt=""
                    className={`w-full h-full object-cover absolute inset-0 ${isActive && isPlaying ? "animate-[spin_8s_linear_infinite]" : ""}`}
                  />
                ) : isActive && isPlaying ? (
                  <Pause className={`w-5 h-5 ${isActive ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" : "text-fuchsia-400"}`} />
                ) : (
                  <Play className={`w-5 h-5 ml-0.5 ${isActive ? "text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" : "text-fuchsia-400"}`} />
                )}
                {song.cover_url && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    {isActive && isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                  </div>
                )}
                {/* Real-time audio equalizer when active+playing */}
                {isActive && isPlaying && !song.cover_url && (
                  <div className="absolute inset-0 flex items-end justify-center pb-1.5 pointer-events-none">
                    <MusicEqualizer isPlaying={isPlaying} bars={5} height={16} variant="rainbow" barWidth={3} />
                  </div>
                )}
                {isCached && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center z-10 ring-2 ring-background shadow-[0_0_8px_hsl(160_84%_50%/0.6)]">
                    <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </button>
              <div className="flex-1 min-w-0" onClick={() => playSong(resolveIndex ? resolveIndex(song, i) : i)}>
                <p className={`font-bold text-sm truncate ${isActive ? "bg-gradient-to-r from-pink-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent" : "text-foreground"}`}>
                  {song.title}
                </p>
                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <span className="font-medium">{song.artist}</span>
                  {song.file_size > 0 && (
                    <>
                      <span className="text-fuchsia-500/60">•</span>
                      <span>{formatSize(song.file_size)}</span>
                    </>
                  )}
                  {isCached && (
                    <>
                      <span className="text-emerald-500/60">•</span>
                      <span className="text-emerald-500 font-semibold">Offline</span>
                    </>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                  {song.release_date ? `Dirilis ${formatSongDate(song.release_date)}` : `Diunggah ${formatDate(song.created_at)}`}
                </p>
              </div>
              <button
                onClick={(e) => toggleLikeSong(song.id, e)}
                className={`shrink-0 p-1.5 rounded-full transition-all ${isLiked ? "bg-pink-500/15 hover:bg-pink-500/25" : "hover:bg-muted"}`}
              >
                <Heart className={`w-4 h-4 transition-all ${isLiked ? "fill-pink-500 text-pink-500 drop-shadow-[0_0_6px_hsl(330_90%_60%/0.6)]" : "text-muted-foreground hover:text-pink-500"}`} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 h-8 w-8 p-0 rounded-full hover:bg-fuchsia-500/15 hover:text-fuchsia-500 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    disabled={downloading === song.id}
                  >
                    {downloading === song.id ? <Loader2 className="w-4 h-4 animate-spin text-fuchsia-500" /> : <Download className="w-4 h-4" />}
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

      {/* Premium Aurora Sub-Nav */}
      <div className="relative rounded-2xl p-[1.5px] overflow-hidden"
        style={{
          background: "linear-gradient(120deg, hsl(var(--neon-purple)/0.7), hsl(var(--neon-pink)/0.7) 35%, hsl(var(--neon-cyan)/0.7) 70%, hsl(var(--neon-purple)/0.7))",
          backgroundSize: "300% 300%",
          animation: "aurora-shift 8s ease infinite",
        }}
      >
        <div className="relative rounded-[14px] bg-background/85 backdrop-blur-xl p-1.5 overflow-x-auto scrollbar-hide">
          {/* glow blobs */}
          <div className="pointer-events-none absolute -top-6 -left-4 w-24 h-24 rounded-full blur-3xl opacity-40" style={{ background: "hsl(var(--neon-purple)/0.6)" }} />
          <div className="pointer-events-none absolute -bottom-8 right-0 w-28 h-28 rounded-full blur-3xl opacity-30" style={{ background: "hsl(var(--neon-pink)/0.6)" }} />

          <div className="relative flex gap-1.5 min-w-max sm:min-w-0">
            {([
              { key: "playlist", label: "Semua", icon: Music, color: "var(--neon-cyan)", action: () => { setActiveView("playlist"); setViewingPlaylist(null); } },
              { key: "liked", label: "Suka", icon: Heart, color: "var(--neon-pink)", action: () => { setActiveView("liked"); setViewingPlaylist(null); } },
              { key: "myplaylists", label: "Playlist", icon: ListMusic, color: "var(--neon-purple)", action: () => { setActiveView("myplaylists"); setViewingPlaylist(null); } },
              { key: "storage", label: "Storage", icon: HardDrive, color: "var(--neon-yellow)", action: () => setActiveView("storage") },
              { key: "artist", label: "Artist", icon: Mic2, color: "var(--neon-green)", action: () => setActiveView("artist") },
            ] as const).map(({ key, label, icon: Icon, color, action }) => {
              const active = activeView === key;
              return (
                <button
                  key={key}
                  onClick={action}
                  className={`relative flex-1 min-w-[64px] flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-xl text-[10px] font-bold transition-all duration-300 overflow-hidden group ${
                    active ? "text-white scale-[1.04]" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  style={active ? {
                    background: `linear-gradient(135deg, hsl(${color}/0.95), hsl(${color}/0.65))`,
                    boxShadow: `0 0 18px hsl(${color}/0.5), 0 4px 14px hsl(${color}/0.3), inset 0 1px 0 hsl(0 0% 100%/0.2)`,
                  } : undefined}
                >
                  {active && (
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: "shine-sweep 2.6s ease-in-out infinite" }} />
                  )}
                  <Icon className={`w-3.5 h-3.5 relative ${active ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]" : ""}`} />
                  <span className="relative tracking-wide">{label}</span>
                  {active && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-white/80" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!isOnline && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2 text-xs text-destructive">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Mode offline - hanya lagu tersimpan offline yang bisa diputar.</span>
          </CardContent>
        </Card>
      )}

      {/* Device Info */}
      <DeviceInfoCard />

      {/* Now Playing — Neon Glass Player */}
      {currentSong && (() => {
        const npProgress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
        return (
          <Card
            className="relative overflow-hidden border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-950/95 via-purple-950/95 to-indigo-950/95 backdrop-blur-xl shadow-[0_12px_36px_-8px_rgba(217,70,239,0.7)] cursor-pointer"
            onClick={() => setShowFullPlayer(true)}
          >
            {/* Shine sweep */}
            <div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-pink-400/20 to-transparent skew-x-12 pointer-events-none"
              style={{ animation: "shine-sweep 4s linear infinite" }}
            />
            {/* Animated mesh blobs */}
            <div className="absolute -top-10 -right-8 w-32 h-32 bg-fuchsia-500/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-8 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />

            <CardContent className="relative p-4 space-y-3">
              <div className="flex items-center gap-3">
                {/* Vinyl-style cover */}
                <div className="relative shrink-0">
                  <div
                    className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30 bg-black shadow-[0_0_18px_rgba(217,70,239,0.6)] relative"
                    style={isPlaying ? { animation: "spin 6s linear infinite" } : undefined}
                  >
                    {currentSong.cover_url ? (
                      <img src={currentSong.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
                        <Music className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-3 h-3 rounded-full bg-black border border-white/40" />
                    </div>
                  </div>
                  {isPlaying && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-purple-950 animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-pink-500/30 border border-pink-400/50 text-[9px] font-black text-pink-100 uppercase tracking-wider">
                      {isPlaying ? "Playing" : "Paused"}
                    </span>
                    {isPlaying && (
                      <MusicEqualizer
                        isPlaying={isPlaying}
                        bars={5}
                        height={12}
                        barWidth={2}
                        variant="rainbow"
                      />
                    )}
                    {cachedIds.has(currentSong.id) && (
                      <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 rounded">OFFLINE</span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-white truncate leading-tight">{currentSong.title}</p>
                  <p className="text-xs text-white/70 truncate mt-0.5">{currentSong.artist}</p>
                  {currentSongDateLabel && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-white/50">
                      <Clock className="w-3 h-3" /> {currentSongDateLabel}
                    </p>
                  )}
                </div>
                <ChevronDown className="w-5 h-5 text-white/60 rotate-180 shrink-0" />
              </div>

              {/* Progress slider with neon track */}
              <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 shadow-[0_0_8px_rgba(236,72,153,0.8)] transition-all duration-300"
                    style={{ width: `${npProgress}%` }}
                  />
                  {/* glowing playhead */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(236,72,153,0.95)] transition-all duration-300"
                    style={{ left: `calc(${npProgress}% - 5px)` }}
                  />
                </div>
                <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={seek} className="cursor-pointer -mt-2 opacity-0 h-3" />
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-pink-500/20 border border-pink-400/40 text-pink-100 shadow-[0_0_8px_rgba(236,72,153,0.4)] tabular-nums">
                    {formatTime(currentTime)}
                  </span>
                  <span className="text-[10px] text-white/50 tabular-nums">
                    -{formatTime(Math.max(0, (duration || 0) - currentTime))}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/20 text-white/80 tabular-nums">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShuffle(!shuffle)} className={`p-2 rounded-full transition-colors ${shuffle ? "text-pink-300 bg-pink-500/20" : "text-white/50 hover:text-white"}`}><Shuffle className="w-4 h-4" /></button>
                <button onClick={playPrev} className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"><SkipBack className="w-5 h-5" /></button>
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/50 hover:scale-105 active:scale-95 transition-transform"
                >
                  {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
                </button>
                <button onClick={playNext} className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"><SkipForward className="w-5 h-5" /></button>
                <button onClick={() => setRepeat(!repeat)} className={`p-2 rounded-full transition-colors ${repeat ? "text-pink-300 bg-pink-500/20" : "text-white/50 hover:text-white"}`}><Repeat className="w-4 h-4" /></button>
              </div>

              {/* Volume + share */}
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={toggleMute} className="text-white/60 hover:text-white">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
                <Slider value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={changeVolume} className="flex-1 cursor-pointer" />
                <button onClick={async () => {
                  if (!currentSong) return;
                  const shareUrl = `${window.location.origin}/?song=${currentSong.id}`;
                  const shareData = { title: currentSong.title, text: `🎵 ${currentSong.title} - ${currentSong.artist}`, url: shareUrl };
                  try {
                    if (navigator.share) { await navigator.share(shareData); }
                    else { await navigator.clipboard.writeText(shareUrl); toast({ title: "Link disalin!" }); }
                  } catch {}
                }} className="text-white/60 hover:text-white"><Share2 className="w-4 h-4" /></button>
              </div>

              <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] font-semibold text-pink-200">
                <Type className="w-3.5 h-3.5" />
                {currentSongLyrics.length > 0 ? "Ketuk untuk lihat lirik fullscreen" : "Lirik untuk lagu ini belum tersedia"}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ===== AUDIO FX SETTINGS MODAL ===== */}
      <AudioFxSettings
        open={showFxSettings}
        onClose={() => setShowFxSettings(false)}
        crossfade={{ seconds: crossfadeSec, onChange: setCrossfadeSec }}
        abLoop={{
          enabled: abLoopEnabled,
          a: abLoopA,
          b: abLoopB,
          currentTime,
          onSetA: () => { setAbLoopA(currentTime); toast({ title: `Set A: ${formatTime(currentTime)}` }); },
          onSetB: () => { setAbLoopB(currentTime); toast({ title: `Set B: ${formatTime(currentTime)}` }); },
          onClear: () => { setAbLoopA(null); setAbLoopB(null); setAbLoopEnabled(false); },
          onToggle: (v) => setAbLoopEnabled(v),
        }}
      />

      {/* ===== FULLSCREEN PLAYER (Portal to avoid hidden parent) ===== */}
      {showFullPlayer && currentSong && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background">
          {/* Background gradient overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--background)) 60%)`
          }} />
          <div className="relative z-10 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <button onClick={() => setShowFullPlayer(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <ChevronDown className="w-6 h-6 text-foreground" />
            </button>
            <div className="text-center flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sedang Diputar</p>
              <p className="text-xs font-bold text-foreground truncate">{viewingPlaylist?.name || "Semua Lagu"}</p>
            </div>
            <div className="w-10" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 pb-4 flex flex-col items-center">
            {/* Cover Art */}
            <div className="w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden shadow-2xl my-4 bg-muted/30 shrink-0">
              {currentSong.cover_url ? (
                <img src={currentSong.cover_url} alt={currentSong.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                  <Music className="w-20 h-20 text-primary/40" />
                </div>
              )}
            </div>

            {/* Audio Visualizer Bar Musik — pixel/LED style */}
            <div className="w-full rounded-2xl bg-[#0b0a1f] border border-primary/20 p-3 mt-3 mb-1 shadow-[0_0_24px_hsl(var(--primary)/0.25)] overflow-hidden">
              <MusicEqualizer
                isPlaying={isPlaying}
                bars={40}
                height={72}
                variant="pixel"
                className="w-full"
              />
            </div>

            {/* Song Info */}
            <div className="w-full mt-2 mb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold truncate text-foreground">{currentSong.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{currentSong.artist}</p>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="w-full space-y-1 mb-2">
              <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={seek} className="cursor-pointer" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 w-full mb-4">
              <button onClick={() => setShuffle(!shuffle)} className={`p-2.5 rounded-full transition-colors ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Shuffle className="w-5 h-5" />
              </button>
              <button onClick={playPrev} className="p-2.5 rounded-full text-foreground hover:bg-white/10 transition-colors">
                <SkipBack className="w-7 h-7" />
              </button>
              <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
              </button>
              <button onClick={playNext} className="p-2.5 rounded-full text-foreground hover:bg-white/10 transition-colors">
                <SkipForward className="w-7 h-7" />
              </button>
              <button onClick={() => setRepeat(!repeat)} className={`p-2.5 rounded-full transition-colors ${repeat ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                <Repeat className="w-5 h-5" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3 w-full mb-4">
              <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <Slider value={[muted ? 0 : volume]} max={1} step={0.01} onValueChange={changeVolume} className="flex-1 cursor-pointer" />
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-between w-full mb-4 px-2">
              <button
                onClick={() => setShowFxSettings(true)}
                className="p-2 rounded-full text-foreground/80 hover:text-foreground hover:bg-white/10 transition-colors relative"
                aria-label="Audio Settings"
                title="Audio Settings (EQ, Balance L/R, Bass, dll)"
              >
                <Sliders className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
              </button>
              <div className="flex items-center gap-4">
                <button className="p-2 text-muted-foreground hover:text-foreground rounded-full transition-colors" onClick={async () => {
                  if (!currentSong) return;
                  const shareUrl = `${window.location.origin}/?song=${currentSong.id}`;
                  const shareData = { title: currentSong.title, text: `🎵 ${currentSong.title} - ${currentSong.artist}`, url: shareUrl };
                  try {
                    if (navigator.share) { await navigator.share(shareData); }
                    else { await navigator.clipboard.writeText(shareUrl); toast({ title: "Link disalin!" }); }
                  } catch {}
                }}>
                  <Share2 className="w-5 h-5" />
                </button>
                <button className="p-2 text-muted-foreground hover:text-foreground rounded-full transition-colors" onClick={() => setShowFullPlayer(false)}>
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lyrics Section in Fullscreen */}
            {currentSongLyrics.length > 0 && (
              <div className="w-full rounded-2xl bg-foreground/5 backdrop-blur-sm p-4 mb-4">
                <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Lirik
                </p>
                <div ref={fullPlayerLyricsRef} className="max-h-60 overflow-y-auto space-y-1 scroll-smooth">
                  {isPlaying && currentSongLyrics.length > 0 && currentTime < currentSongLyrics[0].time_seconds && (
                    <p className="text-sm py-1 px-3 rounded-lg text-primary font-bold text-center animate-pulse">♪♪♪</p>
                  )}
                  {currentSongLyrics.map((line, i) => {
                    const isActive = activeLyricIndex === i;
                    const isInstrumental = !line.text || line.text.trim() === "" || /^[♪♫🎵🎶\s]+$/.test(line.text.trim());
                    return (
                      <p
                        key={line.id}
                        data-lyric-index={i}
                        className={`text-sm py-1 px-3 rounded-lg transition-all duration-300 ${
                          isActive
                            ? isInstrumental
                              ? "text-primary font-bold text-center animate-pulse text-base"
                              : "text-primary font-extrabold text-base"
                            : "text-muted-foreground/70"
                        } ${isInstrumental ? "text-center italic" : ""}`}
                      >
                        {isInstrumental ? "♪♪♪" : line.text}
                      </p>
                    );
                  })}
                  {isPlaying && activeLyricIndex === currentSongLyrics.length - 1 && currentTime > currentSongLyrics[currentSongLyrics.length - 1].time_seconds + 5 && (
                    <p className="text-sm py-1 px-3 rounded-lg text-primary/60 text-center animate-pulse italic">♪♪♪</p>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      , document.body)}

      {/* Lyrics Display */}
      {currentSong && (
        <Card className="border-primary/20 overflow-hidden">
          <CardContent className="p-4 space-y-1">
            <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 mb-2"><Type className="w-3.5 h-3.5" /> Lirik - {currentSong.title}</p>
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
                  <Copyright className="w-3 h-3" /> {currentSong.artist} - Hak cipta dilindungi
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

      {/* ===== REKOMENDASI UNTUKMU - Premium Aurora ===== */}
      {activeView === "playlist" && !viewingPlaylist && (
        <div className="relative rounded-2xl p-[1.5px] overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(var(--neon-purple)/0.85), hsl(var(--neon-pink)/0.85) 50%, hsl(var(--neon-cyan)/0.85))",
            backgroundSize: "300% 300%",
            animation: "aurora-shift 9s ease infinite",
          }}
        >
          <div className="relative rounded-[14px] bg-background/85 backdrop-blur-xl p-3.5 overflow-hidden">
            {/* Glow blobs */}
            <div className="pointer-events-none absolute -top-10 -left-8 w-32 h-32 rounded-full blur-3xl opacity-40" style={{ background: "hsl(var(--neon-purple)/0.6)" }} />
            <div className="pointer-events-none absolute -bottom-10 -right-8 w-36 h-36 rounded-full blur-3xl opacity-30" style={{ background: "hsl(var(--neon-pink)/0.6)" }} />

            {/* Header */}
            <div className="relative flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-md opacity-70" style={{ background: "linear-gradient(135deg, hsl(var(--neon-purple)), hsl(var(--neon-pink)))" }} />
                  <div className="relative w-8 h-8 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, hsl(var(--neon-purple)), hsl(var(--neon-pink)))" }}>
                    <Sparkles className="w-4 h-4 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-extrabold tracking-tight bg-clip-text text-transparent leading-tight"
                    style={{ backgroundImage: "linear-gradient(135deg, hsl(var(--neon-pink)), hsl(var(--neon-cyan)))" }}>
                    Rekomendasi Untukmu
                  </p>
                  <p className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                    <span className="inline-flex w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "hsl(var(--neon-cyan))", boxShadow: "0 0 6px hsl(var(--neon-cyan))" }} />
                    AI Powered · Personal
                  </p>
                </div>
              </div>
              <button
                onClick={fetchAiRecommendations}
                disabled={loadingRecs}
                className="relative h-7 px-2.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--neon-purple)), hsl(var(--neon-pink)))",
                  boxShadow: "0 0 12px hsl(var(--neon-pink)/0.5), 0 2px 8px hsl(var(--neon-purple)/0.3)",
                }}
              >
                {!loadingRecs && (
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: "shine-sweep 3s ease-in-out infinite" }} />
                )}
                {loadingRecs ? <Loader2 className="w-3 h-3 animate-spin relative" /> : <Sparkles className="w-3 h-3 relative drop-shadow-[0_0_3px_rgba(255,255,255,0.8)]" />}
                <span className="relative">{loadingRecs ? "Memuat..." : "Refresh"}</span>
              </button>
            </div>

            {/* Content */}
            {loadingRecs && recommendedSongs.length === 0 ? (
              <div className="relative flex flex-col items-center justify-center py-8 gap-2">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full blur-xl opacity-60" style={{ background: "hsl(var(--neon-pink)/0.6)" }} />
                  <div className="relative w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--neon-purple)/0.3), hsl(var(--neon-pink)/0.3))" }}>
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "hsl(var(--neon-pink))" }} />
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground">Menyiapkan kurasi pribadimu...</span>
              </div>
            ) : recommendedSongs.length > 0 ? (
              <div className="relative flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide snap-x snap-mandatory">
                {recommendedSongs.map((song, i) => {
                  const palette = ["var(--neon-pink)", "var(--neon-cyan)", "var(--neon-purple)", "var(--neon-yellow)", "var(--neon-green)"];
                  const color = palette[i % palette.length];
                  const isLiked = likedSongIds.has(song.id);
                  const isPlaying = currentSong?.id === song.id;
                  return (
                    <div
                      key={song.id}
                      className="relative min-w-[148px] max-w-[148px] shrink-0 rounded-2xl p-[1px] overflow-hidden cursor-pointer transition-all hover:scale-[1.04] hover:-translate-y-0.5 group snap-start"
                      style={{ background: `linear-gradient(135deg, hsl(${color}/0.7), hsl(${color}/0.15))` }}
                      onClick={() => {
                        const idx = songs.findIndex(s => s.id === song.id);
                        if (idx >= 0) playSong(idx);
                      }}
                    >
                      <div className="relative rounded-[15px] bg-background/85 backdrop-blur-xl p-2 space-y-1.5 overflow-hidden h-full">
                        <div className="pointer-events-none absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity" style={{ background: `hsl(${color}/0.6)` }} />

                        <div className="relative w-full aspect-square rounded-xl overflow-hidden ring-1" style={{ boxShadow: `0 0 12px hsl(${color}/0.4)`, background: `linear-gradient(135deg, hsl(${color}/0.2), hsl(${color}/0.05))` }}>
                          {song.cover_url ? (
                            <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-9 h-9" style={{ color: `hsl(${color}/0.6)` }} />
                            </div>
                          )}

                          {/* AI badge */}
                          <div className="absolute top-1 left-1 px-1.5 h-5 rounded-full flex items-center gap-0.5 backdrop-blur-md" style={{ background: `hsl(${color}/0.85)`, boxShadow: `0 0 6px hsl(${color}/0.6)` }}>
                            <Sparkles className="w-2.5 h-2.5 text-white drop-shadow-[0_0_3px_rgba(255,255,255,0.9)]" />
                            <span className="text-[8px] font-extrabold text-white tracking-wider">AI</span>
                          </div>

                          {/* Like button */}
                          <button
                            onClick={(e) => toggleLikeSong(song.id, e)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-transform"
                            style={isLiked ? { boxShadow: "0 0 8px hsl(var(--neon-pink)/0.6)" } : undefined}
                          >
                            <Heart className={`w-3.5 h-3.5 transition-all ${isLiked ? "fill-current scale-110" : "text-muted-foreground"}`} style={isLiked ? { color: "hsl(var(--neon-pink))" } : undefined} />
                          </button>

                          {/* Playing indicator overlay */}
                          {isPlaying && (
                            <div className="absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-1 gap-0.5">
                              {[0, 1, 2].map(b => (
                                <span key={b} className="w-1 rounded-full" style={{
                                  background: `hsl(${color})`,
                                  boxShadow: `0 0 4px hsl(${color})`,
                                  height: "10px",
                                  animation: `wave-bounce 0.9s ease-in-out ${b * 0.15}s infinite`,
                                  transformOrigin: "bottom",
                                }} />
                              ))}
                            </div>
                          )}
                        </div>

                        <p className="relative text-[11px] font-bold truncate leading-tight">{song.title}</p>
                        <p className="relative text-[9px] text-muted-foreground truncate font-semibold -mt-0.5">{song.artist}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="relative rounded-xl border border-dashed border-white/10 bg-background/40 backdrop-blur-sm p-5 text-center">
                <div className="w-10 h-10 rounded-2xl mx-auto mb-2 flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--neon-purple)/0.2), hsl(var(--neon-pink)/0.2))" }}>
                  <Sparkles className="w-5 h-5" style={{ color: "hsl(var(--neon-pink))" }} />
                </div>
                <p className="text-[11px] font-semibold text-muted-foreground">Belum ada rekomendasi.</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Tekan tombol Refresh untuk mulai kurasi.</p>
              </div>
            )}

            {/* Footer hint */}
            <div className="relative flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-white/5">
              <Sparkles className="w-2.5 h-2.5" style={{ color: "hsl(var(--neon-cyan))" }} />
              <p className="text-[9px] text-muted-foreground font-semibold tracking-wide">
                Dipilih otomatis dari selera & katalog tersedia
              </p>
              <Sparkles className="w-2.5 h-2.5" style={{ color: "hsl(var(--neon-pink))" }} />
            </div>
          </div>
        </div>
      )}

      {/* ===== ALL SONGS VIEW ===== */}
      {activeView === "playlist" && !viewingPlaylist && renderSongList(songs)}

      {/* ===== LIKED SONGS HISTORY VIEW ===== */}
      {activeView === "liked" && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-destructive" /> Lagu yang Disukai ({likedSongIds.size})
          </p>
          {likedSongIds.size === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <Heart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Belum ada lagu yang disukai</p>
                <p className="text-[11px] text-muted-foreground mt-1">Ketuk ❤️ pada lagu untuk menambahkan ke daftar suka</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                {songs.filter(s => likedSongIds.has(s.id)).map((song) => {
                  const globalIdx = songs.findIndex(s => s.id === song.id);
                  const isCached = cachedIds.has(song.id);
                  return (
                    <Card key={song.id} className={`overflow-hidden transition-all cursor-pointer hover:shadow-md ${currentSong?.id === song.id ? "border-primary/40 bg-primary/5" : ""}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <button onClick={() => playSong(globalIdx)} className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors relative overflow-hidden">
                          {song.cover_url ? <img src={song.cover_url} alt="" className="w-full h-full object-cover absolute inset-0" /> : currentSong?.id === song.id && isPlaying ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
                          {song.cover_url && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              {currentSong?.id === song.id && isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                            </div>
                          )}
                        </button>
                        <div className="flex-1 min-w-0" onClick={() => playSong(globalIdx)}>
                          <p className="font-bold text-sm truncate">{song.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{song.artist}</p>
                        </div>
                        <button onClick={(e) => toggleLikeSong(song.id, e)} className="shrink-0 p-1">
                          <Heart className="w-4 h-4 fill-destructive text-destructive transition-colors" />
                        </button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">Ketuk ❤️ untuk menghapus dari daftar suka</p>
            </>
          )}
        </div>
      )}

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
                <Card key={pl.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setViewingPlaylist(pl); try { const vid = localStorage.getItem("visitor_id"); if (vid) supabase.rpc("bump_music_quest_event" as any, { p_visitor_id: vid, p_quest_type: "play_playlist" }); } catch {} }}>

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
          <div className="relative rounded-2xl p-[1.5px] shadow-[0_18px_50px_-15px_rgba(217,70,239,0.7)]"
            style={{
              background: isAtLimit
                ? "linear-gradient(120deg, #ef4444, #f97316, #ef4444)"
                : isNearLimit
                  ? "linear-gradient(120deg, #f59e0b, #eab308, #f59e0b)"
                  : "linear-gradient(120deg, #ec4899, #a855f7, #6366f1, #06b6d4, #ec4899)",
              backgroundSize: "300% 300%",
              animation: "aurora-shift 8s ease infinite",
            }}
          >
            <div className="relative overflow-hidden rounded-[14px] bg-gradient-to-br from-[#1a0b2e]/95 via-[#2a0f47]/95 to-[#0f0a3d]/95 backdrop-blur-xl">
              {/* Glow blobs */}
              <div className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-fuchsia-500/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -right-8 w-44 h-44 rounded-full bg-indigo-500/25 blur-3xl" />
              <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none"
                style={{ animation: "shine-sweep 6s linear infinite" }} />

              <div className="relative p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute inset-0 rounded-lg bg-pink-500/40 blur-md" />
                      <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_12px_rgba(236,72,153,0.7)]">
                        <HardDrive className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-fuchsia-300/80 font-bold">Cloud Storage</div>
                      <div className="text-sm font-black text-white drop-shadow-[0_1px_4px_rgba(236,72,153,0.5)]">Penyimpanan Offline</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border ${hasSubs ? "bg-gradient-to-r from-amber-500/30 to-yellow-500/30 border-amber-400/60 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-white/10 border-white/20 text-white/80"}`}>
                    {hasSubs ? <Crown className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    {hasSubs ? formatStorageSize(maxBytes) : "Free 2GB"}
                  </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-gradient-to-br from-pink-500/15 to-fuchsia-500/5 p-2.5 border border-pink-400/20 text-center backdrop-blur-sm">
                    <p className="text-[9px] uppercase tracking-wider text-pink-200/70 font-bold">Total</p>
                    <p className="text-lg font-black text-white tabular-nums">{songs.length}</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/5 p-2.5 border border-emerald-400/20 text-center backdrop-blur-sm">
                    <p className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-bold flex items-center justify-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Offline</p>
                    <p className="text-lg font-black text-emerald-300 tabular-nums">{cachedCount}</p>
                  </div>
                  <div className={`rounded-xl bg-gradient-to-br ${isAtLimit ? "from-red-500/20 to-rose-500/10 border-red-400/30" : isNearLimit ? "from-amber-500/20 to-yellow-500/10 border-amber-400/30" : "from-cyan-500/15 to-blue-500/5 border-cyan-400/20"} p-2.5 border text-center backdrop-blur-sm`}>
                    <p className="text-[9px] uppercase tracking-wider text-white/70 font-bold flex items-center justify-center gap-0.5"><HardDrive className="w-2.5 h-2.5" /> Pakai</p>
                    <p className={`text-sm font-black tabular-nums ${isAtLimit ? "text-red-300" : isNearLimit ? "text-amber-300" : "text-cyan-200"}`}>{formatStorageSize(downloadedStorage)}</p>
                  </div>
                </div>

                {/* Progress with glow + percent badge */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-white/70">{formatStorageSize(downloadedStorage)} / {formatStorageSize(maxBytes)}</span>
                    <span className={`px-1.5 py-0.5 rounded-full tabular-nums ${isAtLimit ? "bg-red-500/30 text-red-100 border border-red-400/40" : isNearLimit ? "bg-amber-500/30 text-amber-100 border border-amber-400/40" : "bg-fuchsia-500/30 text-fuchsia-100 border border-fuchsia-400/40"}`}>
                      {Math.round(storagePercent)}%
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-white/10 overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-500 ${isAtLimit ? "bg-gradient-to-r from-red-400 to-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]" : isNearLimit ? "bg-gradient-to-r from-amber-400 to-yellow-500 shadow-[0_0_10px_rgba(245,158,11,0.7)]" : "bg-gradient-to-r from-pink-400 via-fuchsia-400 to-cyan-300 shadow-[0_0_10px_rgba(236,72,153,0.7)]"}`}
                      style={{ width: `${storagePercent}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style={{ animation: "shine-sweep 2.5s linear infinite" }} />
                    </div>
                  </div>
                </div>

                <Button size="sm" className="w-full gap-2 text-xs font-bold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white border-0 shadow-[0_8px_24px_-4px_rgba(236,72,153,0.6)]" onClick={() => setUpgradeOpen(true)}>
                  <Zap className="w-3.5 h-3.5" />
                  {hasSubs ? "Tambah / Upgrade Penyimpanan" : "✨ Upgrade Penyimpanan"}
                </Button>
              </div>
            </div>
          </div>

          {/* Redeem Storage Voucher */}
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold flex items-center gap-1.5"><Ticket className="w-4 h-4 text-primary" /> Klaim Voucher Penyimpanan</p>
              <p className="text-[10px] text-muted-foreground">Masukkan kode voucher dari admin untuk mendapatkan tambahan penyimpanan gratis.</p>
              <div className="flex gap-2">
                <Input placeholder="Masukkan kode voucher" value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} className="font-mono text-xs flex-1" />
                <Button size="sm" onClick={redeemStorageVoucher} disabled={redeeming || !redeemCode.trim()} className="gap-1 shrink-0">
                  {redeeming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                  Klaim
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Redeemed Storage History */}
          {redeemedStorages.length > 0 && (
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-primary" /> Penyimpanan dari Voucher</p>
                {redeemedStorages.map(rs => {
                  const isExpired = rs.expires_at && new Date(rs.expires_at) < new Date();
                  const storageMb = rs.storage_mb;
                  const label = storageMb >= 1024 * 1024 ? `${(storageMb / (1024 * 1024)).toFixed(0)} TB` : storageMb >= 1024 ? `${(storageMb / 1024).toFixed(0)} GB` : `${storageMb} MB`;
                  const daysLeft = rs.expires_at ? Math.max(0, Math.ceil((new Date(rs.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
                  return (
                    <div key={rs.id} className={`flex items-center justify-between text-[11px] rounded-lg px-3 py-2 border ${isExpired ? "bg-destructive/5 border-destructive/20 opacity-60" : "bg-primary/5 border-primary/10"}`}>
                      <div>
                        <span className="font-bold">+{label}</span>
                        <span className="text-muted-foreground ml-1">• {rs.voucher_code}</span>
                      </div>
                      <div className="text-[10px] flex items-center gap-1">
                        {isExpired
                          ? <span className="text-destructive font-bold">Expired</span>
                          : daysLeft !== null
                            ? <><Clock className="w-3 h-3 text-muted-foreground" /><span className={`font-semibold ${daysLeft <= 3 ? "text-destructive" : "text-muted-foreground"}`}>{daysLeft}h lagi</span></>
                            : <span className="text-muted-foreground">Permanen</span>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

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
            {storagePlans.map((plan, idx) => (
              <div key={plan.name} onClick={() => setSelectedPlanIndex(idx)} className={`rounded-xl border-2 p-3 cursor-pointer transition-all ${selectedPlanIndex === idx ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-bold flex items-center gap-1"><Crown className="w-4 h-4 text-primary" /> {plan.name}</p><p className="text-xs text-muted-foreground">+{formatStorageSize(plan.addBytes)} selama 30 hari</p></div>
                  <span className="text-sm font-extrabold text-primary">{formatCurrency(plan.pricePerMonth)}/bln</span>
                </div>
              </div>
            ))}
            {/* Discount Code */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" /> Kode Diskon (opsional)</p>
              <div className="flex gap-2">
                <Input placeholder="Masukkan kode diskon" value={upgradeDiscountCode} onChange={e => { setUpgradeDiscountCode(e.target.value.toUpperCase()); setUpgradeDiscountAmount(0); }} className="font-mono text-xs flex-1" />
                <Button size="sm" variant="outline" onClick={applyMusicDiscount} disabled={!upgradeDiscountCode.trim()} className="shrink-0 text-xs">Pakai</Button>
              </div>
              {upgradeDiscountAmount > 0 && (
                <p className="text-[10px] text-primary font-bold">✅ Diskon Rp{upgradeDiscountAmount.toLocaleString()} diterapkan!</p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              💡 Saldo dipotong {formatCurrency(Math.max(0, (storagePlans[selectedPlanIndex]?.pricePerMonth || 0) - upgradeDiscountAmount))}
              {upgradeDiscountAmount > 0 && <span className="line-through ml-1 text-muted-foreground/50">{formatCurrency(storagePlans[selectedPlanIndex]?.pricePerMonth || 0)}</span>}
              . Paket berlaku 30 hari.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Batal</Button>
            <Button onClick={attemptUpgrade} disabled={upgrading || !isOnline} className="gap-2">
              {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {upgrading ? "Memproses..." : "Beli Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Verification Dialog for Upgrade */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Verifikasi PIN</DialogTitle>
            <DialogDescription>Masukkan PIN untuk konfirmasi pembelian penyimpanan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-center gap-2">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className={`w-8 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-bold ${i < upgradePinInput.length ? "border-primary bg-primary/10" : "border-border"}`}>
                  {i < upgradePinInput.length ? "•" : ""}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <Button key={n} variant="outline" className="h-12 text-lg font-bold" onClick={() => upgradePinInput.length < 6 && setUpgradePinInput(prev => prev + n)}>
                  {n}
                </Button>
              ))}
              <div />
              <Button variant="outline" className="h-12 text-lg font-bold" onClick={() => upgradePinInput.length < 6 && setUpgradePinInput(prev => prev + "0")}>0</Button>
              <Button variant="outline" className="h-12 text-lg font-bold" onClick={() => setUpgradePinInput(prev => prev.slice(0, -1))}>←</Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={confirmPinAndUpgrade} disabled={upgradePinInput.length < 4} className="w-full gap-2">
              <Lock className="w-4 h-4" /> Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogTitle className="text-sm">Kelola Lagu - {managingUserPl?.name}</DialogTitle>
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




      {/* ===== ARTIST VIEW ===== */}
      {activeView === "artist" && (
        <ArtistTab onPlaySong={(song) => {
          const idx = songs.findIndex(s => s.id === song.id);
          if (idx >= 0) { playSong(idx); }
          else {
            const audio = audioRef.current;
            if (audio) {
              audio.src = song.file_url;
              audio.play().catch(() => {});
              setIsPlaying(true);
            }
          }
        }} />
      )}

      {/* Audio Device Detector */}
      {activeView === "playlist" && <AudioDeviceDetector />}

      {/* Terms & Privacy Dialog */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><FileText className="w-5 h-5 text-primary" /> Syarat & Ketentuan Playlist</DialogTitle>
            <DialogDescription>
              Aturan penggunaan playlist, rekomendasi lagu, offline, privasi, dan hak cipta dalam aplikasi musik ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-xs text-muted-foreground">
            <div>
              <p className="font-bold text-foreground text-sm mb-1">📋 Syarat & Ketentuan Umum</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Layanan playlist musik disediakan untuk penggunaan pribadi dan non-komersial.</li>
                <li>Pengguna dapat membuat playlist pribadi yang hanya dapat diakses oleh pengguna itu sendiri.</li>
                <li>Playlist publik dikelola oleh admin dan dapat dinikmati semua pengguna.</li>
                <li>Penyimpanan offline tunduk pada batas kuota yang berlaku (Free 2GB, atau sesuai paket aktif).</li>
                <li>Admin berhak menghapus, mengubah, atau menambahkan konten musik kapan saja tanpa pemberitahuan sebelumnya.</li>
                <li>Dilarang mendistribusikan ulang, menjual, atau menggunakan musik untuk keperluan komersial.</li>
                <li>Dilarang membagikan akun, link download, atau konten musik ke pihak lain.</li>
                <li>Pengguna bertanggung jawab atas aktivitas yang dilakukan di akun atau perangkat masing-masing.</li>
                <li>Layanan dapat diperbarui, dihentikan sementara, atau diubah sesuai kebutuhan operasional.</li>
                <li>Pengguna wajib menggunakan layanan secara wajar dan tidak merusak sistem.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🎵 Ketentuan Penggunaan Playlist</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Playlist pribadi dibuat berdasarkan data perangkat yang sedang digunakan.</li>
                <li>Lagu dalam playlist dapat berubah sewaktu-waktu mengikuti pembaruan katalog.</li>
                <li>Pengguna dapat membuat, mengganti nama, menghapus, dan mengatur isi playlist pribadi.</li>
                <li>Playlist publik hanya dapat diatur oleh admin.</li>
                <li>Urutan lagu, repeat, shuffle, dan pemutaran ulang bergantung pada fitur yang tersedia di aplikasi.</li>
                <li>Fitur download ke perangkat dan simpan offline dapat memiliki perilaku berbeda tergantung browser.</li>
                <li>Lirik yang tampil tidak selalu tersedia untuk semua lagu.</li>
                <li>Pengguna dilarang merekam ulang, mengekstrak, atau menyebarkan audio dari aplikasi.</li>
                <li>Playlist pribadi tidak dijamin berpindah otomatis ke perangkat lain.</li>
                <li>Like lagu hanya berfungsi sebagai sinyal preferensi dan riwayat favorit.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🤖 Ketentuan Fitur Rekomendasi</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Fitur “Rekomendasi Untukmu” memilih lagu secara otomatis berdasarkan katalog dan sinyal preferensi pengguna.</li>
                <li>Rekomendasi dapat menggunakan teknologi AI atau sistem fallback otomatis saat layanan AI tidak tersedia.</li>
                <li>Hasil rekomendasi tidak menjamin kecocokan sempurna dengan selera setiap pengguna.</li>
                <li>Daftar rekomendasi dapat berubah setelah pengguna menyukai atau menghapus suka dari lagu tertentu.</li>
                <li>Admin tidak menjamin lagu yang direkomendasikan akan selalu tersedia permanen di katalog.</li>
                <li>Rekomendasi tidak boleh dianggap sebagai saran profesional, kurasi editorial resmi, atau jaminan kualitas artistik.</li>
                <li>Penggunaan berlebihan terhadap tombol refresh dapat dibatasi untuk menjaga performa layanan.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">💰 Ketentuan Paket Penyimpanan</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Paket penyimpanan berlaku sesuai durasi yang ditetapkan sejak pembelian aktif.</li>
                <li>Paket yang sudah aktif tidak dapat dibatalkan atau dikembalikan dananya.</li>
                <li>Jika masa aktif paket berakhir, akses offline dapat menyesuaikan dengan kuota gratis yang tersedia.</li>
                <li>Harga, kapasitas, dan masa aktif paket dapat berubah sewaktu-waktu.</li>
                <li>Pembelian paket menggunakan saldo yang tersedia pada akun atau identitas pengguna terkait.</li>
                <li>Voucher gratis dan kode diskon tunduk pada batas waktu, batas penggunaan, dan syarat admin.</li>
                <li>Kode promo yang tidak valid, kedaluwarsa, atau habis kuotanya akan ditolak otomatis.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">📱 Ketentuan Penggunaan Offline</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Lagu yang disimpan offline hanya dimaksudkan untuk pemutaran di dalam aplikasi ini.</li>
                <li>Data offline disimpan pada cache browser dan dapat hilang jika cache dibersihkan atau aplikasi dihapus.</li>
                <li>Ketersediaan offline dipengaruhi oleh ruang penyimpanan perangkat, kuota paket, dan dukungan browser.</li>
                <li>Kecepatan download tergantung koneksi internet dan ukuran file musik.</li>
                <li>Jika lagu dihapus dari katalog, versi offline mungkin tidak lagi tersedia atau dapat berhenti berfungsi.</li>
                <li>Pengguna bertanggung jawab menjaga perangkat tetap memiliki ruang penyimpanan yang cukup.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🔒 Privasi & Data Pengguna</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Playlist pribadi dan data musik pengguna dapat dikaitkan dengan visitor ID unik pada perangkat.</li>
                <li>Kami berupaya meminimalkan pengumpulan data pribadi untuk fitur playlist.</li>
                <li>Riwayat suka lagu digunakan untuk meningkatkan pengalaman rekomendasi.</li>
                <li>Data cache offline tersimpan lokal pada perangkat pengguna.</li>
                <li>Statistik penggunaan dapat dicatat secara anonim untuk peningkatan kualitas layanan.</li>
                <li>Informasi perangkat yang ditampilkan hanya bersifat informatif dan bisa berubah tergantung dukungan browser.</li>
                <li>Pengguna bertanggung jawab atas keamanan perangkat yang digunakan untuk mengakses playlist.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">©️ Hak Cipta Musik</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Semua lagu, lirik, cover art, dan metadata tetap menjadi milik pemegang hak masing-masing.</li>
                <li>Penggunaan musik dibatasi untuk streaming atau pemutaran pribadi dalam aplikasi.</li>
                <li>Lirik disediakan untuk referensi dan hiburan, bukan untuk distribusi ulang.</li>
                <li>Jika Anda pemegang hak cipta dan ingin konten dihapus, silakan hubungi admin atau dukungan.</li>
                <li>Aplikasi tidak mengklaim kepemilikan atas karya musik yang tersedia di katalog.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">📶 Batasan Teknis Layanan</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Kualitas streaming bergantung pada koneksi internet, perangkat, browser, dan kondisi jaringan.</li>
                <li>Beberapa fitur seperti notifikasi media, background play, atau info perangkat bisa berbeda di tiap browser.</li>
                <li>Kami tidak menjamin seluruh fitur akan berjalan identik di semua perangkat.</li>
                <li>Gangguan jaringan, maintenance, atau pembaruan sistem dapat memengaruhi pemutaran dan rekomendasi.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">⚠️ Pelanggaran & Pembatasan</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Pelanggaran terhadap syarat ini dapat menyebabkan pembatasan sebagian atau seluruh akses fitur playlist.</li>
                <li>Penyalahgunaan voucher, eksploitasi sistem, atau manipulasi kuota dapat dikenakan pemblokiran.</li>
                <li>Distribusi ulang konten musik secara ilegal dapat ditindak sesuai aturan yang berlaku.</li>
                <li>Admin berhak mengambil tindakan tanpa pemberitahuan sebelumnya pada pelanggaran berat.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">📞 Kontak & Dukungan</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Keluhan, pertanyaan, atau masukan dapat disampaikan melalui fitur bantuan yang tersedia di aplikasi.</li>
                <li>Permintaan evaluasi konten atau pelaporan hak cipta akan diproses sesuai antrean dukungan.</li>
                <li>Waktu respons dapat berbeda tergantung volume permintaan dan kompleksitas masalah.</li>
                <li>Tim dukungan dapat meminta verifikasi identitas perangkat sebelum memproses permintaan tertentu.</li>
                <li>Saluran resmi dukungan hanya melalui WhatsApp dan fitur tiket di aplikasi.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🎧 Kualitas Audio & Streaming</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Bitrate audio dapat menyesuaikan secara otomatis berdasarkan kondisi jaringan dan dukungan perangkat.</li>
                <li>Beberapa lagu mungkin tersedia dalam kualitas standar saja, tergantung sumber katalog.</li>
                <li>Pemutaran latar belakang (background play) tergantung kebijakan browser/sistem operasi pengguna.</li>
                <li>Pemutar musik dapat berhenti otomatis bila perangkat memasuki mode hemat daya.</li>
                <li>Mode pesawat akan menonaktifkan streaming, namun lagu offline tetap dapat diputar.</li>
                <li>Volume normalization dan equalizer bawaan perangkat dapat memengaruhi kualitas suara akhir.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🌐 Konektivitas & Sinkronisasi</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Status koneksi (online/offline) dipantau secara realtime untuk menyesuaikan pengalaman pemutaran.</li>
                <li>Sinkronisasi suka, riwayat, dan playlist memerlukan koneksi internet aktif.</li>
                <li>Saat offline, perubahan suka/playlist akan disinkronkan kembali setelah perangkat online.</li>
                <li>Konflik sinkronisasi antar perangkat akan mengikuti data terakhir yang berhasil disimpan ke server.</li>
                <li>Aplikasi tidak menjamin sinkronisasi sempurna pada koneksi yang sangat lambat atau terputus-putus.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">📤 Unggah Lagu Publik (Khusus Musik Publik)</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Pengguna hanya boleh mengunggah lagu yang dimiliki secara sah atau memiliki izin dari pemegang hak cipta.</li>
                <li>Konten publik akan melalui proses moderasi otomatis (auto-check) sebelum tampil ke pengguna lain.</li>
                <li>Admin berhak menolak, menghapus, atau memprivatkan unggahan tanpa pemberitahuan.</li>
                <li>Lagu pribadi tidak akan ditampilkan ke pengguna lain dan hanya dapat diakses oleh pengunggah.</li>
                <li>Konten yang melanggar hukum, mengandung SARA, kekerasan, atau pornografi akan dihapus permanen.</li>
                <li>Pengunggah bertanggung jawab penuh atas seluruh konsekuensi hukum dari materi yang diunggah.</li>
                <li>Ukuran file, format audio, dan durasi lagu mengikuti batasan teknis yang berlaku.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🎤 Lirik & Transkripsi Otomatis</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Lirik dapat dihasilkan otomatis menggunakan teknologi AI (transkripsi) dan tidak selalu 100% akurat.</li>
                <li>Sinkronisasi timestamp lirik bersifat estimasi dan dapat meleset beberapa detik.</li>
                <li>Lirik bahasa daerah, dialek, atau pelafalan tidak baku berpotensi menghasilkan akurasi lebih rendah.</li>
                <li>Pengguna tidak diperkenankan menyalin atau mendistribusikan lirik di luar konteks pemutaran aplikasi.</li>
                <li>Lirik yang salah dapat dilaporkan melalui fitur dukungan untuk koreksi manual.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">❤️ Like, Riwayat & Preferensi</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Tombol Like menyimpan lagu favorit pengguna dan memperkuat sinyal rekomendasi.</li>
                <li>Riwayat putar disimpan secara lokal/akun untuk membantu personalisasi.</li>
                <li>Pengguna dapat membatalkan Like kapan saja, namun jejak riwayat dapat tetap memengaruhi rekomendasi sementara waktu.</li>
                <li>Manipulasi otomatis (bot) terhadap Like dapat menyebabkan reset preferensi atau pemblokiran fitur.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">💳 Pembayaran & Saldo</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Pembelian paket penyimpanan menggunakan saldo internal aplikasi yang telah terverifikasi.</li>
                <li>Saldo yang sudah digunakan untuk paket aktif tidak dapat dikembalikan dalam bentuk dana atau saldo.</li>
                <li>Riwayat transaksi paket dapat dilihat melalui menu riwayat pengguna.</li>
                <li>Pembelian otomatis terkonfirmasi tanpa konfirmasi tambahan; pastikan keputusan sebelum menekan tombol bayar.</li>
                <li>Aplikasi tidak menyimpan data kartu pembayaran pihak ketiga di sisi klien.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🎟️ Voucher & Kode Promo Penyimpanan</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Setiap kode voucher hanya dapat diklaim satu kali per akun/perangkat sesuai kebijakan admin.</li>
                <li>Voucher dapat memiliki masa berlaku terbatas dan akan otomatis kedaluwarsa setelah tanggal habis.</li>
                <li>Penyimpanan tambahan dari voucher diakumulasi ke kuota total selama masih aktif.</li>
                <li>Voucher tidak dapat ditukar dengan saldo, uang tunai, atau dipindahtangankan.</li>
                <li>Admin berhak membatalkan voucher yang diperoleh secara tidak sah atau melalui eksploitasi sistem.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">⏏️ Penghapusan Konten Offline</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Pengguna dapat menghapus lagu offline kapan saja melalui menu penyimpanan.</li>
                <li>Membersihkan cache browser akan menghapus seluruh data offline secara permanen.</li>
                <li>Penghapusan instalasi aplikasi (PWA/Native) dapat menghapus seluruh penyimpanan offline.</li>
                <li>Lagu yang ditarik admin dari katalog akan dihapus otomatis dari penyimpanan offline pada sinkronisasi berikutnya.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🛡️ Keamanan Akun & Perangkat</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Pengguna wajib menjaga kerahasiaan kata sandi, PIN, dan token reset yang dikirim via WhatsApp.</li>
                <li>Aktivitas mencurigakan dapat memicu pemblokiran sementara untuk perlindungan akun.</li>
                <li>Login dari perangkat baru dapat memerlukan verifikasi tambahan.</li>
                <li>Aplikasi tidak meminta password atau OTP melalui telepon atau pihak selain saluran resmi.</li>
                <li>Segera laporkan ke admin bila mendeteksi penggunaan tidak sah atas akun Anda.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">👶 Konten untuk Anak & Pengguna Usia Sensitif</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Sebagian lagu mungkin mengandung lirik dewasa; pengawasan orang tua direkomendasikan.</li>
                <li>Aplikasi tidak menyediakan filter konten otomatis berdasarkan usia.</li>
                <li>Orang tua/wali bertanggung jawab mengatur akses anak terhadap konten musik.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">⚖️ Ketentuan Hukum & Yurisdiksi</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Syarat & ketentuan ini tunduk pada hukum yang berlaku di Republik Indonesia.</li>
                <li>Setiap perselisihan akan diselesaikan secara musyawarah terlebih dahulu sebelum jalur hukum.</li>
                <li>Bila terjadi perubahan regulasi, aplikasi berhak memperbarui ketentuan tanpa pemberitahuan personal.</li>
                <li>Penggunaan layanan secara berkelanjutan dianggap sebagai persetujuan atas perubahan T&C.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm mb-1">🔄 Pembaruan Layanan</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Fitur baru dapat ditambahkan, diubah, atau dihapus sewaktu-waktu untuk peningkatan layanan.</li>
                <li>Pembaruan aplikasi dapat memengaruhi kompatibilitas dengan versi cache offline sebelumnya.</li>
                <li>Pengguna disarankan menggunakan versi aplikasi terbaru untuk pengalaman optimal.</li>
                <li>Admin dapat melakukan reset/migrasi data dengan pemberitahuan minimal di tab pembaruan.</li>
              </ul>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] text-center text-muted-foreground">Dengan menggunakan fitur playlist, Anda dianggap telah membaca dan menyetujui seluruh syarat & ketentuan di atas.</p>
              <p className="text-[10px] text-center text-muted-foreground mt-1">Terakhir diperbarui: April 2026 • Versi 2.0</p>
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

import { Music2, Globe, Users, Sparkles, Headphones, Radio, Mic2, Disc3, Flame, Play, Pause, ChevronUp, TrendingUp, Heart, Crown, Zap, Moon, Sun, Cloud, Coffee, Dumbbell, PartyPopper, Volume2, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import MusicPublicTab from "@/components/MusicPublicTab";
import ArtistTab from "@/components/ArtistTab";
import type { PlaybackState } from "@/components/PlaylistTab";

interface MoodSong { id: string; title: string; artist: string; file_url: string; cover_url: string | null; created_at?: string | null; duration?: number | null; }

const MOODS: { key: string; label: string; icon: typeof Cloud; gradient: string; glow: string; keywords: string[] }[] = [
  { key: "chill", label: "Chill", icon: Cloud, gradient: "from-sky-400 to-blue-500", glow: "56,189,248", keywords: ["chill", "santai", "lo-fi", "lofi", "relax", "acoustic", "akustik", "slow", "galau", "sendu", "rindu", "senja", "hujan", "indie", "jazz", "mellow", "melow"] },
  { key: "party", label: "Pesta", icon: PartyPopper, gradient: "from-fuchsia-500 to-pink-500", glow: "236,72,153", keywords: ["party", "pesta", "dj", "remix", "dance", "edm", "club", "house", "dangdut", "koplo", "jedag", "bass", "disco", "funkot", "beat"] },
  { key: "focus", label: "Fokus", icon: Coffee, gradient: "from-amber-500 to-orange-600", glow: "249,115,22", keywords: ["focus", "fokus", "study", "belajar", "instrumental", "piano", "classic", "klasik", "ambient", "lofi", "lo-fi", "jazz", "acoustic"] },
  { key: "workout", label: "Gym", icon: Dumbbell, gradient: "from-red-500 to-rose-600", glow: "239,68,68", keywords: ["workout", "gym", "rock", "metal", "energy", "energi", "pump", "hip hop", "hiphop", "rap", "trap", "semangat", "power", "speed"] },
  { key: "sleep", label: "Tidur", icon: Moon, gradient: "from-indigo-500 to-purple-600", glow: "139,92,246", keywords: ["sleep", "tidur", "night", "malam", "lullaby", "soft", "calm", "tenang", "piano", "rain", "hujan", "slow", "acoustic", "akustik"] },
  { key: "morning", label: "Pagi", icon: Sun, gradient: "from-yellow-400 to-amber-500", glow: "245,158,11", keywords: ["morning", "pagi", "happy", "sunshine", "pop", "fresh", "bright", "ceria", "upbeat", "semangat", "reggae", "kopi"] },
];

const TRENDING_TAGS = ["🔥 Pop Indo", "🎤 Dangdut Remix", "💎 Lo-Fi Beats", "⚡ EDM Drop", "🎸 Rock Klasik", "🌙 City Pop", "✨ K-Pop Hits", "🎺 Jazz Smooth"];

const normalizeMusicText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const getSongMoodScore = (song: MoodSong, activeMood: typeof MOODS[number]) => {
  const text = normalizeMusicText(`${song.title} ${song.artist}`);
  return activeMood.keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeMusicText(keyword);
    if (!text.includes(normalizedKeyword)) return score;
    return score + (normalizedKeyword.length > 4 ? 12 : 8);
  }, 0);
};

const sortByFreshness = (a: MoodSong, b: MoodSong) => {
  const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
  return dateB - dateA || a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist);
};

export type MusicSubTab = "playlist" | "publik" | "artist";

interface MusicHubProps {
  subTab: MusicSubTab;
  onSubTabChange: (s: MusicSubTab) => void;
  onPlayExternal?: (song: { id: string; title: string; artist: string; file_url: string; cover_url: string | null }) => void;
  playlistSlot: React.ReactNode;
  playbackState?: PlaybackState;
  onTogglePlay?: () => void;
  onOpenFullPlayer?: () => void;
}

const TABS: {
  key: MusicSubTab;
  label: string;
  icon: typeof Music2;
  altIcon: typeof Music2;
  gradient: string;
  glowColor: string;
  ring: string;
  desc: string;
  emoji: string;
  badge: string;
}[] = [
  {
    key: "playlist",
    label: "Playlist",
    icon: Music2,
    altIcon: Headphones,
    gradient: "from-fuchsia-500 via-pink-500 to-rose-500",
    glowColor: "236,72,153",
    ring: "ring-pink-400/60",
    desc: "Lagu resmi pilihan admin",
    emoji: "🎧",
    badge: "HOT",
  },
  {
    key: "publik",
    label: "Publik",
    icon: Globe,
    altIcon: Radio,
    gradient: "from-cyan-400 via-teal-500 to-emerald-500",
    glowColor: "20,184,166",
    ring: "ring-teal-400/60",
    desc: "Lagu komunitas pengguna",
    emoji: "🌍",
    badge: "LIVE",
  },
  {
    key: "artist",
    label: "Artist",
    icon: Users,
    altIcon: Mic2,
    gradient: "from-amber-400 via-orange-500 to-red-500",
    glowColor: "249,115,22",
    ring: "ring-orange-400/60",
    desc: "Jelajahi profil penyanyi",
    emoji: "⭐",
    badge: "NEW",
  },
];

export default function MusicHub({ subTab, onSubTabChange, onPlayExternal, playlistSlot, playbackState, onTogglePlay, onOpenFullPlayer }: MusicHubProps) {
  const active = TABS.find((t) => t.key === subTab)!;
  const nowSong = playbackState?.song ?? null;
  const isPlaying = !!playbackState?.isPlaying;
  const progressPct = playbackState && playbackState.duration > 0
    ? Math.min(100, (playbackState.currentTime / playbackState.duration) * 100)
    : 0;

  const [mood, setMood] = useState<string>("chill");
  const [listenTime, setListenTime] = useState<number>(0);
  const [allSongs, setAllSongs] = useState<MoodSong[]>([]);
  const [loadingMood, setLoadingMood] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => setListenTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isPlaying]);

  // Load semua lagu sekali (untuk filter mood)
  useEffect(() => {
    let mounted = true;
    setLoadingMood(true);
    supabase
      .from("playlist_songs")
      .select("id, title, artist, file_url, cover_url, created_at, duration")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (mounted) {
          setAllSongs((data || []) as MoodSong[]);
          setLoadingMood(false);
        }
      });
    return () => { mounted = false; };
  }, []);

  const activeMood = MOODS.find((m) => m.key === mood)!;
  const moodMatches = useMemo(() => {
    if (allSongs.length === 0) return [];
    return allSongs
      .map((song) => ({ song, score: getSongMoodScore(song, activeMood) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || sortByFreshness(a.song, b.song));
  }, [allSongs, activeMood]);
  const moodSongs = moodMatches.map((item) => item.song).slice(0, 8);
  const moodIsFallback = allSongs.length > 0 && moodSongs.length === 0;

  const playRandomMood = () => {
    if (moodSongs.length === 0) return;
    const currentIndex = nowSong ? moodSongs.findIndex((song) => song.id === nowSong.id) : -1;
    const pick = moodSongs[currentIndex >= 0 && currentIndex < moodSongs.length - 1 ? currentIndex + 1 : 0];
    onPlayExternal?.(pick);
    if (subTab !== "playlist") onSubTabChange("playlist");
  };

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}j ${m}m`;
    if (m > 0) return `${m}m ${sec}d`;
    return `${sec}d`;
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {/* NOW PLAYING BAR — muncul saat ada lagu aktif */}
      <AnimatePresence>
        {nowSong && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="relative overflow-hidden rounded-3xl border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-950/95 via-purple-950/95 to-indigo-950/95 backdrop-blur-xl shadow-[0_12px_36px_-8px_rgba(217,70,239,0.7)]"
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-pink-400/20 to-transparent skew-x-12 pointer-events-none"
            />
            <div className="absolute top-0 inset-x-0 h-0.5 bg-white/10">
              <motion.div
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: "linear" }}
                className="h-full bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400 shadow-[0_0_8px_rgba(236,72,153,0.8)]"
              />
            </div>
            <button
              onClick={() => onOpenFullPlayer?.()}
              className="relative w-full flex items-center gap-4 p-4 text-left"
            >
              <div className="relative flex-shrink-0">
                <motion.div
                  animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                  transition={isPlaying ? { duration: 6, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
                  className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/30 bg-black shadow-[0_0_18px_rgba(217,70,239,0.6)] relative"
                >
                  {nowSong.cover_url ? (
                    <img src={nowSong.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3 h-3 rounded-full bg-black border border-white/40" />
                  </div>
                </motion.div>
                {isPlaying && (
                  <motion.div
                    animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-pink-400 pointer-events-none"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <motion.span
                    animate={{ opacity: isPlaying ? [1, 0.4, 1] : 1 }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="px-2 py-0.5 rounded-md bg-pink-500/30 border border-pink-400/50 text-[10px] font-black text-pink-100 uppercase tracking-wider flex items-center gap-1"
                  >
                    <span className={`w-1 h-1 rounded-full ${isPlaying ? "bg-green-400" : "bg-amber-400"}`} />
                    {isPlaying ? "Playing" : "Paused"}
                  </motion.span>
                  {isPlaying && (
                    <div className="flex items-end gap-[3px] h-4">
                      {[0.5, 0.9, 0.4, 0.8].map((h, i) => (
                        <motion.div
                          key={i}
                          animate={{ scaleY: [h, 1, h * 0.5, h] }}
                          transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }}
                          style={{ transformOrigin: "bottom" }}
                          className="w-[3px] h-full bg-gradient-to-t from-pink-400 to-fuchsia-300 rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold text-white truncate leading-tight">{nowSong.title}</p>
                <p className="text-xs text-white/70 truncate mt-0.5">{nowSong.artist}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <motion.span
                  whileTap={{ scale: 0.85 }}
                  onClick={(e) => { e.stopPropagation(); onTogglePlay?.(); }}
                   className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-pink-500/50 cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" fill="currentColor" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                  )}
                </motion.span>
                <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                  <ChevronUp className="w-4 h-4 text-white/80" />
                </span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO — Vinyl + neon + waveform */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
        {/* Animated gradient bg */}
        <motion.div
          key={subTab}
          initial={{ opacity: 0, scale: 1.15, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`absolute inset-0 bg-gradient-to-br ${active.gradient}`}
        />
        {/* Dark overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

        {/* Animated mesh blobs */}
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-16 -right-12 w-48 h-48 bg-white/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -15, 0], y: [0, 15, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute -bottom-16 -left-12 w-44 h-44 bg-black/40 rounded-full blur-3xl"
        />

        {/* Star sparkle field */}
        <div
          className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(1.5px 1.5px at 20% 30%, white, transparent), radial-gradient(1px 1px at 70% 60%, white, transparent), radial-gradient(1.5px 1.5px at 40% 80%, white, transparent), radial-gradient(1px 1px at 90% 20%, white, transparent), radial-gradient(1.5px 1.5px at 50% 50%, white, transparent)",
            backgroundSize: "200px 200px",
          }}
        />

        {/* Scan line shimmer */}
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
        />

        <div className="relative p-4 flex items-center gap-3">
          {/* VINYL DISC — spinning 3D */}
          <motion.div
            key={`vinyl-${subTab}`}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="relative flex-shrink-0"
            style={{ filter: `drop-shadow(0 0 20px rgba(${active.glowColor},0.7))` }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="relative w-16 h-16 rounded-full bg-gradient-to-br from-zinc-800 via-black to-zinc-900 border-2 border-white/30 flex items-center justify-center"
            >
              {/* Vinyl grooves */}
              <div className="absolute inset-1 rounded-full border border-white/10" />
              <div className="absolute inset-2 rounded-full border border-white/10" />
              <div className="absolute inset-3 rounded-full border border-white/10" />
              {/* Center label */}
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${active.gradient} flex items-center justify-center border border-white/40`}>
                <div className="w-1.5 h-1.5 rounded-full bg-black" />
              </div>
              {/* Light reflection */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
            </motion.div>
            {/* Floating sparkles around vinyl */}
            <motion.div
              animate={{ y: [-2, -8, -2], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1"
            >
              <Sparkles className="w-4 h-4 text-yellow-300 drop-shadow-glow" fill="currentColor" />
            </motion.div>
            <motion.div
              animate={{ y: [0, -6, 0], opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
              className="absolute -bottom-1 -left-1"
            >
              <Disc3 className="w-3 h-3 text-white/80" />
            </motion.div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-monoton text-3xl tracking-[0.15em] text-white music-neon-glow">
                PUSAT MUSIK
              </h2>

              <motion.span
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-lg"
              >
                {active.emoji}
              </motion.span>
              {/* Live badge */}
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="px-1.5 py-0.5 rounded-md bg-white/20 backdrop-blur text-[8px] font-black text-white border border-white/40 flex items-center gap-0.5"
              >
                <Flame className="w-2 h-2" fill="currentColor" />
                {active.badge}
              </motion.span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={subTab}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.3 }}
                className="text-[11px] text-white/95 mt-0.5 truncate font-semibold"
              >
                {active.desc}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* WAVEFORM Equalizer */}
          <div className="flex items-center gap-0.5 h-10 flex-shrink-0">
            {[0.3, 0.7, 0.5, 0.9, 0.4, 0.8, 0.6].map((h, i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [h, 1, h * 0.5, h * 0.8, h] }}
                transition={{
                  duration: 0.7 + i * 0.08,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.06,
                }}
                style={{ transformOrigin: "center" }}
                className="w-1 h-full bg-gradient-to-t from-white/40 via-white to-white/80 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)]"
              />
            ))}
          </div>
        </div>

        {/* Bottom marquee strip */}
        <div className="relative border-t border-white/15 bg-black/30 backdrop-blur-sm overflow-hidden h-6">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="flex items-center gap-6 whitespace-nowrap text-[10px] font-bold text-white/80 absolute inset-y-0"
          >
            {Array.from({ length: 2 }).map((_, dup) => (
              <div key={dup} className="flex items-center gap-6 px-3">
                <span className="flex items-center gap-1">🎵 Now Playing</span>
                <span className="flex items-center gap-1">✨ Premium Sound</span>
                <span className="flex items-center gap-1">🔥 Trending Now</span>
                <span className="flex items-center gap-1">🎤 Top Artist</span>
                <span className="flex items-center gap-1">💎 HD Quality</span>
                <span className="flex items-center gap-1">🌍 Komunitas</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* PILL TABS — neon glass with shine */}
      <div
        className="relative rounded-2xl bg-card/70 backdrop-blur-xl border border-border p-1.5 shadow-lg overflow-hidden"
        style={{ boxShadow: `0 8px 30px -10px rgba(${active.glowColor},0.4)` }}
      >
        {/* Subtle gradient tint */}
        <div className={`absolute inset-0 bg-gradient-to-r ${active.gradient} opacity-5 pointer-events-none`} />

        <div className="relative grid grid-cols-3 gap-1">
          {TABS.map(({ key, label, icon: Icon, gradient, ring, glowColor }) => {
            const isActive = subTab === key;
            return (
              <button
                key={key}
                onClick={() => onSubTabChange(key)}
                className="relative py-2.5 px-1 rounded-xl transition-all overflow-hidden group"
              >
                {isActive && (
                  <>
                    <motion.div
                      layoutId="active-music-tab"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} ring-2 ${ring}`}
                      style={{ boxShadow: `0 6px 20px -4px rgba(${glowColor},0.7)` }}
                    />
                    {/* Shine sweep */}
                    <motion.div
                      animate={{ x: ["-150%", "250%"] }}
                      transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
                      className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 rounded-xl"
                    />
                  </>
                )}
                <span
                  className={`relative flex items-center justify-center gap-1.5 text-xs font-extrabold transition-colors ${
                    isActive ? "text-white drop-shadow-lg" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  <motion.span
                    animate={isActive ? { rotate: [0, -10, 10, 0] } : {}}
                    transition={{ duration: 0.6 }}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2.6 : 2} />
                  </motion.span>
                  {label}
                </span>
                {isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,1)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MUSIC STATS BAR — 4 mini stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Volume2, label: "Sesi", value: fmtTime(listenTime), color: "from-cyan-400 to-blue-500", glow: "59,130,246" },
          { icon: TrendingUp, label: "Trending", value: "127", color: "from-fuchsia-500 to-pink-500", glow: "236,72,153" },
          { icon: Heart, label: "Liked", value: "∞", color: "from-rose-400 to-red-500", glow: "239,68,68" },
          { icon: Crown, label: "Top", value: "HD", color: "from-amber-400 to-orange-500", glow: "245,158,11" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 220 }}
            whileHover={{ y: -3, scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/80 backdrop-blur-md p-2 cursor-pointer"
            style={{ boxShadow: `0 4px 14px -4px rgba(${s.glow},0.35)` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-10`} />
            <div className={`absolute -top-4 -right-4 w-12 h-12 rounded-full bg-gradient-to-br ${s.color} opacity-30 blur-xl`} />
            <div className="relative flex flex-col items-center gap-0.5">
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                <s.icon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</span>
              <span className="text-xs font-black text-foreground tabular-nums">{s.value}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* MOOD SELECTOR — pilih suasana */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/50 via-card to-fuchsia-950/40 p-3 backdrop-blur-md shadow-lg">
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-purple-500/20 blur-2xl" />
        <div className="relative flex items-center gap-1.5 mb-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-[0_0_12px_rgba(217,70,239,0.6)]"
          >
            <Sparkles className="w-3 h-3 text-white" fill="currentColor" />
          </motion.div>
          <h3 className="font-unbounded text-sm font-extrabold text-foreground tracking-tight">Pilih Mood Musikmu</h3>
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="ml-auto px-1.5 py-0.5 rounded-md bg-fuchsia-500/20 border border-fuchsia-400/40 text-[8px] font-black text-fuchsia-300 uppercase tracking-wider"
          >
            ✨ Smart
          </motion.span>
        </div>
        <div className="relative grid grid-cols-6 gap-1.5">
          {MOODS.map((m, i) => {
            const active = mood === m.key;
            return (
              <motion.button
                key={m.key}
                onClick={() => setMood(m.key)}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 260 }}
                whileTap={{ scale: 0.88 }}
                className="relative flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all overflow-hidden"
              >
                {active && (
                  <motion.div
                    layoutId="mood-active"
                    className={`absolute inset-0 bg-gradient-to-br ${m.gradient} rounded-xl`}
                    style={{ boxShadow: `0 4px 14px -2px rgba(${m.glow},0.65)` }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                )}
                <div className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all ${active ? "bg-white/25 backdrop-blur" : "bg-muted/40"}`}>
                  <m.icon className={`w-3.5 h-3.5 ${active ? "text-white" : "text-muted-foreground"}`} strokeWidth={active ? 2.6 : 2} />
                </div>
                <span className={`relative text-[9px] font-extrabold tracking-tight ${active ? "text-white drop-shadow" : "text-muted-foreground"}`}>{m.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* MOOD RESULTS — daftar lagu sesuai mood */}
        <div className="relative mt-3 pt-3 border-t border-purple-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${activeMood.gradient}`}
                style={{ boxShadow: `0 0 8px rgba(${activeMood.glow},0.9)` }}
              />
              <span className="text-[10px] font-black uppercase tracking-wider text-foreground">
                {`Lagu ${activeMood.label}`}
              </span>
              <span className="text-[9px] font-bold text-muted-foreground">({moodSongs.length})</span>
            </div>
            {moodSongs.length > 0 && (
              <motion.button
                onClick={playRandomMood}
                whileTap={{ scale: 0.9 }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r ${activeMood.gradient} text-white text-[9px] font-black shadow-lg`}
                style={{ boxShadow: `0 4px 12px -2px rgba(${activeMood.glow},0.6)` }}
              >
                <Play className="w-2.5 h-2.5" strokeWidth={3} fill="currentColor" />
                PUTAR COCOK
              </motion.button>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mood}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="space-y-1.5 max-h-64 overflow-y-auto pr-1"
            >
              {loadingMood && (
                <div className="text-center py-6 text-[11px] text-muted-foreground font-semibold">Memuat lagu…</div>
              )}
              {!loadingMood && allSongs.length === 0 && (
                <div className="text-center py-6 px-3 rounded-xl bg-muted/30 border border-dashed border-muted-foreground/20">
                  <Music2 className="w-6 h-6 mx-auto text-muted-foreground/60 mb-1.5" />
                  <p className="text-[11px] font-bold text-muted-foreground">Belum ada lagu di playlist</p>
                  <p className="text-[9px] text-muted-foreground/70 mt-0.5">Admin perlu menambahkan lagu</p>
                </div>
              )}
              {!loadingMood && moodIsFallback && (
                <div className="px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold text-amber-300 mb-1 leading-relaxed">
                  Belum ada lagu yang cocok untuk mood "{activeMood.label}". Tambahkan judul/artis dengan kata seperti {activeMood.keywords.slice(0, 4).join(", ")}.
                </div>
              )}
              {!loadingMood && moodSongs.map((song, i) => {
                const isNow = nowSong?.id === song.id;
                return (
                  <motion.button
                    key={song.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      onPlayExternal?.(song);
                      if (subTab !== "playlist") onSubTabChange("playlist");
                    }}
                    className={`relative w-full flex items-center gap-2.5 p-1.5 rounded-xl border transition-all overflow-hidden group ${
                      isNow
                        ? `bg-gradient-to-r ${activeMood.gradient} border-white/30 shadow-lg`
                        : "bg-card/60 border-border/50 hover:border-white/20 hover:bg-card/90"
                    }`}
                    style={isNow ? { boxShadow: `0 4px 14px -2px rgba(${activeMood.glow},0.5)` } : undefined}
                  >
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-black/40 flex-shrink-0 border border-white/10">
                      {song.cover_url ? (
                        <img src={song.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${activeMood.gradient} flex items-center justify-center`}>
                          <Music2 className="w-4 h-4 text-white/80" />
                        </div>
                      )}
                      {isNow && isPlaying && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="flex items-end gap-[2px] h-3">
                            {[0.6, 0.9, 0.4].map((h, k) => (
                              <motion.div
                                key={k}
                                animate={{ scaleY: [h, 1, h * 0.5, h] }}
                                transition={{ duration: 0.6 + k * 0.1, repeat: Infinity, ease: "easeInOut" }}
                                style={{ transformOrigin: "bottom" }}
                                className="w-[2px] h-full bg-white rounded-full"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-[11px] font-bold truncate leading-tight ${isNow ? "text-white" : "text-foreground"}`}>{song.title}</p>
                      <p className={`text-[9px] truncate mt-0.5 ${isNow ? "text-white/80" : "text-muted-foreground"}`}>{song.artist}</p>
                    </div>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isNow ? "bg-white/20" : `bg-gradient-to-br ${activeMood.gradient} opacity-80 group-hover:opacity-100 group-hover:scale-110`
                    }`}>
                      {isNow && isPlaying ? (
                        <Pause className="w-3 h-3 text-white" fill="currentColor" />
                      ) : (
                        <Play className="w-3 h-3 text-white ml-0.5" fill="currentColor" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-orange-950/40 to-red-950/40 backdrop-blur-md py-2 shadow-[0_4px_16px_-4px_rgba(245,158,11,0.4)]">
        <div className="absolute left-0 inset-y-0 z-10 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 inset-y-0 z-10 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg">
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Zap className="w-2.5 h-2.5 text-white" fill="currentColor" />
          </motion.div>
          <span className="text-[9px] font-black text-white tracking-wider">HOT</span>
        </div>
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="flex items-center gap-3 whitespace-nowrap pl-16"
        >
          {[...TRENDING_TAGS, ...TRENDING_TAGS].map((tag, i) => (
            <span
              key={i}
              className="text-[11px] font-bold text-amber-100 px-2.5 py-1 rounded-lg bg-white/5 border border-amber-400/20 hover:bg-white/10 transition-colors"
            >
              {tag}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Content */}
      <div className={subTab === "playlist" ? "animate-fade-in" : "hidden"}>{playlistSlot}</div>

      {subTab === "publik" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <MusicPublicTab onPlaySong={(song) => onPlayExternal?.(song)} />
        </motion.div>
      )}

      {subTab === "artist" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <ArtistTab onPlaySong={(song) => onPlayExternal?.(song)} />
        </motion.div>
      )}
    </div>
  );
}

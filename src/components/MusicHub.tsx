import { Music2, Globe, Users, Sparkles, Headphones, Radio, Mic2, Disc3, Flame, Play, Pause, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MusicPublicTab from "@/components/MusicPublicTab";
import ArtistTab from "@/components/ArtistTab";
import type { PlaybackState } from "@/components/PlaylistTab";

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

export default function MusicHub({ subTab, onSubTabChange, onPlayExternal, playlistSlot }: MusicHubProps) {
  const active = TABS.find((t) => t.key === subTab)!;

  return (
    <div className="space-y-3 animate-fade-in">
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
              <h2 className="text-xl font-black tracking-tight text-white drop-shadow-lg">
                Pusat Musik
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

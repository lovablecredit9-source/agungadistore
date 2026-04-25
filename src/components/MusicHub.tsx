import { Music2, Globe, Users, Sparkles, Headphones, Radio, Mic2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MusicPublicTab from "@/components/MusicPublicTab";
import ArtistTab from "@/components/ArtistTab";

export type MusicSubTab = "playlist" | "publik" | "artist";

interface MusicHubProps {
  subTab: MusicSubTab;
  onSubTabChange: (s: MusicSubTab) => void;
  onPlayExternal?: (song: { id: string; title: string; artist: string; file_url: string; cover_url: string | null }) => void;
  /** Slot for the persistent PlaylistTab rendered by parent (kept mounted for audio persistence) */
  playlistSlot: React.ReactNode;
}

const TABS: {
  key: MusicSubTab;
  label: string;
  icon: typeof Music2;
  altIcon: typeof Music2;
  gradient: string;
  glow: string;
  ring: string;
  desc: string;
  emoji: string;
}[] = [
  {
    key: "playlist",
    label: "Playlist",
    icon: Music2,
    altIcon: Headphones,
    gradient: "from-fuchsia-500 via-pink-500 to-rose-500",
    glow: "shadow-[0_0_25px_-5px_rgba(236,72,153,0.6)]",
    ring: "ring-pink-400/50",
    desc: "🎧 Lagu resmi pilihan admin",
    emoji: "🎵",
  },
  {
    key: "publik",
    label: "Publik",
    icon: Globe,
    altIcon: Radio,
    gradient: "from-cyan-400 via-teal-500 to-emerald-500",
    glow: "shadow-[0_0_25px_-5px_rgba(20,184,166,0.6)]",
    ring: "ring-teal-400/50",
    desc: "🌍 Lagu komunitas pengguna",
    emoji: "🎶",
  },
  {
    key: "artist",
    label: "Artist",
    icon: Users,
    altIcon: Mic2,
    gradient: "from-amber-400 via-orange-500 to-red-500",
    glow: "shadow-[0_0_25px_-5px_rgba(249,115,22,0.6)]",
    ring: "ring-orange-400/50",
    desc: "🎤 Jelajahi profil penyanyi",
    emoji: "⭐",
  },
];

export default function MusicHub({ subTab, onSubTabChange, onPlayExternal, playlistSlot }: MusicHubProps) {
  const active = TABS.find((t) => t.key === subTab)!;
  const ActiveIcon = active.icon;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Hero Header — gradient glow + animated equalizer */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10">
        {/* Animated gradient bg */}
        <motion.div
          key={subTab}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className={`absolute inset-0 bg-gradient-to-br ${active.gradient} opacity-90`}
        />
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-8 w-32 h-32 bg-black/20 rounded-full blur-2xl" />
        {/* Noise/sparkle overlay */}
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "30px 30px, 50px 50px",
          }}
        />

        <div className="relative p-4 flex items-center gap-3">
          {/* Animated icon disc */}
          <motion.div
            key={`icon-${subTab}`}
            initial={{ rotate: -180, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={`relative w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 border border-white/30 ${active.glow}`}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-1 rounded-xl border-2 border-dashed border-white/40"
            />
            <ActiveIcon className="w-6 h-6 text-white drop-shadow-lg relative z-10" strokeWidth={2.2} />
            {/* Spark */}
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="absolute -top-1 -right-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" fill="currentColor" />
            </motion.div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-extrabold tracking-tight text-white drop-shadow">
                Pusat Musik
              </h2>
              <span className="text-base">{active.emoji}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={subTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-[11px] text-white/90 mt-0.5 truncate font-medium"
              >
                {active.desc}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Equalizer bars */}
          <div className="flex items-end gap-0.5 h-8 flex-shrink-0">
            {[0.4, 0.8, 0.5, 1, 0.6].map((h, i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [h, 1, h * 0.6, h] }}
                transition={{
                  duration: 0.8 + i * 0.1,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.08,
                }}
                style={{ transformOrigin: "bottom" }}
                className="w-1 h-full bg-white/80 rounded-full"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pill Tabs — glassy, animated */}
      <div className="relative rounded-2xl bg-card/60 backdrop-blur-md border border-border p-1.5 shadow-sm">
        <div className="grid grid-cols-3 gap-1 relative">
          {TABS.map(({ key, label, icon: Icon, gradient, ring }) => {
            const isActive = subTab === key;
            return (
              <button
                key={key}
                onClick={() => onSubTabChange(key)}
                className="relative py-2 px-1 rounded-xl transition-all"
              >
                {isActive && (
                  <motion.div
                    layoutId="active-music-tab"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} ring-2 ${ring} shadow-lg`}
                  />
                )}
                <span
                  className={`relative flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                    isActive ? "text-white drop-shadow" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </span>
                {isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Playlist content rendered via slot to preserve persistent mount */}
      <div className={subTab === "playlist" ? "animate-fade-in" : "hidden"}>{playlistSlot}</div>

      {subTab === "publik" && (
        <div className="animate-fade-in">
          <MusicPublicTab onPlaySong={(song) => onPlayExternal?.(song)} />
        </div>
      )}

      {subTab === "artist" && (
        <div className="animate-fade-in">
          <ArtistTab onPlaySong={(song) => onPlayExternal?.(song)} />
        </div>
      )}
    </div>
  );
}

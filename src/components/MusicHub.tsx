import { useState } from "react";
import { Music2, Globe, Users, Sparkles } from "lucide-react";
import PlaylistTab, { type PlaybackState } from "@/components/PlaylistTab";
import MusicPublicTab from "@/components/MusicPublicTab";
import ArtistTab from "@/components/ArtistTab";

type SubTab = "playlist" | "publik" | "artist";

interface MusicHubProps {
  onPlaybackChange?: (s: PlaybackState) => void;
  togglePlayRef?: React.MutableRefObject<(() => void) | null>;
  openFullPlayerRef?: React.MutableRefObject<(() => void) | null>;
  playExternalRef?: React.MutableRefObject<((song: { id: string; title: string; artist: string; file_url: string; cover_url: string | null }) => void) | null>;
}

const TABS: { key: SubTab; label: string; icon: typeof Music2; gradient: string; desc: string }[] = [
  { key: "playlist", label: "Playlist", icon: Music2, gradient: "from-fuchsia-500 to-pink-500", desc: "Lagu resmi pilihan admin" },
  { key: "publik", label: "Publik", icon: Globe, gradient: "from-teal-500 to-emerald-500", desc: "Lagu komunitas pengguna" },
  { key: "artist", label: "Artist", icon: Users, gradient: "from-amber-500 to-orange-500", desc: "Jelajahi profil penyanyi" },
];

export default function MusicHub({
  onPlaybackChange,
  togglePlayRef,
  openFullPlayerRef,
  playExternalRef,
}: MusicHubProps) {
  const [active, setActive] = useState<SubTab>("playlist");

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-300/20 rounded-full blur-2xl translate-y-8 -translate-x-8" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-extrabold text-white drop-shadow">Pusat Musik</h2>
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </div>
            <p className="text-[11px] text-white/80 truncate">{TABS.find((t) => t.key === active)?.desc}</p>
          </div>
        </div>
      </div>

      {/* Sub-tab pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {TABS.map(({ key, label, icon: Icon, gradient }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                isActive
                  ? `bg-gradient-to-r ${gradient} text-white shadow-lg scale-105`
                  : "bg-card/60 backdrop-blur-sm text-muted-foreground border border-border hover:text-foreground hover:scale-[1.02]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content panels — keep PlaylistTab mounted so audio persists */}
      <div className={active === "playlist" ? "" : "hidden"}>
        <PlaylistTab
          onPlaybackChange={onPlaybackChange}
          onTogglePlay={togglePlayRef}
          onOpenFullPlayer={openFullPlayerRef}
          onPlayExternal={playExternalRef}
        />
      </div>

      {active === "publik" && (
        <MusicPublicTab onPlaySong={(song) => playExternalRef?.current?.(song)} />
      )}

      {active === "artist" && (
        <ArtistTab onPlaySong={(song) => playExternalRef?.current?.(song)} />
      )}
    </div>
  );
}

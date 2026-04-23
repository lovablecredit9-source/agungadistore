import { Music2, Globe, Users, Sparkles } from "lucide-react";
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

const TABS: { key: MusicSubTab; label: string; icon: typeof Music2; gradient: string; desc: string }[] = [
  { key: "playlist", label: "Playlist", icon: Music2, gradient: "from-fuchsia-500 to-pink-500", desc: "Lagu resmi pilihan admin" },
  { key: "publik", label: "Publik", icon: Globe, gradient: "from-teal-500 to-emerald-500", desc: "Lagu komunitas pengguna" },
  { key: "artist", label: "Artist", icon: Users, gradient: "from-amber-500 to-orange-500", desc: "Jelajahi profil penyanyi" },
];

export default function MusicHub({ subTab, onSubTabChange, onPlayExternal, playlistSlot }: MusicHubProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header — flat IG/TikTok style */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Music2 className="w-5 h-5 text-foreground" strokeWidth={1.7} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">Pusat Musik</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{TABS.find((t) => t.key === subTab)?.desc}</p>
          </div>
        </div>
      </div>

      {/* Segmented tabs — underline indicator */}
      <div className="flex border-b border-border">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = subTab === key;
          return (
            <button
              key={key}
              onClick={() => onSubTabChange(key)}
              className="relative flex-1 py-2.5"
            >
              <span className={`flex items-center justify-center gap-1.5 text-xs transition-colors ${isActive ? "text-foreground font-semibold" : "text-muted-foreground font-normal"}`}>
                <Icon className="w-4 h-4" strokeWidth={isActive ? 2.2 : 1.7} />
                {label}
              </span>
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />}
            </button>
          );
        })}
      </div>

      {/* Playlist content rendered via slot to preserve persistent mount */}
      <div className={subTab === "playlist" ? "" : "hidden"}>{playlistSlot}</div>

      {subTab === "publik" && (
        <MusicPublicTab onPlaySong={(song) => onPlayExternal?.(song)} />
      )}

      {subTab === "artist" && (
        <ArtistTab onPlaySong={(song) => onPlayExternal?.(song)} />
      )}
    </div>
  );
}

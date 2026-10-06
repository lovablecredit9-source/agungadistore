import { motion } from "framer-motion";
import { Heart, Play, Gamepad2 } from "lucide-react";
import { useGameProfile } from "./GameProfile";
import { useGameHub, relativeTime } from "./useGameHub";
import { GAMES, GAME_OPEN_KEY } from "./gameCatalog";

/** Favorite games + "continue playing" for the Favorites tab, from the existing game profile. */
export default function FavoriteGamesSection({ setTab }: { setTab: (t: string) => void }) {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { visitorId: gameVisitorId } = useGameProfile(visitorId);
  const { hub, loading, toggleFavorite } = useGameHub(gameVisitorId);
  const favs = GAMES.filter((g) => hub.favorite_games.includes(g.mode));
  const last = GAMES.find((g) => g.mode === hub.last_played_game);
  const stat = (m: string) => hub.stats.find((s) => s.game_type === m);
  const play = (m: string) => { localStorage.setItem(GAME_OPEN_KEY, m); setTab("game"); window.dispatchEvent(new CustomEvent("game-open-request")); };

  if (loading || (!favs.length && !last)) return null;

  return (
    <div className="space-y-3">
      {last && (
        <div className={`rounded-2xl bg-gradient-to-r ${last.gradient} p-[1.5px]`}>
          <div className="rounded-[14px] bg-background/90 backdrop-blur p-3 flex items-center gap-3">
            <img src={last.image} alt="" className="w-12 h-12 object-contain" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-primary tracking-widest">⚡ LANJUTKAN BERMAIN</p>
              <p className="font-black truncate">{last.title}</p>
              <p className="text-[10px] text-muted-foreground">{stat(last.mode) ? `${stat(last.mode)!.points.toLocaleString("id-ID")} poin · ` : ""}{relativeTime(hub.last_played_at)}</p>
            </div>
            <button onClick={() => play(last.mode)} className="min-h-11 px-4 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center gap-1 active:scale-95"><Play className="w-4 h-4" fill="currentColor" />Lanjut</button>
          </div>
        </div>
      )}
      {favs.length > 0 && (
        <div>
          <p className="text-xs font-black mb-2 flex items-center gap-1"><Gamepad2 className="w-4 h-4" />🎮 GAME FAVORIT ({favs.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {favs.map((g) => {
              const st = stat(g.mode);
              return (
                <motion.div key={g.mode} layout className={`rounded-2xl bg-gradient-to-br ${g.gradient} p-3 text-white relative`}>
                  <button aria-label="Hapus favorit" onClick={() => toggleFavorite(g.mode)} className="absolute top-1.5 right-1.5 w-9 h-9 rounded-full bg-black/30 flex items-center justify-center active:scale-90"><Heart className="w-4 h-4 text-rose-300" fill="currentColor" /></button>
                  <img src={g.image} alt="" loading="lazy" className="w-14 h-14 object-contain mx-auto" />
                  <p className="font-black text-sm truncate mt-1">{g.title}</p>
                  <p className="text-[10px] text-white/85">{st ? `⭐ ${st.points.toLocaleString("id-ID")} · 🏆 ${st.wins}` : `Dimainkan ${hub.play_counts[g.mode] || 0}×`}</p>
                  <button onClick={() => play(g.mode)} className="mt-2 w-full min-h-10 rounded-xl bg-white/90 text-black font-black text-xs flex items-center justify-center gap-1 active:scale-95"><Play className="w-3.5 h-3.5" fill="currentColor" />MAIN</button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

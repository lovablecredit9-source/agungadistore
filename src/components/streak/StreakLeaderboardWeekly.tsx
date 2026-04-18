import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Crown, Medal, Award, Flame } from "lucide-react";

interface Entry {
  rank: number;
  visitor_id: string;
  name: string;
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  streak_coins: number;
  is_me: boolean;
}

interface Props {
  visitorId: string;
}

export default function StreakLeaderboardWeekly({ visitorId }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [myRank, setMyRank] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.functions.invoke("streak-leaderboard", { body: { visitorId } });
    if (data) {
      setEntries(data.leaderboard || []);
      setMyRank(data.myRank || null);
    }
    setLoading(false);
  }

  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-4 h-4 text-yellow-400" strokeWidth={2.5} />;
    if (rank === 2) return <Medal className="w-4 h-4 text-slate-300" strokeWidth={2.5} />;
    if (rank === 3) return <Award className="w-4 h-4 text-amber-600" strokeWidth={2.5} />;
    return <span className="text-[10px] font-black text-white/60 w-4 text-center">#{rank}</span>;
  };

  return (
    <div className="cyber-card rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 icon-3d-trophy" strokeWidth={2.5} />
          <span className="text-xs font-black neon-gradient-text tracking-widest uppercase">Top 10 Streaker</span>
        </div>
        <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Live Ranking</span>
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs text-white/50">Memuat...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-6 text-xs text-white/50">Belum ada streaker. Jadilah yang pertama!</div>
      ) : (
        <div className="space-y-1">
          {entries.map((e, i) => (
            <motion.div
              key={e.visitor_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                e.is_me
                  ? "bg-pink-500/20 border-pink-400/50"
                  : e.rank <= 3
                  ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30"
                  : "bg-black/30 border-white/10"
              }`}
            >
              <div className="w-6 flex justify-center">{rankIcon(e.rank)}</div>
              {e.avatar_url ? (
                <img src={e.avatar_url} alt={e.name} className="w-7 h-7 rounded-full border border-white/20 object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-black text-white">
                  {e.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-white truncate">
                  {e.name} {e.is_me && <span className="text-[9px] font-bold text-pink-300">(SAYA)</span>}
                </div>
                <div className="text-[9px] text-white/50">Best: {e.longest_streak}h • {e.streak_coins} koin</div>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/40">
                <Flame className="w-3 h-3 text-orange-300" strokeWidth={2.5} />
                <span className="text-xs font-black text-orange-200 tabular-nums">{e.current_streak}</span>
              </div>
            </motion.div>
          ))}

          {myRank && myRank.rank > 10 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 p-2 rounded-lg bg-pink-500/20 border border-pink-400/50 mt-2"
            >
              <div className="w-6 flex justify-center">
                <span className="text-[10px] font-black text-pink-300">#{myRank.rank}</span>
              </div>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-black text-white">
                ME
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-white">Posisi Saya</div>
                <div className="text-[9px] text-white/50">Best: {myRank.longest_streak}h</div>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/40">
                <Flame className="w-3 h-3 text-orange-300" strokeWidth={2.5} />
                <span className="text-xs font-black text-orange-200 tabular-nums">{myRank.current_streak}</span>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

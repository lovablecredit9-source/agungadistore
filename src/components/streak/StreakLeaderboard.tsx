import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Crown, Medal, Award, Loader2 } from "lucide-react";
import { getVisitorId } from "@/lib/visitor-id";

interface LeaderboardEntry {
  id: string;
  visitor_id: string;
  current_streak: number;
  longest_streak: number;
  total_claims: number;
  total_bonus_points: number;
  display_name: string;
  avatar_url: string | null;
}

export default function StreakLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const visitorId = getVisitorId();

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    setLoading(true);
    const { data } = await supabase
      .from("streak_leaderboard" as any)
      .select("*")
      .limit(10);
    if (data) {
      setEntries(data as unknown as LeaderboardEntry[]);
      const myIdx = (data as any[]).findIndex((e: any) => e.visitor_id === visitorId);
      setMyRank(myIdx >= 0 ? myIdx + 1 : null);
    }
    setLoading(false);
  }

  function getRankIcon(rank: number) {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" fill="currentColor" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-orange-600" />;
    return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{rank}</span>;
  }

  function getRankGradient(rank: number) {
    if (rank === 1) return "from-yellow-400 via-amber-500 to-orange-600";
    if (rank === 2) return "from-slate-300 via-slate-400 to-slate-500";
    if (rank === 3) return "from-orange-400 via-orange-500 to-orange-700";
    return "from-muted to-muted";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card-strong rounded-2xl border p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" /> Top 10 Streak Champion
        </h4>
        {myRank !== null && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/20 text-primary">
            Rank #{myRank}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Belum ada juara. Jadi yang pertama!</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry, i) => {
            const rank = i + 1;
            const isMe = entry.visitor_id === visitorId;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-2.5 rounded-xl p-2.5 transition-all ${
                  isMe ? "bg-primary/15 border border-primary/40 shadow-md" : "bg-muted/40"
                } ${rank <= 3 ? "relative overflow-hidden" : ""}`}
              >
                {rank <= 3 && (
                  <motion.div
                    className={`absolute inset-0 bg-gradient-to-r ${getRankGradient(rank)} opacity-10`}
                    animate={{ opacity: [0.05, 0.15, 0.05] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-2.5 w-full">
                  <div className="w-7 h-7 flex items-center justify-center shrink-0">
                    {getRankIcon(rank)}
                  </div>
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt={entry.display_name} className="w-9 h-9 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${getRankGradient(rank)}`}>
                      {entry.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">
                      {entry.display_name} {isMe && <span className="text-primary">(Kamu)</span>}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">🔥 {entry.current_streak}</span>
                      <span className="flex items-center gap-0.5">🏆 {entry.longest_streak}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-foreground">{entry.longest_streak}</p>
                    <p className="text-[8px] text-muted-foreground uppercase tracking-wider">terbaik</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

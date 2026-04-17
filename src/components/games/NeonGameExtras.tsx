import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Crown, Medal, Award, Zap, Target } from "lucide-react";

interface Props {
  visitorId: string | null;
  onPlayDailyChallenge?: (gameType: string) => void;
}

interface LeaderRow {
  visitor_id: string;
  display_name: string;
  points: number;
  wins: number;
  avatar_url?: string | null;
}

interface Tournament {
  id: string;
  name: string;
  ends_at: string;
  prize_first: number;
  prize_second: number;
  prize_third: number;
}

export default function NeonGameExtras({ visitorId, onPlayDailyChallenge }: Props) {
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [dailyGame, setDailyGame] = useState<string>("");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tEntries, setTEntries] = useState<LeaderRow[]>([]);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  async function loadAll() {
    // Daily challenge
    const { data: dc } = await supabase.functions.invoke("game-profile", { body: { action: "get_daily_challenge" } });
    if (dc?.game_type) setDailyGame(dc.game_type);

    // Global leaderboard
    const { data: lb } = await supabase.functions.invoke("game-profile", { body: { action: "leaderboard", scope: "global" } });
    if (Array.isArray(lb)) setLeaderboard(lb.slice(0, 10));

    // Tournament
    const { data: tt } = await supabase.functions.invoke("tournament-manage", { body: { action: "get", visitorId } });
    if (tt?.tournament) {
      setTournament(tt.tournament);
      setTEntries((tt.leaderboard || []).slice(0, 5));
    }

    // Achievements (own)
    if (visitorId) {
      const { data: ach } = await supabase.from("game_achievements").select("achievement_key").eq("visitor_id", visitorId);
      setAchievements((ach || []).map((a: any) => a.achievement_key));
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [visitorId]);

  useEffect(() => {
    if (!tournament) return;
    const tick = () => {
      const diff = new Date(tournament.ends_at).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Berakhir"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${d}h ${h}j ${m}m`);
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [tournament]);

  const ALL_ACHIEVEMENTS = [
    { key: "first_win", label: "Kemenangan Pertama", emoji: "🏆" },
    { key: "ten_wins", label: "10 Wins", emoji: "🥇" },
    { key: "fifty_wins", label: "50 Wins", emoji: "💎" },
    { key: "hundred_wins", label: "Centurion", emoji: "👑" },
    { key: "first_play", label: "Welcome Player", emoji: "🎮" },
    { key: "fifty_games", label: "Veteran", emoji: "⚔️" },
    { key: "two_hundred_games", label: "Marathon", emoji: "🏃" },
    { key: "hundred_points", label: "100 Poin", emoji: "💯" },
    { key: "thousand_points", label: "1K Poin", emoji: "⭐" },
    { key: "five_thousand_points", label: "5K LEGEND", emoji: "🌟" },
    { key: "all_games", label: "Penjelajah", emoji: "🗺️" },
    { key: "marathon", label: "Master 10 Game", emoji: "🎯" },
  ];

  const gameNames: Record<string, string> = {
    suit: "Suit AI", tebak: "Tebak Kata", tebak_gambar: "Tebak Gambar", teka_teki: "Teka-Teki",
    tebak_angka: "Tebak Angka", tebak_barang: "Tebak Barang", ular_tangga: "Ular Tangga",
    ludo: "Ludo King", kuis: "Kuis Ya/Tidak", teka_teki_v2: "Puzzle Huruf", pilihan_ganda: "Pilihan Ganda",
  };

  return (
    <div className="space-y-3">
      {/* Daily Challenge */}
      {dailyGame && (
        <motion.button
          onClick={() => onPlayDailyChallenge?.(dailyGame)}
          whileTap={{ scale: 0.97 }}
          className="w-full cyber-card-pink rounded-2xl p-4 text-left relative overflow-hidden group"
        >
          <div className="absolute inset-0 cyber-grid opacity-20" />
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-yellow-400/30 rounded-full blur-2xl neon-pulse" />
          <div className="relative flex items-center gap-3">
            <div className="text-4xl">🎯</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black tracking-widest neon-text-yellow uppercase flex items-center gap-1">
                <Zap className="w-3 h-3" /> Daily Challenge
              </div>
              <div className="font-extrabold text-white text-sm">{gameNames[dailyGame] || dailyGame}</div>
              <div className="text-[11px] text-white/70">Bonus <span className="neon-text-yellow font-black">2× POIN</span> hari ini!</div>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-yellow-400 text-black text-xs font-black shadow-[0_0_15px_hsl(var(--neon-yellow)/0.8)]">2X</div>
          </div>
        </motion.button>
      )}

      {/* Tournament */}
      {tournament && (
        <div className="cyber-card rounded-2xl p-4 relative scanline">
          <div className="absolute inset-0 cyber-grid opacity-20 rounded-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[10px] font-black tracking-widest neon-text-pink uppercase flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> Tournament
                </div>
                <div className="font-extrabold text-white text-base glitch-text">{tournament.name}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-white/60 uppercase">Berakhir</div>
                <div className="text-xs font-black neon-text-cyan tabular-nums">{timeLeft}</div>
              </div>
            </div>
            <div className="flex gap-2 text-[10px] mb-3">
              <div className="flex-1 bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-1.5 text-center">
                <div className="font-black text-yellow-300">🥇 {tournament.prize_first}</div>
                <div className="text-white/60 text-[8px]">CREDIT</div>
              </div>
              <div className="flex-1 bg-slate-400/20 border border-slate-400/40 rounded-lg p-1.5 text-center">
                <div className="font-black text-slate-200">🥈 {tournament.prize_second}</div>
                <div className="text-white/60 text-[8px]">CREDIT</div>
              </div>
              <div className="flex-1 bg-orange-500/20 border border-orange-500/40 rounded-lg p-1.5 text-center">
                <div className="font-black text-orange-300">🥉 {tournament.prize_third}</div>
                <div className="text-white/60 text-[8px]">CREDIT</div>
              </div>
            </div>
            <div className="space-y-1">
              {tEntries.length === 0 && <div className="text-[10px] text-white/50 text-center py-2">Belum ada peserta. Main game untuk masuk leaderboard!</div>}
              {tEntries.map((e, i) => (
                <div key={e.visitor_id} className={`flex items-center gap-2 p-1.5 rounded-lg ${e.visitor_id === visitorId ? "bg-pink-500/20 border border-pink-500/40" : "bg-black/30"}`}>
                  <span className="text-xs font-black w-5 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                  <span className="text-xs font-bold text-white truncate flex-1">{e.display_name}</span>
                  <span className="text-xs neon-text-yellow font-black tabular-nums">{e.points}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="cyber-card-cyan rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 neon-text-yellow" />
            <span className="text-xs font-black neon-text-cyan tracking-widest uppercase">Top 10 Global</span>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-hide">
            {leaderboard.map((row, i) => {
              const isMine = row.visitor_id === visitorId;
              const rankIcon = i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
              const rankGlow = i === 0 ? "from-yellow-400 to-orange-500"
                : i === 1 ? "from-slate-300 to-slate-500"
                : i === 2 ? "from-orange-400 to-amber-700"
                : "from-cyan-700/30 to-purple-700/30";
              return (
                <motion.div
                  key={row.visitor_id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${rankGlow} ${isMine ? "ring-2 ring-pink-400" : ""} ${i < 3 ? "shadow-[0_0_12px_hsl(var(--neon-yellow)/0.3)]" : ""}`}
                >
                  <span className="text-sm font-black w-7 text-center">{rankIcon}</span>
                  <span className="text-xs font-bold text-white flex-1 truncate">{row.display_name}{isMine && " (kamu)"}</span>
                  <span className="text-xs font-black text-white tabular-nums">{row.points.toLocaleString("id-ID")} pts</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievements toggle */}
      <button
        onClick={() => setShowAchievements(!showAchievements)}
        className="w-full cyber-card rounded-2xl p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 neon-text-pink" />
          <span className="text-xs font-black neon-text-cyan tracking-widest uppercase">Badges ({achievements.length}/{ALL_ACHIEVEMENTS.length})</span>
        </div>
        <span className="text-xs text-white/60">{showAchievements ? "▲" : "▼"}</span>
      </button>
      {showAchievements && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="grid grid-cols-3 gap-2"
        >
          {ALL_ACHIEVEMENTS.map(a => {
            const unlocked = achievements.includes(a.key);
            return (
              <div
                key={a.key}
                className={`p-2 rounded-xl text-center border ${unlocked ? "cyber-card-pink" : "bg-black/40 border-white/10 opacity-40"}`}
              >
                <div className={`text-2xl mb-1 ${unlocked ? "neon-pulse" : "grayscale"}`}>{a.emoji}</div>
                <div className="text-[9px] font-black text-white leading-tight">{a.label}</div>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

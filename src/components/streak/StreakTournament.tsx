import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Loader2, Crown, Medal, Award, Clock } from "lucide-react";

interface Props { visitorId: string; }
interface Tournament {
  id: string; name: string; description: string;
  starts_at: string; ends_at: string;
  prize_first: number; prize_second: number; prize_third: number;
}
interface Entry {
  id: string; visitor_id: string; total_points: number; total_wins: number;
  display_name: string; avatar_url: string | null;
}

export default function StreakTournament({ visitorId }: Props) {
  const [open, setOpen] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);
  const [myEntry, setMyEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("tournament-manage", {
      body: { action: "get", visitorId },
    });
    setTournament(data?.tournament || null);
    setLeaderboard(data?.leaderboard || []);
    setMyEntry(data?.myEntry || null);
    setLoading(false);
  };

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  useEffect(() => {
    if (!tournament) return;
    const tick = () => {
      const diff = new Date(tournament.ends_at).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Selesai"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${d}h ${h}j ${m}m`);
    };
    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, [tournament]);

  const myRank = myEntry ? (leaderboard.findIndex(e => e.visitor_id === visitorId) + 1) : 0;

  return (
    <>
      <motion.div whileHover={{ scale: 1.02 }} className="relative overflow-hidden rounded-2xl border-2 border-yellow-500/40 bg-gradient-to-br from-yellow-950/60 to-amber-950/60 p-4 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-yellow-500/10 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/40">
              <Trophy className="w-6 h-6 text-white drop-shadow" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-yellow-300 uppercase tracking-wider">Tournament</p>
              <p className="text-sm font-black text-white">🏆 Mingguan</p>
              {tournament && (
                <p className="text-[10px] text-white/60 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> {timeLeft}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-black shadow-lg"
          >
            Lihat
          </Button>
        </div>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-950 via-yellow-950/30 to-slate-950 border-2 border-yellow-500/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Trophy className="w-5 h-5 text-yellow-400" /> {tournament?.name || "Tournament"}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-yellow-400" /></div>
          ) : !tournament ? (
            <p className="py-8 text-center text-white/60 text-sm">Belum ada tournament aktif</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 p-3">
                <p className="text-[11px] text-white/80 mb-2">{tournament.description}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center bg-yellow-500/20 rounded-lg p-2">
                    <Crown className="w-4 h-4 mx-auto text-yellow-300" />
                    <p className="text-[9px] font-bold text-yellow-300">JUARA 1</p>
                    <p className="text-sm font-black text-white">{tournament.prize_first} 🪙</p>
                  </div>
                  <div className="text-center bg-slate-400/20 rounded-lg p-2">
                    <Medal className="w-4 h-4 mx-auto text-slate-300" />
                    <p className="text-[9px] font-bold text-slate-300">JUARA 2</p>
                    <p className="text-sm font-black text-white">{tournament.prize_second} 🪙</p>
                  </div>
                  <div className="text-center bg-orange-500/20 rounded-lg p-2">
                    <Award className="w-4 h-4 mx-auto text-orange-300" />
                    <p className="text-[9px] font-bold text-orange-300">JUARA 3</p>
                    <p className="text-sm font-black text-white">{tournament.prize_third} 🪙</p>
                  </div>
                </div>
                <p className="text-[10px] text-yellow-300 text-center mt-2 font-bold">⏱️ Berakhir dalam: {timeLeft}</p>
              </div>

              {myEntry && (
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-2 flex items-center justify-between">
                  <p className="text-xs text-cyan-300 font-black">📊 Posisi Kamu</p>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">#{myRank || "-"} • {myEntry.total_points} poin</p>
                    <p className="text-[10px] text-white/60">{myEntry.total_wins}W</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-black text-white/80 mb-2">🏅 Leaderboard Top 20</p>
                <div className="space-y-1.5">
                  {leaderboard.length === 0 ? (
                    <p className="text-[11px] text-white/50 text-center py-3">Jadilah yang pertama!</p>
                  ) : leaderboard.map((e, i) => {
                    const isMe = e.visitor_id === visitorId;
                    const top3 = i < 3;
                    return (
                      <div
                        key={e.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          isMe ? "bg-cyan-500/20 border border-cyan-500/40" :
                          top3 ? "bg-yellow-500/10 border border-yellow-500/20" :
                          "bg-white/5"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                          i === 0 ? "bg-yellow-500 text-black" :
                          i === 1 ? "bg-slate-300 text-black" :
                          i === 2 ? "bg-orange-500 text-white" :
                          "bg-white/10 text-white/70"
                        }`}>
                          {i + 1}
                        </div>
                        {e.avatar_url ? (
                          <img src={e.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-black text-white">
                            {e.display_name[0]?.toUpperCase()}
                          </div>
                        )}
                        <p className="text-xs font-bold text-white flex-1 truncate">{e.display_name}{isMe && " (Kamu)"}</p>
                        <div className="text-right">
                          <p className="text-xs font-black text-yellow-300">{e.total_points}</p>
                          <p className="text-[9px] text-white/50">{e.total_wins}W</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[10px] text-white/50 text-center">💡 Bermain game streak untuk dapat poin tournament</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Swords, Loader2, Trophy, X, Clock, Plus, Crown, Skull } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { visitorId: string; onUpdate?: () => void; }
interface Battle {
  id: string;
  challenger_id: string;
  opponent_id: string | null;
  status: string;
  bet_gems: number;
  challenger_score: number;
  opponent_score: number;
  winner_id: string | null;
  prize_gems: number;
  expires_at: string;
  challenger_name: string;
  challenger_avatar: string | null;
  opponent_name: string | null;
  opponent_avatar: string | null;
}

export default function StreakBattleArena({ visitorId, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [openList, setOpenList] = useState<Battle[]>([]);
  const [myList, setMyList] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [betGems, setBetGems] = useState(50);
  const [actingId, setActingId] = useState<string | null>(null);
  const [submitScore, setSubmitScore] = useState<{ id: string; score: string } | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("battle-manage", {
      body: { action: "list", visitorId },
    });
    if (!error && data) {
      setOpenList(data.open || []);
      setMyList(data.mine || []);
    }
    setLoading(false);
  };

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("battles-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "streak_battles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visitorId]);

  const create = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("battle-manage", {
        body: { action: "create", visitorId, betGems },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "⚔️ Battle Dibuat!", description: `Taruhan ${betGems} 💎` });
      await load();
      onUpdate?.();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  const accept = async (battleId: string) => {
    setActingId(battleId);
    try {
      const { data, error } = await supabase.functions.invoke("battle-manage", {
        body: { action: "accept", visitorId, battleId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "✅ Battle Diterima!", description: "Submit skor dalam 30 menit" });
      await load();
      onUpdate?.();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally { setActingId(null); }
  };

  const cancel = async (battleId: string) => {
    setActingId(battleId);
    try {
      const { data, error } = await supabase.functions.invoke("battle-manage", {
        body: { action: "cancel", visitorId, battleId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "Battle dibatalkan", description: "Gem dikembalikan" });
      await load();
      onUpdate?.();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally { setActingId(null); }
  };

  const submit = async () => {
    if (!submitScore) return;
    const score = parseInt(submitScore.score) || 0;
    setActingId(submitScore.id);
    try {
      const { data, error } = await supabase.functions.invoke("battle-manage", {
        body: { action: "submit_score", visitorId, battleId: submitScore.id, score },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "✅ Skor dikirim", description: data.resolved ? "Battle selesai!" : "Menunggu lawan" });
      setSubmitScore(null);
      await load();
      onUpdate?.();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally { setActingId(null); }
  };

  const renderBattle = (b: Battle, mode: "open" | "mine") => {
    const isChallenger = b.challenger_id === visitorId;
    const isOpponent = b.opponent_id === visitorId;
    const won = b.winner_id === visitorId;
    return (
      <motion.div
        key={b.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-2 border-red-500/40 bg-gradient-to-br from-red-950/40 to-orange-950/40 p-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-xs font-black text-white">
              {b.challenger_name[0]?.toUpperCase()}
            </div>
            <p className="text-xs font-bold text-white truncate max-w-[80px]">{b.challenger_name}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-yellow-400 font-black">VS</p>
            <p className="text-sm font-black text-yellow-300">{b.bet_gems} 💎</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-white truncate max-w-[80px] text-right">
              {b.opponent_name || "?"}
            </p>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-black text-white">
              {b.opponent_name ? b.opponent_name[0]?.toUpperCase() : "?"}
            </div>
          </div>
        </div>

        {b.status === "settled" ? (
          <div className={`text-center py-2 rounded-lg ${won ? "bg-green-500/20" : "bg-red-500/20"}`}>
            {won ? (
              <p className="text-xs font-black text-green-300 flex items-center justify-center gap-1">
                <Crown className="w-3 h-3" /> MENANG +{b.prize_gems} 💎
              </p>
            ) : b.winner_id ? (
              <p className="text-xs font-black text-red-300 flex items-center justify-center gap-1">
                <Skull className="w-3 h-3" /> KALAH
              </p>
            ) : (
              <p className="text-xs font-black text-white/70">SERI - Refund</p>
            )}
            <p className="text-[10px] text-white/60 mt-1">{b.challenger_score} : {b.opponent_score}</p>
          </div>
        ) : b.status === "active" ? (
          (isChallenger || isOpponent) && (
            ((isChallenger && b.challenger_score === 0) || (isOpponent && b.opponent_score === 0)) ? (
              <Button
                size="sm"
                onClick={() => setSubmitScore({ id: b.id, score: "" })}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black"
              >
                Submit Skor
              </Button>
            ) : (
              <p className="text-[11px] text-center text-yellow-300 font-bold">⏳ Menunggu lawan submit</p>
            )
          )
        ) : b.status === "open" ? (
          mode === "open" ? (
            <Button
              size="sm"
              disabled={actingId === b.id}
              onClick={() => accept(b.id)}
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-black"
            >
              {actingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : `⚔️ Terima (${b.bet_gems} 💎)`}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={actingId === b.id}
              onClick={() => cancel(b.id)}
              className="w-full border-red-500/50 text-red-300"
            >
              <X className="w-3 h-3 mr-1" /> Batal & Refund
            </Button>
          )
        ) : (
          <p className="text-[11px] text-center text-white/50">{b.status}</p>
        )}
      </motion.div>
    );
  };

  return (
    <>
      <motion.div whileHover={{ scale: 1.02 }} className="relative overflow-hidden rounded-2xl border-2 border-red-500/40 bg-gradient-to-br from-red-950/60 to-orange-950/60 p-4 backdrop-blur-xl">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/40">
              <Swords className="w-6 h-6 text-white drop-shadow" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-red-300 uppercase tracking-wider">Streak Battle</p>
              <p className="text-sm font-black text-white">⚔️ Tantang 1v1</p>
              <p className="text-[10px] text-white/60">{openList.length} battle terbuka</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 text-white font-black shadow-lg"
          >
            Arena
          </Button>
        </div>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-950 via-red-950/40 to-slate-950 border-2 border-red-500/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Swords className="w-5 h-5 text-red-400" /> Battle Arena ⚔️
            </DialogTitle>
          </DialogHeader>

          {/* Create */}
          <div className="rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 p-3 space-y-2">
            <p className="text-xs font-black text-red-300">🆕 Buat Tantangan Baru</p>
            <div className="flex gap-2">
              <Input
                type="number"
                value={betGems}
                onChange={(e) => setBetGems(Math.max(10, Math.min(1000, parseInt(e.target.value) || 0)))}
                min={10}
                max={1000}
                className="bg-black/40 border-red-500/30 text-white"
                placeholder="Taruhan 💎"
              />
              <Button
                disabled={creating}
                onClick={create}
                className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-black"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Buat</>}
              </Button>
            </div>
            <p className="text-[10px] text-white/50">Min 10, Max 1000 💎. Pemenang dapat 2x taruhan.</p>
          </div>

          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-red-400" /></div>
          ) : (
            <>
              <div>
                <p className="text-xs font-black text-white/80 mb-2">🔥 Battle Terbuka</p>
                <div className="space-y-2">
                  {openList.length === 0 ? (
                    <p className="text-[11px] text-white/50 text-center py-3">Belum ada battle terbuka</p>
                  ) : openList.map((b) => renderBattle(b, "open"))}
                </div>
              </div>
              <div>
                <p className="text-xs font-black text-white/80 mb-2">📋 Battle Saya</p>
                <div className="space-y-2">
                  {myList.length === 0 ? (
                    <p className="text-[11px] text-white/50 text-center py-3">Belum ada battle</p>
                  ) : myList.map((b) => renderBattle(b, "mine"))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submit Score Dialog */}
      <Dialog open={!!submitScore} onOpenChange={(v) => !v && setSubmitScore(null)}>
        <DialogContent className="max-w-xs bg-slate-950 border-yellow-500/40">
          <DialogHeader>
            <DialogTitle className="text-white">Submit Skor Battle</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            value={submitScore?.score || ""}
            onChange={(e) => setSubmitScore(s => s ? { ...s, score: e.target.value } : null)}
            placeholder="Skor (poin streak/game)"
            className="bg-black/40 border-yellow-500/30 text-white"
          />
          <Button
            disabled={!submitScore?.score || actingId === submitScore?.id}
            onClick={submit}
            className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black"
          >
            {actingId === submitScore?.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim Skor"}
          </Button>
          <p className="text-[10px] text-white/50">⚠️ Skor tidak bisa diubah setelah dikirim</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

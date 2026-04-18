import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits, triggerGameCreditsRefresh } from "./GameCredits";
import { triggerGameBalanceRefresh } from "./GameBalance";
import { ServerLuckCard } from "./ServerLuckCard";

const SYMBOLS = ["🍒", "🍋", "🍇", "🔔", "⭐", "💎", "7️⃣"];

type Tier = "hemat" | "sedang" | "besar";
const TIERS: { key: Tier; label: string; cost: number; gradient: string; desc: string }[] = [
  { key: "hemat",  label: "Hemat",  cost: 1,  gradient: "from-emerald-500 to-teal-600",  desc: "Jackpot Rp 1.000" },
  { key: "sedang", label: "Sedang", cost: 5,  gradient: "from-blue-500 to-indigo-600",   desc: "Jackpot Rp 2.000 + Bonus" },
  { key: "besar",  label: "Besar",  cost: 10, gradient: "from-amber-500 to-rose-600",    desc: "Mega Jackpot Rp 5.000" },
];

export default function SlotMachineGame() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, fetchCredits } = useGameCredits(visitorId);
  const [tier, setTier] = useState<Tier>("hemat");
  const [reels, setReels] = useState<string[]>(["🍒", "🍋", "🍇"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const tierInfo = TIERS.find(t => t.key === tier)!;

  const spin = async () => {
    if (!visitorId) return toast({ title: "Login dulu", variant: "destructive" });
    if (!isUnlimited && credits < tierInfo.cost) {
      return toast({ title: "Kredit tidak cukup", description: `Butuh ${tierInfo.cost} kredit untuk tier ${tierInfo.label}`, variant: "destructive" });
    }

    setResult(null);
    setSpinning(true);

    const animDuration = 1500;
    const start = Date.now();
    const interval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
      if (Date.now() - start >= animDuration) clearInterval(interval);
    }, 80);

    const { data, error } = await supabase.functions.invoke("slot-machine", { body: { visitorId, tier } });

    setTimeout(() => {
      clearInterval(interval);
      if (error || data?.error) {
        toast({ title: "Gagal", description: data?.error || "Coba lagi", variant: "destructive" });
        setSpinning(false);
        return;
      }
      setReels(data.reels);
      setResult(data.payout);
      setSpinning(false);
      fetchCredits();
      // Refresh Saldo IN & kredit lintas-komponen (Plus tab, GameTab badge, dll)
      triggerGameBalanceRefresh();
      triggerGameCreditsRefresh();
      if (data.payout.type !== "none") {
        toast({ title: "🎉 Menang!", description: data.payout.label });
      }
    }, animDuration);
  };

  return (
    <div className="space-y-4">
      <ServerLuckCard visitorId={visitorId} />

      <Card className={`p-4 bg-gradient-to-br ${tierInfo.gradient} text-white border-none text-center`}>
        <h3 className="font-extrabold text-lg">🎰 Slot Machine 3-Reel</h3>
        <p className="text-xs opacity-90 mt-1">Tier {tierInfo.label} • {tierInfo.desc}</p>
      </Card>

      {/* Tier Selector */}
      <div className="grid grid-cols-3 gap-2">
        {TIERS.map(t => (
          <button
            key={t.key}
            onClick={() => !spinning && setTier(t.key)}
            disabled={spinning}
            className={`relative rounded-xl p-2 text-center border-2 transition-all ${
              tier === t.key
                ? `bg-gradient-to-br ${t.gradient} text-white border-white/40 shadow-lg scale-105`
                : "bg-muted/50 border-transparent hover:bg-muted"
            }`}
          >
            <div className="text-[10px] font-bold uppercase opacity-90">{t.label}</div>
            <div className="text-base font-black mt-0.5 flex items-center justify-center gap-1">
              <Coins className="w-3.5 h-3.5" /> {t.cost}
            </div>
          </button>
        ))}
      </div>

      <div className="bg-gradient-to-b from-amber-700 via-amber-600 to-amber-800 rounded-3xl p-5 shadow-2xl border-4 border-amber-900">
        <div className="bg-black rounded-xl p-4 grid grid-cols-3 gap-2">
          {reels.map((sym, i) => (
            <motion.div
              key={i}
              animate={spinning ? { y: [0, -10, 0] } : {}}
              transition={{ duration: 0.15, repeat: spinning ? Infinity : 0 }}
              className="aspect-square bg-gradient-to-br from-white to-slate-200 rounded-lg flex items-center justify-center text-5xl shadow-inner"
            >
              {sym}
            </motion.div>
          ))}
        </div>

        <Button
          onClick={spin}
          disabled={spinning || (!isUnlimited && credits < tierInfo.cost)}
          className="w-full mt-4 h-14 text-lg font-black bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-amber-950 border-2 border-yellow-300 shadow-lg"
        >
          {spinning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Coins className="w-5 h-5 mr-2" />}
          {spinning ? "SPINNING..." : `PUTAR! (${tierInfo.cost} kredit)`}
        </Button>
      </div>

      {result && !spinning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl text-center ${result.type === "none" ? "bg-muted" : "bg-gradient-to-r from-green-500 to-emerald-600 text-white"}`}
        >
          <div className="text-2xl mb-1">{result.type === "none" ? "😢" : "🎉"}</div>
          <div className="font-extrabold">{result.label}</div>
        </motion.div>
      )}

      <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded-lg">
        <div className="font-bold mb-1">💰 Hadiah per Tier:</div>
        <div><span className="font-bold text-emerald-600">Hemat (1):</span> 7️⃣7️⃣7️⃣ → Saldo Rp 1.000 · 💎💎💎 → Rp 500 · ⭐⭐⭐ → Rp 100 · 🔔/🍇/🍋/🍒 → 2-10 kredit</div>
        <div><span className="font-bold text-blue-600">Sedang (5):</span> 7️⃣7️⃣7️⃣ → Rp 2.000 · 💎💎💎 → Rp 1.000 · 🔔🔔🔔 → +50MB Storage · 🍇🍇🍇 → +1 Nyawa</div>
        <div><span className="font-bold text-amber-600">Besar (10):</span> 7️⃣7️⃣7️⃣ → MEGA Rp 5.000 · 🔔🔔🔔 → +100MB · 🍇🍇🍇 → +2 Nyawa</div>
        <div className="pt-1 italic opacity-80">Saldo Game hanya bisa dipakai untuk: kredit game, paket streak, storage musik, gem (bukan produk).</div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Coins, Gift, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits, triggerGameCreditsRefresh } from "./GameCredits";
import { triggerGameBalanceRefresh } from "./GameBalance";
import { ServerLuckCard } from "./ServerLuckCard";

const SYMBOLS = ["🍒", "🍋", "🍇", "🔔", "⭐", "💎", "7️⃣"];

type Tier = "hemat" | "sedang" | "besar" | "mega" | "ultra";
const TIERS: { key: Tier; label: string; cost: number; gradient: string; desc: string }[] = [
  { key: "hemat",  label: "Hemat",  cost: 1,   gradient: "from-emerald-500 to-teal-600",  desc: "Jackpot Rp 100" },
  { key: "sedang", label: "Sedang", cost: 5,   gradient: "from-blue-500 to-indigo-600",   desc: "Jackpot Rp 200 + Bonus" },
  { key: "besar",  label: "Besar",  cost: 10,  gradient: "from-amber-500 to-rose-600",    desc: "Mega Jackpot Rp 500" },
  { key: "mega",   label: "Mega",   cost: 50,  gradient: "from-fuchsia-500 to-purple-700", desc: "Super Jackpot Rp 2.500" },
  { key: "ultra",  label: "Ultra",  cost: 100, gradient: "from-rose-600 to-red-800",       desc: "Ultra Jackpot Rp 5.000" },
];

// Tabel hadiah per tier — ditampilkan ringkas di bawah mesin
const TIER_REWARDS: Record<Tier, { sym: string; reward: string }[]> = {
  hemat: [
    { sym: "7️⃣7️⃣7️⃣", reward: "MAX Saldo Rp 100" },
    { sym: "💎💎💎", reward: "5 kredit" },
    { sym: "⭐⭐⭐", reward: "4 kredit" },
    { sym: "🔔🔔🔔", reward: "3 kredit" },
    { sym: "🍇🍇🍇", reward: "3 kredit" },
    { sym: "🍋🍋🍋", reward: "2 kredit" },
    { sym: "🍒🍒🍒", reward: "2 kredit" },
  ],
  sedang: [
    { sym: "7️⃣7️⃣7️⃣", reward: "MAX Saldo Rp 200" },
    { sym: "💎💎💎", reward: "Saldo Rp 100" },
    { sym: "⭐⭐⭐", reward: "8 kredit" },
    { sym: "🔔🔔🔔", reward: "+50 MB storage" },
    { sym: "🍇🍇🍇", reward: "+1 Nyawa Ekstra" },
  ],
  besar: [
    { sym: "7️⃣7️⃣7️⃣", reward: "MAX Saldo Rp 500" },
    { sym: "💎💎💎", reward: "Saldo Rp 200" },
    { sym: "⭐⭐⭐", reward: "15 kredit" },
    { sym: "🔔🔔🔔", reward: "+100 MB storage" },
    { sym: "🍇🍇🍇", reward: "+2 Nyawa Ekstra" },
  ],
  mega: [
    { sym: "7️⃣7️⃣7️⃣", reward: "MAX Saldo Rp 2.500" },
    { sym: "💎💎💎", reward: "Saldo Rp 1.000" },
    { sym: "⭐⭐⭐", reward: "Saldo Rp 500" },
    { sym: "🔔🔔🔔", reward: "+250 MB storage" },
    { sym: "🍇🍇🍇", reward: "+5 Nyawa Ekstra" },
    { sym: "🍋🍋🍋", reward: "60 kredit" },
    { sym: "🍒🍒🍒", reward: "40 kredit" },
  ],
  ultra: [
    { sym: "7️⃣7️⃣7️⃣", reward: "MAX Saldo Rp 5.000" },
    { sym: "💎💎💎", reward: "Saldo Rp 2.000" },
    { sym: "⭐⭐⭐", reward: "Saldo Rp 1.000" },
    { sym: "🔔🔔🔔", reward: "+500 MB storage" },
    { sym: "🍇🍇🍇", reward: "+10 Nyawa Ekstra" },
    { sym: "🍋🍋🍋", reward: "130 kredit" },
    { sym: "🍒🍒🍒", reward: "90 kredit" },
  ],
};

export default function SlotMachineGame() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, fetchCredits } = useGameCredits(visitorId);
  const [tier, setTier] = useState<Tier>("hemat");
  const [reels, setReels] = useState<string[]>(["🍒", "🍋", "🍇"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [freeMode, setFreeMode] = useState(false);
  const { toast } = useToast();

  const tierInfo = TIERS.find(t => t.key === tier)!;

  // Mode latihan offline — tidak ada biaya, tidak ada perubahan saldo/kredit/storage real
  const simulateSpin = () => {
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

    setTimeout(() => {
      clearInterval(interval);
      const win = Math.random() < 0.3; // 30% peluang menang biar seru
      let finalReels: string[];
      let payout: any;
      if (win) {
        const tierRewards = TIER_REWARDS[tier];
        const pick = tierRewards[Math.floor(Math.random() * tierRewards.length)];
        const sym = Array.from(pick.sym)[0] || "💎";
        finalReels = [sym, sym, sym];
        payout = { type: "simulasi", label: `LATIHAN: ${pick.reward} (simulasi, tidak masuk akun)` };
      } else {
        let r1 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        let r2 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        let r3 = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        if (r1 === r2 && r2 === r3) r2 = SYMBOLS[(SYMBOLS.indexOf(r2) + 1) % SYMBOLS.length];
        finalReels = [r1, r2, r3];
        payout = { type: "none", label: "Belum hoki — coba lagi! (mode latihan)" };
      }
      setReels(finalReels);
      setResult(payout);
      setSpinning(false);
      if (payout.type !== "none") {
        toast({ title: "🎉 Latihan Menang!", description: payout.label });
      }
    }, animDuration);
  };

  const spin = async () => {
    if (freeMode) return simulateSpin();
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
        // Jika hadiah menambah power-up (mis. extra_life), refresh cache power-up
        if (data.payout.type === "extra_life") {
          import("./gameStore").then(m => m.syncPowerUpsFromServer()).catch(() => {});
          window.dispatchEvent(new CustomEvent("power-ups-updated"));
        }
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

      {/* Tier Selector — scrollable horizontal di mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {TIERS.map(t => (
          <button
            key={t.key}
            onClick={() => !spinning && setTier(t.key)}
            disabled={spinning}
            className={`relative flex-shrink-0 snap-start min-w-[80px] rounded-xl p-2 text-center border-2 transition-all ${
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

      {/* Tabel hadiah dinamis: hanya tier yang dipilih */}
      <div className="bg-muted/40 rounded-xl p-3 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-extrabold uppercase tracking-wide">
            💰 Hadiah Tier <span className={`bg-gradient-to-r ${tierInfo.gradient} bg-clip-text text-transparent`}>{tierInfo.label}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">3 simbol sama</div>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {TIER_REWARDS[tier].map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-background/60 rounded-lg px-3 py-1.5 border border-border/40">
              <span className="font-bold tracking-wider">{r.sym}</span>
              <span className="text-muted-foreground font-medium">{r.reward}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground italic mt-2 opacity-80">
          Saldo tetap langka walau Server Luck aktif. Booster hanya menaikkan peluang simbol langka.
        </div>
      </div>
    </div>
  );
}

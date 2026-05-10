import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Coins, Gift, Wifi, Cherry, Citrus, Grape, Bell, Star, Gem, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits, triggerGameCreditsRefresh } from "./GameCredits";
import { triggerGameBalanceRefresh } from "./GameBalance";
import { ServerLuckCard } from "./ServerLuckCard";
import { awardGamePoints } from "./gameStore";

// Symbol IDs - server tetap kirim emoji, kita map ke ikon
type SymId = "cherry" | "lemon" | "grape" | "bell" | "star" | "gem" | "seven";

const SYMBOL_IDS: SymId[] = ["cherry", "lemon", "grape", "bell", "star", "gem", "seven"];

// Map dari emoji (server response) ke SymId
const EMOJI_TO_ID: Record<string, SymId> = {
  "🍒": "cherry",
  "🍋": "lemon",
  "🍇": "grape",
  "🔔": "bell",
  "⭐": "star",
  "💎": "gem",
  "7️⃣": "seven",
  "7": "seven",
};

// Map dari SymId ke emoji untuk dikirim ke server / disimpan internal
const ID_TO_EMOJI: Record<SymId, string> = {
  cherry: "🍒",
  lemon: "🍋",
  grape: "🍇",
  bell: "🔔",
  star: "⭐",
  gem: "💎",
  seven: "7️⃣",
};

const toSymId = (s: string): SymId => EMOJI_TO_ID[s] || "cherry";

// Konfigurasi visual per simbol
const SYMBOL_CONFIG: Record<SymId, { Icon: any; gradient: string; iconColor: string; glow: string; label?: string }> = {
  cherry: { Icon: Cherry,  gradient: "from-rose-100 to-rose-200",       iconColor: "text-rose-600",     glow: "shadow-rose-400/40" },
  lemon:  { Icon: Citrus,  gradient: "from-yellow-100 to-amber-200",    iconColor: "text-amber-500",    glow: "shadow-amber-400/40" },
  grape:  { Icon: Grape,   gradient: "from-purple-100 to-violet-200",   iconColor: "text-violet-700",   glow: "shadow-violet-400/40" },
  bell:   { Icon: Bell,    gradient: "from-orange-100 to-yellow-200",   iconColor: "text-orange-500",   glow: "shadow-orange-400/40" },
  star:   { Icon: Star,    gradient: "from-yellow-50 to-yellow-200",    iconColor: "text-yellow-500",   glow: "shadow-yellow-400/50" },
  gem:    { Icon: Gem,     gradient: "from-cyan-100 to-sky-200",        iconColor: "text-cyan-600",     glow: "shadow-cyan-400/50" },
  seven:  { Icon: Crown,   gradient: "from-red-100 via-rose-200 to-amber-100", iconColor: "text-red-600", glow: "shadow-red-500/60", label: "7" },
};

// Komponen tampilan satu simbol di reel
const SymbolCell = ({ id, big = false }: { id: SymId; big?: boolean }) => {
  const cfg = SYMBOL_CONFIG[id];
  const Icon = cfg.Icon;
  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${cfg.gradient} rounded-lg flex items-center justify-center shadow-inner overflow-hidden`}>
      {/* highlight glossy */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/70 to-transparent pointer-events-none rounded-t-lg" />
      {id === "seven" ? (
        <div className="relative flex flex-col items-center">
          <Icon className={`w-5 h-5 ${cfg.iconColor} drop-shadow absolute -top-1`} fill="currentColor" />
          <span className={`font-black ${cfg.iconColor} drop-shadow ${big ? "text-4xl" : "text-2xl"} mt-2`} style={{ fontFamily: "Georgia, serif" }}>
            7
          </span>
        </div>
      ) : (
        <Icon
          className={`relative ${cfg.iconColor} drop-shadow ${big ? "w-12 h-12" : "w-7 h-7"}`}
          fill={id === "star" || id === "gem" || id === "cherry" || id === "grape" || id === "lemon" ? "currentColor" : "none"}
          strokeWidth={id === "bell" ? 2 : 1.5}
        />
      )}
    </div>
  );
};

// Komponen baris hadiah (3 simbol sama)
const RewardRow = ({ id }: { id: SymId }) => (
  <div className="flex items-center gap-1">
    {[0, 1, 2].map(i => (
      <div key={i} className="w-7 h-7">
        <SymbolCell id={id} />
      </div>
    ))}
  </div>
);

type Tier = "hemat" | "sedang" | "besar" | "mega" | "ultra" | "sultan" | "raja" | "dewa" | "legenda" | "maha";
const TIERS: { key: Tier; label: string; cost: number; gradient: string; desc: string }[] = [
  { key: "hemat",  label: "Hemat",  cost: 1,    gradient: "from-emerald-500 to-teal-600",  desc: "Jackpot Rp 300" },
  { key: "sedang", label: "Sedang", cost: 5,    gradient: "from-blue-500 to-indigo-600",   desc: "Jackpot Rp 600 + Bonus" },
  { key: "besar",  label: "Besar",  cost: 10,   gradient: "from-amber-500 to-rose-600",    desc: "Mega Jackpot Rp 1.500" },
  { key: "mega",   label: "Mega",   cost: 50,   gradient: "from-fuchsia-500 to-purple-700", desc: "Super Jackpot Rp 7.500" },
  { key: "ultra",  label: "Ultra",  cost: 100,  gradient: "from-rose-600 to-red-800",       desc: "Ultra Jackpot Rp 15.000" },
  { key: "sultan", label: "Sultan", cost: 200,  gradient: "from-yellow-500 to-amber-700",   desc: "Sultan Jackpot Rp 30.000" },
  { key: "raja",   label: "Raja",   cost: 500,  gradient: "from-violet-600 to-indigo-900",  desc: "Raja Jackpot Rp 75.000" },
  { key: "dewa",   label: "Dewa",   cost: 1000, gradient: "from-pink-600 via-red-600 to-yellow-500", desc: "DEWA Jackpot Rp 150.000" },
  { key: "legenda", label: "Legenda", cost: 5000, gradient: "from-orange-600 via-amber-600 to-yellow-500", desc: "LEGENDA Jackpot Rp 750.000" },
  { key: "maha",   label: "Maha",   cost: 10000, gradient: "from-red-700 via-rose-700 to-pink-500", desc: "MAHA Jackpot Rp 1.500.000" },
];

// Tabel hadiah per tier - pakai SymId
const TIER_REWARDS: Record<Tier, { sym: SymId; reward: string }[]> = {
  hemat: [
    { sym: "seven",  reward: "MAX Saldo Rp 300" },
    { sym: "gem",    reward: "5 kredit" },
    { sym: "star",   reward: "4 kredit" },
    { sym: "bell",   reward: "3 kredit" },
    { sym: "grape",  reward: "3 kredit" },
    { sym: "lemon",  reward: "2 kredit" },
    { sym: "cherry", reward: "2 kredit" },
  ],
  sedang: [
    { sym: "seven",  reward: "MAX Saldo Rp 600" },
    { sym: "gem",    reward: "Saldo Rp 300" },
    { sym: "star",   reward: "8 kredit" },
    { sym: "bell",   reward: "+50 MB storage" },
    { sym: "grape",  reward: "+1 Nyawa Ekstra" },
  ],
  besar: [
    { sym: "seven",  reward: "MAX Saldo Rp 1.500" },
    { sym: "gem",    reward: "Saldo Rp 600" },
    { sym: "star",   reward: "15 kredit" },
    { sym: "bell",   reward: "+100 MB storage" },
    { sym: "grape",  reward: "+2 Nyawa Ekstra" },
  ],
  mega: [
    { sym: "seven",  reward: "MAX Saldo Rp 7.500" },
    { sym: "gem",    reward: "Saldo Rp 3.000" },
    { sym: "star",   reward: "Saldo Rp 1.500" },
    { sym: "bell",   reward: "+250 MB storage" },
    { sym: "grape",  reward: "+5 Nyawa Ekstra" },
    { sym: "lemon",  reward: "60 kredit" },
    { sym: "cherry", reward: "40 kredit" },
  ],
  ultra: [
    { sym: "seven",  reward: "MAX Saldo Rp 15.000" },
    { sym: "gem",    reward: "Saldo Rp 6.000" },
    { sym: "star",   reward: "Saldo Rp 3.000" },
    { sym: "bell",   reward: "+500 MB storage" },
    { sym: "grape",  reward: "+10 Nyawa Ekstra" },
    { sym: "lemon",  reward: "130 kredit" },
    { sym: "cherry", reward: "90 kredit" },
  ],
  sultan: [
    { sym: "seven",  reward: "MAX Saldo Rp 30.000" },
    { sym: "gem",    reward: "Saldo Rp 12.000" },
    { sym: "star",   reward: "Saldo Rp 6.000" },
    { sym: "bell",   reward: "+1 GB storage" },
    { sym: "grape",  reward: "+20 Nyawa Ekstra" },
    { sym: "lemon",  reward: "260 kredit" },
    { sym: "cherry", reward: "180 kredit" },
  ],
  raja: [
    { sym: "seven",  reward: "MAX Saldo Rp 75.000" },
    { sym: "gem",    reward: "Saldo Rp 30.000" },
    { sym: "star",   reward: "Saldo Rp 15.000" },
    { sym: "bell",   reward: "+2.5 GB storage" },
    { sym: "grape",  reward: "+50 Nyawa Ekstra" },
    { sym: "lemon",  reward: "650 kredit" },
    { sym: "cherry", reward: "450 kredit" },
  ],
  dewa: [
    { sym: "seven",  reward: "MAX Saldo Rp 150.000" },
    { sym: "gem",    reward: "Saldo Rp 60.000" },
    { sym: "star",   reward: "Saldo Rp 30.000" },
    { sym: "bell",   reward: "+5 GB storage" },
    { sym: "grape",  reward: "+100 Nyawa Ekstra" },
    { sym: "lemon",  reward: "1.300 kredit" },
    { sym: "cherry", reward: "900 kredit" },
  ],
  legenda: [
    { sym: "seven",  reward: "MAX Saldo Rp 750.000" },
    { sym: "gem",    reward: "Saldo Rp 300.000" },
    { sym: "star",   reward: "Saldo Rp 150.000" },
    { sym: "bell",   reward: "+10 GB storage" },
    { sym: "grape",  reward: "+250 Nyawa Ekstra" },
    { sym: "lemon",  reward: "5.000 kredit" },
    { sym: "cherry", reward: "3.500 kredit" },
  ],
  maha: [
    { sym: "seven",  reward: "MAX Saldo Rp 1.500.000" },
    { sym: "gem",    reward: "Saldo Rp 600.000" },
    { sym: "star",   reward: "Saldo Rp 300.000" },
    { sym: "bell",   reward: "+20 GB storage" },
    { sym: "grape",  reward: "+500 Nyawa Ekstra" },
    { sym: "lemon",  reward: "10.000 kredit" },
    { sym: "cherry", reward: "7.000 kredit" },
  ],
};

const TIER_POINT_REWARDS: Record<Tier, number> = {
  hemat: 5, sedang: 10, besar: 16, mega: 28, ultra: 40, sultan: 60, raja: 90, dewa: 140, legenda: 250, maha: 400,
};

export default function SlotMachineGame() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, fetchCredits } = useGameCredits(visitorId);
  const [tier, setTier] = useState<Tier>("hemat");
  const [reels, setReels] = useState<SymId[]>(["cherry", "lemon", "grape"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [freeMode, setFreeMode] = useState(false);
  const { toast } = useToast();

  const tierInfo = TIERS.find(t => t.key === tier)!;

  const randomSym = (): SymId => SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)];

  // Mode latihan offline
  const simulateSpin = () => {
    setResult(null);
    setSpinning(true);
    const animDuration = 1500;
    const start = Date.now();
    const interval = setInterval(() => {
      setReels([randomSym(), randomSym(), randomSym()]);
      if (Date.now() - start >= animDuration) clearInterval(interval);
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      const win = Math.random() < 0.3;
      let finalReels: SymId[];
      let payout: any;
      if (win) {
        const tierRewards = TIER_REWARDS[tier];
        const pick = tierRewards[Math.floor(Math.random() * tierRewards.length)];
        finalReels = [pick.sym, pick.sym, pick.sym];
        payout = { type: "simulasi", label: `LATIHAN: ${pick.reward} (simulasi, tidak masuk akun)` };
      } else {
        let r1 = randomSym(), r2 = randomSym(), r3 = randomSym();
        if (r1 === r2 && r2 === r3) {
          const idx = SYMBOL_IDS.indexOf(r2);
          r2 = SYMBOL_IDS[(idx + 1) % SYMBOL_IDS.length];
        }
        finalReels = [r1, r2, r3];
        payout = { type: "none", label: "Belum hoki - coba lagi! (mode latihan)" };
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
      setReels([randomSym(), randomSym(), randomSym()]);
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
      const basePoints = TIER_POINT_REWARDS[tier] + (data.payout.type !== "none" ? Math.ceil(TIER_POINT_REWARDS[tier] * 0.5) : 0);
      const { awardedPoints } = awardGamePoints(basePoints);
      // server tetap kirim emoji - convert ke SymId
      setReels((data.reels as string[]).map(toSymId));
      setResult({ ...data.payout, awardedPoints });
      setSpinning(false);
      fetchCredits();
      triggerGameBalanceRefresh();
      triggerGameCreditsRefresh();
      if (data.payout.type !== "none") {
        toast({ title: "🎉 Menang!", description: `${data.payout.label} · +${awardedPoints} poin level` });
        if (data.payout.type === "extra_life") {
          import("./gameStore").then(m => m.syncPowerUpsFromServer()).catch(() => {});
          window.dispatchEvent(new CustomEvent("power-ups-updated"));
        }
      } else {
        toast({ title: "+Poin masuk", description: `Spin ini memberi +${awardedPoints} poin level` });
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

      {/* Toggle Mode Latihan / Asli */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border border-border/50">
        <button
          onClick={() => !spinning && setFreeMode(false)}
          disabled={spinning}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
            !freeMode ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Wifi className="w-3.5 h-3.5" /> Asli
        </button>
        <button
          onClick={() => !spinning && setFreeMode(true)}
          disabled={spinning}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
            freeMode ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Gift className="w-3.5 h-3.5" /> Latihan (GRATIS)
        </button>
      </div>

      {freeMode && (
        <div className="text-[11px] text-center bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg px-3 py-2 font-medium">
          🎮 Mode latihan offline - putar bebas tanpa biaya. Hadiah hanya simulasi & <b>tidak masuk ke akun</b> (kredit/saldo/storage tetap).
        </div>
      )}

      {/* Tier Selector */}
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

      {/* Mesin Slot - cabinet keren */}
      <div className="relative bg-gradient-to-b from-amber-700 via-amber-600 to-amber-800 rounded-3xl p-5 shadow-2xl border-4 border-amber-900">
        {/* lampu hias atas */}
        <div className="flex justify-center gap-1 mb-2">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <motion.div
              key={i}
              animate={spinning ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.5 }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08 }}
              className="w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_6px_rgba(253,224,71,0.8)]"
            />
          ))}
        </div>

        <div className="bg-black rounded-xl p-4 grid grid-cols-3 gap-2 border-2 border-amber-900/60 shadow-inner">
          {reels.map((sym, i) => {
            const isWin = result && result.type !== "none" && reels[0] === reels[1] && reels[1] === reels[2];
            const cfg = SYMBOL_CONFIG[sym];
            return (
              <motion.div
                key={i}
                animate={spinning ? { y: [0, -10, 0] } : isWin ? { scale: [1, 1.08, 1] } : {}}
                transition={spinning
                  ? { duration: 0.15, repeat: Infinity }
                  : isWin ? { duration: 0.6, repeat: Infinity, delay: i * 0.12 } : {}}
                className={`aspect-square rounded-lg ${isWin ? `shadow-lg ${cfg.glow}` : ""}`}
              >
                <SymbolCell id={sym} big />
              </motion.div>
            );
          })}
        </div>

        <Button
          onClick={spin}
          disabled={spinning || (!freeMode && !isUnlimited && credits < tierInfo.cost)}
          className={`w-full mt-4 h-14 text-lg font-black border-2 shadow-lg ${
            freeMode
              ? "bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-emerald-950 border-emerald-300"
              : "bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-amber-950 border-yellow-300"
          }`}
        >
          {spinning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : freeMode ? <Gift className="w-5 h-5 mr-2" /> : <Coins className="w-5 h-5 mr-2" />}
          {spinning ? "SPINNING..." : freeMode ? "PUTAR LATIHAN! (GRATIS)" : `PUTAR! (${tierInfo.cost} kredit)`}
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
          {result.awardedPoints ? <div className="text-xs font-black mt-1">+{result.awardedPoints} poin level</div> : null}
        </motion.div>
      )}

      {/* Tabel hadiah - pakai ikon */}
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
              <RewardRow id={r.sym} />
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

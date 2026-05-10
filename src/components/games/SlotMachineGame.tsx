import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Coins, Gift, Wifi, Cherry, Citrus, Grape, Bell, Star, Gem, Crown, Flame } from "lucide-react";
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

// Konfigurasi visual per simbol - bergaya Fruits 'N Fire (glossy, vivid, di panel gelap)
const SYMBOL_CONFIG: Record<SymId, { Icon: any; gradient: string; iconColor: string; glow: string; label?: string }> = {
  cherry: { Icon: Cherry,  gradient: "from-rose-400 via-red-500 to-rose-700",        iconColor: "text-red-100",      glow: "shadow-rose-500/70" },
  lemon:  { Icon: Citrus,  gradient: "from-yellow-300 via-amber-400 to-yellow-600",  iconColor: "text-yellow-50",    glow: "shadow-yellow-400/70" },
  grape:  { Icon: Grape,   gradient: "from-violet-400 via-purple-600 to-indigo-800", iconColor: "text-violet-100",   glow: "shadow-violet-500/70" },
  bell:   { Icon: Bell,    gradient: "from-yellow-300 via-amber-500 to-orange-700",  iconColor: "text-yellow-50",    glow: "shadow-amber-500/70" },
  star:   { Icon: Star,    gradient: "from-yellow-200 via-amber-400 to-orange-600",  iconColor: "text-yellow-50",    glow: "shadow-yellow-400/80" },
  gem:    { Icon: Gem,     gradient: "from-cyan-300 via-sky-500 to-blue-700",        iconColor: "text-cyan-50",      glow: "shadow-cyan-400/70" },
  seven:  { Icon: Crown,   gradient: "from-red-500 via-rose-600 to-red-900",         iconColor: "text-yellow-200",   glow: "shadow-red-500/80", label: "7" },
};

// Komponen tampilan satu simbol di reel - dark panel + glossy 3D look (Fruits 'N Fire vibe)
const SymbolCell = ({ id, big = false }: { id: SymId; big?: boolean }) => {
  const cfg = SYMBOL_CONFIG[id];
  const Icon = cfg.Icon;
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Glow halo di belakang simbol */}
      <div className={`absolute inset-2 rounded-full blur-xl opacity-60 bg-gradient-to-br ${cfg.gradient}`} />
      {id === "seven" ? (
        <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br ${cfg.gradient} ${big ? "w-[78%] h-[78%]" : "w-[80%] h-[80%]"} border border-yellow-300/50`}
          style={{ boxShadow: "inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.4)" }}>
          {/* glossy shine */}
          <div className="absolute inset-x-1 top-1 h-1/3 rounded-t-lg bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
          <span
            className={`relative font-black ${big ? "text-5xl" : "text-2xl"}`}
            style={{
              fontFamily: "Georgia, serif",
              color: "#fde047",
              textShadow: "0 0 6px rgba(250,204,21,0.8), 0 2px 0 #7f1d1d, 0 3px 0 #450a0a, 0 4px 6px rgba(0,0,0,0.7)",
              WebkitTextStroke: "1px #7f1d1d",
            }}
          >
            7
          </span>
        </div>
      ) : (
        <div className="relative flex items-center justify-center">
          <Icon
            className={`relative ${cfg.iconColor} ${big ? "w-16 h-16" : "w-9 h-9"}`}
            fill="currentColor"
            strokeWidth={1}
            style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.7)) drop-shadow(0 0 6px rgba(255,200,80,0.4))" }}
          />
          {/* highlight glossy di atas ikon */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 via-transparent to-transparent pointer-events-none" style={{ mixBlendMode: "overlay" }} />
        </div>
      )}
    </div>
  );
};

// Komponen baris hadiah (3 simbol sama) - mini panel gelap
const RewardRow = ({ id }: { id: SymId }) => (
  <div className="flex items-center gap-1">
    {[0, 1, 2].map(i => (
      <div key={i} className="w-9 h-9 rounded-md bg-gradient-to-b from-zinc-900 to-black border border-amber-500/30 p-0.5 shadow-inner">
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

// 8 payline pada 3x3 grid (sinkron dengan server)
const PAYLINES: { name: string; indices: number[]; color: string }[] = [
  { name: "row_top",   indices: [0, 1, 2], color: "#facc15" },
  { name: "row_mid",   indices: [3, 4, 5], color: "#f97316" },
  { name: "row_bot",   indices: [6, 7, 8], color: "#fb7185" },
  { name: "diag_down", indices: [0, 4, 8], color: "#22d3ee" },
  { name: "diag_up",   indices: [6, 4, 2], color: "#a78bfa" },
  { name: "col_left",  indices: [0, 3, 6], color: "#34d399" },
  { name: "col_mid",   indices: [1, 4, 7], color: "#f472b6" },
  { name: "col_right", indices: [2, 5, 8], color: "#fde047" },
];

export default function SlotMachineGame() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, fetchCredits } = useGameCredits(visitorId);
  const [tier, setTier] = useState<Tier>("hemat");
  const [grid, setGrid] = useState<SymId[]>(["cherry","lemon","grape","bell","star","gem","cherry","lemon","grape"]);
  const [winningLines, setWinningLines] = useState<{ name: string; indices: number[] }[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [freeMode, setFreeMode] = useState(false);
  const { toast } = useToast();

  const tierInfo = TIERS.find(t => t.key === tier)!;

  const randomSym = (): SymId => SYMBOL_IDS[Math.floor(Math.random() * SYMBOL_IDS.length)];

  const randomGrid = (): SymId[] => Array.from({ length: 9 }, () => randomSym());

  // Cek payline klien (untuk mode latihan)
  const findBestLineLocal = (g: SymId[]) => {
    for (const line of PAYLINES) {
      const a = g[line.indices[0]], b = g[line.indices[1]], c = g[line.indices[2]];
      if (a === b && b === c) return line;
    }
    return null;
  };

  // Mode latihan offline
  const simulateSpin = () => {
    setResult(null);
    setWinningLines([]);
    setSpinning(true);
    const animDuration = 1500;
    const start = Date.now();
    const interval = setInterval(() => {
      setGrid(randomGrid());
      if (Date.now() - start >= animDuration) clearInterval(interval);
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      const win = Math.random() < 0.45;
      let finalGrid: SymId[] = randomGrid();
      let payout: any;
      if (win) {
        const tierRewards = TIER_REWARDS[tier];
        const pick = tierRewards[Math.floor(Math.random() * tierRewards.length)];
        // Pilih random payline dan paksa simbol pick.sym di sana
        const line = PAYLINES[Math.floor(Math.random() * PAYLINES.length)];
        line.indices.forEach(i => { finalGrid[i] = pick.sym; });
        payout = { type: "simulasi", label: `LATIHAN: ${pick.reward} (simulasi, tidak masuk akun)` };
        setWinningLines([{ name: line.name, indices: line.indices }]);
      } else {
        // Pastikan tidak ada payline kebetulan
        let tries = 0;
        while (findBestLineLocal(finalGrid) && tries < 20) { finalGrid = randomGrid(); tries++; }
        payout = { type: "none", label: "Belum hoki - coba lagi! (mode latihan)" };
        setWinningLines([]);
      }
      setGrid(finalGrid);
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
    setWinningLines([]);
    setSpinning(true);

    const animDuration = 1500;
    const start = Date.now();
    const interval = setInterval(() => {
      setGrid(randomGrid());
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
      // server kirim grid (9 simbol) - convert ke SymId. Fallback ke baris tengah jika lama.
      const serverGrid = (data.grid as string[] | undefined) || (() => {
        const r = (data.reels as string[]) || [];
        return ["cherry","cherry","cherry", ...r, "cherry","cherry","cherry"];
      })();
      setGrid(serverGrid.map(toSymId));
      setWinningLines(((data.winningLines as any[]) || []).map(w => ({ name: w.name, indices: w.indices })));
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

      {/* Mesin Slot - cabinet api / Fruits 'N Fire style */}
      <div
        className="relative rounded-3xl p-4 sm:p-5 shadow-2xl overflow-hidden border-4 border-amber-900"
        style={{
          background:
            "radial-gradient(ellipse at top, #fbbf24 0%, #f97316 25%, #c2410c 55%, #7c2d12 100%)",
        }}
      >
        {/* tekstur api blur */}
        <div className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% 80%, rgba(250,204,21,0.6), transparent 35%), radial-gradient(circle at 90% 75%, rgba(249,115,22,0.7), transparent 40%), radial-gradient(circle at 50% 100%, rgba(220,38,38,0.5), transparent 50%)",
          }}
        />

        {/* Flame decoration sisi kiri */}
        <div className="pointer-events-none absolute left-1 top-1/4 bottom-1/4 flex flex-col justify-around z-10">
          {[0, 1, 2, 3].map(i => (
            <motion.div
              key={`l-${i}`}
              animate={{ scale: [1, 1.15, 1], rotate: [-3, 3, -3] }}
              transition={{ duration: 1.2 + i * 0.15, repeat: Infinity, ease: "easeInOut" }}
            >
              <Flame className="w-4 h-5 sm:w-5 sm:h-6 text-yellow-300" fill="currentColor" style={{ filter: "drop-shadow(0 0 4px rgba(250,204,21,0.9))" }} />
            </motion.div>
          ))}
        </div>
        {/* Flame decoration sisi kanan */}
        <div className="pointer-events-none absolute right-1 top-1/4 bottom-1/4 flex flex-col justify-around z-10">
          {[0, 1, 2, 3].map(i => (
            <motion.div
              key={`r-${i}`}
              animate={{ scale: [1, 1.15, 1], rotate: [3, -3, 3] }}
              transition={{ duration: 1.2 + i * 0.15, repeat: Infinity, ease: "easeInOut" }}
              style={{ transform: "scaleX(-1)" }}
            >
              <Flame className="w-4 h-5 sm:w-5 sm:h-6 text-yellow-300" fill="currentColor" style={{ filter: "drop-shadow(0 0 4px rgba(250,204,21,0.9))" }} />
            </motion.div>
          ))}
        </div>

        {/* Title bar di atas - "SLOTS ON FIRE" style */}
        <div className="relative z-10 flex items-center justify-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-yellow-300" fill="currentColor" />
          <h3
            className="text-center font-black tracking-[0.15em] text-base sm:text-lg uppercase"
            style={{
              fontFamily: "Georgia, serif",
              background: "linear-gradient(180deg, #fef9c3 0%, #facc15 40%, #f97316 80%, #b91c1c 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 2px 0 #7c2d12) drop-shadow(0 0 8px rgba(250,204,21,0.7))",
            }}
          >
            Slots On Fire
          </h3>
          <Flame className="w-5 h-5 text-yellow-300" fill="currentColor" style={{ transform: "scaleX(-1)" }} />
        </div>

        {/* lampu hias atas */}
        <div className="relative z-10 flex justify-center gap-1 mb-2">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <motion.div
              key={i}
              animate={spinning ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.6 }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08 }}
              className="w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_6px_rgba(253,224,71,0.9)]"
            />
          ))}
        </div>

        {/* Reel area - 3x3 grid dengan 8 payline */}
        <div
          className="relative z-10 rounded-xl p-2 border-2 border-amber-900/80 shadow-[inset_0_4px_12px_rgba(0,0,0,0.7)]"
          style={{ background: "linear-gradient(180deg, #1c1917 0%, #0c0a09 50%, #1c1917 100%)" }}
        >
          <div className="grid grid-cols-3 gap-1.5 relative">
            {grid.map((sym, i) => {
              const cfg = SYMBOL_CONFIG[sym];
              const winLine = winningLines.find(w => w.indices.includes(i));
              const isWin = !!winLine;
              return (
                <motion.div
                  key={i}
                  animate={spinning ? { y: [0, -10, 0] } : isWin ? { scale: [1, 1.08, 1] } : {}}
                  transition={spinning
                    ? { duration: 0.15, repeat: Infinity, delay: (i % 3) * 0.04 }
                    : isWin ? { duration: 0.6, repeat: Infinity, delay: (i % 3) * 0.12 } : {}}
                  className={`aspect-square rounded-md relative overflow-hidden ${isWin ? `shadow-lg ${cfg.glow} ring-2 ring-yellow-300/80` : ""}`}
                  style={{
                    background: "linear-gradient(180deg, #292524 0%, #1c1917 50%, #292524 100%)",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "6px 6px" }} />
                  <SymbolCell id={sym} />
                </motion.div>
              );
            })}

            {/* Overlay garis kemenangan */}
            {!spinning && winningLines.length > 0 && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 w-full h-full" style={{ zIndex: 5 }}>
                {winningLines.map((wl, idx) => {
                  const lineDef = PAYLINES.find(p => p.name === wl.name);
                  const color = lineDef?.color || "#facc15";
                  // pusat tiap sel pada viewBox 100x100 (3 kolom × 3 baris)
                  const centers = wl.indices.map(i => {
                    const r = Math.floor(i / 3), c = i % 3;
                    return { x: c * (100 / 3) + (100 / 6), y: r * (100 / 3) + (100 / 6) };
                  });
                  const d = centers.map((p, k) => `${k === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                  return (
                    <g key={`${wl.name}-${idx}`}>
                      <path d={d} stroke={color} strokeWidth="2" fill="none" opacity="0.35" strokeLinecap="round" />
                      <path d={d} stroke={color} strokeWidth="0.8" fill="none" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 1.5px ${color})` }} />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Legend payline saat menang */}
          {!spinning && winningLines.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 justify-center">
              {winningLines.map((wl, i) => {
                const lineDef = PAYLINES.find(p => p.name === wl.name);
                const labels: Record<string, string> = {
                  row_top: "Baris Atas", row_mid: "Baris Tengah", row_bot: "Baris Bawah",
                  diag_down: "Diagonal ↘", diag_up: "Diagonal ↗",
                  col_left: "Kolom Kiri", col_mid: "Kolom Tengah", col_right: "Kolom Kanan",
                };
                return (
                  <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{ color: lineDef?.color, borderColor: `${lineDef?.color}60`, background: `${lineDef?.color}15` }}>
                    {labels[wl.name] || wl.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <Button
          onClick={spin}
          disabled={spinning || (!freeMode && !isUnlimited && credits < tierInfo.cost)}
          className={`relative z-10 w-full mt-4 h-14 text-lg font-black border-2 shadow-lg ${
            freeMode
              ? "bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-emerald-950 border-emerald-300"
              : "bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-600 hover:from-yellow-400 hover:to-orange-700 text-amber-950 border-yellow-200"
          }`}
          style={!freeMode ? { boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.3), 0 4px 12px rgba(249,115,22,0.5)" } : undefined}
        >
          {spinning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : freeMode ? <Gift className="w-5 h-5 mr-2" /> : <Flame className="w-5 h-5 mr-2" fill="currentColor" />}
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

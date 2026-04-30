import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCompactNumber } from "@/lib/utils";
import {
  Rocket, Flame, Disc3, Trophy, Gem, Sparkles, Zap, Heart, Coins,
  Lightbulb, Timer, Shield, Loader2, X, Crown, Info, History, ChevronDown, ChevronUp, Trash2,
} from "lucide-react";

/**
 * 🔥 MEGA SPIN ARENA — 4 fitur spin baru di Luck Royale Nyawa:
 *   1) Mega Spin x10 (cinematic 10 reel sekaligus)
 *   2) Combo Streak Spin (multiplier x1→x2→x3→x5, reset bila MISS)
 *   3) Lucky Wheel Bonus Round (auto trigger setelah jackpot)
 *   4) Pity System: dijamin jackpot di spin ke-30
 *
 * Biaya: Gems (pakai RPC add_account_gems & add_account_credits).
 */

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

interface MiniPrize {
  kind: string;
  value: number;
  label: string;
  emoji: string;
  rarity: Rarity;
  weight: number;
}

interface Props {
  visitorId: string | null;
  gems: number;
  setGems: (n: number) => void;
}

const FALLBACK_POOL: MiniPrize[] = [
  { kind: "auto_hint", value: 2, label: "Hint", emoji: "💡", rarity: "common", weight: 22 },
  { kind: "extra_life", value: 2, label: "Nyawa", emoji: "❤️", rarity: "common", weight: 20 },
  { kind: "time_freeze", value: 2, label: "Time Freeze", emoji: "⏱️", rarity: "common", weight: 14 },
  { kind: "gems", value: 5, label: "Gem", emoji: "💎", rarity: "common", weight: 10 },
  { kind: "streak_coins", value: 100, label: "Koin Streak", emoji: "🪙", rarity: "rare", weight: 12 },
  { kind: "streak_freeze", value: 2, label: "Streak Freeze", emoji: "🛡️", rarity: "rare", weight: 8 },
  { kind: "gems", value: 15, label: "Gem", emoji: "💎", rarity: "rare", weight: 6 },
  { kind: "auto_hint", value: 8, label: "Hint", emoji: "💡", rarity: "epic", weight: 4 },
  { kind: "extra_life", value: 8, label: "Nyawa", emoji: "❤️", rarity: "epic", weight: 4 },
  { kind: "gems", value: 40, label: "Gem", emoji: "💎", rarity: "epic", weight: 2.5 },
  { kind: "streak_coins", value: 1000, label: "Koin Streak", emoji: "🪙", rarity: "legendary", weight: 1.8 },
  { kind: "gems", value: 100, label: "Gem", emoji: "💎", rarity: "legendary", weight: 1 },
  { kind: "streak_coins", value: 5000, label: "JACKPOT Koin", emoji: "👑", rarity: "mythic", weight: 0.18 },
  { kind: "gems", value: 300, label: "MEGA Gem", emoji: "💎", rarity: "mythic", weight: 0.12 },
];

const BONUS_WHEEL = [
  { label: "+5 Hint", emoji: "💡", kind: "auto_hint", value: 5, color: "from-cyan-500 to-blue-600" },
  { label: "+5 Nyawa", emoji: "❤️", kind: "extra_life", value: 5, color: "from-fuchsia-500 to-purple-600" },
  { label: "+500 Koin", emoji: "🪙", kind: "streak_coins", value: 500, color: "from-amber-400 to-orange-500" },
  { label: "+2 Freeze", emoji: "🛡️", kind: "streak_freeze", value: 2, color: "from-emerald-500 to-teal-600" },
  { label: "+3 Time", emoji: "⏱️", kind: "time_freeze", value: 3, color: "from-pink-500 to-rose-600" },
  { label: "+2.000 Koin", emoji: "👑", kind: "streak_coins", value: 2000, color: "from-yellow-300 via-amber-500 to-red-600" },
  { label: "+50 Gem", emoji: "💎", kind: "gems", value: 50, color: "from-violet-500 to-indigo-600" },
  { label: "+10 Hint", emoji: "💡", kind: "auto_hint", value: 10, color: "from-sky-400 to-cyan-600" },
];

const COMBO_TIERS = [1, 2, 3, 5];
const PITY_THRESHOLD = 30;

const COSTS = {
  combo: 10,
  mega: 75, // 10x lebih murah agar tidak terasa rugi
};

function rollPrize(pool: MiniPrize[]): MiniPrize {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[0];
}

function rarityRing(r: Rarity) {
  switch (r) {
    case "mythic": return "ring-2 ring-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.55)]";
    case "legendary": return "ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.5)]";
    case "epic": return "ring-2 ring-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.4)]";
    case "rare": return "ring-2 ring-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.35)]";
    default: return "ring-1 ring-slate-500/40";
  }
}

function rarityGrad(r: Rarity) {
  switch (r) {
    case "mythic": return "from-fuchsia-600 via-pink-500 to-amber-400";
    case "legendary": return "from-amber-400 via-orange-500 to-red-600";
    case "epic": return "from-fuchsia-500 to-purple-700";
    case "rare": return "from-cyan-500 to-blue-600";
    default: return "from-slate-600 to-slate-800";
  }
}

function isJackpot(p: MiniPrize) {
  return p.rarity === "mythic" || p.rarity === "legendary";
}

async function awardPrize(visitorId: string, p: MiniPrize, costGems = 0, multiplier = 1) {
  const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
    body: { visitorId, action: "mega_arena_award", prize: p, costGems, multiplier },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Gagal klaim hadiah");
  return Number(data?.gems || 0);
}

export default function MegaSpinArena({ visitorId, gems, setGems }: Props) {
  const { toast } = useToast();
  const [pool, setPool] = useState<MiniPrize[]>(FALLBACK_POOL);
  const [busy, setBusy] = useState<null | "combo" | "mega" | "bonus">(null);

  // === Combo Streak ===
  const [comboStreak, setComboStreak] = useState<number>(() => {
    const v = localStorage.getItem("mega_combo_streak");
    return v ? parseInt(v) || 0 : 0;
  });
  const [comboResult, setComboResult] = useState<{ prize: MiniPrize; mult: number; awarded: number } | null>(null);

  // === Pity ===
  const [pityCount, setPityCount] = useState<number>(() => {
    const v = localStorage.getItem("mega_pity_count");
    return v ? parseInt(v) || 0 : 0;
  });

  // === Mega Spin x10 ===
  const [megaResults, setMegaResults] = useState<MiniPrize[] | null>(null);
  const [megaReveal, setMegaReveal] = useState(0);
  const [megaSlowmo, setMegaSlowmo] = useState(false);

  // === Bonus Wheel ===
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusSpinning, setBonusSpinning] = useState(false);
  const [bonusAngle, setBonusAngle] = useState(0);
  const [bonusWon, setBonusWon] = useState<typeof BONUS_WHEEL[number] | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  // === Info & Riwayat ===
  type SpinHistoryEntry = {
    id: string;
    at: number;
    source: "combo" | "mega" | "bonus";
    prize: { kind: string; label: string; emoji: string; rarity: Rarity; value: number };
    awarded: number;
    multiplier?: number;
  };
  const [showInfo, setShowInfo] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SpinHistoryEntry[]>(() => {
    try {
      const v = localStorage.getItem("mega_spin_history");
      return v ? (JSON.parse(v) as SpinHistoryEntry[]) : [];
    } catch { return []; }
  });
  const pushHistory = (entries: SpinHistoryEntry[]) => {
    setHistory((prev) => {
      const next = [...entries, ...prev].slice(0, 100);
      try { localStorage.setItem("mega_spin_history", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem("mega_spin_history"); } catch {}
  };

  // Sinkron pool dari edge function existing (biar reward sama feel-nya)
  useEffect(() => {
    let mounted = true;
    if (!visitorId) return;
    supabase.functions
      .invoke("luck-royale-nyawa", { body: { visitorId, action: "check" } })
      .then(({ data }) => {
        if (!mounted) return;
        const prizes = (data?.prizes || []) as any[];
        if (Array.isArray(prizes) && prizes.length > 0) {
          // ambil semua hadiah yang bisa diklaim server: koin/nyawa/hint/freeze/gem.
          const filtered = prizes
            .filter((p) => p && ["extra_life", "auto_hint", "time_freeze", "streak_freeze", "streak_coins", "gems"].includes(p.kind))
            .map((p) => ({
              kind: p.kind,
              value: Number(p.value) || 1,
              label: p.label || p.kind,
              emoji: p.emoji || "🎁",
              rarity: (p.rarity || "common") as Rarity,
              weight: Number(p.weight) || 5,
            }));
          if (filtered.length >= 3) setPool(filtered);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [visitorId]);

  useEffect(() => { localStorage.setItem("mega_combo_streak", String(comboStreak)); }, [comboStreak]);
  useEffect(() => { localStorage.setItem("mega_pity_count", String(pityCount)); }, [pityCount]);

  const comboMult = useMemo(() => {
    const idx = Math.min(comboStreak, COMBO_TIERS.length - 1);
    return COMBO_TIERS[idx];
  }, [comboStreak]);
  const nextComboMult = useMemo(() => {
    const idx = Math.min(comboStreak + 1, COMBO_TIERS.length - 1);
    return COMBO_TIERS[idx];
  }, [comboStreak]);

  // Award + reload gems
  const refreshGems = async () => {
    if (!visitorId) return;
    const { data } = await supabase.rpc("get_account_gems", { p_visitor_id: visitorId });
    if (typeof data === "number") setGems(data);
  };

  const chargeGems = async (amount: number): Promise<boolean> => {
    if (!visitorId) return false;
    if (gems < amount) {
      toast({ title: "Gems kurang", description: `Butuh ${amount}💎 (kamu punya ${gems}).`, variant: "destructive" });
      return false;
    }
    const { data, error } = await supabase.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -amount });
    if (error) {
      toast({ title: "Gagal potong gems", description: error.message, variant: "destructive" });
      return false;
    }
    if (typeof data === "number") setGems(data);
    return true;
  };

  // ============ COMBO STREAK ============
  const playCombo = async () => {
    if (busy || !visitorId) return;
    setBusy("combo");
    setComboResult(null);
    // animasi singkat
    await new Promise((r) => setTimeout(r, 600));

    const prize = rollPrize(pool);
    const isMiss = prize.rarity === "common";
    const mult = isMiss ? 1 : comboMult;
    const awarded = prize.value * mult;

    try {
      const gemsAfter = await awardPrize(visitorId, prize, COSTS.combo, mult);
      setGems(gemsAfter);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || "Hadiah gagal diproses", variant: "destructive" });
      setBusy(null);
      return;
    }

    setComboResult({ prize, mult, awarded });
    pushHistory([{
      id: `${Date.now()}-c`,
      at: Date.now(),
      source: "combo",
      prize: { kind: prize.kind, label: prize.label, emoji: prize.emoji, rarity: prize.rarity, value: prize.value },
      awarded,
      multiplier: mult,
    }]);

    if (isMiss) {
      if (comboStreak > 0) {
        toast({ title: "💔 Combo putus!", description: `Streak ${comboStreak} hangus. Mulai lagi dari x1.` });
      }
      setComboStreak(0);
    } else {
      setComboStreak((s) => Math.min(s + 1, COMBO_TIERS.length - 1));
      if (mult >= 3) {
        toast({ title: `🔥 COMBO x${mult}!`, description: `+${awarded} ${prize.label}` });
      }
    }
    setBusy(null);
  };

  // ============ MEGA SPIN x10 (cinematic) ============
  const playMega = async () => {
    if (busy || !visitorId) return;
    setBusy("mega");
    setMegaResults(null);
    setMegaReveal(0);
    setMegaSlowmo(false);

    if (gems < COSTS.mega) {
      toast({ title: "Gems kurang", description: `Butuh ${COSTS.mega}💎 (kamu punya ${gems}).`, variant: "destructive" });
      setBusy(null);
      return;
    }

    // Roll 10x dengan pity injection
    const results: MiniPrize[] = [];
    let localPity = pityCount;
    for (let i = 0; i < 10; i++) {
      let p: MiniPrize;
      if (localPity + 1 >= PITY_THRESHOLD) {
        // Force jackpot: pick mythic/legendary dari pool
        const jackpots = pool.filter(isJackpot);
        p = jackpots.length ? jackpots[Math.floor(Math.random() * jackpots.length)] : rollPrize(pool);
        localPity = 0;
      } else {
        p = rollPrize(pool);
        if (isJackpot(p)) localPity = 0;
        else localPity += 1;
      }
      results.push(p);
    }
    setPityCount(localPity);

    // Reveal cinematic: 1 per ~250ms, slow-mo di kartu jackpot
    setMegaResults(results);
    for (let i = 0; i < results.length; i++) {
      const cur = results[i];
      const slow = isJackpot(cur);
      setMegaSlowmo(slow);
      await new Promise((r) => setTimeout(r, slow ? 700 : 220));
      setMegaReveal(i + 1);
    }
    setMegaSlowmo(false);

    // Award semuanya
    for (let i = 0; i < results.length; i++) {
      const p = results[i];
      try {
        const gemsAfter = await awardPrize(visitorId, p, i === 0 ? COSTS.mega : 0);
        setGems(gemsAfter);
      } catch (e: any) {
        toast({ title: "Gagal", description: e.message || "Hadiah gagal diproses", variant: "destructive" });
        setBusy(null);
        return;
      }
    }
    await refreshGems();

    pushHistory(results.map((p, i) => ({
      id: `${Date.now()}-m-${i}`,
      at: Date.now() + i,
      source: "mega" as const,
      prize: { kind: p.kind, label: p.label, emoji: p.emoji, rarity: p.rarity, value: p.value },
      awarded: p.value,
    })));

    const jackpots = results.filter(isJackpot).length;
    if (jackpots > 0) {
      toast({ title: `🎉 MEGA SPIN — ${jackpots} JACKPOT!`, description: `10 hadiah masuk akun.` });
      // Trigger bonus wheel bila ada jackpot
      setTimeout(() => setBonusOpen(true), 600);
    } else {
      toast({ title: "✅ Mega Spin selesai", description: `10 hadiah masuk akun.` });
    }
    setBusy(null);
  };

  // ============ LUCKY WHEEL BONUS ============
  const spinBonusWheel = async () => {
    if (bonusSpinning || !visitorId) return;
    setBonusSpinning(true);
    setBonusWon(null);
    const slice = 360 / BONUS_WHEEL.length;
    const idx = Math.floor(Math.random() * BONUS_WHEEL.length);
    const turns = 5;
    const target = turns * 360 + (360 - (idx * slice + slice / 2));
    setBonusAngle(target);
    await new Promise((r) => setTimeout(r, 4200));
    const won = BONUS_WHEEL[idx];
    setBonusWon(won);
    await awardPrize(visitorId, { ...won, rarity: won.kind === "gems" ? "legendary" : "rare", weight: 1 } as MiniPrize);
    await refreshGems();
    setBonusSpinning(false);
  };

  return (
    <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-[#1a0820] via-[#2a0e3d] to-[#1a0820] p-3 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-400" />
          <h2 className="font-black text-sm tracking-widest bg-gradient-to-r from-amber-300 via-pink-300 to-fuchsia-300 bg-clip-text text-transparent">
            MEGA SPIN ARENA
          </h2>
        </div>
        <div className="text-[10px] font-bold text-amber-300/80 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
          NEW
        </div>
      </div>

      {/* PITY BAR */}
      <div className="rounded-xl bg-black/40 border border-amber-500/30 p-2.5 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] font-bold text-amber-200">Pity Jackpot</span>
          </div>
          <span className="text-[11px] font-black tabular-nums text-amber-200">
            {pityCount}/{PITY_THRESHOLD}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden border border-amber-500/20">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 transition-all duration-500"
            style={{
              width: `${Math.min(100, (pityCount / PITY_THRESHOLD) * 100)}%`,
              boxShadow: pityCount >= PITY_THRESHOLD - 5 ? "0 0 12px rgba(251,191,36,0.8)" : undefined,
            }}
          />
        </div>
        <div className="text-[9px] text-amber-200/60 mt-1">
          {pityCount >= PITY_THRESHOLD - 1
            ? "🔥 Spin Mega berikutnya DIJAMIN JACKPOT!"
            : `Spin Mega lagi ${Math.max(0, PITY_THRESHOLD - pityCount)}x untuk jackpot dijamin`}
        </div>
      </div>

      {/* COMBO STREAK */}
      <div className="rounded-xl bg-gradient-to-br from-fuchsia-900/40 to-purple-900/40 border border-fuchsia-500/40 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-fuchsia-300" fill="currentColor" />
            <span className="text-xs font-black text-fuchsia-100">COMBO STREAK</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {COMBO_TIERS.map((m, i) => (
              <div
                key={i}
                className={`px-1.5 py-0.5 rounded font-black tabular-nums transition-all ${
                  i <= comboStreak
                    ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-[0_0_8px_rgba(232,121,249,0.6)]"
                    : "bg-slate-800/60 text-slate-500"
                }`}
              >
                x{m}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-fuchsia-200/70 mb-2">
          Multiplier sekarang: <span className="text-fuchsia-200 font-black">x{comboMult}</span>
          {comboStreak < COMBO_TIERS.length - 1 && (
            <> · Berikutnya: x{nextComboMult} (jika tidak MISS)</>
          )}
          <br />Hadiah utama: koin streak, nyawa, hint, freeze. Gem hanya bonus langka.
        </div>

        {comboResult && (
          <div className={`mb-2 rounded-lg p-2 bg-gradient-to-r ${rarityGrad(comboResult.prize.rarity)} ${rarityRing(comboResult.prize.rarity)} flex items-center gap-2 animate-scale-in`}>
            <div className="text-2xl">{comboResult.prize.emoji}</div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider opacity-80 font-bold">{comboResult.prize.rarity}</div>
              <div className="font-black text-sm">+{comboResult.awarded} {comboResult.prize.label}</div>
            </div>
            <div className="text-xs font-black bg-black/40 px-2 py-1 rounded-full">x{comboResult.mult}</div>
          </div>
        )}

        <Button
          disabled={busy !== null}
          onClick={playCombo}
          className="w-full h-11 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-black"
        >
          {busy === "combo" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
            <Zap className="w-4 h-4" /> COMBO SPIN · {COSTS.combo}💎
          </>}
        </Button>
      </div>

      {/* MEGA x10 */}
      <div className="rounded-xl bg-gradient-to-br from-amber-900/40 via-orange-900/40 to-red-900/40 border-2 border-amber-500/50 p-3 mb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Rocket className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-black text-amber-100">MEGA SPIN x10</span>
          </div>
          <div className="text-[10px] font-bold text-amber-200/80 px-2 py-0.5 rounded-full bg-amber-500/20">
            CINEMATIC
          </div>
        </div>
        <div className="text-[10px] text-amber-200/70 mb-2">
          10 spin sekaligus · biaya lebih murah · hadiah masuk akun semua
        </div>

        <div className="grid grid-cols-5 gap-1 mb-2 text-[9px] font-black text-center">
          {["🪙 Koin", "❤️ Nyawa", "💡 Hint", "🛡️ Freeze", "💎 Gem"].map((x) => (
            <div key={x} className="rounded-md bg-black/30 border border-amber-400/20 px-1 py-1 text-amber-100 truncate">{x}</div>
          ))}
        </div>

        {/* Grid 10 hasil */}
        {megaResults && (
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {megaResults.map((p, i) => {
              const revealed = i < megaReveal;
              const slow = megaSlowmo && i === megaReveal;
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all duration-300 ${
                    revealed
                      ? `bg-gradient-to-br ${rarityGrad(p.rarity)} ${rarityRing(p.rarity)} ${isJackpot(p) ? "animate-pulse" : ""}`
                      : "bg-slate-800/60 border border-slate-600/40 animate-pulse"
                  } ${slow ? "scale-110" : ""}`}
                  style={revealed ? { animation: "scaleIn 0.3s ease-out" } : undefined}
                >
                  {revealed ? (
                    <>
                      <div className="text-lg leading-none">{p.emoji}</div>
                      <div className="text-[8px] font-black tabular-nums leading-tight">+{p.value}</div>
                    </>
                  ) : (
                    <Disc3 className="w-4 h-4 text-slate-500 animate-spin" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Button
          disabled={busy !== null}
          onClick={playMega}
          className="w-full h-12 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:via-orange-400 hover:to-red-400 text-white font-black tracking-wider shadow-[0_0_20px_rgba(251,146,60,0.5)]"
        >
          {busy === "mega" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>
            <Rocket className="w-4 h-4" /> MEGA SPIN x10 · {COSTS.mega}💎
          </>}
        </Button>
      </div>

      {/* BONUS WHEEL MODAL */}
      {bonusOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-amber-900 via-orange-900 to-red-900 border-2 border-amber-400 p-5 shadow-[0_0_60px_rgba(251,191,36,0.5)]">
            <button
              onClick={() => { if (!bonusSpinning) setBonusOpen(false); }}
              className="absolute top-3 right-3 text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-3">
              <div className="text-3xl mb-1">🎡</div>
              <h3 className="font-black text-base text-amber-100">LUCKY WHEEL BONUS</h3>
              <p className="text-[10px] text-amber-200/70">Hadiah ekstra setelah jackpot!</p>
            </div>

            <div className="relative w-64 h-64 mx-auto mb-4">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
                <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
              </div>
              {/* Wheel */}
              <div
                ref={wheelRef}
                className="w-full h-full rounded-full overflow-hidden border-4 border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.6)] relative"
                style={{
                  transform: `rotate(${bonusAngle}deg)`,
                  transition: bonusSpinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.16, 0.99)" : "none",
                  background: `conic-gradient(${BONUS_WHEEL.map((s, i) => {
                    const start = (i * 360) / BONUS_WHEEL.length;
                    const end = ((i + 1) * 360) / BONUS_WHEEL.length;
                    const colors = ["#06b6d4", "#a855f7", "#f59e0b", "#10b981", "#ec4899", "#eab308", "#6366f1", "#0ea5e9"];
                    return `${colors[i % colors.length]} ${start}deg ${end}deg`;
                  }).join(", ")})`,
                }}
              >
                {BONUS_WHEEL.map((s, i) => {
                  const angle = (i * 360) / BONUS_WHEEL.length + 360 / BONUS_WHEEL.length / 2;
                  return (
                    <div
                      key={i}
                      className="absolute top-1/2 left-1/2 origin-left text-white font-black text-[10px] flex items-center gap-0.5 whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      style={{
                        transform: `translateY(-50%) rotate(${angle}deg) translateX(28%)`,
                      }}
                    >
                      <span className="text-base">{s.emoji}</span>
                      <span>{s.label}</span>
                    </div>
                  );
                })}
              </div>
              {/* Hub */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-orange-600 border-2 border-white shadow-lg flex items-center justify-center z-10">
                <Crown className="w-5 h-5 text-white" fill="currentColor" />
              </div>
            </div>

            {bonusWon && (
              <div className="rounded-xl bg-black/40 border border-amber-400/50 p-3 mb-3 text-center animate-scale-in">
                <div className="text-3xl mb-1">{bonusWon.emoji}</div>
                <div className="text-[10px] uppercase tracking-wider text-amber-200/80 font-bold">Hadiah Bonus</div>
                <div className="font-black text-amber-100">{bonusWon.label}</div>
              </div>
            )}

            {!bonusWon ? (
              <Button
                disabled={bonusSpinning}
                onClick={spinBonusWheel}
                className="w-full h-12 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black"
              >
                {bonusSpinning ? <><Loader2 className="w-4 h-4 animate-spin" /> Memutar...</> : <><Sparkles className="w-4 h-4" /> PUTAR RODA</>}
              </Button>
            ) : (
              <Button
                onClick={() => setBonusOpen(false)}
                className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black"
              >
                <Trophy className="w-4 h-4" /> KLAIM & TUTUP
              </Button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

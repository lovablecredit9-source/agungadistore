import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Crown, Gem, Loader2, Sparkles, Gift, Flame } from "lucide-react";

/**
 * 👑 PREMIUM SPIN PANEL
 * - 200 gem / spin
 * - Hadiah 5x lipat (server multiplier=5) + jackpot besar
 * - 2 free premium spin / hari (reset 00:00 WIB)
 */

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

interface PremiumPrize {
  kind: string;
  value: number;
  label: string;
  emoji: string;
  rarity: Rarity;
  weight: number;
}

const PREMIUM_POOL: PremiumPrize[] = [
  // Common ringan
  { kind: "auto_hint", value: 5, label: "Hint", emoji: "💡", rarity: "common", weight: 18 },
  { kind: "extra_life", value: 5, label: "Nyawa", emoji: "❤️", rarity: "common", weight: 16 },
  { kind: "time_freeze", value: 5, label: "Time Freeze", emoji: "⏱️", rarity: "common", weight: 12 },
  { kind: "gems", value: 25, label: "Gem", emoji: "💎", rarity: "common", weight: 10 },
  // Rare
  { kind: "streak_coins", value: 500, label: "Koin Streak", emoji: "🪙", rarity: "rare", weight: 14 },
  { kind: "streak_freeze", value: 5, label: "Streak Freeze", emoji: "🛡️", rarity: "rare", weight: 9 },
  { kind: "gems", value: 75, label: "Gem", emoji: "💎", rarity: "rare", weight: 7 },
  // Epic
  { kind: "auto_hint", value: 25, label: "Hint", emoji: "💡", rarity: "epic", weight: 5 },
  { kind: "extra_life", value: 25, label: "Nyawa", emoji: "❤️", rarity: "epic", weight: 5 },
  { kind: "gems", value: 200, label: "Gem", emoji: "💎", rarity: "epic", weight: 3.5 },
  // Legendary
  { kind: "streak_coins", value: 5000, label: "Koin Streak", emoji: "🪙", rarity: "legendary", weight: 2.2 },
  { kind: "gems", value: 500, label: "Gem", emoji: "💎", rarity: "legendary", weight: 1.4 },
  // Mythic — JACKPOT BESAR (5x lipat dari arena normal)
  { kind: "streak_coins", value: 25000, label: "MEGA JACKPOT Koin", emoji: "👑", rarity: "mythic", weight: 0.35 },
  { kind: "gems", value: 1500, label: "ULTRA Gem", emoji: "💎", rarity: "mythic", weight: 0.2 },
];

const PREMIUM_COST = 200;
const FREE_PER_DAY = 2;

function rollPrize(pool: PremiumPrize[]): PremiumPrize {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[0];
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

function rarityRing(r: Rarity) {
  switch (r) {
    case "mythic": return "ring-2 ring-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.55)]";
    case "legendary": return "ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.5)]";
    case "epic": return "ring-2 ring-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.4)]";
    case "rare": return "ring-2 ring-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.35)]";
    default: return "ring-1 ring-slate-500/40";
  }
}

// Tanggal WIB (UTC+7) sebagai key harian
function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + (now.getTimezoneOffset() + 7 * 60) * 60000);
  return wib.toISOString().slice(0, 10);
}

const FREE_KEY_PREFIX = "premium_spin_free_";

function getFreeUsedToday(): number {
  try {
    const k = FREE_KEY_PREFIX + todayWIB();
    const v = localStorage.getItem(k);
    return v ? parseInt(v) || 0 : 0;
  } catch { return 0; }
}

function bumpFreeUsed(): number {
  const used = getFreeUsedToday() + 1;
  try { localStorage.setItem(FREE_KEY_PREFIX + todayWIB(), String(used)); } catch {}
  return used;
}

interface Props {
  visitorId: string | null;
  gems: number;
  setGems: (n: number) => void;
  isUnlocked: boolean;
  expiresAt?: string | null;
  price?: number;
}

export default function PremiumSpinPanel({ visitorId, gems, setGems, isUnlocked, expiresAt, price = 50000 }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [freeUsed, setFreeUsed] = useState(getFreeUsedToday());
  const [lastResult, setLastResult] = useState<{ prize: PremiumPrize; awarded: number; isFree: boolean } | null>(null);
  const [reelSpinning, setReelSpinning] = useState(false);

  // Refresh free counter saat hari berganti
  useEffect(() => {
    const id = setInterval(() => {
      const u = getFreeUsedToday();
      setFreeUsed((prev) => (prev !== u ? u : prev));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const freeRemaining = Math.max(0, FREE_PER_DAY - freeUsed);

  const refreshGems = async () => {
    if (!visitorId) return;
    const { data } = await supabase.rpc("get_account_gems", { p_visitor_id: visitorId });
    if (typeof data === "number") setGems(data);
  };

  const doSpin = async (useFree: boolean) => {
    if (busy || !visitorId) return;
    if (!isUnlocked) {
      toast({ title: "🔒 Premium belum aktif", description: `Beli akses Premium Rp ${price.toLocaleString("id-ID")} dulu di tab NORMAL (kartu Nyawa Premium).`, variant: "destructive" });
      return;
    }
    if (useFree && freeRemaining <= 0) {
      toast({ title: "Free spin habis", description: `Sudah pakai ${FREE_PER_DAY}x premium spin gratis hari ini. Reset 00:00 WIB.`, variant: "destructive" });
      return;
    }
    if (!useFree && gems < PREMIUM_COST) {
      toast({ title: "Gem kurang", description: `Butuh ${PREMIUM_COST}💎 (kamu punya ${gems}).`, variant: "destructive" });
      return;
    }

    setBusy(true);
    setReelSpinning(true);
    setLastResult(null);

    // Animasi pseudo "spin"
    await new Promise((r) => setTimeout(r, 900));

    const prize = rollPrize(PREMIUM_POOL);
    const multiplier = 5; // hadiah 5x lipat
    const awarded = prize.value * multiplier;

    try {
      const costGems = useFree ? 0 : PREMIUM_COST;
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "mega_arena_award", prize, costGems, multiplier },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Gagal proses hadiah");
      }
      if (typeof (data as any)?.gems === "number") setGems(Number((data as any).gems));
      else await refreshGems();
    } catch (e: any) {
      toast({ title: "Gagal Premium Spin", description: e.message || "Terjadi kesalahan", variant: "destructive" });
      setBusy(false);
      setReelSpinning(false);
      return;
    }

    if (useFree) {
      const u = bumpFreeUsed();
      setFreeUsed(u);
    }

    setReelSpinning(false);
    setLastResult({ prize, awarded, isFree: useFree });

    if (prize.rarity === "mythic" || prize.rarity === "legendary") {
      toast({ title: `🎉 ${prize.rarity.toUpperCase()}!`, description: `+${awarded} ${prize.label}` });
    } else {
      toast({ title: useFree ? "✨ Free Premium Spin" : "✨ Premium Spin", description: `+${awarded} ${prize.label}` });
    }

    setBusy(false);
  };

  return (
    <div className="rounded-2xl border-2 border-fuchsia-500/50 bg-gradient-to-br from-[#1a0420] via-[#2a0840] to-[#1a0420] p-3 shadow-[0_0_30px_rgba(232,121,249,0.2)] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-fuchsia-300" fill="currentColor" />
          <h2 className="font-black text-sm tracking-widest bg-gradient-to-r from-fuchsia-300 via-pink-300 to-amber-300 bg-clip-text text-transparent">
            PREMIUM SPIN
          </h2>
        </div>
        <div className="text-[10px] font-bold text-fuchsia-200/90 px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/40">
          5× HADIAH
        </div>
      </div>

      {/* Status Banner: Locked vs Active */}
      {isUnlocked ? (
        <div className="rounded-xl bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-cyan-600/30 border-2 border-emerald-400/60 px-3 py-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
            <Crown className="w-4 h-4 text-emerald-200" fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-black text-emerald-100 tracking-wide">PREMIUM AKTIF ✨</div>
            <div className="text-[9px] text-emerald-200/80 truncate">
              {expiresAt ? `Berakhir: ${new Date(expiresAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })} WIB` : "Akses penuh aktif"}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gradient-to-r from-rose-700/40 via-red-700/40 to-orange-700/40 border-2 border-rose-400/60 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-rose-500/30 flex items-center justify-center text-lg">🔒</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-black text-rose-100 tracking-wide">PREMIUM TERKUNCI</div>
              <div className="text-[10px] text-rose-200/90">
                Wajib beli akses Rp <span className="font-black">{price.toLocaleString("id-ID")}</span> / 24 jam dulu
              </div>
            </div>
          </div>
          <Button
            onClick={() => {
              // Pindah ke tab Normal, lalu scroll ke kartu Nyawa Premium
              const normalTab = document.querySelector<HTMLElement>('[role="tab"][value="normal"]');
              if (normalTab) normalTab.click();
              setTimeout(() => {
                const card = document.querySelector('[data-nyawa-premium-card]');
                if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 200);
            }}
            className="w-full h-10 bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 hover:from-amber-500 hover:via-orange-600 hover:to-red-700 text-white font-black text-[12px] tracking-wider"
          >
            🔓 BELI AKSES Rp {price.toLocaleString("id-ID")}
          </Button>
          <div className="text-[9px] text-rose-200/70 text-center mt-1.5">
            Setelah aktif: 2× free spin/hari + bisa spin gem dengan hadiah 5× lipat
          </div>
        </div>
      )}

      {/* Showcase */}
      <div className="relative rounded-xl bg-black/40 border border-fuchsia-500/30 overflow-hidden">
        <div className="aspect-[16/9] flex items-center justify-center bg-gradient-to-br from-fuchsia-900/40 via-purple-900/30 to-amber-900/30">
          {reelSpinning ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-10 h-10 text-fuchsia-300 animate-spin" />
              <div className="text-[11px] font-black tracking-widest text-fuchsia-200">MEMUTAR...</div>
            </div>
          ) : lastResult ? (
            <div className={`text-center px-4 py-3 rounded-xl bg-gradient-to-br ${rarityGrad(lastResult.prize.rarity)} ${rarityRing(lastResult.prize.rarity)} animate-scale-in`}>
              <div className="text-5xl mb-1 drop-shadow">{lastResult.prize.emoji}</div>
              <div className="text-[9px] uppercase tracking-widest font-black opacity-80 text-white">{lastResult.prize.rarity}</div>
              <div className="text-base font-black text-white drop-shadow">+{lastResult.awarded} {lastResult.prize.label}</div>
              <div className="text-[10px] text-white/80 font-bold mt-0.5">x5 Multiplier{lastResult.isFree ? " · 🎁 FREE" : ""}</div>
            </div>
          ) : (
            <div className="text-center px-4">
              <Sparkles className="w-10 h-10 text-fuchsia-300 mx-auto mb-1" />
              <div className="text-xs font-black tracking-widest text-fuchsia-100">JACKPOT MEGA</div>
              <div className="text-[10px] text-fuchsia-200/70 mt-0.5">Sampai +25.000 Koin · 1.500 Gem</div>
            </div>
          )}
        </div>
      </div>

      {/* Free Spin */}
      <button
        disabled={busy || !isUnlocked || freeRemaining <= 0}
        onClick={() => doSpin(true)}
        className={`w-full relative overflow-hidden rounded-xl px-3 py-3 font-black active:scale-95 transition disabled:opacity-50 flex items-center justify-between ${
          freeRemaining > 0
            ? "bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-300/50 animate-pulse"
            : "bg-slate-700 text-slate-300"
        }`}
      >
        <span className="flex items-center gap-2 text-sm tracking-widest">
          <Gift className="w-4 h-4" />
          FREE PREMIUM SPIN
        </span>
        <span className="text-xs bg-black/30 rounded-full px-2 py-0.5">
          {freeRemaining}/{FREE_PER_DAY} hari ini
        </span>
      </button>

      {/* Paid Spin */}
      <button
        disabled={busy || gems < PREMIUM_COST}
        onClick={() => doSpin(false)}
        className="w-full relative overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-amber-500 px-3 py-4 font-black shadow-lg shadow-fuchsia-500/50 active:scale-95 transition disabled:opacity-50 flex items-center justify-between text-white ring-2 ring-amber-300/50"
      >
        <span className="flex items-center gap-2 text-base tracking-widest">
          <Flame className="w-5 h-5" />
          PREMIUM SPIN
        </span>
        <span className="flex items-center gap-1 text-sm bg-black/40 rounded-full px-2.5 py-1">
          <Gem className="w-3.5 h-3.5" /> {PREMIUM_COST}
        </span>
      </button>

      <p className="text-center text-[10px] text-fuchsia-200/70">
        Hadiah <span className="font-black text-fuchsia-200">5× lipat</span> · Mahal tapi worth it · Free 2× per hari (reset 00:00 WIB)
      </p>

      {/* Pool Preview */}
      <div className="rounded-xl bg-black/30 border border-fuchsia-500/20 p-2">
        <div className="text-[10px] font-black tracking-widest text-fuchsia-200/80 mb-1.5">JACKPOT UTAMA (5×)</div>
        <div className="grid grid-cols-2 gap-1.5">
          {PREMIUM_POOL.filter((p) => p.rarity === "mythic" || p.rarity === "legendary").map((p, i) => (
            <div key={i} className={`rounded-lg p-1.5 bg-gradient-to-r ${rarityGrad(p.rarity)} ${rarityRing(p.rarity)} flex items-center gap-1.5`}>
              <div className="text-base">{p.emoji}</div>
              <div className="min-w-0">
                <div className="text-[10px] font-black text-white truncate">+{(p.value * 5).toLocaleString("id-ID")}</div>
                <div className="text-[8px] uppercase tracking-wider opacity-80 font-bold text-white">{p.rarity}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scaleIn 0.4s ease-out; }
      `}</style>
    </div>
  );
}

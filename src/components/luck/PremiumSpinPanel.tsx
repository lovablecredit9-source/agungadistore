import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Crown, Gem, Loader2, Sparkles, Gift, Flame, Heart, Lightbulb, Timer, Shield, Coins, KeyRound, WalletCards, Ticket, X, Zap } from "lucide-react";
import PremiumMilestonePanel from "./PremiumMilestonePanel";

/**
 * 👑 PREMIUM SPIN PANEL
 * - Wajib Nyawa Premium aktif (Rp 50.000 / 30 hari)
 * - 2 free premium spin / hari (reset 00:00 WIB)
 * - Paket spin gem dengan diskon volume:
 *   1=100, 5=300, 10=500, 20=800, 50=2k, 100=3k, 200=5k, 500=8k, 1000=15k
 * - Pool variatif: hint, nyawa, time freeze, streak coin, kredit game, saldo IN, gem
 *   + Mega Jackpot (50.000 koin / Rp 50.000 saldo / 2.000 gem / 100 kredit)
 */

type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

interface PremiumPack { count: number; cost: number; badge?: string; perSpin: number; }
const PACKS: PremiumPack[] = [
  { count: 1,    cost: 100,   perSpin: 100 },
  { count: 5,    cost: 300,   perSpin: 60,  badge: "HEMAT 40%" },
  { count: 10,   cost: 500,   perSpin: 50,  badge: "HEMAT 50%" },
  { count: 20,   cost: 800,   perSpin: 40,  badge: "HEMAT 60%" },
  { count: 50,   cost: 2000,  perSpin: 40,  badge: "POPULER" },
  { count: 100,  cost: 3000,  perSpin: 30,  badge: "HEMAT 70%" },
  { count: 200,  cost: 5000,  perSpin: 25,  badge: "HEMAT 75%" },
  { count: 500,  cost: 8000,  perSpin: 16,  badge: "MEGA" },
  { count: 1000, cost: 15000, perSpin: 15,  badge: "ULTRA 🔥" },
];

const FREE_PER_DAY = 2;

const PRIZE_POOL: { rarity: Rarity; chance: string; prizes: { emoji: string; label: string }[] }[] = [
  { rarity: "mythic", chance: "JACKPOT", prizes: [
    { emoji: "💎", label: "8.000–100.000 Gem" },
    { emoji: "💵", label: "Rp 150.000 Saldo" },
    { emoji: "❤️", label: "500–1.500 Nyawa" },
    { emoji: "🎟️", label: "6 Lucky Token" },
  ]},
  { rarity: "legendary", chance: "TINGGI", prizes: [
    { emoji: "💎", label: "2.500–6.000 Gem" },
    { emoji: "💵", label: "Rp 30.000 Saldo" },
    { emoji: "❤️", label: "120 Nyawa" },
    { emoji: "🎟️", label: "3 Lucky Token" },
  ]},
  { rarity: "epic", chance: "SERING", prizes: [
    { emoji: "💎", label: "800–1.800 Gem" },
    { emoji: "🔑", label: "15 Kredit Game" },
    { emoji: "🪙", label: "8.000 Koin" },
    { emoji: "🎟️", label: "2 Lucky Token" },
  ]},
  { rarity: "rare", chance: "MINIMAL", prizes: [
    { emoji: "💎", label: "200–500 Gem" },
    { emoji: "❤️", label: "15 Nyawa" },
    { emoji: "🛡️", label: "6 Streak Freeze" },
    { emoji: "🎟️", label: "1 Lucky Token" },
  ]},
];

function rarityGrad(r: string) {
  switch (r) {
    case "mythic": return "from-red-500 via-yellow-400 via-green-400 via-cyan-400 via-blue-500 to-fuchsia-500";
    case "legendary": return "from-amber-400 via-orange-500 to-red-600";
    case "epic": return "from-fuchsia-500 to-purple-700";
    case "rare": return "from-cyan-500 to-blue-600";
    default: return "from-slate-600 to-slate-800";
  }
}
function rarityRing(r: string) {
  switch (r) {
    case "mythic": return "ring-2 ring-fuchsia-300/90 shadow-[0_0_18px_rgba(232,121,249,0.55)]";
    case "legendary": return "ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.5)]";
    case "epic": return "ring-2 ring-fuchsia-400/70 shadow-[0_0_10px_rgba(192,132,252,0.4)]";
    case "rare": return "ring-2 ring-cyan-400/60 shadow-[0_0_8px_rgba(34,211,238,0.35)]";
    default: return "ring-1 ring-slate-500/40";
  }
}
function getKindIcon(kind: string) {
  switch (kind) {
    case "extra_life": return <Heart className="w-full h-full" fill="currentColor" />;
    case "auto_hint": return <Lightbulb className="w-full h-full" fill="currentColor" />;
    case "time_freeze": return <Timer className="w-full h-full" />;
    case "streak_freeze": return <Shield className="w-full h-full" fill="currentColor" />;
    case "gems": return <Gem className="w-full h-full" fill="currentColor" />;
    case "streak_coins": return <Coins className="w-full h-full" fill="currentColor" />;
    case "game_credits": return <KeyRound className="w-full h-full" />;
    case "game_balance": return <WalletCards className="w-full h-full" />;
    case "lucky_token": return <Ticket className="w-full h-full" />;
    default: return <Sparkles className="w-full h-full" />;
  }
}
function rarityLabel(r: string) {
  return ({ common: "COMMON", rare: "RARE", epic: "EPIC", legendary: "LEGENDARY", mythic: "MYTHIC" } as Record<string, string>)[r] || String(r).toUpperCase();
}

function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + (now.getTimezoneOffset() + 7 * 60) * 60000);
  return wib.toISOString().slice(0, 10);
}
const FREE_KEY_PREFIX = "premium_spin_free_";
function getFreeUsedToday(): number {
  try { const v = localStorage.getItem(FREE_KEY_PREFIX + todayWIB()); return v ? parseInt(v) || 0 : 0; } catch { return 0; }
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
  shopUnlock?: { isActive: boolean; activeUntil: string | null; grantedAt: string | null; durationDays: number };
  useTickets?: boolean;
  ticketBalance?: number;
  luckyTokens?: number;
  onLuckyTokensUpdate?: (n: number) => void;
  onTicketsUpdate?: (t: { normal: number; premium: number }) => void;
}

interface SpinResult { kind: string; value: number; label: string; emoji: string; rarity: string; color: string; }

export default function PremiumSpinPanel({ visitorId, gems, setGems, isUnlocked, expiresAt, price = 50000, shopUnlock, useTickets = false, ticketBalance = 0, luckyTokens = 0, onLuckyTokensUpdate, onTicketsUpdate }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [freeUsed, setFreeUsed] = useState(getFreeUsedToday());
  const [results, setResults] = useState<SpinResult[]>([]);
  const [reelSpinning, setReelSpinning] = useState(false);
  const [selectedPack, setSelectedPack] = useState<number>(1);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [milestone, setMilestone] = useState<{ spinCount: number; claimed: number[]; cap: number }>({ spinCount: 0, claimed: [], cap: 20 });
  const [claimingMs, setClaimingMs] = useState<number | null>(null);
  const [poolPrizes, setPoolPrizes] = useState<{ label: string; emoji: string; rarity: string; weight: number }[]>([]);
  const MILESTONES: { spins: number; gems: number }[] = [
    { spins: 2, gems: 50 },
    { spins: 5, gems: 200 },
    { spins: 10, gems: 500 },
    { spins: 20, gems: 1500 },
  ];

  useEffect(() => {
    if (!visitorId) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("luck-royale-nyawa", { body: { visitorId, action: "check" } });
        const list = (data?.premiumPrizes || []) as any[];
        if (Array.isArray(list) && list.length) setPoolPrizes(list);
      } catch { /* noop */ }
    })();
  }, [visitorId]);

  const loadMilestone = async () => {
    if (!visitorId) return;
    try {
      const { data } = await supabase.functions.invoke("luck-royale-nyawa", { body: { visitorId, action: "milestone_status" } });
      if (data && !data.error) {
        setMilestone({ spinCount: data.spinCount || 0, claimed: data.claimed || [], cap: data.cap || 20 });
      }
    } catch { /* noop */ }
  };


  const claimMilestone = async (spins: number) => {
    if (!visitorId || claimingMs !== null) return;
    setClaimingMs(spins);
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", { body: { visitorId, action: "milestone_claim", milestone: spins } });
      if (error || data?.error) {
        toast({ title: "Gagal klaim", description: data?.error || error?.message || "Coba lagi", variant: "destructive" });
        return;
      }
      if (typeof data.gems === "number") setGems(data.gems);
      setMilestone((m) => m ? { ...m, claimed: data.claimed || [] } : m);
      toast({ title: "🎁 Hadiah Milestone!", description: `+${data.gemReward} 💎 berhasil ditambahkan` });
    } finally {
      setClaimingMs(null);
    }
  };

  useEffect(() => {
    const id = setInterval(() => {
      const u = getFreeUsedToday();
      setFreeUsed((prev) => (prev !== u ? u : prev));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const loadHistory = async () => {
    if (!visitorId) return;
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("luck_royale_nyawa_history")
        .select("id, spin_type, reward_kind, reward_value, reward_label, rarity, cost_currency, cost_amount, created_at")
        .eq("visitor_id", visitorId)
        .like("spin_type", "premium%")
        .order("created_at", { ascending: false })
        .limit(historyLimit);
      setHistory(data || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [visitorId, historyLimit, results.length]);
  useEffect(() => { loadMilestone(); /* eslint-disable-next-line */ }, [visitorId, results.length]);

  const freeRemaining = Math.max(0, FREE_PER_DAY - freeUsed);
  const activePack = PACKS.find((p) => p.count === selectedPack) || PACKS[0];
  const spendableTickets = ticketBalance + luckyTokens;

  const goBuyAccess = () => {
    // Pindah ke tab "normal" (sub-tab Spin) lalu scroll ke kartu Nyawa Premium
    const tabsRoot = document.querySelector('[data-spin-subtabs]');
    const normalTab = tabsRoot?.querySelector<HTMLElement>('button[value="normal"], [role="tab"][data-state]:first-child');
    // Fallback: cari tombol bertuliskan NORMAL
    let triggered = false;
    if (normalTab) { normalTab.click(); triggered = true; }
    if (!triggered) {
      const allTabs = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));
      const t = allTabs.find((el) => /normal/i.test(el.textContent || ""));
      if (t) t.click();
    }
    setTimeout(() => {
      const card = document.querySelector('[data-nyawa-premium-card]');
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      else {
        // fallback scroll ke atas halaman
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast({ title: "Buka tab NORMAL", description: "Cari kartu 'Nyawa Premium' lalu klik BAYAR." });
      }
    }, 250);
  };

  const doSpin = async (useFree: boolean) => {
    if (busy || !visitorId) return;
    if (!isUnlocked) {
      toast({ title: "🔒 Premium belum aktif", description: `Beli akses Premium Rp ${price.toLocaleString("id-ID")} (30 hari) dulu.`, variant: "destructive" });
      return;
    }
    if (useFree && freeRemaining <= 0) {
      toast({ title: "Free spin habis", description: `Sudah pakai ${FREE_PER_DAY}x premium free spin hari ini. Reset 00:00 WIB.`, variant: "destructive" });
      return;
    }
    const count = useFree ? 1 : activePack.count;
    const cost = useFree ? 0 : activePack.cost;
    const ticketsUsed = !useFree && useTickets ? Math.min(spendableTickets, count) : 0;
    const gemCost = !useFree && count > 0 ? Math.ceil((cost * (count - ticketsUsed)) / count) : 0;
    if (!useFree && gems < gemCost) {
      toast({ title: "Gem kurang", description: `Butuh ${gemCost.toLocaleString("id-ID")}💎${ticketsUsed > 0 ? ` + ${ticketsUsed} tiket` : ""} (kamu punya ${gems.toLocaleString("id-ID")}).`, variant: "destructive" });
      return;
    }

    setBusy(true);
    setReelSpinning(true);
    setResults([]);
    setShowResultsModal(false);

    await new Promise((r) => setTimeout(r, count > 1 ? 1200 : 800));

    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "premium_spin_batch", count, useFree, useTickets: !useFree && useTickets },
      });
      if ((data as any)?.tickets && onTicketsUpdate) onTicketsUpdate((data as any).tickets);
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Gagal proses spin");
      }
      const payload = data as { gems?: number; results?: SpinResult[] };
      if (typeof payload?.gems === "number") setGems(payload.gems);
      if (typeof (data as any)?.luckyTokens === "number") onLuckyTokensUpdate?.((data as any).luckyTokens);
      const list = payload?.results || [];
      setResults(list);
      if (list.length > 0) setShowResultsModal(true);

      if (useFree) {
        const u = bumpFreeUsed();
        setFreeUsed(u);
      }

      const best = [...list].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0];
      if (best && (best.rarity === "mythic" || best.rarity === "legendary")) {
        toast({ title: `🎉 ${best.rarity.toUpperCase()}!`, description: `${best.label}` });
      } else if (count === 1 && best) {
        toast({ title: useFree ? "✨ Free Premium Spin" : "✨ Premium Spin", description: best.label });
      } else if (count > 1) {
        toast({ title: `🎰 ${count}x Premium Spin selesai`, description: `Lihat semua hadiah di pop-up.` });
      }
    } catch (e: any) {
      toast({ title: "Gagal Premium Spin", description: e.message || "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setReelSpinning(false);
      setBusy(false);
    }
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
          MEGA JACKPOT
        </div>
      </div>

      {/* Status Banner: Locked vs Active */}
      {isUnlocked ? (
        <div className="space-y-2">
          <div className="rounded-xl bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-cyan-600/30 border-2 border-emerald-400/60 px-3 py-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <Crown className="w-4 h-4 text-emerald-200" fill="currentColor" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black text-emerald-100 tracking-wide">PREMIUM AKTIF ✨ (30 HARI)</div>
              <div className="text-[9px] text-emerald-200/80 truncate">
                {expiresAt ? `Berakhir: ${new Date(expiresAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "2-digit" })} WIB` : "Akses penuh aktif"}
              </div>
            </div>
          </div>
          {shopUnlock?.isActive && shopUnlock.activeUntil && (
            <div className="rounded-xl bg-gradient-to-r from-amber-600/25 via-orange-600/25 to-fuchsia-600/25 border-2 border-amber-400/60 px-3 py-2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center text-base">🎟️</div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-black text-amber-100 tracking-wide">TOKEN SHOP UNLOCK 🔓 (SEMUA TIER)</div>
                <div className="text-[9px] text-amber-200/85 truncate">
                  Aktif sampai {new Date(shopUnlock.activeUntil).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "2-digit" })} WIB · {shopUnlock.durationDays} hari
                </div>
              </div>
            </div>
          )}
          <div className="rounded-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-400/40 px-3 py-2 text-[10px] text-cyan-100 leading-snug">
            🎯 <span className="font-black">Hadiah dinamis:</span> jika <span className="font-black">Server Luck (jam hoki)</span> aktif → hadiah lumayan + sering dapat 🎟️ Token. Jika tidak → sama seperti spin normal (lumayan dikit, gem dibatasi).
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gradient-to-r from-rose-700/40 via-red-700/40 to-orange-700/40 border-2 border-rose-400/60 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-rose-500/30 flex items-center justify-center text-lg">🔒</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-black text-rose-100 tracking-wide">PREMIUM TERKUNCI</div>
              <div className="text-[10px] text-rose-200/90">
                Wajib beli akses Rp <span className="font-black">{price.toLocaleString("id-ID")}</span> / <span className="font-black">30 hari</span> dulu
              </div>
            </div>
          </div>
          <Button
            onClick={goBuyAccess}
            className="w-full h-10 bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 hover:from-amber-500 hover:via-orange-600 hover:to-red-700 text-white font-black text-[12px] tracking-wider"
          >
            🔓 BELI AKSES Rp {price.toLocaleString("id-ID")} / 30 HARI
          </Button>
          <div className="text-[9px] text-rose-200/70 text-center mt-1.5">
            Setelah aktif: 2× free spin/hari + akses semua paket spin gem (1 sampai 1.000 spin)
          </div>
        </div>
      )}

      {/* MILESTONE GEM HARIAN — komponen reusable, juga muncul di tab Normal */}
      <PremiumMilestonePanel visitorId={visitorId} gems={gems} setGems={setGems} refreshKey={results.length} />

      {/* Showcase */}
      <div className="relative rounded-xl bg-black/40 border border-fuchsia-500/30 overflow-hidden">
        <div className="aspect-[16/9] flex items-center justify-center bg-gradient-to-br from-fuchsia-900/40 via-purple-900/30 to-amber-900/30">
          {reelSpinning ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-10 h-10 text-fuchsia-300 animate-spin" />
              <div className="text-[11px] font-black tracking-widest text-fuchsia-200">MEMUTAR...</div>
            </div>
          ) : results.length === 1 ? (
            <div className={`text-center px-4 py-3 rounded-xl bg-gradient-to-br ${rarityGrad(results[0].rarity)} ${rarityRing(results[0].rarity)} animate-scale-in`}>
              <div className="text-5xl mb-1 drop-shadow">{results[0].emoji}</div>
              <div className="text-[9px] uppercase tracking-widest font-black opacity-80 text-white">{results[0].rarity}</div>
              <div className="text-base font-black text-white drop-shadow">{results[0].label}</div>
            </div>
          ) : results.length > 1 ? (
            <div className="text-center px-4">
              <div className="text-4xl mb-1">🎰</div>
              <div className="text-xs font-black tracking-widest text-fuchsia-100">{results.length}× SPIN SELESAI</div>
              <button
                onClick={() => setShowResultsModal(true)}
                className="mt-2 text-[10px] font-bold text-amber-200 underline"
              >Lihat semua hadiah →</button>
            </div>
          ) : (
            <div className="text-center px-4">
              <Sparkles className="w-10 h-10 text-fuchsia-300 mx-auto mb-1" />
              <div className="text-xs font-black tracking-widest text-fuchsia-100">JACKPOT MEGA</div>
              <div className="text-[10px] text-fuchsia-200/70 mt-0.5">+50.000 Koin · Rp 50k Saldo · 2.000 Gem · 100 Kredit</div>
            </div>
          )}
        </div>
      </div>

      {/* Free Spin */}
      <button
        disabled={busy || !isUnlocked || freeRemaining <= 0}
        onClick={() => doSpin(true)}
        className={`w-full relative overflow-hidden rounded-xl px-3 py-3 font-black active:scale-95 transition disabled:opacity-50 flex items-center justify-between ${
          freeRemaining > 0 && isUnlocked
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

      {/* Pack Selector */}
      <div className="rounded-xl bg-black/40 border border-fuchsia-500/30 p-2">
        <div className="text-[10px] font-black tracking-widest text-fuchsia-200/80 mb-2 px-1">PILIH PAKET SPIN</div>
        <div className="grid grid-cols-3 gap-1.5">
          {PACKS.map((p) => {
            const sel = selectedPack === p.count;
            const ticketsUsed = useTickets ? Math.min(spendableTickets, p.count) : 0;
            const gemCost = Math.ceil((p.cost * (p.count - ticketsUsed)) / p.count);
            return (
              <button
                key={p.count}
                onClick={() => setSelectedPack(p.count)}
                className={`relative rounded-lg p-1.5 text-left transition ${
                  sel
                    ? "bg-gradient-to-br from-fuchsia-600 to-purple-700 ring-2 ring-amber-300 shadow-lg shadow-fuchsia-500/50"
                    : "bg-slate-800/60 hover:bg-slate-700/70 ring-1 ring-fuchsia-500/20"
                }`}
              >
                {p.badge && (
                  <div className="absolute -top-1 -right-1 text-[7px] font-black bg-amber-400 text-black rounded px-1 py-0.5 shadow">
                    {p.badge}
                  </div>
                )}
                <div className="text-[12px] font-black text-white">{p.count}× SPIN</div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {ticketsUsed > 0 && <><Ticket className="w-2.5 h-2.5 text-amber-200" /><span className="text-[10px] font-bold text-amber-200">{ticketsUsed}</span></>}
                  {gemCost > 0 && <><Gem className="w-2.5 h-2.5 text-cyan-300" /><span className="text-[10px] font-bold text-cyan-200">{gemCost.toLocaleString("id-ID")}</span></>}
                </div>
                <div className="text-[8px] text-white/60 font-semibold mt-0.5">{p.perSpin}💎/spin</div>
                <div className="text-[8px] font-bold text-amber-300 mt-0.5 flex items-center gap-0.5">
                  🎟️ +{Math.floor(p.count / 5)} Token Shop
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-[10px] text-amber-200/90 font-bold text-center -mt-1">
        💡 Setiap 5 spin berbayar = otomatis +1 🎟️ Token Shop (bonus tiket dari pool tetap berlaku)
      </div>

      {/* Buy Selected Pack */}
      <button
        disabled={busy || !isUnlocked || gems < Math.ceil((activePack.cost * (activePack.count - (useTickets ? Math.min(spendableTickets, activePack.count) : 0))) / activePack.count)}
        onClick={() => doSpin(false)}
        className="w-full relative overflow-hidden rounded-xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-amber-500 px-3 py-4 font-black shadow-lg shadow-fuchsia-500/50 active:scale-95 transition disabled:opacity-50 flex items-center justify-between text-white ring-2 ring-amber-300/50"
      >
        <span className="flex items-center gap-2 text-base tracking-widest">
          <Flame className="w-5 h-5" />
          SPIN {activePack.count}×
        </span>
        <span className="flex items-center gap-1 text-sm bg-black/40 rounded-full px-2.5 py-1">
          {useTickets && Math.min(spendableTickets, activePack.count) > 0 && <><Ticket className="w-3.5 h-3.5" /> {Math.min(spendableTickets, activePack.count)}</>}
          {Math.ceil((activePack.cost * (activePack.count - (useTickets ? Math.min(spendableTickets, activePack.count) : 0))) / activePack.count) > 0 && <><Gem className="w-3.5 h-3.5" /> {Math.ceil((activePack.cost * (activePack.count - (useTickets ? Math.min(spendableTickets, activePack.count) : 0))) / activePack.count).toLocaleString("id-ID")}</>}
        </span>
      </button>

      {/* Daftar Hadiah Pool */}
      <div className="rounded-xl bg-black/40 border border-fuchsia-500/30 p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Gift className="w-3.5 h-3.5 text-amber-300" />
          <h3 className="text-[11px] font-black tracking-widest text-amber-200">DAFTAR HADIAH PREMIUM</h3>
        </div>
        <div className="space-y-1.5">
          {PRIZE_POOL.map((group) => (
            <div key={group.rarity} className={`rounded-lg p-2 bg-gradient-to-r ${rarityGrad(group.rarity)} ${rarityRing(group.rarity)}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-widest font-black text-white/95">{group.rarity}</span>
                <span className="text-[8px] font-bold text-white/70 bg-black/30 px-1.5 py-0.5 rounded">{group.chance}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {group.prizes.map((p, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px] font-bold text-white bg-black/20 rounded px-1.5 py-1">
                    <span className="text-sm">{p.emoji}</span>
                    <span className="truncate">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-[9px] text-fuchsia-200/60 mt-2">
          Persentase peluang dapat berubah sewaktu-waktu untuk menjaga keseimbangan game.
        </p>
      </div>

      {/* Riwayat Spin Premium */}
      <div className="rounded-xl bg-black/40 border border-fuchsia-500/30 p-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
            <h3 className="text-[11px] font-black tracking-widest text-fuchsia-200">RIWAYAT SPIN PREMIUM</h3>
          </div>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="text-[9px] font-bold text-fuchsia-300 hover:text-amber-200 disabled:opacity-50"
          >
            {historyLoading ? "..." : "↻ Refresh"}
          </button>
        </div>
        {history.length === 0 ? (
          <div className="text-center py-4 text-[10px] text-fuchsia-200/50">
            {historyLoading ? "Memuat..." : "Belum ada riwayat spin premium"}
          </div>
        ) : (
          <>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {history.map((h) => {
                const date = new Date(h.created_at);
                const timeStr = date.toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                });
                const isFree = h.cost_currency === "free";
                return (
                  <div
                    key={h.id}
                    className={`flex items-center gap-2 rounded-lg p-1.5 bg-gradient-to-r ${rarityGrad(h.rarity)} ${rarityRing(h.rarity)}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black text-white truncate">{h.reward_label}</div>
                      <div className="flex items-center gap-1.5 text-[8px] text-white/80 mt-0.5">
                        <span className="uppercase font-bold tracking-wider">{h.rarity}</span>
                        <span>·</span>
                        <span>{timeStr} WIB</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {isFree ? (
                        <span className="text-[8px] font-black bg-emerald-500/30 text-emerald-100 px-1.5 py-0.5 rounded">FREE</span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-cyan-100 bg-black/30 rounded px-1.5 py-0.5">
                          <Gem className="w-2.5 h-2.5" />{h.cost_amount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {history.length >= historyLimit && (
              <button
                onClick={() => setHistoryLimit((n) => n + 30)}
                className="w-full mt-2 text-[10px] font-bold text-fuchsia-200 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-lg py-1.5"
              >
                Muat lebih banyak ↓
              </button>
            )}
          </>
        )}
      </div>

      {/* Results Modal (multi-spin) */}
      {showResultsModal && results.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="relative max-w-md w-full bg-gradient-to-br from-[#1a0e3d] to-[#0b0820] border-2 border-amber-500/50 rounded-2xl p-5 shadow-2xl shadow-amber-500/30 animate-scale-in">
            <button onClick={() => setShowResultsModal(false)} className="absolute top-2 right-2 text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-3">
              <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-1 animate-pulse" />
              <h3 className="text-xl font-black bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">SELAMAT!</h3>
              <p className="text-xs text-purple-200 mt-1">
                <span className="font-black text-amber-300">{results.length}</span> / {results.length} hadiah dibuka
              </p>
              <div className="mt-2 flex items-center justify-center flex-wrap gap-1">
                {(["mythic", "legendary", "epic", "rare", "common"] as const).map((r) => {
                  const c = results.filter((x) => x.rarity === r).length;
                  if (c === 0) return null;
                  return <span key={r} className={`text-[8px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r ${rarityGrad(r)} text-white ring-1 ring-white/30`}>{rarityLabel(r)} ×{c}</span>;
                })}
              </div>
            </div>
            <div className={`grid gap-1.5 max-h-[55vh] overflow-y-auto ${results.length > 50 ? "grid-cols-4" : results.length > 20 ? "grid-cols-3" : "grid-cols-2"}`}>
              {results.map((r, i) => (
                <div key={i} className={`relative rounded-lg bg-gradient-to-br ${rarityGrad(r.rarity)} ${rarityRing(r.rarity)} shadow-lg p-2 flex flex-col items-center text-center`}>
                  <span className="absolute top-0.5 right-0.5 bg-black/70 text-[7px] font-black px-1 py-0 rounded text-white">{rarityLabel(r.rarity)}</span>
                  <div className={`text-white mb-0.5 ${results.length > 50 ? "w-6 h-6" : "w-9 h-9"}`}>{getKindIcon(r.kind)}</div>
                  <div className={`font-black leading-tight text-white drop-shadow ${results.length > 50 ? "text-[8px]" : "text-[10px]"}`}>{r.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 text-[9px] text-fuchsia-100/90">
              {Object.entries(summarize(results)).map(([k, v]) => (
                <div key={k} className="bg-black/30 rounded px-2 py-1 border border-fuchsia-500/20">
                  <span className="font-black text-fuchsia-200">{k}:</span> {v}
                </div>
              ))}
            </div>
            <Button onClick={() => setShowResultsModal(false)} className="mt-4 w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-black tracking-wider">
              <Zap className="w-4 h-4 mr-1" /> KEREN!
            </Button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scaleIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}

function rarityRank(r: string): number {
  return ({ common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 } as Record<string, number>)[r] ?? 0;
}

function summarize(list: SpinResult[]): Record<string, string> {
  const sum: Record<string, number> = {};
  const labelMap: Record<string, string> = {
    auto_hint: "💡 Hint",
    extra_life: "❤️ Nyawa",
    time_freeze: "⏱️ Time Freeze",
    streak_freeze: "🛡️ Streak Freeze",
    streak_coins: "🪙 Koin Streak",
    gems: "💎 Gem",
    game_credits: "🔑 Kredit",
    game_balance: "💵 Saldo IN",
    lucky_token: "🎟️ Lucky Token",
  };
  for (const r of list) {
    sum[r.kind] = (sum[r.kind] || 0) + r.value;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sum)) {
    const isMoney = k === "game_balance";
    out[labelMap[k] || k] = isMoney ? `+Rp ${v.toLocaleString("id-ID")}` : `+${v.toLocaleString("id-ID")}`;
  }
  return out;
}

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Gem, Coins, Ticket, Flame, Star, Crown, Loader2, ChevronRight, Timer, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRoyaleVisitorId, useRoyaleWallet } from "@/components/royale/useRoyaleWallet";
import RoyaleLeaderboard from "@/components/royale/RoyaleLeaderboard";
import MyRoyaleCard, { RoyaleHistoryList } from "@/components/royale/MyRoyaleCard";

const StreakLuckyWheelShop = lazy(() => import("@/components/streak/StreakLuckyWheelShop"));
const SpinTicketShop = lazy(() => import("@/components/luck/SpinTicketShop"));

const TABS = [
  ["normal", "Normal"], ["diamond", "Diamond"], ["lucky", "Lucky Spin"], ["premium", "Premium"],
  ["daily", "Daily"], ["shop", "Shop"], ["leaderboard", "Leaderboard"], ["history", "History"],
] as const;
type TabKey = (typeof TABS)[number][0];

function msToNextWibMidnight() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  const next = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + 1) - 7 * 3600 * 1000;
  return Math.max(0, next - Date.now());
}
function fmtCountdown(ms: number) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

function Countdown() {
  const [ms, setMs] = useState(msToNextWibMidnight);
  useEffect(() => { const t = setInterval(() => setMs(msToNextWibMidnight()), 1000); return () => clearInterval(t); }, []);
  return <span className="font-mono text-2xl font-extrabold tabular-nums text-foreground">{fmtCountdown(ms)}</span>;
}

function Fallback() { return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>; }

function GoCard({ title, desc, emoji, to }: { title: string; desc: string; emoji: string; to: string }) {
  const nav = useNavigate();
  return (
    <button onClick={() => nav(to)} className="group flex w-full items-center gap-3 rounded-[20px] border border-border bg-card/80 p-4 text-left backdrop-blur-md transition hover:border-primary/50 active:scale-[0.99]">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-3xl">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-extrabold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />
    </button>
  );
}

export default function LuckyRoyaleHub() {
  const nav = useNavigate();
  const visitorId = useMemo(getRoyaleVisitorId, []);
  const { wallet, reload } = useRoyaleWallet(visitorId);
  const [tab, setTab] = useState<TabKey>(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    return (TABS.find(([k]) => k === q)?.[0] as TabKey) || "normal";
  });
  const [wheel, setWheel] = useState<{ freeAvailable: Record<string, boolean>; tiers: { tier_key: string; tier_name: string; free_daily: boolean }[]; recentJackpots: { display_name: string; reward_label: string; created_at: string }[] } | null>(null);

  useEffect(() => { document.title = "Lucky Royale — Agung Adi Store"; }, []);
  useEffect(() => {
    if (!visitorId) return;
    supabase.functions.invoke("streak-lucky-wheel", { body: { action: "list", visitorId } }).then(({ data }) => data && setWheel(data as any));
  }, [visitorId, tab]);

  const stats = [
    { icon: Gem, label: "Gems", value: wallet?.gems },
    { icon: Coins, label: "Koin", value: wallet?.coins },
    { icon: Ticket, label: "Tiket", value: wallet ? `${wallet.normalTickets}/${wallet.premiumTickets}` : undefined },
    { icon: Flame, label: "Streak", value: wallet?.streak },
    { icon: Star, label: "Level", value: wallet?.level },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      {/* HERO */}
      <header className="relative overflow-hidden px-4 pb-5 pt-4">
        <motion.div aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div aria-hidden className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-accent/30 blur-3xl"
          animate={{ x: [0, -25, 0], y: [0, -15, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative mx-auto max-w-2xl">
          <button onClick={() => nav("/")} aria-label="Kembali" className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/70 backdrop-blur"><ArrowLeft className="h-5 w-5" /></button>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-black tracking-tight">
            👑 LUCKY ROYALE
          </motion.h1>
          <p className="text-sm text-muted-foreground">Spin • Collect • Win • Become The Champion</p>

          {visitorId ? (
            <div className="mt-4 grid grid-cols-5 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-border bg-card/70 p-2 text-center backdrop-blur-md">
                  <s.icon className="mx-auto h-4 w-4 text-primary" aria-hidden />
                  <p className="mt-1 truncate text-sm font-extrabold">{s.value === undefined ? "…" : typeof s.value === "number" ? s.value.toLocaleString("id-ID") : s.value}</p>
                  <p className="text-[9.5px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => nav("/saldo")} className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground">Login akun saldo untuk main</button>
          )}

          {!!wheel?.recentJackpots?.length && (
            <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px]">
              <Crown className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">Jackpot terbaru: <strong>{wheel.recentJackpots[0].display_name}</strong> — {wheel.recentJackpots[0].reward_label}</span>
            </div>
          )}
        </div>
      </header>

      {/* TABS */}
      <nav aria-label="Menu Royale" className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${tab === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        {tab === "normal" && (
          <>
            <GoCard title="Normal Royale" desc="Spin pakai Gem/Tiket Normal — hadiah nyawa, koin, saldo IN, voucher" emoji="🎡" to="/luck-royale-nyawa" />
            <MyRoyaleCard visitorId={visitorId} level={wallet?.level} xp={wallet?.xp} />
          </>
        )}
        {tab === "diamond" && <GoCard title="Diamond Royale" desc="Gacha Diamond dengan pity rare & legendary" emoji="💎" to="/diamond-royale" />}
        {tab === "premium" && <GoCard title="Premium Royale" desc="Premium Spin, Tier Spin S–SSS, Mega Arena & milestone gem" emoji="🏆" to="/luck-royale-nyawa" />}
        {tab === "lucky" && (visitorId
          ? <Suspense fallback={<Fallback />}><StreakLuckyWheelShop visitorId={visitorId} onUpdate={reload} /></Suspense>
          : <p className="py-8 text-center text-sm text-muted-foreground">Login saldo untuk memutar Lucky Spin.</p>)}
        {tab === "daily" && (
          <section className="space-y-3">
            <div className="rounded-[20px] border border-border bg-card/80 p-4 text-center">
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"><Timer className="h-3.5 w-3.5" /> Next Free Spin (00:00 WIB)</p>
              <Countdown />
            </div>
            {visitorId && wheel?.tiers?.filter((t) => t.free_daily).map((t) => {
              const free = wheel.freeAvailable?.[t.tier_key];
              return (
                <div key={t.tier_key} className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 p-3">
                  <Gift className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm font-semibold">Free spin {t.tier_name}</span>
                  {free
                    ? <button onClick={() => setTab("lucky")} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Klaim</button>
                    : <span className="text-xs text-muted-foreground">Sudah dipakai</span>}
                </div>
              );
            })}
            <GoCard title="Free Spin Lucky Royale" desc="Klaim spin gratis harian di Lucky Royale" emoji="🎁" to="/luck-royale-nyawa" />
          </section>
        )}
        {tab === "shop" && (visitorId ? (
          <Suspense fallback={<Fallback />}>
            <SpinTicketShop visitorId={visitorId} type="normal" ticketBalance={wallet?.normalTickets || 0} gems={wallet?.gems} onPurchased={() => reload()} />
            <SpinTicketShop visitorId={visitorId} type="premium" ticketBalance={wallet?.premiumTickets || 0} gems={wallet?.gems} onPurchased={() => reload()} />
            <GoCard title="Toko Streak & Booster" desc="Freeze, extra life, booster, dan item spesial" emoji="🛍️" to="/streak-shop" />
          </Suspense>
        ) : <p className="py-8 text-center text-sm text-muted-foreground">Login saldo untuk belanja.</p>)}
        {tab === "leaderboard" && <RoyaleLeaderboard visitorId={visitorId} />}
        {tab === "history" && <RoyaleHistoryList visitorId={visitorId} />}
      </main>
    </div>
  );
}

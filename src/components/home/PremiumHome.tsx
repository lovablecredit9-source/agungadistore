import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Wallet, Crown, Gem, Flame, PlusCircle, Package, Gift, Ticket, ShoppingBag, History,
  Eye, EyeOff, RefreshCw, ChevronRight, Bell, Music2, Headset, Coins, AlertCircle, LayoutGrid,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import MembershipHomeSection from "@/components/wallet/MembershipHomeSection";
import { useWalletSummary } from "@/hooks/useWalletSummary";

export type HomeTarget = { tab?: string; path?: string };

interface Props {
  user: { visitor_id: string; username: string; phone: string; balance: number; bonus_balance?: number | null } | null;
  onOpen: (t: HomeTarget) => void;
  onShowAll: () => void;
}

interface Txn { id: string; type: string; amount: number; description: string | null; created_at: string }
interface Voucher { id: string; code: string; discount_amount: number | null; expires_at: string | null; min_purchase: number | null }
interface Stats {
  streak: number;
  saldoIn: number | null;
  activeOrders: number;
  unread: number;
  txns: Txn[];
  vouchers: Voucher[];
}

const rp = (n: number) => "Rp " + Math.round(Number(n || 0)).toLocaleString("id-ID");
const num = (n: number) => Number(n || 0).toLocaleString("id-ID");
const fmtDate = (d: string) => new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-bold tracking-tight text-foreground">{children}</h3>
      {action}
    </div>
  );
}

/**
 * Beranda: one dashboard. Every number comes from existing owner-scoped reads
 * (user_balances via props, game_balance, useWalletSummary, daily_streaks, seller_orders,
 * notifications RPC, balance_transactions, discount_vouchers). No sample data.
 */
export default function PremiumHome({ user, onOpen, onShowAll }: Props) {
  const reduce = useReducedMotion();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const wallet = useWalletSummary(user?.visitor_id);

  useEffect(() => { try { setHidden(localStorage.getItem("home_hide_balance") === "1"); } catch { /* ignore */ } }, []);
  const toggleHidden = () => setHidden((h) => { try { localStorage.setItem("home_hide_balance", h ? "0" : "1"); } catch { /* ignore */ } return !h; });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(false);
    try {
      const vid = user.visitor_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- some tables/RPCs are missing from generated types
      const sb = supabase as any;
      const now = new Date().toISOString();
      const [st, gb, ord, notif, tx, vc] = await Promise.all([
        sb.from("daily_streaks").select("current_streak").eq("visitor_id", vid).maybeSingle(),
        sb.from("game_balance").select("amount").eq("visitor_id", vid).maybeSingle(),
        sb.from("seller_orders").select("id", { count: "exact", head: true }).eq("buyer_visitor_id", vid).in("status", ["pending", "paid", "processing", "shipped", "dikemas", "dikirim"]),
        sb.rpc("get_my_notifications", { p_visitor_id: vid, p_limit: 50 }),
        sb.from("balance_transactions").select("id, type, amount, description, created_at").eq("visitor_id", vid).order("created_at", { ascending: false }).limit(5),
        sb.from("discount_vouchers").select("id, code, discount_amount, expires_at, min_purchase, used_count, max_uses").eq("visitor_id", vid).eq("is_active", true).or(`expires_at.is.null,expires_at.gt.${now}`).order("expires_at", { ascending: true }).limit(6),
      ]);
      if (st.error || tx.error) { console.error("[home] load failed", st.error || tx.error); throw new Error("load"); }
      setStats({
        streak: st.data?.current_streak ?? 0,
        saldoIn: gb.error ? null : Number(gb.data?.amount ?? 0),
        activeOrders: ord.count ?? 0,
        unread: Array.isArray(notif.data) ? notif.data.filter((n: { is_read?: boolean }) => !n.is_read).length : 0,
        txns: (tx.data || []) as Txn[],
        vouchers: ((vc.data || []) as (Voucher & { used_count: number | null; max_uses: number | null })[])
          .filter((v) => (v.used_count ?? 0) < (v.max_uses ?? 1)).slice(0, 3),
      });
    } catch { setError(true); }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  const refreshAll = () => { void load(); void wallet.reload(); window.dispatchEvent(new Event("refresh-store-premium")); };

  const fade = (i = 0) => reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: 0.04 * i } };
  const card = "rounded-[24px] border border-border bg-card shadow-sm";
  const tickets = wallet.data ? wallet.data.normalTickets + wallet.data.premiumTickets : null;

  if (!user) {
    return (
      <section aria-label="Beranda" className={cn(card, "mx-auto max-w-[1400px] p-6 lg:p-8")} style={{ backgroundImage: "var(--gradient-home-hero)" }}>
        <p className="text-xs text-muted-foreground">Selamat datang di Agung Adi Store</p>
        <h2 className="mt-1 text-xl font-bold text-foreground lg:text-2xl">Masuk untuk melihat saldo & membership</h2>
        <button onClick={() => onOpen({ tab: "saldo" })} className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground active:scale-95 transition">
          Masuk / Daftar <ChevronRight className="h-4 w-4" />
        </button>
      </section>
    );
  }

  const summary = [
    { icon: Gem, label: "Gem", value: wallet.data ? num(wallet.data.gems) : null, t: { tab: "streakshop" } },
    { icon: Coins, label: "Coin Streak", value: wallet.data ? num(wallet.data.streakCoins) : null, t: { tab: "streakshop" } },
    { icon: Ticket, label: "Tiket", value: tickets === null ? null : num(tickets), t: { path: "/lucky-royale" } },
    { icon: Flame, label: "Streak", value: stats ? `${stats.streak} hari` : null, t: { tab: "streak" } },
  ];
  const quick = [
    { icon: PlusCircle, label: "Top Up", t: { tab: "saldo" } },
    { icon: ShoppingBag, label: "Belanja", t: { tab: "produk" } },
    { icon: History, label: "Riwayat", t: { tab: "history" } },
    { icon: Ticket, label: "Voucher", t: { tab: "voucher" } },
    { icon: Gift, label: "Reward", t: { tab: "streak" }, desktopOnly: true },
  ];
  const favorites = [
    { icon: Music2, title: "Music", sub: "Listen & discover", t: { tab: "musik" } },
    { icon: Crown, title: "Lucky Royale", sub: "Spin & win", t: { path: "/lucky-royale" } },
    { icon: Headset, title: "Live Support", sub: "Need help?", t: { tab: "tiket" } },
    { icon: Package, title: "Pesanan", sub: stats ? `${stats.activeOrders} aktif` : "Lihat pesanan", t: { tab: "seller" } },
    { icon: Gift, title: "Reward", sub: "Klaim reward", t: { tab: "streak" } },
  ];

  return (
    <section aria-label="Beranda" className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
      {/* HERO ACCOUNT — saldo utama is the focal point */}
      <motion.div {...fade(0)} className={cn(card, "relative overflow-hidden p-5 md:col-span-2 lg:col-span-8 lg:p-7")} style={{ backgroundImage: "var(--gradient-home-hero)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Selamat datang kembali,</p>
            <h2 className="mt-0.5 truncate text-xl font-bold tracking-tight text-foreground lg:text-2xl">{user.username}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => onOpen({ tab: "botnotif" })} aria-label={`Notifikasi${stats?.unread ? `, ${stats.unread} belum dibaca` : ""}`} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-muted active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Bell className="h-[18px] w-[18px]" />
              {!!stats?.unread && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">{stats.unread > 99 ? "99+" : stats.unread}</span>}
            </button>
            <button onClick={refreshAll} aria-label="Muat ulang beranda" className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <RefreshCw className={cn("h-[18px] w-[18px]", (loading || wallet.loading) && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Wallet className="h-3.5 w-3.5" aria-hidden /> Saldo utama</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="truncate text-3xl font-extrabold tabular-nums tracking-tight text-foreground lg:text-4xl" aria-live="polite">{hidden ? "Rp ••••••" : rp(user.balance)}</p>
              <button onClick={toggleHidden} aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"} aria-pressed={hidden} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              {stats === null ? <Skeleton className="h-6 w-36 rounded-full" /> : stats.saldoIn !== null && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-muted-foreground">
                  Saldo IN <strong className="font-semibold tabular-nums text-foreground">{hidden ? "••••" : rp(stats.saldoIn)}</strong>
                </span>
              )}
              {!!user.bonus_balance && !hidden && (
                <span className="inline-flex items-center rounded-full border border-border bg-background/70 px-2.5 py-1 text-muted-foreground">Bonus <strong className="ml-1 font-semibold text-foreground">{rp(user.bonus_balance)}</strong></span>
              )}
            </div>
          </div>
          <button onClick={() => onOpen({ tab: "saldo" })} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <PlusCircle className="h-4 w-4" aria-hidden /> Top Up
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-start gap-2 text-xs text-foreground"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span><strong className="block">Tidak dapat memuat ringkasan</strong><span className="text-muted-foreground">Data akun belum berhasil dimuat.</span></span></p>
            <button onClick={refreshAll} className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">Coba lagi</button>
          </div>
        )}
      </motion.div>

      {/* ACCOUNT SUMMARY */}
      <motion.div {...fade(1)} className={cn(card, "p-4 md:col-span-2 lg:col-span-4 lg:p-5")}>
        <SectionTitle>Ringkasan akun</SectionTitle>
        <dl className="grid grid-cols-4 gap-2 lg:grid-cols-2 lg:gap-2.5">
          {summary.map((s) => (
            <button key={s.label} type="button" onClick={() => onOpen(s.t)} className="min-w-0 rounded-2xl bg-muted/50 p-2.5 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:p-3.5">
              <s.icon className="h-4 w-4 text-primary" aria-hidden />
              <dt className="mt-1.5 truncate text-[10px] text-muted-foreground lg:text-[11px]">{s.label}</dt>
              <dd className="truncate text-sm font-bold tabular-nums text-foreground lg:text-lg">{s.value ?? <Skeleton className="mt-1 h-4 w-10" />}</dd>
            </button>
          ))}
        </dl>
      </motion.div>

      {/* QUICK ACTION */}
      <nav aria-label="Aksi cepat" className="grid grid-cols-4 gap-2 md:col-span-2 lg:col-span-12 lg:grid-cols-5 lg:gap-3">
        {quick.map((q, i) => (
          <motion.button key={q.label} {...fade(i)} whileHover={reduce ? undefined : { y: -2 }} onClick={() => onOpen(q.t)}
            className={cn(card, "flex-col items-center gap-1.5 p-3 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-row lg:gap-3 lg:p-4", q.desktopOnly ? "hidden lg:flex" : "flex")}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><q.icon className="h-5 w-5" aria-hidden /></span>
            <span className="text-[11px] font-semibold text-foreground lg:text-sm">{q.label}</span>
          </motion.button>
        ))}
      </nav>

      {/* MEMBERSHIP — Gem + Premium from their own backend sources */}
      <div className="min-w-0 md:col-span-1 lg:col-span-7">
        <SectionTitle>Membership</SectionTitle>
        <MembershipHomeSection visitorId={user.visitor_id} onGo={(t) => onOpen({ tab: t })} stacked />
      </div>

      {/* LUCKY ROYALE */}
      <div className="min-w-0 md:col-span-1 lg:col-span-5">
        <SectionTitle>Lucky Royale</SectionTitle>
        <button onClick={() => onOpen({ path: "/lucky-royale" })} className={cn(card, "flex w-full items-center gap-4 p-4 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:p-5")}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Crown className="h-6 w-6" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            {tickets === null ? <Skeleton className="h-6 w-24" /> : <span className="block text-xl font-bold tabular-nums text-foreground">{num(tickets)} Tiket</span>}
            <span className="block truncate text-xs text-muted-foreground">{tickets ? "Hadiah menantimu" : "Belum ada tiket"}</span>
          </span>
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{tickets ? "Main Sekarang" : "Ke Lucky Royale"}</span>
        </button>
      </div>

      {/* FITUR FAVORIT — horizontal on mobile, grid on tablet/desktop */}
      <div className="min-w-0 md:col-span-2 lg:col-span-12">
        <SectionTitle>Fitur favorit</SectionTitle>
        <nav aria-label="Fitur favorit" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:grid md:grid-cols-5 md:overflow-visible lg:gap-3">
          {favorites.map((f) => (
            <button key={f.title} onClick={() => onOpen(f.t)} className={cn(card, "w-[132px] shrink-0 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none md:w-auto lg:p-4")}>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><f.icon className="h-5 w-5" aria-hidden /></span>
              <span className="mt-2 block truncate text-sm font-semibold text-foreground">{f.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{f.sub}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* AKTIVITAS TERBARU */}
      <div className={cn(card, "min-w-0 p-4 md:col-span-1 lg:col-span-7 lg:p-5")}>
        <SectionTitle action={<button onClick={() => onOpen({ tab: "history" })} className="text-xs font-semibold text-primary hover:underline">Semua</button>}>Aktivitas terbaru</SectionTitle>
        {stats === null ? (
          <div className="space-y-2.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full rounded-xl" />)}</div>
        ) : stats.txns.length === 0 ? (
          <p className="rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">Belum ada aktivitas saldo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.txns.map((t) => {
              const inflow = Number(t.amount) > 0;
              return (
                <li key={t.id}>
                  <button onClick={() => onOpen({ tab: "history" })} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/30">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", inflow ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {inflow ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">{t.description || t.type}</span>
                      <span className="block text-[11px] text-muted-foreground">{fmtDate(t.created_at)} WIB</span>
                    </span>
                    <span className={cn("shrink-0 text-[13px] font-bold tabular-nums", inflow ? "text-primary" : "text-destructive")}>
                      {hidden ? "••••" : `${inflow ? "+" : "-"}${rp(Math.abs(Number(t.amount)))}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* VOUCHER AKTIF — only the account's own real vouchers */}
      <div className={cn(card, "min-w-0 p-4 md:col-span-1 lg:col-span-5 lg:p-5")}>
        <SectionTitle action={<button onClick={() => onOpen({ tab: "voucher" })} className="text-xs font-semibold text-primary hover:underline">Lihat</button>}>Voucher aktif</SectionTitle>
        {stats === null ? (
          <div className="space-y-2.5">{[0, 1].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : stats.vouchers.length === 0 ? (
          <p className="rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">Belum ada voucher aktif.</p>
        ) : (
          <ul className="space-y-2">
            {stats.vouchers.map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3">
                <Ticket className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{v.discount_amount ? `${rp(v.discount_amount)} OFF` : "Voucher"}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">KODE: {v.code}</p>
                </div>
                {v.expires_at && <p className="shrink-0 text-right text-[10px] text-muted-foreground">Berakhir<br />{fmtDate(v.expires_at)}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* FITUR LAINNYA */}
      <button onClick={onShowAll} className={cn(card, "flex items-center justify-center gap-2 p-3 text-sm font-semibold text-primary hover:bg-primary/5 md:col-span-2 lg:col-span-12")}>
        <LayoutGrid className="h-4 w-4" aria-hidden /> Fitur lainnya <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
}

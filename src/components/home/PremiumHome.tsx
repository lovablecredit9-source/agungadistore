import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Crown, Gem, Flame, PlusCircle, Package, Heart, Gift, Ticket,
  Eye, EyeOff, RefreshCw, Sparkles, ChevronRight, Bell, Music2, Headset, Gamepad2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import MembershipHomeSection from "@/components/wallet/MembershipHomeSection";

export type HomeTarget = { tab?: string; path?: string };

interface Props {
  user: { visitor_id: string; username: string; phone: string; balance: number; bonus_balance?: number | null } | null;
  onOpen: (t: HomeTarget) => void;
  onShowAll: () => void;
}

interface Stats {
  streak: number;
  longest: number;
  tickets: number;
  membership: { name: string; expires_at: string } | null;
  openTickets: number;
  activeOrders: number;
  unread: number;
}

const rp = (n: number) => "Rp " + Math.round(Number(n || 0)).toLocaleString("id-ID");
const phoneVariants = (p: string) => {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return [];
  const local = d.startsWith("62") ? "0" + d.slice(2) : d;
  return [local, local.startsWith("0") ? "62" + local.slice(1) : local];
};

/** Beranda premium: semua angka dibaca langsung dari tabel yang sudah ada (tanpa data contoh). */
export default function PremiumHome({ user, onOpen, onShowAll }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { try { setHidden(localStorage.getItem("home_hide_balance") === "1"); } catch {} }, []);
  const toggleHidden = () => setHidden((h) => { try { localStorage.setItem("home_hide_balance", h ? "0" : "1"); } catch {} return !h; });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(false);
    try {
      const vid = user.visitor_id;
      const sb = supabase as any;
      const phones = phoneVariants(user.phone);
      const [st, tk, mem, sup, ord, notif] = await Promise.all([
        sb.from("daily_streaks").select("current_streak, longest_streak").eq("visitor_id", vid).maybeSingle(),
        sb.from("luck_spin_tickets").select("balance").eq("visitor_id", vid),
        sb.from("streak_user_memberships").select("plan_name, expires_at").eq("visitor_id", vid).eq("is_active", true).gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(1).maybeSingle(),
        phones.length ? sb.from("support_tickets").select("id", { count: "exact", head: true }).in("phone", phones).in("status", ["open", "pending", "in_progress", "baru"]) : Promise.resolve({ count: 0 }),
        sb.from("seller_orders").select("id", { count: "exact", head: true }).eq("buyer_visitor_id", vid).in("status", ["pending", "paid", "processing", "shipped", "dikemas", "dikirim"]),
        sb.rpc("get_my_notifications", { p_visitor_id: vid, p_limit: 50 }),
      ]);
      if (st.error || tk.error || mem.error) throw new Error("load");
      setStats({
        streak: st.data?.current_streak ?? 0,
        longest: st.data?.longest_streak ?? 0,
        tickets: (tk.data || []).reduce((a: number, r: any) => a + Number(r.balance || 0), 0),
        membership: mem.data ? { name: mem.data.plan_name, expires_at: mem.data.expires_at } : null,
        openTickets: sup.count ?? 0,
        activeOrders: ord.count ?? 0,
        unread: Array.isArray(notif.data) ? notif.data.filter((n: any) => !n.is_read).length : 0,
      });
    } catch { setError(true); }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const quick = [
    { icon: Wallet, title: "Saldo", sub: "Saldo & transaksi", t: { tab: "saldo" } },
    { icon: Crown, title: "Lucky Royale", sub: stats ? `${stats.tickets} tiket · hadiah` : "Tiket & hadiah", t: { path: "/lucky-royale" } },
    { icon: Gem, title: "Membership Gem", sub: stats?.membership ? stats.membership.name : "Lihat benefit", t: { tab: "streakmembership" } },
    { icon: Flame, title: "Shop Streak", sub: stats ? `${stats.streak} hari streak` : "Streak & reward", t: { tab: "streakshop" } },
  ];
  const actions = [
    { icon: PlusCircle, label: "Top Up", t: { tab: "saldo" } },
    { icon: Package, label: "Pesanan", t: { tab: "seller" }, badge: stats?.activeOrders },
    { icon: Heart, label: "Wishlist", t: { tab: "likes" } },
    { icon: Gift, label: "Reward", t: { tab: "streak" } },
    { icon: Ticket, label: "Voucher", t: { tab: "voucher" } },
  ];

  return (
    <section aria-label="Ringkasan akun" className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5 lg:space-y-0 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* Hero (desktop: main column, row 1) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm lg:col-start-1 lg:row-start-1 lg:p-7"
        style={{ backgroundImage: "var(--gradient-home-hero)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{user ? "Selamat datang kembali," : "Selamat datang di Agung Adi Store"}</p>
            <h2 className="mt-0.5 truncate text-xl font-bold tracking-tight text-foreground">{user ? user.username : "Masuk untuk mulai"}</h2>
            {user && (
              <span className={cn("mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                stats?.membership ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
                <Crown className="h-3 w-3" aria-hidden /> {stats?.membership ? `Gem: ${stats.membership.name}` : "Belum member Gem"}
              </span>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-1">
              <button onClick={() => onOpen({ tab: "botnotif" })} aria-label={`Notifikasi${stats?.unread ? `, ${stats.unread} belum dibaca` : ""}`} className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-muted active:scale-95 transition">
                <Bell className="h-4 w-4" />
                {!!stats?.unread && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">{stats.unread > 99 ? "99+" : stats.unread}</span>}
              </button>
              <button onClick={() => void load()} aria-label="Muat ulang ringkasan" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted active:scale-95 transition">
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
            </div>
          )}
        </div>

        {user ? (
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Saldo tersedia</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold tabular-nums text-foreground">{hidden ? "Rp ••••••" : rp(user.balance)}</p>
                <button onClick={toggleHidden} aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"} className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                  {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              {!!user.bonus_balance && !hidden && <p className="text-[11px] text-muted-foreground">+ bonus {rp(user.bonus_balance)}</p>}
            </div>
            <button onClick={() => onOpen({ tab: "saldo" })} className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm active:scale-95 transition">
              <PlusCircle className="h-3.5 w-3.5" /> Top Up
            </button>
          </div>
        ) : (
          <button onClick={() => onOpen({ tab: "saldo" })} className="mt-4 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground active:scale-95 transition">
            Masuk / Daftar <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}

        {error && (
          <p className="mt-3 text-[11px] text-destructive">Sebagian ringkasan gagal dimuat. <button className="underline" onClick={() => void load()}>Coba lagi</button></p>
        )}
      </motion.div>

      {/* Right rail on desktop; directly under the hero on mobile. Data only from existing backend sources. */}
      {user && (
        <aside aria-label="Membership & ringkasan" className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-20">
          <MembershipHomeSection visitorId={user.visitor_id} onGo={(t) => onOpen({ tab: t })} stacked />
          {stats && (
            <div className="hidden rounded-2xl border border-border bg-card p-4 lg:block">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ringkasan akun</p>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: "Streak", value: `${stats.streak} hari`, t: { tab: "streak" } },
                  { label: "Tiket spin", value: String(stats.tickets), t: { path: "/lucky-royale" } },
                  { label: "Tiket bantuan aktif", value: String(stats.openTickets), t: { tab: "tiket" } },
                  { label: "Pesanan aktif", value: String(stats.activeOrders), t: { tab: "seller" } },
                  { label: "Notifikasi baru", value: String(stats.unread), t: { tab: "botnotif" } },
                  { label: "Streak terpanjang", value: `${stats.longest} hari`, t: { tab: "streak" } },
                ].map((r) => (
                  <button key={r.label} type="button" onClick={() => onOpen(r.t)} className="min-w-0 rounded-xl bg-muted/40 p-2.5 text-left transition hover:bg-muted">
                    <dt className="truncate text-[10px] text-muted-foreground">{r.label}</dt>
                    <dd className="truncate text-sm font-bold tabular-nums text-foreground">{r.value}</dd>
                  </button>
                ))}
              </dl>
            </div>
          )}
        </aside>
      )}

      <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-2">
      {/* Pintasan premium */}
      <nav aria-label="Pintasan premium" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible lg:grid-cols-3 lg:gap-3 2xl:grid-cols-5">
        {[
          { icon: Music2, title: "Music", sub: "Listen & discover", t: { tab: "musik" } },
          { icon: Headset, title: "Live Support", sub: "Need help?", t: { tab: "tiket" } },
          { icon: Ticket, title: "My Tickets", sub: stats ? `${stats.openTickets} tiket aktif` : "Tiket bantuan", t: { tab: "tiket" } },
          { icon: Crown, title: "Lucky Royale", sub: "Spin & win", t: { path: "/lucky-royale" } },
          { icon: Gamepad2, title: "Games", sub: "Main & kumpulkan poin", t: { tab: "game" } },
        ].map((q, i) => (
          <motion.button key={q.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }} whileTap={{ scale: 0.95 }}
            onClick={() => onOpen(q.t)}
            className="relative w-[124px] shrink-0 overflow-hidden rounded-[20px] border border-border bg-card p-3 text-left transition hover:border-primary/50 sm:w-auto">
            <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary/15 blur-xl" />
            <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><q.icon className="h-5 w-5" aria-hidden /></span>
            <span className="relative mt-2 block truncate text-sm font-bold text-foreground">{q.title}</span>
            <span className="relative block truncate text-[11px] text-muted-foreground">{q.sub}</span>
          </motion.button>
        ))}
      </nav>

      {/* Navigasi premium utama */}
      <nav aria-label="Fitur utama" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 lg:gap-3 2xl:grid-cols-4">
        {quick.map((q, i) => (
          <motion.button
            key={q.title}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onOpen(q.t)}
            className="group relative flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <q.icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{q.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{q.sub}</span>
            </span>
          </motion.button>
        ))}
      </nav>
      <button onClick={onShowAll} className="flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium text-primary hover:bg-primary/5">
        Lihat Semua Fitur <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Aksi cepat */}
      <div className="flex justify-between gap-1">
        {actions.map((a) => (
          <button key={a.label} onClick={() => onOpen(a.t)} className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 hover:bg-muted active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"><a.icon className="h-4 w-4 text-foreground" aria-hidden /></span>
            <span className="text-[11px] font-medium text-muted-foreground">{a.label}</span>
            {!!a.badge && <span className="absolute right-2 top-1 rounded-full bg-destructive px-1.5 text-[9px] font-bold leading-4 text-destructive-foreground">{a.badge}</span>}
          </button>
        ))}
      </div>

      {user && stats?.membership && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3 text-primary" /> Membership Gem aktif sampai {new Date(stats.membership.expires_at).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</p>
      )}
      </div>
    </section>
  );
}

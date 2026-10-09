import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Users, MessageCircle, Send, Package, Ticket, Clock, Wallet, ArrowUpCircle, Tag, Lock, AlertCircle, Bell, Settings,
  Music, HardDrive, Megaphone, Key, Bot, FileText, Globe, Disc3, ShoppingBag, Gift, CalendarDays, Zap, Shield, Crown,
  Ban, Heart, BellRing, Swords, Flame, Store, UserCog, Menu, ChevronsLeft, ChevronsRight, LogOut, X, Search, type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAdminHeartbeat } from "@/components/support/useAdminOnline";

/** Satu daftar menu Admin (hanya tab yang memang ada di AdminDashboard), dikelompokkan untuk sidebar & drawer. */
export type AdminNavItem = { key: string; label: string; icon: LucideIcon; desc: string };
export const ADMIN_NAV: { title: string; items: AdminNavItem[] }[] = [
  { title: "User", items: [
    { key: "totaluser", label: "Total User", icon: Users, desc: "Lihat dan pantau seluruh akun pengguna." },
    { key: "userreset", label: "Reset User", icon: UserCog, desc: "Reset saldo, kredit, atau streak pengguna." },
    { key: "banned", label: "Banned", icon: Ban, desc: "Kelola akun yang diblokir." },
    { key: "pin", label: "PIN", icon: Lock, desc: "Kelola permintaan reset PIN pengguna." },
  ] },
  { title: "Store", items: [
    { key: "products", label: "Produk", icon: Package, desc: "Kelola produk dan inventory toko." },
    { key: "seller", label: "Seller", icon: Store, desc: "Pendaftaran, produk, pesanan, dan kendala penjual." },
    { key: "prodflash", label: "Flash Sale Produk", icon: Zap, desc: "Atur flash sale untuk produk toko." },
    { key: "promo", label: "Promo", icon: Tag, desc: "Paket, bundle, dan promo toko." },
    { key: "diskon", label: "Diskon", icon: Tag, desc: "Voucher diskon per kategori." },
    { key: "tokens", label: "Token", icon: Ticket, desc: "Kelola token voucher produk." },
    { key: "claims", label: "Klaim", icon: Clock, desc: "Riwayat klaim token pengguna." },
    { key: "storeprem", label: "Premium Toko", icon: Crown, desc: "Membership premium toko." },
  ] },
  { title: "Finance", items: [
    { key: "saldo", label: "Saldo", icon: Wallet, desc: "Kelola saldo akun pengguna." },
    { key: "deposit", label: "Deposit", icon: ArrowUpCircle, desc: "Kelola dan verifikasi transaksi deposit." },
    { key: "membership", label: "Membership", icon: Shield, desc: "Paket membership streak." },
  ] },
  { title: "Support", items: [
    { key: "tickets", label: "Tiket", icon: AlertCircle, desc: "Kelola bantuan dan laporan pengguna." },
    { key: "chats", label: "Chat", icon: MessageCircle, desc: "Chat produk dari pengguna." },
    { key: "notif", label: "Notifikasi", icon: Bell, desc: "Kirim pengumuman ke pengguna." },
    { key: "wanotif", label: "WA Notif", icon: BellRing, desc: "Notifikasi WhatsApp otomatis." },
  ] },
  { title: "Content", items: [
    { key: "musik", label: "Musik", icon: Music, desc: "Kelola lagu, playlist, dan artis." },
    { key: "vmusik", label: "Voucher Musik", icon: HardDrive, desc: "Voucher storage & diskon musik." },
    { key: "sponsor", label: "Sponsor", icon: Megaphone, desc: "Iklan dan sponsor pihak ketiga." },
    { key: "postingan", label: "Postingan", icon: FileText, desc: "Pengumuman resmi admin." },
    { key: "sosmed", label: "Sosmed", icon: Globe, desc: "Tautan media sosial toko." },
    { key: "confess", label: "Confess", icon: Heart, desc: "Moderasi dan voucher Confess." },
  ] },
  { title: "AI & API", items: [
    { key: "apikey", label: "API", icon: Key, desc: "Kunci API integrasi." },
    { key: "aikey", label: "AI Key", icon: Key, desc: "Penyedia AI dan cadangan otomatis." },
    { key: "bot", label: "Bot WA", icon: Bot, desc: "Kontrol bot WhatsApp & antrian pesan." },
    { key: "telegram", label: "Telegram", icon: Send, desc: "Bot Telegram dan koneksi akun." },
  ] },
  { title: "Game / Event", items: [
    { key: "wheel", label: "Wheel", icon: Disc3, desc: "Roda keberuntungan dan hadiah." },
    { key: "shopstreak", label: "Shop Streak", icon: ShoppingBag, desc: "Item di Shop Streak." },
    { key: "strvoucher", label: "Voucher Streak", icon: Gift, desc: "Kode redeem streak." },
    { key: "eventstreak", label: "Event", icon: CalendarDays, desc: "Event streak terjadwal." },
    { key: "flashsale", label: "Flash Sale Streak", icon: Zap, desc: "Flash sale item streak." },
    { key: "pqvoucher", label: "Voucher Quest", icon: Ticket, desc: "Voucher Premium Quest." },
    { key: "lagaquest", label: "Quest Laga", icon: Swords, desc: "Quest laga mingguan." },
    { key: "firepass", label: "FirePass", icon: Flame, desc: "Season, tier, dan misi Fire Pass." },
  ] },
  { title: "Sistem", items: [
    { key: "settings", label: "Setting", icon: Settings, desc: "Pengaturan umum toko." },
  ] },
];
const ALL = ADMIN_NAV.flatMap((g) => g.items);

function NavList({ active, onSelect, badges, collapsed, query }: { active: string; onSelect: (k: string) => void; badges: Record<string, number>; collapsed?: boolean; query?: string }) {
  const q = (query || "").trim().toLowerCase();
  return <nav className="space-y-4" aria-label="Menu admin">
    {ADMIN_NAV.map((g) => {
      const items = g.items.filter((i) => !q || i.label.toLowerCase().includes(q));
      if (!items.length) return null;
      return <div key={g.title}>
        {!collapsed && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>}
        {collapsed && <div className="mx-auto mb-1 h-px w-6 bg-border" />}
        <div className="space-y-0.5">{items.map((it) => {
          const on = active === it.key; const b = badges[it.key] || 0;
          const btn = <button key={it.key} onClick={() => onSelect(it.key)} aria-current={on ? "page" : undefined} aria-label={it.label}
            className={cn("relative flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-0",
              on ? "bg-primary/10 font-semibold text-primary" : "text-foreground/75 hover:bg-muted hover:text-foreground")}>
            {on && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" aria-hidden />}
            <it.icon className={cn("h-[18px] w-[18px] shrink-0", on ? "text-primary" : "text-muted-foreground")} />
            {!collapsed && <span className="flex-1 truncate text-left">{it.label}</span>}
            {b > 0 && <span className={cn("rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground", collapsed && "absolute right-1 top-1 px-1 text-[9px]")}>{b}</span>}
          </button>;
          return collapsed ? <Tooltip key={it.key}><TooltipTrigger asChild>{btn}</TooltipTrigger><TooltipContent side="right">{it.label}</TooltipContent></Tooltip> : btn;
        })}</div>
      </div>;
    })}
  </nav>;
}

export default function AdminShell({ tab, onTab, badges, adminEmail, onLogout, headerExtra, children }: {
  tab: string; onTab: (k: string) => void; badges: Record<string, number>; adminEmail?: string | null; onLogout: () => void; headerExtra?: ReactNode; children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("admin_sidebar_collapsed") === "1"; } catch { return false; } });
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState<string | null>(adminEmail ?? null);
  useAdminHeartbeat();
  useEffect(() => { if (!adminEmail) supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)); }, [adminEmail]);
  useEffect(() => { try { localStorage.setItem("admin_sidebar_collapsed", collapsed ? "1" : "0"); } catch { /* abaikan */ } }, [collapsed]);
  const current = useMemo(() => ALL.find((i) => i.key === tab), [tab]);
  const group = ADMIN_NAV.find((g) => g.items.some((i) => i.key === tab))?.title;
  const totalBadge = Object.values(badges).reduce((a, b) => a + b, 0);
  const initial = (email || "A").charAt(0).toUpperCase();
  const pick = (k: string) => { onTab(k); setDrawer(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const firstBadge = Object.entries(badges).find(([, n]) => n > 0)?.[0];

  return <TooltipProvider delayDuration={150}>
    <div className="admin-ui min-h-screen bg-muted/30 text-foreground">
      {/* Sidebar desktop */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card/95 backdrop-blur-xl transition-[width] duration-300 lg:flex", collapsed ? "w-[72px]" : "w-64")}>
        <div className={cn("flex h-16 items-center gap-3 border-b border-border px-4", collapsed && "justify-center px-0")}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Shield className="h-5 w-5" /></div>
          {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-black tracking-tight">ADI STORE</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin Panel</p></div>}
        </div>
        {!collapsed && <div className="px-3 pt-3"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu" aria-label="Cari menu admin" className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-7 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" />{q && <button aria-label="Hapus pencarian" onClick={() => setQ("")} className="absolute right-2 top-2.5"><X className="h-4 w-4 text-muted-foreground" /></button>}</div></div>}
        <div className="flex-1 overflow-y-auto px-3 py-3"><NavList active={tab} onSelect={pick} badges={badges} collapsed={collapsed} query={q} /></div>
        <div className="border-t border-border p-2">
          <button onClick={() => setCollapsed((v) => !v)} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Ciutkan</>}
          </button>
        </div>
      </aside>

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2 px-3 sm:px-5">
            <Button variant="ghost" size="icon" className="h-11 w-11 lg:hidden" onClick={() => setDrawer(true)} aria-label="Buka menu admin"><Menu className="h-5 w-5" /></Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="lg:hidden">ADI STORE · </span>Admin Panel{group ? ` · ${group}` : ""}</p>
              <p className="truncate text-base font-black tracking-tight">{current?.label || "Dashboard"}</p>
            </div>
            {headerExtra}
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-11 w-11" aria-label={`Perlu tindakan: ${totalBadge}`} onClick={() => firstBadge && pick(firstBadge)}>
                <Bell className="h-5 w-5" />{totalBadge > 0 && <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground animate-scale-in">{totalBadge}</span>}
              </Button>
            </TooltipTrigger><TooltipContent>{totalBadge ? `${badges.tickets || 0} tiket · ${badges.chats || 0} chat · ${badges.deposit || 0} deposit menunggu` : "Tidak ada yang perlu ditindak"}</TooltipContent></Tooltip>
            <div className="hidden items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initial}</span>
              <span className="max-w-[160px] truncate text-xs text-muted-foreground">{email || "Admin"}</span>
            </div>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-11 w-11" onClick={onLogout} aria-label="Logout"><LogOut className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent>Logout</TooltipContent></Tooltip>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-5 lg:max-w-6xl lg:px-8 xl:max-w-7xl 2xl:max-w-[1440px]">
          <div key={tab} className="space-y-5 animate-fade-in">
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              {current && <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><current.icon className="h-5 w-5" /></span>}
              <div className="min-w-0"><h1 className="text-xl font-black tracking-tight">{current?.label || "Admin"}</h1><p className="text-sm text-muted-foreground">{current?.desc}</p></div>
            </div>
            {children}
          </div>
        </main>
      </div>

      {/* Drawer HP */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="flex w-[88vw] max-w-[340px] flex-col gap-0 p-0 [&>button]:hidden">
          <div className="flex h-16 items-center gap-3 border-b border-border px-4">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Shield className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1"><SheetTitle className="text-sm font-black">ADI STORE</SheetTitle><SheetDescription className="text-[10px] font-semibold uppercase tracking-[0.18em]">Admin Panel</SheetDescription></div>
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setDrawer(false)} aria-label="Tutup menu"><X className="h-5 w-5" /></Button>
          </div>
          <div className="px-3 pt-3"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari menu" aria-label="Cari menu admin" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" /></div></div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"><NavList active={tab} onSelect={pick} badges={badges} query={q} /></div>
          <div className="border-t border-border p-3"><Button variant="outline" className="h-11 w-full" onClick={onLogout}><LogOut className="mr-2 h-4 w-4" />Logout</Button></div>
        </SheetContent>
      </Sheet>
    </div>
  </TooltipProvider>;
}

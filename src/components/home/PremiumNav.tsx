import { useEffect, useMemo, useState } from "react";
import {
  Home, ShoppingBag, Gift, Headset, User, Clock, Wallet, Crown, Gem, Flame, HelpCircle, ChevronDown, ChevronRight,
  Settings, Search, X, Music2, Sun, Moon, Smartphone, Info, LayoutGrid, type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import AccountAvatar from "@/components/AccountAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface NavItem { key: string; label: string; icon: LucideIcon; external?: string }
type Select = (item: { key: string; external?: string }) => void;

const MOBILE: NavItem[] = [
  { key: "beranda", label: "Home", icon: Home },
  { key: "produk", label: "Shop", icon: ShoppingBag },
  { key: "streak", label: "Reward", icon: Gift },
  { key: "musik", label: "Musik", icon: Music2 },
  { key: "tiket", label: "Live Chat", icon: Headset },
  { key: "myspace", label: "Profil", icon: User },
];

/** Satu struktur menu untuk sidebar desktop, drawer HP, dan halaman Semua Fitur. */
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "Utama", items: [{ key: "beranda", label: "Beranda", icon: Home }, { key: "produk", label: "Shop", icon: ShoppingBag }, { key: "history", label: "Riwayat & Pesanan", icon: Clock }] },
  { title: "Wallet", items: [{ key: "saldo", label: "Saldo & Transaksi", icon: Wallet }] },
  { title: "Rewards", items: [
    { key: "luckroyale", label: "Lucky Royale", icon: Crown, external: "/lucky-royale" },
    { key: "streakmembership", label: "Membership", icon: Gem },
    { key: "streakshop", label: "Shop Streak", icon: Flame },
    { key: "streak", label: "Rewards", icon: Gift },
  ] },
  { title: "Support", items: [{ key: "tiket", label: "Live Chat", icon: Headset }, { key: "bantuan", label: "Pusat Bantuan", icon: HelpCircle }] },
  { title: "Akun", items: [{ key: "myspace", label: "Profil", icon: User }] },
];

export const PRIMARY_NAV_KEYS = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key)));

const CATEGORY_OF: Record<string, string> = {
  likes: "Marketplace", voucher: "Marketplace",
  game: "Entertainment", musik: "Entertainment", playlist: "Entertainment", spotlight: "Entertainment", firepass: "Entertainment", peringkat: "Entertainment",
  confess: "Community", anonchat: "Community", botgalau: "Community", publik: "Community", adminpost: "Community",
  rodadiskon: "Rewards", streakvoucher: "Rewards", streakevent: "Rewards", plus: "Rewards", questmission: "Rewards",
  storeai: "Tools", update: "Tools", botnotif: "Tools", telegramconnect: "Tools",
  seller: "Business", sponsor: "Business",
};
const CATEGORY_ORDER = ["Marketplace", "Rewards", "Entertainment", "Community", "Business", "Tools", "Lainnya"];

const DESC: Record<string, string> = {
  beranda: "Ringkasan akun & promo", produk: "Belanja produk digital", history: "Pesanan & riwayat beli", saldo: "Saldo, top up & transaksi",
  luckroyale: "Tiket spin & hadiah", streakmembership: "Paket & benefit member", streakshop: "Tukar poin streak", streak: "Klaim reward harian",
  tiket: "Chat admin & tiket bantuan", bantuan: "FAQ & panduan", myspace: "Profil & ruang pribadi", likes: "Produk & lagu favorit",
  voucher: "Voucher belanja", game: "Main game & kumpulkan poin", musik: "Dengar musik", playlist: "Playlist kamu", spotlight: "Sorotan pilihan",
  firepass: "Pass misi & hadiah", peringkat: "Papan peringkat", confess: "Kirim pesan rahasia", anonchat: "Ngobrol anonim", botgalau: "Teman curhat AI",
  publik: "Upload & dengar lagu publik", adminpost: "Kabar dari admin", rodadiskon: "Putar roda diskon", streakvoucher: "Voucher dari streak",
  streakevent: "Event streak", plus: "Fitur Plus", questmission: "Misi & quest", storeai: "Asisten belanja AI", update: "Catatan pembaruan",
  botnotif: "Notifikasi WhatsApp", telegramconnect: "Hubungkan Telegram", seller: "Jualan & toko kamu", sponsor: "Iklan & sponsor",
};

export function groupExtras(extra: NavItem[]) {
  const map = new Map<string, NavItem[]>();
  extra.forEach((it) => {
    const c = CATEGORY_OF[it.key] ?? "Lainnya";
    map.set(c, [...(map.get(c) ?? []), it]);
  });
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ title: c, items: map.get(c)! }));
}

function Row({ it, active, onSelect, badge }: { it: NavItem; active: boolean; onSelect: Select; badge?: number }) {
  return (
    <button onClick={() => onSelect(it)} aria-current={active ? "page" : undefined}
      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary/10 font-semibold text-primary" : "text-foreground/80 hover:bg-muted hover:text-foreground")}>
      <it.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="flex-1 truncate text-left">{it.label}</span>
      {!!badge && <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{badge}</span>}
    </button>
  );
}

function SettingsRow() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const opts = [["light", "Terang", Sun], ["dark", "Gelap", Moon], ["system", "Perangkat", Smartphone]] as const;
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:bg-muted">
        <Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-left">Pengaturan</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mx-3 mb-1 mt-1 space-y-2 rounded-xl border border-border p-2">
          <p className="text-[11px] text-muted-foreground">Tampilan</p>
          <div className="grid grid-cols-3 gap-1">
            {opts.map(([k, l, I]) => (
              <button key={k} onClick={() => setTheme(k)} className={cn("flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px]", theme === k ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted")}>
                <I className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>
          <button onClick={() => window.dispatchEvent(new Event("open-global-menu"))} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5" /> Syarat, Privasi & Tentang
          </button>
        </div>
      )}
    </div>
  );
}

/** Isi menu bersama (sidebar & drawer). */
function NavMenu({ active, onSelect, extraItems, badges = {}, onShowAll }: { active: string; onSelect: Select; extraItems: NavItem[]; badges?: Record<string, number>; onShowAll?: () => void }) {
  const [more, setMore] = useState(false);
  const cats = useMemo(() => groupExtras(extraItems), [extraItems]);
  return (
    <div className="space-y-4">
      {NAV_GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1 text-[11px] font-medium text-muted-foreground">{g.title}</p>
          <div className="space-y-0.5">
            {g.items.map((it) => <Row key={it.key} it={it} active={!it.external && active === it.key} onSelect={onSelect} badge={badges[it.key]} />)}
            {g.title === "Akun" && <SettingsRow />}
          </div>
        </div>
      ))}
      <div>
        <button onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
          <span className="flex items-center gap-3"><LayoutGrid className="h-4 w-4 text-muted-foreground" /> Fitur lainnya</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", more && "rotate-180")} />
        </button>
        {more && (
          <div className="mt-1 space-y-3">
            {cats.map((c) => (
              <div key={c.title}>
                <p className="px-3 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{c.title}</p>
                {c.items.map((it) => <Row key={it.key} it={it} active={!it.external && active === it.key} onSelect={onSelect} badge={badges[it.key]} />)}
              </div>
            ))}
          </div>
        )}
        {onShowAll && (
          <button onClick={onShowAll} className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-primary hover:bg-primary/5">
            Semua fitur <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Navigasi bawah (HP & tablet): 6 tujuan utama. */
const MUSIC_TABS = new Set(["musik", "playlist", "publik", "artist"]);
export function PremiumBottomNav({ active, onSelect, badges = {} }: { active: string; onSelect: Select; badges?: Record<string, number> }) {
  return (
    <nav aria-label="Navigasi bawah" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-between px-1">
        {MOBILE.map((it) => {
          const on = active === it.key || (it.key === "musik" && MUSIC_TABS.has(active));
          return (
            <button key={it.key} onClick={() => onSelect(it)} aria-label={it.label} aria-current={on ? "page" : undefined}
              className={cn("relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[10px] font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                on ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" aria-hidden />}
              <it.icon className="h-5 w-5" strokeWidth={on ? 2.3 : 1.8} aria-hidden />
              {it.label}
              {!!badges[it.key] && <span className="absolute right-[26%] top-2 h-2 w-2 rounded-full bg-destructive" aria-hidden />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Sidebar desktop. */
export function PremiumSidebar(props: { active: string; onSelect: Select; extraItems: NavItem[]; badges?: Record<string, number>; onShowAll?: () => void }) {
  return (
    <aside aria-label="Navigasi samping" className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card lg:flex">
      <div className="px-5 py-5"><p className="text-sm font-bold tracking-tight text-foreground">Agung Adi Store</p><p className="text-[11px] text-muted-foreground">Marketplace & reward</p></div>
      <div className="flex-1 overflow-y-auto px-3 pb-6"><NavMenu {...props} /></div>
    </aside>
  );
}

interface DrawerUser { visitor_id: string; username: string; phone: string; balance: number; avatar_url?: string | null }

/** Drawer HP: struktur sama dengan sidebar desktop. */
export function PremiumMobileDrawer({ open, onOpenChange, user, active, onSelect, extraItems, badges, onShowAll, formatPrice }: {
  open: boolean; onOpenChange: (o: boolean) => void; user: DrawerUser | null; active: string; onSelect: Select; extraItems: NavItem[];
  badges?: Record<string, number>; onShowAll: () => void; formatPrice: (n: number) => string;
}) {
  const [member, setMember] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !user) return;
    (supabase as any).from("streak_user_memberships").select("plan_name").eq("visitor_id", user.visitor_id).eq("is_active", true)
      .gt("expires_at", new Date().toISOString()).order("expires_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => setMember(data?.plan_name ?? null));
  }, [open, user]);
  const pick: Select = (it) => { onOpenChange(false); onSelect(it); };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[86vw] max-w-[340px] flex-col gap-0 p-0 [&>button]:hidden">
        <div className="border-b border-border p-4">
          <div className="flex items-start justify-between gap-2">
            <SheetTitle className="text-sm font-semibold">Menu</SheetTitle>
            <SheetDescription className="sr-only">Navigasi utama aplikasi</SheetDescription>
            <button onClick={() => onOpenChange(false)} aria-label="Tutup menu" className="-mr-1 -mt-1 grid h-9 w-9 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          {user ? (
            <div className="mt-2 flex items-center gap-3">
              <AccountAvatar visitorId={user.visitor_id} username={user.username} avatarUrl={user.avatar_url} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
                <p className="truncate text-[11px] text-muted-foreground">{member ? `Member ${member}` : "Belum member"} · {formatPrice(user.balance)}</p>
              </div>
              <button onClick={() => pick({ key: "myspace" })} className="shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-medium hover:bg-muted">Profil</button>
            </div>
          ) : (
            <button onClick={() => pick({ key: "saldo" })} className="mt-2 w-full rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground">Masuk / Daftar</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
          <NavMenu active={active} onSelect={pick} extraItems={extraItems} badges={badges} onShowAll={() => { onOpenChange(false); onShowAll(); }} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Halaman "Semua Fitur": cari + kategori, semua fitur lama tetap bisa ditemukan. */
export function AllFeaturesSheet({ open, onOpenChange, onSelect, extraItems }: { open: boolean; onOpenChange: (o: boolean) => void; onSelect: Select; extraItems: NavItem[] }) {
  const [q, setQ] = useState("");
  const sections = useMemo(() => {
    const base = [
      { title: "Marketplace", items: [NAV_GROUPS[0].items[1], NAV_GROUPS[0].items[2]] },
      { title: "Wallet", items: NAV_GROUPS[1].items },
      { title: "Rewards", items: NAV_GROUPS[2].items },
      { title: "Support", items: [...NAV_GROUPS[3].items, ...NAV_GROUPS[4].items] },
    ];
    const merged = new Map(base.map((b) => [b.title, [...b.items]]));
    groupExtras(extraItems).forEach((c) => merged.set(c.title, [...(merged.get(c.title) ?? []), ...c.items]));
    const s = q.trim().toLowerCase();
    return [...merged.entries()].map(([title, items]) => ({ title, items: items.filter((i) => !s || `${i.label} ${DESC[i.key] ?? ""}`.toLowerCase().includes(s)) })).filter((x) => x.items.length);
  }, [extraItems, q]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 rounded-t-3xl p-0">
        <div className="border-b border-border p-4">
          <SheetTitle className="text-base font-semibold">Semua Fitur</SheetTitle>
          <SheetDescription className="text-xs">Temukan semua fitur Agung Adi Store.</SheetDescription>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari fitur..." aria-label="Cari fitur"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary" />
          </div>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          {sections.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Fitur tidak ditemukan.</p>}
          {sections.map((s) => (
            <section key={s.title}>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{s.title}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {s.items.map((it) => (
                  <button key={s.title + it.key} onClick={() => { onOpenChange(false); onSelect(it); }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:border-primary/40">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><it.icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{it.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{DESC[it.key] ?? `Buka ${it.label}`}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

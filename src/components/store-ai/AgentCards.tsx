import { useState } from "react";
import {
  ShoppingBag,
  Share2,
  Package,
  Star,
  BadgeCheck,
  Ticket,
  Wallet,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Gamepad2,
  Flame,
  Crown,
  Receipt,
  LifeBuoy,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface AiProduct {
  kind: "product";
  n: number;
  source: "admin" | "seller";
  id: string;
  title: string;
  price: number;
  promo_price: number | null;
  stock: number | null;
  image: string | null;
  category: string | null;
  seller: { name: string; verified: boolean } | null;
  rating: { avg: number; count: number } | null;
  sold: number | null;
  created_at: string | null;
  description: string | null;
  url: string;
}
export interface AiVoucher {
  kind: "voucher";
  id: string;
  code: string;
  discount: number;
  min_purchase: number;
  expires_at: string | null;
  personal: boolean;
  remaining: number | null;
}
export interface AiAccount {
  kind: "account" | "balance";
  loggedIn: boolean;
  username?: string | null;
  balance?: number | null;
  bonus_balance?: number | null;
  saldo_in?: number | null;
  gems?: number | null;
  streak?: number | null;
  premium?: { plan: string; days_left: number } | null;
  active_orders?: number | null;
  recent_orders?: { code: string; title: string; status: string }[];
  open_tickets?: number | null;
  vouchers?: number;
}
export interface AiCompare {
  kind: "compare";
  items: AiProduct[];
}
export type AiCard = AiProduct | AiVoucher | AiAccount | AiCompare;

const rp = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
const NA = "Data tidak tersedia.";

function ActionBtn({
  onClick,
  children,
  primary,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition active:scale-95 ${primary ? "bg-primary text-primary-foreground hover:opacity-90" : "border bg-background hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

async function shareProduct(p: AiProduct) {
  const url = `${window.location.origin}${p.url}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: p.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast({ title: "Link produk disalin 🔗" });
  } catch {
    /* user cancelled */
  }
}

export function ProductCardView({ p, go }: { p: AiProduct; go: (to: string) => void }) {
  const price = p.promo_price ?? p.price;
  return (
    <div className="flex gap-2.5 rounded-xl border bg-background p-2 shadow-sm">
      <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        {p.image ? (
          <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-6 h-6 text-muted-foreground" />
        )}
        <span className="absolute top-0.5 left-0.5 text-[9px] font-black px-1 rounded bg-background/90 border">
          #{p.n}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-tight line-clamp-2">{p.title}</p>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-sm font-black text-primary">{rp(price)}</span>
          {p.promo_price != null && (
            <span className="text-[10px] line-through text-muted-foreground">{rp(p.price)}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
          <span>📦 {p.stock != null ? `Stok ${p.stock}` : "Stok -"}</span>
          {p.seller && (
            <span className="inline-flex items-center gap-0.5 truncate max-w-[140px]">
              🏪 {p.seller.name}
              {p.seller.verified && <BadgeCheck className="w-3 h-3 text-primary shrink-0" />}
            </span>
          )}
          {p.rating && (
            <span className="inline-flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-current text-amber-500" />
              {p.rating.avg.toFixed(1)} ({p.rating.count})
            </span>
          )}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          <ActionBtn primary onClick={() => go(p.url)}>
            <ShoppingBag className="w-3 h-3" /> Lihat Produk
          </ActionBtn>
          <ActionBtn onClick={() => shareProduct(p)}>
            <Share2 className="w-3 h-3" /> Bagikan
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

function CompareView({ items, go }: { items: AiProduct[]; go: (to: string) => void }) {
  const rows: { label: string; get: (p: AiProduct) => string }[] = [
    { label: "Harga", get: (p) => rp(p.promo_price ?? p.price) },
    { label: "Stok", get: (p) => (p.stock != null ? String(p.stock) : NA) },
    { label: "Seller", get: (p) => p.seller?.name || NA },
    { label: "Kategori", get: (p) => p.category || NA },
    {
      label: "Rating",
      get: (p) => (p.rating ? `${p.rating.avg.toFixed(1)} ⭐ (${p.rating.count})` : NA),
    },
    { label: "Terjual", get: (p) => (p.sold != null ? String(p.sold) : NA) },
  ];
  const letter = (i: number) => String.fromCharCode(65 + i);
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-muted/60">
              <th className="text-left p-2 font-bold w-20">Info</th>
              {items.map((p, i) => (
                <th key={p.id} className="text-left p-2 font-bold min-w-[110px]">
                  <span className="text-primary">Produk {letter(i)}</span>
                  <p className="font-semibold line-clamp-2 text-foreground">{p.title}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t">
                <td className="p-2 text-muted-foreground font-semibold">{r.label}</td>
                {items.map((p) => {
                  const v = r.get(p);
                  return (
                    <td
                      key={p.id}
                      className={`p-2 ${v === NA ? "text-muted-foreground italic" : "font-semibold"}`}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1.5 p-2 border-t">
        {items.map((p, i) => (
          <ActionBtn key={p.id} primary={i === 0} onClick={() => go(p.url)}>
            <ShoppingBag className="w-3 h-3" /> Lihat Produk {letter(i)}
          </ActionBtn>
        ))}
      </div>
    </div>
  );
}

function VoucherView({ v, go }: { v: AiVoucher; go: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  async function use() {
    try {
      await navigator.clipboard.writeText(v.code);
    } catch {
      /* ignore */
    }
    toast({
      title: `Kode ${v.code} disalin 🎟️`,
      description: "Tempel kodenya saat checkout produk.",
    });
    go("/produk");
  }
  return (
    <div className="rounded-xl border bg-background p-2.5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Ticket className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground font-semibold">
            🎟️ Voucher tersedia{v.personal ? " • khusus kamu" : ""}
          </p>
          <p className="text-sm font-black tracking-wide truncate">{v.code}</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          Aktif
        </span>
      </div>
      <p className="text-xs mt-1">
        Diskon: <b>{v.discount > 0 ? rp(v.discount) : NA}</b>
      </p>
      {open && (
        <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
          <p>Min. belanja: {v.min_purchase > 0 ? rp(v.min_purchase) : "Tanpa minimum"}</p>
          <p>
            Berlaku s/d:{" "}
            {v.expires_at
              ? new Date(v.expires_at).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Tanpa batas"}
          </p>
          {v.remaining != null && <p>Sisa kuota: {v.remaining}</p>}
        </div>
      )}
      <div className="flex gap-1.5 mt-2">
        <ActionBtn primary onClick={use}>
          Gunakan Voucher
        </ActionBtn>
        <ActionBtn onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Detail
          Voucher
        </ActionBtn>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5 min-w-0">
      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] text-muted-foreground font-semibold leading-none">{label}</p>
        <p className="text-xs font-black truncate">{value}</p>
      </div>
    </div>
  );
}

function AccountView({ a, go }: { a: AiAccount; go: (to: string) => void }) {
  if (!a.loggedIn) {
    return (
      <div className="rounded-xl border bg-background p-3 text-xs">
        <p className="font-bold">👤 Belum login akun saldo</p>
        <p className="text-muted-foreground mt-0.5">
          Masuk dulu supaya aku bisa membaca data akunmu.
        </p>
        <div className="mt-2">
          <ActionBtn primary onClick={() => go("/saldo")}>
            Login / Daftar
          </ActionBtn>
        </div>
      </div>
    );
  }
  const actions: { label: string; to: string }[] = [];
  if (a.kind === "balance") {
    actions.push(
      { label: "Buka Deposit", to: "/saldo" },
      { label: "Lihat Transaksi", to: "/history" },
    );
  } else {
    actions.push({ label: "Deposit", to: "/saldo" });
    if ((a.active_orders ?? 0) > 0) actions.push({ label: "Lihat Pesanan", to: "/seller" });
    if ((a.vouchers ?? 0) > 0) actions.push({ label: "Lihat Voucher", to: "/voucher" });
    actions.push({ label: "Lihat Produk", to: "/produk" });
    if ((a.open_tickets ?? 0) > 0) actions.push({ label: "Lihat Support", to: "/tiket" });
  }
  return (
    <div className="rounded-xl border bg-background p-2.5">
      <p className="text-xs font-bold mb-1.5">
        {a.kind === "balance" ? "💰 Saldo" : `👤 ${a.username || "Akun"}`}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        <Stat
          icon={Wallet}
          label="Saldo tersedia"
          value={a.balance != null ? rp(a.balance) : null}
        />
        <Stat icon={Wallet} label="Bonus" value={a.bonus_balance ? rp(a.bonus_balance) : null} />
        <Stat
          icon={Gamepad2}
          label="Saldo IN (game)"
          value={a.saldo_in != null ? rp(a.saldo_in) : null}
        />
        {a.kind === "account" && (
          <>
            <Stat icon={Gamepad2} label="Gem" value={a.gems != null ? String(a.gems) : null} />
            <Stat
              icon={Flame}
              label="Streak"
              value={a.streak != null ? `${a.streak} hari` : null}
            />
            <Stat
              icon={Crown}
              label="Premium"
              value={a.premium ? `${a.premium.plan} • ${a.premium.days_left} hr` : "Tidak aktif"}
            />
            <Stat
              icon={Receipt}
              label="Pesanan berjalan"
              value={a.active_orders != null ? String(a.active_orders) : null}
            />
            <Stat
              icon={Ticket}
              label="Voucher aktif"
              value={a.vouchers != null ? String(a.vouchers) : null}
            />
            <Stat
              icon={LifeBuoy}
              label="Tiket terbuka"
              value={a.open_tickets != null ? String(a.open_tickets) : null}
            />
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {actions.map((x, i) => (
          <ActionBtn key={x.to + x.label} primary={i === 0} onClick={() => go(x.to)}>
            {x.label}
          </ActionBtn>
        ))}
      </div>
    </div>
  );
}

export function AgentCards({ cards, go }: { cards: AiCard[]; go: (to: string) => void }) {
  if (!cards?.length) return null;
  return (
    <div className="space-y-1.5 mt-1.5">
      {cards.map((c, i) => {
        if (c.kind === "product") return <ProductCardView key={c.id + i} p={c} go={go} />;
        if (c.kind === "compare") return <CompareView key={"cmp" + i} items={c.items} go={go} />;
        if (c.kind === "voucher") return <VoucherView key={c.id} v={c} go={go} />;
        return <AccountView key={"acc" + i} a={c} go={go} />;
      })}
    </div>
  );
}

export function ProductSkeletons() {
  return (
    <div className="space-y-1.5 w-full">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-2.5 rounded-xl border bg-background p-2 animate-pulse">
          <div className="w-16 h-16 rounded-lg bg-muted" />
          <div className="flex-1 space-y-1.5 py-1">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/3" />
            <div className="h-2.5 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyResults({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed bg-background p-2.5 text-xs text-muted-foreground mt-1.5">
      <SearchX className="w-4 h-4 shrink-0" /> {text}
    </div>
  );
}

export function ErrorNotice({
  text,
  onRetry,
  disabled,
}: {
  text: string;
  onRetry: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
      <p className="font-semibold">{text}</p>
      <button
        onClick={onRetry}
        disabled={disabled}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted disabled:opacity-50"
      >
        <RefreshCw className="w-3 h-3" /> Coba Lagi
      </button>
    </div>
  );
}

export function Suggestions({
  items,
  onPick,
  disabled,
}: {
  items: string[];
  onPick: (s: string) => void;
  disabled?: boolean;
}) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((s) => (
        <button
          key={s}
          disabled={disabled}
          onClick={() => onPick(s)}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-background hover:border-primary hover:bg-primary/5 transition active:scale-95 disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

const REASONS: { v: string; label: string }[] = [
  { v: "salah", label: "Jawaban salah" },
  { v: "tidak_lengkap", label: "Jawaban tidak lengkap" },
  { v: "data_tidak_sesuai", label: "Data tidak sesuai" },
  { v: "tidak_paham", label: "Tidak memahami pertanyaan" },
  { v: "lainnya", label: "Lainnya" },
];

export function FeedbackButtons({
  value,
  onSend,
}: {
  value?: { feedback: "up" | "down"; reason?: string | null };
  onSend: (f: "up" | "down", reason?: string) => Promise<boolean>;
}) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  async function send(f: "up" | "down", reason?: string) {
    setBusy(true);
    const ok = await onSend(f, reason);
    setBusy(false);
    if (ok) setPicking(false);
  }
  const cls = (active: boolean) =>
    `inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition disabled:opacity-50 ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`;
  return (
    <>
      <button
        aria-label="Jawaban membantu"
        disabled={busy}
        onClick={() => send("up")}
        className={cls(value?.feedback === "up")}
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        aria-label="Jawaban kurang membantu"
        disabled={busy}
        onClick={() =>
          value?.feedback === "down" && !picking ? setPicking(true) : setPicking((p) => !p)
        }
        className={cls(value?.feedback === "down")}
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
      {picking && (
        <div className="basis-full flex flex-wrap gap-1 mt-1">
          {REASONS.map((r) => (
            <button
              key={r.v}
              disabled={busy}
              onClick={() => send("down", r.v)}
              className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${value?.reason === r.v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart3, Copy, Flame, Heart, Scale, Send, Share2, Sparkles, X, Zap, Gift, Eye, ShoppingCart, Package, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { flashProgress, type AnyProduct, type Badge } from "./shopLogic";

const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export function ProductBadges({ badges, max = 3, className }: { badges: Badge[]; max?: number; className?: string }) {
  const tone = { hot: "bg-destructive text-destructive-foreground", good: "bg-primary/15 text-primary", info: "bg-accent text-accent-foreground", danger: "bg-destructive/15 text-destructive" } as const;
  return <div className={cn("flex flex-wrap gap-1", className)}>{badges.slice(0, max).map((b) => <span key={b.key} className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none", tone[b.tone])}>{b.label}</span>)}</div>;
}

/** Rak produk horizontal (Trending / Rekomendasi / Smart Cart). */
export function ProductRail({ title, icon, subtitle, items, price, onOpen }: { title: string; icon: React.ReactNode; subtitle?: string; items: AnyProduct[]; price: (p: AnyProduct) => number; onOpen: (p: AnyProduct) => void }) {
  if (!items.length) return null;
  return <section className="animate-fade-in">
    <div className="mb-2 flex items-end justify-between"><div><h3 className="flex items-center gap-1.5 text-sm font-black">{icon}{title}</h3>{subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}</div></div>
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">{items.map((p) => <button key={p.id} onClick={() => onOpen(p)} className="w-28 shrink-0 snap-start rounded-xl border bg-card p-1.5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 active:scale-95">
      <img src={p.image_url || "/placeholder.svg"} alt={p.title} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
      <p className="mt-1 line-clamp-2 min-h-[2rem] text-[10px] font-bold">{p.title}</p>
      <p className="text-[11px] font-black text-primary">{rp(price(p))}</p>
      <p className="text-[9px] text-muted-foreground">{p.sold_count || 0} terjual</p>
    </button>)}</div>
  </section>;
}

/** Flash sale lebih menarik: countdown, bar stok, persen terjual, badge Hampir Habis. */
export function FlashSaleStrip({ items, countdown, onOpen }: { items: { flash: any; product: AnyProduct }[]; countdown: (d: string) => string; onOpen: (p: AnyProduct) => void }) {
  if (!items.length) return null;
  return <section className="relative overflow-hidden rounded-2xl border border-destructive/30 bg-gradient-to-br from-destructive/15 via-card to-card p-3">
    <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-sm font-black"><Zap className="h-4 w-4 animate-pulse text-destructive" />Flash Sale</h3><span className="rounded-md bg-destructive px-2 py-0.5 font-mono text-[11px] font-bold text-destructive-foreground">⏱ {countdown(items[0].flash.ends_at)}</span></div>
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{items.map(({ flash, product }) => { const pr = flashProgress(flash); const off = Math.round((1 - Number(flash.flash_price) / Math.max(1, Number(product.price))) * 100); return <button key={flash.id} onClick={() => onOpen(product)} className="relative w-32 shrink-0 rounded-xl border bg-background/70 p-1.5 text-left active:scale-95">
      {off > 0 && <span className="absolute right-2 top-2 z-10 rounded bg-destructive px-1 text-[9px] font-black text-destructive-foreground">-{off}%</span>}
      <img src={product.image_url || "/placeholder.svg"} alt={product.title} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
      <p className="mt-1 truncate text-[10px] font-bold">{product.title}</p>
      <p className="text-xs font-black text-destructive">{rp(flash.flash_price)}</p>
      <p className="text-[9px] text-muted-foreground line-through">{rp(product.price)}</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-destructive transition-all" style={{ width: `${pr.pct}%` }} /></div>
      <p className="mt-0.5 flex items-center justify-between text-[9px]"><span>{pr.pct}% terjual</span>{pr.almostGone && <span className="font-bold text-destructive"><Flame className="inline h-2.5 w-2.5" />Hampir Habis</span>}</p>
    </button>; })}</div>
  </section>;
}

/** Tombol wishlist dengan animasi hati. */
export function WishlistButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const [pop, setPop] = useState(false);
  return <Button variant="outline" onClick={() => { setPop(true); setTimeout(() => setPop(false), 450); onToggle(); }}>
    <Heart className={cn("mr-1 h-4 w-4 transition-transform", active && "fill-current text-destructive", pop && "scale-150")} />Wishlist
  </Button>;
}

export function ShareMenu({ title, url, onCopied }: { title: string; url: string; onCopied: () => void }) {
  const text = encodeURIComponent(`${title} ${url}`);
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Share2 className="mr-1 h-4 w-4" />Bagikan</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="center">
      <DropdownMenuItem onClick={async () => { await navigator.clipboard?.writeText(url); onCopied(); }}><Copy className="mr-2 h-4 w-4" />Salin Link</DropdownMenuItem>
      <DropdownMenuItem onClick={() => window.open(`https://wa.me/?text=${text}`, "_blank", "noopener")}><Send className="mr-2 h-4 w-4" />WhatsApp</DropdownMenuItem>
      <DropdownMenuItem onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, "_blank", "noopener")}><Send className="mr-2 h-4 w-4" />Telegram</DropdownMenuItem>
      {typeof navigator !== "undefined" && !!navigator.share && <DropdownMenuItem onClick={() => navigator.share({ title, url }).catch(() => {})}><Share2 className="mr-2 h-4 w-4" />Lainnya…</DropdownMenuItem>}
    </DropdownMenuContent></DropdownMenu>;
}

export function ProductStatsCard({ load }: { load: () => Promise<any> }) {
  const [s, setS] = useState<any>(null);
  useEffect(() => { load().then(setS).catch(() => setS(false)); }, []);
  if (s === false) return null;
  const cells: [string, any, any][] = s ? [["Dilihat", s.views, Eye], ["Wishlist", s.wishlist, Heart], ["Keranjang", s.cart, ShoppingCart], ["Terjual", s.sold, Package], ["Konversi", `${s.conversion}%`, Percent]] : [];
  return <section className="rounded-xl border border-primary/30 bg-primary/5 p-3"><h3 className="mb-2 flex items-center gap-1 text-sm font-black"><BarChart3 className="h-4 w-4 text-primary" />Statistik Produk (pemilik)</h3>
    {!s ? <div className="grid grid-cols-5 gap-1">{[1,2,3,4,5].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> :
      <div className="grid grid-cols-5 gap-1">{cells.map(([l, v, I]) => <div key={l} className="rounded-lg bg-background p-1.5 text-center"><I className="mx-auto h-3.5 w-3.5 text-muted-foreground" /><p className="text-sm font-black">{v}</p><p className="text-[9px] text-muted-foreground">{l}</p></div>)}</div>}
  </section>;
}

/** Bar mengambang + bottom sheet tabel perbandingan. */
export function CompareBar({ items, stores, price, onRemove, onClear }: { items: AnyProduct[]; stores: Record<string, any>; price: (p: AnyProduct) => number; onRemove: (id: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const rows: [string, (p: AnyProduct) => React.ReactNode][] = [
    ["Harga", (p) => <b className="text-primary">{rp(price(p))}</b>],
    ["Rating", (p) => p.rating_count ? `⭐ ${Number(p.rating_avg).toFixed(1)} (${p.rating_count})` : "Belum ada"],
    ["Terjual", (p) => p.sold_count || 0],
    ["Stok", (p) => Number(p.stock) > 0 ? p.stock : <span className="text-destructive">Habis</span>],
    ["Garansi", (p) => p.has_warranty ? `${p.warranty_duration_value || ""} ${p.warranty_duration_unit === "year" ? "Tahun" : "Bulan"}` : "Tidak ada"],
    ["Kategori", (p) => p.category || "-"],
    ["Toko", (p) => stores[p.store_id]?.store_name || "-"],
  ];
  return <>
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-lg items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur animate-fade-in lg:bottom-4">
      <Scale className="h-4 w-4 shrink-0 text-primary" />
      <div className="flex flex-1 gap-1 overflow-hidden">{items.map((p) => <img key={p.id} src={p.image_url || "/placeholder.svg"} alt={p.title} className="h-8 w-8 rounded-md object-cover" />)}<span className="self-center text-[11px] text-muted-foreground">{items.length}/3</span></div>
      <Button size="sm" variant="ghost" onClick={onClear}>Hapus</Button>
      <Button size="sm" disabled={items.length < 2} onClick={() => setOpen(true)}>Bandingkan</Button>
    </div>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
      <SheetTitle>Bandingkan Produk</SheetTitle><SheetDescription className="text-xs">Data diambil langsung dari produk.</SheetDescription>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-xs"><thead><tr><th className="w-20 p-2 text-left text-muted-foreground">Informasi</th>{items.map((p) => <th key={p.id} className="p-2 text-left align-top"><div className="relative"><img src={p.image_url || "/placeholder.svg"} alt={p.title} className="mb-1 aspect-square w-16 rounded-md object-cover" /><button aria-label="Hapus dari perbandingan" onClick={() => onRemove(p.id)} className="absolute left-12 top-0 rounded-full bg-muted p-0.5"><X className="h-3 w-3" /></button><p className="line-clamp-2 font-bold">{p.title}</p></div></th>)}</tr></thead>
        <tbody>{rows.map(([l, f]) => <tr key={l} className="border-t"><td className="p-2 text-muted-foreground">{l}</td>{items.map((p) => <td key={p.id} className="p-2">{f(p)}</td>)}</tr>)}</tbody></table></div>
    </SheetContent></Sheet>
  </>;
}

export function CartPromoBanner({ promo, onUse }: { promo: { best: { code: string; save: number } | null; next: { code: string; need: number } | null }; onUse: (code: string) => void }) {
  if (!promo.best && !promo.next) return null;
  return <div className="space-y-1.5 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3 text-xs">
    <p className="flex items-center gap-1 font-black"><Gift className="h-4 w-4 text-primary" />Promo Keranjang</p>
    {promo.best && <p className="flex items-center justify-between gap-2">Gunakan voucher <b>{promo.best.code}</b> untuk hemat {rp(promo.best.save)}<Button size="sm" className="h-7" onClick={() => onUse(promo.best!.code)}>Pakai</Button></p>}
    {promo.next && <p>Tambah <b>{rp(promo.next.need)}</b> lagi untuk memakai voucher <b>{promo.next.code}</b>.</p>}
  </div>;
}

export function RecommendIcon() { return <Sparkles className="h-4 w-4 text-primary" />; }
export function TrendIcon() { return <Flame className="h-4 w-4 text-destructive" />; }
export { UIBadge };

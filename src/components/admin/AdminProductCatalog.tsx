import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Package, Edit2, Trash2, Shield, ShoppingBag, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

type P = { id: string; title: string; price: number; stock: number; category?: string | null; has_warranty?: boolean; sold_count?: number | null; created_at?: string };
type Filter = "all" | "available" | "empty" | "warranty";
type Sort = "newest" | "best" | "price_low" | "price_high" | "stock_low";

interface Props<T extends P> {
  products: T[];          // sudah difilter oleh pencarian existing
  allProducts: T[];
  search: string;
  onSearch: (v: string) => void;
  getImages: (id: string) => string[];
  onEdit: (p: T) => void;
  onDelete: (id: string) => void;
}

const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString("id-ID")}`;

/** Katalog produk admin: statistik, filter, urutan, dan kartu produk berukuran tetap (tanpa layout shift). */
export default function AdminProductCatalog<T extends P>({ products, allProducts, search, onSearch, getImages, onEdit, onDelete }: Props<T>) {
  const [filter, setFilter] = useState<Filter>("all");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");

  const stats = useMemo(() => ({
    total: allProducts.length,
    available: allProducts.filter(p => p.stock > 0).length,
    empty: allProducts.filter(p => p.stock <= 0).length,
    sold: allProducts.reduce((s, p) => s + (p.sold_count || 0), 0),
  }), [allProducts]);
  const categories = useMemo(() => Array.from(new Set(allProducts.map(p => p.category).filter(Boolean))) as string[], [allProducts]);

  const list = useMemo(() => {
    const r = products.filter(p =>
      (filter === "all" || (filter === "available" && p.stock > 0) || (filter === "empty" && p.stock <= 0) || (filter === "warranty" && p.has_warranty)) &&
      (cat === "all" || p.category === cat));
    const by: Record<Sort, (a: T, b: T) => number> = {
      newest: (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
      best: (a, b) => (b.sold_count || 0) - (a.sold_count || 0),
      price_low: (a, b) => a.price - b.price,
      price_high: (a, b) => b.price - a.price,
      stock_low: (a, b) => a.stock - b.stock,
    };
    return [...r].sort(by[sort]);
  }, [products, filter, cat, sort]);

  const chips: { k: Filter; label: string }[] = [
    { k: "all", label: `Semua (${stats.total})` }, { k: "available", label: `Tersedia (${stats.available})` },
    { k: "empty", label: `Habis (${stats.empty})` }, { k: "warranty", label: "Garansi" },
  ];

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: Package, label: "Total Produk", val: stats.total },
          { icon: CheckCircle2, label: "Tersedia", val: stats.available },
          { icon: AlertTriangle, label: "Stok Habis", val: stats.empty },
          { icon: TrendingUp, label: "Total Terjual", val: stats.sold },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <s.icon className="w-4 h-4 text-primary" />
            <p className="mt-1 text-xl font-black tabular-nums">{s.val.toLocaleString("id-ID")}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 space-y-2 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari nama atau kategori produk..." value={search} onChange={e => onSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {chips.map(c => (
            <button key={c.k} type="button" onClick={() => setFilter(c.k)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === c.k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50 text-foreground"}`}>{c.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={cat} onChange={e => setCat(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs" aria-label="Kategori">
            <option value="all">Semua kategori</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="h-9 rounded-md border border-input bg-background px-2 text-xs" aria-label="Urutkan">
            <option value="newest">Terbaru</option>
            <option value="best">Terlaris</option>
            <option value="price_low">Harga termurah</option>
            <option value="price_high">Harga termahal</option>
            <option value="stock_low">Stok paling sedikit</option>
          </select>
        </div>
      </div>

      <p className="text-xs font-bold text-muted-foreground">Menampilkan {list.length} produk</p>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Tidak ada produk yang cocok.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map(p => {
            const img = getImages(p.id)[0];
            const low = p.stock > 0 && p.stock <= 3;
            return (
              <article key={p.id} className="group flex gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md">
                <div className="relative w-20 h-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {img ? <img src={img} alt={p.title} loading="lazy" width={80} height={80} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ShoppingBag className="w-6 h-6" /></div>}
                  {p.stock <= 0 && <span className="absolute inset-x-0 bottom-0 bg-destructive py-0.5 text-center text-[9px] font-bold text-destructive-foreground">HABIS</span>}
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <p className="font-bold text-sm leading-tight line-clamp-2">{p.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.category && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{p.category}</span>}
                    {p.has_warranty && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent-foreground"><Shield className="inline w-2.5 h-2.5" /> Garansi</span>}
                  </div>
                  <p className="mt-auto text-base font-black text-primary">{rp(p.price)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className={p.stock <= 0 ? "text-destructive font-bold" : low ? "font-bold text-foreground" : ""}>Stok {p.stock}{low ? " (menipis)" : ""}</span> • Terjual {p.sold_count || 0}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${p.title}`} onClick={() => onEdit(p)}><Edit2 className="w-4 h-4 text-primary" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Hapus ${p.title}`} onClick={() => onDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

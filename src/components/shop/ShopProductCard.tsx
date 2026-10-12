import { Eye, Heart, Share2, ShoppingBag, Shield, Package, Zap } from "lucide-react";

export interface ShopCardProduct {
  id: string;
  title: string;
  price: number;
  stock: number;
  category?: string | null;
  description?: string | null;
  has_warranty?: boolean | null;
  sold_count?: number | null;
  created_at: string;
}

interface Props {
  product: ShopCardProduct;
  media: React.ReactNode | null; // foto produk (carousel existing) atau null
  view: "grid" | "list" | "compact" | string;
  liked: boolean;
  likeCount: number;
  flashPrice: number | null; // harga flash sale aktual dari server, null bila tidak ada
  formatPrice: (n: number) => string;
  onOpen: () => void;
  onQuickView: () => void;
  onLike: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
}

/** Kartu produk katalog: ukuran konsisten, hanya data nyata (tanpa rating palsu). */
export default function ShopProductCard({ product: p, media, view, liked, likeCount, flashPrice, formatPrice, onOpen, onQuickView, onLike, onShare }: Props) {
  const inStock = p.stock > 0;
  const isGrid = view === "grid";
  const isNew = Date.now() - new Date(p.created_at).getTime() < 7 * 864e5;
  const price = flashPrice ?? p.price;

  return (
    <article
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      tabIndex={0}
      aria-label={`${p.title}, ${formatPrice(price)}`}
      className={`group relative flex overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isGrid ? "flex-col h-full" : "flex-row"} ${inStock ? "" : "opacity-75"}`}
    >
      <div className={`relative shrink-0 bg-muted/40 ${isGrid ? "aspect-square w-full" : view === "compact" ? "w-20 h-20" : "w-32 sm:w-40 aspect-square"}`}>
        {media ? (
          <div className="h-full w-full [&_*]:!h-full">{media}</div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-8 w-8 opacity-40" /></div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1 z-10">
          {flashPrice !== null && <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive px-2 py-0.5 text-[9px] font-black text-destructive-foreground"><Zap className="h-2.5 w-2.5" />FLASH</span>}
          {isNew && <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-black text-primary-foreground">BARU</span>}
          {!inStock && <span className="rounded-full bg-background/90 px-2 py-0.5 text-[9px] font-black text-foreground">HABIS</span>}
        </div>
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); onLike(e); }} aria-label={liked ? "Hapus dari suka" : "Suka produk"} aria-pressed={liked}
            className="rounded-full bg-background/80 p-1.5 backdrop-blur hover:bg-background">
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-destructive text-destructive" : "text-foreground"}`} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onQuickView(); }} aria-label="Lihat cepat"
            className="rounded-full bg-background/80 p-1.5 backdrop-blur hover:bg-background">
            <Eye className="h-3.5 w-3.5 text-foreground" />
          </button>
        </div>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${isGrid ? "p-3" : "p-3 sm:p-4"}`}>
        {p.category && <span className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{p.category}</span>}
        <h3 className={`font-bold leading-snug text-foreground line-clamp-2 ${isGrid ? "text-xs sm:text-sm min-h-[2.5em]" : "text-sm sm:text-base"}`}>{p.title}</h3>
        {!isGrid && view !== "compact" && p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={`font-black ${flashPrice !== null ? "text-destructive" : "text-primary"} ${isGrid ? "text-sm" : "text-base"}`}>{formatPrice(price)}</span>
          {flashPrice !== null && <span className="text-[10px] text-muted-foreground line-through">{formatPrice(p.price)}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          <span className={inStock ? "font-semibold text-foreground/80" : "font-semibold text-destructive"}>{inStock ? `Stok ${p.stock}` : "Stok habis"}</span>
          {(p.sold_count ?? 0) > 0 && <span>· {p.sold_count} terjual</span>}
          {likeCount > 0 && <span>· {likeCount} suka</span>}
          {p.has_warranty && <span className="inline-flex items-center gap-0.5 font-semibold text-foreground/80"><Shield className="h-3 w-3" />Garansi</span>}
        </div>

        <div className={`flex gap-1.5 ${isGrid ? "mt-auto pt-1" : "mt-1"}`}>
          <button onClick={(e) => { e.stopPropagation(); onOpen(); }} disabled={!inStock}
            className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-[11px] font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
            <ShoppingBag className="h-3.5 w-3.5" />{inStock ? "Beli" : "Habis"}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onShare(e); }} aria-label="Bagikan produk"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted">
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

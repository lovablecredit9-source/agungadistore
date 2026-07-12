import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, Zap, TrendingUp, Megaphone, FileText, Clock, ChevronRight,
  Flame, ShoppingBag, Heart, Ticket, Crown, ArrowRight
} from "lucide-react";
import { useLang, t, type Lang } from "@/lib/i18n";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
  has_warranty: boolean;
  sold_count?: number;
  created_at: string;
}

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  image_order: number;
}

interface HomeSponsor {
  id: string;
  title: string;
  image_url: string | null;
  price: number;
  seller_name: string;
  sponsor_number: number;
}

interface FlashSale {
  id: string;
  product_id: string;
  discount_percent: number | null;
  flash_price: number | null;
  mode: "discount_percent" | "manual_price";
  quota: number;
  sold: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

interface AdminPost {
  id: string;
  title: string;
  content?: string | null;
  image_url?: string | null;
  action_tab?: string | null;
  created_at?: string;
}

interface Props {
  products: Product[];
  productImages: ProductImage[];
  homeSponsors: HomeSponsor[];
  activeFlashSales: FlashSale[];
  adminPosts: AdminPost[];
  productLikeCounts: Record<string, number>;
  onOpenProduct: (p: Product) => void;
  onSelect: (tab: string) => void;
  lang: Lang;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

function getProductImage(product: Product, images: ProductImage[]) {
  const img = images.find((i) => i.product_id === product.id);
  return img?.image_url || product.image_url || "";
}

function useCountdown(target: string) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(target).getTime() - Date.now()));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { left, text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

export default function SpotlightTab({
  products,
  productImages,
  homeSponsors,
  activeFlashSales,
  adminPosts,
  productLikeCounts,
  onOpenProduct,
  onSelect,
  lang,
}: Props) {
  const now = Date.now();
  const liveFlashSales = useMemo(() => {
    return activeFlashSales
      .filter((f) => f.is_active && new Date(f.starts_at).getTime() <= now && new Date(f.ends_at).getTime() > now)
      .slice(0, 5);
  }, [activeFlashSales]);

  const flashProducts = useMemo(() => {
    return liveFlashSales
      .map((f) => {
        const product = products.find((p) => p.id === f.product_id);
        if (!product) return null;
        const finalPrice = f.mode === "manual_price" && f.flash_price != null
          ? f.flash_price
          : Math.round(product.price * (1 - (f.discount_percent || 0) / 100));
        return { flash: f, product, finalPrice };
      })
      .filter(Boolean) as { flash: FlashSale; product: Product; finalPrice: number }[];
  }, [liveFlashSales, products]);

  const trendingProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => (productLikeCounts[b.id] || 0) - (productLikeCounts[a.id] || 0))
      .slice(0, 6);
  }, [products, productLikeCounts]);

  const newArrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
  }, [products]);

  const latestPosts = useMemo(() => {
    return [...adminPosts]
      .sort((a, b) => new Date((b.created_at || 0)).getTime() - new Date((a.created_at || 0)).getTime())
      .slice(0, 4);
  }, [adminPosts]);

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/20 via-fuchsia-500/15 to-transparent p-5">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-primary mb-2">
              <Sparkles className="w-3 h-3" /> Highlight Hari Ini
            </div>
            <h2 className="text-2xl font-black leading-tight tracking-tight">Spotlight</h2>
            <p className="text-xs font-medium text-muted-foreground mt-1 max-w-[220px]">
              Kumpulan yang lagi hot: flash sale, produk trending, sponsor pilihan, dan info terbaru.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-fuchsia-600 flex items-center justify-center shadow-lg shrink-0">
            <Zap className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Flash Sale Live */}
      {flashProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white shadow">
                <Flame className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-extrabold">Flash Sale Live</h3>
            </div>
            <button onClick={() => onSelect("produk")} className="text-[10px] font-bold text-primary flex items-center gap-0.5 hover:underline">
              Lihat Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {flashProducts.map(({ flash, product, finalPrice }) => (
              <FlashSaleCard key={flash.id} flash={flash} product={product} finalPrice={finalPrice} image={getProductImage(product, productImages)} onOpen={() => onOpenProduct(product)} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Products */}
      {trendingProducts.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-extrabold">Produk Trending</h3>
            </div>
            <button onClick={() => onSelect("produk")} className="text-[10px] font-bold text-primary flex items-center gap-0.5 hover:underline">
              Lihat Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {trendingProducts.map((p) => (
              <ProductMiniCard key={p.id} product={p} image={getProductImage(p, productImages)} likes={productLikeCounts[p.id] || 0} onOpen={() => onOpenProduct(p)} />
            ))}
          </div>
        </section>
      )}

      {/* New Arrivals strip */}
      {newArrivals.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-extrabold">Baru Masuk</h3>
            </div>
            <button onClick={() => onSelect("produk")} className="text-[10px] font-bold text-primary flex items-center gap-0.5 hover:underline">
              Lihat Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {newArrivals.map((p) => (
              <ProductWideCard key={p.id} product={p} image={getProductImage(p, productImages)} onOpen={() => onOpenProduct(p)} />
            ))}
          </div>
        </section>
      )}

      {/* Sponsors */}
      {homeSponsors.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white shadow">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-extrabold">Sponsor Pilihan</h3>
            </div>
            <button onClick={() => onSelect("sponsor")} className="text-[10px] font-bold text-primary flex items-center gap-0.5 hover:underline">
              Lihat Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {homeSponsors.slice(0, 6).map((s) => (
              <SponsorCard key={s.id} sponsor={s} onOpen={() => onSelect("sponsor")} />
            ))}
          </div>
        </section>
      )}

      {/* Latest Admin Posts */}
      {latestPosts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-extrabold">Info Terbaru</h3>
            </div>
            <button onClick={() => onSelect("adminpost")} className="text-[10px] font-bold text-primary flex items-center gap-0.5 hover:underline">
              Lihat Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {latestPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => post.action_tab ? onSelect(post.action_tab) : onSelect("adminpost")}
                className="w-full text-left rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-3 active:scale-[0.98] transition hover:border-primary/40 group"
              >
                <div className="flex items-center gap-3">
                  {post.image_url && (
                    <img src={post.image_url} alt={post.title} className="w-14 h-14 rounded-xl object-cover border border-border shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold leading-snug line-clamp-2 group-hover:text-primary transition">{post.title}</div>
                    {post.content && <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{post.content}</div>}
                    <div className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {post.created_at ? new Date(post.created_at).toLocaleDateString("id-ID") : "Baru saja"}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quick jump chips */}
      <section className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-3">
        <h3 className="text-sm font-extrabold mb-3 px-1">Jelajahi Cepat</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Produk", icon: ShoppingBag, grad: "from-amber-400 via-orange-500 to-red-500", tab: "produk" },
            { label: "Musik", icon: Sparkles, grad: "from-fuchsia-500 via-purple-500 to-indigo-500", tab: "musik" },
            { label: "Game", icon: Crown, grad: "from-violet-500 via-purple-500 to-fuchsia-500", tab: "game" },
            { label: "Streak", icon: Flame, grad: "from-orange-400 via-red-500 to-pink-600", tab: "streak" },
          ].map(({ label, icon: Icon, grad, tab }) => (
            <button
              key={tab}
              onClick={() => onSelect(tab)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border bg-background/40 p-2 active:scale-95 transition hover:border-primary/40"
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-[9px] font-bold leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function FlashSaleCard({ flash, product, finalPrice, image, onOpen }: { flash: FlashSale; product: Product; finalPrice: number; image: string; onOpen: () => void }) {
  const { text } = useCountdown(flash.ends_at);
  const percent = flash.mode === "discount_percent" ? flash.discount_percent || 0 : Math.round(((product.price - finalPrice) / product.price) * 100);
  const soldPct = Math.min(100, Math.round((flash.sold / Math.max(1, flash.quota)) * 100));
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onOpen}
      className="shrink-0 w-[160px] rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-card/80 to-card/80 backdrop-blur p-3 text-left overflow-hidden relative"
    >
      <div className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">-{percent}%</div>
      <div className="w-full h-24 rounded-xl bg-muted overflow-hidden mb-2">
        {image ? <img src={image} alt={product.title} className="w-full h-full object-cover" /> : <ShoppingBag className="w-8 h-8 m-auto text-muted-foreground" />}
      </div>
      <div className="text-[11px] font-bold leading-tight line-clamp-2 mb-1">{product.title}</div>
      <div className="text-xs font-black text-rose-500">{formatPrice(finalPrice)}</div>
      <div className="text-[9px] text-muted-foreground line-through">{formatPrice(product.price)}</div>
      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-rose-500">
        <Clock className="w-3 h-3" /> {text}
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-rose-500" style={{ width: `${soldPct}%` }} />
      </div>
      <div className="text-[8px] text-muted-foreground mt-0.5">Terjual {flash.sold}/{flash.quota}</div>
    </motion.button>
  );
}

function ProductMiniCard({ product, image, likes, onOpen }: { product: Product; image: string; likes: number; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="text-left rounded-2xl border border-border/60 bg-background/40 p-2.5 active:scale-95 transition hover:border-primary/40 group">
      <div className="w-full h-28 rounded-xl bg-muted overflow-hidden mb-2">
        {image ? <img src={image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition" /> : <ShoppingBag className="w-8 h-8 m-auto text-muted-foreground" />}
      </div>
      <div className="text-[11px] font-bold leading-tight line-clamp-2 mb-1">{product.title}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatPrice(product.price)}</span>
        {likes > 0 && <span className="text-[9px] font-bold text-muted-foreground flex items-center gap-0.5"><Heart className="w-3 h-3" /> {likes}</span>}
      </div>
    </button>
  );
}

function ProductWideCard({ product, image, onOpen }: { product: Product; image: string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="shrink-0 w-[150px] text-left rounded-2xl border border-border/60 bg-background/40 p-2.5 active:scale-95 transition hover:border-primary/40 group">
      <div className="w-full h-24 rounded-xl bg-muted overflow-hidden mb-2">
        {image ? <img src={image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition" /> : <ShoppingBag className="w-8 h-8 m-auto text-muted-foreground" />}
      </div>
      <div className="text-[11px] font-bold leading-tight line-clamp-2 mb-1">{product.title}</div>
      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatPrice(product.price)}</div>
    </button>
  );
}

function SponsorCard({ sponsor, onOpen }: { sponsor: HomeSponsor; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="shrink-0 w-[140px] text-left rounded-2xl border border-border/60 bg-background/40 p-2.5 active:scale-95 transition hover:border-primary/40 group">
      <div className="w-full h-24 rounded-xl bg-muted overflow-hidden mb-2">
        {sponsor.image_url ? <img src={sponsor.image_url} alt={sponsor.title} className="w-full h-full object-cover group-hover:scale-105 transition" /> : <Megaphone className="w-8 h-8 m-auto text-muted-foreground" />}
      </div>
      <div className="text-[11px] font-bold leading-tight line-clamp-2">{sponsor.title}</div>
      <div className="text-[10px] text-muted-foreground line-clamp-1">{sponsor.seller_name}</div>
      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatPrice(sponsor.price)}</div>
    </button>
  );
}

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Heart, Package, Shield, Megaphone, Search, X,
  LayoutGrid, Rows3, ArrowUpDown, Sparkles, Trash2, Filter,
} from "lucide-react";
import { t, type Lang } from "@/lib/i18n";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
  has_warranty: boolean;
  created_at: string;
}

interface LikedSponsor {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  seller_name: string;
  stock: number;
  has_warranty: boolean;
  warranty_duration_value: number;
  warranty_duration_type: string;
  category: string;
}

type SubTab = "all" | "produk" | "sponsor";
type ViewMode = "grid" | "list";
type SortMode = "newest" | "price_low" | "price_high" | "name_asc" | "name_desc";

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

interface LikesTabProps {
  products: Product[];
  likedIds: Set<string>;
  likedSponsorIds: Set<string>;
  getProductImages: (productId: string) => string[];
  toggleLike: (productId: string, e?: React.MouseEvent) => void;
  toggleLikeSponsor: (sponsorId: string, e?: React.MouseEvent) => void;
  setSelectedProduct: (product: Product) => void;
  setTab: (tab: string) => void;
  lang: Lang;
}

export default function LikesTab({
  products, likedIds, likedSponsorIds, getProductImages,
  toggleLike, toggleLikeSponsor, setSelectedProduct, setTab, lang,
}: LikesTabProps) {
  const [likedSponsors, setLikedSponsors] = useState<LikedSponsor[]>([]);
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("likes_view_mode") as ViewMode) || "list");
  const [sortMode, setSortMode] = useState<SortMode>(() => (localStorage.getItem("likes_sort_mode") as SortMode) || "newest");
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [stockOnly, setStockOnly] = useState(false);

  useEffect(() => { localStorage.setItem("likes_view_mode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("likes_sort_mode", sortMode); }, [sortMode]);

  useEffect(() => {
    if (likedSponsorIds.size > 0) {
      supabase
        .from("sponsors")
        .select("id, title, price, image_url, seller_name, stock, has_warranty, warranty_duration_value, warranty_duration_type, category")
        .in("id", Array.from(likedSponsorIds))
        .then(({ data }) => {
          if (data) setLikedSponsors(data as unknown as LikedSponsor[]);
        });
    } else {
      setLikedSponsors([]);
    }
  }, [likedSponsorIds]);

  const likedProductsRaw = useMemo(() => products.filter(p => likedIds.has(p.id)), [products, likedIds]);

  // Build category list from union
  const categories = useMemo(() => {
    const set = new Set<string>();
    likedProductsRaw.forEach(p => set.add(p.category || "Lainnya"));
    likedSponsors.forEach(s => set.add(s.category || "Lainnya"));
    return ["Semua", ...Array.from(set).sort()];
  }, [likedProductsRaw, likedSponsors]);

  const matchesSearch = (text: string) => !search.trim() || text.toLowerCase().includes(search.toLowerCase().trim());
  const matchesCat = (cat: string | null) => activeCategory === "Semua" || (cat || "Lainnya") === activeCategory;

  const filteredProducts = useMemo(() => {
    let arr = likedProductsRaw
      .filter(p => matchesSearch(p.title))
      .filter(p => matchesCat(p.category))
      .filter(p => !stockOnly || p.stock > 0);
    arr = [...arr].sort((a, b) => {
      switch (sortMode) {
        case "price_low": return a.price - b.price;
        case "price_high": return b.price - a.price;
        case "name_asc": return a.title.localeCompare(b.title);
        case "name_desc": return b.title.localeCompare(a.title);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return arr;
  }, [likedProductsRaw, search, activeCategory, stockOnly, sortMode]);

  const filteredSponsors = useMemo(() => {
    let arr = likedSponsors
      .filter(s => matchesSearch(s.title))
      .filter(s => matchesCat(s.category))
      .filter(s => !stockOnly || s.stock > 0);
    arr = [...arr].sort((a, b) => {
      switch (sortMode) {
        case "price_low": return a.price - b.price;
        case "price_high": return b.price - a.price;
        case "name_asc": return a.title.localeCompare(b.title);
        case "name_desc": return b.title.localeCompare(a.title);
        default: return 0;
      }
    });
    return arr;
  }, [likedSponsors, search, activeCategory, stockOnly, sortMode]);

  const showProducts = subTab === "all" || subTab === "produk";
  const showSponsors = subTab === "all" || subTab === "sponsor";

  const totalLiked = likedProductsRaw.length + likedSponsors.length;
  const visibleCount = (showProducts ? filteredProducts.length : 0) + (showSponsors ? filteredSponsors.length : 0);
  const hasNothing = totalLiked === 0;
  const noResult = !hasNothing && visibleCount === 0;

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("Semua");
    setStockOnly(false);
    setSortMode("newest");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header - flat IG/TikTok style */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Heart className="w-5 h-5 text-foreground" strokeWidth={1.7} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">{t("likes.title", lang)}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{totalLiked} item · {visibleCount} tampil</p>
          </div>
        </div>
        {/* Stats row - minimal */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          <div className="flex-1 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Produk</p>
            <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">{likedProductsRaw.length}</p>
          </div>
          <div className="w-px h-7 bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sponsor</p>
            <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">{likedSponsors.length}</p>
          </div>
          <div className="w-px h-7 bg-border" />
          <div className="flex-1 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Kategori</p>
            <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">{categories.length - 1}</p>
          </div>
        </div>
      </div>

      {!hasNothing && (
        <>
          {/* Sub-tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/50 rounded-xl">
            {([
              { key: "all", label: "Semua", icon: Heart, count: totalLiked },
              { key: "produk", label: "Produk", icon: Package, count: likedProductsRaw.length },
              { key: "sponsor", label: "Sponsor", icon: Megaphone, count: likedSponsors.length },
            ] as const).map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className={`relative flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  subTab === key
                    ? "bg-gradient-to-r from-destructive to-pink-500 text-white shadow-md scale-[1.02]"
                    : "text-muted-foreground hover:bg-background"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${subTab === key ? "bg-white/25" : "bg-muted"}`}>{count}</span>
              </button>
            ))}
          </div>

          {/* Search + Sort + View */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari di favorit..."
                className="pl-9 pr-9 h-10 rounded-xl bg-muted/50 border-0 text-sm font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="w-auto h-10 rounded-xl bg-muted/50 border-0 px-3 gap-1 font-bold text-xs">
                <ArrowUpDown className="w-3.5 h-3.5" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="price_low">Harga Terendah</SelectItem>
                <SelectItem value="price_high">Harga Tertinggi</SelectItem>
                <SelectItem value="name_asc">Nama A–Z</SelectItem>
                <SelectItem value="name_desc">Nama Z–A</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
              className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
              title={viewMode === "list" ? "Tampilan Grid" : "Tampilan List"}
            >
              {viewMode === "list" ? <LayoutGrid className="w-4 h-4" /> : <Rows3 className="w-4 h-4" />}
            </button>
          </div>

          {/* Category chips + stock filter */}
          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              <button
                onClick={() => setStockOnly(!stockOnly)}
                className={`shrink-0 flex items-center gap-1 px-3 h-8 rounded-full text-[11px] font-bold transition-all ${
                  stockOnly
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Filter className="w-3 h-3" /> Tersedia
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                    activeCategory === cat
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state - nothing liked */}
      {hasNothing && (
        <div className="text-center py-20 text-muted-foreground">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-destructive/10 to-pink-500/10 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-10 h-10 opacity-30" />
          </div>
          <p className="text-sm font-bold">Belum ada yang disukai.</p>
          <p className="text-xs text-muted-foreground mt-1">Cari produk atau sponsor favorit kamu</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl font-bold" onClick={() => setTab("produk")}>
              <Package className="w-4 h-4" /> Lihat Produk
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl font-bold" onClick={() => setTab("sponsor")}>
              <Megaphone className="w-4 h-4" /> Lihat Sponsor
            </Button>
          </div>
        </div>
      )}

      {/* No results from filter */}
      {noResult && (
        <div className="text-center py-12 rounded-2xl bg-muted/30 border-2 border-dashed border-border">
          <Search className="w-10 h-10 mx-auto opacity-30 mb-2" />
          <p className="text-sm font-bold">Tidak ditemukan</p>
          <p className="text-xs text-muted-foreground mt-1">Coba ubah pencarian atau filter</p>
          <Button size="sm" variant="outline" className="mt-3 gap-1.5 rounded-xl font-bold" onClick={clearFilters}>
            <Trash2 className="w-3.5 h-3.5" /> Reset Filter
          </Button>
        </div>
      )}

      {/* Liked Products */}
      {showProducts && filteredProducts.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
              Produk ({filteredProducts.length})
            </p>
          </div>
          <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
            {filteredProducts.map(p => {
              const imgs = getProductImages(p.id);
              if (viewMode === "grid") {
                return (
                  <Card key={p.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-md bg-card/90 backdrop-blur-sm hover:-translate-y-0.5" onClick={() => setSelectedProduct(p)}>
                    <div className="relative aspect-square bg-gradient-to-br from-primary/10 to-accent/10">
                      {imgs.length > 0 ? (
                        <img src={imgs[0]} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-10 h-10 text-muted-foreground" />
                        </div>
                      )}
                      <button onClick={(e) => toggleLike(p.id, e)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                        <Heart className="w-4 h-4 fill-destructive text-destructive" />
                      </button>
                      {p.stock <= 0 && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-xs font-extrabold bg-destructive px-2 py-0.5 rounded-full">Habis</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-2.5">
                      <h3 className="font-bold text-xs truncate">{p.title}</h3>
                      <p className="text-xs font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mt-0.5">{formatPrice(p.price)}</p>
                      {p.has_warranty && (
                        <span className="inline-flex items-center text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20 mt-1">
                          <Shield className="w-2.5 h-2.5 mr-0.5" /> Garansi
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
              }
              return (
                <Card key={p.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-lg bg-card/90 backdrop-blur-sm hover:-translate-y-0.5" onClick={() => setSelectedProduct(p)}>
                  <CardContent className="p-3.5 flex items-center gap-3">
                    {imgs.length > 0 ? (
                      <img src={imgs[0]} className="w-14 h-14 rounded-xl object-cover ring-2 ring-border/50 shadow-sm" alt="" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{p.title}</h3>
                      <p className="text-xs font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{formatPrice(p.price)}</p>
                      <div className="flex gap-1.5 mt-1">
                        {p.has_warranty && (
                          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                            <Shield className="w-2.5 h-2.5 inline mr-0.5" /> Garansi
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.stock > 0 ? "bg-accent/10 text-accent border border-accent/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                          {p.stock > 0 ? "✓ Tersedia" : "✗ Habis"}
                        </span>
                      </div>
                    </div>
                    <button onClick={(e) => toggleLike(p.id, e)} className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
                      <Heart className="w-5 h-5 fill-destructive text-destructive" />
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Liked Sponsors */}
      {showSponsors && filteredSponsors.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
              <Megaphone className="w-3.5 h-3.5 text-accent" />
            </div>
            <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
              Sponsor ({filteredSponsors.length})
            </p>
          </div>
          <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
            {filteredSponsors.map(s => {
              if (viewMode === "grid") {
                return (
                  <Card key={s.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-md bg-card/90 backdrop-blur-sm hover:-translate-y-0.5" onClick={() => setTab("sponsor")}>
                    <div className="relative aspect-square bg-gradient-to-br from-accent/10 to-accent/5">
                      {s.image_url ? (
                        <img src={s.image_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Megaphone className="w-10 h-10 text-muted-foreground" />
                        </div>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); toggleLikeSponsor(s.id, e); }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                        <Heart className="w-4 h-4 fill-destructive text-destructive" />
                      </button>
                      {s.stock <= 0 && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-xs font-extrabold bg-destructive px-2 py-0.5 rounded-full">Habis</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-2.5">
                      <h3 className="font-bold text-xs truncate">{s.title}</h3>
                      {s.price > 0 && <p className="text-xs font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mt-0.5">{formatPrice(s.price)}</p>}
                      <p className="text-[9px] text-muted-foreground truncate mt-0.5">{s.seller_name}</p>
                    </CardContent>
                  </Card>
                );
              }
              return (
                <Card key={s.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-0 shadow-lg bg-card/90 backdrop-blur-sm hover:-translate-y-0.5" onClick={() => setTab("sponsor")}>
                  <CardContent className="p-3.5 flex items-center gap-3">
                    {s.image_url ? (
                      <img src={s.image_url} className="w-14 h-14 rounded-xl object-cover ring-2 ring-border/50 shadow-sm" alt="" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                        <Megaphone className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{s.title}</h3>
                      {s.price > 0 && <p className="text-xs font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{formatPrice(s.price)}</p>}
                      <div className="flex gap-1.5 mt-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.has_warranty ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground"}`}>
                          {s.has_warranty
                            ? `Garansi ${s.warranty_duration_value} ${s.warranty_duration_type === "hours" ? "Jam" : s.warranty_duration_type === "days" ? "Hari" : "Bulan"}`
                            : "Tanpa Garansi"}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.stock > 0 ? "bg-accent/10 text-accent border border-accent/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                          Stok: {s.stock > 0 ? s.stock : "Habis"}
                        </span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleLikeSponsor(s.id, e); }} className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
                      <Heart className="w-5 h-5 fill-destructive text-destructive" />
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

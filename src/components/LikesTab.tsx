import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Package, Shield, Megaphone, Clock, User } from "lucide-react";
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

  const likedProducts = products.filter(p => likedIds.has(p.id));
  const hasNothing = likedProducts.length === 0 && likedSponsors.length === 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl p-5" style={{ background: "linear-gradient(135deg, hsl(340, 80%, 55%) 0%, hsl(360, 70%, 50%) 100%)" }}>
        <div className="absolute inset-0 opacity-15">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/30 blur-3xl animate-pulse" />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/20 blur-2xl" />
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-white/40 rounded-2xl blur-xl animate-pulse" />
            <div className="relative w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg ring-2 ring-white/20">
              <Heart className="w-7 h-7 text-white animate-pulse" style={{ animationDuration: "1.5s" }} />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight drop-shadow-lg">{t("likes.title", lang)}</h2>
            <p className="text-white/80 text-xs font-medium mt-0.5">{likedProducts.length + likedSponsors.length} item disukai</p>
          </div>
        </div>
        {/* Stats */}
        <div className="relative z-10 flex gap-3 mt-4">
          <div className="flex-1 bg-white/15 backdrop-blur-md rounded-xl px-3 py-2 text-center border border-white/10 hover:bg-white/20 transition-all">
            <Package className="w-3.5 h-3.5 text-white/80 mx-auto mb-0.5" />
            <p className="text-white font-extrabold text-lg leading-none">{likedProducts.length}</p>
            <p className="text-white/70 text-[10px] font-medium mt-0.5">Produk</p>
          </div>
          <div className="flex-1 bg-white/15 backdrop-blur-md rounded-xl px-3 py-2 text-center border border-white/10 hover:bg-white/20 transition-all">
            <Megaphone className="w-3.5 h-3.5 text-white/80 mx-auto mb-0.5" />
            <p className="text-white font-extrabold text-lg leading-none">{likedSponsors.length}</p>
            <p className="text-white/70 text-[10px] font-medium mt-0.5">Sponsor</p>
          </div>
        </div>
      </div>

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

      {/* Liked Products */}
      {likedProducts.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
              Produk ({likedProducts.length})
            </p>
          </div>
          {likedProducts.map(p => {
            const imgs = getProductImages(p.id);
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
        </>
      )}

      {/* Liked Sponsors */}
      {likedSponsors.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
              <Megaphone className="w-3.5 h-3.5 text-accent" />
            </div>
            <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
              Sponsor ({likedSponsors.length})
            </p>
          </div>
          {likedSponsors.map(s => (
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
          ))}
        </>
      )}
    </div>
  );
}

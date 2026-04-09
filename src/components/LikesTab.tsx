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
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold flex items-center gap-2">
        <Heart className="w-5 h-5 text-destructive" /> {t("likes.title", lang)}
      </h2>

      {hasNothing && (
        <div className="text-center py-16 text-muted-foreground">
          <Heart className="w-16 h-16 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Belum ada yang disukai.</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTab("produk")}>
              <Package className="w-4 h-4" /> Lihat Produk
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTab("sponsor")}>
              <Megaphone className="w-4 h-4" /> Lihat Sponsor
            </Button>
          </div>
        </div>
      )}

      {/* Liked Products */}
      {likedProducts.length > 0 && (
        <>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Produk ({likedProducts.length})
          </p>
          {likedProducts.map(p => {
            const imgs = getProductImages(p.id);
            return (
              <Card key={p.id} className="overflow-hidden hover:shadow-xl transition-all cursor-pointer" onClick={() => setSelectedProduct(p)}>
                <CardContent className="p-3 flex items-center gap-3">
                  {imgs.length > 0 && <img src={imgs[0]} className="w-14 h-14 rounded-xl object-cover" alt="" />}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{p.title}</h3>
                    <p className="text-xs text-primary font-bold">{formatPrice(p.price)}</p>
                    <div className="flex gap-1 mt-0.5">
                      {p.has_warranty && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full"><Shield className="w-2.5 h-2.5 inline" /> Garansi</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.stock > 0 ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
                        {p.stock > 0 ? "Tersedia" : "Habis"}
                      </span>
                    </div>
                  </div>
                  <button onClick={(e) => toggleLike(p.id, e)}>
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
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mt-4">
            <Megaphone className="w-3.5 h-3.5" /> Sponsor ({likedSponsors.length})
          </p>
          {likedSponsors.map(s => (
            <Card key={s.id} className="overflow-hidden hover:shadow-xl transition-all cursor-pointer" onClick={() => setTab("sponsor")}>
              <CardContent className="p-3 flex items-center gap-3">
                {s.image_url && <img src={s.image_url} className="w-14 h-14 rounded-xl object-cover" alt="" />}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate">{s.title}</h3>
                  {s.price > 0 && <p className="text-xs text-primary font-bold">{formatPrice(s.price)}</p>}
                  <div className="flex gap-1 mt-0.5">
                    <Badge variant={s.has_warranty ? "secondary" : "outline"} className="text-[9px] font-bold">
                      {s.has_warranty
                        ? `Garansi ${s.warranty_duration_value} ${s.warranty_duration_type === "hours" ? "Jam" : s.warranty_duration_type === "days" ? "Hari" : "Bulan"}`
                        : "Tanpa Garansi"}
                    </Badge>
                    <Badge variant={s.stock > 0 ? "secondary" : "destructive"} className="text-[9px]">
                      Stok: {s.stock > 0 ? s.stock : "Habis"}
                    </Badge>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); toggleLikeSponsor(s.id, e); }}>
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

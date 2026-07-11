import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, BookmarkCheck, Bell, BellOff, Package, TrendingDown, Trash2, Loader2, Heart } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const formatPrice = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

function activeVisitor() {
  return localStorage.getItem("balance_visitor_id") || getVisitorId();
}

// Event global agar tombol & daftar tetap sinkron
const WISHLIST_EVENT = "wishlist-changed";
function emitWishlistChanged() {
  window.dispatchEvent(new Event(WISHLIST_EVENT));
}

interface WishlistProduct {
  id: string;
  title: string;
  price: number;
  stock: number;
  image_url: string | null;
}

interface WishlistItem {
  id: string;
  product_id: string;
  target_price: number | null;
  last_price: number;
  last_stock: number;
  notify_price_drop: boolean;
  notify_restock: boolean;
  product: WishlistProduct | null;
}

// ============ Tombol Wishlist (bisa dipasang di kartu / detail produk) ============
export function WishlistButton({
  productId,
  price,
  stock,
  className = "",
}: {
  productId: string;
  price: number;
  stock: number;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const check = useCallback(async () => {
    const { data } = await supabase
      .from("product_wishlist")
      .select("id")
      .eq("visitor_id", activeVisitor())
      .eq("product_id", productId)
      .maybeSingle();
    setSaved(!!data);
  }, [productId]);

  useEffect(() => {
    check();
    const h = () => check();
    window.addEventListener(WISHLIST_EVENT, h);
    return () => window.removeEventListener(WISHLIST_EVENT, h);
  }, [check]);

  async function toggle(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (saved) {
        await supabase
          .from("product_wishlist")
          .delete()
          .eq("visitor_id", activeVisitor())
          .eq("product_id", productId);
        setSaved(false);
        toast({ title: "Dihapus dari wishlist" });
      } else {
        await supabase.from("product_wishlist").insert({
          visitor_id: activeVisitor(),
          product_id: productId,
          last_price: price,
          last_stock: stock,
        });
        setSaved(true);
        toast({ title: "❤️ Ditambahkan ke wishlist", description: "Kami kabari kalau harga turun atau stok tersedia." });
      }
      emitWishlistChanged();
    } catch {
      toast({ title: "Gagal memperbarui wishlist", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Wishlist"
      className={`w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : saved ? (
        <BookmarkCheck className="w-5 h-5 fill-fuchsia-500 text-fuchsia-500" />
      ) : (
        <Bookmark className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );
}

// ============ Kartu daftar Wishlist (untuk Plus tab) ============
export function WishlistCard({ onProductClick }: { onProductClick?: (id: string) => void }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("product_wishlist")
      .select("id, product_id, target_price, last_price, last_stock, notify_price_drop, notify_restock, product:products(id, title, price, stock, image_url)")
      .eq("visitor_id", activeVisitor())
      .order("created_at", { ascending: false });
    setItems((data as unknown as WishlistItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(WISHLIST_EVENT, h);
    return () => window.removeEventListener(WISHLIST_EVENT, h);
  }, [load]);

  async function remove(id: string) {
    await supabase.from("product_wishlist").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    emitWishlistChanged();
  }

  async function updateNotify(id: string, field: "notify_price_drop" | "notify_restock", value: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    await supabase.from("product_wishlist").update({ [field]: value }).eq("id", id);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 via-card to-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 flex items-center justify-center">
          <Heart className="w-5 h-5 text-fuchsia-500" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Wishlist Saya</h3>
          <p className="text-xs text-muted-foreground">Notifikasi otomatis saat harga turun atau stok tersedia</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Belum ada produk di wishlist. Tekan ikon bookmark di produk untuk menambahkan.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const p = item.product;
            if (!p) return null;
            const dropped = item.last_price > 0 && p.price < item.last_price;
            const out = (p.stock ?? 0) <= 0;
            return (
              <div key={item.id} className="rounded-xl border border-border bg-background/60 p-2.5">
                <div className="flex gap-2.5">
                  <div
                    className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 cursor-pointer"
                    onClick={() => onProductClick?.(p.id)}
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate cursor-pointer" onClick={() => onProductClick?.(p.id)}>{p.title}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="font-bold text-sm text-fuchsia-600 dark:text-fuchsia-400">{formatPrice(p.price)}</span>
                      {dropped && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold">
                          <TrendingDown className="w-3 h-3" /> Turun
                        </span>
                      )}
                      {out ? (
                        <span className="rounded-full bg-rose-500/15 text-rose-500 px-1.5 py-0.5 text-[10px] font-bold">Stok habis</span>
                      ) : (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Stok {p.stock}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => remove(item.id)} aria-label="Hapus" className="w-8 h-8 rounded-lg hover:bg-rose-500/10 flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/60">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {item.notify_price_drop ? <Bell className="w-3.5 h-3.5 text-fuchsia-500" /> : <BellOff className="w-3.5 h-3.5" />}
                    <span>Harga turun</span>
                    <Switch checked={item.notify_price_drop} onCheckedChange={(v) => updateNotify(item.id, "notify_price_drop", v)} className="scale-75" />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {item.notify_restock ? <Bell className="w-3.5 h-3.5 text-fuchsia-500" /> : <BellOff className="w-3.5 h-3.5" />}
                    <span>Restock</span>
                    <Switch checked={item.notify_restock} onCheckedChange={(v) => updateNotify(item.id, "notify_restock", v)} className="scale-75" />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

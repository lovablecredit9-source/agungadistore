import { useState } from "react";
import { Check, MessageCircle, Package, Plus, Share2, ShoppingBag, Star, Users } from "lucide-react";
import AccountAvatar from "@/components/AccountAvatar";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { SellerVerifiedBadge } from "@/components/seller/SellerVerifiedBadge";

type StoreProfileProps = {
  store: any;
  products: any[];
  reviews: any[];
  reviewsLoading: boolean;
  vouchers: any[];
  followed: boolean;
  followerCount: number;
  renderProduct: (product: any) => React.ReactNode;
  onFollow: () => void;
  onChat: () => void;
  onShare: () => void;
};

const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export default function StoreProfile({ store, products, reviews, reviewsLoading, vouchers, followed, followerCount, renderProduct, onFollow, onChat, onShare }: StoreProfileProps) {
  const [showAll, setShowAll] = useState(false);
  const [starFilter, setStarFilter] = useState(0);
  const storeProducts = products.filter((p) => p.store_id === store.id);
  const avg = reviews.length ? reviews.reduce((sum, r) => sum + Number(r.store_rating || 0), 0) / reviews.length : 0;
  const filtered = reviews.filter((r) => !starFilter || Number(r.store_rating) === starFilter);
  const shown = showAll ? filtered : filtered.slice(0, 5);

  return <div className="min-w-0 pb-6">
    <div className="relative">
      <div className="aspect-[4/1] w-full overflow-hidden bg-muted">
        {store.banner_url ? <img src={store.banner_url} alt={`Banner ${store.store_name}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Banner toko belum tersedia</div>}
      </div>
      <div className="absolute -bottom-8 left-5 rounded-full border-4 border-background bg-background sm:left-7">
        <div className="overflow-hidden rounded-full"><AccountAvatar visitorId={store.visitor_id} username={store.store_name} avatarUrl={store.avatar_url} size={72} /></div>
      </div>
    </div>

    <div className="space-y-5 px-4 pt-11 sm:px-7">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle className="min-w-0 break-words text-xl font-black leading-tight">{store.store_name}</DialogTitle>
          <SellerVerifiedBadge verified={store.is_verified} />
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${store.owner_online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{store.owner_online ? "● Aktif" : "○ Offline"}</span>
        </div>
        <p className="text-xs text-muted-foreground">Toko dibuka sejak {store.created_at ? new Date(store.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "—"}{store.owner_last_seen_at && !store.owner_online ? ` · Terakhir dilihat ${new Date(store.owner_last_seen_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground/85">{store.description || "Toko ini belum menambahkan deskripsi."}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={onChat} disabled={!storeProducts.length}><MessageCircle className="mr-1.5 h-4 w-4" />Kirim Pesan</Button>
          <Button size="sm" variant="outline" onClick={onFollow}>{followed ? <Check className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}{followed ? "Diikuti" : "Follow"}</Button>
          <Button size="icon" variant="outline" onClick={onShare} title="Bagikan toko" aria-label="Bagikan toko"><Share2 className="h-4 w-4" /></Button>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /><strong className="text-foreground">{Number(followerCount || 0).toLocaleString("id-ID")}</strong> pengikut</p>
      </header>

      <div className="grid grid-cols-3 divide-x rounded-md border bg-card py-3 text-center">
        <div className="min-w-0 px-1"><Package className="mx-auto mb-1 h-4 w-4 text-primary" /><strong className="block text-base">{storeProducts.length}</strong><span className="text-[10px] text-muted-foreground">Produk</span></div>
        <div className="min-w-0 px-1"><ShoppingBag className="mx-auto mb-1 h-4 w-4 text-primary" /><strong className="block text-base">{Number(store.total_sales || 0).toLocaleString("id-ID")}</strong><span className="text-[10px] text-muted-foreground">Terjual</span></div>
        <div className="min-w-0 px-1"><Star className="mx-auto mb-1 h-4 w-4 text-primary" /><strong className="block text-base">{reviews.length ? avg.toFixed(1) : "—"}</strong><span className="text-[10px] text-muted-foreground">Rating</span></div>
      </div>

      <section aria-label="Ringkasan rating toko" className="space-y-3 border-b pb-5">
        <div className="text-center"><strong className="text-3xl font-black">{reviews.length ? avg.toFixed(1) : "—"}</strong><p className="text-xs text-muted-foreground">/5.0</p><p className="mt-1 text-base text-primary">{reviews.length ? "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg)) : "☆☆☆☆☆"}</p><p className="text-xs text-muted-foreground">{reviews.length} ulasan</p></div>
        <div className="space-y-1.5 border-t pt-3">{[5, 4, 3, 2, 1].map((n) => {
          const count = reviews.filter((r) => Number(r.store_rating) === n).length;
          return <button key={n} type="button" className={`flex w-full items-center gap-2 rounded-sm px-1 text-xs hover:bg-muted ${starFilter === n ? "bg-muted font-bold" : ""}`} onClick={() => { setStarFilter(starFilter === n ? 0 : n); setShowAll(false); }} aria-label={`Tampilkan ulasan ${n} bintang`}>
            <span className="w-7 text-left">{n} ★</span><span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${reviews.length ? count / reviews.length * 100 : 0}%` }} /></span><span className="w-5 text-right text-muted-foreground">{count}</span>
          </button>;
        })}</div>
        {starFilter > 0 && <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setStarFilter(0)}>Tampilkan semua rating</Button>}
      </section>

      {!!vouchers.length && <section><h3 className="mb-2 text-sm font-black">Promo Toko</h3><div className="flex gap-2 overflow-x-auto">{vouchers.map((v: any) => <div key={v.code} className="shrink-0 rounded-md border border-dashed border-primary p-2"><b className="text-xs">{v.code}</b><p className="text-[10px] text-muted-foreground">Min. {rp(v.min_purchase)}</p></div>)}</div></section>}

      {!!storeProducts.length && <section><div className="mb-3 flex items-baseline justify-between gap-2"><h3 className="text-sm font-black">Tampilkan semua produk</h3><span className="shrink-0 text-xs text-muted-foreground">Produk ({storeProducts.length})</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{storeProducts.map((p) => <div key={p.id} className="min-w-0">{renderProduct(p)}</div>)}</div></section>}
      {!storeProducts.length && <p className="py-4 text-sm text-muted-foreground">Belum ada produk tersedia.</p>}

      <section><h3 className="mb-2 text-sm font-black">Ulasan pembeli</h3>
        {reviewsLoading ? <p className="py-4 text-sm text-muted-foreground">Memuat ulasan...</p> : !filtered.length ? <p className="py-4 text-sm text-muted-foreground">{starFilter ? `Belum ada ulasan ${starFilter} bintang.` : "Belum ada ulasan."}</p> : <div className="space-y-2">{shown.map((r: any) => {
          const product = products.find((p) => p.id === r.product_id);
          return <article key={r.id} className="space-y-2 rounded-md border bg-card p-3"><div className="flex items-center gap-2"><div className="overflow-hidden rounded-full"><AccountAvatar visitorId={r.buyer_visitor_id} username={r.buyer_name || "Pembeli"} avatarUrl={r.buyer_avatar} size={36} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{r.buyer_name || "Pembeli"}</p><p className="text-xs text-primary" aria-label={`${r.store_rating} dari 5 bintang`}>{"★".repeat(Number(r.store_rating || 0))}<span className="text-muted-foreground">{"☆".repeat(5 - Number(r.store_rating || 0))}</span></p></div><time className="shrink-0 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>
            {r.comment && <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{r.comment}</p>}{r.photo_url && <a href={r.photo_url} target="_blank" rel="noreferrer"><img src={r.photo_url} alt="Foto ulasan pembeli" className="max-h-36 rounded-md object-contain" /></a>}
            {product && <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/60 p-2"><img src={product.image_url || "/placeholder.svg"} alt={product.title} className="h-9 w-9 shrink-0 rounded-sm object-cover" /><span className="line-clamp-2 min-w-0 text-xs text-muted-foreground">{product.title}</span></div>}
            {r.seller_reply && <p className="border-l-2 border-primary pl-2 text-xs text-muted-foreground">Balasan toko: {r.seller_reply}</p>}
          </article>;
        })}</div>}
        {!showAll && filtered.length > 5 && <Button variant="outline" className="mt-3 w-full" onClick={() => setShowAll(true)}>Lihat Semua Ulasan ({filtered.length})</Button>}
      </section>
    </div>
  </div>;
}
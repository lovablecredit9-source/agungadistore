import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import AccountAvatar from "@/components/AccountAvatar";

export default function MarketplaceReviews({ rows, scope }: { rows: any[]; scope: "product" | "store" }) {
  const [star, setStar] = useState(0);
  const [all, setAll] = useState(false);
  const rating = (r: any) => Number(scope === "product" ? r.product_rating : r.store_rating) || 0;
  const filtered = rows.filter((r) => !star || rating(r) === star);
  const avg = rows.length ? rows.reduce((n, r) => n + rating(r), 0) / rows.length : 0;
  return <section className="space-y-3" aria-label="Ulasan pembeli">
    <div className="flex items-center gap-3 border-b pb-3"><Star className="h-6 w-6 fill-primary text-primary"/><strong className="text-xl">{rows.length ? avg.toFixed(1) : "—"}</strong><span className="text-xs text-muted-foreground">{rows.length} ulasan</span></div>
    <div className="flex gap-1.5 overflow-x-auto pb-1"><Button size="sm" variant={!star ? "default" : "outline"} onClick={() => { setStar(0); setAll(false); }}>Semua</Button>{[5,4,3,2,1].map((n) => <Button size="sm" key={n} variant={star === n ? "default" : "outline"} onClick={() => { setStar(n); setAll(false); }} className="shrink-0">{n} ★</Button>)}</div>
    {!filtered.length && <p className="py-4 text-sm text-muted-foreground">Belum ada ulasan{star ? ` ${star} bintang` : ""}.</p>}
    {filtered.slice(0, all ? undefined : 5).map((r) => <article key={r.id} className="space-y-2 border-b py-3 last:border-b-0"><div className="flex items-center gap-2"><AccountAvatar visitorId={r.buyer_visitor_id} username={r.buyer_name || "Pembeli"} avatarUrl={r.buyer_avatar ?? undefined} size={36}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.buyer_name || "Pembeli"} {r.product_title ? <span className="font-normal text-muted-foreground">({r.product_title})</span> : null}</p><p className="text-xs text-primary" aria-label={`${rating(r)} dari 5 bintang`}>{"★".repeat(rating(r))}<span className="text-muted-foreground">{"☆".repeat(5-rating(r))}</span></p></div><time className="shrink-0 text-right text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}{r.edited_at && <span className="block">diedit</span>}</time></div>{r.comment && <p className="whitespace-pre-wrap break-words text-sm">{r.comment}</p>}{r.photo_url && <a href={r.photo_url} target="_blank" rel="noreferrer"><img src={r.photo_url} alt="Foto ulasan" loading="lazy" className="h-24 w-24 rounded-md object-cover"/></a>}{r.seller_reply && <p className="border-l-2 border-primary pl-2 text-xs text-muted-foreground">Balasan toko: {r.seller_reply}</p>}</article>)}
    {!all && filtered.length > 5 && <Button variant="outline" className="w-full" onClick={() => setAll(true)}>Lihat Semua Ulasan ({filtered.length})</Button>}
  </section>;
}

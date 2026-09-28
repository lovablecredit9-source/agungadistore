import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Rating & ulasan toko. Bintang tidak bisa diubah seller; seller hanya bisa membalas (lewat fungsi yang cek pemilik). */
export default function SellerReviews({ storeId, visitorId }: { storeId: string; visitorId: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [star, setStar] = useState(0);
  const load = async () => {
    const { data } = await supabase.from("seller_reviews" as any).select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(200);
    setRows((data as any[]) || []);
  };
  useEffect(() => { load(); }, [storeId]);

  async function send(id: string) {
    const { error } = await (supabase as any).rpc("seller_review_reply", { p_visitor_id: visitorId, p_review_id: id, p_reply: reply[id] || "" });
    if (error) return toast({ title: "Gagal membalas", description: error.message, variant: "destructive" });
    toast({ title: "💬 Balasan terkirim" });
    setReply((r) => { const n = { ...r }; delete n[id]; return n; }); load();
  }

  if (!rows) return <Skeleton className="h-40 rounded-xl" />;
  const rate = (r: any) => r.store_rating || r.product_rating || 0;
  const avg = rows.length ? rows.reduce((a, r) => a + rate(r), 0) / rows.length : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => [s, rows.filter((r) => rate(r) === s).length] as const);
  const list = star ? rows.filter((r) => rate(r) === star) : rows;

  return (
    <div className="space-y-3">
      <Card className="bg-card/50"><CardContent className="p-3 flex gap-4 items-center">
        <div className="text-center shrink-0"><p className="text-3xl font-black">{avg.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">{rows.length} ulasan</p></div>
        <div className="flex-1 space-y-1">{dist.map(([s, n]) => (
          <button key={s} onClick={() => setStar(star === s ? 0 : s)} className={`w-full flex items-center gap-1.5 text-[10px] ${star === s ? "font-black text-primary" : ""}`}>
            <span className="w-6 flex items-center">{s}<Star className="w-3 h-3 text-yellow-400" fill="currentColor" /></span>
            <div className="flex-1 h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-yellow-400" style={{ width: `${rows.length ? (n / rows.length) * 100 : 0}%` }} /></div>
            <span className="w-6 text-right">{n}</span>
          </button>))}</div>
      </CardContent></Card>
      {!list.length ? <p className="text-xs text-center text-muted-foreground py-6">Belum ada ulasan.</p> : list.map((r) => (
        <Card key={r.id} className="bg-card/50"><CardContent className="p-3 space-y-1.5">
          <div className="flex justify-between text-xs"><b>{r.buyer_name || "Pembeli"}</b>
            <span className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`w-3 h-3 ${i < rate(r) ? "text-yellow-400" : "text-muted"}`} fill="currentColor" />)}</span></div>
          {r.comment && <p className="text-xs">{r.comment}</p>}
          <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium" })}</p>
          {r.seller_reply && reply[r.id] === undefined ? (
            <div className="rounded-lg bg-muted/50 p-2 text-[11px]"><b>Balasan toko:</b> {r.seller_reply}
              <button className="ml-2 text-primary text-[10px]" onClick={() => setReply((x) => ({ ...x, [r.id]: r.seller_reply }))}>Ubah</button></div>
          ) : (
            <div className="flex gap-1.5">
              <Textarea className="min-h-10 text-xs" maxLength={500} placeholder="Balas ulasan..." value={reply[r.id] || ""} onChange={(e) => setReply((x) => ({ ...x, [r.id]: e.target.value }))} />
              <Button size="sm" className="h-auto" disabled={!reply[r.id]?.trim()} onClick={() => send(r.id)}>Kirim</Button>
            </div>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { rp } from "./orderStatus";

/** Performa toko sendiri (tanpa ranking antar seller). */
export default function SellerPerformance({ visitorId }: { visitorId: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (supabase as any).rpc("seller_performance", { p_visitor_id: visitorId }).then(({ data, error }: any) => error ? setErr(error.message) : setD(data));
  }, [visitorId]);
  if (err) return <p className="text-xs text-destructive text-center py-4">{err}</p>;
  if (!d) return <Skeleton className="h-40 rounded-xl" />;
  const chatRate = d.chat_threads ? Math.round((d.chat_replied / d.chat_threads) * 100) + "%" : "–";
  const items: [string, string][] = [
    ["Total penjualan", rp(d.sales)], ["Total order", String(d.orders)],
    ["Rating", `${Number(d.rating || 0).toFixed(1)} (${d.rating_count || 0})`], ["Produk aktif", String(d.active_products)],
    ["Response chat", `${chatRate} dari ${d.chat_threads} chat dibalas`], ["Response order", d.ship_hours != null ? `rata-rata ${d.ship_hours} jam dikirim` : "–"],
  ];
  return (
    <Card className="bg-card/50"><CardContent className="p-3 space-y-2">
      <h3 className="text-sm font-black">📊 Performa Toko</h3>
      <div className="grid grid-cols-2 gap-2">{items.map(([l, v]) => (
        <div key={l} className="rounded-xl border border-border p-2.5"><p className="text-[10px] text-muted-foreground">{l}</p><p className="text-xs font-black">{v}</p></div>
      ))}</div>
      <p className="text-xs font-bold pt-1">Produk terlaris</p>
      {!d.top.length ? <p className="text-[11px] text-muted-foreground">Belum ada pesanan selesai.</p> :
        d.top.map((t: any, i: number) => <p key={i} className="text-[11px]">{i + 1}. {t.title} — {t.qty} terjual</p>)}
    </CardContent></Card>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) + "%" : "0%");

export default function SellerAnalytics({ visitorId }: { visitorId: string }) {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  const load = async () => {
    setD(null); setErr("");
    const { data, error } = await supabase.rpc("seller_analytics" as any, { p_visitor_id: visitorId, p_days: days });
    if (error) setErr(error.message); else setD(data);
  };
  useEffect(() => { load(); }, [days]);

  const f = d?.funnel || {};
  const steps: [string, number][] = [["Dilihat", f.view || 0], ["Detail produk", f.detail || 0], ["Masuk keranjang", f.cart || 0], ["Checkout", f.checkout || 0], ["Dibeli", f.purchase || 0]];
  const max = Math.max(1, ...steps.map((s) => s[1]));
  const prods: any[] = d?.products || [];
  const low = prods.filter((p) => Number(p.purchase) === 0).sort((a, b) => a.detail - b.detail).slice(0, 5);

  return <div className="space-y-2">
    <div className="grid grid-cols-4 gap-1">{[7, 30, 90, 365].map((n) => <Button key={n} size="sm" variant={days === n ? "default" : "outline"} className="h-8 text-[10px]" onClick={() => setDays(n)}>{n === 365 ? "1 thn" : n + " hari"}</Button>)}</div>
    {err ? <Card><CardContent className="p-4 text-center space-y-2"><p className="text-xs text-destructive">{err}</p><Button size="sm" variant="outline" onClick={load}>Coba lagi</Button></CardContent></Card>
      : !d ? <Skeleton className="h-64" /> : <>
        <div className="grid grid-cols-2 gap-2">
          {([["Pengunjung toko", f.store_view || 0], ["Pengunjung unik", f.visitors || 0], ["Pembelian", f.purchase || 0], ["Konversi", pct(f.purchase || 0, f.detail || f.view || 0)]] as const).map(([l, v]) =>
            <div key={l} className="rounded-xl border bg-card/50 p-2.5"><p className="text-[10px] text-muted-foreground">{l}</p><p className="text-sm font-black">{v}</p></div>)}
        </div>
        <Card><CardContent className="p-3 space-y-1.5">
          <p className="text-sm font-black">Funnel pembelian</p>
          {steps.map(([l, v], i) => <div key={l}>
            <div className="flex justify-between text-[11px]"><span>{l}</span><span className="font-bold">{v}{i > 0 && <span className="text-muted-foreground font-normal"> · {pct(v, steps[i - 1][1])}</span>}</span></div>
            <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
          </div>)}
        </CardContent></Card>
        <Card><CardContent className="p-3 space-y-1">
          <p className="text-sm font-black">Performa produk</p>
          {!prods.length ? <p className="text-xs text-muted-foreground py-4 text-center">Belum ada produk.</p> :
            <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr className="text-muted-foreground"><th className="text-left py-1">Produk</th><th>Lihat</th><th>Detail</th><th>Keranjang</th><th>Beli</th></tr></thead>
              <tbody>{prods.map((p) => <tr key={p.id} className="border-t"><td className="py-1 max-w-[120px] truncate">{p.title}</td><td className="text-center">{p.view}</td><td className="text-center">{p.detail}</td><td className="text-center">{p.cart}</td><td className="text-center font-bold">{p.purchase}</td></tr>)}</tbody></table></div>}
        </CardContent></Card>
        {low.length > 0 && <Card><CardContent className="p-3 space-y-1">
          <p className="text-sm font-black">Performa rendah (belum terjual)</p>
          {low.map((p) => <p key={p.id} className="text-[11px] flex justify-between"><span className="truncate">{p.title}</span><span className="text-muted-foreground">{p.detail} detail</span></p>)}
        </CardContent></Card>}
      </>}
  </div>;
}

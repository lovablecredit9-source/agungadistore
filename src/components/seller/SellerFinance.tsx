import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { rp } from "./orderStatus";

const KIND: Record<string, string> = { dana_masuk: "Dana masuk", penarikan: "Penarikan", refund: "Refund", penyesuaian: "Penyesuaian" };

/** Keuangan seller — hanya baca, dari buku besar (seller_ledger) via fungsi seller_finance yang cek pemilik. */
export default function SellerFinance({ visitorId }: { visitorId: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    setErr(null);
    const { data, error } = await (supabase as any).rpc("seller_finance", { p_visitor_id: visitorId });
    if (error) setErr(error.message); else setD(data);
  };
  useEffect(() => { load(); }, [visitorId]);

  if (err) return <Card><CardContent className="p-4 text-center space-y-2"><p className="text-xs text-destructive">{err}</p><Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3 h-3 mr-1" />Coba lagi</Button></CardContent></Card>;
  if (!d) return <div className="grid grid-cols-2 gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;

  const cards: [string, number, string][] = [
    ["Saldo Tersedia", d.balance, "Bisa ditarik"], ["Dana Ditahan", d.held, "Pesanan belum selesai"],
    ["Harga Penjualan", d.gross, "Total penjualan selesai"], ["Admin Fee Seller 5%", d.fee, "Dipotong dari penjualan"],
    ["Refund", d.refund, "Dikembalikan ke pembeli"], ["Pendapatan Bersih", d.net, "Harga penjualan − Admin Fee 5%"],
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {cards.map(([l, v, h]) => (
          <div key={l} className="rounded-xl border border-border bg-card/50 p-2.5">
            <p className="text-[10px] text-muted-foreground">{l}</p>
            <p className="text-sm font-black">{rp(v)}</p>
            <p className="text-[9px] text-muted-foreground">{h}</p>
          </div>
        ))}
      </div>
      <Card className="bg-card/50"><CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-black">📒 Riwayat Transaksi</h3>
          <Button size="sm" variant="ghost" className="h-7" onClick={load}><RefreshCw className="w-3 h-3" /></Button></div>
        <p className="text-[10px] text-muted-foreground">Saldo hanya berubah lewat sistem (pesanan selesai, penarikan, keputusan admin). Tidak bisa diubah manual.</p>
        {!d.ledger.length ? <p className="text-xs text-center text-muted-foreground py-4">Belum ada transaksi.</p> :
          d.ledger.map((l: any) => (
            <div key={l.id} className="rounded-lg border border-border/60 p-2 text-[10px] space-y-0.5">
              <div className="flex justify-between gap-2">
                <span className="font-bold">TRX-{l.trx_number} · {KIND[l.kind] || l.kind}</span>
                <span className={`font-black ${l.amount < 0 ? "text-rose-400" : l.amount > 0 ? "text-emerald-400" : ""}`}>{l.amount > 0 ? "+" : ""}{rp(l.amount)}</span>
              </div>
              {l.product_title && <p className="truncate">{l.product_title}{l.order_id ? ` · order ${String(l.order_id).slice(0, 8)}` : ""}</p>}
              <p className="text-muted-foreground">{new Date(l.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                {l.gross ? ` · kotor ${rp(l.gross)}` : ""}{l.fee ? ` · fee ${rp(l.fee)}` : ""}</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo {rp(l.balance_before)} → {rp(l.balance_after)}</span><Badge variant="outline" className="text-[9px] h-4">{l.status}</Badge></div>
            </div>
          ))}
      </CardContent></Card>
    </div>
  );
}

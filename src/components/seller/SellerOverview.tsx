import { Ticket, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  PackagePlus, ShoppingBag, ClipboardList, Boxes, MessageCircle, Wallet, RefreshCw, AlertTriangle, Star,
} from "lucide-react";
import { rp } from "./orderStatus";

export type SellerView = "dashboard" | "produk" | "tambah" | "stok" | "pesanan" | "profil" | "pendapatan" | "saldo" | "rating" | "performa" | "promo" | "flash" | "analytics" | "notifikasi" | "toko";

const RANGES = [[7, "7 hari"], [30, "30 hari"], [90, "3 bulan"], [365, "1 tahun"]] as const;
type Metric = "omzet" | "trx" | "qty";

/** Dashboard seller — semua angka dari fungsi database seller_dashboard_stats (cek pemilik di backend). */
export default function SellerOverview({ visitorId, onNavigate }: { visitorId: string; onNavigate: (v: SellerView | "chat" | "promo" | "flash") => void }) {
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState<Metric>("omzet");
  const [s, setS] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await (supabase as any).rpc("seller_dashboard_stats", { p_visitor_id: visitorId, p_days: days });
    if (error) setErr(error.message); else setS(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, [visitorId, days]);

  const stats = s ? [
    ["Penjualan hari ini", rp(s.today)], ["Penjualan bulan ini", rp(s.month)],
    ["Total pesanan", s.total_orders], ["Pesanan baru", s.new_orders],
    ["Produk aktif", s.active_products], ["Hampir habis", s.low_stock],
    ["Saldo tersedia", rp(s.balance)], ["Dana ditahan", rp(s.held)],
    ["Rating toko", `${Number(s.rating || 0).toFixed(1)} (${s.rating_count || 0})`], ["Total terjual", s.sold],
  ] : [];

  const quick: [string, any, SellerView | "chat" | "promo" | "flash"][] = [
    ["Tambah Produk", PackagePlus, "tambah"], ["Kelola Produk", ShoppingBag, "produk"], ["Pesanan", ClipboardList, "pesanan"],
    ["Buat Voucher", Ticket, "promo"], ["Flash Sale", Zap, "flash"], ["Stok", Boxes, "stok"],
    ["Chat", MessageCircle, "chat"], ["Keuangan", Wallet, "pendapatan"],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map(([l, I, v]) => (
          <button key={l} onClick={() => onNavigate(v)} className="rounded-xl border border-border bg-card/50 p-2 min-h-14 flex flex-col items-center justify-center gap-1 text-[10px] font-bold active:scale-95 transition">
            <I className="w-4 h-4 text-primary" />{l}
          </button>
        ))}
      </div>

      {err ? (
        <Card><CardContent className="p-4 text-center space-y-2">
          <p className="text-xs text-destructive">Gagal memuat dashboard: {err}</p>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3 h-3 mr-1" />Coba lagi</Button>
        </CardContent></Card>
      ) : loading && !s ? (
        <div className="grid grid-cols-2 gap-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {stats.map(([l, v]) => (
            <div key={l as string} className="rounded-xl border border-border bg-card/50 p-2.5 min-w-0">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                {l === "Hampir habis" && Number(v) > 0 && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                {l === "Rating toko" && <Star className="w-3 h-3 text-yellow-400" />}{l}
              </p>
              <p className="text-sm font-black truncate">{v as any}</p>
            </div>
          ))}
        </div>
      )}

      <Card className="bg-card/50"><CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-black">📈 Grafik Penjualan</h3>
          <div className="flex gap-1">{RANGES.map(([d, l]) => (
            <button key={d} onClick={() => setDays(d)} className={`px-2 h-7 rounded-md text-[10px] font-bold border ${days === d ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{l}</button>
          ))}</div>
        </div>
        <div className="flex gap-1">{([["omzet", "Omzet"], ["trx", "Transaksi"], ["qty", "Produk terjual"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMetric(k)} className={`px-2 h-7 rounded-md text-[10px] font-bold ${metric === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{l}</button>
        ))}</div>
        <div className="h-44 w-full">
          {s && <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.series} margin={{ left: -18, right: 4, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 9 }} minTickGap={16} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => metric === "omzet" && v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
              <Tooltip formatter={(v: any) => metric === "omzet" ? rp(v) : v} contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey={metric} stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
            </AreaChart>
          </ResponsiveContainer>}
        </div>
      </CardContent></Card>

      <Card className="bg-card/50"><CardContent className="p-3 space-y-2">
        <h3 className="text-sm font-black">🏆 Produk Terlaris</h3>
        {!s?.top?.length ? <p className="text-xs text-muted-foreground text-center py-4">Belum ada penjualan.</p> :
          s.top.map((t: any, i: number) => (
            <div key={t.product_id || i} className="flex items-center justify-between gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0">
              <span className="truncate"><b>{i + 1}.</b> {t.title}</span>
              <span className="shrink-0 text-muted-foreground">{t.qty} terjual · {rp(t.omzet)}</span>
            </div>
          ))}
      </CardContent></Card>
    </div>
  );
}

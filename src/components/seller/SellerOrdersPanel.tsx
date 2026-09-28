import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Search, Send } from "lucide-react";
import { ORDER_STATUS, rp } from "./orderStatus";
import { orderCode } from "./orderCode";
import { useMarketSignal } from "@/hooks/useMarketSignal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DisputeRoom from "./DisputeRoom";

const FILTERS: [string, string, (o: any) => boolean][] = [
  ["semua", "Semua", () => true],
  ["baru", "Baru", (o) => o.status === "pending" || (o.status === "dibayar" && Date.now() - new Date(o.created_at).getTime() < 86400000)],
  ["bayar", "Sudah Bayar", (o) => !!o.paid_at && o.escrow_status !== "refunded"],
  ["tunggu", "Menunggu Diproses", (o) => o.status === "dibayar"],
  ["proses", "Diproses", (o) => o.status === "proses"],
  ["dikirim", "Dikirim", (o) => o.status === "dikirim"],
  ["selesai", "Selesai", (o) => o.status === "selesai"],
  ["kendala", "Kendala", (o) => o.status === "kendala"],
  ["batal", "Dibatalkan", (o) => o.status === "batal"],
  ["refund", "Refund", (o) => o.escrow_status === "refunded"],
];
const payLabel = (o: any) => o.escrow_status === "refunded" ? "Refund" : o.escrow_status === "released" ? "Dana diteruskan" : o.paid_at ? "Lunas (ditahan)" : "Belum bayar";
const fmt = (d: string) => new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Kelola pesanan masuk: filter, aksi massal (divalidasi di backend per order), export, cetak. */
export default function SellerOrdersPanel({ storeId, visitorId }: { storeId: string; visitorId: string }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[] | null>(null);
  const [delivery, setDelivery] = useState<Record<string, string>>({});
  const [f, setF] = useState("semua");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseOrder, setCaseOrder] = useState<any>(null);

  async function load() {
    const { data } = await supabase.from("seller_orders" as any).select("*")
      .eq("store_id", storeId).order("created_at", { ascending: false }).limit(300);
    setOrders((data as any[]) || []);
  }
  useEffect(() => {
    load();
    (supabase as any).rpc("touch_user_presence", { p_visitor_id: visitorId }).then(() => {});
  }, [storeId]);
  useMarketSignal([visitorId], () => load());

  const list = useMemo(() => {
    const fn = FILTERS.find((x) => x[0] === f)![2];
    const s = q.toLowerCase();
    return (orders || []).filter((o) => fn(o) && (!s || String(o.order_code || o.order_number).includes(s) || o.product_title?.toLowerCase().includes(s) || o.buyer_name?.toLowerCase().includes(s)));
  }, [orders, f, q]);
  const chosen = list.filter((o) => sel.has(o.id));

  const call = (body: any) => supabase.functions.invoke("seller-shop", { body: { visitorId, ...body } });

  async function sendOrder(o: any) {
    const text = (delivery[o.id] || "").trim();
    if (!text) return toast({ title: "Isi data produk yang akan dikirim", variant: "destructive" });
    const { data, error } = await call({ action: "ship", orderId: o.id, deliveryData: text });
    if (error || data?.error) return toast({ title: "Gagal mengirim pesanan", description: error?.message || data?.error, variant: "destructive" });
    toast({ title: "📦 Pesanan dikirim", description: "Dana tetap ditahan sampai pembeli konfirmasi atau auto-konfirmasi 5 jam." });
    setDelivery((p) => ({ ...p, [o.id]: "" }));
    load();
  }

  async function bulk(action: "process" | "ship") {
    const target = chosen.filter((o) => action === "process" ? o.status === "dibayar" : ["dibayar", "proses"].includes(o.status));
    if (!target.length) return toast({ title: "Tidak ada order dengan status yang sesuai", variant: "destructive" });
    if (action === "ship" && !bulkText.trim()) return toast({ title: "Isi data pesanan untuk dikirim", variant: "destructive" });
    setBusy(true);
    let ok = 0; const fail: string[] = [];
    for (const o of target) {
      const { data, error } = await call({ action, orderId: o.id, deliveryData: bulkText.trim() });
      if (error || data?.error) fail.push(orderCode(o)); else ok++;
    }
    setBusy(false);
    toast({ title: `✅ ${ok} order diperbarui`, description: fail.length ? `Gagal: ${fail.join(", ")}` : undefined, variant: fail.length && !ok ? "destructive" : undefined });
    setSel(new Set()); setBulkText(""); load();
  }

  function exportCsv() {
    const rows = chosen.length ? chosen : list;
    const head = ["Order ID", "Buyer", "Produk", "Qty", "Total", "Waktu", "Pembayaran", "Status"];
    const csv = [head, ...rows.map((o) => [orderCode(o), o.buyer_name, o.product_title, o.qty, o.total, fmt(o.created_at), payLabel(o), ORDER_STATUS[o.status]?.label.replace(/^\S+\s/, "") || o.status])]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = `pesanan-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }

  function printOrders() {
    const rows = chosen.length ? chosen : list;
    const w = window.open("", "_blank");
    if (!w) return toast({ title: "Izinkan pop-up untuk mencetak", variant: "destructive" });
    w.document.write(`<html><head><title>Daftar Pesanan</title><style>body{font-family:sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px;text-align:left}</style></head><body><h3>Daftar Pesanan</h3><table><tr><th>Order</th><th>Buyer</th><th>Produk</th><th>Qty</th><th>Total</th><th>Waktu</th><th>Status</th></tr>${rows.map((o) => `<tr><td>#${esc(orderCode(o))}</td><td>${esc(o.buyer_name)}</td><td>${esc(o.product_title)}</td><td>${esc(o.qty)}</td><td>${esc(rp(o.total))}</td><td>${esc(fmt(o.created_at))}</td><td>${esc(ORDER_STATUS[o.status]?.label || o.status)}</td></tr>`).join("")}</table></body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  if (!orders) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  return (
    <Card className="bg-card/50 border-border">
      <CardContent className="p-3 space-y-2">
        <h3 className="text-sm font-black">📬 Pesanan Masuk</h3>
        <div className="relative"><Search className="w-4 h-4 absolute left-2.5 top-3 opacity-50" />
          <Input className="pl-8" placeholder="Cari order, produk, pembeli..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {FILTERS.map(([k, l, fn]) => <button key={k} onClick={() => { setF(k); setSel(new Set()); }} className={`shrink-0 px-2.5 h-7 rounded-full text-[10px] font-bold border ${f === k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{l} {orders.filter(fn).length}</button>)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px]"><Checkbox checked={list.length > 0 && chosen.length === list.length} onCheckedChange={(v) => setSel(v ? new Set(list.map((o) => o.id)) : new Set())} />Pilih semua</label>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={!list.length} onClick={exportCsv}><Download className="w-3 h-3 mr-1" />Export</Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={!list.length} onClick={printOrders}><Printer className="w-3 h-3 mr-1" />Cetak</Button>
          </div>
        </div>
        {chosen.length > 0 && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-2 space-y-1.5">
            <p className="text-[11px] font-bold">{chosen.length} order dipilih</p>
            <Textarea className="min-h-14 text-xs" placeholder="Data pesanan digital untuk semua order terpilih (wajib saat tandai dikirim)" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-8 text-[10px]" disabled={busy} onClick={() => bulk("process")}>Tandai diproses</Button>
              <Button size="sm" className="h-8 text-[10px]" disabled={busy} onClick={() => bulk("ship")}>Tandai dikirim</Button>
            </div>
          </div>
        )}
        {list.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">Tidak ada pesanan di filter ini.</p>
        ) : list.map((o) => {
          const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
          return (
            <div key={o.id} className="rounded-xl border border-border bg-background/40 p-2.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <Checkbox className="mt-0.5" checked={sel.has(o.id)} onCheckedChange={() => setSel((s) => { const n = new Set(s); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })} aria-label="Pilih order" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{o.product_title} ×{o.qty}</p>
                  <p className="text-[10px] text-muted-foreground">{orderCode(o)} · {fmt(o.created_at)}</p>
                  <p className="text-xs font-black text-emerald-300">{rp(o.total)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className={`text-[9px] ${st.cls}`}>{st.label}</Badge>
                  <span className="text-[9px] text-muted-foreground">{payLabel(o)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2 text-[10px] space-y-0.5">
                <p>👤 {o.buyer_name}</p>
                {o.buyer_note && <p>📝 {o.buyer_note}</p>}
              </div>
              {["dibayar", "proses"].includes(o.status) && (
                <Textarea className="min-h-16 text-xs" placeholder="Data pesanan digital: kode voucher, akun, ID, dll." value={delivery[o.id] || ""} onChange={(e) => setDelivery((p) => ({ ...p, [o.id]: e.target.value }))} />
              )}
              <div className="flex flex-wrap gap-1.5">
                {["dibayar", "proses"].includes(o.status) && <Button size="sm" className="h-7 text-[10px]" disabled={!delivery[o.id]?.trim()} onClick={() => sendOrder(o)}><Send className="w-3 h-3 mr-1" />Kirim Pesanan</Button>}
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => window.dispatchEvent(new CustomEvent("seller-open-chat", { detail: { orderId: o.id } }))}>Chat Pembeli</Button>
                {(o.dispute_used || o.status === "kendala") && <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => setCaseOrder(o)}>Grup Kasus {orderCode(o)}</Button>}
              </div>
            </div>
          );
        })}
      </CardContent>
      <Dialog open={!!caseOrder} onOpenChange={(v) => !v && setCaseOrder(null)}>
        {caseOrder && <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Grup Kasus Pesanan</DialogTitle></DialogHeader><DisputeRoom orderId={caseOrder.id} visitorId={visitorId} /></DialogContent>}
      </Dialog>
    </Card>
  );
}

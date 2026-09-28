import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { orderCode } from "./orderCode";
import { useMarketSignal } from "@/hooks/useMarketSignal";
import DisputeRoom, { disputeStatusLabel } from "./DisputeRoom";

type Decision = "refund" | "release" | "fix" | "ask_buyer" | "ask_seller" | "close" | "reject" | "warn" | "suspend";
const LABELS: Record<Decision, string> = { refund: "Refund pembeli", release: "Dana diteruskan", fix: "Perbaikan diminta", ask_buyer: "Pembeli diminta konfirmasi", ask_seller: "Penjual diminta respon", close: "Kasus ditutup", reject: "Laporan ditolak", warn: "Peringatan dikirim", suspend: "Akun ditangguhkan" };

/** Admin: laporan kendala pesanan + grup bertiga (Pembeli + Seller + Admin) + keputusan dana */
export default function AdminSellerDisputes() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<"buyer" | "seller">("seller");
  const [days, setDays] = useState(3);

  async function load() {
    const { data, error } = await supabase.functions.invoke("seller-shop", { body: { action: "admin_disputes" } });
    if (error || data?.error) return toast({ title: "Laporan gagal dimuat", variant: "destructive" });
    setList(data?.disputes || []);
  }
  useEffect(() => { load(); }, []);
  useMarketSignal(["admin"], () => { load(); });

  async function resolve(id: string, decision: Decision, reload: () => void) {
    if (["refund", "release", "reject", "suspend"].includes(decision) && !confirm(`${LABELS[decision]}?`)) return;
    const { data, error } = await supabase.functions.invoke("seller-shop", { body: { action: "resolve", disputeId: id, decision, note, target, days } });
    if (error || data?.error) return toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
    toast({ title: LABELS[decision] + " ✓" });
    setNote(""); load(); reload();
  }

  return (
    <Card><CardContent className="p-3 space-y-2">
      <h3 className="text-sm font-black">🚩 Kasus Pesanan / Sengketa</h3>
      {list.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Belum ada laporan.</p>}
      {list.map((d) => (
        <div key={d.id} className="rounded-xl border p-2 space-y-2">
          <button className="w-full text-left" onClick={() => setOpen(open === d.id ? null : d.id)}>
            <div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-bold">Kasus Pesanan {d.order ? orderCode(d.order) : `#${d.dispute_number}`}</p><Badge variant={d.awaiting === "admin" ? "destructive" : "outline"} className="text-[9px]">{disputeStatusLabel(d)}</Badge></div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">{d.reason}</p>
          </button>
          {open === d.id && <div className="space-y-2">
            {d.order && <div className="rounded-lg border p-2 text-[11px] space-y-0.5 break-words"><p><b>{d.order.product_title}</b> · {d.order.qty} × Rp {Number(d.order.price).toLocaleString("id-ID")}</p><p>Dibayar Saldo: {d.order.paid_at ? new Date(d.order.paid_at).toLocaleString("id-ID") : "-"} · Status: {d.order.status}</p>{d.order.buyer_note && <p>Catatan: {d.order.buyer_note}</p>}{d.order.delivery_data && <p className="whitespace-pre-wrap break-all">Data seller: {d.order.delivery_data}</p>}</div>}
            <DisputeRoom orderId={d.order_id} asAdmin>
              {(c, reload) => ["open", "fixing"].includes(c.status) && <div className="space-y-2 rounded-xl border p-2">
                <Input className="h-8 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan keputusan (opsional)" />
                <div className="grid grid-cols-2 gap-1">
                  <Button size="sm" variant="outline" className="text-[10px]" onClick={() => resolve(d.id, "fix", reload)}>Perbaiki Pesanan</Button>
                  <Button size="sm" variant="outline" className="text-[10px]" onClick={() => resolve(d.id, "ask_buyer", reload)}>Minta Respons Pembeli</Button>
                  <Button size="sm" variant="outline" className="text-[10px]" onClick={() => resolve(d.id, "ask_seller", reload)}>Minta Respons Seller</Button>
                  <Button size="sm" variant="outline" className="text-[10px]" onClick={() => resolve(d.id, "close", reload)}>Tutup Kasus</Button>
                  <Button size="sm" variant="outline" className="text-[10px]" onClick={() => resolve(d.id, "reject", reload)}>Tolak Laporan</Button>
                  <Button size="sm" variant="destructive" className="text-[10px]" onClick={() => resolve(d.id, "refund", reload)}>Refund Pembeli</Button>
                  <Button size="sm" className="col-span-2 text-[10px]" onClick={() => resolve(d.id, "release", reload)}>Teruskan Dana ke Seller</Button>
                </div>
                <div className="space-y-1 rounded-lg bg-muted/40 p-2">
                  <p className="text-[10px] font-bold">Tindakan akun</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button size="sm" variant={target === "buyer" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => setTarget("buyer")}>{c.buyer_name} (Pembeli)</Button>
                    <Button size="sm" variant={target === "seller" ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => setTarget("seller")}>{c.store_name} (Seller)</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => resolve(d.id, "warn", reload)}>Berikan Peringatan</Button>
                    <Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} className="h-7 w-14 text-[10px]" aria-label="Hari penangguhan" />
                    <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => resolve(d.id, "suspend", reload)}>Tangguhkan {days} hari</Button>
                  </div>
                </div>
              </div>}
            </DisputeRoom>
          </div>}
        </div>
      ))}
    </CardContent></Card>
  );
}

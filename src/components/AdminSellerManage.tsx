import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, Loader2, RefreshCw, Store, ShoppingBag, Wallet, Check, X, EyeOff } from "lucide-react";

const rp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

export default function AdminSellerManage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"toko" | "produk" | "wd" | "kendala">("toko");
  const [stores, setStores] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [wds, setWds] = useState<any[]>([]);
  const [variants, setVariants] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [topup, setTopup] = useState<Record<string, string>>({});
  const [disputes, setDisputes] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: p }, { data: w }, { data: d }] = await Promise.all([
      supabase.from("seller_stores" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("seller_products" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("seller_withdrawals" as any).select("*").order("created_at", { ascending: false }).limit(60),
      supabase.from("seller_disputes" as any).select("*").order("created_at", { ascending: false }).limit(60),
    ]);
    setStores((s as any[]) || []);
    setProds((p as any[]) || []);
    setWds((w as any[]) || []);
    setDisputes((d as any[]) || []);
    const ids = ((p as any[]) || []).map((x) => x.id);
    if (ids.length) {
      const { data: v } = await supabase.from("seller_product_variants" as any).select("*").in("product_id", ids);
      const map: Record<string, any[]> = {};
      for (const row of ((v as any[]) || [])) (map[row.product_id] ||= []).push(row);
      setVariants(map);
    } else setVariants({});
    setLoading(false);
  }
  useEffect(() => { load(); }, []);


  const storeName = (id: string) => stores.find((s) => s.id === id)?.store_name || "-";

  async function upd(table: string, id: string, patch: any, msg: string) {
    const { error } = await supabase.from(table as any).update(patch).eq("id", id);
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
    else { toast({ title: msg }); await load(); }
  }

  async function payWd(w: any) {
    const st = stores.find((s) => s.id === w.store_id);
    if (st) {
      await supabase.from("seller_stores" as any)
        .update({ balance: Math.max(0, (st.balance || 0) - w.amount), updated_at: new Date().toISOString() } as any)
        .eq("id", st.id);
    }
    await upd("seller_withdrawals", w.id, { status: "paid", processed_at: new Date().toISOString(), admin_note: notes[w.id] || null }, "✅ Penarikan ditandai dibayar");
  }

  async function addBalance(st: any) {
    const amt = Math.round(Number(topup[st.id]) || 0);
    if (!amt) return;
    await upd("seller_stores", st.id, { balance: (st.balance || 0) + amt, updated_at: new Date().toISOString() }, "✅ Saldo toko diperbarui");
    setTopup((t) => ({ ...t, [st.id]: "" }));
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">🏬 Manajemen Toko Penjual</h2>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            { k: "toko", l: `Toko (${stores.length})`, i: Store },
            { k: "produk", l: `Produk (${prods.filter((p) => p.status === "pending").length} baru)`, i: ShoppingBag },
            { k: "wd", l: `Penarikan (${wds.filter((w) => w.status === "pending").length})`, i: Wallet },
            { k: "kendala", l: `Kendala (${disputes.filter((d) => d.status === "open").length})`, i: Store },
          ] as const).map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`rounded-xl border p-2 text-[11px] font-bold flex flex-col items-center gap-1 ${
                tab === t.k ? "border-teal-400/60 bg-teal-500/15 text-teal-200" : "border-border bg-card/50 text-muted-foreground"}`}>
              <t.i className="w-4 h-4" /> {t.l}
            </button>
          ))}
        </div>

        {loading ? <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div> : (
          <>
            {tab === "toko" && (stores.length === 0 ? <p className="text-center text-xs text-muted-foreground py-6">Belum ada toko penjual.</p> :
              stores.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-background/40 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm">{s.store_name}</p>
                    {s.is_verified && <BadgeCheck className="w-4 h-4 text-sky-400" />}
                    <Badge variant="outline" className="text-[9px]">#{s.store_number}</Badge>
                    {!s.is_active && <Badge variant="destructive" className="text-[9px]">nonaktif</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Saldo {rp(s.balance)} · fee {s.fee_percent}% · terjual {s.total_sales || 0}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" className="h-7 text-[10px]" variant={s.is_verified ? "outline" : "default"}
                      onClick={() => upd("seller_stores", s.id, { is_verified: !s.is_verified }, s.is_verified ? "Centang biru dicabut" : "✅ Centang biru diberikan")}>
                      <BadgeCheck className="w-3 h-3 mr-1" /> {s.is_verified ? "Cabut centang" : "Beri centang biru"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]"
                      onClick={() => upd("seller_stores", s.id, { is_active: !s.is_active }, "Status toko diperbarui")}>
                      <EyeOff className="w-3 h-3 mr-1" /> {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                  <div className="flex gap-1.5">
                    <Input className="h-8 text-xs" placeholder="Tambah saldo toko (Rp)" inputMode="numeric"
                      value={topup[s.id] || ""} onChange={(e) => setTopup((t) => ({ ...t, [s.id]: e.target.value.replace(/\D/g, "") }))} />
                    <Button size="sm" className="h-8 text-[10px]" onClick={() => addBalance(s)}>Simpan</Button>
                  </div>
                </div>
              )))}

            {tab === "produk" && (prods.length === 0 ? <p className="text-center text-xs text-muted-foreground py-6">Belum ada produk penjual.</p> :
              prods.map((p) => (
                <div key={p.id} className="flex gap-2 rounded-xl border border-border bg-background/40 p-2">
                  {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" className="w-14 h-14 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-bold truncate">{p.title}</p>
                    <p className="text-[11px] text-emerald-300">{rp(p.price)} · stok {p.stock} · {storeName(p.store_id)}</p>
                    {Array.isArray(p.images) && p.images.length > 1 && (
                      <div className="flex gap-1 overflow-x-auto">
                        {p.images.slice(0, 6).map((src: string, i: number) => (
                          <img key={i} src={src} alt={`${p.title} ${i + 1}`} loading="lazy" className="w-10 h-10 rounded object-cover shrink-0" />
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                      {p.has_warranty && (
                        <Badge variant="outline" className="text-[9px] text-sky-300 border-sky-400/30">
                          🛡️ Garansi {p.warranty_duration_value} {p.warranty_duration_unit === "year" ? "Tahun" : "Bulan"}
                        </Badge>
                      )}
                      {(variants[p.id] || []).map((v) => (
                        <Badge key={v.id} variant="outline" className="text-[9px] text-fuchsia-300 border-fuchsia-400/30">
                          {v.name} · {rp(v.price)} · stok {v.stock}
                        </Badge>
                      ))}
                    </div>
                    <Input className="h-7 text-[11px]" placeholder="Catatan admin (opsional)"
                      value={notes[p.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} />

                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-[10px]"
                        onClick={() => upd("seller_products", p.id, { status: "approved", admin_note: notes[p.id] || null, updated_at: new Date().toISOString() }, "✅ Produk disetujui")}>
                        <Check className="w-3 h-3 mr-1" /> Setujui
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-[10px]"
                        onClick={() => upd("seller_products", p.id, { status: "rejected", admin_note: notes[p.id] || null, updated_at: new Date().toISOString() }, "Produk ditolak")}>
                        <X className="w-3 h-3 mr-1" /> Tolak
                      </Button>
                    </div>
                  </div>
                </div>
              )))}

            {tab === "kendala" && (disputes.length === 0 ? <p className="text-center text-xs text-muted-foreground py-6">Belum ada laporan kendala.</p> :
              disputes.map((d) => (
                <div key={d.id} className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between"><p className="text-xs font-bold">🚩 Pesanan #{d.order_id}</p><Badge variant="outline">{d.status}</Badge></div>
                  <p className="text-[10px] text-muted-foreground">{d.reason}</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-[10px]" disabled={d.status !== "open"} onClick={async () => { const { error } = await supabase.functions.invoke("seller-escrow",{body:{action:"refund",orderId:d.order_id,visitorId:"admin"}}); if(error) toast({title:"Refund gagal",description:error.message,variant:"destructive"}); else { await supabase.from("seller_disputes" as any).update({status:"resolved",resolved_at:new Date().toISOString(),admin_note:"Saldo dikembalikan ke pembeli"}).eq("id",d.id); toast({title:"Saldo dikembalikan ke pembeli"}); load(); } }}>Kembalikan saldo</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={d.status !== "open"} onClick={async () => { const { error } = await supabase.functions.invoke("seller-escrow",{body:{action:"release",orderId:d.order_id,visitorId:"admin"}}); if(error) toast({title:"Penerusan gagal",description:error.message,variant:"destructive"}); else { await supabase.from("seller_disputes" as any).update({status:"resolved",resolved_at:new Date().toISOString(),admin_note:"Dana diteruskan ke penjual"}).eq("id",d.id); toast({title:"Dana diteruskan ke penjual"}); load(); } }}>Teruskan ke penjual</Button>
                  </div>
                </div>
              )))}

            {tab === "wd" && (wds.length === 0 ? <p className="text-center text-xs text-muted-foreground py-6">Belum ada permintaan penarikan.</p> :
              wds.map((w) => (
                <div key={w.id} className="rounded-xl border border-border bg-background/40 p-2 space-y-1.5">
                  <p className="text-xs font-bold">{rp(w.amount)} · {w.method} · {storeName(w.store_id)}</p>
                  <p className="text-[11px] text-muted-foreground">{w.account_name} — {w.account_number} · #{w.wd_number}</p>
                  <Badge variant="outline" className="text-[9px]">{w.status}</Badge>
                  {w.status === "pending" && (
                    <>
                      <Input className="h-7 text-[11px]" placeholder="Catatan admin"
                        value={notes[w.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))} />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 text-[10px]" onClick={() => payWd(w)}><Check className="w-3 h-3 mr-1" /> Tandai Dibayar</Button>
                        <Button size="sm" variant="destructive" className="h-7 text-[10px]"
                          onClick={() => upd("seller_withdrawals", w.id, { status: "rejected", admin_note: notes[w.id] || null, processed_at: new Date().toISOString() }, "Penarikan ditolak")}>
                          <X className="w-3 h-3 mr-1" /> Tolak
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

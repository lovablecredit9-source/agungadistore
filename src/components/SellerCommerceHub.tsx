import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, MessageCircle, Settings, Plus, Minus, Trash2, Copy, Send, Star, Flag, CheckCircle2, ImagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";

const rp = (n:number) => "Rp " + Number(n || 0).toLocaleString("id-ID");
type Tab = "produk" | "chat" | "keranjang" | "pesanan" | "pengaturan";

export default function SellerCommerceHub({ visitorId }: { visitorId?: string | null }) {
  const vid = visitorId || getVisitorId();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("produk");
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<Record<string, any>>({});
  const [cart, setCart] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [balance, setBalance] = useState(0);
  const [username, setUsername] = useState("Pembeli");
  const [pin, setPin] = useState("");
  const [productForChat, setProductForChat] = useState<any>(null);
  const [reportOrder, setReportOrder] = useState<any>(null);
  const [reportText, setReportText] = useState("");
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [stars, setStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [sending, setSending] = useState(false);\n  const imageRef = useRef<HTMLInputElement>(null);\n  const isSeller = useMemo(() => Object.values(stores).some((s:any) => s.visitor_id === vid), [stores, vid]);

  const load = async () => {
    const [{ data: ps }, { data: st }, { data: cs }, { data: os }, { data: ts }, { data: ub }] = await Promise.all([
      supabase.from("seller_products" as any).select("*").eq("status", "approved").eq("is_active", true).order("created_at", { ascending: false }).limit(100),
      supabase.from("seller_stores" as any).select("*").eq("is_active", true),
      supabase.from("seller_cart_items" as any).select("*").eq("visitor_id", vid).order("created_at", { ascending: false }),
      supabase.from("seller_orders" as any).select("*").or("buyer_visitor_id.eq." + vid + ",seller_visitor_id.eq." + vid).order("created_at", { ascending: false }).limit(100),
      supabase.from("seller_chat_threads" as any).select("*").or("buyer_visitor_id.eq." + vid + ",seller_visitor_id.eq." + vid).order("updated_at", { ascending: false }),
      supabase.from("user_balances_public" as any).select("balance,username").eq("visitor_id", vid).maybeSingle(),
    ]);
    const p = (ps as any[]) || [];
    setProducts(p);
    const sm: Record<string, any> = {};
    for (const s of ((st as any[]) || [])) sm[s.id] = s;
    setStores(sm);
    setCart(((cs as any[]) || []).map(c => ({ ...c, product: p.find(x => x.id === c.product_id) })));
    setOrders((os as any[]) || []);
    setThreads((ts as any[]) || []);
    setBalance(Number(ub?.balance || 0));
    setUsername(ub?.username || "Pembeli");
  };

  useEffect(() => { load(); }, [vid]);

  const cartTotal = useMemo(() => cart.reduce((n, c) => n + Number(c.product?.price || 0) * Number(c.qty || 0), 0), [cart]);

  const updateFields = async (id:string, order_fields:any) => { await supabase.from("seller_cart_items" as any).update({ order_fields } as any).eq("id", id).eq("visitor_id", vid); load(); };

  const updateQty = async (id:string, qty:number) => {
    if (qty <= 0) await supabase.from("seller_cart_items" as any).delete().eq("id", id).eq("visitor_id", vid);
    else await supabase.from("seller_cart_items" as any).update({ qty } as any).eq("id", id).eq("visitor_id", vid);
    load();
  };

  const addCart = async (p:any) => {
    const old = cart.find(c => c.product_id === p.id);
    const next = Math.min(Number(p.stock || 0), Number(old?.qty || 0) + 1);
    if (!next) return toast({ title: "Stok habis", variant: "destructive" });
    const result = old
      ? await supabase.from("seller_cart_items" as any).update({ qty: next } as any).eq("id", old.id).eq("visitor_id", vid)
      : await supabase.from("seller_cart_items" as any).insert({ visitor_id: vid, product_id: p.id, qty: 1, order_fields: {} } as any);
    if (result.error) toast({ title: "Keranjang gagal", description: result.error.message, variant: "destructive" });
    else { toast({ title: "🛒 Produk masuk keranjang" }); load(); }
  };

  const checkout = async () => {
    if (!cart.length) return;
    if (balance < cartTotal) return toast({ title: "Saldo utama tidak cukup", variant: "destructive" });
    if (!/^\d{6}$/.test(pin)) return toast({ title: "PIN harus 6 digit", variant: "destructive" });
    setSending(true);
    try {
      const body = { visitorId: vid, pin, items: cart.map(c => ({ productId: c.product_id, qty: c.qty, orderFields: c.order_fields || {} })) };
      const { data, error } = await supabase.functions.invoke("seller-checkout", { body });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Checkout gagal");
      toast({ title: "✅ Pembayaran berhasil", description: "Dana ditahan sampai pesanan selesai." });
      setPin("");
      await load();
      setTab("pesanan");
    } catch (e:any) {
      toast({ title: "Checkout gagal", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const openThread = async (t:any) => {
    setSelectedThread(t);
    const { data } = await supabase.from("seller_chat_messages" as any).select("*").eq("thread_id", t.id).order("created_at", { ascending: true });
    setMessages((data as any[]) || []);
  };

  const openProductChat = async (p:any) => {
    let t = threads.find(x => x.product_id === p.id && x.store_id === p.store_id);
    if (!t) {
      const { data, error } = await supabase.from("seller_chat_threads" as any).insert({
        store_id: p.store_id, product_id: p.id, buyer_visitor_id: vid, seller_visitor_id: p.visitor_id,
        product_title: p.title, buyer_name: username
      }).select("*").single();
      if (error) return toast({ title: "Chat gagal dibuka", description: error.message, variant: "destructive" });
      t = data;
      setThreads(x => [t, ...x]);
    }
    setProductForChat(p);
    await openThread(t);
    setTab("chat");
  };

  const send = async (kind="text", payload:any=null, imageUrl:string|null=null) => {
    if (!selectedThread || (!message.trim() && !payload) || sending) return;
    setSending(true);
    const sender = selectedThread.seller_visitor_id === vid ? "seller" : "buyer";
    const { error } = await supabase.from("seller_chat_messages" as any).insert({
      thread_id: selectedThread.id, visitor_id: vid, sender, message: message.trim() || (imageUrl ? "📷 Foto" : " "), kind, payload, image_url: imageUrl
    } as any);
    if (error) toast({ title: "Pesan gagal", description: error.message, variant: "destructive" });
    else {
      setMessage("");
      await supabase.from("seller_chat_threads" as any).update({ updated_at: new Date().toISOString() }).eq("id", selectedThread.id);
      await openThread(selectedThread);
    }
    setSending(false);
  };

  const sendImage = async (file: File | null) => {\n    if (!file || !selectedThread || sending) return;\n    if (!file.type.startsWith("image/")) return toast({ title: "File harus berupa gambar", variant: "destructive" });\n    if (file.size > 8 * 1024 * 1024) return toast({ title: "Foto maksimal 8 MB", variant: "destructive" });\n    try {\n      const bmp = await createImageBitmap(file);\n      const max = 1280;\n      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));\n      const canvas = document.createElement("canvas");\n      canvas.width = Math.max(1, Math.round(bmp.width * scale));\n      canvas.height = Math.max(1, Math.round(bmp.height * scale));\n      const ctx = canvas.getContext("2d");\n      if (!ctx) throw new Error("Browser tidak mendukung pemrosesan foto");\n      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);\n      const dataUrl = canvas.toDataURL("image/jpeg", 0.78);\n      await send("image", null, dataUrl);\n    } catch (e:any) {\n      toast({ title: "Foto gagal dikirim", description: e?.message || "Coba foto lain", variant: "destructive" });\n    }\n  };\n\n  const copy = async (text:string) => {
    await navigator.clipboard?.writeText(text);
    toast({ title: "Disalin" });
  };

  const removeMessage = async (m:any) => {
    if (m.visitor_id !== vid || Date.now() - new Date(m.created_at).getTime() > 5 * 60 * 1000) return;
    await supabase.from("seller_chat_messages" as any).update({ deleted_at: new Date().toISOString() }).eq("id", m.id).eq("visitor_id", vid);
    openThread(selectedThread);
  };

  const confirmOrder = async (o:any) => {
    const { data, error } = await supabase.functions.invoke("seller-escrow", { body: { action: "confirm", visitorId: vid, orderId: o.id } });
    if (error || data?.error) return toast({ title: "Konfirmasi gagal", description: error?.message || data?.error, variant: "destructive" });
    toast({ title: "✅ Pesanan selesai dan dana dilepas" });
    load();
  };

  const report = async () => {
    if (!reportOrder) return;
    const reason = reportText.trim() || "Kendala pesanan";
    const { data, error } = await supabase.functions.invoke("seller-escrow", {
      body: { action: "dispute", visitorId: vid, orderId: reportOrder.id, deliveryData: reason }
    });
    if (error || data?.error) return toast({ title: "Kendala gagal dibuka", description: error?.message || data?.error, variant: "destructive" });
    toast({ title: "🚩 Kendala dikirim ke admin" });
    setReportOrder(null);
    setReportText("");
    load();
  };

  const review = async () => {
    if (!reviewOrder) return;
    const { error } = await supabase.from("seller_reviews" as any).insert({
      order_id: reviewOrder.id, product_id: reviewOrder.product_id, store_id: reviewOrder.store_id,
      buyer_visitor_id: vid, buyer_name: username, product_rating: stars, store_rating: stars, comment: reviewText.trim() || null
    } as any);
    if (error) toast({ title: "Rating gagal", description: error.message, variant: "destructive" });
    else { toast({ title: "⭐ Rating tersimpan" }); setReviewOrder(null); setReviewText(""); load(); }
  };

  const tabs: [Tab,string][] = [
    ["produk","🛍️ Produk"], ["chat","💬 Chat"], ["keranjang","🛒 Keranjang"], ["pesanan","📦 Pesanan"], ["pengaturan","⚙️ Pengaturan"]
  ];

  return <div className="space-y-3">
    <div className={"grid gap-1.5 " + (isSeller ? "grid-cols-5" : "grid-cols-4")}>
      {tabs.map(([k,label]) => <Button key={k} variant="ghost" onClick={() => setTab(k)}
        className={"h-10 px-1 text-[9px] font-bold border " + (tab === k ? "border-primary bg-primary/10 text-primary" : "border-border")}>{label}</Button>)}
    </div>

    {tab === "produk" && <div className="grid grid-cols-2 gap-2">
      {products.map(p => <Card key={p.id} className="overflow-hidden">
        <img src={p.image_url || "/placeholder.svg"} className="w-full h-28 object-cover" alt="" />
        <CardContent className="p-2 space-y-1.5">
          <p className="text-xs font-bold line-clamp-2">{p.title}</p>
          <p className="text-xs font-black text-emerald-400">{rp(p.price)}</p>
          <p className="text-[10px] text-muted-foreground">🏪 {stores[p.store_id]?.store_name || "Toko"} · stok {p.stock}</p>
          <div className="flex gap-1">
            <Button size="sm" className="h-7 flex-1 text-[10px]" disabled={!p.stock} onClick={() => addCart(p)}><ShoppingCart className="w-3 h-3 mr-1" />Keranjang</Button>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openProductChat(p)}><MessageCircle className="w-3 h-3" /></Button>
          </div>
          <Button variant="outline" className="w-full h-7 text-[10px]" onClick={() => copy(location.origin + "/seller?product=" + p.id)}><Copy className="w-3 h-3 mr-1" />Salin tautan produk</Button>
        </CardContent>
      </Card>)}
      {!products.length && <p className="col-span-2 text-center py-8 text-xs text-muted-foreground">Belum ada produk penjual.</p>}
    </div>}

    {tab === "chat" && <div className="grid gap-3 md:grid-cols-[220px_1fr]">
      <Card><CardContent className="p-2 space-y-1">
        <p className="text-xs font-black p-2">Chat Pembeli / Penjual</p>
        {threads.map(t => <button key={t.id} onClick={() => openThread(t)} className={"w-full text-left rounded-xl p-2 border " + (selectedThread?.id === t.id ? "border-primary bg-primary/10" : "border-border")}>
          <p className="text-xs font-bold truncate">{t.seller_visitor_id === vid ? (t.buyer_name || "Pembeli") : "Penjual"}</p>
          <p className="text-[10px] text-muted-foreground truncate">{t.product_title}</p>
        </button>)}
        {!threads.length && <p className="p-2 text-[10px] text-muted-foreground">Belum ada percakapan.</p>}
      </CardContent></Card>
      <Card className="min-h-[540px]"><CardContent className="p-3 h-full flex flex-col">
        {!selectedThread ? <p className="m-auto text-xs text-muted-foreground">Pilih percakapan.</p> : <>
          <div className="flex items-center gap-2 border-b pb-2">
            <div className="w-10 h-10 rounded-full bg-muted grid place-items-center">👤</div>
            <div className="flex-1">
              <p className="text-sm font-bold">{selectedThread.seller_visitor_id === vid ? (selectedThread.buyer_name || "Pembeli") : "Penjual"}</p>
              <p className="text-[10px] text-muted-foreground">No. Pesanan: {orders.find(o => o.thread_id === selectedThread.id)?.order_number || "—"}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {messages.map(m => <div key={m.id} className={"flex " + (m.visitor_id === vid ? "justify-end" : "justify-start")}>
              <div className="max-w-[82%] rounded-2xl bg-muted px-3 py-2 text-xs">
                {m.deleted_at ? <i className="text-muted-foreground">Pesan dihapus</i> : <>
                  {m.kind === "product" && m.payload && <div className="rounded-lg border p-2 mb-1">
                    <p className="font-bold">{m.payload.title}</p><p>{rp(m.payload.price)}</p><p className="text-[10px]">Stok {m.payload.stock}</p>
                  </div>}
                  {m.image_url && <img src={m.image_url} className="max-h-56 rounded-lg" alt="" />}
                  <p className="whitespace-pre-wrap">{m.message}</p>
                </>}
                <div className="mt-1 flex justify-end gap-2 text-[9px] text-muted-foreground">
                  <button onClick={() => copy(m.message)}><Copy className="w-3 h-3" /></button>
                  {m.visitor_id === vid && Date.now() - new Date(m.created_at).getTime() <= 5 * 60 * 1000 &&
                    <button onClick={() => removeMessage(m)}><Trash2 className="w-3 h-3" /></button>}
                </div>
              </div>
            </div>)}
          </div>
          <div className="flex gap-1.5">
            <input ref={imageRef} type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0] || null; e.currentTarget.value=""; void sendImage(f); }} />\n            <Button type="button" variant="outline" onClick={() => imageRef.current?.click()} disabled={sending} aria-label="Kirim foto"><ImagePlus className="w-4 h-4" /></Button>\n            <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Tulis pesan..." onKeyDown={e => e.key === "Enter" && send()} />
            <Button onClick={() => send()} disabled={!message.trim() || sending}><Send className="w-4 h-4" /></Button>
          </div>
          {productForChat && <Button variant="outline" className="mt-2 text-xs" onClick={() => send("product", { id:productForChat.id, title:productForChat.title, price:productForChat.price, stock:productForChat.stock, image_url:productForChat.image_url })}>Kirim detail produk</Button>}
        </>}
      </CardContent></Card>
    </div>}

    {tab === "keranjang" && <Card><CardContent className="p-3 space-y-3">
      <h3 className="font-black text-sm">🛒 Keranjang Produk</h3>
      {cart.map(c => <div key={c.id} className="border rounded-xl p-2 space-y-2">
        <div className="flex items-center gap-2">
          <img src={c.product?.image_url || "/placeholder.svg"} className="w-14 h-14 rounded-lg object-cover" alt="" />
          <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate">{c.product?.title}</p><p className="text-xs text-emerald-400">{rp(c.product?.price)}</p></div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.id, Math.max(0, c.qty - 1))}><Minus className="w-3 h-3" /></Button>
            <span className="text-xs w-5 text-center">{c.qty}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(c.id, Math.min(c.product?.stock || 0, c.qty + 1))}><Plus className="w-3 h-3" /></Button>
            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => updateQty(c.id, 0)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        </div>
        {Array.isArray(c.product?.order_form?.fields) && c.product.order_form.fields.length > 0 && <div className="space-y-1.5 rounded-lg bg-muted/30 p-2">
          <p className="text-[10px] font-bold">Data untuk pesanan</p>
          {c.product.order_form.fields.map((f:any) => <Input key={f.key} value={c.order_fields?.[f.key] || ""} onChange={e => updateFields(c.id, { ...(c.order_fields || {}), [f.key]: e.target.value })} placeholder={f.label || f.key} className="h-8 text-xs" />)}
        </div>}
      </div>)}
      {!cart.length && <p className="text-center py-8 text-xs text-muted-foreground">Keranjang kosong.</p>}
      <div className="border-t pt-3 flex justify-between font-black text-sm"><span>Total</span><span>{rp(cartTotal)}</span></div>
      {cart.length > 0 && <><Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN 6 digit" />
        <p className="text-[10px] text-muted-foreground">Pembayaran hanya memakai saldo utama, bukan Saldo IN.</p>
        <Button className="w-full" disabled={sending || balance < cartTotal || pin.length !== 6} onClick={checkout}>{balance < cartTotal ? "Saldo tidak cukup" : "Bayar dengan saldo utama"}</Button></>}
    </CardContent></Card>}

    {tab === "pesanan" && <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1">{["Dibayar","Dikirim","Selesai","Kendala"].map(s => <div key={s} className="rounded-lg border p-2 text-center text-[10px] font-bold">{s}</div>)}</div>
      {orders.map(o => <Card key={o.id}><CardContent className="p-3 space-y-2">
        <div className="flex justify-between gap-2"><div><p className="text-sm font-bold">{o.product_title} ×{o.qty}</p><p className="text-[10px] text-muted-foreground">No. Pesanan #{o.order_number}</p><p className="text-xs font-black text-emerald-400">{rp(o.total)}</p></div>
        <Badge variant="outline">{o.status === "pending" ? "Dibayar" : o.status === "dikirim" ? "Dikirim" : o.status === "selesai" ? "Selesai" : o.status === "kendala" ? "Kendala" : o.status}</Badge></div>
        {o.order_fields && <div className="rounded-lg bg-muted/40 p-2 text-[10px]"><b>Data pesanan:</b> {JSON.stringify(o.order_fields)}</div>}
        {o.delivery_data && <div className="rounded-lg bg-emerald-500/10 p-2 text-xs">📦 Data dari penjual: {o.delivery_data}</div>}
        {o.status === "dikirim" && <div className="flex gap-1.5"><Button size="sm" className="h-8 text-[10px]" onClick={() => confirmOrder(o)}><CheckCircle2 className="w-3 h-3 mr-1" />Konfirmasi diterima</Button><Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => setReportOrder(o)}><Flag className="w-3 h-3 mr-1" />Ajukan kendala</Button></div>}
        {o.status === "selesai" && <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => setReviewOrder(o)}><Star className="w-3 h-3 mr-1" />Rating produk & toko</Button>}
      </CardContent></Card>)}
      {!orders.length && <p className="text-center py-8 text-xs text-muted-foreground">Belum ada pesanan.</p>}
    </div>}

    {isSeller && tab === "pengaturan" && <Card><CardContent className="p-4 space-y-3">
      <h3 className="font-black text-sm flex items-center gap-2"><Settings className="w-4 h-4" /> Pengaturan jualan</h3>
      <div className="rounded-xl border p-3 text-xs">Nama akun chat: <b>{username}</b><br/>Saldo utama: <b>{rp(balance)}</b><br/>Dana pesanan: <b>ditahan sampai konfirmasi/auto 5 jam</b></div>
      <p className="text-[10px] text-muted-foreground">Tidak ada alamat, resi, atau nama pengirim untuk produk digital. Penjual mengirim data produk melalui chat/pesanan.</p>
    </CardContent></Card>}

    {reportOrder && <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center"><Card className="w-full max-w-lg rounded-t-2xl"><CardContent className="p-4 space-y-2"><h3 className="font-black">🚩 Kendala #{reportOrder.order_number}</h3><Textarea value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Jelaskan kendala..." /><Button className="w-full" onClick={report}>Kirim ke Admin</Button><Button variant="ghost" className="w-full" onClick={() => setReportOrder(null)}>Batal</Button></CardContent></Card></div>}
    {reviewOrder && <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center"><Card className="w-full max-w-lg rounded-t-2xl"><CardContent className="p-4 space-y-3"><h3 className="font-black">⭐ Rating Produk & Toko</h3><div className="flex justify-center gap-1">{[1,2,3,4,5].map(s => <button key={s} onClick={() => setStars(s)} className={stars >= s ? "text-yellow-400" : "text-muted-foreground"}><Star className="w-7 h-7" fill="currentColor" /></button>)}</div><Textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Ulasan..." /><Button className="w-full" onClick={review}>Kirim Rating</Button></CardContent></Card></div>}
  </div>;
}

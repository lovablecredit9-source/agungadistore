import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { useMarketSignal } from "@/hooks/useMarketSignal";
import { SellerVerifiedBadge } from "./SellerVerifiedBadge";

/** Status kasus sengketa dalam bahasa pengguna */
export function disputeStatusLabel(d: any): string {
  if (!d) return "";
  if (d.status === "refunded") return "Selesai · Refund ke Pembeli";
  if (d.status === "released") return "Selesai · Dana Diteruskan ke Seller";
  if (d.status === "rejected") return "Selesai · Laporan Ditolak";
  if (d.status === "closed") return "Selesai · Kasus Ditutup";
  if (d.awaiting === "seller") return "Menunggu Respons Seller";
  if (d.awaiting === "buyer") return "Menunggu Respons Pembeli";
  if (d.awaiting === "admin") return "Menunggu Keputusan Admin";
  if (d.status === "fixing") return "Perbaikan Pesanan · Dana Ditahan";
  return "Dana Ditahan";
}

const ROLE_LABEL: Record<string, string> = { buyer: "Pembeli", seller: "Seller", admin: "Admin", system: "Sistem" };
const ROLE_CLS: Record<string, string> = {
  buyer: "border-primary/40 text-primary",
  seller: "border-foreground/40 text-foreground",
  admin: "border-destructive/40 text-destructive",
  system: "border-muted-foreground/40 text-muted-foreground",
};

/**
 * Satu grup kasus per pesanan: Pembeli + Seller + Admin.
 * Identitas diambil dari server: pembeli = nama akun saldo, seller = nama toko, admin = "Admin".
 */
export default function DisputeRoom({ orderId, visitorId, asAdmin, onChanged, children }: {
  orderId: string; visitorId?: string | null; asAdmin?: boolean; onChanged?: (c: any) => void; children?: (c: any, reload: () => void) => React.ReactNode;
}) {
  const [c, setC] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("seller-shop", { body: asAdmin ? body : { ...body, visitorId } });
    if (error) { let m = error.message; try { const j = await (error as any).context?.json?.(); if (j?.error) m = j.error; } catch { /* ignore */ } throw new Error(m); }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const load = async () => {
    try { const d = await call({ action: "dispute_case", orderId }); setC(d.case); setMsgs(d.messages || []); onChanged?.(d.case); setErr(""); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { setLoading(true); load(); }, [orderId, visitorId]);
  useMarketSignal([asAdmin ? "admin" : visitorId || ""], () => load());
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  const send = async () => {
    if (!c || !text.trim()) return; setSending(true);
    try { await call({ action: "dispute_message", disputeId: c.id, message: text.trim() }); setText(""); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setSending(false); }
  };

  if (loading) return <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Memuat kasus...</p>;
  if (!c) return <p className="py-4 text-xs text-muted-foreground">{err || "Belum ada kasus untuk pesanan ini."}</p>;
  const open = ["open", "fixing"].includes(c.status);
  const deadline = c.awaiting === "seller" ? c.seller_respond_by : c.awaiting === "buyer" ? c.buyer_respond_by : null;
  const code = c.order_code ? `#${c.order_code}` : `#${c.order_number || c.dispute_number}`;

  return <div className="min-w-0 space-y-3">
    <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
      <p className="text-sm font-black break-all">Kasus Pesanan {code}</p>
      {c.product_title && <p className="text-[11px] text-muted-foreground truncate">{c.product_title}</p>}
      <p className="flex flex-wrap items-center gap-1 text-[11px]">
        <b className="break-all">{c.buyer_name}</b><span className="text-muted-foreground">(Pembeli)</span><span>+</span>
        <b className="inline-flex items-center gap-1 break-all">{c.store_name}<SellerVerifiedBadge verified={c.store_verified} /></b><span className="text-muted-foreground">(Seller)</span><span>+</span>
        <b className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Admin</b>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={open ? "destructive" : "secondary"} className="text-[10px]">{disputeStatusLabel(c)}</Badge>
        {open && c.awaiting && <Badge variant="outline" className="text-[10px]">Dana Ditahan</Badge>}
      </div>
      {open && deadline && <p className="text-[10px] text-destructive">Batas respons {c.awaiting === "seller" ? "seller" : "pembeli"}: {new Date(deadline).toLocaleString("id-ID")}</p>}
      <p className="text-[11px] break-words"><span className="text-muted-foreground">Laporan:</span> {c.reason}</p>
      {c.admin_note && !open && <p className="text-[11px] break-words"><span className="text-muted-foreground">Catatan admin:</span> {c.admin_note}</p>}
    </div>

    <div className="max-h-[45dvh] space-y-2 overflow-y-auto rounded-xl border p-2">
      {msgs.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Belum ada pesan.</p>}
      {msgs.map((m) => {
        const mine = !asAdmin ? m.sender === c.viewer : m.sender === "admin";
        return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] min-w-0 rounded-xl px-3 py-2 ${mine ? "bg-primary/10" : "bg-muted/60"}`}>
            <div className="flex flex-wrap items-center gap-1">
              <b className="text-xs break-all">{m.sender_name}</b>
              <Badge variant="outline" className={`h-4 px-1 text-[9px] ${ROLE_CLS[m.sender] || ""}`}>{ROLE_LABEL[m.sender] || m.sender}</Badge>
            </div>
            <time className="block text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString("id-ID", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.message}</p>
            {m.image_url && <a href={m.image_url} target="_blank" rel="noreferrer"><img src={m.image_url} alt="Bukti laporan" className="mt-2 max-h-48 max-w-full rounded object-contain" /></a>}
          </div>
        </div>;
      })}
      <div ref={endRef} />
    </div>

    {err && <p className="text-[11px] text-destructive">{err}</p>}
    {open ? <div className="flex gap-2">
      <Input maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder={asAdmin ? "Balas sebagai Admin..." : "Tulis pesan untuk grup kasus"} className="min-w-0" />
      <Button size="icon" disabled={!text.trim() || sending} onClick={send} aria-label="Kirim"><Send className="h-4 w-4" /></Button>
    </div> : <p className="text-center text-[11px] text-muted-foreground">Kasus sudah selesai.</p>}
    {children?.(c, load)}
  </div>;
}

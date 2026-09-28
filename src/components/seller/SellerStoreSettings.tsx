import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, BadgeCheck, Clock, MessageSquareReply } from "lucide-react";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const DOW = [1, 2, 3, 4, 5, 6, 0];
const DEF_TEXT = "Terima kasih sudah menghubungi toko kami. Pesan kamu akan segera kami balas.";
export const VERIF: Record<string, [string, "default" | "secondary" | "destructive" | "outline"]> = {
  unverified: ["Belum Diverifikasi", "outline"], pending: ["Menunggu Verifikasi", "secondary"],
  verified: ["✓ Terverifikasi", "default"], rejected: ["Ditolak", "destructive"],
};
export const storeLink = (id: string) => `${location.origin}/seller?store=${id}`;
export async function shareLink(url: string, title: string, toast: any) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
  } catch { return; }
  await navigator.clipboard.writeText(url); toast({ title: "🔗 Tautan disalin" });
}

export default function SellerStoreSettings({ visitorId, store, onSaved }: { visitorId: string; store: any; onSaved: () => void }) {
  const { toast } = useToast();
  const [autoOn, setAutoOn] = useState(!!store.auto_reply_enabled);
  const [autoText, setAutoText] = useState(store.auto_reply_text || DEF_TEXT);
  const [isOpen, setIsOpen] = useState(store.is_open !== false);
  const [note, setNote] = useState(store.closed_note || "");
  const [hours, setHours] = useState<any>(() => store.hours || Object.fromEntries(DOW.map((d) => [String(d), { open: true, start: "08:00", end: "21:00" }])));
  const [useHours, setUseHours] = useState(!!store.hours);
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const checkOpen = () => supabase.rpc("seller_store_is_open" as any, { p_store_id: store.id }).then(({ data }) => setOpenNow(!!data));
  useEffect(() => { checkOpen(); }, [store.id]);

  const setDay = (d: number, k: string, v: any) => setHours((h: any) => ({ ...h, [String(d)]: { ...h[String(d)], [k]: v } }));
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("seller_store_settings" as any, { p_visitor_id: visitorId, p: { auto_reply_enabled: autoOn, auto_reply_text: autoText, is_open: isOpen, closed_note: note, hours: useHours ? hours : null } });
    setBusy(false);
    if (error) return toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    toast({ title: "✅ Pengaturan toko disimpan" }); checkOpen(); onSaved();
  };
  const requestVerif = async () => {
    const { error } = await supabase.rpc("seller_request_verification" as any, { p_visitor_id: visitorId });
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" });
    else { toast({ title: "Pengajuan verifikasi terkirim ke admin" }); onSaved(); }
  };
  const v = VERIF[store.verification_status || "unverified"] || VERIF.unverified;

  return <div className="space-y-2">
    <Card><CardContent className="p-3 space-y-2">
      <div className="flex items-center justify-between"><p className="text-sm font-black flex items-center gap-1"><BadgeCheck className="w-4 h-4" />Verifikasi</p><Badge variant={v[1]} className="text-[10px]">{v[0]}</Badge></div>
      {store.verification_status === "rejected" && store.verification_note && <p className="text-[11px] text-destructive">Catatan admin: {store.verification_note}</p>}
      {(store.verification_status === "unverified" || store.verification_status === "rejected" || !store.verification_status) &&
        <Button size="sm" className="w-full" onClick={requestVerif}>Ajukan verifikasi ke admin</Button>}
      {store.verification_status === "pending" && <p className="text-[11px] text-muted-foreground">Admin sedang memeriksa tokomu.</p>}
    </CardContent></Card>

    <Card><CardContent className="p-3 space-y-2">
      <p className="text-sm font-black">Tautan toko</p>
      <p className="text-[11px] break-all rounded-lg bg-muted/40 p-2">{storeLink(store.id)}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(storeLink(store.id)); toast({ title: "🔗 Tautan disalin" }); }}><Copy className="w-3 h-3 mr-1" />Salin</Button>
        <Button size="sm" variant="outline" onClick={() => shareLink(storeLink(store.id), store.store_name, toast)}><Share2 className="w-3 h-3 mr-1" />Bagikan</Button>
      </div>
    </CardContent></Card>

    <Card><CardContent className="p-3 space-y-2">
      <div className="flex items-center justify-between"><p className="text-sm font-black flex items-center gap-1"><Clock className="w-4 h-4" />Jam operasional</p>
        {openNow !== null && <span className={"text-[11px] font-black " + (openNow ? "text-emerald-500" : "text-muted-foreground")}>{openNow ? "● TOKO BUKA" : "○ TOKO TUTUP"}</span>}</div>
      <label className="flex items-center justify-between text-xs"><span>Toko menerima pesanan</span><Switch checked={isOpen} onCheckedChange={setIsOpen} /></label>
      {!isOpen && <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan tutup (mis. Libur sampai Senin)" className="h-9 text-xs" />}
      <label className="flex items-center justify-between text-xs"><span>Pakai jadwal harian</span><Switch checked={useHours} onCheckedChange={setUseHours} /></label>
      {useHours && <div className="space-y-1.5">{DOW.map((d, i) => { const h = hours[String(d)] || { open: false, start: "08:00", end: "21:00" };
        return <div key={d} className="flex items-center gap-1.5 text-[11px]">
          <span className="w-12 font-bold">{DAYS[i]}</span>
          <Switch checked={!!h.open} onCheckedChange={(x) => setDay(d, "open", x)} />
          {h.open ? <><Input type="time" value={h.start} onChange={(e) => setDay(d, "start", e.target.value)} className="h-8 text-xs px-1 flex-1 min-w-0" /><span>–</span><Input type="time" value={h.end} onChange={(e) => setDay(d, "end", e.target.value)} className="h-8 text-xs px-1 flex-1 min-w-0" /></> : <span className="text-muted-foreground">Tutup</span>}
        </div>; })}<p className="text-[10px] text-muted-foreground">Mengikuti waktu Indonesia Barat (WIB).</p></div>}
    </CardContent></Card>

    <Card><CardContent className="p-3 space-y-2">
      <label className="flex items-center justify-between"><span className="text-sm font-black flex items-center gap-1"><MessageSquareReply className="w-4 h-4" />Balasan otomatis</span><Switch checked={autoOn} onCheckedChange={setAutoOn} /></label>
      <Textarea value={autoText} onChange={(e) => setAutoText(e.target.value)} maxLength={500} rows={3} className="text-xs" disabled={!autoOn} />
      <p className="text-[10px] text-muted-foreground">Terkirim saat pembeli pertama kali chat, toko tutup / di luar jam operasional, atau kamu sedang offline. Maksimal sekali per 30 menit per percakapan.</p>
    </CardContent></Card>

    <Button className="w-full" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan pengaturan toko"}</Button>
  </div>;
}

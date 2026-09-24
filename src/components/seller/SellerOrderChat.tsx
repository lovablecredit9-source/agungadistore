import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, ImagePlus, Check, CheckCheck } from "lucide-react";
import PresenceStatus from "@/components/PresenceStatus";
import { useToast } from "@/hooks/use-toast";

/** Chat pembeli <-> penjual untuk satu pesanan */
export default function SellerOrderChat({
  orderId,
  threadId,
  visitorId,
  role,
  partnerVisitorId,
  partnerName,
}: {
  orderId?: string;
  threadId?: string;
  visitorId: string;
  role: "buyer" | "seller";
  partnerVisitorId?: string | null;
  partnerName?: string;
}) {
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const table = threadId ? "seller_chat_messages" : "seller_order_messages";
  const filter = threadId ? "thread_id" : "order_id";
  const id = threadId || orderId;

  async function load() {
    if (!id) return;
    const { data } = await supabase
      .from(table as any)
      .select("*")
      .eq(filter, id)
      .order("created_at", { ascending: true });
    setMsgs((data as any[]) || []);
    const unread = (data as any[] || []).filter((m) => m.sender !== role && !m.read_at);
    if (unread.length) await supabase.from(table as any).update({ read_at: new Date().toISOString(), delivered_at: new Date().toISOString() } as any)
      .in("id", unread.map((m) => m.id)).is("read_at", null);
  }

  useEffect(() => {
    (supabase as any).rpc("touch_user_presence", { p_visitor_id: visitorId }).then(() => {});
    load();
    if (!id) return;
    const ch = supabase
      .channel(`seller-chat-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `${filter}=eq.${id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, visitorId, role]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send(imageUrl?: string) {
    const t = text.trim();
    if ((!t && !imageUrl) || !id || sending) return;
    setSending(true);
    const { error } = await supabase.from(table as any).insert({
      [filter]: id, sender: role, visitor_id: visitorId, message: t, image_url: imageUrl || null,
    } as any);
    if (error) toast({ title: "Gagal mengirim pesan", description: error.message, variant: "destructive" });
    else {
      setText("");
      if (threadId) await supabase.from("seller_chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    }
    setSending(false);
    load();
  }

  async function sendPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast({ title: "Pilih foto maksimal 5 MB", variant: "destructive" }); return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.65);
      if (image.length > 950000) throw new Error("Foto terlalu besar, pilih foto lain.");
      await send(image);
    } catch (error) {
      toast({ title: "Foto gagal diproses", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="rounded-xl border border-border bg-background/40 p-2 space-y-2">
      <div className="flex items-center justify-between border-b border-border pb-1.5">
        <p className="text-[11px] font-bold">💬 {partnerName || (role === "buyer" ? "Penjual" : "Pembeli")}</p>
        {partnerVisitorId && <PresenceStatus target={{ visitorId: partnerVisitorId }} />}
      </div>
      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
        {msgs.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-3">
            Belum ada pesan. Sapa {role === "buyer" ? "penjual" : "pembeli"} di sini 👋
          </p>
        )}
        {msgs.map((m) => {
          const mine = m.sender === role;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-md px-2.5 py-1.5 text-[11px] ${
                mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                {m.image_url && <a href={m.image_url} target="_blank" rel="noreferrer"><img src={m.image_url} alt="Foto chat" className="max-h-48 max-w-full rounded object-contain" /></a>}
                {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
                <p className={`mt-0.5 flex items-center justify-end gap-1 text-[9px] ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  {mine && (m.read_at ? <CheckCheck className="h-3 w-3 text-sky-300" aria-label="Dibaca" /> : m.delivered_at ? <CheckCheck className="h-3 w-3" aria-label="Diterima" /> : <Check className="h-3 w-3" aria-label="Terkirim" />)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex gap-1.5">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => sendPhoto(e.target.files?.[0])} />
        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" aria-label="Kirim foto" title="Kirim foto" onClick={() => fileRef.current?.click()} disabled={sending}><ImagePlus className="h-4 w-4" /></Button>
        <Input className="h-8 text-xs" placeholder="Tulis pesan..." value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }} maxLength={500} />
        <Button size="icon" className="h-8 w-8 shrink-0" aria-label="Kirim pesan" onClick={() => send()} disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

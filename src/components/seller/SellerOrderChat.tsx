import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

/** Chat pembeli <-> penjual untuk satu pesanan */
export default function SellerOrderChat({
  orderId,
  visitorId,
  role,
}: {
  orderId: string;
  visitorId: string;
  role: "buyer" | "seller";
}) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase
      .from("seller_order_messages" as any)
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    setMsgs((data as any[]) || []);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`seller-order-chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seller_order_messages", filter: `order_id=eq.${orderId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    setText("");
    await supabase.from("seller_order_messages" as any).insert({
      order_id: orderId, sender: role, visitor_id: visitorId, message: t,
    } as any);
    setSending(false);
    load();
  }

  return (
    <div className="rounded-xl border border-border bg-background/40 p-2 space-y-2">
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
              <div className={`max-w-[78%] rounded-xl px-2.5 py-1.5 text-[11px] ${
                mine ? "bg-teal-500/20 border border-teal-400/30" : "bg-muted/60 border border-border"
              }`}>
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {m.sender === "buyer" ? "Pembeli" : "Penjual"} ·{" "}
                  {new Date(m.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex gap-1.5">
        <Input className="h-8 text-xs" placeholder="Tulis pesan..." value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }} maxLength={500} />
        <Button size="sm" className="h-8" onClick={send} disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

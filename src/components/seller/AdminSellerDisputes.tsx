import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

/** Admin: laporan kendala pesanan penjual + chat bertiga + keputusan dana */
export default function AdminSellerDisputes() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const { data } = await supabase.from("seller_disputes" as any).select("*").order("created_at", { ascending: false }).limit(50);
    setList((data as any[]) || []);
  }
  async function loadMsgs(id: string) {
    const { data } = await supabase.from("seller_dispute_messages" as any).select("*").eq("dispute_id", id).order("created_at");
    setMsgs((data as any[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function send(id: string) {
    if (!text.trim()) return;
    const { error } = await supabase.from("seller_dispute_messages" as any).insert({ dispute_id: id, sender: "admin", message: text.trim() } as any);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    setText(""); loadMsgs(id);
  }
  async function resolve(id: string, decision: "refund" | "release") {
    const { data, error } = await supabase.functions.invoke("seller-shop", { body: { action: "resolve", disputeId: id, decision, note } });
    if (error || data?.error) return toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
    toast({ title: decision === "refund" ? "Saldo dikembalikan ke pembeli" : "Dana diteruskan ke penjual" });
    setNote(""); load(); loadMsgs(id);
  }

  return (
    <Card><CardContent className="p-3 space-y-2">
      <h3 className="text-sm font-black">🚩 Laporan Kendala Pesanan</h3>
      {list.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Belum ada laporan.</p>}
      {list.map((d) => (
        <div key={d.id} className="rounded-xl border p-2 space-y-2">
          <button className="w-full text-left" onClick={() => { const n = open === d.id ? null : d.id; setOpen(n); if (n) loadMsgs(n); }}>
            <div className="flex justify-between gap-2"><p className="text-xs font-bold">Laporan #{d.dispute_number}</p><Badge variant="outline" className="text-[9px]">{d.status}</Badge></div>
            <p className="text-[11px] text-muted-foreground line-clamp-2">{d.reason}</p>
          </button>
          {open === d.id && <div className="space-y-2">
            <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg bg-muted/30 p-2">
              {msgs.map((m) => <p key={m.id} className="text-[11px]"><b>{m.sender === "admin" ? "Admin" : m.sender === "seller" ? "Penjual" : "Pembeli"}:</b> {m.message}</p>)}
            </div>
            <div className="flex gap-1"><Input className="h-8 text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="Balas sebagai admin..." />
              <Button size="icon" className="h-8 w-8" onClick={() => send(d.id)}><Send className="w-3.5 h-3.5" /></Button></div>
            {d.status === "open" && <>
              <Input className="h-8 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan keputusan (opsional)" />
              <div className="grid grid-cols-2 gap-1">
                <Button size="sm" variant="destructive" className="text-[10px]" onClick={() => resolve(d.id, "refund")}>Kembalikan ke pembeli</Button>
                <Button size="sm" className="text-[10px]" onClick={() => resolve(d.id, "release")}>Teruskan ke penjual</Button>
              </div>
            </>}
          </div>}
        </div>
      ))}
    </CardContent></Card>
  );
}

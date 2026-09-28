import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Check, X, RefreshCw } from "lucide-react";
import { useMarketSignal } from "@/hooks/useMarketSignal";

// Tinjau permintaan ganti nama toko dari seller (ACC / tolak).
export default function AdminRenameRequests() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("seller-shop", { body: { action: "admin_renames", visitorId: "admin" } });
      if (data?.requests) setRows(data.requests);
    } catch { /* abaikan */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useMarketSignal(["admin"], load);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("seller-shop", {
        body: { action: "rename_decide", visitorId: "admin", requestId: id, decision, note: notes[id]?.trim() || null },
      });
      const msg = data?.error || error?.message;
      if (msg) throw new Error(msg);
      toast({ title: decision === "approve" ? "✅ Nama disetujui" : "❌ Ditolak" });
      await load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  }

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <section className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black flex items-center gap-1.5">
          <Pencil className="w-4 h-4 text-teal-400" /> Permintaan Ganti Nama Toko
          {pending.length > 0 && <Badge className="bg-yellow-500 text-yellow-950">{pending.length} baru</Badge>}
        </p>
        <Button size="sm" variant="outline" className="h-7" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>
      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
        rows.length === 0 ? <p className="text-[11px] text-muted-foreground">Belum ada permintaan.</p> : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border bg-background/40 p-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold truncate">{r.store_name} → <span className="text-teal-300">{r.new_name}</span></p>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${
                    r.status === "approved" ? "text-emerald-400 border-emerald-500/30"
                      : r.status === "rejected" ? "text-rose-400 border-rose-500/30"
                        : "text-yellow-400 border-yellow-500/30"}`}>
                    {r.status === "approved" ? "✅ Disetujui" : r.status === "rejected" ? "❌ Ditolak" : "⏳ Menunggu"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("id-ID")}{r.reason ? ` · Alasan: ${r.reason}` : ""}
                </p>
                {r.admin_note && <p className="text-[10px] text-rose-300">Catatan: {r.admin_note}</p>}
                {r.status === "pending" && (
                  <div className="flex gap-1.5">
                    <Input className="h-7 text-[11px]" placeholder="Catatan (opsional)" value={notes[r.id] || ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))} maxLength={120} />
                    <Button size="sm" className="h-7 px-2" disabled={busy === r.id} onClick={() => decide(r.id, "approve")}>
                      {busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 px-2" disabled={busy === r.id} onClick={() => decide(r.id, "reject")}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

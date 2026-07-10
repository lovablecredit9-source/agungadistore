import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bot, Power, Save, Loader2, Send, RefreshCw, Trash2, CheckCircle2, Clock, XCircle } from "lucide-react";

interface OutboxRow {
  id: string;
  phone: string;
  message: string;
  status: string;
  source: string;
  created_at: string;
  sent_at: string | null;
  error: string | null;
}

const KEYS = ["bot_enabled", "bot_offline_message", "bot_ticket_reply_prefix"] as const;

export default function AdminBotTab() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [offlineMsg, setOfflineMsg] = useState("");
  const [replyPrefix, setReplyPrefix] = useState("");
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: settings } = await supabase.from("admin_settings").select("setting_key, setting_value").in("setting_key", KEYS as unknown as string[]);
    const map = Object.fromEntries((settings ?? []).map((s: any) => [s.setting_key, s.setting_value]));
    setEnabled((map.bot_enabled ?? "true") !== "false");
    setOfflineMsg(map.bot_offline_message ?? "");
    setReplyPrefix(map.bot_ticket_reply_prefix ?? "");
    const { data: ob } = await supabase.from("wa_outbox").select("*").order("created_at", { ascending: false }).limit(50);
    setOutbox((ob as OutboxRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveKey = async (key: string, value: string) =>
    supabase.from("admin_settings").upsert({ setting_key: key, setting_value: value } as any, { onConflict: "setting_key" });

  const toggleBot = async () => {
    const next = !enabled;
    setEnabled(next);
    await saveKey("bot_enabled", next ? "true" : "false");
    toast({ title: next ? "🟢 Bot dinyalakan" : "🔴 Bot dimatikan" });
  };

  const saveMessages = async () => {
    setSaving(true);
    await Promise.all([
      saveKey("bot_offline_message", offlineMsg),
      saveKey("bot_ticket_reply_prefix", replyPrefix),
    ]);
    setSaving(false);
    toast({ title: "✅ Setelan bot disimpan" });
  };

  const clearSent = async () => {
    await supabase.from("wa_outbox").delete().eq("status", "sent");
    toast({ title: "🧹 Antrian terkirim dibersihkan" });
    load();
  };

  const statusBadge = (s: string) =>
    s === "sent" ? <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-600"><CheckCircle2 className="w-3 h-3" /> Terkirim</span>
    : s === "failed" ? <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600"><XCircle className="w-3 h-3" /> Gagal</span>
    : <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600"><Clock className="w-3 h-3" /> Menunggu</span>;

  const pending = outbox.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Status bot */}
      <Card className={enabled ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"}>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${enabled ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}>
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-sm">Bot WhatsApp {enabled ? "AKTIF" : "MATI"}</p>
              <p className="text-[11px] text-muted-foreground">{enabled ? "Bot melayani pesan otomatis" : "Bot berhenti membalas otomatis"}</p>
            </div>
          </div>
          <Button onClick={toggleBot} variant={enabled ? "destructive" : "default"} className="gap-1.5 font-bold rounded-xl">
            <Power className="w-4 h-4" /> {enabled ? "Matikan" : "Nyalakan"}
          </Button>
        </CardContent>
      </Card>

      {/* Edit pesan bot */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-bold text-sm flex items-center gap-1.5"><Bot className="w-4 h-4 text-primary" /> Edit Pesan Bot</p>
          <div>
            <Label className="text-xs">Pesan saat bot OFFLINE</Label>
            <Textarea value={offlineMsg} onChange={(e) => setOfflineMsg(e.target.value)} rows={3} placeholder="Pesan otomatis ketika bot dimatikan..." />
          </div>
          <div>
            <Label className="text-xs">Awalan balasan tiket ke WhatsApp</Label>
            <Textarea value={replyPrefix} onChange={(e) => setReplyPrefix(e.target.value)} rows={2} placeholder="Gunakan {ticket} untuk nomor tiket" />
            <p className="text-[10px] text-muted-foreground mt-1">Gunakan <code>{"{ticket}"}</code> untuk menyisipkan nomor tiket.</p>
          </div>
          <Button onClick={saveMessages} disabled={saving} className="w-full gap-1.5 font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Setelan
          </Button>
        </CardContent>
      </Card>

      {/* Antrian pesan keluar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-1.5"><Send className="w-4 h-4 text-primary" /> Antrian WA Keluar
              {pending > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-black">{pending} menunggu</span>}
            </p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={load} className="h-8 w-8 p-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSent} className="h-8 gap-1 text-xs"><Trash2 className="w-3.5 h-3.5" /> Bersihkan</Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Setiap balasan tiket admin otomatis masuk antrian & dikirim bot ke WhatsApp user.</p>
          <div className="space-y-1.5">
            {outbox.map((o) => (
              <div key={o.id} className="rounded-xl border bg-card p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold">{o.phone}</span>
                  {statusBadge(o.status)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{o.message}</p>
                <p className="text-[9px] text-muted-foreground mt-1">{o.source} · {new Date(o.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                {o.error && <p className="text-[9px] text-red-500 mt-0.5">⚠ {o.error}</p>}
              </div>
            ))}
            {outbox.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Belum ada pesan di antrian</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

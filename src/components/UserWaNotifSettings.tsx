import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Save, Send, MessageSquare, ShoppingCart, LogIn, Wallet,
  Phone, Bell, History, Settings2, CheckCircle2, XCircle,
} from "lucide-react";

type Pref = {
  wa_number: string;
  notify_purchase: boolean;
  notify_login: boolean;
  notify_deposit: boolean;
};

type LogRow = {
  id: string;
  event_type: string;
  status: string;
  wa_number: string | null;
  created_at: string;
  text: string | null;
};

const EVENTS = [
  { key: "notify_purchase", label: "Pembelian Produk", icon: ShoppingCart, color: "from-emerald-500 to-teal-500", desc: "Notif tiap kamu beli produk pakai saldo/token." },
  { key: "notify_login", label: "Login Akun", icon: LogIn, color: "from-sky-500 to-blue-500", desc: "Notif tiap akun saldo kamu login (keamanan)." },
  { key: "notify_deposit", label: "Deposit & Pembatalan", icon: Wallet, color: "from-amber-500 to-orange-500", desc: "Notif saat deposit dibuat / dibatalkan." },
] as const;

function normalizePhone(raw: string) {
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("8")) p = "62" + p;
  return p;
}

export default function UserWaNotifSettings() {
  const [visitorId, setVisitorId] = useState<string>("");
  const [pref, setPref] = useState<Pref>({
    wa_number: "",
    notify_purchase: true,
    notify_login: true,
    notify_deposit: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [tab, setTab] = useState("akun");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const vid = getVisitorId();
      setVisitorId(vid);
      const { data } = await supabase
        .from("user_wa_notif_prefs" as any)
        .select("wa_number, notify_purchase, notify_login, notify_deposit")
        .eq("visitor_id", vid)
        .maybeSingle();
      if (data) setPref(data as any);
      setLoading(false);
    })();
  }, []);

  const loadLogs = async () => {
    if (!visitorId) return;
    setLogsLoading(true);
    const { data } = await supabase
      .from("wa_notification_queue" as any)
      .select("id, event_type, status, wa_number, created_at, text")
      .eq("notify_visitor_id", visitorId)
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs((data as any) || []);
    setLogsLoading(false);
  };

  useEffect(() => {
    if (tab === "riwayat") loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, visitorId]);

  const save = async () => {
    const phone = normalizePhone(pref.wa_number);
    if (phone && phone.length < 10) {
      toast.error("Nomor WA tidak valid");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("user_wa_notif_prefs" as any)
      .upsert({
        visitor_id: visitorId,
        wa_number: phone,
        notify_purchase: pref.notify_purchase,
        notify_login: pref.notify_login,
        notify_deposit: pref.notify_deposit,
      }, { onConflict: "visitor_id" });
    setSaving(false);
    if (error) toast.error("Gagal: " + error.message);
    else {
      toast.success("Pengaturan tersimpan ✓");
      setPref(p => ({ ...p, wa_number: phone }));
    }
  };

  const removeNumber = async () => {
    if (!confirm("Hapus nomor WA & matikan semua notif?")) return;
    setSaving(true);
    await supabase.from("user_wa_notif_prefs" as any).delete().eq("visitor_id", visitorId);
    setPref({ wa_number: "", notify_purchase: false, notify_login: false, notify_deposit: false });
    setSaving(false);
    toast.success("Nomor dihapus");
  };

  const testKirim = async (eventKey: "purchase" | "login" | "deposit") => {
    const phone = normalizePhone(pref.wa_number);
    if (!phone || phone.length < 10) {
      toast.error("Isi & simpan nomor WA dulu");
      return;
    }
    setTesting(eventKey);
    const labelMap = { purchase: "Pembelian", login: "Login", deposit: "Deposit" };
    const { data, error } = await supabase.functions.invoke("send-wa-notification", {
      body: {
        event_type: eventKey,
        notify_visitor_id: visitorId,
        wa_number: "0",
        text: `🔔 *Test Notif ${labelMap[eventKey]}*\n\nNotif WA kamu untuk *${labelMap[eventKey]}* berjalan normal ✓\n\n— Agung Adi Store`,
        vars: {},
      },
    });
    setTesting(null);
    if (error || (data as any)?.error) {
      toast.error("Gagal: " + (error?.message || (data as any)?.error));
    } else {
      toast.success("Test terkirim ke " + phone);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const hasNumber = !!normalizePhone(pref.wa_number);
  const activeCount = EVENTS.filter(e => pref[e.key]).length;

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-green-500/15 via-emerald-500/10 to-teal-500/5 border border-green-500/20">
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-green-500/20 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-lg shadow-green-500/30">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base">Notifikasi Bot WhatsApp</h3>
              {hasNumber ? (
                <Badge className="bg-green-500/20 text-green-700 border-green-500/30 text-[10px] gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Aktif
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <XCircle className="w-3 h-3" /> Belum diset
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {hasNumber
                ? `Bot kirim ke +${pref.wa_number} • ${activeCount}/3 event aktif`
                : "Set nomor WA kamu di tab Akun untuk mulai terima notif."}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="akun" className="flex flex-col gap-0.5 py-2 text-[10px] data-[state=active]:bg-background">
            <Phone className="w-4 h-4" /> Akun
          </TabsTrigger>
          <TabsTrigger value="event" className="flex flex-col gap-0.5 py-2 text-[10px] data-[state=active]:bg-background">
            <Settings2 className="w-4 h-4" /> Event
          </TabsTrigger>
          <TabsTrigger value="test" className="flex flex-col gap-0.5 py-2 text-[10px] data-[state=active]:bg-background">
            <Send className="w-4 h-4" /> Test
          </TabsTrigger>
          <TabsTrigger value="riwayat" className="flex flex-col gap-0.5 py-2 text-[10px] data-[state=active]:bg-background">
            <History className="w-4 h-4" /> Log
          </TabsTrigger>
        </TabsList>

        {/* AKUN */}
        <TabsContent value="akun" className="mt-3">
          <Card className="p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Nomor WhatsApp Kamu
              </label>
              <Input
                value={pref.wa_number}
                onChange={(e) => setPref(p => ({ ...p, wa_number: e.target.value }))}
                placeholder="08xxxxxxxxxx atau 628xxxxxxxxxx"
                inputMode="numeric"
                className="font-mono mt-1"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Format 08xx otomatis dikonversi ke 628xx. Min 10 digit.
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving} className="flex-1 gap-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan
              </Button>
              {hasNumber && (
                <Button onClick={removeNumber} disabled={saving} variant="outline" className="text-destructive">
                  Hapus
                </Button>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* EVENT */}
        <TabsContent value="event" className="mt-3 space-y-2">
          {EVENTS.map(ev => {
            const Icon = ev.icon;
            return (
              <Card key={ev.key} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${ev.color} flex items-center justify-center shrink-0 shadow-sm`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{ev.label}</div>
                      <div className="text-[11px] text-muted-foreground">{ev.desc}</div>
                    </div>
                  </div>
                  <Switch
                    checked={pref[ev.key] as boolean}
                    onCheckedChange={(v) => setPref(p => ({ ...p, [ev.key]: v }))}
                  />
                </div>
              </Card>
            );
          })}
          <Button onClick={save} disabled={saving} className="w-full gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Pengaturan Event
          </Button>
        </TabsContent>

        {/* TEST */}
        <TabsContent value="test" className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground px-1">
            Kirim pesan tes ke nomor WA kamu untuk tiap jenis event.
          </p>
          {EVENTS.map(ev => {
            const Icon = ev.icon;
            const key = ev.key.replace("notify_", "") as "purchase" | "login" | "deposit";
            return (
              <Card key={ev.key} className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${ev.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{ev.label}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasNumber || testing === key}
                  onClick={() => testKirim(key)}
                  className="gap-1"
                >
                  {testing === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Kirim
                </Button>
              </Card>
            );
          })}
        </TabsContent>

        {/* RIWAYAT */}
        <TabsContent value="riwayat" className="mt-3">
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Riwayat Notif (20 terakhir)
              </div>
              <Button size="sm" variant="ghost" onClick={loadLogs} className="h-7 text-[11px]">
                Refresh
              </Button>
            </div>
            {logsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-6 text-[11px] text-muted-foreground">
                <MessageSquare className="w-6 h-6 mx-auto mb-1 opacity-40" />
                Belum ada riwayat notif.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {logs.map(l => (
                  <div key={l.id} className="text-[11px] p-2 rounded-lg bg-muted/40 border">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize">{l.event_type}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          l.status === "sent" ? "border-green-500/40 text-green-700" :
                          l.status === "failed" ? "border-red-500/40 text-red-700" :
                          "border-yellow-500/40 text-yellow-700"
                        }`}
                      >
                        {l.status}
                      </Badge>
                    </div>
                    {l.text && (
                      <div className="text-muted-foreground line-clamp-2 mt-1">{l.text}</div>
                    )}
                    <div className="text-[9px] text-muted-foreground mt-1">
                      {new Date(l.created_at).toLocaleString("id-ID")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
  Phone, Bell, History, Settings2, CheckCircle2, XCircle, Plus, Trash2,
  Crown, Lock, CreditCard, QrCode, X,
} from "lucide-react";

type WaNumber = {
  id: string;
  wa_number: string;
  label: string;
  notify_purchase: boolean;
  notify_login: boolean;
  notify_deposit: boolean;
  is_paid: boolean;
  paid_until: string | null;
  slot_index: number;
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
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [tab, setTab] = useState("nomor");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySlotIndex, setPaySlotIndex] = useState(3);
  const [payMethod, setPayMethod] = useState<"balance" | "qris">("balance");
  const [payPin, setPayPin] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    (async () => {
      const vid = getVisitorId();
      setVisitorId(vid);
      await loadNumbers(vid);
      setLoading(false);
    })();
  }, []);

  const loadNumbers = async (vid?: string) => {
    const id = vid || visitorId;
    if (!id) return;
    const { data } = await supabase
      .from("user_wa_notif_numbers" as any)
      .select("id, wa_number, label, notify_purchase, notify_login, notify_deposit, is_paid, paid_until, slot_index")
      .eq("visitor_id", id)
      .order("slot_index", { ascending: true });
    setNumbers((data as any) || []);
  };

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

  const getNextFreeSlot = () => {
    const used = new Set(numbers.map((n) => n.slot_index));
    for (let i = 1; i <= 2; i++) if (!used.has(i)) return i;
    return null;
  };

  const getNextPaidSlot = () => {
    const used = new Set(numbers.map((n) => n.slot_index));
    for (let i = 3; i <= 5; i++) if (!used.has(i)) return i;
    return null;
  };

  const isSlotPaid = (slotIndex: number) => slotIndex >= 3;

  const addFreeNumber = async () => {
    const phone = normalizePhone(newPhone);
    if (!phone || phone.length < 10) {
      toast.error("Nomor WA tidak valid");
      return;
    }
    const nextSlot = getNextFreeSlot();
    if (!nextSlot) {
      toast.error("Slot gratis penuh. Beli slot tambahan.");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("user_wa_notif_numbers" as any).insert({
      visitor_id: visitorId,
      wa_number: phone,
      label: newLabel || `Slot ${nextSlot}`,
      slot_index: nextSlot,
      is_paid: false,
    });
    setAdding(false);
    if (error) toast.error("Gagal: " + error.message);
    else {
      toast.success("Nomor ditambahkan ✓");
      setNewPhone("");
      setNewLabel("");
      setShowAddModal(false);
      await loadNumbers();
    }
  };

  const payForSlot = async () => {
    const phone = normalizePhone(newPhone);
    if (!phone || phone.length < 10) {
      toast.error("Nomor WA tidak valid");
      return;
    }
    setPaying(true);
    const { data, error } = await supabase.functions.invoke("wa-slot-purchase", {
      body: {
        visitorId,
        waNumber: phone,
        slotIndex: paySlotIndex,
        method: payMethod,
        pin: payPin,
      },
    });
    setPaying(false);
    if (error || (data as any)?.error) {
      toast.error("Gagal: " + (error?.message || (data as any)?.error));
    } else {
      toast.success(`Slot #${paySlotIndex} berhasil dibeli!`);
      setNewPhone("");
      setNewLabel("");
      setPayPin("");
      setShowPayModal(false);
      await loadNumbers();
    }
  };

  const removeNumber = async (id: string) => {
    if (!confirm("Hapus nomor ini?")) return;
    setSaving(true);
    await supabase.from("user_wa_notif_numbers" as any).delete().eq("id", id);
    setSaving(false);
    toast.success("Nomor dihapus");
    await loadNumbers();
  };

  const updateToggle = (id: string, field: string, value: boolean) => {
    setNumbers((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)));
  };

  const saveNumberSettings = async (num: WaNumber) => {
    setSaving(true);
    const { error } = await supabase
      .from("user_wa_notif_numbers" as any)
      .update({
        notify_purchase: num.notify_purchase,
        notify_login: num.notify_login,
        notify_deposit: num.notify_deposit,
        label: num.label,
      })
      .eq("id", num.id);
    setSaving(false);
    if (error) toast.error("Gagal: " + error.message);
    else toast.success("Pengaturan tersimpan ✓");
  };

  const testKirim = async (num: WaNumber, eventKey: "purchase" | "login" | "deposit") => {
    setTesting(eventKey + num.id);
    const labelMap = { purchase: "Pembelian", login: "Login", deposit: "Deposit" };
    const { data, error } = await supabase.functions.invoke("send-wa-notification", {
      body: {
        event_type: eventKey,
        notify_visitor_id: visitorId,
        wa_number: "0",
        text: `*Test Notif ${labelMap[eventKey]}*\n\nNotif WA untuk *${labelMap[eventKey]}* berjalan normal.\n\n— Agung Adi Store`,
        vars: {},
      },
    });
    setTesting(null);
    if (error || (data as any)?.error) {
      toast.error("Gagal: " + (error?.message || (data as any)?.error));
    } else {
      toast.success("Test terkirim ke +" + num.wa_number);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const totalNumbers = numbers.length;
  const freeSlotsUsed = numbers.filter((n) => !n.is_paid).length;
  const paidSlotsUsed = numbers.filter((n) => n.is_paid).length;
  const hasFreeSlot = freeSlotsUsed < 2;
  const hasPaidSlot = paidSlotsUsed < 3;

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
              {totalNumbers > 0 ? (
                <Badge className="bg-green-500/20 text-green-700 border-green-500/30 text-[10px] gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {totalNumbers} Nomor
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <XCircle className="w-3 h-3" /> Belum diset
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalNumbers > 0
                ? `${freeSlotsUsed}/2 gratis • ${paidSlotsUsed}/3 berbayar`
                : "Tambah nomor WA untuk terima notif otomatis."}
            </p>
          </div>
        </div>
      </div>

      {/* Add buttons */}
      <div className="flex gap-2">
        {hasFreeSlot && (
          <Button onClick={() => { setShowAddModal(true); setShowPayModal(false); }} variant="outline" className="flex-1 gap-1 text-[11px]">
            <Plus className="w-3.5 h-3.5" /> Tambah Nomor (Gratis)
          </Button>
        )}
        {hasPaidSlot && (
          <Button onClick={() => { setShowPayModal(true); setShowAddModal(false); }} className="flex-1 gap-1 text-[11px] bg-amber-500 hover:bg-amber-600">
            <Crown className="w-3.5 h-3.5" /> Beli Slot (Rp 5.000)
          </Button>
        )}
      </div>

      {/* Navigation tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="nomor" className="flex flex-col gap-0.5 py-2 text-[10px] data-[state=active]:bg-background">
            <Phone className="w-4 h-4" /> Nomor ({totalNumbers})
          </TabsTrigger>
          <TabsTrigger value="test" className="flex flex-col gap-0.5 py-2 text-[10px] data-[state=active]:bg-background">
            <Send className="w-4 h-4" /> Test
          </TabsTrigger>
          <TabsTrigger value="riwayat" className="flex flex-col gap-0.5 py-2 text-[10px] data-[state=active]:bg-background">
            <History className="w-4 h-4" /> Log
          </TabsTrigger>
        </TabsList>

        {/* NOMOR */}
        <TabsContent value="nomor" className="mt-3 space-y-3">
          {numbers.length === 0 ? (
            <Card className="p-6 text-center">
              <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Belum ada nomor</p>
              <p className="text-[11px] text-muted-foreground mt-1">Tambah nomor WA untuk mulai terima notif.</p>
            </Card>
          ) : (
            numbers.map((num) => {
              const activeCount = EVENTS.filter((e) => num[e.key]).length;
              const isExpired = num.is_paid && num.paid_until && new Date(num.paid_until) < new Date();
              return (
                <Card key={num.id} className={`p-3 space-y-2 ${isExpired ? "opacity-60 border-amber-500/30" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold flex items-center gap-1.5">
                          +{num.wa_number}
                          {num.is_paid ? (
                            <Badge className="text-[9px] bg-amber-500/20 text-amber-700 border-amber-500/30 gap-0.5">
                              <Crown className="w-2.5 h-2.5" /> Berbayar
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Gratis
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {num.label} • Slot #{num.slot_index} • {activeCount}/3 event aktif
                          {num.is_paid && num.paid_until && (
                            <span className={isExpired ? " text-amber-600 font-medium" : ""}>
                              {" "}• {isExpired ? "Expired" : "Aktif s/d " + new Date(num.paid_until).toLocaleDateString("id-ID")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeNumber(num.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {EVENTS.map((ev) => {
                      const Icon = ev.icon;
                      return (
                        <div key={ev.key} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[11px]">{ev.label}</span>
                          </div>
                          <Switch
                            checked={num[ev.key] as boolean}
                            onCheckedChange={(v) => updateToggle(num.id, ev.key, v)}
                            className="scale-75"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <Button onClick={() => saveNumberSettings(num)} disabled={saving} size="sm" className="w-full gap-1 text-[11px]">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Simpan Pengaturan
                  </Button>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* TEST */}
        <TabsContent value="test" className="mt-3 space-y-3">
          {numbers.length === 0 ? (
            <Card className="p-6 text-center">
              <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Tambah nomor dulu</p>
              <p className="text-[11px] text-muted-foreground mt-1">Belum ada nomor WA yang terdaftar.</p>
            </Card>
          ) : (
            numbers.map((num) => (
              <Card key={num.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold">+{num.wa_number}</span>
                  <Badge variant="outline" className="text-[9px]">{num.label}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {EVENTS.map((ev) => {
                    const key = ev.key.replace("notify_", "") as "purchase" | "login" | "deposit";
                    const isActive = num[ev.key];
                    return (
                      <Button
                        key={ev.key}
                        size="sm"
                        variant={isActive ? "default" : "outline"}
                        disabled={!isActive || testing === key + num.id}
                        onClick={() => testKirim(num, key)}
                        className="gap-1 text-[10px]"
                      >
                        {testing === key + num.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {ev.label.split(" ")[0]}
                      </Button>
                    );
                  })}
                </div>
              </Card>
            ))
          )}
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
                {logs.map((l) => (
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

      {/* Add Free Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAddModal(false)}>
          <Card className="w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Tambah Nomor (Gratis)</h3>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nomor WhatsApp</label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                inputMode="numeric"
                className="font-mono mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Label (opsional)</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Contoh: Pribadi, Bisnis"
                className="mt-1"
              />
            </div>
            <Button onClick={addFreeNumber} disabled={adding} className="w-full gap-1">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Tambah Nomor
            </Button>
          </Card>
        </div>
      )}

      {/* Pay Slot Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPayModal(false)}>
          <Card className="w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Beli Slot Berbayar</h3>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowPayModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Slot 3-5: Rp 5.000/bulan per nomor.</p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Nomor WhatsApp</label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                inputMode="numeric"
                className="font-mono mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Slot</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[3, 4, 5].map((s) => {
                  const used = numbers.some((n) => n.slot_index === s);
                  return (
                    <button
                      key={s}
                      onClick={() => !used && setPaySlotIndex(s)}
                      disabled={used}
                      className={`text-center py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        paySlotIndex === s
                          ? "bg-amber-500 text-white border-amber-500"
                          : used
                          ? "bg-muted text-muted-foreground border-muted cursor-not-allowed"
                          : "bg-background border-border hover:border-amber-500"
                      }`}
                    >
                      #{s} {used && "(Used)"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Metode Bayar</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => setPayMethod("balance")}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    payMethod === "balance" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" /> Saldo
                </button>
                <button
                  onClick={() => setPayMethod("qris")}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    payMethod === "qris" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" /> QRIS
                </button>
              </div>
            </div>
            {payMethod === "balance" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground">PIN 6 Digit</label>
                <Input
                  value={payPin}
                  onChange={(e) => setPayPin(e.target.value)}
                  placeholder="******"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  className="font-mono mt-1 text-center tracking-widest"
                />
              </div>
            )}
            <Button onClick={payForSlot} disabled={paying} className="w-full gap-1 bg-amber-500 hover:bg-amber-600">
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              Bayar Rp 5.000
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

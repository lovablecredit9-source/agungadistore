import { useEffect, useState, useCallback } from "react";
import { Send, Loader2, Plus, X, MessageSquareWarning, Lock, History as HistoryIcon, Phone, User as UserIcon, RefreshCw, CheckCircle2, Clock, XCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function priceFor(n: number) {
  if (n <= 1) return 2000;
  if (n === 2) return 4000;
  return 5000;
}
const rupiah = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

interface Confession {
  id: string;
  trx_id: string;
  sender_name: string | null;
  message: string;
  num_targets: number;
  total_price: number;
  status: string;
  created_at: string;
  confession_targets: Array<{ id: string; phone: string; status: string; sent_at: string | null }>;
  confession_replies: Array<{ id: string; from_phone: string; reply_text: string; created_at: string }>;
}

export default function ConfessTab() {
  const visitorId = (typeof window !== "undefined" && localStorage.getItem("balance_visitor_id")) || getVisitorId();
  const [phones, setPhones] = useState<string[]>([""]);
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Confession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Confession | null>(null);

  const total = priceFor(phones.filter((p) => p.trim()).length || 1);

  const loadHistory = useCallback(async () => {
    setRefreshing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confessions_by_visitor&visitor_id=${encodeURIComponent(visitorId)}`;
      const res = await fetch(url, { headers: { "x-api-key": "ak_cyOMDUl6h3mX8gsVUw5RoUhQDfo1bYNywUNtj0le" } });
      const j = await res.json();
      if (j?.data) setHistory(j.data);
    } catch {} finally { setRefreshing(false); }
  }, [visitorId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const ch = supabase
      .channel("confess-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "confession_replies" }, () => loadHistory())
      .on("postgres_changes", { event: "*", schema: "public", table: "confession_targets" }, () => loadHistory())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadHistory]);

  async function submit() {
    const clean = phones.map((p) => p.trim()).filter(Boolean);
    if (clean.length < 1) return toast({ title: "Isi minimal 1 nomor WA tujuan", variant: "destructive" });
    if (clean.length > 3) return toast({ title: "Maksimal 3 nomor", variant: "destructive" });
    if (message.trim().length < 3) return toast({ title: "Pesan terlalu pendek", variant: "destructive" });
    if (!/^\d{6}$/.test(pin)) { setShowPin(true); return toast({ title: "Masukkan PIN 6 digit", variant: "destructive" }); }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-confession", {
        body: { visitorId, senderName: senderName.trim(), message: message.trim(), phones: clean, pin },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "✉️ Confess dikirim!", description: `${clean.length} nomor • ${rupiah(total)} • TX ${(data as any).trx_id}` });
      setMessage(""); setPhones([""]); setSenderName(""); setPin(""); setShowPin(false);
      loadHistory();
    } catch (e: any) {
      const msg = e?.message || "Gagal kirim";
      if (/PIN/i.test(msg)) setShowPin(true);
      toast({ title: "Gagal", description: msg, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-[2px] bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 shadow-xl">
        <div className="rounded-[14px] bg-background/95 backdrop-blur p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg">
              <MessageSquareWarning className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-lg leading-tight bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 bg-clip-text text-transparent">Confess Anonim</h2>
              <p className="text-[11px] text-muted-foreground">Kirim pesan rahasia ke nomor WhatsApp via bot 💌</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`rounded-xl border p-2.5 ${phones.filter((p) => p.trim()).length === n ? "border-pink-500 bg-pink-500/5" : ""}`}>
            <div className="text-[10px] text-muted-foreground">{n} nomor</div>
            <div className="font-bold text-sm">{rupiah(priceFor(n))}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><UserIcon className="w-3.5 h-3.5" /> Nama Pengirim (opsional)</label>
          <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Kosongkan = Anonim" maxLength={40} />
        </div>

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Phone className="w-3.5 h-3.5" /> Nomor WA Tujuan (1-3)</label>
          <div className="space-y-2">
            {phones.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input value={p} onChange={(e) => { const a = [...phones]; a[i] = e.target.value; setPhones(a); }} placeholder="08xxxxxxxxxx" inputMode="numeric" />
                {phones.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setPhones(phones.filter((_, j) => j !== i))}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {phones.length < 3 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setPhones([...phones, ""])} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Nomor
              </Button>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><MessageCircle className="w-3.5 h-3.5" /> Pesan Confess</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tulis pesan confess kamu…" rows={4} maxLength={800} />
          <div className="text-[10px] text-right text-muted-foreground mt-1">{message.length}/800</div>
        </div>

        {showPin && (
          <div>
            <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Lock className="w-3.5 h-3.5" /> PIN 6 Digit</label>
            <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="••••••" maxLength={6} />
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <div className="text-[10px] text-muted-foreground">Total Bayar</div>
            <div className="font-black text-xl bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">{rupiah(total)}</div>
          </div>
          <Button onClick={() => { if (!showPin) { setShowPin(true); return; } submit(); }} disabled={loading} className="rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 hover:opacity-90">
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            {showPin ? "Bayar & Kirim" : "Lanjut Bayar"}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed bg-muted/40 p-2 rounded-lg">
          🤖 Pesan akan dikirim otomatis lewat bot WhatsApp. Penerima bisa balas dengan ketik <b>!balas (isi balasan)</b>, balasan otomatis muncul di riwayat di bawah.
        </p>
      </div>

      {/* History */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><HistoryIcon className="w-4 h-4" /> Riwayat Confess</h3>
          <Button variant="ghost" size="icon" onClick={loadHistory} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Belum ada confess. Kirim yang pertama! 💌</p>
        ) : (
          <div className="space-y-2">
            {history.map((c) => {
              const sentCount = c.confession_targets?.filter((t) => t.status === "sent").length || 0;
              const failedCount = c.confession_targets?.filter((t) => t.status === "failed").length || 0;
              const pendingCount = c.confession_targets?.filter((t) => t.status === "pending").length || 0;
              const replyCount = c.confession_replies?.length || 0;
              return (
                <button key={c.id} onClick={() => setDetail(c)} className="w-full text-left p-3 rounded-xl border hover:border-pink-400 hover:bg-pink-500/5 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[11px] font-mono text-muted-foreground">{c.trx_id}</div>
                    <div className="flex items-center gap-1 text-[10px]">
                      {sentCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{sentCount}</span>}
                      {pendingCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 flex items-center gap-0.5"><Clock className="w-3 h-3" />{pendingCount}</span>}
                      {failedCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 flex items-center gap-0.5"><XCircle className="w-3 h-3" />{failedCount}</span>}
                      {replyCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-pink-500/15 text-pink-600 flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{replyCount}</span>}
                    </div>
                  </div>
                  <p className="text-sm line-clamp-2">{c.message}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">{c.num_targets} nomor • {rupiah(c.total_price)} • dari <b>{c.sender_name || "Anonim"}</b></div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Detail Confess {detail?.trx_id}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-muted/40">
                <div className="text-[10px] text-muted-foreground mb-1">Pesan</div>
                <p className="whitespace-pre-wrap break-words">{detail.message}</p>
                <div className="text-[10px] text-muted-foreground mt-2">Pengirim: <b>{detail.sender_name || "Anonim"}</b></div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-1.5">Nomor Tujuan</div>
                {detail.confession_targets?.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1 text-xs">
                    <span className="font-mono">{t.phone}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${t.status === "sent" ? "bg-green-500/15 text-green-600" : t.status === "failed" ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>{t.status}</span>
                  </div>
                ))}
              </div>
              {detail.confession_replies?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Balasan</div>
                  <div className="space-y-2">
                    {detail.confession_replies.map((r) => (
                      <div key={r.id} className="p-2 rounded-lg bg-pink-500/5 border border-pink-500/20">
                        <div className="text-[10px] text-muted-foreground font-mono">{r.from_phone} • {new Date(r.created_at).toLocaleString("id-ID")}</div>
                        <p className="text-xs whitespace-pre-wrap mt-1">{r.reply_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, Loader2, Save, Trash2, RefreshCw, MessageCircle, ChevronLeft, CheckCircle2, Activity, Link2, BellRing, Wrench, Megaphone } from "lucide-react";

interface TgChat {
  id: string;
  chat_id: string;
  first_name: string;
  last_name: string;
  username: string;
  photo_url: string;
  status: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}
interface TgMessage {
  id: string;
  chat_id: string;
  direction: string;
  text: string;
  created_at: string;
}

export default function AdminTelegramTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [welcome, setWelcome] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [configured, setConfigured] = useState(false);
  const [qrisImageUrl, setQrisImageUrl] = useState("");
  const [qrisCaption, setQrisCaption] = useState("");
  const [uploadingQris, setUploadingQris] = useState(false);
  const [tokenMasked, setTokenMasked] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [bcText, setBcText] = useState("");
  const [bcTarget, setBcTarget] = useState<"all" | "linked" | "announce">("all");
  const [bcBtnText, setBcBtnText] = useState("");
  const [bcBtnUrl, setBcBtnUrl] = useState("");
  const [bcPreview, setBcPreview] = useState<number | null>(null);
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState<any>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [chats, setChats] = useState<TgChat[]>([]);
  const [activeChat, setActiveChat] = useState<TgChat | null>(null);
  const [messages, setMessages] = useState<TgMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("telegram-manage", { body: { action: "get" } });
    const cfg = data?.config;
    if (cfg) {
      setOwnerId(cfg.owner_id || "");
      setEnabled(cfg.enabled ?? true);
      setWelcome(cfg.welcome_message || "");
      setBotUsername(cfg.bot_username || "");
      setQrisImageUrl(cfg.qris_image_url || "");
      setQrisCaption(cfg.qris_caption || "");
      setConfigured(!!cfg.has_token);
      setTokenMasked(cfg.token_masked || "");
      setMaintenance(!!cfg.maintenance_mode);
      setMaintenanceMsg(cfg.maintenance_message || "");
    }
    setLoading(false);
  }, []);

  const loadChats = useCallback(async () => {
    const { data } = await supabase.from("telegram_chats").select("*").order("last_message_at", { ascending: false });
    setChats((data as TgChat[]) || []);
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    const { data } = await supabase.functions.invoke("telegram-manage", { body: { action: "status" } });
    if (data && !data.error) setStatus(data);
    setStatusLoading(false);
  }, []);

  useEffect(() => { loadConfig(); loadChats(); loadStatus(); }, [loadConfig, loadChats, loadStatus]);

  const runAction = async (action: string, extra: Record<string, unknown> = {}, okMsg = "Berhasil") => {
    setBusyAction(action);
    const { data, error } = await supabase.functions.invoke("telegram-manage", { body: { action, ...extra } });
    setBusyAction(null);
    if (error || data?.error) { toast({ title: "Gagal", description: data?.error || "⚠️ Telegram sedang mengalami gangguan. Silakan coba lagi.", variant: "destructive" }); return null; }
    toast({ title: okMsg });
    return data;
  };

  const previewBroadcast = async () => {
    setBcResult(null);
    const d = await runAction("broadcast_preview", { target: bcTarget, text: bcText, button_text: bcBtnText, button_url: bcBtnUrl }, "Pratinjau siap");
    if (d) setBcPreview(d.total);
  };
  const sendBroadcast = async () => {
    if (bcPreview === null) return;
    if (!confirm(`Kirim broadcast ke ${bcPreview} penerima? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBcSending(true);
    const d = await runAction("broadcast_send", { target: bcTarget, text: bcText, button_text: bcBtnText, button_url: bcBtnUrl, confirm: true }, "Broadcast selesai");
    setBcSending(false);
    if (d) { setBcResult(d); setBcPreview(null); loadStatus(); }
  };

  // realtime chats
  useEffect(() => {
    const ch = supabase
      .channel("tg_chats_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_chats" }, () => loadChats())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadChats]);

  // load + realtime messages for active chat
  const loadMessages = useCallback(async (chatId: string) => {
    const { data } = await supabase.from("telegram_messages").select("*").eq("chat_id", chatId).order("created_at");
    setMessages((data as TgMessage[]) || []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    loadMessages(activeChat.chat_id);
    supabase.functions.invoke("telegram-manage", { body: { action: "mark_read", chat_id: activeChat.chat_id } });
    const ch = supabase
      .channel(`tg_msg_${activeChat.chat_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telegram_messages", filter: `chat_id=eq.${activeChat.chat_id}` },
        () => loadMessages(activeChat.chat_id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeChat, loadMessages]);

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQris(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `qris/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-images").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("payment-images").getPublicUrl(path);
      setQrisImageUrl(pub.publicUrl);
      toast({ title: "✅ Gambar QRIS diunggah", description: "Klik Simpan untuk mengaktifkan." });
    } catch (err) {
      toast({ title: "Gagal unggah", description: err instanceof Error ? err.message : "Coba lagi", variant: "destructive" });
    } finally {
      setUploadingQris(false);
      e.target.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("telegram-manage", {
      body: { action: "save", bot_token: token || undefined, owner_id: ownerId, enabled, welcome_message: welcome, qris_image_url: qrisImageUrl, qris_caption: qrisCaption, maintenance_mode: maintenance, maintenance_message: maintenanceMsg },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || "Gagal menyimpan", variant: "destructive" });
      return;
    }
    setToken("");
    setBotUsername(data.bot_username || "");
    setConfigured(true);
    toast({ title: "✅ Bot Telegram aktif", description: data.bot_username ? `@${data.bot_username} siap dipakai` : "Tersimpan" });
    loadConfig();
  };

  const clearBot = async () => {
    if (!confirm("Hapus semua konfigurasi & perintah bot Telegram? Bot akan berhenti.")) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("telegram-manage", { body: { action: "clear" } });
    setSaving(false);
    if (error || data?.error) { toast({ title: "Gagal", variant: "destructive" }); return; }
    setConfigured(false); setBotUsername(""); setOwnerId(""); setToken(""); setEnabled(false);
    toast({ title: "🧹 Bot direset", description: "Token, ID & perintah dihapus" });
  };

  const sendReply = async () => {
    if (!activeChat || !reply.trim()) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("telegram-manage", {
      body: { action: "reply", chat_id: activeChat.chat_id, text: reply.trim() },
    });
    setSending(false);
    if (error || data?.error) { toast({ title: "Gagal kirim", description: data?.error, variant: "destructive" }); return; }
    setReply("");
    loadMessages(activeChat.chat_id);
  };

  const displayName = (chat: TgChat) => chat.first_name?.trim() || [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim() || chat.username || "Pengguna Telegram";
  const initial = (chat: TgChat) => (displayName(chat).trim()[0] || "?").toUpperCase();
  const Avatar = ({ chat, className = "w-12 h-12" }: { chat: TgChat; className?: string }) => (
    <div className={`${className} shrink-0 overflow-hidden rounded-full border bg-primary/10 text-primary flex items-center justify-center font-black`}>
      {chat.photo_url ? (
        <img src={chat.photo_url} alt={`Foto Telegram ${displayName(chat)}`} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span>{initial(chat)}</span>
      )}
    </div>
  );

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  // Chat detail view
  if (activeChat) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => setActiveChat(null)} className="h-8 gap-1"><ChevronLeft className="w-4 h-4" /> Kembali</Button>
          <Avatar chat={activeChat} className="w-11 h-11" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{displayName(activeChat)}</p>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>Username: {activeChat.username ? `@${activeChat.username}` : "Tidak ada"}</span>
              <span>ID: {activeChat.chat_id}</span>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="p-3">
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {m.text}
                    <div className="text-[9px] opacity-60 mt-0.5">{new Date(m.created_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Belum ada pesan</p>}
              <div ref={chatEndRef} />
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-2">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={1} placeholder="Ketik balasan..." className="resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }} />
          <Button onClick={sendReply} disabled={sending || !reply.trim()} className="shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <Card className={configured && enabled ? "border-sky-500/40 bg-sky-500/5" : "border-border"}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${configured && enabled ? "bg-sky-500/20 text-sky-600" : "bg-muted text-muted-foreground"}`}>
            <Bot className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-black text-sm">Bot Telegram {configured ? (enabled ? "AKTIF" : "NONAKTIF") : "BELUM DIATUR"}</p>
            <p className="text-[11px] text-muted-foreground">{botUsername ? `@${botUsername}` : "Masukkan token untuk mengaktifkan"}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { loadConfig(); loadChats(); loadStatus(); }} className="h-8 w-8 p-0"><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      {/* Config */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-bold text-sm flex items-center gap-1.5"><Bot className="w-4 h-4 text-primary" /> Konfigurasi Bot</p>
          <div>
            <Label className="text-xs">Token Bot (dari @BotFather)</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder={configured ? `${tokenMasked || "••••••••"} (tersimpan, isi untuk ganti)` : "123456:ABC-DEF..."} />
          </div>
          <div>
            <Label className="text-xs">ID Telegram Owner (untuk notifikasi CS)</Label>
            <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="Contoh: 123456789" inputMode="numeric" />
            <p className="text-[10px] text-muted-foreground mt-1">Dapatkan ID dari @userinfobot di Telegram.</p>
          </div>
          <div>
            <Label className="text-xs">Pesan Sambutan /start (opsional)</Label>
            <Textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={2} placeholder="Kosongkan untuk pakai default. Boleh pakai HTML <b>tebal</b>." />
          </div>
          <div>
            <Label className="text-xs">Gambar QRIS (dikirim otomatis saat deposit QRIS)</Label>
            {qrisImageUrl && (
              <img src={qrisImageUrl} alt="Pratinjau QRIS" className="mt-1 mb-2 w-32 h-32 object-cover rounded-xl border" />
            )}
            <div className="flex gap-2">
              <Input type="file" accept="image/*" onChange={handleQrisUpload} disabled={uploadingQris} className="text-xs" />
              {qrisImageUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setQrisImageUrl("")} className="shrink-0 h-9">Hapus</Button>
              )}
            </div>
            {uploadingQris && <p className="text-[10px] text-primary mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Mengunggah...</p>}
            <p className="text-[10px] text-muted-foreground mt-1">Unggah gambar QRIS kamu. Bot otomatis mengirimnya ke user saat pilih deposit QRIS. Jangan lupa klik Simpan di bawah.</p>
          </div>
          <div>
            <Label className="text-xs">Keterangan QRIS (opsional)</Label>
            <Textarea value={qrisCaption} onChange={(e) => setQrisCaption(e.target.value)} rows={2} placeholder="Contoh: Scan QRIS di atas untuk membayar, lalu kirim bukti transfer." />
          </div>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Aktifkan Bot</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </label>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1 gap-1.5 font-bold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan & Daftarkan
            </Button>
            {configured && (
              <Button onClick={clearBot} disabled={saving} variant="destructive" className="gap-1.5"><Trash2 className="w-4 h-4" /> Reset</Button>
            )}
          </div>
          <div className="rounded-xl bg-muted/50 border border-border p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="font-bold text-foreground">ℹ️ Cara pakai</p>
            <p>1. Buat bot di @BotFather, salin token.</p>
            <p>2. Tempel token + ID owner, klik Simpan (webhook & perintah otomatis terdaftar).</p>
            <p>3. User ketik /start di bot → muncul menu tombol (Saldo, Game, Confess, Akun, Login, Daftar).</p>
            <p>4. Pesan bebas dari user masuk ke Live CS di bawah — balas langsung dari sini.</p>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard + status */}
      {configured && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm flex items-center gap-1.5"><Activity className="w-4 h-4 text-primary" /> Dashboard Bot</p>
              {statusLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {status?.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["👥 Pengguna", status.stats.users], ["🔗 Akun tertaut", status.stats.linked],
                  ["💰 Deposit pending", status.stats.deposit_pending], ["🛒 Order 24 jam", status.stats.orders_24h],
                  ["💬 Chat belum dibaca", status.stats.unread], ["🎫 Tiket terbuka", status.stats.tickets_open],
                  ["🔥 Streak aktif", status.stats.active_streaks], ["📦 Produk", status.stats.products],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl border bg-muted/40 p-2.5 min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{l}</p>
                    <p className="text-lg font-black tabular-nums">{Number(v).toLocaleString("id-ID")}</p>
                  </div>
                ))}
              </div>
            )}
            {status && (
              <div className="rounded-xl border p-3 text-xs space-y-1">
                <p><b>Bot:</b> {status.bot ? `${status.bot.name} (@${status.bot.username})` : "Tidak bisa dihubungi"}</p>
                <p className="flex items-center gap-1"><b>Webhook:</b> {status.webhook?.ok ? <span className="text-primary font-bold">Terhubung</span> : <span className="text-destructive font-bold">Bermasalah</span>}
                  {status.webhook?.pending ? <span className="text-muted-foreground"> · {status.webhook.pending} antrean</span> : null}</p>
                {status.webhook?.last_error && <p className="text-destructive">Error terakhir: {status.webhook.last_error}{status.webhook.last_error_at ? ` (${new Date(status.webhook.last_error_at).toLocaleString("id-ID")})` : ""}</p>}
                <p><b>Token:</b> <code>{tokenMasked || "—"}</code></p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!!busyAction} onClick={async () => { if (await runAction("reset_webhook", {}, "Webhook didaftarkan ulang")) loadStatus(); }} className="gap-1.5 text-xs">
                {busyAction === "reset_webhook" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Daftarkan Ulang Webhook
              </Button>
              <Button variant="outline" disabled={!!busyAction} onClick={() => runAction("test_owner", {}, "Tes terkirim ke owner")} className="gap-1.5 text-xs">
                {busyAction === "test_owner" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} Tes Notifikasi Owner
              </Button>
            </div>
            <div className="rounded-xl border p-3 space-y-2">
              <label className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium flex items-center gap-1.5"><Wrench className="w-4 h-4" /> Mode Maintenance</span>
                <Switch checked={maintenance} onCheckedChange={async (v) => { setMaintenance(v); await runAction("set_maintenance", { maintenance_mode: v, maintenance_message: maintenanceMsg }, v ? "Maintenance aktif" : "Maintenance dimatikan"); }} />
              </label>
              <Input value={maintenanceMsg} onChange={(e) => setMaintenanceMsg(e.target.value)} placeholder="Pesan untuk pengguna saat maintenance" />
              <p className="text-[10px] text-muted-foreground">Saat aktif, pengguna hanya melihat pesan ini. Owner tetap bisa memakai bot.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Broadcast */}
      {configured && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-bold text-sm flex items-center gap-1.5"><Megaphone className="w-4 h-4 text-primary" /> Broadcast</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([["all", "Semua chat"], ["linked", "Akun tertaut"], ["announce", "Mau pengumuman"]] as const).map(([k, l]) => (
                <Button key={k} type="button" size="sm" variant={bcTarget === k ? "default" : "outline"} onClick={() => { setBcTarget(k); setBcPreview(null); }} className="text-[11px] h-10">{l}</Button>
              ))}
            </div>
            <Textarea value={bcText} onChange={(e) => { setBcText(e.target.value); setBcPreview(null); }} rows={4} maxLength={3500} placeholder="Tulis pesan. Boleh emoji, link, dan HTML sederhana: <b>tebal</b>, <i>miring</i>." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input value={bcBtnText} onChange={(e) => { setBcBtnText(e.target.value); setBcPreview(null); }} placeholder="Teks tombol (opsional)" maxLength={40} />
              <Input value={bcBtnUrl} onChange={(e) => { setBcBtnUrl(e.target.value); setBcPreview(null); }} placeholder="https://link-tombol (opsional)" />
            </div>
            {bcText.trim() && (
              <div className="rounded-xl border bg-muted/40 p-3">
                <p className="text-[10px] font-bold text-muted-foreground mb-1">PRATINJAU</p>
                <p className="text-sm whitespace-pre-wrap break-words">{bcText}</p>
                {bcBtnText && bcBtnUrl && <div className="mt-2 rounded-lg border text-center text-xs py-1.5 font-semibold">{bcBtnText}</div>}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={previewBroadcast} disabled={!bcText.trim() || !!busyAction} className="flex-1">Cek Penerima</Button>
              <Button onClick={sendBroadcast} disabled={bcPreview === null || bcPreview === 0 || bcSending} className="flex-1 gap-1.5">
                {bcSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Kirim{bcPreview !== null ? ` (${bcPreview})` : ""}
              </Button>
            </div>
            {bcSending && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Mengirim bertahap (25 pesan/detik)... jangan tutup halaman.</p>}
            {bcResult && (
              <p className="text-xs rounded-lg border p-2">✅ Terkirim <b>{bcResult.sent}</b> · ❌ Gagal <b>{bcResult.failed}</b> · 🚫 Memblokir bot <b>{bcResult.blocked}</b> dari {bcResult.total}</p>
            )}
            {status?.broadcasts?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground">RIWAYAT</p>
                {status.broadcasts.map((b: any, i: number) => (
                  <p key={i} className="text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {b.target} · {b.sent}/{b.total} terkirim</p>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">Batas: 3.000 penerima per broadcast, jeda 5 menit antar broadcast.</p>
          </CardContent>
        </Card>
      )}

      {/* Live CS */}
      <div>
        <p className="font-bold text-sm flex items-center gap-1.5 mb-2"><MessageCircle className="w-4 h-4 text-primary" /> Live CS Telegram ({chats.length})</p>
        <div className="space-y-1.5">
          {chats.map((c) => (
            <button key={c.id} onClick={() => setActiveChat(c)} className="w-full text-left rounded-xl border bg-card p-3 hover:bg-muted/60 transition">
              <div className="flex items-start gap-3">
                <Avatar chat={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-sm truncate">{displayName(c)}</p>
                      <div className="mt-1 grid grid-cols-1 gap-0.5 text-[10px] text-muted-foreground">
                        <span className="truncate">Nama pengguna: {c.username ? `@${c.username}` : "Tidak ada username"}</span>
                        <span className="truncate">ID Telegram: {c.chat_id}</span>
                      </div>
                    </div>
                    {c.unread_count > 0
                      ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground font-black">{c.unread_count}</span>
                      : <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-2">{c.last_message || "—"}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(c.last_message_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            </button>
          ))}
          {chats.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Belum ada pesan Live CS</p>}
        </div>
      </div>
    </div>
  );
}

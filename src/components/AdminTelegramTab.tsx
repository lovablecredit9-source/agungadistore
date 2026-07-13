import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, Loader2, Save, Trash2, RefreshCw, MessageCircle, ChevronLeft, CheckCircle2 } from "lucide-react";

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
      setConfigured(!!cfg.bot_token);
    }
    setLoading(false);
  }, []);

  const loadChats = useCallback(async () => {
    const { data } = await supabase.from("telegram_chats").select("*").order("last_message_at", { ascending: false });
    setChats((data as TgChat[]) || []);
  }, []);

  useEffect(() => { loadConfig(); loadChats(); }, [loadConfig, loadChats]);

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

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("telegram-manage", {
      body: { action: "save", bot_token: token || undefined, owner_id: ownerId, enabled, welcome_message: welcome, qris_image_url: qrisImageUrl, qris_caption: qrisCaption },
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
          <Button size="sm" variant="ghost" onClick={() => { loadConfig(); loadChats(); }} className="h-8 w-8 p-0"><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      {/* Config */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-bold text-sm flex items-center gap-1.5"><Bot className="w-4 h-4 text-primary" /> Konfigurasi Bot</p>
          <div>
            <Label className="text-xs">Token Bot (dari @BotFather)</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder={configured ? "•••••••• (tersimpan, isi untuk ganti)" : "123456:ABC-DEF..."} />
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

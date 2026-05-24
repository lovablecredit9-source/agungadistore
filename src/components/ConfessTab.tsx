import { useEffect, useState, useCallback, useRef } from "react";
import {
  Send, Loader2, Plus, X, MessageSquareWarning, Lock, ArrowLeft, Phone, User as UserIcon,
  RefreshCw, CheckCheck, Check, Clock, MessageCircle, Sparkles, Timer, Paperclip, ImageIcon, FileText, Download, Play, Copy, History, Gift,
  Globe, CalendarClock, Mic, Square, Flame, Heart, Laugh, Frown, Eye, EyeOff, Trophy, Trash2, CheckCircle2, XCircle, Smile
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { toast } from "@/hooks/use-toast";

function priceFor(n: number) {
  if (n <= 1) return 2000;
  if (n === 2) return 4000;
  return 5000;
}
const rupiah = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

const PUBLIC_API_KEY = "ak_L3HVVgbqgdFEM2EipHB4AKjgrOVSyJqCcJZOA4OG";

interface Thread {
  id: string;
  target_phone: string;
  target_avatar_url?: string | null;
  sender_name: string | null;
  last_paid_at: string;
  free_until: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  created_at: string;
}

interface ThreadMessage {
  id: string;
  direction: "out" | "in";
  text: string;
  status: string;
  is_free: boolean;
  sent_at: string | null;
  created_at: string;
  error?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  media_name?: string | null;
  media_mime?: string | null;
  media_size?: number | null;
}

function detectMediaType(file: File): "image" | "video" | "audio" | "file" {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "file";
}

function humanFileSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function useCountdown(targetIso: string | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return { expired: true, label: "" };
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return { expired: true, label: "Habis" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { expired: false, label: `${h}j ${m}m ${s}s` };
}

export default function ConfessTab() {
  const visitorId = (typeof window !== "undefined" && localStorage.getItem("balance_visitor_id")) || getVisitorId();
  const [view, setView] = useState<"list" | "compose" | "chat" | "history" | "wall" | "scheduled">("list");
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [trialEligible, setTrialEligible] = useState<null | boolean>(null);
  const [trialReason, setTrialReason] = useState<string>("");

  const loadThreads = useCallback(async () => {
    setRefreshing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_threads&visitor_id=${encodeURIComponent(visitorId)}`;
      const res = await fetch(url, { headers: { "x-api-key": PUBLIC_API_KEY } });
      const j = await res.json();
      if (j?.data) setThreads(j.data);
    } catch {} finally { setRefreshing(false); }
  }, [visitorId]);

  const loadTrial = useCallback(async () => {
    try {
      const fp = (typeof window !== "undefined" && (localStorage.getItem("device_fp_v1") || getVisitorId())) || "";
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_trial_status&visitor_id=${encodeURIComponent(visitorId)}&fp=${encodeURIComponent(fp)}`;
      const res = await fetch(url, { headers: { "x-api-key": PUBLIC_API_KEY } });
      const j = await res.json();
      setTrialEligible(!!j?.data?.eligible);
      setTrialReason(j?.data?.reason || "");
    } catch {}
  }, [visitorId]);

  useEffect(() => { loadThreads(); loadTrial(); }, [loadThreads, loadTrial]);

  useEffect(() => {
    const ch = supabase
      .channel("confess-thread-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "confess_threads" }, () => loadThreads())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadThreads]);

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
              <p className="text-[11px] text-muted-foreground">Chat 2 arah via WhatsApp · gratis 24 jam setelah bayar 💌</p>
            </div>
            {view === "list" && (
              <Button variant="outline" size="sm" onClick={() => setView("history")} className="rounded-full gap-1 h-8 px-3 text-[11px]">
                <History className="w-3.5 h-3.5" /> Riwayat
              </Button>
            )}
          </div>
          {/* Tab strip — fitur baru */}
          {(view === "list" || view === "wall" || view === "scheduled") && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { key: "list", label: "Chat", icon: MessageCircle },
                { key: "wall", label: "Wall Publik", icon: Globe },
                { key: "scheduled", label: "Terjadwal", icon: CalendarClock },
              ].map((t) => {
                const Icon = t.icon;
                const active = view === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setView(t.key as any)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                      active
                        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-3 h-3" /> {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Trial banner (hanya saat list/compose dan masih eligible) */}
      {(view === "list" || view === "compose") && trialEligible === true && (
        <div className="rounded-2xl border-2 border-dashed border-emerald-400/60 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-emerald-500/10 p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shrink-0 animate-bounce">
            <Gift className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-emerald-700 dark:text-emerald-300">🎁 Percobaan GRATIS Tersedia!</div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">Confess pertama kamu otomatis dapat diskon Rp 2.000 (gratis 1 nomor). Berlaku 1× per perangkat.</div>
          </div>
        </div>
      )}
      {(view === "list" || view === "compose") && trialEligible === false && trialReason === "device_used" && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
          <MessageSquareWarning className="w-4 h-4 shrink-0" />
          <span>Percobaan gratis sudah dipakai dari perangkat/IP ini sebelumnya. Ganti akun tidak akan mengulang gratisan.</span>
        </div>
      )}

      {view === "list" && (
        <ThreadListView
          threads={threads}
          refreshing={refreshing}
          onRefresh={loadThreads}
          onCompose={() => setView("compose")}
          onOpen={(t) => { setActiveThread(t); setView("chat"); }}
        />
      )}
      {view === "compose" && (
        <ComposeView
          visitorId={visitorId}
          onBack={() => setView("list")}
          onSent={() => { loadThreads(); loadTrial(); setView("list"); }}
          existingThreads={threads}
          trialEligible={trialEligible === true}
        />
      )}
      {view === "chat" && activeThread && (
        <ChatView
          visitorId={visitorId}
          thread={activeThread}
          onBack={() => { setActiveThread(null); setView("list"); loadThreads(); }}
          onTopUp={() => setView("compose")}
        />
      )}
      {view === "history" && (
        <HistoryView visitorId={visitorId} onBack={() => setView("list")} />
      )}
      {view === "wall" && (
        <WallView visitorId={visitorId} onCompose={() => setView("compose")} />
      )}
      {view === "scheduled" && (
        <ScheduledView visitorId={visitorId} onCompose={() => setView("compose")} />
      )}
    </div>
  );
}

/* ============ THREAD LIST ============ */
function ThreadListView({ threads, refreshing, onRefresh, onCompose, onOpen }: {
  threads: Thread[]; refreshing: boolean; onRefresh: () => void;
  onCompose: () => void; onOpen: (t: Thread) => void;
}) {
  return (
    <>
      <Button onClick={onCompose} className="w-full gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 hover:opacity-90 h-12 text-base font-bold shadow-lg">
        <Sparkles className="w-5 h-5" /> Kirim Confess Baru
      </Button>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Daftar Chat</h3>
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {threads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Belum ada chat. Kirim confess pertama! 💌</p>
        ) : (
          <div className="space-y-2">
            {threads.map((t) => <ThreadCard key={t.id} thread={t} onOpen={() => onOpen(t)} />)}
          </div>
        )}
      </div>
    </>
  );
}

function ThreadCard({ thread, onOpen }: { thread: Thread; onOpen: () => void }) {
  const cd = useCountdown(thread.free_until);
  const copyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText("+" + thread.target_phone).then(() => {
      toast({ title: "✅ Nomor disalin", description: "+" + thread.target_phone });
    }).catch(() => {});
  };
  return (
    <button onClick={onOpen} className="w-full text-left p-3 rounded-xl border hover:border-pink-400 hover:bg-pink-500/5 transition-all">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shrink-0 overflow-hidden ring-2 ring-pink-500/20">
            {thread.target_avatar_url ? (
              <img src={thread.target_avatar_url} alt={thread.target_phone} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <Phone className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <div className="font-bold text-sm font-mono truncate">+{thread.target_phone}</div>
              <span onClick={copyPhone} className="p-1 rounded-md hover:bg-pink-500/10 text-muted-foreground hover:text-pink-500 cursor-pointer" title="Salin nomor">
                <Copy className="w-3 h-3" />
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(thread.last_message_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {thread.unread_count > 0 && (
            <span className="bg-pink-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">{thread.unread_count}</span>
          )}
          {cd.expired ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" /> Bayar lagi</span>
          ) : (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> Gratis {cd.label}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-1 pl-11">{thread.last_message_preview || "—"}</p>
    </button>
  );
}

/* ============ HISTORY ============ */
interface ConfessHistoryItem {
  id: string;
  trx_id: string;
  sender_name: string | null;
  message: string;
  num_targets: number;
  total_price: number;
  status: string;
  created_at: string;
  confession_targets: { id: string; phone: string; status: string; sent_at: string | null }[];
  confession_replies: { id: string; from_phone: string; reply_text: string; created_at: string }[];
}

function HistoryView({ visitorId, onBack }: { visitorId: string; onBack: () => void }) {
  const [items, setItems] = useState<ConfessHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confessions_by_visitor&visitor_id=${encodeURIComponent(visitorId)}`;
      const res = await fetch(url, { headers: { "x-api-key": PUBLIC_API_KEY } });
      const j = await res.json();
      if (Array.isArray(j?.data)) setItems(j.data);
    } finally { setLoading(false); }
  }, [visitorId]);

  useEffect(() => { load(); }, [load]);

  const copyPhone = (phone: string) => {
    navigator.clipboard?.writeText("+" + phone).then(() => {
      toast({ title: "✅ Nomor disalin", description: "+" + phone });
    }).catch(() => {});
  };

  const short = (s: string) => s.replace(/[^0-9]/g, "").slice(-6) || s.slice(-6);

  const totalSpent = items.reduce((a, b) => a + (b.total_price || 0), 0);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Button>

      <div className="rounded-2xl border bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-orange-500/10 p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white"><History className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted-foreground">Total Transaksi · {items.length} kiriman</div>
          <div className="font-black text-lg bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">{rupiah(totalSpent)}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-pink-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <MessageSquareWarning className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada riwayat pembelian confess.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] text-muted-foreground">#{short(it.trx_id)}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(it.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-sm bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">{rupiah(it.total_price)}</div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${it.status === "sent" ? "bg-emerald-500/15 text-emerald-600" : it.status === "failed" ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>{it.status}</span>
                </div>
              </div>
              <p className="text-xs bg-muted/40 rounded-lg p-2 line-clamp-3">{it.message}</p>
              <div className="space-y-1">
                {it.confession_targets.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1 min-w-0">
                      <Phone className="w-3 h-3 text-pink-500 shrink-0" />
                      <span className="font-mono truncate">+{t.phone}</span>
                      <button onClick={() => copyPhone(t.phone)} className="p-0.5 rounded hover:bg-pink-500/10 text-muted-foreground hover:text-pink-500" title="Salin nomor">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${t.status === "sent" ? "bg-emerald-500/15 text-emerald-600" : t.status === "failed" ? "bg-red-500/15 text-red-600" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
                  </div>
                ))}
              </div>
              {it.confession_replies.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground">{it.confession_replies.length} balasan</div>
                  {it.confession_replies.slice(0, 3).map((r) => (
                    <div key={r.id} className="text-[11px] bg-pink-500/5 rounded p-1.5">
                      <span className="font-mono text-pink-600">+{r.from_phone}:</span> <span className="text-muted-foreground line-clamp-1">{r.reply_text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ============ COMPOSE (new / paid) ============ */
function ComposeView({ visitorId, onBack, onSent, existingThreads, trialEligible }: {
  visitorId: string; onBack: () => void; onSent: () => void; existingThreads: Thread[]; trialEligible: boolean;
}) {
  const [phones, setPhones] = useState<string[]>([""]);
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moodTag, setMoodTag] = useState<string>("");
  const [shareToWall, setShareToWall] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>("");

  const MOODS = [
    { tag: "Cinta", emoji: "💘", template: "Aku diam-diam suka sama kamu sejak…" },
    { tag: "Maaf", emoji: "🙏", template: "Maaf banget kalau dulu aku pernah…" },
    { tag: "Terima Kasih", emoji: "🌷", template: "Terima kasih udah selalu ada saat aku…" },
    { tag: "Marah", emoji: "💢", template: "Aku kecewa sama sikap kamu yang…" },
    { tag: "Sedih", emoji: "💔", template: "Sebenarnya aku sakit hati waktu kamu…" },
    { tag: "Lucu", emoji: "😂", template: "Btw, kamu tau gak waktu itu sebenarnya…" },
    { tag: "Rahasia", emoji: "🤫", template: "Aku punya rahasia yang harus kamu tau…" },
    { tag: "Crush", emoji: "🥰", template: "Setiap lihat kamu, jantungku…" },
  ];

  // Hitung yang gratis vs bayar
  const cleanPhones = phones.map((p) => p.replace(/\D/g, "")).filter(Boolean);
  const freeCount = scheduleEnabled ? 0 : cleanPhones.filter((digits) => {
    const norm = digits.startsWith("0") ? "62" + digits.slice(1) : digits.startsWith("62") ? digits : digits.startsWith("8") ? "62" + digits : digits;
    return existingThreads.some((t) => t.target_phone === norm && new Date(t.free_until) > new Date());
  }).length;
  const paidCount = cleanPhones.length - freeCount;
  const grossTotal = paidCount > 0 ? priceFor(paidCount) : 0;
  // Saat dijadwal, gratis trial tidak berlaku
  const trialDiscountPreview = !scheduleEnabled && trialEligible && grossTotal > 0 ? Math.min(grossTotal, 2000) : 0;
  const total = Math.max(0, grossTotal - trialDiscountPreview);

  // Default schedule: 1 jam dari sekarang (untuk input datetime-local lokal)
  useEffect(() => {
    if (scheduleEnabled && !scheduledAt) {
      const d = new Date(Date.now() + 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      setScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
  }, [scheduleEnabled, scheduledAt]);

  async function submit() {
    const clean = phones.map((p) => p.trim()).filter(Boolean);
    if (clean.length < 1) return toast({ title: "Isi minimal 1 nomor WA", variant: "destructive" });
    if (clean.length > 3) return toast({ title: "Maksimal 3 nomor", variant: "destructive" });
    if (message.trim().length < 3) return toast({ title: "Pesan terlalu pendek", variant: "destructive" });
    let scheduledIso: string | null = null;
    if (scheduleEnabled) {
      if (!scheduledAt) return toast({ title: "Pilih waktu kirim", variant: "destructive" });
      const d = new Date(scheduledAt);
      if (isNaN(d.getTime())) return toast({ title: "Waktu tidak valid", variant: "destructive" });
      if (d.getTime() - Date.now() < 5 * 60 * 1000) return toast({ title: "Minimal 5 menit dari sekarang", variant: "destructive" });
      if (d.getTime() - Date.now() > 30 * 24 * 3600 * 1000) return toast({ title: "Maksimal 30 hari ke depan", variant: "destructive" });
      scheduledIso = d.toISOString();
    }
    if (total > 0 && !/^\d{6}$/.test(pin)) { setShowPin(true); return toast({ title: "Masukkan PIN 6 digit", variant: "destructive" }); }
    setLoading(true);
    try {
      const deviceFingerprint = (typeof window !== "undefined" && (localStorage.getItem("device_fp_v1") || getVisitorId())) || "";
      const { data, error } = await supabase.functions.invoke("send-confession", {
        body: {
          visitorId, senderName: senderName.trim(), message: message.trim(),
          phones: clean, pin, deviceFingerprint,
          moodTag: moodTag || undefined,
          shareToWall,
          scheduledAt: scheduledIso || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.scheduled) {
        toast({ title: "⏰ Confess Dijadwalkan!", description: `Akan dikirim otomatis pada ${new Date(scheduledIso!).toLocaleString("id-ID")}` });
      } else {
        const trialDisc = (data as any).trial_discount || 0;
        toast({ title: "✉️ Confess dikirim!", description: `Bayar ${rupiah((data as any).charged || 0)} · ${(data as any).free_count || 0} gratis${trialDisc > 0 ? ` · 🎁 Diskon percobaan Rp${trialDisc.toLocaleString("id-ID")}` : ""}${shareToWall ? " · 🌐 Tayang di Wall" : ""}` });
      }
      onSent();
    } catch (e: any) {
      const msg = e?.message || "Gagal kirim";
      if (/PIN/i.test(msg)) setShowPin(true);
      toast({ title: "Gagal", description: msg, variant: "destructive" });
    } finally { setLoading(false); }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Button>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`rounded-xl border p-2.5 ${cleanPhones.length === n ? "border-pink-500 bg-pink-500/5" : ""}`}>
            <div className="text-[10px] text-muted-foreground">{n} nomor baru</div>
            <div className="font-bold text-sm">{rupiah(priceFor(n))}</div>
          </div>
        ))}
      </div>

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
          {freeCount > 0 && (
            <p className="text-[10px] text-green-600 mt-2 flex items-center gap-1"><Sparkles className="w-3 h-3" /> {freeCount} nomor masih dalam window gratis 24 jam — tidak dipotong saldo</p>
          )}
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
            {trialDiscountPreview > 0 && (
              <div className="text-[10px] text-muted-foreground line-through">{rupiah(grossTotal)}</div>
            )}
            <div className="font-black text-xl bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">{rupiah(total)}</div>
            {trialDiscountPreview > 0 && (
              <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><Gift className="w-3 h-3" /> Diskon percobaan −{rupiah(trialDiscountPreview)}</div>
            )}
          </div>
          <Button onClick={() => { if (!showPin && total > 0) { setShowPin(true); return; } submit(); }} disabled={loading} className="rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 hover:opacity-90">
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            {total === 0 ? "Kirim Gratis" : (showPin ? "Bayar & Kirim" : "Lanjut Bayar")}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed bg-muted/40 p-2 rounded-lg">
          🤖 Setelah bayar pertama, kamu & penerima bisa chat bolak-balik <b>GRATIS selama 24 jam</b>. Lewat dari itu wajib bayar lagi Rp 2.000.
        </p>
      </div>
    </>
  );
}

/* ============ CHAT VIEW (WhatsApp-style) ============ */
function ChatView({ visitorId, thread, onBack, onTopUp }: {
  visitorId: string; thread: Thread; onBack: () => void; onTopUp: () => void;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [freeUntil, setFreeUntil] = useState(thread.free_until);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cd = useCountdown(freeUntil);

  const load = useCallback(async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_thread_messages&thread_id=${thread.id}&visitor_id=${encodeURIComponent(visitorId)}`;
      const res = await fetch(url, { headers: { "x-api-key": PUBLIC_API_KEY } });
      const j = await res.json();
      if (j?.data) setMessages(j.data);
    } finally { setLoading(false); }
  }, [thread.id, visitorId]);

  useEffect(() => { load(); }, [load]);

  // Mark as read
  useEffect(() => {
    if (thread.unread_count > 0) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_thread_mark_read`, {
        method: "POST",
        headers: { "x-api-key": PUBLIC_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: thread.id, visitor_id: visitorId }),
      }).catch(() => {});
    }
  }, [thread.id, thread.unread_count, visitorId]);

  useEffect(() => {
    const ch = supabase
      .channel(`confess-chat-${thread.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "confess_thread_messages", filter: `thread_id=eq.${thread.id}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "confess_threads", filter: `id=eq.${thread.id}` }, (p) => {
        const newFree = (p.new as any)?.free_until;
        if (newFree) setFreeUntil(newFree);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [thread.id, load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendPayload(payload: { text?: string; mediaUrl?: string; mediaType?: string; mediaName?: string; mediaMime?: string; mediaSize?: number }) {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("confess-chat-send", {
        body: { visitorId, threadId: thread.id, ...payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setInput("");
      load();
    } catch (e: any) {
      toast({ title: "Gagal kirim", description: e?.message || "Error", variant: "destructive" });
    } finally { setSending(false); }
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    await sendPayload({ text });
  }

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "File terlalu besar", description: "Maks 16 MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
      const path = `${thread.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("confess-media").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("confess-media").getPublicUrl(path);
      await sendPayload({
        text: input.trim(),
        mediaUrl: pub.publicUrl,
        mediaType: detectMediaType(file),
        mediaName: file.name,
        mediaMime: file.type || undefined,
        mediaSize: file.size,
      });
    } catch (e: any) {
      toast({ title: "Gagal upload", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Group messages by date for separators
  const grouped = (() => {
    const out: { date: string; items: ThreadMessage[] }[] = [];
    messages.forEach((m) => {
      const d = new Date(m.created_at);
      const key = d.toDateString();
      const last = out[out.length - 1];
      if (last && last.date === key) last.items.push(m);
      else out.push({ date: key, items: [m] });
    });
    return out;
  })();

  const fmtDateLabel = (s: string) => {
    const d = new Date(s);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Hari ini";
    if (d.toDateString() === yest.toDateString()) return "Kemarin";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <>
      {/* Header — glassy gradient */}
      <div className="relative overflow-hidden rounded-2xl border border-pink-500/20 sticky top-2 z-10 backdrop-blur-xl bg-gradient-to-r from-pink-500/10 via-rose-500/5 to-fuchsia-500/10 shadow-lg shadow-pink-500/5">
        <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_top_right,theme(colors.pink.400/.4),transparent_60%)]" />
        <div className="relative p-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-pink-500/10"><ArrowLeft className="w-4 h-4" /></Button>
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 blur-md opacity-60 animate-pulse" />
            <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg ring-2 ring-white/20 overflow-hidden">
              {thread.target_avatar_url ? (
                <img src={thread.target_avatar_url} alt={thread.target_phone} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <Phone className="w-4 h-4" />
              )}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-background ${cd.expired ? "bg-gray-400" : "bg-emerald-500 animate-pulse"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <div className="font-bold text-sm font-mono truncate bg-gradient-to-r from-pink-600 to-rose-600 dark:from-pink-300 dark:to-rose-300 bg-clip-text text-transparent">+{thread.target_phone}</div>
              <button onClick={() => navigator.clipboard?.writeText("+" + thread.target_phone).then(() => toast({ title: "✅ Nomor disalin", description: "+" + thread.target_phone })).catch(() => {})} className="p-1 rounded-md hover:bg-pink-500/15 text-pink-500" title="Salin nomor">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            {cd.expired ? (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Timer className="w-3 h-3" /> Window gratis habis</div>
            ) : (
              <div className="text-[10px] flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Gratis</span>
                <span className="text-muted-foreground">· {cd.label}</span>
              </div>
            )}
          </div>
          {!cd.expired && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{cd.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages — chat canvas with subtle pattern */}
      <div
        ref={scrollRef}
        className="relative rounded-2xl border border-pink-500/15 p-3 h-[55vh] overflow-y-auto space-y-2 bg-gradient-to-b from-pink-50/60 via-rose-50/30 to-fuchsia-50/20 dark:from-pink-950/30 dark:via-rose-950/15 dark:to-fuchsia-950/10"
        style={{
          backgroundImage: `radial-gradient(hsl(330 80% 60% / 0.08) 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      >
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-pink-500" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-pink-500" />
            </div>
            <p className="text-xs text-muted-foreground">Belum ada pesan — sapa dia duluan 💌</p>
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.date} className="space-y-2">
              <div className="flex justify-center sticky top-0 z-[1] pointer-events-none">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-background/80 backdrop-blur border border-pink-500/20 text-muted-foreground font-medium shadow-sm">
                  {fmtDateLabel(g.date)}
                </span>
              </div>
              {g.items.map((m, i) => {
                const prev = g.items[i - 1];
                const grouped = prev && prev.direction === m.direction;
                return <Bubble key={m.id} msg={m} grouped={grouped} />;
              })}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      {cd.expired ? (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 p-4 text-center space-y-2 bg-gradient-to-br from-amber-500/15 to-orange-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,theme(colors.amber.400/.3),transparent_70%)] pointer-events-none" />
          <div className="relative text-sm font-bold flex items-center justify-center gap-1.5"><Timer className="w-4 h-4 text-amber-500" /> Window 24 jam sudah habis</div>
          <p className="relative text-xs text-muted-foreground">Bayar Rp 2.000 untuk lanjut chat dengan nomor ini.</p>
          <Button size="sm" onClick={onTopUp} className="relative rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30 hover:scale-105 transition-transform">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Bayar & Buka Lagi
          </Button>
        </div>
      ) : (
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 rounded-2xl opacity-40 group-focus-within:opacity-70 blur transition-opacity" />
          <div className="relative rounded-2xl border border-pink-500/20 bg-card/95 backdrop-blur p-2 flex items-end gap-2 shadow-lg">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={uploading || sending}
              onClick={() => fileRef.current?.click()}
              className="rounded-full shrink-0 text-pink-500 hover:text-pink-600 hover:bg-pink-500/10 hover:rotate-12 transition-transform"
              title="Kirim foto / file"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ketik pesan / lampirkan foto…"
              rows={1}
              maxLength={800}
              className="resize-none min-h-[40px] max-h-[120px] border-0 focus-visible:ring-0 bg-transparent"
            />
            <Button
              onClick={send}
              disabled={sending || uploading || !input.trim()}
              size="icon"
              className="rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-500 shrink-0 shadow-lg shadow-pink-500/40 hover:scale-110 active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}
      {!cd.expired && (
        <p className="text-[10px] text-muted-foreground text-center mt-1.5 flex items-center justify-center gap-1">
          <Paperclip className="w-2.5 h-2.5" />
          Foto, video, audio, dokumen — maks 16 MB
        </p>
      )}
    </>
  );
}

function Bubble({ msg, grouped }: { msg: ThreadMessage; grouped?: boolean }) {
  const isOut = msg.direction === "out";
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"} animate-fade-in`}>
      <div
        className={`relative max-w-[80%] rounded-2xl px-2.5 py-2 shadow-md space-y-1.5 transition-transform hover:scale-[1.01] ${
          isOut
            ? `bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-500 text-white ${grouped ? "rounded-tr-2xl" : "rounded-tr-md"} shadow-pink-500/25`
            : `bg-card/95 backdrop-blur border border-pink-500/15 ${grouped ? "rounded-tl-2xl" : "rounded-tl-md"}`
        }`}
      >
        {/* Bubble tail */}
        {!grouped && (
          isOut ? (
            <span className="absolute -right-1 top-0 w-3 h-3 bg-gradient-to-br from-pink-500 to-rose-500" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
          ) : (
            <span className="absolute -left-1 top-0 w-3 h-3 bg-card border-l border-t border-pink-500/15" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }} />
          )
        )}
        {msg.media_url && msg.media_type === "image" && (
          <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="block">
            <img src={msg.media_url} alt={msg.media_name || "foto"} className="rounded-xl max-h-64 w-full object-cover" loading="lazy" />
          </a>
        )}
        {msg.media_url && msg.media_type === "video" && (
          <video src={msg.media_url} controls className="rounded-xl max-h-64 w-full" />
        )}
        {msg.media_url && msg.media_type === "audio" && (
          <audio src={msg.media_url} controls className="w-full" />
        )}
        {msg.media_url && (msg.media_type === "file" || !msg.media_type) && (
          <a
            href={msg.media_url}
            target="_blank"
            rel="noopener noreferrer"
            download={msg.media_name || undefined}
            className={`flex items-center gap-2 rounded-xl px-2 py-2 text-xs ${isOut ? "bg-white/15 hover:bg-white/25" : "bg-muted hover:bg-muted/80"}`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{msg.media_name || "file"}</div>
              <div className={`text-[9px] ${isOut ? "text-white/70" : "text-muted-foreground"}`}>{humanFileSize(msg.media_size)}</div>
            </div>
            <Download className="w-3.5 h-3.5 shrink-0" />
          </a>
        )}
        {msg.text && (
          <p className="text-sm whitespace-pre-wrap break-words px-1 leading-relaxed">{msg.text}</p>
        )}
        <div className={`flex items-center gap-1 justify-end text-[9px] px-1 ${isOut ? "text-white/85" : "text-muted-foreground"}`}>
          <span>{new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
          {isOut && (
            msg.status === "pending" ? <Clock className="w-3 h-3" /> :
            msg.status === "sent" ? <Check className="w-3 h-3" /> :
            msg.status === "delivered" || msg.status === "read" ? <CheckCheck className="w-3 h-3" /> :
            msg.status === "failed" ? <X className="w-3 h-3 text-red-300" /> : null
          )}
        </div>
      </div>
    </div>
  );
}


import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Filter, Activity, CheckCircle2, Clock, Inbox, Star, Copy, RotateCcw,
  TrendingUp, Sparkles, Hourglass, MessageCircle, ChevronRight, Calendar,
  Zap, ListFilter, X, AlertCircle, Tag, Pin, PinOff, Flame, Smile, Frown, Meh,
  Bot, Timer, ShieldAlert, Share2, Bell, BellOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface EnhancedTicket {
  id: string;
  ticket_number: number;
  description: string;
  status: string;
  category?: string;
  created_at: string;
  updated_at?: string;
  name?: string;
  phone?: string;
  screenshot_url?: string | null;
}

interface TicketEnhancerProps {
  tickets: EnhancedTicket[];
  categoryLabels: Record<string, string>;
  onOpen: (t: EnhancedTicket) => void;
  onReopen?: (t: EnhancedTicket) => void;
  onDuplicate?: (t: EnhancedTicket) => void;
}

const RATING_KEY = "ticket_ratings_v1";
const PIN_KEY = "ticket_pins_v1";
const NOTIFY_KEY = "ticket_notify_v1";
const SLA_HOURS = 24; // SLA target response

function getRatings(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(RATING_KEY) || "{}"); } catch { return {}; }
}
function saveRating(id: string, stars: number) {
  const all = getRatings();
  all[id] = stars;
  localStorage.setItem(RATING_KEY, JSON.stringify(all));
}
function getPins(): string[] {
  try { return JSON.parse(localStorage.getItem(PIN_KEY) || "[]"); } catch { return []; }
}
function savePins(arr: string[]) { localStorage.setItem(PIN_KEY, JSON.stringify(arr)); }
function getNotify(): string[] {
  try { return JSON.parse(localStorage.getItem(NOTIFY_KEY) || "[]"); } catch { return []; }
}
function saveNotify(arr: string[]) { localStorage.setItem(NOTIFY_KEY, JSON.stringify(arr)); }

// Sentiment heuristic — very simple keyword detection
function detectSentiment(text: string): "urgent" | "negative" | "positive" | "neutral" {
  const t = (text || "").toLowerCase();
  if (/(urgent|segera|cepat|tolong banget|penting|asap|mendesak|darurat)/.test(t)) return "urgent";
  if (/(marah|kecewa|jelek|buruk|parah|nipu|tipu|lambat|lama banget|bobrok|bangsat|anjir|kampret|sialan)/.test(t)) return "negative";
  if (/(terima kasih|makasih|mantap|bagus|keren|puas|hebat|top|oke banget)/.test(t)) return "positive";
  return "neutral";
}

// Priority — based on age + sentiment + status
function detectPriority(t: { status: string; created_at: string; description: string }): "low" | "medium" | "high" | "critical" {
  const ageH = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
  const s = detectSentiment(t.description);
  if (t.status === "open" && (s === "urgent" || s === "negative") && ageH > 12) return "critical";
  if (t.status === "open" && ageH > 24) return "high";
  if (t.status === "open" && (s === "urgent" || ageH > 6)) return "medium";
  return "low";
}

// AI Quick Replies — context aware suggestions
function suggestReplies(t: { description: string; category?: string }): string[] {
  const desc = (t.description || "").toLowerCase();
  const cat = t.category || "";
  if (cat === "deposit" || /deposit|transfer|saldo/.test(desc)) {
    return [
      "Mohon kirim bukti transfer + jam transaksi",
      "Saldo sudah masuk, mohon refresh aplikasi",
      "Kami cek dulu mutasi ya, mohon tunggu 5 menit",
    ];
  }
  if (cat === "voucher" || /voucher|kode|klaim/.test(desc)) {
    return [
      "Kode voucher sudah expired, kami kirim ulang",
      "Voucher sudah aktif, silakan klaim ulang",
      "Mohon screenshot error yang muncul",
    ];
  }
  if (cat === "refund" || /refund|kembali/.test(desc)) {
    return [
      "Refund diproses 1x24 jam ke saldo",
      "Mohon konfirmasi rekening tujuan refund",
      "Refund sudah masuk, silakan dicek",
    ];
  }
  if (cat === "bug" || /bug|error|tidak bisa|gagal/.test(desc)) {
    return [
      "Mohon coba clear cache & buka ulang aplikasi",
      "Bug sudah diperbaiki, silakan update",
      "Tim teknis sedang investigasi, mohon tunggu",
    ];
  }
  return [
    "Halo, terima kasih sudah menghubungi kami",
    "Mohon tunggu, kami cek dulu detailnya",
    "Sudah kami tindak lanjuti, ada lagi yang bisa dibantu?",
  ];
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min}m lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}h lalu`;
  return new Date(iso).toLocaleDateString("id-ID");
}

function dateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today.getTime() - 86400000);
  const isSame = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (isSame(d, today)) return "Hari Ini";
  if (isSame(d, y)) return "Kemarin";
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return "Minggu Ini";
  if (diffDays < 30) return "Bulan Ini";
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any; pct: number }> = {
  open: { label: "Diproses", color: "text-orange-500", bg: "from-orange-500 to-amber-500", icon: Activity, pct: 50 },
  pending: { label: "Pending", color: "text-yellow-500", bg: "from-yellow-500 to-orange-500", icon: Hourglass, pct: 25 },
  closed: { label: "Selesai", color: "text-emerald-500", bg: "from-emerald-500 to-green-600", icon: CheckCircle2, pct: 100 },
  resolved: { label: "Selesai", color: "text-emerald-500", bg: "from-emerald-500 to-green-600", icon: CheckCircle2, pct: 100 },
};

export function TicketEnhancer({ tickets, categoryLabels, onOpen, onReopen, onDuplicate }: TicketEnhancerProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [ratings, setRatings] = useState<Record<string, number>>(getRatings());
  const [ratingTicket, setRatingTicket] = useState<EnhancedTicket | null>(null);
  const [pins, setPins] = useState<string[]>(getPins());
  const [notify, setNotify] = useState<string[]>(getNotify());
  const [aiTicket, setAiTicket] = useState<EnhancedTicket | null>(null);
  const [tick, setTick] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  function togglePin(id: string) {
    const next = pins.includes(id) ? pins.filter(x => x !== id) : [...pins, id];
    setPins(next); savePins(next);
    toast({ title: pins.includes(id) ? "Lepas pin tiket" : "📌 Tiket disematkan" });
  }
  function toggleNotify(id: string) {
    const next = notify.includes(id) ? notify.filter(x => x !== id) : [...notify, id];
    setNotify(next); saveNotify(next);
    toast({ title: notify.includes(id) ? "Notifikasi dimatikan" : "🔔 Notifikasi diaktifkan" });
  }
  function shareTicket(t: EnhancedTicket) {
    const text = `Tiket #${t.ticket_number}\nKategori: ${categoryLabels[t.category || ""] || "Lainnya"}\nStatus: ${t.status}\n\n${t.description}`;
    if (navigator.share) {
      navigator.share({ title: `Tiket #${t.ticket_number}`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast({ title: "📋 Disalin ke clipboard" });
    }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return tickets.filter(t => {
      if (statusFilter !== "all") {
        if (statusFilter === "open" && t.status !== "open") return false;
        if (statusFilter === "closed" && t.status === "open") return false;
      }
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && detectPriority(t) !== priorityFilter) return false;
      if (s) {
        const hay = `${t.ticket_number} ${t.description} ${categoryLabels[t.category || ""] || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [tickets, search, statusFilter, categoryFilter, priorityFilter, categoryLabels]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === "open").length;
    const closed = total - open;
    const closedT = tickets.filter(t => t.status !== "open" && t.updated_at);
    const avgMin = closedT.length
      ? Math.floor(closedT.reduce((a, t) => a + (new Date(t.updated_at!).getTime() - new Date(t.created_at).getTime()), 0) / closedT.length / 60000)
      : 0;
    const rate = total ? Math.round((closed / total) * 100) : 0;
    const critical = tickets.filter(t => detectPriority(t) === "critical").length;
    return { total, open, closed, avgMin, rate, critical };
  }, [tickets]);

  const pinnedTickets = useMemo(() => filtered.filter(t => pins.includes(t.id)), [filtered, pins]);
  const unpinnedFiltered = useMemo(() => filtered.filter(t => !pins.includes(t.id)), [filtered, pins]);

  const grouped = useMemo(() => {
    const m = new Map<string, EnhancedTicket[]>();
    unpinnedFiltered.forEach(t => {
      const k = dateGroup(t.created_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    });
    return Array.from(m.entries());
  }, [unpinnedFiltered]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach(t => t.category && set.add(t.category));
    return Array.from(set);
  }, [tickets]);

  function fmtAvg(min: number): string {
    if (!min) return "—";
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}j`;
    return `${Math.floor(h / 24)}h`;
  }

  function slaInfo(t: EnhancedTicket) {
    void tick;
    const elapsed = Date.now() - new Date(t.created_at).getTime();
    const total = SLA_HOURS * 3600000;
    const remainingMs = Math.max(0, total - elapsed);
    const pct = Math.min(100, Math.round((elapsed / total) * 100));
    return { remainingMs, pct, breached: remainingMs === 0 };
  }
  function fmtSla(ms: number): string {
    if (ms === 0) return "SLA terlewat";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
  }

  function rateTicket(id: string, stars: number) {
    saveRating(id, stars);
    setRatings(getRatings());
    toast({ title: `Rating ${stars} bintang tersimpan ⭐` });
    setRatingTicket(null);
  }

  function copyReply(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "📋 Saran balasan disalin", description: "Tempel di chat tiket" });
  }

  return (
    <div className="space-y-4">
      {/* HERO STATS — Live tracker */}
      <div className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ background: "linear-gradient(135deg, hsl(220, 90%, 56%) 0%, hsl(280, 80%, 55%) 50%, hsl(330, 85%, 58%) 100%)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/15 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-extrabold text-base">Tiket Cerdas</h3>
            </div>
            <Badge className="bg-white/25 text-white border-white/30 hover:bg-white/30 backdrop-blur">{stats.rate}% selesai</Badge>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            <StatChip icon={Inbox} label="Total" value={stats.total} />
            <StatChip icon={Activity} label="Aktif" value={stats.open} />
            <StatChip icon={CheckCircle2} label="Tutup" value={stats.closed} />
            <StatChip icon={Zap} label="Avg" value={fmtAvg(stats.avgMin)} />
            <StatChip icon={Flame} label="Urgent" value={stats.critical} highlight={stats.critical > 0} />
          </div>
          {/* Resolution bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] font-bold opacity-90 mb-1">
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Tingkat Penyelesaian</span>
              <span>{stats.closed}/{stats.total}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.rate}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-emerald-300 to-cyan-300 rounded-full shadow-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardContent className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari tiket, keyword, #nomor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background/60"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background/60 text-xs">
                <ListFilter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="open">🟢 Terbuka</SelectItem>
                <SelectItem value="closed">⚫ Selesai</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background/60 text-xs">
                <Tag className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {allCategories.map(c => (
                  <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 rounded-xl bg-background/60 text-xs">
              <Flame className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Prioritas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Prioritas</SelectItem>
              <SelectItem value="critical">🔥 Critical</SelectItem>
              <SelectItem value="high">🟠 High</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="low">🟢 Low</SelectItem>
            </SelectContent>
          </Select>
          {(search || statusFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all") && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
              <span>Menampilkan {filtered.length} dari {tickets.length} tiket</span>
              <button onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); setPriorityFilter("all"); }} className="font-bold text-primary hover:underline">Reset</button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PINNED SECTION */}
      {pinnedTickets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Pin className="w-3.5 h-3.5 text-primary fill-primary" />
            <span className="text-xs font-extrabold uppercase tracking-wide text-primary">Tiket Disematkan</span>
            <Badge variant="outline" className="text-[9px] py-0 h-4">{pinnedTickets.length}</Badge>
          </div>
          <div className="space-y-2">
            {pinnedTickets.map((t, idx) => renderTicketCard(t, idx, true))}
          </div>
        </div>
      )}

      {/* TIMELINE */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Filter className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-bold">Tidak ada tiket cocok</p>
          <p className="text-xs">Coba ubah filter atau pencarian</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div className="sticky top-0 z-10 -mx-1 px-1 py-1.5 mb-2 backdrop-blur-md bg-background/70">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                  <Badge variant="outline" className="text-[10px] font-bold gap-1 bg-background/80">
                    <Calendar className="w-3 h-3" /> {group}
                  </Badge>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>
              </div>

              <div className="relative pl-7">
                {/* connector line */}
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary/40 via-accent/40 to-primary/10" />

                {items.map((t, idx) => renderTicketCard(t, idx, false))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RATING DIALOG */}
      <AnimatePresence>
        {ratingTicket && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRatingTicket(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border"
            >
              <div className="text-center mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-2">
                  <Star className="w-7 h-7 text-white fill-white" />
                </div>
                <h3 className="font-extrabold text-lg">Beri Rating Layanan</h3>
                <p className="text-xs text-muted-foreground">Tiket #{ratingTicket.ticket_number}</p>
              </div>
              <div className="flex items-center justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => rateTicket(ratingTicket.id, star)}
                    className="transition-all hover:scale-125 active:scale-95"
                  >
                    <Star className={`w-9 h-9 ${(ratings[ratingTicket.id] || 0) >= star ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setRatingTicket(null)}>Batal</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl px-2 py-2 text-center border border-white/20">
      <Icon className="w-3.5 h-3.5 mx-auto mb-0.5 opacity-90" />
      <div className="text-[8px] uppercase font-bold opacity-80 leading-none">{label}</div>
      <div className="text-base font-extrabold leading-tight mt-0.5">{value}</div>
    </div>
  );
}

// ============ Smart Templates (export sebagai utilitas) =============
export interface TicketTemplate {
  id: string;
  label: string;
  emoji: string;
  category: string;
  description: string;
}

export const TICKET_TEMPLATES: TicketTemplate[] = [
  { id: "deposit-stuck", label: "Deposit Belum Masuk", emoji: "💰", category: "deposit", description: "Halo admin, saya sudah transfer untuk deposit pada [tanggal/jam], dengan nominal Rp [jumlah] menggunakan metode [BANK/E-wallet]. Mohon dicek karena saldo belum bertambah. Terima kasih." },
  { id: "voucher-fail", label: "Voucher Tidak Bisa Klaim", emoji: "🎟️", category: "voucher", description: "Saya mencoba klaim voucher dengan kode [KODE_VOUCHER] tapi muncul error/tidak bisa digunakan. Mohon bantuannya untuk mengecek status voucher tersebut." },
  { id: "refund-req", label: "Permohonan Refund", emoji: "↩️", category: "refund", description: "Saya ingin mengajukan refund untuk transaksi #TRX-XXXXXXX (tanggal [tgl], nominal Rp [jumlah]). Alasan: [jelaskan alasan refund]. Mohon prosesnya, terima kasih." },
  { id: "bug-report", label: "Lapor Bug Aplikasi", emoji: "🐛", category: "bug", description: "Saya menemukan bug di fitur [nama fitur]. Langkah reproduksi:\n1. [langkah 1]\n2. [langkah 2]\nHasil yang muncul: [error/perilaku tak normal].\nPerangkat: [HP/Browser]." },
  { id: "akun-locked", label: "Akun Terkunci / Lupa Password", emoji: "🔐", category: "akun", description: "Akun saya dengan username/email [USERNAME/EMAIL] tidak bisa diakses karena [lupa password / terkunci / dll]. Mohon bantuan reset/buka kunci." },
  { id: "produk-error", label: "Produk Bermasalah", emoji: "📦", category: "produk", description: "Saya membeli produk [nama produk] dengan ID transaksi [TRX-...]. Masalah: [tidak aktif/hilang/error]. Mohon dicek dan dibantu solusinya." },
  { id: "scam-report", label: "Lapor Penipu", emoji: "🚨", category: "penipu", description: "Saya ingin melaporkan akun/sponsor dengan ID/nama: [NAMA_AKUN]. Modus: [jelaskan modus penipuan]. Bukti terlampir di gambar. Mohon ditindaklanjuti." },
  { id: "saran", label: "Saran & Masukan", emoji: "💡", category: "saran", description: "Saya ingin memberikan masukan untuk pengembangan aplikasi: [tuliskan saran/ide fitur baru di sini]. Terima kasih sudah mendengarkan!" },
];

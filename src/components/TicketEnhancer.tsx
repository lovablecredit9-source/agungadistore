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
    if (!min) return "-";
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

  const PRIORITY_META: Record<string, { label: string; cls: string; icon: any }> = {
    critical: { label: "Critical", cls: "bg-red-500/15 text-red-600 border-red-500/40", icon: Flame },
    high:     { label: "High",     cls: "bg-orange-500/15 text-orange-600 border-orange-500/40", icon: ShieldAlert },
    medium:   { label: "Medium",   cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/40", icon: AlertCircle },
    low:      { label: "Low",      cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40", icon: CheckCircle2 },
  };
  const SENTIMENT_META: Record<string, { label: string; cls: string; icon: any }> = {
    urgent:   { label: "Urgent",   cls: "bg-red-500/15 text-red-600 border-red-500/40", icon: Flame },
    negative: { label: "Negatif",  cls: "bg-orange-500/15 text-orange-600 border-orange-500/40", icon: Frown },
    positive: { label: "Positif",  cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40", icon: Smile },
    neutral:  { label: "Netral",   cls: "bg-muted text-muted-foreground border-border", icon: Meh },
  };

  function renderTicketCard(t: EnhancedTicket, idx: number, isPinned: boolean) {
    const meta = STATUS_META[t.status] || STATUS_META.open;
    const Icon = meta.icon;
    const cat = categoryLabels[t.category || ""] || "Lainnya";
    const myRating = ratings[t.id] || 0;
    const priority = detectPriority(t);
    const pmeta = PRIORITY_META[priority];
    const sentiment = detectSentiment(t.description);
    const smeta = SENTIMENT_META[sentiment];
    const isOpen = t.status === "open";
    const sla = isOpen ? slaInfo(t) : null;
    const isPinnedNow = pins.includes(t.id);
    const isNotify = notify.includes(t.id);

    return (
      <motion.div
        key={t.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(idx * 0.04, 0.3) }}
        className="relative mb-3"
      >
        {!isPinned && (
          <div className={`absolute -left-[18px] top-3 w-6 h-6 rounded-full bg-gradient-to-br ${meta.bg} ring-4 ring-background flex items-center justify-center shadow-lg z-10`}>
            <Icon className="w-3 h-3 text-white" />
          </div>
        )}

        <Card className={`overflow-hidden hover:shadow-xl transition-all group border-border/60 bg-card/80 backdrop-blur ${priority === "critical" ? "ring-2 ring-red-500/40 shadow-red-500/10" : ""} ${isPinned ? "ring-1 ring-primary/40" : ""}`}>
          {/* Progress strip (status) */}
          <div className="h-1 bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${meta.pct}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full bg-gradient-to-r ${meta.bg}`}
            />
          </div>
          <CardContent className="p-3 cursor-pointer" onClick={() => onOpen(t)}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className="font-extrabold text-sm text-primary">#{t.ticket_number}</span>
                  <Badge className={`text-[9px] gap-0.5 bg-gradient-to-r ${meta.bg} text-white border-0 px-1.5 py-0`}>
                    <Icon className="w-2.5 h-2.5" />{meta.label}
                  </Badge>
                  <Badge variant="outline" className={`text-[9px] py-0 px-1.5 gap-0.5 border ${pmeta.cls}`}>
                    <pmeta.icon className="w-2.5 h-2.5" />{pmeta.label}
                  </Badge>
                  {isPinnedNow && (
                    <Pin className="w-3 h-3 text-primary fill-primary" />
                  )}
                </div>
                <p className="text-xs text-foreground line-clamp-2 leading-snug">{t.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* SLA Countdown for open tickets */}
            {sla && (
              <div className="mt-2 p-1.5 rounded-lg bg-muted/40 border border-border/50">
                <div className="flex items-center justify-between text-[9px] font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <Timer className={`w-3 h-3 ${sla.breached ? "text-red-500" : "text-primary"}`} />
                    SLA Response
                  </span>
                  <span className={sla.breached ? "text-red-500" : "text-foreground"}>
                    {sla.breached ? "⚠️ Terlewat" : `Sisa ${fmtSla(sla.remainingMs)}`}
                  </span>
                </div>
                <div className="h-1 bg-background rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${sla.breached ? "bg-red-500" : sla.pct > 75 ? "bg-orange-500" : "bg-gradient-to-r from-emerald-500 to-cyan-500"}`}
                    style={{ width: `${sla.pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center flex-wrap gap-1.5 mt-2">
              <Badge variant="outline" className="text-[9px] py-0 px-1.5 gap-0.5">
                <Tag className="w-2.5 h-2.5" /> {cat}
              </Badge>
              <Badge variant="outline" className="text-[9px] py-0 px-1.5 gap-0.5 text-muted-foreground">
                <Clock className="w-2.5 h-2.5" /> {timeAgo(t.created_at)}
              </Badge>
              <Badge variant="outline" className={`text-[9px] py-0 px-1.5 gap-0.5 border ${smeta.cls}`}>
                <smeta.icon className="w-2.5 h-2.5" /> {smeta.label}
              </Badge>
              {t.screenshot_url && (
                <Badge variant="outline" className="text-[9px] py-0 px-1.5 gap-0.5">
                  <AlertCircle className="w-2.5 h-2.5" /> Bukti
                </Badge>
              )}
              {myRating > 0 && (
                <Badge className="text-[9px] py-0 px-1.5 gap-0.5 bg-yellow-500/15 text-yellow-600 border-yellow-500/30 border">
                  <Star className="w-2.5 h-2.5 fill-current" /> {myRating}/5
                </Badge>
              )}
            </div>
          </CardContent>

          {/* Quick actions */}
          <div className="border-t border-border/60 px-2 py-1.5 flex items-center gap-0.5 bg-muted/30 overflow-x-auto scrollbar-none">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 shrink-0" onClick={(e) => { e.stopPropagation(); onOpen(t); }}>
              <MessageCircle className="w-3 h-3" /> Buka
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] gap-1 shrink-0 text-primary" onClick={(e) => { e.stopPropagation(); setAiTicket(t); }}>
              <Bot className="w-3 h-3" /> AI
            </Button>
            <Button size="sm" variant="ghost" className={`h-7 px-1.5 text-[10px] gap-1 shrink-0 ${isPinnedNow ? "text-primary" : ""}`} onClick={(e) => { e.stopPropagation(); togglePin(t.id); }}>
              {isPinnedNow ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
            </Button>
            {isOpen && (
              <Button size="sm" variant="ghost" className={`h-7 px-1.5 text-[10px] gap-1 shrink-0 ${isNotify ? "text-primary" : ""}`} onClick={(e) => { e.stopPropagation(); toggleNotify(t.id); }}>
                {isNotify ? <Bell className="w-3 h-3 fill-current" /> : <BellOff className="w-3 h-3" />}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] gap-1 shrink-0" onClick={(e) => { e.stopPropagation(); shareTicket(t); }}>
              <Share2 className="w-3 h-3" />
            </Button>
            {!isOpen && onReopen && (
              <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] gap-1 shrink-0 text-orange-500 hover:text-orange-600" onClick={(e) => { e.stopPropagation(); onReopen(t); }}>
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
            {!isOpen && (
              <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] gap-1 shrink-0 text-yellow-500 hover:text-yellow-600" onClick={(e) => { e.stopPropagation(); setRatingTicket(t); }}>
                <Star className="w-3 h-3" />
              </Button>
            )}
            {onDuplicate && (
              <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] gap-1 shrink-0 text-primary" onClick={(e) => { e.stopPropagation(); onDuplicate(t); }}>
                <Copy className="w-3 h-3" />
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HERO STATS - Live tracker */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-foreground" strokeWidth={1.7} />
            <h3 className="font-semibold text-sm text-foreground tracking-tight">Ringkasan Tiket</h3>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{stats.rate}% selesai</span>
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
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground mb-1">
            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" strokeWidth={1.8} /> Tingkat Penyelesaian</span>
            <span className="tabular-nums">{stats.closed}/{stats.total}</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.rate}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-foreground rounded-full"
            />
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

      {/* AI QUICK REPLY DIALOG */}
      <AnimatePresence>
        {aiTicket && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAiTicket(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-card rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-border max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-base">AI Saran Balasan</h3>
                  <p className="text-[10px] text-muted-foreground">Tiket #{aiTicket.ticket_number} • {categoryLabels[aiTicket.category || ""] || "Lainnya"}</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                {suggestReplies(aiTicket).map((rep, i) => (
                  <button
                    key={i}
                    onClick={() => copyReply(rep)}
                    className="w-full text-left p-3 rounded-xl border border-border bg-muted/30 hover:bg-primary/10 hover:border-primary/40 transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <p className="text-xs leading-snug flex-1">{rep}</p>
                      <Copy className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mb-2">💡 Tap saran untuk salin ke clipboard</p>
              <Button variant="outline" className="w-full" onClick={() => setAiTicket(null)}>Tutup</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`backdrop-blur rounded-xl px-1.5 py-2 text-center border ${highlight ? "bg-red-500/30 border-red-300/50 animate-pulse" : "bg-white/15 border-white/20"}`}>
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
  { id: "pesanan-pending", label: "Pesanan Belum Masuk", emoji: "🧾", category: "pesanan", description: "Saya sudah checkout pesanan #[TRX] pada [tanggal/jam], saldo sudah terpotong Rp [jumlah], tapi pesanan belum masuk/masih pending. Mohon dicek." },
  { id: "stok-salah", label: "Stok Habis / Salah", emoji: "📉", category: "stok", description: "Produk [nama produk] tertulis stok tersedia, tapi saat dibeli muncul stok habis / stok tidak sesuai. Mohon diperbarui datanya." },
  { id: "harga-salah", label: "Harga Tidak Sesuai", emoji: "🏷️", category: "harga", description: "Harga produk [nama produk] di halaman [lokasi] tertulis Rp [harga], tapi saat checkout jadi Rp [harga lain]. Mohon dicek diskon/harga grosirnya." },
  { id: "keranjang-error", label: "Keranjang / Checkout Error", emoji: "🛒", category: "keranjang", description: "Saat checkout keranjang muncul error: [pesan error]. Isi keranjang: [daftar produk]. Perangkat: [HP/Browser]." },
  { id: "garansi-klaim", label: "Klaim Garansi", emoji: "🛡️", category: "garansi", description: "Saya ingin klaim garansi untuk produk [nama produk], transaksi #[TRX] tanggal [tgl]. Kendala: [akun ditarik/tidak bisa login/dll]. Bukti terlampir." },
  { id: "rekber", label: "Rekber / Escrow", emoji: "🤝", category: "rekber", description: "Saya ingin menggunakan/menanyakan rekber untuk transaksi dengan [nama penjual/pembeli], nominal Rp [jumlah]. Detail barang: [deskripsi]." },
  { id: "chat-nores", label: "Chat Tidak Dibalas", emoji: "💬", category: "chat", description: "Saya sudah mengirim pesan di chat [produk/toko] sejak [tanggal/jam] tapi belum ada balasan. Mohon dibantu ditindaklanjuti." },
  { id: "pin-reset", label: "Reset PIN", emoji: "🔢", category: "pin", description: "Saya lupa PIN 6 digit akun saldo saya (email/nomor: [ISI]). Mohon bantuan proses reset PIN. Saya siap verifikasi data." },
  { id: "streak", label: "Streak / Koin Hilang", emoji: "🔥", category: "streak", description: "Daily streak saya reset/koin streak tidak bertambah padahal sudah klaim pada [tanggal]. Streak terakhir: [jumlah] hari. Mohon dicek." },
  { id: "gem-hilang", label: "Gem / Kredit Hilang", emoji: "💎", category: "gem", description: "Gem/kredit saya berkurang atau tidak bertambah setelah [pembelian/klaim misi] pada [tanggal/jam]. Jumlah seharusnya: [jumlah]. Mohon dicek." },
  { id: "game-error", label: "Game Error", emoji: "🎮", category: "game", description: "Game [nama game] error saat [mulai/main/selesai]. Pesan error: [isi]. Nyawa/kredit saya terpotong tanpa hasil. Mohon dibantu." },
  { id: "spin-error", label: "Spin / Lucky Royale", emoji: "🎡", category: "spin", description: "Saya spin di [Lucky Royale/Roda Diskon] pada [tanggal/jam], gem/tiket terpotong tapi hadiah tidak masuk. Mohon dicek riwayat spin saya." },
  { id: "firepass", label: "Fire Pass Bermasalah", emoji: "🔥", category: "firepass", description: "Saya sudah membeli Fire Pass Premium via [saldo/gem] pada [tanggal], tapi status masih Free / reward tier tidak bisa diklaim. Mohon dicek." },
  { id: "quest-claim", label: "Misi Tidak Terhitung", emoji: "🎯", category: "quest", description: "Misi [nama misi] sudah saya selesaikan tapi progres tidak bertambah / tidak bisa diklaim. Mohon dicek dan dibantu klaim manual." },
  { id: "premium", label: "Premium / Membership", emoji: "👑", category: "premium", description: "Saya membeli membership premium [1/2/6 bulan] pada [tanggal] nominal Rp [jumlah], tapi badge/benefit belum aktif. Mohon diaktifkan." },
  { id: "notif-off", label: "Notifikasi Tidak Masuk", emoji: "🔔", category: "notif", description: "Saya tidak menerima notifikasi [pembelian/chat/saldo] sejak [tanggal]. Perangkat: [HP/Browser]. Izin notifikasi sudah saya aktifkan." },
  { id: "telegram-bot", label: "Bot Telegram Error", emoji: "✈️", category: "telegram", description: "Bot Telegram tidak merespon/error saat perintah [/start atau lainnya]. Username Telegram saya: [@username]. Pesan error: [isi]." },
  { id: "wa-bot", label: "Bot WhatsApp Error", emoji: "🟢", category: "whatsapp", description: "Bot WhatsApp tidak membalas perintah [isi perintah] dari nomor [nomor saya] sejak [tanggal/jam]. Mohon dicek." },
  { id: "anonchat", label: "Anon Chat Bermasalah", emoji: "🕵️", category: "anonchat", description: "Anon Chat saya [tidak dapat pasangan/keluar sendiri/error login]. Detail: [jelaskan]. Mohon dibantu." },
  { id: "confess", label: "Confess / Wall Anonim", emoji: "📝", category: "confess", description: "Postingan confess saya [hilang/tidak muncul/dilaporkan keliru] pada [tanggal]. Isi singkat: [ringkasan]. Mohon dicek." },
  { id: "lagu-error", label: "Lagu Tidak Bisa Diputar", emoji: "🎵", category: "lagu", description: "Lagu [judul - artis] tidak bisa diputar / suara error / lirik tidak sinkron. Perangkat: [HP/Browser]. Mohon diperbaiki." },
  { id: "playlist", label: "Playlist Bermasalah", emoji: "🎧", category: "playlist", description: "Playlist [nama playlist] saya [hilang/tidak bisa ditambah lagu/error]. Mohon dicek datanya." },
  { id: "upload-lagu", label: "Upload Lagu Ditolak", emoji: "⬆️", category: "upload", description: "Lagu [judul] yang saya upload pada [tanggal] ditolak/masih pending review. Mohon dicek statusnya, saya pemilik/berhak atas karya tersebut." },
  { id: "artist", label: "Profil Artis", emoji: "🎤", category: "artist", description: "Saya ingin [menambahkan/mengubah] profil artis dengan nama [nama artis]. Detail: [bio/foto/link]. Terima kasih." },
  { id: "kuota-musik", label: "Kuota Penyimpanan Musik", emoji: "💾", category: "penyimpanan", description: "Kuota penyimpanan musik saya penuh/tidak bertambah setelah klaim voucher [KODE]. Kuota saat ini: [isi]. Mohon dicek." },
  { id: "profil-ubah", label: "Ubah Data Profil", emoji: "🙍", category: "profil", description: "Saya ingin mengubah [nama/nomor HP/email/foto profil] akun saldo saya dari [data lama] menjadi [data baru]. Mohon dibantu verifikasinya." },
  { id: "banned", label: "Akun Dibanned", emoji: "⛔", category: "banned", description: "Akun saya [username/email] terkena banned/pembatasan sejak [tanggal]. Saya merasa tidak melanggar karena [alasan]. Mohon peninjauan ulang." },
  { id: "device-code", label: "Login Kode Perangkat", emoji: "📱", category: "device", description: "Saya tidak bisa login dengan kode perangkat / kode tidak valid. Perangkat: [HP/Laptop], email akun: [ISI]. Mohon dibantu." },
  { id: "pwa-install", label: "Install Aplikasi / PWA", emoji: "📲", category: "pwa", description: "Saya kesulitan install aplikasi ke layar utama. Perangkat: [HP/Laptop], browser: [Chrome/Safari]. Kendala: [jelaskan]." },
  { id: "tampilan", label: "Tampilan / Tema Error", emoji: "🎨", category: "tampilan", description: "Tampilan aplikasi error di halaman [nama halaman] setelah mengganti [tema/bahasa]. Perangkat: [HP/Browser]. Screenshot terlampir." },
  { id: "sponsor", label: "Pasang Sponsor / Iklan", emoji: "📢", category: "sponsor", description: "Saya ingin memasang sponsor/iklan produk [nama produk]. Durasi: [hari/bulan]. Deskripsi & kontak: [isi]. Mohon info biayanya." },
  { id: "seller-daftar", label: "Daftar Jadi Seller", emoji: "🏪", category: "seller", description: "Saya ingin berjualan di aplikasi ini. Jenis produk: [isi]. Pengalaman jualan: [isi]. Kontak: [WA/Telegram]. Mohon info persyaratannya." },
  { id: "kerjasama", label: "Kerjasama / Partnership", emoji: "🤝", category: "kerjasama", description: "Saya ingin mengajukan kerjasama [reseller/afiliasi/endorse/lainnya]. Profil singkat: [isi]. Kontak: [isi]. Mohon ditindaklanjuti." },
  { id: "privasi", label: "Privasi / Hapus Data", emoji: "🔏", category: "privasi", description: "Saya ingin [menghapus data pribadi/mengetahui data yang disimpan] terkait akun [email/nomor]. Mohon diproses sesuai kebijakan privasi." },
  { id: "transaksi-double", label: "Transaksi Dobel", emoji: "🔁", category: "transaksi", description: "Saya terkena potongan saldo dua kali untuk transaksi yang sama (#[TRX1] dan #[TRX2]) pada [tanggal/jam]. Mohon salah satunya dikembalikan." },
  { id: "leaderboard", label: "Peringkat Tidak Update", emoji: "🏆", category: "leaderboard", description: "Peringkat/skor saya di leaderboard [nama leaderboard] tidak update sejak [tanggal]. Nama akun: [isi]. Mohon dicek." },
  { id: "lainnya", label: "Pertanyaan Umum", emoji: "❓", category: "lainnya", description: "Halo admin, saya ingin bertanya tentang [tuliskan pertanyaan kamu di sini]. Terima kasih sebelumnya." },
  { id: "deposit-nominal-beda", label: "Nominal Deposit Beda", emoji: "🧮", category: "deposit", description: "Saya transfer Rp [jumlah dikirim] tapi saldo yang masuk Rp [jumlah masuk] pada [tanggal/jam]. Bukti transfer terlampir. Mohon disesuaikan." },
  { id: "deposit-qris", label: "Deposit QRIS Gagal", emoji: "📷", category: "deposit", description: "Saya bayar deposit lewat QRIS pada [tanggal/jam] nominal Rp [jumlah], pembayaran sukses di aplikasi bank tapi saldo belum masuk. Bukti terlampir." },
  { id: "deposit-dana", label: "Deposit Dana/E-wallet", emoji: "🪙", category: "deposit", description: "Deposit via [Dana/OVO/GoPay/ShopeePay] pada [tanggal/jam] nominal Rp [jumlah] atas nama [nama pengirim] belum masuk. Mohon dicek." },
  { id: "deposit-cancel", label: "Batalkan Deposit", emoji: "🚫", category: "deposit", description: "Saya ingin membatalkan deposit dengan TX ID #[TRX] karena [alasan]. Belum saya bayar. Mohon dibatalkan." },
  { id: "saldo-kurang", label: "Saldo Berkurang Sendiri", emoji: "📉", category: "saldo", description: "Saldo saya berkurang Rp [jumlah] pada [tanggal/jam] tanpa saya melakukan transaksi. Riwayat terakhir: [isi]. Mohon dicek." },
  { id: "saldo-transfer", label: "Transfer Saldo", emoji: "🔄", category: "saldo", description: "Saya ingin menanyakan/menyelesaikan transfer saldo sebesar Rp [jumlah] ke akun [tujuan] pada [tanggal]. Status: [pending/gagal]. Mohon dibantu." },
  { id: "tarik-saldo", label: "Tarik / Withdraw Saldo", emoji: "🏧", category: "saldo", description: "Saya ingin menarik saldo sebesar Rp [jumlah] ke [Bank/E-wallet] a.n [nama] no [rekening]. Mohon info prosedur dan biayanya." },
  { id: "voucher-expired", label: "Voucher Kadaluarsa", emoji: "⏳", category: "voucher", description: "Voucher [KODE] saya kadaluarsa sebelum sempat dipakai / masa berlaku tidak sesuai keterangan. Mohon dicek atau diperpanjang." },
  { id: "voucher-follow", label: "Voucher Follow Belum Masuk", emoji: "⭐", category: "voucher", description: "Saya sudah follow toko pada [tanggal] tapi voucher Rp 1.000 belum masuk ke akun saya. Mohon dicek." },
  { id: "voucher-diskon", label: "Diskon Tidak Terpakai", emoji: "🏷️", category: "voucher", description: "Voucher diskon [KODE] tidak terpotong saat checkout produk [nama produk]. Total tetap Rp [jumlah]. Mohon dicek syarat kategorinya." },
  { id: "token-invalid", label: "Token Tidak Valid", emoji: "🔑", category: "produk", description: "Token yang saya terima dari transaksi #[TRX] tidak valid/sudah terpakai saat ditukar. Kode token: [16 karakter]. Mohon diganti." },
  { id: "produk-belum-kirim", label: "Produk Belum Dikirim", emoji: "⌛", category: "produk", description: "Transaksi #[TRX] tanggal [tgl] statusnya sukses tapi produk/akun belum saya terima. Mohon segera dikirim." },
  { id: "produk-salah", label: "Produk Salah Kirim", emoji: "❌", category: "produk", description: "Saya membeli [produk dipesan] tapi menerima [produk diterima] pada transaksi #[TRX]. Mohon ditukar/dikoreksi." },
  { id: "grosir", label: "Harga Grosir / Borongan", emoji: "📦", category: "harga", description: "Saya ingin membeli [nama produk] dalam jumlah [qty]. Mohon info harga grosir/borongan dan ketersediaan stoknya." },
  { id: "flashsale", label: "Flash Sale Bermasalah", emoji: "⚡", category: "harga", description: "Saat flash sale produk [nama produk], harga/kuota tidak sesuai atau tidak bisa checkout pada [tanggal/jam]. Mohon dicek." },
  { id: "bundle", label: "Paket / Bundle", emoji: "🎁", category: "produk", description: "Saya membeli paket/bundle [nama paket] tapi isi yang saya terima tidak lengkap: [isi yang kurang]. Transaksi #[TRX]." },
  { id: "wishlist", label: "Wishlist / Notif Harga", emoji: "❤️", category: "notif", description: "Notifikasi wishlist (turun harga/restock) untuk produk [nama produk] tidak saya terima padahal sudah masuk wishlist. Mohon dicek." },
  { id: "invoice", label: "Minta Invoice / Struk", emoji: "🧾", category: "transaksi", description: "Saya membutuhkan invoice/struk untuk transaksi #[TRX] tanggal [tgl] nominal Rp [jumlah]. Mohon dikirimkan filenya." },
  { id: "riwayat-hilang", label: "Riwayat Transaksi Hilang", emoji: "🗂️", category: "transaksi", description: "Riwayat transaksi saya hilang/tidak lengkap sejak [tanggal]. Transaksi yang hilang: #[TRX]. Mohon dipulihkan." },
  { id: "export-gagal", label: "Export Riwayat Gagal", emoji: "📤", category: "transaksi", description: "Saya gagal export riwayat transaksi ke [PDF/Word/TXT]. Pesan error: [isi]. Rentang tanggal: [isi]." },
  { id: "pembayaran-gagal", label: "Pembayaran Gagal", emoji: "💳", category: "transaksi", description: "Pembayaran transaksi #[TRX] gagal terus dengan pesan: [isi error]. Metode: [saldo/QRIS/e-wallet]. Mohon dibantu." },
  { id: "login-gagal", label: "Tidak Bisa Login", emoji: "🚪", category: "akun", description: "Saya tidak bisa login dengan [email/nomor/username]: [isi]. Pesan error: [isi]. Sudah coba reset password: [sudah/belum]." },
  { id: "akun-terkunci-bruteforce", label: "Akun Terkunci Sementara", emoji: "⏱️", category: "akun", description: "Akun saya terkunci karena salah password beberapa kali. Email: [isi]. Mohon dibuka lebih cepat, saya pemilik sah akun ini." },
  { id: "ganti-email", label: "Ganti Email Akun", emoji: "✉️", category: "akun", description: "Saya ingin mengganti email akun saldo dari [email lama] ke [email baru]. Saya masih ingat sandi lama. Mohon dibantu." },
  { id: "akun-dobel", label: "Akun Dobel / Gabung Akun", emoji: "👥", category: "akun", description: "Saya punya 2 akun ([akun A] dan [akun B]) dan ingin menggabungkan saldo/data ke satu akun: [akun tujuan]. Mohon dibantu." },
  { id: "verifikasi", label: "Verifikasi Identitas", emoji: "🪪", category: "akun", description: "Saya siap melakukan verifikasi identitas untuk keperluan [buka akun/klaim saldo/lainnya]. Data yang bisa saya berikan: [isi]." },
  { id: "2fa", label: "Masalah 2FA / OTP", emoji: "🔐", category: "pin", description: "Saya tidak bisa masuk karena kode 2FA/OTP tidak masuk atau selalu salah. Nomor/email terdaftar: [isi]. Mohon dibantu reset." },
  { id: "hack", label: "Akun Diretas", emoji: "🛑", category: "pin", description: "Saya menduga akun saya diretas pada [tanggal]. Ada aktivitas asing: [isi]. Mohon segera dibekukan dan dibantu pemulihan." },
  { id: "device-asing", label: "Login Perangkat Asing", emoji: "📡", category: "device", description: "Ada notifikasi login dari perangkat asing ([info perangkat]) pada [tanggal/jam] yang bukan saya. Mohon dicek dan keluarkan sesi tersebut." },
  { id: "logout-sendiri", label: "Sering Logout Sendiri", emoji: "🔁", category: "device", description: "Akun saya sering keluar sendiri setiap [waktu]. Perangkat: [HP/Browser]. Mohon dicek masalah sesinya." },
  { id: "kredit-game", label: "Kredit Game Habis Sendiri", emoji: "🕹️", category: "gem", description: "Kredit game saya berkurang [jumlah] tanpa saya main pada [tanggal/jam]. Mohon dicek riwayat pemakaiannya." },
  { id: "beli-gem", label: "Beli Gem Belum Masuk", emoji: "💠", category: "gem", description: "Saya membeli paket gem [nama paket] seharga Rp [jumlah] pada [tanggal], saldo terpotong tapi gem belum masuk. Mohon dicek." },
  { id: "tiket-spin", label: "Tiket Spin Tidak Masuk", emoji: "🎫", category: "spin", description: "Saya membeli tiket spin [Normal/Premium] sebanyak [jumlah] pada [tanggal], gem terpotong tapi tiket belum bertambah." },
  { id: "hadiah-spin", label: "Hadiah Spin Belum Masuk", emoji: "🎁", category: "spin", description: "Saya menang hadiah [nama hadiah] dari [Lucky Wheel/Scratch/Roda Diskon] pada [tanggal/jam] tapi hadiah belum masuk ke akun." },
  { id: "mystery-box", label: "Mystery Box / Gacha", emoji: "📦", category: "spin", description: "Mystery Box harian saya [tidak bisa dibuka/hadiah tidak masuk] pada [tanggal]. Mohon dicek." },
  { id: "auction", label: "Auction House", emoji: "🔨", category: "spin", description: "Saya ikut lelang item [nama item] pada [tanggal]. Kendala: [koin terpotong/item tidak masuk/bid gagal]. Mohon dicek." },
  { id: "referral", label: "Referral / Undangan", emoji: "🎟️", category: "quest", description: "Bonus referral dari teman saya [nama/kode] belum masuk padahal sudah terdaftar pada [tanggal]. Mohon dicek." },
  { id: "loyalty", label: "Loyalty Tier", emoji: "🥇", category: "premium", description: "Tier loyalty saya seharusnya [Bronze/Silver/Gold/Diamond] tapi masih [tier sekarang] padahal syarat sudah terpenuhi. Mohon dicek." },
  { id: "firepass-refund", label: "Fire Pass Salah Beli", emoji: "🧯", category: "firepass", description: "Saya salah membeli Fire Pass [Premium/PRO] pada [tanggal] senilai [Rp/gem]. Saya ingin [refund/ganti paket]. Mohon dibantu." },
  { id: "misi-gem-instan", label: "Gem Instan Misi", emoji: "⚡", category: "quest", description: "Saya pakai gem instan [jumlah] untuk menyelesaikan misi [nama misi] tapi misi tetap belum selesai. Mohon dicek." },
  { id: "badge", label: "Badge Tidak Muncul", emoji: "🎖️", category: "premium", description: "Badge [nama badge] saya tidak muncul di profil padahal syarat sudah terpenuhi pada [tanggal]. Mohon dicek." },
  { id: "lirik-salah", label: "Lirik Lagu Salah", emoji: "📜", category: "lagu", description: "Lirik lagu [judul - artis] salah/tidak sinkron mulai detik [waktu]. Mohon diperbaiki atau disinkronkan ulang." },
  { id: "offline-musik", label: "Musik Offline Error", emoji: "📴", category: "penyimpanan", description: "Lagu yang saya download untuk offline [hilang/tidak bisa diputar] setelah [kejadian]. Jumlah lagu: [isi]. Mohon dibantu." },
  { id: "komentar-hilang", label: "Komentar Dihapus", emoji: "💭", category: "lagu", description: "Komentar saya di lagu [judul] hilang/dihapus pada [tanggal] padahal tidak melanggar. Mohon peninjauan." },
  { id: "copyright", label: "Klaim Hak Cipta", emoji: "©️", category: "upload", description: "Saya pemilik hak cipta atas karya [judul] yang diunggah tanpa izin di aplikasi ini. Bukti kepemilikan: [isi]. Mohon ditindak." },
  { id: "sponsor-perpanjang", label: "Perpanjang Sponsor", emoji: "🔁", category: "sponsor", description: "Saya ingin memperpanjang sponsor ID #[ID] selama [durasi]. Mohon info total biaya dan cara pembayarannya." },
  { id: "sponsor-edit", label: "Edit Data Sponsor", emoji: "✏️", category: "sponsor", description: "Mohon bantuan mengubah data sponsor ID #[ID]: [judul/harga/foto/deskripsi/kontak] menjadi [isi baru]." },
  { id: "penipu-sponsor", label: "Sponsor Menipu", emoji: "⚠️", category: "penipu", description: "Sponsor ID #[ID] atas nama [nama] tidak mengirim barang setelah saya bayar Rp [jumlah] pada [tanggal]. Bukti chat & transfer terlampir." },
  { id: "rekber-sengketa", label: "Sengketa Rekber", emoji: "⚖️", category: "rekber", description: "Terjadi sengketa rekber #[ID] dengan [nama pihak lain]. Kronologi: [isi]. Bukti terlampir. Mohon ditengahi admin." },
  { id: "chat-spam", label: "Lapor Spam / Kasar", emoji: "🚯", category: "chat", description: "Saya menerima pesan spam/kata kasar dari akun [nama/ID] pada [tanggal/jam]. Isi pesan: [ringkasan]. Screenshot terlampir." },
  { id: "banned-chat", label: "Banned Anon Chat", emoji: "🔇", category: "banned", description: "Akun Anon Chat saya kena ban [7 hari] sejak [tanggal] karena [alasan sistem]. Saya merasa keliru karena [alasan]. Mohon peninjauan." },
  { id: "aplikasi-lambat", label: "Aplikasi Lambat", emoji: "🐌", category: "bug", description: "Aplikasi terasa sangat lambat/nge-lag di halaman [nama halaman] sejak [tanggal]. Perangkat: [HP/Browser], jaringan: [WiFi/Data]." },
  { id: "layar-putih", label: "Layar Putih / Blank", emoji: "⬜", category: "bug", description: "Saat membuka [halaman/fitur], layar jadi putih/blank total. Perangkat: [HP/Browser]. Sudah coba refresh & clear cache: [sudah/belum]." },
  { id: "gambar-error", label: "Gambar Tidak Muncul", emoji: "🖼️", category: "bug", description: "Gambar produk/foto profil tidak muncul di halaman [isi]. Perangkat: [HP/Browser]. Screenshot terlampir." },
  { id: "upload-gagal", label: "Upload Gambar Gagal", emoji: "📎", category: "bug", description: "Saya gagal upload gambar/bukti di [tiket/profil/chat]. Ukuran file: [isi] MB. Pesan error: [isi]." },
  { id: "terjemahan", label: "Terjemahan Bahasa Salah", emoji: "🌐", category: "tampilan", description: "Terjemahan di halaman [nama halaman] salah/aneh saat bahasa diubah ke [bahasa]. Contoh teks: [isi]." },
  { id: "darkmode", label: "Mode Gelap / Teks Tidak Terbaca", emoji: "🌙", category: "tampilan", description: "Di [mode gelap/terang], teks pada [komponen/halaman] tidak terbaca karena warnanya menyatu. Screenshot terlampir." },
  { id: "desktop-mode", label: "Mode Desktop Bermasalah", emoji: "🖥️", category: "tampilan", description: "Saat mode desktop diaktifkan di [laptop/PC], tampilan [rusak/terlalu lebar/menu hilang]. Resolusi layar: [isi]." },
  { id: "update-app", label: "Aplikasi Tidak Update", emoji: "🔄", category: "pwa", description: "Aplikasi saya masih versi lama ([versi]) padahal sudah ada update. Sudah coba refresh/clear cache: [sudah/belum]. Mohon dibantu." },
  { id: "info-jam", label: "Jam Operasional Admin", emoji: "🕒", category: "lainnya", description: "Halo admin, mohon info jam operasional layanan dan estimasi waktu balasan tiket. Terima kasih." },
  { id: "urgent", label: "Kendala Mendesak", emoji: "🆘", category: "lainnya", description: "MENDESAK: [jelaskan kendala]. Terjadi pada [tanggal/jam], terkait transaksi/akun: [isi]. Mohon prioritas penanganan." },
];

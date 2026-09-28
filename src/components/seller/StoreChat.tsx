import { orderCode } from "./orderCode";
import { SellerVerifiedBadge } from "./SellerVerifiedBadge";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, Search, Send, Paperclip, Smile, Zap, MoreVertical, Pin, Star, Archive, Tag, StickyNote, Flag,
  Package, ShoppingBag, User, Copy, Reply, Pencil, Trash2, Check, CheckCheck, X, FileText, MessageCircle, Loader2, Bot, MailWarning,
} from "lucide-react";
import AccountAvatar from "@/components/AccountAvatar";
import { useToast } from "@/hooks/use-toast";

const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const EMOJI = ["😀","😂","😊","😍","🙏","👍","👋","🔥","🎉","❤️","😢","😅","🤔","👌","✅","⏳","📦","💯","🙌","😎"];
const DEFAULT_QUICK = ["Halo kak 👋", "Pesanan sedang kami proses.", "Terima kasih sudah order.", "Silakan tunggu sebentar.", "Pesanan sudah dikirim.", "Apakah ada yang bisa kami bantu?"];
const BASE_LABELS: [string, string][] = [["Penting","🔴"],["Follow Up","🟡"],["Sudah Dibayar","🟢"],["Pesanan","🔵"],["Komplain","🟣"]];
const labelIcon = (l: string) => BASE_LABELS.find(([n]) => n === l)?.[1] || "🏷️";
type Filter = "semua" | "unread" | "order" | "unreplied" | "fav" | "archive";

function isOnline(ts?: string | null) { return !!ts && Date.now() - new Date(ts).getTime() < 2 * 60 * 1000; }
function lastSeen(ts?: string | null) {
  if (!ts) return "⚪ Offline";
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 2) return "🟢 Online";
  if (m < 60) return `⚪ Terakhir online ${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `⚪ Terakhir online ${h} jam lalu`;
  return `⚪ Terakhir online ${Math.floor(h / 24)} hari lalu`;
}
function shortTime(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}
function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.15);
  } catch { /* browser tanpa audio */ }
}

export default function StoreChat({ visitorId, role, openThreadId, buyerName }: {
  visitorId: string; role: "buyer" | "seller"; openThreadId?: string | null; buyerName?: string;
}) {
  const { toast } = useToast();
  const [threads, setThreads] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [ctx, setCtx] = useState<any>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [unreadAtOpen, setUnreadAtOpen] = useState(0);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("semua");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [inSearch, setInSearch] = useState(false);
  const [msgQ, setMsgQ] = useState("");
  const [tools, setTools] = useState<any>(null);
  const [dialog, setDialog] = useState<null | "profile" | "orders" | "product" | "labels" | "note" | "report" | "quick" | "auto">(null);
  const [pending, setPending] = useState<null | { kind: "image" | "file"; dataUrl?: string; file: File }>(null);
  const [noteText, setNoteText] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportOrder, setReportOrder] = useState<string>("");
  const [newQuick, setNewQuick] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [rule, setRule] = useState({ keyword: "", reply: "" });
  const [auto, setAuto] = useState({ enabled: false, text: "" });
  const [, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const unreadTotalRef = useRef<number | null>(null);
  const selRef = useRef<string | null>(null);
  selRef.current = selId;
  const isSeller = role === "seller";

  const loadList = useCallback(async () => {
    const { data, error } = await supabase.rpc("sc_list" as any, { p_visitor_id: visitorId, p_role: role });
    setLoadingList(false);
    if (error) return;
    const list = (data as any[]) || [];
    setThreads(list);
    const total = list.reduce((s, t) => s + (t.id === selRef.current ? 0 : Number(t.unread || 0)), 0);
    if (unreadTotalRef.current !== null && total > unreadTotalRef.current) beep();
    unreadTotalRef.current = total;
  }, [visitorId, role]);

  const loadMsgs = useCallback(async (id: string, first = false) => {
    if (first) setLoadingMsgs(true);
    const [{ data, error }, { data: c }] = await Promise.all([
      supabase.rpc("sc_messages" as any, { p_visitor_id: visitorId, p_thread_id: id }),
      supabase.rpc("sc_context" as any, { p_visitor_id: visitorId, p_thread_id: id }),
    ]);
    setLoadingMsgs(false);
    if (error) { toast({ title: error.message.includes("ACCESS DENIED") ? "ACCESS DENIED" : "Chat gagal dimuat", variant: "destructive" }); setSelId(null); return; }
    if (selRef.current !== id) return;
    setMsgs((data as any)?.messages || []);
    setCtx(c);
    if (first) setNoteText((c as any)?.note || "");
  }, [visitorId, toast]);

  const loadTools = useCallback(async () => {
    if (!isSeller) return;
    const [{ data }, { data: st }] = await Promise.all([
      supabase.rpc("sc_store_tools" as any, { p_visitor_id: visitorId }),
      supabase.from("seller_stores" as any).select("auto_reply_enabled,auto_reply_text").eq("visitor_id", visitorId).maybeSingle(),
    ]);
    setTools(data);
    if (st) setAuto({ enabled: !!(st as any).auto_reply_enabled, text: (st as any).auto_reply_text || "" });
  }, [visitorId, isSeller]);

  useEffect(() => { setLoadingList(true); setSelId(null); unreadTotalRef.current = null; loadList(); loadTools(); }, [loadList, loadTools]);
  useEffect(() => { if (openThreadId) setSelId(openThreadId); }, [openThreadId]);

  // presence heartbeat + refresh label waktu
  useEffect(() => {
    const ping = () => (supabase as any).rpc("touch_user_presence", { p_visitor_id: visitorId });
    ping();
    const a = setInterval(ping, 60000);
    const b = setInterval(() => { setTick((t) => t + 1); loadList(); }, 60000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [visitorId, loadList]);

  // realtime: hanya sinyal (ID percakapan), isi diambil lewat fungsi yang memeriksa hak akses
  useEffect(() => {
    let timer: any;
    const ch = supabase.channel(`store-chat-${role}-${visitorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_chat_signals" }, (payload: any) => {
        const tid = payload.new?.thread_id;
        clearTimeout(timer);
        timer = setTimeout(() => {
          loadList();
          if (tid && tid === selRef.current) loadMsgs(tid);
        }, 250);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [visitorId, role, loadList, loadMsgs]);

  useEffect(() => {
    if (!selId) return;
    const t = threads.find((x) => x.id === selId);
    setUnreadAtOpen(Number(t?.unread || 0));
    setMsgs([]); setCtx(null); setReplyTo(null); setEditing(null); setOrderRef(null); setInSearch(false); setMsgQ(""); setText("");
    loadMsgs(selId, true).then(loadList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  useEffect(() => { if (!inSearch) endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length, inSearch]);

  const sel = threads.find((t) => t.id === selId) || null;
  const partnerName = (t: any) => isSeller ? (t?.buyer_name || "Pembeli") : (t?.store_name || "Toko");
  const partnerVid = (t: any) => isSeller ? t?.buyer_visitor_id : t?.seller_visitor_id;
  const partnerAvatar = (t: any) => isSeller ? (t?.buyer_avatar ?? undefined) : (t?.store_avatar ?? null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter === "archive") { if (!t.seller_archived) return false; } else if (t.seller_archived) return false;
      if (filter === "unread" && !Number(t.unread)) return false;
      if (filter === "order" && !t.order_id) return false;
      if (filter === "unreplied" && t.last_sender !== (isSeller ? "buyer" : "seller")) return false;
      if (filter === "fav" && !t.seller_favorite) return false;
      if (!s) return true;
      return [partnerName(t), t.product_title, t.last_message_preview, t.order_number && "#" + t.order_number].some((v) => String(v || "").toLowerCase().includes(s));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, q, filter, isSeller]);

  const rpcErr = (error: any, title = "Gagal") => {
    if (!error) return false;
    toast({ title: String(error.message || "").includes("ACCESS DENIED") ? "ACCESS DENIED" : title, description: error.message, variant: "destructive" });
    return true;
  };

  async function send(extra: { kind?: string; payload?: any; image?: string; attachment?: { path: string; name: string; mime: string } } = {}) {
    if (!selId || sending) return;
    const body = text.trim();
    if (editing) {
      if (!body) return;
      setSending(true);
      const { error } = await supabase.rpc("sc_edit" as any, { p_visitor_id: visitorId, p_message_id: editing.id, p_message: body });
      setSending(false);
      if (rpcErr(error, "Gagal mengedit")) return;
      setEditing(null); setText(""); loadMsgs(selId); return;
    }
    if (!body && !extra.payload && !extra.image && !extra.attachment) return;
    setSending(true);
    const { error } = await supabase.rpc("sc_send" as any, {
      p_visitor_id: visitorId, p_thread_id: selId, p_message: extra.image || extra.attachment || extra.payload ? body : body,
      p_kind: extra.kind || (extra.image ? "image" : extra.attachment ? "file" : "text"), p_payload: extra.payload ?? null,
      p_image_url: extra.image ?? null, p_reply_to: replyTo?.id ?? null, p_order_ref: orderRef,
      p_attachment_path: extra.attachment?.path ?? null, p_attachment_name: extra.attachment?.name ?? null, p_attachment_mime: extra.attachment?.mime ?? null,
    });
    setSending(false);
    if (rpcErr(error, "Pesan gagal dikirim")) return;
    setText(""); setReplyTo(null);
    await loadMsgs(selId); loadList();
    inputRef.current?.focus();
  }

  async function pickFile(file?: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast({ title: "Ukuran file maksimal 5 MB", variant: "destructive" });
    if (file.type.startsWith("image/")) {
      try {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
        c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
        setPending({ kind: "image", dataUrl: c.toDataURL("image/jpeg", 0.75), file });
      } catch { toast({ title: "Gambar tidak bisa dibaca", variant: "destructive" }); }
    } else if (["application/pdf", "text/plain"].includes(file.type)) setPending({ kind: "file", file });
    else toast({ title: "Jenis file tidak diizinkan", description: "Gunakan foto, PDF, atau TXT.", variant: "destructive" });
  }

  async function sendPending() {
    if (!pending || !selId) return;
    if (pending.kind === "image" && pending.dataUrl) { await send({ image: pending.dataUrl }); setPending(null); return; }
    setSending(true);
    const buf = new Uint8Array(await pending.file.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const { data, error } = await supabase.functions.invoke("seller-shop", { body: { action: "chat_upload", visitorId, threadId: selId, mime: pending.file.type, base64: btoa(bin) } });
    setSending(false);
    if (error || data?.error) return toast({ title: "Upload gagal", description: data?.error || error?.message, variant: "destructive" });
    await send({ attachment: { path: data.path, name: pending.file.name, mime: pending.file.type } });
    setPending(null);
  }

  async function openFile(m: any) {
    const { data, error } = await supabase.functions.invoke("seller-shop", { body: { action: "chat_file_url", visitorId, threadId: selId, path: m.attachment_path } });
    if (error || data?.error) return toast({ title: "File tidak bisa dibuka", description: data?.error || error?.message, variant: "destructive" });
    window.open(data.url, "_blank", "noopener");
  }

  async function threadAction(field: string, value: any, msg?: string) {
    if (!selId) return;
    const { error } = await supabase.rpc("sc_thread_update" as any, { p_visitor_id: visitorId, p_thread_id: selId, p_field: field, p_value: value });
    if (rpcErr(error)) return;
    if (msg) toast({ title: msg });
    if (field === "unread" && value) setSelId(null);
    if (field === "archived" && value) setSelId(null);
    loadList(); if (field === "order") loadMsgs(selId);
  }

  async function toolSave(kind: string, action: string, data: any) {
    const { error } = await supabase.rpc("sc_store_tool_save" as any, { p_visitor_id: visitorId, p_kind: kind, p_action: action, p_data: data });
    if (rpcErr(error)) return false;
    await loadTools(); return true;
  }

  const copy = async (t: string, label = "Disalin") => { await navigator.clipboard?.writeText(t); toast({ title: label }); };
  const productLink = (id: string) => `${location.origin}/seller?product=${id}`;
  const quickList: { id?: string; text: string }[] = [...DEFAULT_QUICK.map((t) => ({ text: t })), ...((tools?.quick as any[]) || [])];
  const allLabels = [...BASE_LABELS.map(([n]) => n), ...((tools?.labels as string[]) || [])];
  const orders: any[] = ctx?.orders || [];
  const activeOrder = orders.find((o) => o.id === sel?.order_id) || null;
  const msgById = useMemo(() => new Map(msgs.map((m) => [m.id, m])), [msgs]);
  const visibleMsgs = inSearch && msgQ.trim() ? msgs.filter((m) => !m.deleted_at && String(m.message || "").toLowerCase().includes(msgQ.trim().toLowerCase())) : msgs;
  const partnerMsgIdx = msgs.map((m, i) => (m.sender !== role ? i : -1)).filter((i) => i >= 0);
  const dividerIdx = unreadAtOpen > 0 && partnerMsgIdx.length >= unreadAtOpen ? partnerMsgIdx[partnerMsgIdx.length - unreadAtOpen] : -1;

  const filters: [Filter, string][] = [["semua","Semua"],["unread","Belum Dibaca"],["order","Pesanan"],["unreplied","Belum Dibalas"],["fav","Favorit"],["archive","Arsip"]];

  /* ---------------- DAFTAR ---------------- */
  const list = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari chat, produk, order…" className="h-9 pl-8 text-xs" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {filters.filter(([k]) => isSeller || !["fav","archive"].includes(k)).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={"shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold " + (filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{l}</button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadingList && [0,1,2,3].map((i) => <div key={i} className="flex gap-2 p-3"><Skeleton className="h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-full" /></div></div>)}
        {!loadingList && shown.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><MessageCircle className="h-7 w-7 text-primary" /></div>
            <p className="text-sm font-bold">{threads.length ? "Tidak ada chat yang cocok" : "Belum ada percakapan"}</p>
            <p className="text-xs text-muted-foreground">{threads.length ? "Coba ubah pencarian atau filter." : isSeller ? "Pesan dari pembeli akan muncul di sini." : "Chat dengan toko dari halaman produk."}</p>
          </div>
        )}
        {shown.map((t) => (
          <button key={t.id} onClick={() => setSelId(t.id)} className={"flex w-full gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors " + (selId === t.id ? "bg-primary/10" : "hover:bg-muted/50")}>
            <div className="relative shrink-0">
              <AccountAvatar visitorId={partnerVid(t)} username={partnerName(t)} avatarUrl={partnerAvatar(t)} size={44} />
              <span className={"absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background " + (isOnline(t.partner_last_seen) ? "bg-primary" : "bg-muted-foreground/40")} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                {t.seller_pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                {t.seller_favorite && <Star className="h-3 w-3 shrink-0 fill-primary text-primary" />}
                <span className={"truncate text-xs " + (Number(t.unread) ? "font-black" : "font-semibold")}>{partnerName(t)}</span>
                 {!isSeller && <SellerVerifiedBadge verified={t.store_verified}/>}
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{shortTime(t.last_message_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={"truncate text-[11px] " + (Number(t.unread) ? "font-semibold text-foreground" : "text-muted-foreground")}>{t.last_sender === role ? "Anda: " : ""}{t.last_message_preview || "Belum ada pesan"}</span>
                {Number(t.unread) > 0 && <span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{t.unread}</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
                {t.order_number && <span className="rounded bg-muted px-1 font-semibold">Order #{t.order_number}</span>}
                {t.product_title && <span className="max-w-[140px] truncate">🛍️ {t.product_title}</span>}
                {(t.seller_labels || []).map((l: string) => <span key={l}>{labelIcon(l)} {l}</span>)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  /* ---------------- RUANG CHAT ---------------- */
  const room = sel && (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setSelId(null)} aria-label="Kembali"><ArrowLeft className="h-5 w-5" /></Button>
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setDialog("profile")}>
          <AccountAvatar visitorId={partnerVid(sel)} username={partnerName(sel)} avatarUrl={partnerAvatar(sel)} size={38} />
          <span className="min-w-0">
             <span className="flex items-center gap-1 text-sm font-bold"><span className="truncate">{partnerName(sel)}</span>{!isSeller && <SellerVerifiedBadge verified={sel.store_verified}/>}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{lastSeen(sel.partner_last_seen)}{isSeller && <> · ID {String(sel.buyer_visitor_id).slice(0, 8)}</>}{sel.order_number && <> · Order #{sel.order_number}</>}</span>
          </span>
        </button>
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setInSearch((v) => !v)} aria-label="Cari dalam chat"><Search className="h-4 w-4" /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="Menu chat"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setDialog("profile")}><User className="mr-2 h-4 w-4" />{isSeller ? "Lihat Profil Pembeli" : "Info Toko"}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog("orders")}><Package className="mr-2 h-4 w-4" />Lihat Pesanan</DropdownMenuItem>
            {isSeller && <>
              <DropdownMenuItem onClick={() => setDialog("product")}><ShoppingBag className="mr-2 h-4 w-4" />Kirim Produk</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => threadAction("unread", true, "Ditandai belum dibaca")}><MailWarning className="mr-2 h-4 w-4" />Tandai Belum Dibaca</DropdownMenuItem>
              <DropdownMenuItem onClick={() => threadAction("pinned", !sel.seller_pinned, sel.seller_pinned ? "Unpin" : "📌 Chat dipin")}><Pin className="mr-2 h-4 w-4" />{sel.seller_pinned ? "Unpin" : "📌 Pin Chat"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => threadAction("favorite", !sel.seller_favorite, sel.seller_favorite ? "Dihapus dari favorit" : "⭐ Ditambahkan ke favorit")}><Star className="mr-2 h-4 w-4" />{sel.seller_favorite ? "Hapus Favorit" : "Favorit"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("labels")}><Tag className="mr-2 h-4 w-4" />Label</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("note")}><StickyNote className="mr-2 h-4 w-4" />Catatan Internal</DropdownMenuItem>
              <DropdownMenuItem onClick={() => threadAction("archived", !sel.seller_archived, sel.seller_archived ? "Dikeluarkan dari arsip" : "Chat diarsipkan")}><Archive className="mr-2 h-4 w-4" />{sel.seller_archived ? "Keluarkan dari Arsip" : "Arsipkan"}</DropdownMenuItem>
            </>}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => { setReportOrder(sel.order_id || ""); setDialog("report"); }}><Flag className="mr-2 h-4 w-4" />Hubungi / Lapor Admin</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {inSearch && <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input autoFocus value={msgQ} onChange={(e) => setMsgQ(e.target.value)} placeholder="🔍 Cari dalam chat…" className="h-8 text-xs" />
        <span className="shrink-0 text-[10px] text-muted-foreground">{msgQ.trim() ? `${visibleMsgs.length} hasil` : ""}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setInSearch(false); setMsgQ(""); }}><X className="h-4 w-4" /></Button>
      </div>}

      {(ctx?.product || orders.length > 0) && !inSearch && <div className="space-y-1.5 border-b border-border bg-muted/30 px-3 py-2">
        {ctx?.product && <div className="flex items-center gap-2">
          <img src={ctx.product.image_url || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-md object-cover" />
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold">{ctx.product.title}</p><p className="text-[10px] text-muted-foreground">{rp(ctx.product.promo_price || ctx.product.price)} · {Number(ctx.product.stock) > 0 ? `Stok ${ctx.product.stock}` : "Stok habis"}</p></div>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => window.location.assign(productLink(ctx.product.id))}>Lihat</Button>
        </div>}
        {orders.length > 0 && <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {orders.slice(0, 10).map((o) => (
            <button key={o.id} disabled={!isSeller} onClick={() => threadAction("order", sel.order_id === o.id ? null : o.id)}
              className={"shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold " + (sel.order_id === o.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>Order {orderCode(o)}</button>
          ))}
          <button className="shrink-0 text-[10px] font-semibold text-primary underline" onClick={() => setDialog("orders")}>Lihat Pesanan</button>
        </div>}
        {activeOrder && <p className="text-[10px] text-muted-foreground">Dibahas: <b>Order {orderCode(activeOrder)}</b> · {activeOrder.product_title} ×{activeOrder.qty} · {rp(activeOrder.total)} · {activeOrder.paid_at ? "Sudah dibayar" : "Belum dibayar"} · {activeOrder.status}</p>}
      </div>}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {loadingMsgs && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!loadingMsgs && visibleMsgs.length === 0 && <p className="py-10 text-center text-xs text-muted-foreground">{inSearch ? "Tidak ada pesan yang cocok." : `Belum ada pesan. Sapa ${isSeller ? "pembeli" : "penjual"} di sini 👋`}</p>}
        {visibleMsgs.map((m) => {
          const mine = m.sender === role;
          const idx = msgs.indexOf(m);
          const replied = m.reply_to_id ? msgById.get(m.reply_to_id) : null;
          const canEdit = mine && !m.deleted_at && m.kind === "text" && Date.now() - new Date(m.created_at).getTime() < 15 * 60000;
          const canDelete = mine && !m.deleted_at && Date.now() - new Date(m.created_at).getTime() < 5 * 60000;
          return <div key={m.id}>
            {!inSearch && idx === dividerIdx && <div className="my-2 flex items-center gap-2 text-[10px] font-semibold text-primary"><span className="h-px flex-1 bg-primary/40" />Pesan belum dibaca<span className="h-px flex-1 bg-primary/40" /></div>}
            <div className={"flex " + (mine ? "justify-end" : "justify-start")}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={!!m.deleted_at}>
                  <div role="button" tabIndex={0} className={"max-w-[80%] cursor-pointer rounded-2xl px-3 py-2 text-xs shadow-sm " + (mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground")}>
                    {m.kind === "auto" && <p className={"mb-0.5 flex items-center gap-1 text-[9px] font-semibold " + (mine ? "text-primary-foreground/80" : "text-muted-foreground")}><Bot className="h-3 w-3" />Balasan otomatis</p>}
                    {m.order_ref_number && <p className={"mb-1 text-[9px] font-semibold " + (mine ? "text-primary-foreground/80" : "text-primary")}>Tentang Order #{m.order_ref_number}</p>}
                    {replied && <div className={"mb-1 rounded-md border-l-2 px-2 py-1 text-[10px] " + (mine ? "border-primary-foreground/60 bg-primary-foreground/10" : "border-primary bg-background/60")}><p className="truncate">{replied.deleted_at ? "Pesan dihapus" : replied.message || (replied.image_url ? "📷 Foto" : "Lampiran")}</p></div>}
                    {m.deleted_at ? <i className="opacity-70">Pesan dihapus</i> : <>
                      {m.kind === "order" && m.payload && <div className="mb-1 rounded-lg border border-current/30 p-2"><p className="font-bold">🧾 Order #{m.payload.order_code || m.payload.order_number}</p><p>{m.payload.title} ×{m.payload.qty}</p><p>{rp(m.payload.total)}</p></div>}
                      {m.kind === "product" && m.payload && <div className="mb-1 w-52 overflow-hidden rounded-lg border border-current/20 bg-background text-foreground">
                        {m.payload.image_url && <img src={m.payload.image_url} className="h-28 w-full object-cover" alt="" />}
                        <div className="space-y-0.5 p-2"><p className="line-clamp-2 font-bold">{m.payload.title}</p><p className="font-semibold text-primary">{rp(m.payload.price)}</p><p className="text-[10px] text-muted-foreground">{Number(m.payload.stock) > 0 ? `Stok ${m.payload.stock}` : "Stok habis"}</p>
                          <div className="flex gap-1 pt-1">
                            <Button size="sm" className="h-7 flex-1 text-[10px]" onClick={(e) => { e.stopPropagation(); window.location.assign(productLink(m.payload.id)); }}>Lihat Produk</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2" aria-label="Salin Link Produk" onClick={(e) => { e.stopPropagation(); copy(productLink(m.payload.id), "Link produk disalin"); }}><Copy className="h-3 w-3" /></Button>
                          </div></div>
                      </div>}
                      {m.image_url && <img src={m.image_url} className="mb-1 max-h-60 rounded-lg" alt="Foto chat" onClick={(e) => { e.stopPropagation(); window.open(m.image_url, "_blank"); }} />}
                      {m.attachment_path && <button onClick={(e) => { e.stopPropagation(); openFile(m); }} className={"mb-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left " + (mine ? "border-primary-foreground/40" : "border-border")}><FileText className="h-5 w-5 shrink-0" /><span className="truncate text-[11px] font-semibold">{m.attachment_name || "File"}</span></button>}
                      {m.message && m.message !== "📷 Foto" && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
                    </>}
                    <p className={"mt-0.5 flex items-center justify-end gap-1 text-[9px] " + (mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                      {m.edited_at && !m.deleted_at && <span>diedit ·</span>}
                      {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      {mine && (m.read_at ? <CheckCheck className="h-3 w-3" aria-label="Dibaca" /> : m.delivered_at ? <CheckCheck className="h-3 w-3 opacity-60" aria-label="Diterima" /> : <Check className="h-3 w-3" aria-label="Terkirim" />)}
                    </p>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={mine ? "end" : "start"}>
                  <DropdownMenuItem onClick={() => { setReplyTo(m); setEditing(null); inputRef.current?.focus(); }}><Reply className="mr-2 h-4 w-4" />Balas</DropdownMenuItem>
                  {m.message && <DropdownMenuItem onClick={() => copy(m.message, "Pesan disalin")}><Copy className="mr-2 h-4 w-4" />Salin</DropdownMenuItem>}
                  {canEdit && <DropdownMenuItem onClick={() => { setEditing(m); setReplyTo(null); setText(m.message); inputRef.current?.focus(); }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>}
                  {canDelete && <DropdownMenuItem className="text-destructive" onClick={async () => { const { error } = await supabase.rpc("sc_delete" as any, { p_visitor_id: visitorId, p_message_id: m.id }); if (!rpcErr(error, "Gagal menghapus")) loadMsgs(selId!); }}><Trash2 className="mr-2 h-4 w-4" />Hapus</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>;
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {(replyTo || editing) && <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-2 py-1">
          <p className="min-w-0 flex-1 truncate text-[11px]">{editing ? "Mengedit pesan" : <>Membalas: "{replyTo.message || (replyTo.image_url ? "📷 Foto" : "Lampiran")}"</>}</p>
          <button onClick={() => { setReplyTo(null); if (editing) { setEditing(null); setText(""); } }} aria-label="Batal"><X className="h-4 w-4" /></button>
        </div>}
        {orders.length > 0 && <div className="mb-1.5 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          <span className="shrink-0 text-[10px] text-muted-foreground">Tentang:</span>
          {orders.slice(0, 6).map((o) => <button key={o.id} onClick={() => setOrderRef(orderRef === o.id ? null : o.id)} className={"shrink-0 rounded-full border px-2 py-0.5 text-[10px] " + (orderRef === o.id ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground")}>{orderCode(o)}</button>)}
        </div>}
        <div className="flex items-end gap-1">
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; pickFile(f); }} />
          <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={() => fileRef.current?.click()} disabled={sending || !!editing} aria-label="Lampirkan file"><Paperclip className="h-4 w-4" /></Button>
          <Popover>
            <PopoverTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" aria-label="Emoji"><Smile className="h-4 w-4" /></Button></PopoverTrigger>
            <PopoverContent className="grid w-64 grid-cols-5 gap-1 p-2">{EMOJI.map((e) => <button key={e} className="rounded p-1 text-xl hover:bg-muted" onClick={() => { setText((t) => t + e); inputRef.current?.focus(); }}>{e}</button>)}</PopoverContent>
          </Popover>
          {isSeller && <Popover>
            <PopoverTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" aria-label="Quick Reply"><Zap className="h-4 w-4" /></Button></PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <p className="mb-1 px-1 text-[11px] font-bold">⚡ Quick Reply</p>
              <div className="max-h-56 space-y-0.5 overflow-y-auto">{quickList.map((qr, i) => <button key={qr.id || i} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => { setText(qr.text); inputRef.current?.focus(); }}>{qr.text}</button>)}</div>
              <Button size="sm" variant="outline" className="mt-1 h-7 w-full text-[10px]" onClick={() => setDialog("quick")}>Kelola template & Auto Reply</Button>
            </PopoverContent>
          </Popover>}
          <Textarea ref={inputRef} rows={1} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-28 min-h-10 flex-1 resize-none py-2 text-sm" />
          <Button size="icon" className="h-10 w-10 shrink-0" onClick={() => send()} disabled={sending || !text.trim()} aria-label="Kirim pesan">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid h-[calc(100dvh-220px)] min-h-[520px] md:grid-cols-[300px_1fr]">
        <div className={"min-h-0 border-r border-border " + (sel ? "hidden md:block" : "block")}>{list}</div>
        {sel ? <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col md:static md:z-auto md:h-auto md:min-h-0">{room}</div>
          : <div className="hidden flex-col items-center justify-center gap-2 text-center md:flex"><MessageCircle className="h-10 w-10 text-muted-foreground/50" /><p className="text-sm font-semibold">Pilih percakapan</p><p className="text-xs text-muted-foreground">Semua {isSeller ? "pembeli" : "toko"} yang menghubungi Anda ada di kiri.</p></div>}
      </div>

      {/* Pratinjau lampiran */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Kirim {pending?.kind === "image" ? "gambar" : "file"}</DialogTitle></DialogHeader>
          {pending?.kind === "image" ? <img src={pending.dataUrl} alt="Pratinjau" className="max-h-72 w-full rounded-lg object-contain" /> :
            <div className="flex items-center gap-2 rounded-lg border p-3"><FileText className="h-8 w-8 text-primary" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{pending?.file.name}</p><p className="text-[11px] text-muted-foreground">{((pending?.file.size || 0) / 1024).toFixed(0)} KB</p></div></div>}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Tambahkan keterangan (opsional)" rows={2} className="text-sm" />
          <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setPending(null)}>Batal</Button><Button className="flex-1" onClick={sendPending} disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim"}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Profil pembeli / toko */}
      <Dialog open={dialog === "profile"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{isSeller ? "Profil Pembeli" : "Info Toko"}</DialogTitle></DialogHeader>
          {sel && <div className="space-y-3">
            <div className="flex items-center gap-3"><AccountAvatar visitorId={partnerVid(sel)} username={partnerName(sel)} avatarUrl={partnerAvatar(sel)} size={52} />
               <div className="min-w-0"><p className="flex items-center gap-1 font-bold"><span className="truncate">{partnerName(sel)}</span>{!isSeller && <SellerVerifiedBadge verified={sel.store_verified}/>}</p><p className="text-[11px] text-muted-foreground">{lastSeen(sel.partner_last_seen)}</p>{isSeller && <p className="text-[10px] text-muted-foreground">ID akun {String(sel.buyer_visitor_id).slice(0, 8)}</p>}</div></div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Total order", ctx?.stats?.total_orders ?? 0], ["Order aktif", ctx?.stats?.active_orders ?? 0], ["Total belanja", rp(ctx?.stats?.total_spent ?? 0)]].map(([l, v]) => <div key={l as string} className="rounded-lg border p-2"><p className="text-xs font-black">{v}</p><p className="text-[9px] text-muted-foreground">{l}</p></div>)}
            </div>
            {isSeller && ctx?.buyer_since && <p className="text-[11px] text-muted-foreground">Bergabung sejak {new Date(ctx.buyer_since).toLocaleDateString("id-ID", { dateStyle: "medium" })}</p>}
            {!isSeller && <Button variant="outline" className="w-full" onClick={() => window.location.assign(`${location.origin}/seller?store=${sel.store_id}`)}>Lihat Toko</Button>}
          </div>}
        </DialogContent>
      </Dialog>

      {/* Pesanan */}
      <Dialog open={dialog === "orders"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Pesanan {isSeller ? "pembeli ini" : "di toko ini"}</DialogTitle></DialogHeader>
          {orders.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Belum ada pesanan.</p>}
          <div className="space-y-2">{orders.map((o) => <div key={o.id} className={"rounded-lg border p-2.5 text-xs " + (o.id === sel?.order_id ? "border-primary" : "")}>
            <div className="flex items-center justify-between"><p className="font-bold">Order {orderCode(o)}</p><Badge variant="outline" className="text-[9px]">{o.status}</Badge></div>
            <p className="mt-1">{o.product_title} × {o.qty}</p>
            <p className="font-semibold">{rp(o.total)}</p>
            <p className="text-[10px] text-muted-foreground">{o.paid_at ? "Pembayaran berhasil" : "Belum dibayar"} · Dana: {o.escrow_status} · {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
            <div className="mt-1.5 flex gap-1">
              {isSeller && <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { threadAction("order", o.id, `Membahas Order ${orderCode(o)}`); setDialog(null); }}>Bahas di chat</Button>}
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => copy(orderCode(o), "Nomor pesanan disalin")}><Copy className="mr-1 h-3 w-3" />Salin</Button>
            </div>
          </div>)}</div>
        </DialogContent>
      </Dialog>

      {/* Kirim produk */}
      <Dialog open={dialog === "product"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Kirim Produk</DialogTitle></DialogHeader>
          {!(tools?.products || []).length && <p className="py-6 text-center text-xs text-muted-foreground">Belum ada produk di toko.</p>}
          <div className="space-y-1.5">{(tools?.products || []).map((p: any) => <div key={p.id} className="flex items-center gap-2 rounded-lg border p-2">
            <img src={p.image_url || "/placeholder.svg"} alt="" className="h-11 w-11 rounded object-cover" />
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{p.title}</p><p className="text-[10px] text-muted-foreground">{rp(p.promo_price || p.price)} · {Number(p.stock) > 0 ? `Stok ${p.stock}` : "Stok habis"}</p></div>
            <Button size="sm" className="h-7 text-[10px]" onClick={async () => { setDialog(null); await send({ kind: "product", payload: { id: p.id, title: p.title, price: p.promo_price || p.price, stock: p.stock, image_url: p.image_url } }); }}>Kirim</Button>
          </div>)}</div>
        </DialogContent>
      </Dialog>

      {/* Label */}
      <Dialog open={dialog === "labels"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Label Chat</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-1.5">{allLabels.map((l) => { const on = (sel?.seller_labels || []).includes(l); return <button key={l} onClick={() => threadAction("labels", on ? sel.seller_labels.filter((x: string) => x !== l) : [...(sel?.seller_labels || []), l])} className={"rounded-full border px-2.5 py-1 text-xs " + (on ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border")}>{labelIcon(l)} {l}</button>; })}</div>
          <div className="flex gap-2"><Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={30} placeholder="Label baru" className="h-9 text-xs" /><Button size="sm" onClick={async () => { if (newLabel.trim() && await toolSave("label", "add", { name: newLabel.trim() })) setNewLabel(""); }}>Tambah</Button></div>
          {(tools?.labels || []).length > 0 && <div className="flex flex-wrap gap-1">{tools.labels.map((l: string) => <button key={l} className="text-[10px] text-destructive underline" onClick={() => toolSave("label", "delete", { name: l })}>Hapus "{l}"</button>)}</div>}
        </DialogContent>
      </Dialog>

      {/* Catatan internal */}
      <Dialog open={dialog === "note"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Catatan Internal</DialogTitle></DialogHeader>
          <p className="text-[11px] text-muted-foreground">Hanya terlihat oleh Anda dan admin. Tidak dikirim ke pembeli.</p>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} maxLength={2000} rows={5} placeholder="Contoh: Buyer sering membeli voucher nominal besar." className="text-sm" />
          <Button onClick={async () => { const { error } = await supabase.rpc("sc_note_save" as any, { p_visitor_id: visitorId, p_thread_id: selId, p_note: noteText }); if (!rpcErr(error)) { toast({ title: "Catatan disimpan" }); setDialog(null); } }}>Simpan Catatan</Button>
        </DialogContent>
      </Dialog>

      {/* Lapor admin */}
      <Dialog open={dialog === "report"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Hubungi Admin</DialogTitle></DialogHeader>
          <p className="text-[11px] text-muted-foreground">Laporan dikirim ke admin beserta 20 pesan terakhir sebagai konteks. Chat tidak dihapus.</p>
          {orders.length > 0 && <select value={reportOrder} onChange={(e) => setReportOrder(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs">
            <option value="">Tanpa pesanan</option>{orders.map((o) => <option key={o.id} value={o.id}>Order {orderCode(o)} — {o.product_title}</option>)}
          </select>}
          <Textarea value={reportText} onChange={(e) => setReportText(e.target.value)} maxLength={1000} rows={4} placeholder="Jelaskan masalahnya…" className="text-sm" />
          <Button variant="destructive" disabled={!reportText.trim()} onClick={async () => {
            const { data, error } = await supabase.rpc("sc_report" as any, { p_visitor_id: visitorId, p_thread_id: selId, p_order_id: reportOrder || null, p_description: reportText });
            if (!rpcErr(error, "Laporan gagal")) { toast({ title: `🚩 Laporan #${data} terkirim ke admin` }); setReportText(""); setDialog(null); }
          }}>Kirim Laporan</Button>
        </DialogContent>
      </Dialog>

      {/* Quick reply & auto reply */}
      <Dialog open={dialog === "quick"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[88dvh] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>⚡ Quick Reply & Auto Reply</DialogTitle></DialogHeader>
          <section className="space-y-2">
            <p className="text-xs font-bold">Template saya</p>
            {(tools?.quick || []).length === 0 && <p className="text-[11px] text-muted-foreground">Belum ada template buatan sendiri. 6 template bawaan selalu tersedia.</p>}
            {(tools?.quick || []).map((qr: any) => <div key={qr.id} className="flex items-center gap-2 rounded border px-2 py-1 text-xs"><span className="flex-1">{qr.text}</span><button onClick={() => toolSave("quick", "delete", { id: qr.id })} aria-label="Hapus template"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></div>)}
            <div className="flex gap-2"><Input value={newQuick} onChange={(e) => setNewQuick(e.target.value)} maxLength={500} placeholder="Template baru" className="h-9 text-xs" /><Button size="sm" onClick={async () => { if (newQuick.trim() && await toolSave("quick", "add", { text: newQuick.trim() })) setNewQuick(""); }}>Simpan</Button></div>
          </section>
          <section className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between"><p className="text-xs font-bold">Auto Reply</p><Switch checked={auto.enabled} onCheckedChange={(v) => setAuto((a) => ({ ...a, enabled: v }))} /></div>
            <p className="text-[11px] text-muted-foreground">Terkirim saat pembeli pertama kali chat, saat Anda offline, atau di luar jam operasional.</p>
            <Textarea value={auto.text} onChange={(e) => setAuto((a) => ({ ...a, text: e.target.value }))} maxLength={500} rows={3} placeholder="Terima kasih sudah menghubungi toko kami. Pesan kamu akan segera kami balas." className="text-sm" />
            <Button size="sm" variant="outline" className="w-full" onClick={async () => { const { error } = await supabase.rpc("seller_store_settings" as any, { p_visitor_id: visitorId, p: { auto_reply_enabled: auto.enabled, auto_reply_text: auto.text } }); if (!rpcErr(error)) toast({ title: "Auto reply disimpan" }); }}>Simpan Auto Reply</Button>
            <p className="pt-1 text-xs font-bold">Balasan per kata kunci produk</p>
            {(tools?.rules || []).map((r: any) => <div key={r.id} className="flex items-center gap-2 rounded border px-2 py-1 text-[11px]"><span className="flex-1"><b>"{r.keyword}"</b> → {r.reply}</span><Switch checked={r.is_active} onCheckedChange={() => toolSave("rule", "toggle", { id: r.id })} /><button onClick={() => toolSave("rule", "delete", { id: r.id })} aria-label="Hapus aturan"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></div>)}
            <Input value={rule.keyword} onChange={(e) => setRule((r) => ({ ...r, keyword: e.target.value }))} maxLength={40} placeholder="Kata kunci, contoh: voucher" className="h-9 text-xs" />
            <Textarea value={rule.reply} onChange={(e) => setRule((r) => ({ ...r, reply: e.target.value }))} maxLength={500} rows={2} placeholder="Balasan otomatis" className="text-sm" />
            <Button size="sm" className="w-full" disabled={rule.keyword.trim().length < 2 || !rule.reply.trim()} onClick={async () => { if (await toolSave("rule", "add", rule)) setRule({ keyword: "", reply: "" }); }}>Tambah Aturan</Button>
            <p className="text-[10px] text-muted-foreground">Semua balasan otomatis hanya aktif jika Auto Reply dinyalakan.</p>
          </section>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Mulai / buka percakapan pembeli dengan toko (dicek di sistem). */
export async function startStoreChat(visitorId: string, storeId: string, productId?: string | null, buyerName?: string) {
  const { data, error } = await supabase.rpc("sc_start" as any, { p_visitor_id: visitorId, p_store_id: storeId, p_product_id: productId ?? null, p_buyer_name: buyerName ?? null });
  if (error) throw new Error(error.message);
  return data as string;
}

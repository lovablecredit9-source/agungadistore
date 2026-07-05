import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Send, Loader2, Plus, X, MessageSquareWarning, Lock, ArrowLeft, Phone, User as UserIcon,
  RefreshCw, CheckCheck, Check, Clock, MessageCircle, Sparkles, Timer, Paperclip, ImageIcon, FileText, Download, Play, Copy, History, Gift,
  Globe, CalendarClock, Mic, Square, Flame, Heart, Laugh, Frown, Eye, EyeOff, Trophy, Trash2, CheckCircle2, XCircle, Smile,
  Award, Gem, HelpCircle, Pencil, Crown, Archive, Star, ArchiveRestore, MoreVertical, MessageSquareHeart
} from "lucide-react";
import confessTutorialImg from "@/assets/confess-tutorial.jpg";

const CONFESS_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confess-extra`;
async function callConfessExtra(payload: Record<string, unknown>) {
  const res = await fetch(CONFESS_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || "Gagal");
  return j;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { toast } from "@/hooks/use-toast";

function priceFor(n: number) {
  // 1=2k, 2=4k, 3=5k, 5=6k, 10=7k, 15=8k (di antara tier dibulatkan ke atas)
  if (n <= 1) return 2000;
  if (n === 2) return 4000;
  if (n === 3) return 5000;
  if (n <= 5) return 6000;
  if (n <= 10) return 7000;
  return 8000;
}
const rupiah = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

const FREE_MAX_NUMBERS = 10;
const SUB_MAX_NUMBERS = 15;

/* Nama custom per nomor (label pribadi, hanya di perangkat ini) */
function getThreadLabel(phone: string): string {
  try { return localStorage.getItem(`confess_label_${phone}`) || ""; } catch { return ""; }
}
function setThreadLabel(phone: string, name: string) {
  try {
    if (name.trim()) localStorage.setItem(`confess_label_${phone}`, name.trim());
    else localStorage.removeItem(`confess_label_${phone}`);
  } catch { /* ignore */ }
}

/* Arsip chat (hanya di perangkat ini) */
const ARCHIVE_KEY = "confess_archived_v1";
function getArchivedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]")); } catch { return new Set(); }
}
function setArchived(id: string, archived: boolean) {
  try {
    const s = getArchivedSet();
    if (archived) s.add(id); else s.delete(id);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}

/* Pesan berbintang (hanya di perangkat ini) */
const STAR_KEY = "confess_starred_v1";
function getStarredSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STAR_KEY) || "[]")); } catch { return new Set(); }
}
function setStarred(id: string, starred: boolean) {
  try {
    const s = getStarredSet();
    if (starred) s.add(id); else s.delete(id);
    localStorage.setItem(STAR_KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}

/* Pin chat ke atas (hanya di perangkat ini) */
const PIN_KEY = "confess_pinned_v1";
function getPinnedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || "[]")); } catch { return new Set(); }
}
function setPinned(id: string, pinned: boolean) {
  try {
    const s = getPinnedSet();
    if (pinned) s.add(id); else s.delete(id);
    localStorage.setItem(PIN_KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}

/* Chat dihapus/disembunyikan dari daftar (hanya di perangkat ini) */
const HIDDEN_KEY = "confess_hidden_v1";
function getHiddenSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); } catch { return new Set(); }
}
function setHidden(id: string, hidden: boolean) {
  try {
    const s = getHiddenSet();
    if (hidden) s.add(id); else s.delete(id);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}

/* Tema & font obrolan (hanya di perangkat ini) */
export const CHAT_THEMES: { id: string; label: string; bg: string; bubbleOut: string; bubbleIn: string }[] = [
  { id: "pink", label: "Pink", bg: "bg-gradient-to-b from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/20", bubbleOut: "bg-gradient-to-br from-pink-500 to-rose-500 text-white", bubbleIn: "bg-white dark:bg-zinc-800 text-foreground" },
  { id: "ungu", label: "Ungu", bg: "bg-gradient-to-b from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/20", bubbleOut: "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white", bubbleIn: "bg-white dark:bg-zinc-800 text-foreground" },
  { id: "biru", label: "Biru", bg: "bg-gradient-to-b from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/20", bubbleOut: "bg-gradient-to-br from-sky-500 to-blue-500 text-white", bubbleIn: "bg-white dark:bg-zinc-800 text-foreground" },
  { id: "hijau", label: "Hijau", bg: "bg-gradient-to-b from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20", bubbleOut: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white", bubbleIn: "bg-white dark:bg-zinc-800 text-foreground" },
  { id: "gelap", label: "Gelap", bg: "bg-gradient-to-b from-zinc-900 to-zinc-800", bubbleOut: "bg-gradient-to-br from-pink-600 to-rose-600 text-white", bubbleIn: "bg-zinc-700 text-white" },
];
export const CHAT_FONTS: { id: string; label: string; cls: string }[] = [
  { id: "default", label: "Default", cls: "" },
  { id: "serif", label: "Serif", cls: "font-serif" },
  { id: "mono", label: "Mono", cls: "font-mono" },
  { id: "besar", label: "Besar", cls: "text-base" },
  { id: "kecil", label: "Kecil", cls: "text-xs" },
];
export function getChatTheme(): string { try { return localStorage.getItem("confess_chat_theme") || "pink"; } catch { return "pink"; } }
export function setChatThemeLS(id: string) { try { localStorage.setItem("confess_chat_theme", id); } catch { /* ignore */ } }
export function getChatFont(): string { try { return localStorage.getItem("confess_chat_font") || "default"; } catch { return "default"; } }
export function setChatFontLS(id: string) { try { localStorage.setItem("confess_chat_font", id); } catch { /* ignore */ } }

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "🙏", "👍"];

const PUBLIC_API_KEY = "ak_L3HVVgbqgdFEM2EipHB4AKjgrOVSyJqCcJZOA4OG";

/* ------------- TOMBOL BANTUAN / PANDUAN CONFESS ------------- */
function ConfessHelpButton() {
  const [open, setOpen] = useState(false);
  const steps: { icon: any; title: string; desc: string }[] = [
    { icon: Phone, title: "1. Masukkan nomor tujuan", desc: "Tulis 1 sampai 10 nomor WhatsApp tujuan (15 nomor untuk pelanggan). Identitasmu tetap rahasia." },
    { icon: MessageCircle, title: "2. Tulis pesan confess", desc: "Ketik sendiri atau pakai ✨ AI Bantu Tulis & template mood. Pesan bisa panjang sampai 10.000 karakter." },
    { icon: ImageIcon, title: "3. Buat Gambar Confess", desc: "Klik tombol 🖼️ Buat Gambar Confess di bawah kotak pesan untuk membuat kartu gambar otomatis dari isi pesanmu, lalu Simpan atau Bagikan." },
    { icon: Paperclip, title: "4. Kirim foto, file & voice note", desc: "Setelah chat dibuka, kamu bisa kirim foto, video, file, audio, dan rekam voice note langsung lewat tombol 📎 dan 🎤 di kolom chat." },
    { icon: Send, title: "5. Bayar & kirim", desc: "Bayar pakai saldo + PIN 6 digit. Harga ikut jumlah nomor (1=Rp2rb, 2=Rp4rb, 3=Rp5rb, 5=Rp6rb, 10=Rp7rb, 15=Rp8rb)." },
    { icon: Sparkles, title: "6. Chat gratis 24 jam", desc: "Setelah bayar pertama, kamu & penerima bisa chat bolak-balik GRATIS selama 24 jam. Lewat itu bayar lagi." },
    { icon: Eye, title: "7. Reveal & balasan", desc: "Penerima bisa balas via WhatsApp dan masuk ke chat di sini. Kamu juga bisa minta Reveal identitas (escrow Rp5.000, refund jika ditolak)." },
    { icon: Pencil, title: "8. Custom nama chat", desc: "Klik ✏️ di daftar chat untuk ganti nomor jadi nama panggilan (hanya tampil di perangkatmu)." },
    { icon: Crown, title: "9. Tambah nomor (15)", desc: "Default maks 10 nomor. Klik tombol Langganan Rp10.000/bulan lalu masukkan PIN untuk kirim hingga 15 nomor sekaligus." },
    { icon: Heart, title: "10. Reaksi pesan (ala WA)", desc: "Arahkan ke pesan lalu klik 😊 untuk beri reaksi ❤️😂😮😢🙏👍. Reaksimu juga muncul di WhatsApp penerima, dan reaksi dari WA tampil di sini." },
    { icon: Pencil, title: "11. Edit pesan terkirim", desc: "Klik ✏️ pada pesanmu untuk mengedit isinya. Perubahan ikut diperbarui di WhatsApp dan diberi label (diedit)." },
    { icon: Star, title: "12. Pesan berbintang", desc: "Ketuk ⭐ pada pesan untuk menyimpannya. Klik ikon bintang di header chat untuk melihat hanya pesan berbintang." },
    { icon: Archive, title: "13. Arsipkan chat", desc: "Di daftar chat, klik ikon arsip pada percakapan untuk merapikannya. Buka tab Arsip untuk melihat & mengembalikannya." },
  ];
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="rounded-full gap-1 h-8 px-3 text-[11px]">
        <HelpCircle className="w-3.5 h-3.5" /> Bantuan
      </Button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-pink-500/30 p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 sticky -top-5 bg-card pt-1 pb-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white"><HelpCircle className="w-5 h-5" /></div>
              <div className="flex-1">
                <h3 className="font-black text-base">Cara Pakai Confess</h3>
                <p className="text-[11px] text-muted-foreground">Panduan singkat kirim confess anonim.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-pink-500/20 shadow-md">
              <img src={confessTutorialImg} alt="Contoh penggunaan Confess: chat, reaksi, bintang & edit" loading="lazy" width={768} height={1024} className="w-full h-auto" />
              <p className="text-[10px] text-center text-muted-foreground py-1.5 bg-muted/40">📸 Contoh tampilan chat Confess — reaksi ❤️, pesan berbintang ⭐, & label (edited)</p>
            </div>
            <div className="space-y-2">
              {steps.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.title} className="flex gap-2.5 rounded-xl border bg-muted/30 p-2.5">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/15 text-pink-500 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{s.title}</div>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl bg-pink-500/10 border border-pink-500/30 p-3 text-[11px] text-muted-foreground">
              💡 Butuh bantuan lebih lanjut? Hubungi admin via WhatsApp 085769302532.
            </div>
            <Button onClick={() => setOpen(false)} className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500">Mengerti</Button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ------------- BUAT GAMBAR CONFESS (kartu pesan untuk dibagikan) ------------- */
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function trimCanvasLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[\s.,!?…-]+$/g, "") + "…";
  return clipped;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function maskRecipientLabel(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "Tujuan rahasia";
  const local = digits.startsWith("62") ? "0" + digits.slice(2) : digits;
  if (local.length <= 7) return local;
  return `${local.slice(0, 4)}••••${local.slice(-4)}`;
}

function formatConfessRecipients(phones: string[]): string {
  const clean = phones.map((p) => p.trim()).filter(Boolean);
  if (clean.length === 0) return "Tujuan rahasia";
  if (clean.length === 1) return maskRecipientLabel(clean[0]);
  return `${maskRecipientLabel(clean[0])} +${clean.length - 1} nomor`;
}

function createConfessImageDataUrl(message: string, senderName: string, recipientLabel = "Tujuan rahasia", moodTag = ""): string | null {
  const W = 1080;
  const H = 1350;
  const PAD = 76;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  canvas.width = W;
  canvas.height = H;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#190b2f");
  g.addColorStop(0.34, "#be123c");
  g.addColorStop(0.68, "#fb7185");
  g.addColorStop(1, "#f59e0b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#ffffff";
  for (let y = 90; y < H; y += 115) {
    for (let x = 70; x < W; x += 115) {
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  roundRect(ctx, 42, 42, W - 84, H - 84, 54);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(ctx, PAD, 98, W - PAD * 2, 116, 36);
  ctx.fill();

  ctx.fillStyle = "#be123c";
  ctx.font = "800 28px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("AGUNG ADI STORE", PAD + 34, 128);
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 24px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("Confess anonim · pesan rahasia", PAD + 34, 166);
  ctx.textAlign = "right";
  ctx.font = "800 42px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "#fb7185";
  ctx.fillText("💌", W - PAD - 34, 133);
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 74px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("Pesan Rahasia", PAD, 270);
  ctx.font = "600 28px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(moodTag ? `Mood: ${moodTag}` : "Dikirim khusus lewat Confess", PAD, 354);

  const metaY = 430;
  const metaW = (W - PAD * 2 - 24) / 2;
  const senderLabel = senderName.trim() || "Anonim";
  const meta = [
    { title: "DARI", value: senderLabel },
    { title: "UNTUK", value: recipientLabel || "Tujuan rahasia" },
  ];
  meta.forEach((m, i) => {
    const x = PAD + i * (metaW + 24);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    roundRect(ctx, x, metaY, metaW, 138, 30);
    ctx.fill();
    ctx.fillStyle = "#be123c";
    ctx.font = "800 24px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(m.title, x + 28, metaY + 26);
    ctx.fillStyle = "#111827";
    ctx.font = "800 32px 'Plus Jakarta Sans', system-ui, sans-serif";
    const valueLines = trimCanvasLines(wrapCanvasText(ctx, m.value, metaW - 56), 1);
    ctx.fillText(valueLines[0] || "-", x + 28, metaY + 72);
  });

  const msgX = PAD;
  const msgY = 620;
  const msgW = W - PAD * 2;
  const msgH = 540;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(ctx, msgX, msgY, msgW, msgH, 42);
  ctx.fill();
  ctx.shadowColor = "rgba(31, 41, 55, 0.18)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 14;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  ctx.fillStyle = "#fb7185";
  ctx.font = "900 76px Georgia, serif";
  ctx.fillText("“", msgX + 42, msgY + 34);

  ctx.fillStyle = "#111827";
  ctx.font = "700 43px 'Plus Jakarta Sans', system-ui, sans-serif";
  const text = message.trim() || "Ada pesan rahasia untukmu.";
  const lines = trimCanvasLines(wrapCanvasText(ctx, text, msgW - 108), 7);
  const lineH = 62;
  let y = msgY + 120;
  for (const ln of lines) { ctx.fillText(ln, msgX + 54, y); y += lineH; }

  ctx.fillStyle = "#9f1239";
  ctx.font = "800 30px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText(`— ${senderLabel}`, msgX + 54, msgY + msgH - 82);
  ctx.fillStyle = "#6b7280";
  ctx.font = "600 24px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }), msgX + 54, msgY + msgH - 46);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, PAD, 1210, W - PAD * 2, 64, 32);
  ctx.fill();
  ctx.fillStyle = "#be123c";
  ctx.font = "800 24px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("Balas pesan ini lewat WhatsApp — identitas pengirim tetap rahasia", PAD + 30, 1230);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.74)";
  ctx.font = "700 22px 'Plus Jakarta Sans', system-ui, sans-serif";
  ctx.fillText("Murah & Terpercaya", W - PAD, 1296);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

function ConfessImageButton({ message, senderName, recipientLabel, moodTag }: { message: string; senderName: string; recipientLabel: string; moodTag: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>("");

  const generate = useCallback(() => {
    const generated = createConfessImageDataUrl(message, senderName, recipientLabel, moodTag);
    if (!generated) return;
    setDataUrl(generated);
    setOpen(true);
  }, [message, senderName, recipientLabel, moodTag]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `confess-${Date.now()}.png`;
    a.click();
  };

  const share = async () => {
    try {
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "confess.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Confess Anonim" });
      } else {
        download();
      }
    } catch { /* ignore */ }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={generate} className="mt-2 w-full rounded-xl gap-1.5 border-pink-500/40 text-pink-600 hover:bg-pink-500/10">
        <ImageIcon className="w-3.5 h-3.5" /> Buat Gambar Confess
      </Button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card border border-pink-500/30 p-4 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-pink-500" />
              <h3 className="font-bold text-sm flex-1">Gambar Confess Lengkap</h3>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
            {dataUrl && <img src={dataUrl} alt="Gambar confess" className="w-full rounded-xl border" />}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={download} variant="outline" className="rounded-xl gap-1.5"><Download className="w-4 h-4" /> Simpan</Button>
              <Button onClick={share} className="rounded-xl gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500"><Send className="w-4 h-4" /> Bagikan</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}



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
  wa_profile_pic_url?: string | null;
  wa_display_name?: string | null;
  wa_last_seen_at?: string | null;
  wa_presence?: string | null;
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
  wa_message_id?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  reaction?: string | null;
  reaction_by?: string | null;
  wa_reaction?: string | null;
  edited_at?: string | null;
}

function relativeTime(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "baru saja";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + " menit lalu";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + " jam lalu";
  return Math.floor(diff / 86_400_000) + " hari lalu";
}

// "terakhir dilihat hari ini pukul 14.32" / "kemarin pukul .." / "12 Mei pukul .."
function lastSeenWithClock(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const jam = `pukul ${pad(d.getHours())}.${pad(d.getMinutes())}`;
  const isSameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isSameDay) return `hari ini ${jam}`;
  if (isYesterday) return `kemarin ${jam}`;
  const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][d.getMonth()];
  return `${d.getDate()} ${bln} ${jam}`;
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
  const [view, setView] = useState<"list" | "compose" | "chat" | "history" | "wall" | "scheduled" | "reward">("list");
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
            <div className="flex items-center gap-1.5">
              <ConfessHelpButton />
              {view === "list" && (
                <Button variant="outline" size="sm" onClick={() => setView("history")} className="rounded-full gap-1 h-8 px-3 text-[11px]">
                  <History className="w-3.5 h-3.5" /> Riwayat
                </Button>
              )}
            </div>
          </div>
          {/* Tab strip — fitur baru */}
          {(view === "list" || view === "wall" || view === "scheduled" || view === "reward") && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { key: "list", label: "Chat", icon: MessageCircle },
                { key: "wall", label: "Wall Publik", icon: Globe },
                
                { key: "reward", label: "Berhadiah", icon: Award },
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
          visitorId={visitorId}
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
      {view === "reward" && (
        <RewardView visitorId={visitorId} onGoWall={() => setView("wall")} />
      )}
    </div>
  );
}

/* ============ THREAD LIST ============ */
async function fetchThreadMessages(visitorId: string, threadId: string): Promise<ThreadMessage[]> {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_thread_messages&thread_id=${threadId}&visitor_id=${encodeURIComponent(visitorId)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } });
    const j = await res.json().catch(() => ({}));
    return (j?.data as ThreadMessage[]) || [];
  } catch { return []; }
}
function threadHistoryToText(thread: Thread, label: string, msgs: ThreadMessage[]): string {
  const title = label || `+${thread.target_phone}`;
  const lines = [`===== Riwayat Chat Confess dengan ${title} =====`, `Diunduh: ${new Date().toLocaleString("id-ID")}`, ""];
  for (const m of msgs) {
    const who = m.direction === "out" ? "Saya" : title;
    const time = m.created_at ? new Date(m.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "";
    const body = (m.text || "").trim() || (m.media_type ? `[${m.media_type}]` : "");
    lines.push(`[${time}] ${who}: ${body}`);
  }
  return lines.join("\n");
}
function downloadTextFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ThreadListView({ visitorId, threads, refreshing, onRefresh, onCompose, onOpen }: {
  visitorId: string; threads: Thread[]; refreshing: boolean; onRefresh: () => void;
  onCompose: () => void; onOpen: (t: Thread) => void;
}) {
  const [archived, setArchivedState] = useState<Set<string>>(() => getArchivedSet());
  const [pinned, setPinnedState] = useState<Set<string>>(() => getPinnedSet());
  const [hidden, setHiddenState] = useState<Set<string>>(() => getHiddenSet());
  const [showArchive, setShowArchive] = useState(false);
  const [query, setQuery] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);

  const toggleArchive = (id: string, val: boolean) => {
    setArchived(id, val); setArchivedState(getArchivedSet());
    toast({ title: val ? "🗄️ Chat diarsipkan" : "Chat dikeluarkan dari arsip" });
  };
  const togglePin = (id: string, val: boolean) => {
    setPinned(id, val); setPinnedState(getPinnedSet());
    toast({ title: val ? "📌 Chat disematkan" : "Sematan dilepas" });
  };
  const removeThread = (id: string) => {
    if (!confirm("Sembunyikan riwayat chat ini dari daftar perangkat ini?")) return;
    setHidden(id, true); setHiddenState(getHiddenSet());
    toast({ title: "🗑️ Chat dihapus dari daftar", description: "Hanya di perangkat ini." });
  };

  const matchesQuery = (t: Thread) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const label = getThreadLabel(t.target_phone).toLowerCase();
    return label.includes(q) || t.target_phone.toLowerCase().includes(q) || (t.last_message_preview || "").toLowerCase().includes(q);
  };

  const visible = threads.filter((t) => !hidden.has(t.id));
  const activeThreads = visible.filter((t) => !archived.has(t.id) && matchesQuery(t));
  const archivedThreads = visible.filter((t) => archived.has(t.id) && matchesQuery(t));
  const base = showArchive ? archivedThreads : activeThreads;
  const list = [...base].sort((a, b) => {
    const pa = pinned.has(a.id) ? 1 : 0, pb = pinned.has(b.id) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
  });

  const totalUnread = visible.reduce((s, t) => s + (t.unread_count || 0), 0);
  const unreadChats = visible.filter((t) => (t.unread_count || 0) > 0).length;
  const readChats = visible.length - unreadChats;

  const downloadAll = async () => {
    setDownloadingAll(true);
    try {
      const parts: string[] = [];
      for (const t of visible) {
        const msgs = await fetchThreadMessages(visitorId, t.id);
        parts.push(threadHistoryToText(t, getThreadLabel(t.target_phone), msgs));
        parts.push("\n\n");
      }
      downloadTextFile(`confess-semua-chat-${Date.now()}.txt`, parts.join("") || "Belum ada chat.");
      toast({ title: "✅ Semua riwayat diunduh" });
    } finally { setDownloadingAll(false); }
  };

  return (
    <>
      <Button onClick={onCompose} className="w-full gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 hover:opacity-90 h-12 text-base font-bold shadow-lg">
        <Sparkles className="w-5 h-5" /> Kirim Confess Baru
      </Button>

      {/* Ringkasan belum dibaca / sudah dibaca */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-2xl border border-pink-500/20 bg-gradient-to-r from-pink-500/10 to-rose-500/10 px-3 py-2">
          <div className="relative">
            <MessageCircle className="w-5 h-5 text-pink-500" />
            {totalUnread > 0 && (
              <span className="absolute -top-2 -right-2 bg-gradient-to-br from-pink-500 to-rose-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow">{totalUnread}</span>
            )}
          </div>
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-pink-600 dark:text-pink-400">{unreadChats} chat belum dibaca</div>
            <div className="text-muted-foreground flex items-center gap-1"><CheckCheck className="w-3 h-3 text-sky-500" /> {readChats} sudah dibaca</div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={downloadAll} disabled={downloadingAll || visible.length === 0} className="h-full rounded-2xl gap-1 border-pink-500/30 text-pink-600 hover:bg-pink-500/10">
          {downloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="text-[11px] font-semibold">Unduh Semua</span>
        </Button>
      </div>

      {/* Pencarian kontak & isi chat */}
      <div className="relative">
        <MessageCircle className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama kontak atau isi chat…" className="pl-9 rounded-2xl h-10 text-sm" />
        {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-pink-500"><X className="w-4 h-4" /></button>}
      </div>

      <div className="relative rounded-3xl border border-pink-500/15 bg-gradient-to-b from-pink-500/[0.06] via-card to-card p-4 overflow-hidden shadow-lg shadow-pink-500/5">
        <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-40 h-40 rounded-full bg-orange-400/10 blur-3xl" />
        <div className="relative flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-pink-500/30">
              {showArchive ? <Archive className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
            </div>
            <div className="leading-tight">
              <h3 className="font-extrabold text-base bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 bg-clip-text text-transparent">{showArchive ? "Arsip Chat" : "Daftar Chat"}</h3>
              <p className="text-[10px] text-muted-foreground">{list.length} percakapan {showArchive ? "diarsipkan 🗄️" : "rahasia 🔒"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant={showArchive ? "default" : "ghost"} size="icon" onClick={() => setShowArchive((v) => !v)} className={`rounded-xl relative ${showArchive ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white" : "hover:bg-pink-500/10 hover:text-pink-500"}`} title="Arsip">
              <Archive className="w-4 h-4" />
              {!showArchive && archivedThreads.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">{archivedThreads.length}</span>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={refreshing} className="rounded-xl hover:bg-pink-500/10 hover:text-pink-500">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="relative text-xs text-muted-foreground text-center py-10">{query ? "Tidak ada hasil pencarian." : showArchive ? "Belum ada chat yang diarsipkan." : "Belum ada chat. Kirim confess pertama! 💌"}</p>
        ) : (
          <div className="relative space-y-2.5">
            {list.map((t) => (
              <ThreadCard
                key={t.id}
                visitorId={visitorId}
                thread={t}
                onOpen={() => onOpen(t)}
                archived={archived.has(t.id)}
                pinned={pinned.has(t.id)}
                onArchive={(val) => toggleArchive(t.id, val)}
                onPin={(val) => togglePin(t.id, val)}
                onDelete={() => removeThread(t.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}


function ThreadCard({ visitorId, thread, onOpen, archived, pinned, onArchive, onPin, onDelete }: {
  visitorId: string; thread: Thread; onOpen: () => void; archived?: boolean; pinned?: boolean;
  onArchive?: (val: boolean) => void; onPin?: (val: boolean) => void; onDelete?: () => void;
}) {
  const cd = useCountdown(thread.free_until);
  const [label, setLabel] = useState(() => getThreadLabel(thread.target_phone));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [downloading, setDownloading] = useState(false);
  const copyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText("+" + thread.target_phone).then(() => {
      toast({ title: "✅ Nomor disalin", description: "+" + thread.target_phone });
    }).catch(() => {});
  };
  const saveLabel = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    setThreadLabel(thread.target_phone, draft);
    setLabel(draft.trim());
    setEditing(false);
    toast({ title: draft.trim() ? "✅ Nama disimpan" : "Nama dihapus", description: "Hanya tampil di perangkat ini" });
  };
  const downloadOne = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      const msgs = await fetchThreadMessages(visitorId, thread.id);
      downloadTextFile(`confess-${(label || thread.target_phone).replace(/[^\w]/g, "_")}-${Date.now()}.txt`, threadHistoryToText(thread, label, msgs));
      toast({ title: "✅ Riwayat chat diunduh" });
    } finally { setDownloading(false); }
  };
  return (
    <button onClick={onOpen} className="group relative w-full text-left p-[1.5px] rounded-2xl bg-gradient-to-br from-pink-500/40 via-rose-500/25 to-orange-400/40 hover:from-pink-500 hover:via-rose-500 hover:to-orange-400 transition-all shadow-sm hover:shadow-xl hover:shadow-pink-500/25 hover:-translate-y-0.5 active:translate-y-0">
      <div className="relative rounded-[15px] bg-gradient-to-br from-card via-card to-pink-500/[0.04] backdrop-blur-xl p-3 overflow-hidden">
        {pinned && <span className="absolute top-1.5 left-1.5 text-pink-500 text-[9px] font-bold flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-pink-500" /> Disematkan</span>}
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        <div className="relative flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 blur-md opacity-40 group-hover:opacity-70 transition-opacity" />
              <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 flex items-center justify-center text-white overflow-hidden ring-2 ring-pink-500/30 group-hover:ring-pink-500/70 transition-all shadow-lg">
                {thread.target_avatar_url ? (
                  <img src={thread.target_avatar_url} alt={thread.target_phone} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <Phone className="w-5 h-5" />
                )}
              </div>
              {!cd.expired && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-card shadow-sm shadow-green-500/50" />
              )}
            </div>
            <div className="min-w-0">
              {editing ? (
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`+${thread.target_phone}`} maxLength={30} className="h-7 text-xs w-36" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveLabel(e); if (e.key === "Escape") { setEditing(false); setDraft(label); } }} />
                  <span onClick={saveLabel} className="p-1 rounded-md bg-pink-500/15 text-pink-500 cursor-pointer" title="Simpan"><Check className="w-3 h-3" /></span>
                  <span onClick={(e) => { e.stopPropagation(); setEditing(false); setDraft(label); }} className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-pointer" title="Batal"><X className="w-3 h-3" /></span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div className={`font-bold text-sm truncate ${label ? "" : "font-mono"}`}>{label || `+${thread.target_phone}`}</div>
                  <span onClick={(e) => { e.stopPropagation(); setDraft(label); setEditing(true); }} className="p-1 rounded-md hover:bg-pink-500/10 text-muted-foreground hover:text-pink-500 cursor-pointer" title="Ubah jadi nama"><Pencil className="w-3 h-3" /></span>
                  <span onClick={copyPhone} className="p-1 rounded-md hover:bg-pink-500/10 text-muted-foreground hover:text-pink-500 cursor-pointer" title="Salin nomor">
                    <Copy className="w-3 h-3" />
                  </span>
                </div>
              )}
              {label && !editing && <div className="text-[9px] text-muted-foreground font-mono truncate">+{thread.target_phone}</div>}
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Timer className="w-2.5 h-2.5 opacity-60" />
                {new Date(thread.last_message_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {thread.unread_count > 0 ? (
              <span className="bg-gradient-to-br from-pink-500 to-rose-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-md shadow-pink-500/40 animate-pulse">{thread.unread_count}</span>
            ) : (
              <span className="text-sky-500 flex items-center gap-0.5 text-[9px] font-semibold" title="Sudah dibaca"><CheckCheck className="w-3.5 h-3.5" /></span>
            )}
            {cd.expired ? (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground font-semibold flex items-center gap-0.5 border border-border/50"><Timer className="w-2.5 h-2.5" /> Bayar lagi</span>
            ) : (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 font-semibold flex items-center gap-0.5 border border-green-500/20"><Sparkles className="w-2.5 h-2.5" /> Gratis {cd.label}</span>
            )}
            <div className="flex items-center gap-0.5">
              {onPin && (
                <span onClick={(e) => { e.stopPropagation(); onPin(!pinned); }} className={`p-1 rounded-md cursor-pointer ${pinned ? "text-pink-500" : "text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10"}`} title={pinned ? "Lepas sematan" : "Sematkan"}>
                  <Star className={`w-3.5 h-3.5 ${pinned ? "fill-pink-500" : ""}`} />
                </span>
              )}
              <span onClick={downloadOne} className="p-1 rounded-md hover:bg-pink-500/10 text-muted-foreground hover:text-pink-500 cursor-pointer" title="Unduh riwayat chat">
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              </span>
              {onArchive && (
                <span onClick={(e) => { e.stopPropagation(); onArchive(!archived); }} className="p-1 rounded-md hover:bg-pink-500/10 text-muted-foreground hover:text-pink-500 cursor-pointer" title={archived ? "Keluarkan dari arsip" : "Arsipkan chat"}>
                  {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                </span>
              )}
              {onDelete && (
                <span onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 cursor-pointer" title="Hapus riwayat dari daftar">
                  <Trash2 className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>

        </div>
        <div className="relative pl-[58px] flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-pink-500/40 shrink-0" />
          <p className="text-xs text-muted-foreground line-clamp-1">{thread.last_message_preview || "—"}</p>
        </div>
      </div>
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

/* ============ AI HELPER (Mode Template) ============ */
const AI_STYLES: { key: string; label: string; emoji: string }[] = [
  { key: "romantis", label: "Romantis", emoji: "💘" },
  { key: "sedih", label: "Sedih", emoji: "💔" },
  { key: "lucu", label: "Lucu", emoji: "😂" },
  { key: "marah", label: "Marah (sopan)", emoji: "💢" },
  { key: "formal", label: "Formal", emoji: "🎩" },
  { key: "galau", label: "Galau", emoji: "🥀" },
  { key: "rindu", label: "Rindu", emoji: "🌙" },
  { key: "pamit", label: "Pamit", emoji: "🍃" },
];

function AiHelperButton({ recipientName, currentMessage, onGenerated }: {
  recipientName: string; currentMessage: string; onGenerated: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState("romantis");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confess-ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ style, hint: hint.trim(), recipientName: recipientName.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Gagal");
      if (!j?.message) throw new Error("Hasil kosong");
      if (currentMessage.trim() && !confirm("Ganti pesan yang sudah ditulis dengan hasil AI?")) return;
      onGenerated(j.message);
      setOpen(false);
      toast({ title: "✨ Pesan AI siap", description: "Boleh kamu edit lagi sebelum kirim." });
    } catch (e: any) {
      toast({ title: "Gagal generate", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow hover:shadow-md active:scale-95 transition flex items-center gap-1"
      >
        <Sparkles className="w-3 h-3" /> AI Bantu Tulis
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => !loading && setOpen(false)}>
          <div className="bg-background rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" /> Mode Template AI</h3>
              <button type="button" onClick={() => !loading && setOpen(false)} className="p-1 rounded-full hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="text-[11px] font-semibold mb-1.5 block">Pilih gaya pesan</label>
              <div className="grid grid-cols-2 gap-1.5">
                {AI_STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStyle(s.key)}
                    className={`text-[12px] px-2 py-2 rounded-xl border font-semibold transition ${
                      style === s.key
                        ? "bg-gradient-to-r from-violet-500 to-pink-500 text-white border-transparent shadow"
                        : "bg-muted/40 hover:bg-muted border-border"
                    }`}
                  >
                    {s.emoji} {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold mb-1.5 block">Petunjuk untuk AI (opsional)</label>
              <Textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="Contoh: aku suka dia tapi gak berani ngomong, kami satu kelas…"
                rows={3}
                maxLength={400}
              />
              <div className="text-[10px] text-right text-muted-foreground mt-1">{hint.length}/400</div>
            </div>

            <Button type="button" onClick={generate} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Menulis pesan…" : "Tulis Pesan dengan AI"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">Hasil AI bisa kamu edit dulu sebelum kirim.</p>
          </div>
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
  const [media, setMedia] = useState<{ url: string; type: string; name: string; mime?: string; size: number } | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const composeFileRef = useRef<HTMLInputElement>(null);

  async function handleComposeFile(file: File) {
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "File terlalu besar", description: "Maks 16 MB", variant: "destructive" });
      return;
    }
    setMediaUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
      const path = `compose/${visitorId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("confess-media").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("confess-media").getPublicUrl(path);
      setMedia({ url: pub.publicUrl, type: detectMediaType(file), name: file.name, mime: file.type || undefined, size: file.size });
    } catch (e: any) {
      toast({ title: "Gagal upload", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setMediaUploading(false);
      if (composeFileRef.current) composeFileRef.current.value = "";
    }
  }

  async function uploadAutoConfessImage(): Promise<{ url: string; type: string; name: string; mime: string; size: number } | null> {
    const dataUrl = createConfessImageDataUrl(message, senderName);
    if (!dataUrl) return null;
    const blob = await (await fetch(dataUrl)).blob();
    const fileName = `surat-confess-${Date.now()}.png`;
    const path = `auto-letter/${visitorId}/${fileName}`;
    const { error: upErr } = await supabase.storage.from("confess-media").upload(path, blob, {
      contentType: "image/png",
      upsert: false,
    });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("confess-media").getPublicUrl(path);
    return { url: pub.publicUrl, type: "image", name: fileName, mime: "image/png", size: blob.size };
  }
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<{ percent: number; code: string } | null>(null);
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [subActive, setSubActive] = useState(false);
  const [subUntil, setSubUntil] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subPin, setSubPin] = useState("");
  const [showSubPin, setShowSubPin] = useState(false);
  const maxNumbers = subActive ? SUB_MAX_NUMBERS : FREE_MAX_NUMBERS;

  const loadSub = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confess-number-sub`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action: "status", visitor_id: visitorId }),
      });
      const j = await res.json().catch(() => ({}));
      setSubActive(!!j?.active);
      setSubUntil(j?.expires_at || null);
    } catch { /* ignore */ }
  }, [visitorId]);
  useEffect(() => { loadSub(); }, [loadSub]);

  async function buySub() {
    if (subPin.length !== 6) { toast({ title: "PIN 6 digit", variant: "destructive" }); return; }
    setSubLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confess-number-sub`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action: "buy", visitor_id: visitorId, pin: subPin }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Gagal");
      toast({ title: "✅ Langganan aktif", description: "Sekarang bisa kirim sampai 15 nomor" });
      setSubPin(""); setShowSubPin(false);
      loadSub();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally { setSubLoading(false); }
  }



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
  const afterTrial = Math.max(0, (scheduleEnabled ? grossTotal : grossTotal) - (scheduleEnabled ? 0 : trialDiscountPreview));
  const voucherDiscountPreview = voucherInfo && afterTrial > 0 ? Math.floor((afterTrial * voucherInfo.percent) / 100) : 0;
  const total = Math.max(0, afterTrial - voucherDiscountPreview);

  async function checkVoucher() {
    const code = voucherCode.trim().toUpperCase();
    if (!code) { setVoucherInfo(null); setVoucherError(""); return; }
    setVoucherChecking(true); setVoucherError("");
    const { data } = await supabase.from("confess_vouchers").select("code, discount_percent, is_active, expires_at, used_count, max_uses").eq("code", code).maybeSingle();
    setVoucherChecking(false);
    if (!data) { setVoucherInfo(null); setVoucherError("Kode tidak ditemukan"); return; }
    if (!data.is_active) { setVoucherInfo(null); setVoucherError("Voucher nonaktif"); return; }
    if (data.expires_at && new Date(data.expires_at) <= new Date()) { setVoucherInfo(null); setVoucherError("Voucher kadaluarsa"); return; }
    if (data.used_count >= data.max_uses) { setVoucherInfo(null); setVoucherError("Voucher sudah habis"); return; }
    setVoucherInfo({ percent: data.discount_percent, code: data.code });
  }


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
    if (message.trim().length < 3 && !media) return toast({ title: "Pesan terlalu pendek", variant: "destructive" });
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
      const outgoingMedia = media || await uploadAutoConfessImage();
      const deviceFingerprint = (typeof window !== "undefined" && (localStorage.getItem("device_fp_v1") || getVisitorId())) || "";
      const { data, error } = await supabase.functions.invoke("send-confession", {
        body: {
          visitorId, senderName: senderName.trim(), message: message.trim(),
          phones: clean, pin, deviceFingerprint,
          moodTag: moodTag || undefined,
          shareToWall,
          scheduledAt: scheduledIso || undefined,
          voucherCode: voucherInfo?.code || undefined,
          mediaUrl: outgoingMedia?.url,
          mediaType: outgoingMedia?.type,
          mediaName: outgoingMedia?.name,
          mediaMime: outgoingMedia?.mime,
          mediaSize: outgoingMedia?.size,

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
        {[1, 2, 3, 5, 10, maxNumbers === SUB_MAX_NUMBERS ? 15 : 10].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6).map((n) => (
          <div key={n} className={`rounded-xl border p-2.5 ${cleanPhones.length === n ? "border-pink-500 bg-pink-500/5" : ""}`}>
            <div className="text-[10px] text-muted-foreground">{n} nomor</div>
            <div className="font-bold text-sm">{rupiah(priceFor(n))}</div>
          </div>
        ))}
      </div>

      {/* Langganan tambah nomor (15) */}
      <div className={`rounded-2xl border p-4 ${subActive ? "border-amber-400/60 bg-amber-500/5" : "border-dashed"}`}>
        <div className="flex items-center gap-2 mb-1">
          <Crown className={`w-4 h-4 ${subActive ? "text-amber-500" : "text-muted-foreground"}`} />
          <div className="font-bold text-sm">Tambah Nomor sampai 15</div>
          {subActive && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold">AKTIF</span>}
        </div>
        {subActive ? (
          <p className="text-[11px] text-muted-foreground">Langganan aktif{subUntil ? ` s/d ${new Date(subUntil).toLocaleDateString("id-ID", { dateStyle: "medium" } as any)}` : ""}. Kamu bisa kirim hingga 15 nomor. (Biaya kirim 15 nomor tetap {rupiah(priceFor(15))}.)</p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">Default maksimal 10 nomor. Berlangganan <b>Rp 10.000/bulan</b> untuk kirim hingga 15 nomor sekaligus.</p>
            {!showSubPin ? (
              <Button type="button" onClick={() => setShowSubPin(true)} className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500">
                <Crown className="w-3.5 h-3.5 mr-1" /> Langganan Rp 10.000/bulan
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Masukkan PIN 6 digit untuk membayar dari saldo.</p>
                <div className="flex gap-2">
                  <Input value={subPin} onChange={(e) => setSubPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="PIN 6 digit" maxLength={6} className="flex-1" autoFocus />
                  <Button type="button" onClick={buySub} disabled={subLoading} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 shrink-0">
                    {subLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Bayar</>}
                  </Button>
                </div>
                <button type="button" onClick={() => { setShowSubPin(false); setSubPin(""); }} className="text-[10px] text-muted-foreground underline">Batal</button>
              </div>
            )}
          </>
        )}
      </div>



      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><UserIcon className="w-3.5 h-3.5" /> Nama Pengirim (opsional)</label>
          <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Kosongkan = Anonim" maxLength={40} />
        </div>

        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Phone className="w-3.5 h-3.5" /> Nomor WA Tujuan (1-{maxNumbers})</label>
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
            {phones.length < maxNumbers ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setPhones([...phones, ""])} className="w-full">
                <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Nomor
              </Button>
            ) : !subActive && (
              <p className="text-[10px] text-amber-600 text-center flex items-center justify-center gap-1"><Crown className="w-3 h-3" /> Batas {FREE_MAX_NUMBERS} nomor. Langganan untuk sampai 15 nomor.</p>
            )}
          </div>

          {freeCount > 0 && (
            <p className="text-[10px] text-green-600 mt-2 flex items-center gap-1"><Sparkles className="w-3 h-3" /> {freeCount} nomor masih dalam window gratis 24 jam — tidak dipotong saldo</p>
          )}
        </div>

        {/* Mood / Template Picker */}
        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Smile className="w-3.5 h-3.5" /> Mood & Template (opsional)</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MOODS.map((m) => (
              <button
                key={m.tag}
                type="button"
                onClick={() => {
                  if (moodTag === m.tag) { setMoodTag(""); return; }
                  setMoodTag(m.tag);
                  if (!message.trim()) setMessage(m.template);
                }}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap transition-all ${
                  moodTag === m.tag
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white border-transparent shadow"
                    : "bg-muted/40 hover:bg-muted text-foreground border-border"
                }`}
              >
                {m.emoji} {m.tag}
              </button>
            ))}
        </div>
        </div>

        {/* Lampiran foto / file */}
        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Paperclip className="w-3.5 h-3.5" /> Lampiran (opsional)</label>
          <input
            ref={composeFileRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleComposeFile(f); }}
          />
          {media ? (
            <div className="flex items-center gap-2 rounded-xl border p-2">
              {media.type === "image" ? (
                <img src={media.url} alt={media.name} className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center"><Paperclip className="w-5 h-5 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{media.name}</div>
                <div className="text-[10px] text-muted-foreground">{(media.size / 1024).toFixed(0)} KB · {media.type}</div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMedia(null)}><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="w-full" disabled={mediaUploading} onClick={() => composeFileRef.current?.click()}>
              {mediaUploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Paperclip className="w-3.5 h-3.5 mr-1" />}
              {mediaUploading ? "Mengunggah…" : "Tambah Foto / File"}
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">Foto/video/file akan ikut terkirim ke WhatsApp bersama pesan. Maks 16 MB.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Pesan Confess</label>
            <AiHelperButton
              recipientName={senderName}
              currentMessage={message}
              onGenerated={(t) => setMessage(t)}
            />
          </div>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tulis pesan confess kamu…  atau klik ✨ AI Bantu Tulis" rows={4} maxLength={10000} />
          <div className="text-[10px] text-right text-muted-foreground mt-1">{message.length}/10000</div>

          {/* Buat Gambar Confess (kartu pesan untuk dibagikan / disimpan) */}
          {message.trim().length > 0 && (
            <ConfessImageButton message={message} senderName={senderName} />
          )}
        </div>

        {/* Preview Surat Confess (live) */}
        {(message.trim().length > 0 || media) && (
          <div>
            <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Sparkles className="w-3.5 h-3.5 text-pink-500" /> Preview Surat Confess</label>
            <div className="relative overflow-hidden rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-fuchsia-500/10 p-3 shadow-lg">
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-pink-500/10 blur-2xl" />
              <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-fuchsia-500/10 blur-2xl" />
              {/* Header */}
              <div className="relative flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shrink-0">
                  <MessageSquareHeart className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{senderName.trim() || "Seseorang (Anonim)"}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {moodTag ? <span>{MOODS.find((m) => m.tag === moodTag)?.emoji} {moodTag}</span> : "mengirim confess untukmu"}
                  </div>
                </div>
              </div>
              {/* Chat bubble */}
              <div className="relative ml-1">
                <div className="inline-block max-w-full rounded-2xl rounded-tl-md bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-500 text-white p-2 shadow-md">
                  {media?.type === "image" && (
                    <img src={media.url} alt={media.name} className="rounded-xl max-h-56 w-full object-cover mb-1" />
                  )}
                  {media?.type === "video" && (
                    <video src={media.url} className="rounded-xl max-h-56 w-full mb-1" />
                  )}
                  {media && media.type !== "image" && media.type !== "video" && (
                    <div className="flex items-center gap-2 rounded-xl bg-white/15 px-2 py-1.5 mb-1 text-xs">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{media.name}</span>
                    </div>
                  )}
                  {message.trim() && (
                    <p className="text-sm whitespace-pre-wrap break-words px-1 leading-relaxed">{message.trim()}</p>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-0.5 px-1">
                    <span className="text-[9px] text-white/70">terkirim ✓✓</span>
                  </div>
                </div>
              </div>
              <p className="relative text-[9px] text-muted-foreground mt-2 text-center">Beginilah pesan{media ? " & foto" : ""} akan tampil di chat penerima & terkirim ke WhatsApp.</p>
            </div>
          </div>
        )}



        {/* Wall + Schedule toggles */}
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => setShareToWall((v) => !v)}
            className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${shareToWall ? "border-pink-500 bg-pink-500/10" : "border-border hover:bg-muted/40"}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${shareToWall ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white" : "bg-muted text-muted-foreground"}`}>
              <Globe className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-xs font-bold">Tayangkan di Wall Publik</div>
              <div className="text-[10px] text-muted-foreground">Anonim · semua orang bisa beri reaksi ❤️🔥😂😢</div>
            </div>
            <div className={`w-9 h-5 rounded-full p-0.5 transition-all ${shareToWall ? "bg-pink-500" : "bg-muted-foreground/30"}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${shareToWall ? "translate-x-4" : ""}`} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setScheduleEnabled((v) => !v)}
            className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${scheduleEnabled ? "border-purple-500 bg-purple-500/10" : "border-border hover:bg-muted/40"}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${scheduleEnabled ? "bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white" : "bg-muted text-muted-foreground"}`}>
              <CalendarClock className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-xs font-bold">Kirim Terjadwal</div>
              <div className="text-[10px] text-muted-foreground">Auto-kirim di waktu tertentu · bisa dibatalkan & refund 100%</div>
            </div>
            <div className={`w-9 h-5 rounded-full p-0.5 transition-all ${scheduleEnabled ? "bg-purple-500" : "bg-muted-foreground/30"}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${scheduleEnabled ? "translate-x-4" : ""}`} />
            </div>
          </button>

          {scheduleEnabled && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-2.5 space-y-1.5">
              <label className="text-[11px] font-semibold flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Waktu kirim</label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={(() => { const d = new Date(Date.now() + 5 * 60000); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })()}
              />
              <p className="text-[10px] text-purple-700 dark:text-purple-300">Min 5 menit · Maks 30 hari · Saldo akan dipotong sekarang, refund 100% jika dibatalkan sebelum jadwal.</p>
            </div>
          )}
        </div>

        {/* Voucher input */}
        <div>
          <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Gift className="w-3.5 h-3.5" /> Kode Voucher (opsional)</label>
          <div className="flex gap-2">
            <Input value={voucherCode} onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherInfo(null); setVoucherError(""); }} placeholder="CON-XXXX" maxLength={40} className="font-mono uppercase" />
            <Button type="button" size="sm" variant="outline" onClick={checkVoucher} disabled={voucherChecking || !voucherCode.trim()}>
              {voucherChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Pakai"}
            </Button>
          </div>
          {voucherInfo && (
            <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Voucher {voucherInfo.code} aktif · diskon {voucherInfo.percent}%{voucherInfo.percent === 100 ? " (gratis, tanpa PIN)" : ""}</p>
          )}
          {voucherError && <p className="text-[10px] text-destructive mt-1">{voucherError}</p>}
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
            {(trialDiscountPreview > 0 || voucherDiscountPreview > 0) && (
              <div className="text-[10px] text-muted-foreground line-through">{rupiah(grossTotal)}</div>
            )}
            <div className="font-black text-xl bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">{rupiah(total)}</div>
            {trialDiscountPreview > 0 && (
              <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><Gift className="w-3 h-3" /> Diskon percobaan −{rupiah(trialDiscountPreview)}</div>
            )}
            {voucherDiscountPreview > 0 && (
              <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><Gift className="w-3 h-3" /> Voucher −{rupiah(voucherDiscountPreview)}</div>
            )}

          </div>
          <Button onClick={() => { if (!showPin && total > 0) { setShowPin(true); return; } submit(); }} disabled={loading} className="rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 hover:opacity-90">
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            {scheduleEnabled
              ? (showPin || total === 0 ? "Jadwalkan" : "Lanjut Bayar")
              : (total === 0 ? "Kirim Gratis" : (showPin ? "Bayar & Kirim" : "Lanjut Bayar"))}
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
  const [waMeta, setWaMeta] = useState<{ pic?: string | null; name?: string | null; last_seen?: string | null; presence?: string | null }>({
    pic: thread.wa_profile_pic_url || thread.target_avatar_url, name: thread.wa_display_name, last_seen: thread.wa_last_seen_at, presence: thread.wa_presence,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cd = useCountdown(freeUntil);
  const [starred, setStarredState] = useState<Set<string>>(() => getStarredSet());
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [chatThemeId, setChatThemeId] = useState<string>(() => getChatTheme());
  const [chatFontId, setChatFontId] = useState<string>(() => getChatFont());
  const [showThemePanel, setShowThemePanel] = useState(false);
  const chatTheme = CHAT_THEMES.find((t) => t.id === chatThemeId) || CHAT_THEMES[0];
  const chatFont = CHAT_FONTS.find((f) => f.id === chatFontId) || CHAT_FONTS[0];
  const toggleStar = useCallback((id: string) => {
    const has = getStarredSet().has(id);
    setStarred(id, !has);
    setStarredState(getStarredSet());
  }, []);

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
        const n = p.new as any;
        if (n?.free_until) setFreeUntil(n.free_until);
        setWaMeta((prev) => ({
          pic: n?.wa_profile_pic_url ?? prev.pic,
          name: n?.wa_display_name ?? prev.name,
          last_seen: n?.wa_last_seen_at ?? prev.last_seen,
          presence: n?.wa_presence ?? prev.presence,
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [thread.id, load]);

  async function deleteMessage(msg: ThreadMessage) {
    if (!confirm("Hapus pesan ini? Akan dihapus juga di WhatsApp jika masih dalam batas waktu.")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_revoke_message`, {
        method: "POST",
        headers: { "x-api-key": PUBLIC_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msg.id, wa_message_id: msg.wa_message_id, deleted_by: "web", thread_id: thread.id }),
      });
      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "Gagal hapus");
      load();
    } catch (e: any) {
      toast({ title: "Gagal hapus", description: e?.message || "Error", variant: "destructive" });
    }
  }

  async function reactMessage(msg: ThreadMessage, emoji: string | null) {
    // optimistic
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, reaction: emoji, reaction_by: "web" } : m));
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_set_reaction`, {
        method: "POST",
        headers: { "x-api-key": PUBLIC_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msg.id, visitor_id: visitorId, emoji }),
      });
      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "Gagal");
    } catch (e: any) {
      toast({ title: "Gagal beri reaksi", description: e?.message || "Error", variant: "destructive" });
      load();
    }
  }

  async function editMessage(msg: ThreadMessage, text: string) {
    const newText = text.trim();
    if (!newText) return;
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, text: newText, edited_at: new Date().toISOString() } : m));
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_edit_message`, {
        method: "POST",
        headers: { "x-api-key": PUBLIC_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msg.id, visitor_id: visitorId, text: newText }),
      });
      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "Gagal");
      toast({ title: "✏️ Pesan diedit", description: "Perubahan juga dikirim ke WhatsApp." });
    } catch (e: any) {
      toast({ title: "Gagal edit", description: e?.message || "Error", variant: "destructive" });
      load();
    }
  }




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
  const visibleMessages = onlyStarred ? messages.filter((m) => starred.has(m.id)) : messages;
  const grouped = (() => {
    const out: { date: string; items: ThreadMessage[] }[] = [];
    visibleMessages.forEach((m) => {
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
              {waMeta.pic ? (
                <img src={waMeta.pic} alt={thread.target_phone} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <Phone className="w-4 h-4" />
              )}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-background ${waMeta.presence === "available" || waMeta.presence === "composing" || waMeta.presence === "recording" ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <div className="font-bold text-sm truncate bg-gradient-to-r from-pink-600 to-rose-600 dark:from-pink-300 dark:to-rose-300 bg-clip-text text-transparent">
                {getThreadLabel(thread.target_phone) || waMeta.name || `+${thread.target_phone}`}
              </div>
              <button onClick={() => navigator.clipboard?.writeText("+" + thread.target_phone).then(() => toast({ title: "✅ Nomor disalin", description: "+" + thread.target_phone })).catch(() => {})} className="p-1 rounded-md hover:bg-pink-500/15 text-pink-500" title="Salin nomor">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="text-[10px] flex items-center gap-1 flex-wrap">
              {waMeta.presence === "composing" ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">sedang mengetik…</span>
              ) : waMeta.presence === "recording" ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse flex items-center gap-1"><Mic className="w-2.5 h-2.5" /> merekam suara…</span>
              ) : waMeta.presence === "available" ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">online</span>
              ) : waMeta.last_seen ? (
                <span className="text-muted-foreground">terakhir dilihat {lastSeenWithClock(waMeta.last_seen)}</span>
              ) : (
                <span className="text-muted-foreground font-mono">+{thread.target_phone}</span>
              )}
              {!cd.expired && <span className="text-emerald-600 dark:text-emerald-400">· Gratis {cd.label}</span>}
              {cd.expired && <span className="text-muted-foreground flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" /> Window habis</span>}
            </div>
          </div>

          <button
            onClick={() => setOnlyStarred((v) => !v)}
            className={`shrink-0 p-2 rounded-full transition-colors ${onlyStarred ? "bg-amber-400 text-white" : "hover:bg-amber-500/10 text-amber-500"}`}
            title={onlyStarred ? "Tampilkan semua pesan" : "Lihat pesan berbintang"}
          >
            <Star className={`w-4 h-4 ${onlyStarred ? "fill-current" : ""}`} />
          </button>
          <div className="relative shrink-0">
            <button
              onClick={() => setShowThemePanel((v) => !v)}
              className={`p-2 rounded-full transition-colors ${showThemePanel ? "bg-pink-500 text-white" : "hover:bg-pink-500/10 text-pink-500"}`}
              title="Tema & font obrolan"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            {showThemePanel && (
              <div className="absolute right-0 top-11 z-20 w-52 rounded-2xl border border-pink-500/30 bg-card p-3 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground mb-1.5">Tema Obrolan</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CHAT_THEMES.map((t) => (
                      <button key={t.id} onClick={() => { setChatThemeId(t.id); setChatThemeLS(t.id); }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${chatThemeId === t.id ? "border-pink-500 ring-1 ring-pink-500" : "border-border"}`}>
                        <span className={`inline-block w-3 h-3 rounded-full mr-1 align-middle ${t.bubbleOut}`} />{t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground mb-1.5">Font</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CHAT_FONTS.map((f) => (
                      <button key={f.id} onClick={() => { setChatFontId(f.id); setChatFontLS(f.id); }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${f.cls} ${chatFontId === f.id ? "border-pink-500 ring-1 ring-pink-500" : "border-border"}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <RevealButton thread={thread} visitorId={visitorId} />
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
        className={`relative rounded-2xl border border-pink-500/15 p-3 h-[55vh] overflow-y-auto space-y-2 ${chatTheme.bg} ${chatFont.cls}`}
        style={{
          backgroundImage: `radial-gradient(hsl(330 80% 60% / 0.08) 1px, transparent 1px)`,
          backgroundSize: "18px 18px",
        }}
      >
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-pink-500" /></div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
              {onlyStarred ? <Star className="w-6 h-6 text-amber-500" /> : <Sparkles className="w-6 h-6 text-pink-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{onlyStarred ? "Belum ada pesan berbintang — ketuk ⭐ pada pesan." : "Belum ada pesan — sapa dia duluan 💌"}</p>
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
                return <Bubble key={m.id} msg={m} grouped={grouped} onDelete={() => deleteMessage(m)} onReact={(e) => reactMessage(m, e)} onEdit={(t) => editMessage(m, t)} starred={starred.has(m.id)} onStar={() => toggleStar(m.id)} />;
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
            <VoiceRecorderButton
              disabled={uploading || sending}
              onRecorded={(file) => handleFile(file)}
            />
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ketik pesan / lampirkan foto…"
              rows={1}
              maxLength={10000}
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

const REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];
function Bubble({ msg, grouped, onDelete, onReact, onEdit, starred, onStar }: { msg: ThreadMessage; grouped?: boolean; onDelete?: () => void; onReact?: (emoji: string | null) => void; onEdit?: (text: string) => void; starred?: boolean; onStar?: () => void }) {
  const isOut = msg.direction === "out";
  const isDeleted = !!msg.deleted_at;
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text || "");
  const reaction = msg.reaction || msg.wa_reaction;
  return (
    <div className={`group flex ${isOut ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"} animate-fade-in`}>
      <div
        className={`relative max-w-[80%] rounded-2xl px-2.5 py-2 shadow-md space-y-1.5 transition-transform hover:scale-[1.01] ${
          isDeleted
            ? "bg-muted/60 border border-dashed border-muted-foreground/30 text-muted-foreground italic"
            : isOut
              ? `bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-500 text-white ${grouped ? "rounded-tr-2xl" : "rounded-tr-md"} shadow-pink-500/25`
              : `bg-card/95 backdrop-blur border border-pink-500/15 ${grouped ? "rounded-tl-2xl" : "rounded-tl-md"}`
        }`}
      >
        {!grouped && !isDeleted && (
          isOut ? (
            <span className="absolute -right-1 top-0 w-3 h-3 bg-gradient-to-br from-pink-500 to-rose-500" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
          ) : (
            <span className="absolute -left-1 top-0 w-3 h-3 bg-card border-l border-t border-pink-500/15" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 0)" }} />
          )
        )}
        {isDeleted ? (
          <p className="text-sm flex items-center gap-1.5 px-1"><Trash2 className="w-3.5 h-3.5" /> Pesan ini telah dihapus</p>
        ) : (
          <>
            {msg.media_url && msg.media_type === "image" && (
              <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={msg.media_url} alt={msg.media_name || "foto"} className="rounded-xl max-h-64 w-full object-cover" loading="lazy" />
              </a>
            )}
            {msg.media_url && msg.media_type === "video" && (
              <video src={msg.media_url} controls className="rounded-xl max-h-64 w-full" />
            )}
            {msg.media_url && msg.media_type === "audio" && (
              <div className={`rounded-xl p-1.5 ${isOut ? "bg-white/15" : "bg-muted"} flex items-center gap-2`}>
                <Mic className={`w-4 h-4 shrink-0 ${isOut ? "text-white" : "text-pink-500"}`} />
                <audio src={msg.media_url} controls className="flex-1 h-8" />
              </div>
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
            {msg.text && !editing && (
              <p className="text-sm whitespace-pre-wrap break-words px-1 leading-relaxed">
                {msg.text}
                {msg.edited_at && <span className={`ml-1 text-[9px] italic ${isOut ? "text-white/70" : "text-muted-foreground"}`}>(diedit)</span>}
              </p>
            )}
            {editing && (
              <div className="space-y-1 px-1">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  className="w-full text-sm rounded-lg p-1.5 text-foreground bg-background border border-pink-500/30 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
                <div className="flex gap-1 justify-end">
                  <button onClick={() => { setEditing(false); setEditText(msg.text || ""); }} className={`text-[10px] px-2 py-0.5 rounded ${isOut ? "bg-white/20 text-white" : "bg-muted"}`}>Batal</button>
                  <button onClick={() => { onEdit?.(editText); setEditing(false); }} className="text-[10px] px-2 py-0.5 rounded bg-pink-500 text-white">Simpan</button>
                </div>
              </div>
            )}
          </>
        )}
        {reaction && !isDeleted && (
          <div className={`absolute -bottom-2.5 ${isOut ? "right-2" : "left-2"} bg-card border border-pink-500/20 rounded-full px-1.5 py-0.5 text-[11px] shadow-md flex items-center gap-0.5`}>
            <span>{reaction}</span>
            {msg.wa_reaction && !msg.reaction && <span className="text-[7px] text-green-500 font-bold">WA</span>}
          </div>
        )}
        {/* Reaction picker popup */}
        {showReactions && !isDeleted && (
          <div className={`absolute z-20 -top-9 ${isOut ? "right-0" : "left-0"} flex items-center gap-0.5 bg-card border border-pink-500/20 rounded-full px-1.5 py-1 shadow-lg`}>
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => { onReact?.(reaction === e ? null : e); setShowReactions(false); }} className={`text-base hover:scale-125 transition-transform ${reaction === e ? "scale-110" : ""}`}>{e}</button>
            ))}
          </div>
        )}
        <div className={`flex items-center gap-1 justify-end text-[9px] px-1 ${isDeleted ? "text-muted-foreground" : isOut ? "text-white/85" : "text-muted-foreground"}`}>
          {!isDeleted && onReact && (
            <button onClick={() => setShowReactions((v) => !v)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/20" title="Beri reaksi">
              <span className="text-[11px] leading-none">😊</span>
            </button>
          )}
          {!isDeleted && onStar && (
            <button onClick={onStar} className={`transition-opacity p-0.5 rounded hover:bg-white/20 ${starred ? "opacity-100 text-amber-400" : "opacity-0 group-hover:opacity-100"}`} title={starred ? "Hapus bintang" : "Tandai bintang"}>
              <Star className={`w-3 h-3 ${starred ? "fill-current" : ""}`} />
            </button>
          )}
          {isOut && !isDeleted && msg.text && onEdit && (
            <button onClick={() => { setEditText(msg.text || ""); setEditing(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/20" title="Edit pesan">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {!isDeleted && msg.text && (
            <button onClick={() => navigator.clipboard?.writeText(msg.text || "").then(() => toast({ title: "✅ Pesan disalin" })).catch(() => {})} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/20" title="Salin pesan">
              <Copy className="w-3 h-3" />
            </button>
          )}
          {isOut && !isDeleted && onDelete && (
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/20" title="Hapus pesan">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <span>{new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
          {isOut && !isDeleted && (
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




/* ============================================================
   ===============  FITUR BARU  ===============================
   ============================================================ */

/* ------------- VOICE RECORDER BUTTON ------------- */
function VoiceRecorderButton({ onRecorded, disabled }: { onRecorded: (file: File) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  async function start() {
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        if (blob.size > 1024) {
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
          onRecorded(file);
        }
      };
      rec.start();
      mediaRef.current = rec;
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((s) => {
        if (s >= 60) { stop(); return s; }
        return s + 1;
      }), 1000);
    } catch (e: any) {
      toast({ title: "Mic ditolak", description: e?.message || "Izinkan akses mikrofon", variant: "destructive" });
    }
  }

  function stop() {
    try { mediaRef.current?.stop(); } catch {}
    mediaRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
  }

  function cancel() {
    chunksRef.current = [];
    try { mediaRef.current?.stop(); } catch {}
    mediaRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
  }

  if (recording) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/15 border border-red-500/40">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] font-mono font-bold text-red-600">{String(Math.floor(seconds/60)).padStart(2,"0")}:{String(seconds%60).padStart(2,"0")}</span>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full text-red-600 hover:bg-red-500/20" onClick={cancel} title="Batal">
          <X className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" className="h-7 w-7 rounded-full bg-red-500 hover:bg-red-600 text-white" onClick={stop} title="Kirim">
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={start}
      className="rounded-full shrink-0 text-pink-500 hover:text-pink-600 hover:bg-pink-500/10"
      title="Rekam voice note (maks 60 detik)"
    >
      <Mic className="w-4 h-4" />
    </Button>
  );
}

/* ------------- REVEAL IDENTITY BUTTON ------------- */
function RevealButton({ thread, visitorId }: { thread: Thread; visitorId: string }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);

  const loadStatus = useCallback(async () => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_reveal_status&visitor_id=${encodeURIComponent(visitorId)}&thread_id=${thread.id}`;
      const r = await fetch(url, { headers: { "x-api-key": PUBLIC_API_KEY } });
      const j = await r.json();
      setStatus(j?.data || null);
    } catch {}
  }, [thread.id, visitorId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Cari permintaan terakhir SEBAGAI requester di thread ini
  const myRequest = (status?.as_requester || []).find((x: any) => x.thread_id === thread.id);

  async function submitReveal() {
    if (!/^\d{6}$/.test(pin)) { toast({ title: "PIN 6 digit", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_reveal_request`;
      const r = await fetch(url, { method: "POST", headers: { "x-api-key": PUBLIC_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ thread_id: thread.id, requester_visitor_id: visitorId, pin }) });
      const j = await r.json();
      if (j?.error) throw new Error(j.error);
      toast({ title: "🔓 Permintaan terkirim", description: "Saldo Rp 5.000 ditahan. Refund 100% jika pengirim menolak." });
      setOpen(false); setPin("");
      loadStatus();
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.message || "Error", variant: "destructive" });
    } finally { setLoading(false); }
  }

  if (myRequest?.status === "approved") {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30" title={`Pengirim: ${myRequest.revealed_name}`}>
        <Eye className="w-3 h-3 text-emerald-500" />
        <span className="text-[10px] font-bold text-emerald-600 truncate max-w-[80px]">{myRequest.revealed_name}</span>
      </div>
    );
  }
  if (myRequest?.status === "pending") {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
        <Clock className="w-3 h-3 text-amber-500" />
        <span className="text-[10px] font-bold text-amber-600">Reveal pending</span>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="rounded-full gap-1 h-7 px-2 text-[10px] border-fuchsia-500/40 text-fuchsia-600 hover:bg-fuchsia-500/10"
      >
        <Eye className="w-3 h-3" /> Reveal
      </Button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card border border-fuchsia-500/30 p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white"><Eye className="w-5 h-5" /></div>
              <div className="flex-1">
                <h3 className="font-black text-base">Reveal Identitas</h3>
                <p className="text-[11px] text-muted-foreground">Minta pengirim ungkap siapa dia.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 p-3 text-[11px] space-y-1.5">
              <div className="flex justify-between"><span>Biaya escrow</span><b>Rp 5.000</b></div>
              <div className="text-muted-foreground">Saldo ditahan. Jika disetujui → diberikan ke pengirim. Jika ditolak → <b className="text-emerald-600">refund 100%</b>.</div>
            </div>
            <div>
              <label className="text-[11px] font-semibold flex items-center gap-1 mb-1"><Lock className="w-3 h-3" /> PIN 6 Digit</label>
              <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="••••••" maxLength={6} />
            </div>
            <Button onClick={submitReveal} disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />} Kirim Permintaan
            </Button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ------------- WALL PUBLIK VIEW ------------- */
interface WallItem {
  id: string;
  sender_name: string | null;
  masked_phone: string | null;
  message: string;
  mood_tag: string | null;
  reaction_counts: { heart?: number; fire?: number; laugh?: number; cry?: number };
  total_reactions: number;
  created_at: string;
  my_reaction: string | null;
  is_mine: boolean;
}

function WallView({ visitorId, onCompose }: { visitorId: string; onCompose: () => void }) {
  const [items, setItems] = useState<WallItem[]>([]);
  const [leaders, setLeaders] = useState<WallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"new" | "hot">("new");
  const [showLeader, setShowLeader] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_wall_list&sort=${sort}&visitor_id=${encodeURIComponent(visitorId)}&limit=50`, { headers: { "x-api-key": PUBLIC_API_KEY } }).then((r) => r.json()),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_wall_leaderboard`, { headers: { "x-api-key": PUBLIC_API_KEY } }).then((r) => r.json()),
      ]);
      if (Array.isArray(a?.data)) setItems(a.data);
      if (Array.isArray(b?.data)) setLeaders(b.data);
    } finally { setLoading(false); }
  }, [sort, visitorId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("confess-wall")
      .on("postgres_changes", { event: "*", schema: "public", table: "confess_public_wall" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function react(wallId: string, emoji: string) {
    setItems((prev) => prev.map((it) => {
      if (it.id !== wallId) return it;
      const counts = { ...(it.reaction_counts || {}) } as any;
      let total = it.total_reactions || 0;
      let newMy: string | null = emoji;
      if (it.my_reaction === emoji) {
        counts[emoji] = Math.max(0, (counts[emoji] || 0) - 1);
        total = Math.max(0, total - 1);
        newMy = null;
      } else {
        if (it.my_reaction) { counts[it.my_reaction] = Math.max(0, (counts[it.my_reaction] || 0) - 1); }
        else { total += 1; }
        counts[emoji] = (counts[emoji] || 0) + 1;
      }
      return { ...it, reaction_counts: counts, total_reactions: total, my_reaction: newMy };
    }));
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_wall_react`, {
        method: "POST", headers: { "x-api-key": PUBLIC_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ wall_id: wallId, visitor_id: visitorId, emoji }),
      });
    } catch { load(); }
  }

  const EMOJI_MAP: Record<string, { icon: any; label: string; cls: string }> = {
    heart: { icon: Heart, label: "❤️", cls: "text-rose-500" },
    fire:  { icon: Flame, label: "🔥", cls: "text-orange-500" },
    laugh: { icon: Laugh, label: "😂", cls: "text-amber-500" },
    cry:   { icon: Frown, label: "😢", cls: "text-blue-500" },
  };

  return (
    <>
      <Button onClick={onCompose} className="w-full gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 h-11 text-sm font-bold shadow-lg">
        <Globe className="w-4 h-4" /> Tulis Confess ke Wall
      </Button>

      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 rounded-full bg-muted/60 flex-1">
          {(["new", "hot"] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={`flex-1 px-3 py-1.5 rounded-full text-[11px] font-bold ${sort === s ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
              {s === "new" ? "🆕 Terbaru" : "🔥 Trending"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowLeader((v) => !v)} className="rounded-full gap-1 h-9 px-3 text-[11px]">
          <Trophy className="w-3.5 h-3.5" /> Top
        </Button>
      </div>

      {showLeader && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /><h3 className="font-bold text-sm">Leaderboard Minggu Ini</h3></div>
          {leaders.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Belum ada confess populer minggu ini.</p>
          ) : leaders.slice(0, 10).map((l, i) => (
            <div key={l.id} className="flex items-center gap-2 text-[11px] bg-card rounded-lg p-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-zinc-400 text-white" : i === 2 ? "bg-orange-700 text-white" : "bg-muted"}`}>{i + 1}</span>
              <span className="flex-1 truncate">{l.message.slice(0, 50)}</span>
              <span className="font-bold text-rose-500">🔥 {l.total_reactions}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-pink-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Globe className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Wall masih kosong. Jadilah yang pertama menulis confess publik!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-2xl border bg-card p-3 space-y-2 hover:border-pink-500/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shrink-0">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{it.sender_name || "Anonim"}</div>
                    <div className="text-[10px] text-muted-foreground">to {it.masked_phone || "•••"} · {new Date(it.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</div>
                  </div>
                </div>
                {it.mood_tag && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-600 font-bold whitespace-nowrap">{it.mood_tag}</span>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{it.message}</p>
              <div className="flex items-center gap-1 pt-1 border-t">
                {Object.entries(EMOJI_MAP).map(([key, e]) => {
                  const Icon = e.icon;
                  const active = it.my_reaction === key;
                  const n = (it.reaction_counts as any)?.[key] || 0;
                  return (
                    <button
                      key={key}
                      onClick={() => react(it.id, key)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold transition-all ${active ? "bg-pink-500/20 ring-1 ring-pink-500/50" : "hover:bg-muted"}`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${active ? e.cls + " fill-current" : "text-muted-foreground"}`} />
                      {n > 0 && <span className={active ? e.cls : "text-muted-foreground"}>{n}</span>}
                    </button>
                  );
                })}
                <div className="flex-1" />
                <span className="text-[10px] text-muted-foreground">{it.total_reactions} reaksi</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------- SCHEDULED VIEW ------------- */
interface ScheduledItem {
  id: string;
  sender_name: string | null;
  target_phones: string[];
  message: string;
  mood_tag: string | null;
  share_to_wall: boolean;
  scheduled_at: string;
  status: string;
  price_charged: number;
  trx_id: string | null;
  created_at: string;
  executed_at: string | null;
  error_message: string | null;
}

function ScheduledView({ visitorId, onCompose }: { visitorId: string; onCompose: () => void }) {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_scheduled_list&visitor_id=${encodeURIComponent(visitorId)}`, { headers: { "x-api-key": PUBLIC_API_KEY } });
      const j = await r.json();
      if (Array.isArray(j?.data)) setItems(j.data);
    } finally { setLoading(false); }
  }, [visitorId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("confess-scheduled")
      .on("postgres_changes", { event: "*", schema: "public", table: "confess_scheduled" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function cancel(id: string) {
    if (!confirm("Batalkan confess terjadwal? Saldo akan dikembalikan 100%.")) return;
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api?endpoint=confess_scheduled_cancel`, {
        method: "POST", headers: { "x-api-key": PUBLIC_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ id, visitor_id: visitorId }),
      });
      const j = await r.json();
      if (j?.error) throw new Error(j.error);
      toast({ title: "✅ Dibatalkan", description: `Refund Rp ${(j?.data?.refunded || 0).toLocaleString("id-ID")}` });
      load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.message, variant: "destructive" });
    }
  }

  const STATUS: Record<string, { cls: string; label: string; icon: any }> = {
    pending:   { cls: "bg-amber-500/15 text-amber-600",  label: "Menunggu",  icon: Clock },
    sent:      { cls: "bg-emerald-500/15 text-emerald-600", label: "Terkirim", icon: CheckCircle2 },
    failed:    { cls: "bg-red-500/15 text-red-600",      label: "Gagal",     icon: XCircle },
    cancelled: { cls: "bg-muted text-muted-foreground",  label: "Dibatalkan", icon: X },
  };

  return (
    <>
      <Button onClick={onCompose} className="w-full gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-fuchsia-500 h-11 text-sm font-bold shadow-lg">
        <CalendarClock className="w-4 h-4" /> Jadwalkan Confess Baru
      </Button>

      {loading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <CalendarClock className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada confess terjadwal.</p>
          <p className="text-[11px] text-muted-foreground mt-1">Atur waktu spesifik agar pesan kamu terkirim otomatis 🕒</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const st = STATUS[it.status] || STATUS.pending;
            const Icon = st.icon;
            const when = new Date(it.scheduled_at);
            const diff = when.getTime() - Date.now();
            const inFuture = diff > 0 && it.status === "pending";
            return (
              <div key={it.id} className="rounded-2xl border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center text-white shrink-0">
                      <CalendarClock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{when.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</div>
                      <div className="text-[10px] text-muted-foreground">{it.target_phones?.length || 0} nomor · Rp {(it.price_charged || 0).toLocaleString("id-ID")}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${st.cls}`}>
                    <Icon className="w-3 h-3" /> {st.label}
                  </span>
                </div>
                {it.mood_tag && <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-600 font-bold inline-block">{it.mood_tag}</span>}
                <p className="text-xs bg-muted/40 rounded-lg p-2 line-clamp-3">{it.message}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
                  {it.target_phones?.map((p, i) => (
                    <span key={i} className="font-mono bg-muted px-1.5 py-0.5 rounded">+{p}</span>
                  ))}
                </div>
                {it.error_message && <p className="text-[11px] text-red-600 bg-red-500/10 p-2 rounded-lg">{it.error_message}</p>}
                {inFuture && (
                  <Button onClick={() => cancel(it.id)} variant="outline" size="sm" className="w-full rounded-xl border-red-500/40 text-red-600 hover:bg-red-500/10 gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Batalkan & Refund
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------- CONFESS ROULETTE VIEW ------------- */
const ROULETTE_MOODS = [
  { tag: "💘 Suka", v: "💘 Suka" },
  { tag: "💔 Patah", v: "💔 Patah" },
  { tag: "🥀 Galau", v: "🥀 Galau" },
  { tag: "🌙 Rindu", v: "🌙 Rindu" },
  { tag: "😂 Lucu", v: "😂 Lucu" },
  { tag: "🤫 Rahasia", v: "🤫 Rahasia" },
];


/* ------------- CONFESS BERHADIAH VIEW ------------- */
function RewardView({ visitorId, onGoWall }: { visitorId: string; onGoWall: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<{ reactions: number; gems: number }[]>([]);
  const [gems, setGems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await callConfessExtra({ action: "reward_status", visitor_id: visitorId });
      setItems(j.items || []);
      setMilestones(j.milestones || []);
      setGems(j.gems ?? 0);
    } catch (e: any) {
      toast({ title: "Gagal memuat", description: e?.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [visitorId]);

  useEffect(() => { load(); }, [load]);

  async function claim(wallId: string, milestone: number) {
    const key = wallId + milestone;
    setClaiming(key);
    try {
      const j = await callConfessExtra({ action: "reward_claim", visitor_id: visitorId, wall_id: wallId, milestone });
      toast({ title: "🏆 Hadiah diklaim!", description: `+${j.gems_awarded} gem` });
      setGems(j.gems ?? gems);
      load();
    } catch (e: any) {
      toast({ title: "Gagal klaim", description: e?.message, variant: "destructive" });
    } finally { setClaiming(null); }
  }

  const totalClaimable = items.reduce((a, b) => a + (b.claimable?.length || 0), 0);

  return (
    <>
      <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-black text-sm bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Confess Berhadiah</h3>
              <p className="text-[10px] text-muted-foreground">Confess Wall populer = hadiah gem 💎</p>
            </div>
          </div>
          <span className="text-sm font-black text-amber-600 flex items-center gap-1"><Gem className="w-4 h-4" /> {gems}</span>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-3">
        <div className="text-[11px] font-bold mb-2">🎯 Target Hadiah</div>
        <div className="grid grid-cols-2 gap-2">
          {milestones.map((m) => (
            <div key={m.reactions} className="rounded-xl bg-amber-500/10 p-2 text-center">
              <div className="text-[11px] font-bold">🔥 {m.reactions} reaksi</div>
              <div className="text-[11px] text-amber-600 font-black flex items-center justify-center gap-1"><Gem className="w-3 h-3" /> {m.gems} gem</div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center space-y-3">
          <Award className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Belum ada confess Wall kamu yang dapat reaksi.<br />Tulis confess publik dan kumpulkan reaksi untuk dapat hadiah!</p>
          <Button variant="outline" size="sm" onClick={onGoWall} className="rounded-full gap-1"><Globe className="w-3.5 h-3.5" /> Ke Wall Publik</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {totalClaimable > 0 && (
            <div className="text-[11px] font-bold text-amber-600 text-center">🎉 Ada {totalClaimable} hadiah siap diklaim!</div>
          )}
          {items.map((it) => (
            <div key={it.wall_id} className="rounded-2xl border bg-card p-3 space-y-2">
              <p className="text-xs line-clamp-2">{it.message}</p>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-rose-500">🔥 {it.total_reactions} reaksi</span>
                {it.next && <span className="text-muted-foreground">Berikutnya: {it.next.reactions} 🔥 → {it.next.gems}💎</span>}
              </div>
              {it.claimable?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                  {it.claimable.map((c: any) => (
                    <Button key={c.milestone} onClick={() => claim(it.wall_id, c.milestone)} disabled={claiming === it.wall_id + c.milestone} size="sm" className="rounded-full h-8 gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-[11px]">
                      {claiming === it.wall_id + c.milestone ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gem className="w-3 h-3" />} Klaim {c.gems} gem
                    </Button>
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




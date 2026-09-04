import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import {
  Send, Bot, User, Loader2, Trash2, ShoppingBag, Music, Gamepad2, VenetianMask,
  AlertCircle, Megaphone, ImagePlus, X, Mic, MicOff, Copy, Check, RefreshCw,
  ShieldAlert, Ticket, Wallet, Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { moderateOutgoing } from "@/lib/chat-moderation";
import storeAvatar from "@/assets/store-qris.jpg";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
interface Msg { role: "user" | "assistant"; content: string; images?: string[] }

const STORAGE_KEY = "store_ai_history_v1";
const BLOCK_KEY = "store_ai_toxic_block_until";
const STRIKE_KEY = "store_ai_toxic_strikes";

const QUICK_PROMPTS = [
  { icon: ShoppingBag, label: "Produk terlaris", q: "Tampilkan 5 produk terlaris beserta harga dan link." },
  { icon: Megaphone, label: "Sponsor aktif", q: "Apa saja sponsor yang sedang aktif sekarang?" },
  { icon: Wallet, label: "Saldo & PIN aku", q: "Berapa total saldo, saldo IN, dan status PIN serta email akunku?" },
  { icon: Gamepad2, label: "Kredit & gem game", q: "Kredit game aku habis atau unlimited? Berapa gem, koin, dan total streak aku serta masa aktifnya?" },
  { icon: Flame, label: "Fire Pass & Quest", q: "Bagaimana progres Fire Pass, Quest, dan membership aku? Sertakan harga top up." },
  { icon: Ticket, label: "Voucher & promo", q: "Ada kode voucher atau promo apa sekarang? Berlaku sampai kapan?" },
  { icon: Music, label: "Level musik aku", q: "Berapa level musik aku dan total menit dengar?" },
  { icon: VenetianMask, label: "Tentang Anon Chat", q: "Apa itu Anon Chat dan bagaimana cara pakainya?" },
  { icon: AlertCircle, label: "Lapor penipu", q: "Aku mau lapor penipuan, bagaimana caranya dan apa saja yang harus aku siapkan?" },
  { icon: Bot, label: "Update versi & bot", q: "Apa update versi terbaru web ini dan apakah bot WA sedang online?" },
];

const NAV_SHORTCUTS = [
  { label: "🤖 Bot Galau", to: "/?tab=galau" },
  { label: "💌 Confess", to: "/?tab=confess" },
  { label: "💰 Top Up / Deposit", to: "/?tab=plus" },
  { label: "🎫 Tiket Support", to: "/?tab=tiket" },
  { label: "🏪 Jualan", to: "/?tab=jualan" },
];

async function fileToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const max = 900;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

export default function StoreAITab() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>(() => {
    try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<number>(() => Number(localStorage.getItem(BLOCK_KEY) || 0));
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);

  const blocked = blockedUntil > Date.now();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function registerToxic() {
    const strikes = Number(localStorage.getItem(STRIKE_KEY) || 0) + 1;
    localStorage.setItem(STRIKE_KEY, String(strikes));
    if (strikes >= 3) {
      const until = Date.now() + 365 * 86400000; // dianggap permanen
      localStorage.setItem(BLOCK_KEY, String(until));
      setBlockedUntil(until);
      toast({ title: "🚫 Diblokir permanen", description: "Pelanggaran berulang. Hubungi admin untuk banding.", variant: "destructive" });
    } else {
      const until = Date.now() + 86400000;
      localStorage.setItem(BLOCK_KEY, String(until));
      setBlockedUntil(until);
      toast({ title: "🚫 Store AI diblokir 1 hari", description: `Bahasa kasar terdeteksi (pelanggaran ke-${strikes}). Pelanggaran ke-3 = permanen.`, variant: "destructive" });
    }
  }

  async function onPickImages(files: FileList | null) {
    if (!files) return;
    const slice = Array.from(files).slice(0, 3 - images.length);
    for (const f of slice) {
      try { setImages((p) => [...p, await fileToDataUrl(f)]); }
      catch { toast({ title: "Gagal memproses foto", variant: "destructive" }); }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: "Tidak didukung", description: "Browser ini belum mendukung input suara.", variant: "destructive" }); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "id-ID";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput((prev) => (prev ? prev.replace(/\s*$/, " ") : "") + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function callAi(history: Msg[]) {
    const visitorId = localStorage.getItem("balance_visitor_id") || getVisitorId();
    const payload = history.map((m) => {
      if (m.role === "user" && m.images?.length) {
        const parts: Part[] = [{ type: "text", text: m.content || "Tolong analisis foto ini." }];
        for (const url of m.images) parts.push({ type: "image_url", image_url: { url } });
        return { role: m.role, content: parts };
      }
      return { role: m.role, content: m.content };
    });
    const { data, error } = await supabase.functions.invoke("store-ai-chat", {
      body: { visitorId, messages: payload },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return (data as any)?.reply || "(kosong)";
  }

  async function send(text?: string) {
    if (blocked) {
      toast({ title: "Akses diblokir", description: "Kamu belum bisa memakai Store AI.", variant: "destructive" });
      return;
    }
    const content = (text ?? input).trim();
    if ((!content && images.length === 0) || loading) return;

    const mod = moderateOutgoing(content);
    if (mod.hadBannedWord) { registerToxic(); return; }

    const next: Msg[] = [...messages, { role: "user", content, images: images.length ? images : undefined }];
    setMessages(next);
    setInput("");
    setImages([]);
    setLoading(true);
    try {
      const reply = await callAi(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.message || "Coba lagi.", variant: "destructive" });
      setMessages(next);
    } finally {
      setLoading(false);
    }
  }

  async function regenerate(idx: number) {
    if (loading) return;
    const history = messages.slice(0, idx);
    setLoading(true);
    try {
      const reply = await callAi(history);
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast({ title: "Gagal mengulang", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function copyMsg(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { toast({ title: "Gagal menyalin", variant: "destructive" }); }
  }

  function clearChat() {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[480px] max-w-3xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 shadow-xl mb-3">
        <div className="relative rounded-[14px] bg-background/95 backdrop-blur p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 blur-md opacity-70 animate-pulse" />
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-white/40 shadow-lg bg-background">
                <img src={storeAvatar} alt="Store AI" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-lg leading-tight bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">Store AI</h2>
              <p className="text-[11px] text-muted-foreground font-medium">Kirim foto, pakai suara, tanya apapun soal toko 🚀</p>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" onClick={clearChat} className="shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pintasan navigasi */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none">
        {NAV_SHORTCUTS.map((s) => (
          <button
            key={s.to}
            onClick={() => navigate(s.to)}
            className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border bg-background hover:border-violet-400 hover:bg-violet-500/5 transition-all active:scale-95"
          >
            {s.label}
          </button>
        ))}
      </div>

      {blocked && (
        <div className="mb-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-rose-300">Akses Store AI diblokir</p>
            <p className="text-muted-foreground">
              Bahasa kasar terdeteksi. Bisa dipakai lagi{" "}
              {new Date(blockedUntil).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}.
              Banding? Hubungi admin lewat tiket.
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-2xl bg-muted/30 border p-3 space-y-3 mb-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="inline-flex w-16 h-16 rounded-3xl overflow-hidden ring-2 ring-violet-500/30 items-center justify-center mb-3">
              <img src={storeAvatar} alt="Store AI" className="w-full h-full object-cover" />
            </div>
            <h3 className="font-bold text-base mb-1">Halo! Aku Store AI 👋</h3>
            <p className="text-xs text-muted-foreground mb-4 px-6">Aku bisa bantu jawab apapun seputar Agung Adi Store. Coba pilih:</p>
            <div className="grid grid-cols-2 gap-2 px-2">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p.q)}
                  className="flex items-center gap-2 text-left text-xs font-semibold p-2.5 rounded-xl bg-background border hover:border-violet-400 hover:bg-violet-500/5 transition-all active:scale-95"
                >
                  <p.icon className="w-4 h-4 text-violet-500 shrink-0" />
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center ${m.role === "user" ? "bg-primary text-primary-foreground" : "ring-2 ring-violet-500/30"}`}>
              {m.role === "user" ? <User className="w-4 h-4" /> : <img src={storeAvatar} alt="Store AI" className="w-full h-full object-cover" />}
            </div>
            <div className="max-w-[80%] space-y-1">
              <div className={`rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-background border rounded-tl-sm"}`}>
                {m.images?.length ? (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {m.images.map((src, k) => (
                      <img key={k} src={src} alt="lampiran" className="w-24 h-24 object-cover rounded-lg border" />
                    ))}
                  </div>
                ) : null}
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-a:text-violet-500 prose-img:my-1 prose-img:rounded-xl">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children, ...props }) => {
                          const isInternal = href?.startsWith("/");
                          return (
                            <a
                              {...props}
                              href={href}
                              onClick={(e) => {
                                if (isInternal && href) {
                                  e.preventDefault();
                                  navigate(href);
                                }
                              }}
                              target={isInternal ? undefined : "_blank"}
                              rel={isInternal ? undefined : "noopener noreferrer"}
                              className="font-semibold underline decoration-violet-400 underline-offset-2 hover:text-violet-600"
                            >
                              {children}
                            </a>
                          );
                        },
                        img: ({ src, alt }) => (
                          src && src !== "-" ? (
                            <img
                              src={src}
                              alt={alt || ""}
                              loading="lazy"
                              className="my-2 rounded-xl border max-h-48 w-auto object-cover cursor-pointer hover:opacity-90"
                              onClick={() => { if (alt?.startsWith("/produk")) navigate(alt); }}
                            />
                          ) : null
                        ),
                      }}
                    >{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
              </div>
              {m.role === "assistant" && (
                <div className="flex gap-1">
                  <button
                    onClick={() => copyMsg(m.content, i)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border bg-background hover:bg-muted transition"
                  >
                    {copiedIdx === i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copiedIdx === i ? "Disalin" : "Salin"}
                  </button>
                  <button
                    onClick={() => regenerate(i)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border bg-background hover:bg-muted transition disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" /> Ulangi
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden ring-2 ring-violet-500/30 animate-pulse">
              <img src={storeAvatar} alt="Store AI" className="w-full h-full object-cover" />
            </div>
            <div className="bg-background border rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Mengetik…
            </div>
          </div>
        )}
      </div>

      {/* Pratinjau foto */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="lampiran" className="w-16 h-16 object-cover rounded-lg border" />
              <button
                onClick={() => setImages((p) => p.filter((_, k) => k !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPickImages(e.target.files)} />
        <Button
          variant="outline" size="icon"
          onClick={() => fileRef.current?.click()}
          disabled={blocked || images.length >= 3}
          className="rounded-2xl shrink-0"
          aria-label="Kirim foto"
        >
          <ImagePlus className="w-4 h-4" />
        </Button>
        <Button
          variant={listening ? "destructive" : "outline"} size="icon"
          onClick={toggleVoice}
          disabled={blocked}
          className="rounded-2xl shrink-0"
          aria-label="Input suara"
        >
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={blocked ? "Akses diblokir sementara…" : listening ? "Mendengarkan… bicara sekarang" : "Tanya apapun / kirim foto…"}
          rows={1}
          disabled={blocked}
          className="flex-1 resize-none rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 max-h-32 disabled:opacity-60"
        />
        <Button onClick={() => send()} disabled={blocked || loading || (!input.trim() && images.length === 0)} className="rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 hover:opacity-90 shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

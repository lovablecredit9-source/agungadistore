import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { moderateOutgoing } from "@/lib/chat-moderation";
import ReactMarkdown from "react-markdown";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  HeartCrack, Frown, Angry, CloudDrizzle, Users,
  Send, Loader2, Sparkles, Bot, MessageCircleHeart,
  Menu, Plus, ImagePlus, X, Trash2, Pencil, Brain, Volume2, Square, Mic, Copy, RotateCcw,
} from "lucide-react";
import { getVisitorId } from "@/lib/visitor-id";
import botAvatar from "@/assets/bot-galau-avatar.png";

type AiMode = "biasa" | "pro" | "super_pro";
const AI_MODE_LABEL: Record<AiMode, string> = {
  biasa: "Biasa",
  pro: "Pro",
  super_pro: "Super Pro",
};

type Mood = "sedih" | "marah" | "patah hati" | "cemas" | "butuh teman";
const MOODS: { key: Mood; label: string; icon: any; grad: string }[] = [
  { key: "sedih", label: "Sedih", icon: CloudDrizzle, grad: "from-sky-400 to-blue-600" },
  { key: "patah hati", label: "Patah Hati", icon: HeartCrack, grad: "from-rose-400 to-pink-600" },
  { key: "marah", label: "Marah", icon: Angry, grad: "from-orange-400 to-red-600" },
  { key: "cemas", label: "Cemas", icon: Frown, grad: "from-amber-400 to-yellow-600" },
  { key: "butuh teman", label: "Butuh Teman", icon: Users, grad: "from-emerald-400 to-teal-600" },
];

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string | null;
  createdAt: string;
}
interface ChatSession {
  id: string;
  title: string;
  mood: Mood;
  aiMode: AiMode;
  deepThink: boolean;
  messages: Msg[];
  updatedAt: string;
}

const makeId = () =>
  (() => { try { return crypto.randomUUID(); } catch { return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`; } })();

const WELCOME: Msg = {
  id: "welcome",
  role: "assistant",
  content: "Halo, aku **Bot Galau AI by Agung Adi** 💕\nCerita aja pelan-pelan, aku dengerin tanpa nge-judge. Boleh kirim foto juga kalau ada yang mau ditunjukin.",
  createdAt: new Date().toISOString(),
};

const STORE_KEY = () => `bot_galau_sessions_${getVisitorId()}`;
const ACTIVE_KEY = () => `bot_galau_active_${getVisitorId()}`;

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORE_KEY());
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveSessions(s: ChatSession[]) {
  try { localStorage.setItem(STORE_KEY(), JSON.stringify(s.slice(0, 50))); } catch {}
}
function newSession(): ChatSession {
  return {
    id: makeId(),
    title: "Curhat Baru",
    mood: "butuh teman",
    aiMode: "biasa",
    deepThink: false,
    messages: [{ ...WELCOME, createdAt: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  };
}

async function fileToDataUrl(file: File): Promise<string> {
  // Downscale to <= 1280 px and convert to JPEG to keep payload small
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const max = 1280;
    let { width, height } = img;
    if (width > max || height > max) {
      const ratio = Math.min(max / width, max / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    c.getContext("2d")!.drawImage(img, 0, 0, width, height);
    return c.toDataURL("image/jpeg", 0.82);
  } catch {
    return dataUrl;
  }
}

export default function BotGalauTab() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [renameId, setRenameId] = useState<string>("");
  const [renameVal, setRenameVal] = useState("");
  const [speakingId, setSpeakingId] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const viaVoiceRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Speech-to-text: rekam suara (VN) lalu otomatis dikirim ke AI
  const toggleVoice = () => {
    if (recording) {
      try { recognitionRef.current?.stop(); } catch {}
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Browser ini belum mendukung input suara. Pakai Chrome terbaru ya.");
      return;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
    const rec = new SR();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setText((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      setRecording(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        toast.error("Izin mikrofon ditolak. Aktifkan dari ikon gembok browser.");
      } else if (e?.error === "no-speech") {
        toast.error("Nggak ada suara terdengar, coba lagi ya.");
      }
    };
    rec.onend = () => {
      setRecording(false);
      const said = finalText.trim();
      if (said) {
        viaVoiceRef.current = true;
        sendMessage(said);
      }
    };
    recognitionRef.current = rec;
    setText("");
    setRecording(true);
    try { rec.start(); } catch { setRecording(false); }
  };

  // Fallback: suara baca bawaan browser (kalau ElevenLabs gagal)
  const speakBrowser = (id: string, clean: string) => {
    const synth = window.speechSynthesis;
    if (!synth) { setSpeakingId(""); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "id-ID";
    u.rate = 1;
    u.pitch = 1.05;
    const voices = synth.getVoices();
    const idVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("id"));
    if (idVoice) u.voice = idVoice;
    u.onend = () => setSpeakingId("");
    u.onerror = () => setSpeakingId("");
    setSpeakingId(id);
    synth.speak(u);
  };

  // Text-to-speech: suara AI natural via ElevenLabs (fallback ke browser)
  const speak = async (m: { id: string; content: string }) => {
    // Toggle: kalau lagi baca pesan ini, hentikan
    if (speakingId === m.id) {
      try { window.speechSynthesis?.cancel(); } catch {}
      try { audioRef.current?.pause(); } catch {}
      audioRef.current = null;
      setSpeakingId("");
      return;
    }
    // Hentikan suara apapun yang sedang berjalan
    try { window.speechSynthesis?.cancel(); } catch {}
    try { audioRef.current?.pause(); } catch {}
    audioRef.current = null;

    // Bersihkan markdown sederhana agar enak didengar
    const clean = m.content
      .replace(/[*_#`>~]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;

    setSpeakingId(m.id);
    try {
      const { data, error } = await supabase.functions.invoke("bot-galau-tts", {
        body: { text: clean },
      });
      if (error) throw error;
      const b64 = (data as any)?.audioContent;
      if (!b64) throw new Error((data as any)?.error || "no audio");
      const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(""); audioRef.current = null; };
      audio.onerror = () => { setSpeakingId(""); audioRef.current = null; };
      await audio.play();
    } catch {
      // Fallback ke suara browser kalau ElevenLabs gagal
      speakBrowser(m.id, clean);
    }
  };

  // Salin teks pesan ke clipboard
  const copyMsg = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Pesan disalin");
    } catch {
      toast.error("Gagal menyalin");
    }
  };

  // Stop suara saat komponen unmount
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); recognitionRef.current?.stop(); audioRef.current?.pause(); } catch {} }, []);


  // bootstrap
  useEffect(() => {
    let list = loadSessions();
    let activeKey = localStorage.getItem(ACTIVE_KEY()) || "";
    if (list.length === 0) {
      const s = newSession();
      list = [s];
      activeKey = s.id;
      saveSessions(list);
      localStorage.setItem(ACTIVE_KEY(), activeKey);
    } else if (!list.find((x) => x.id === activeKey)) {
      activeKey = list[0].id;
      localStorage.setItem(ACTIVE_KEY(), activeKey);
    }
    setSessions(list);
    setActiveId(activeKey);
  }, []);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) || sessions[0],
    [sessions, activeId],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, sending]);

  const persist = (updater: (prev: ChatSession[]) => ChatSession[]) => {
    setSessions((prev) => {
      const next = updater(prev);
      saveSessions(next);
      return next;
    });
  };
  const patchActive = (patch: Partial<ChatSession>) => {
    persist((prev) => prev.map((s) => (s.id === activeId ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)));
  };
  const selectSession = (id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY(), id);
    setDrawerOpen(false);
  };
  const createNew = () => {
    const s = newSession();
    persist((prev) => [s, ...prev]);
    setActiveId(s.id);
    localStorage.setItem(ACTIVE_KEY(), s.id);
    setDrawerOpen(false);
  };
  const deleteSession = (id: string) => {
    persist((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const s = newSession();
        setActiveId(s.id);
        localStorage.setItem(ACTIVE_KEY(), s.id);
        return [s];
      }
      if (id === activeId) {
        setActiveId(next[0].id);
        localStorage.setItem(ACTIVE_KEY(), next[0].id);
      }
      return next;
    });
  };
  const submitRename = () => {
    const v = renameVal.trim().slice(0, 60);
    if (!v) return setRenameId("");
    persist((prev) => prev.map((s) => (s.id === renameId ? { ...s, title: v } : s)));
    setRenameId("");
  };

  const pickImage = () => fileRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("File harus berupa gambar");
    if (f.size > 8 * 1024 * 1024) return toast.error("Foto maksimal 8MB");
    try {
      const url = await fileToDataUrl(f);
      setPendingImage(url);
    } catch { toast.error("Gagal memproses foto"); }
  };

  const sendMessage = async (quickText?: string) => {
    if (!active) return;
    const raw = (quickText || text).trim();
    if ((!raw && !pendingImage) || sending) return;

    let cleaned = raw;
    if (raw) {
      const mod = moderateOutgoing(raw);
      cleaned = mod.cleaned;
      if (!mod.ok) toast.warning("Pesan disensor: " + mod.reasons.join(", "));
    }

    const userMsg: Msg = {
      id: makeId(),
      role: "user",
      content: cleaned || "(mengirim foto)",
      image: pendingImage,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...active.messages, userMsg];
    const isFirstUser = active.messages.filter((m) => m.role === "user").length === 0;
    const newTitle = isFirstUser ? (cleaned ? cleaned.slice(0, 40) : "Curhat foto") : active.title;
    patchActive({ messages: nextMessages, title: newTitle });
    setText("");
    setPendingImage(null);
    setSending(true);

    const { data, error } = await supabase.functions.invoke("bot-galau-ai", {
      body: {
        mood: active.mood,
        aiMode: active.aiMode,
        deepThink: active.deepThink,
        messages: nextMessages
          .filter((m) => m.id !== "welcome")
          .slice(-30)
          .map((m, i, arr) => ({
            role: m.role,
            content: m.content,
            image: i === arr.length - 1 ? m.image : null,
          })),
      },
    });
    setSending(false);
    if (error || data?.error) {
      let message = data?.error || "";
      const context = (error as { context?: Response } | null)?.context;
      if (!message && context && typeof context.clone === "function") {
        try {
          const payload = await context.clone().json();
          message = String(payload?.error?.message || payload?.error || payload?.message || "");
        } catch { /* respons fungsi bukan JSON */ }
      }
      toast.error(message || error?.message || "Bot Galau lagi susah dihubungi");
      return;
    }
    const replyMsg: Msg = {
      id: makeId(),
      role: "assistant",
      content: data?.reply || "Aku dengerin kok. Coba ceritain lagi pelan-pelan ya.",
      image: data?.image || null,
      createdAt: new Date().toISOString(),
    };
    patchActive({ messages: [...nextMessages, replyMsg] });
    // Kalau pesan dikirim lewat suara (VN), balasan AI otomatis dibacakan
    if (viaVoiceRef.current) {
      viaVoiceRef.current = false;
      setTimeout(() => speak(replyMsg), 150);
    }
  };

  // Pesan ulang: minta AI menjawab lagi untuk balasan yang dipilih
  const regenerate = async (assistantId: string) => {
    if (!active || sending) return;
    const idx = active.messages.findIndex((m) => m.id === assistantId);
    if (idx < 1) return;
    // History sampai sebelum balasan ini (buang balasan lama)
    const history = active.messages.slice(0, idx);
    if (!history.some((m) => m.role === "user")) return;
    patchActive({ messages: history });
    setSending(true);
    const { data, error } = await supabase.functions.invoke("bot-galau-ai", {
      body: {
        mood: active.mood,
        aiMode: active.aiMode,
        deepThink: active.deepThink,
        regenerate: true,
        messages: history
          .filter((m) => m.id !== "welcome")
          .slice(-30)
          .map((m, i, arr) => ({
            role: m.role,
            content: m.content,
            image: i === arr.length - 1 ? m.image : null,
          })),
      },
    });
    setSending(false);
    if (error || data?.error) {
      let message = data?.error || "";
      const context = (error as { context?: Response } | null)?.context;
      if (!message && context && typeof context.clone === "function") {
        try {
          const payload = await context.clone().json();
          message = String(payload?.error?.message || payload?.error || payload?.message || "");
        } catch { /* respons fungsi bukan JSON */ }
      }
      toast.error(message || error?.message || "Bot Galau lagi susah dihubungi");
      patchActive({ messages: active.messages });
      return;
    }
    const replyMsg: Msg = {
      id: makeId(),
      role: "assistant",
      content: data?.reply || "Aku dengerin kok. Coba ceritain lagi pelan-pelan ya.",
      image: data?.image || null,
      createdAt: new Date().toISOString(),
    };
    patchActive({ messages: [...history, replyMsg] });
  };

  if (!active) return null;
  const isEmpty = active.messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[520px] -mx-4 sm:mx-0 sm:rounded-2xl overflow-hidden border-y sm:border border-border bg-card animate-fade-in">
      {/* HEADER */}
      <div className="px-3 py-2.5 border-b border-border bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-purple-500/10">


        <div className="flex items-center gap-2">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline" className="h-10 px-3 shrink-0 gap-1.5 border-pink-300 dark:border-pink-700 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-semibold">
                <Menu className="w-4 h-4" /> Riwayat
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] sm:w-80 p-0 flex flex-col">
              <SheetHeader className="p-3 border-b border-border">
                <SheetTitle className="text-base flex items-center gap-2">
                  <MessageCircleHeart className="w-4 h-4 text-pink-500" /> Riwayat Curhat
                </SheetTitle>
              </SheetHeader>
              <div className="p-3 border-b border-border">
                <Button onClick={createNew} className="w-full bg-gradient-to-br from-pink-500 to-rose-600 text-white">
                  <Plus className="w-4 h-4 mr-1" /> Chat Baru
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions
                  .slice()
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .map((s) => {
                    const isActive = s.id === activeId;
                    return (
                      <div
                        key={s.id}
                        className={`group rounded-xl border px-2.5 py-2 transition-all ${
                          isActive ? "border-pink-500/60 bg-pink-500/10" : "border-border bg-background hover:bg-secondary"
                        }`}
                      >
                        {renameId === s.id ? (
                          <div className="flex gap-1">
                            <Input
                              value={renameVal}
                              autoFocus
                              onChange={(e) => setRenameVal(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && submitRename()}
                              className="h-8 text-[13px]"
                            />
                            <Button size="sm" className="h-8 px-2" onClick={submitRename}>OK</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={() => selectSession(s.id)} className="flex-1 min-w-0 text-left">
                              <div className="text-[13px] font-semibold truncate">{s.title}</div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {AI_MODE_LABEL[s.aiMode]}{s.deepThink ? " • Deep" : ""} • {new Date(s.updatedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                              </div>
                            </button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                              onClick={() => { setRenameId(s.id); setRenameVal(s.title); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-rose-500 hover:text-rose-600"
                              onClick={() => deleteSession(s.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="p-3 border-t border-border text-[10px] text-muted-foreground text-center">
                Riwayat tersimpan di perangkat ini saja.
              </div>
            </SheetContent>
          </Sheet>

          <img
            src={botAvatar}
            alt="Bot Galau AI by Agung Adi"
            width={40}
            height={40}
            loading="lazy"
            className="w-10 h-10 rounded-2xl shadow-md object-cover bg-white shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold leading-tight truncate">Bot Galau AI</h2>
            <p className="text-[10px] text-muted-foreground truncate">
              by <span className="font-semibold text-pink-600">Agung Adi</span> • WA 085769302532
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={createNew} className="h-9 px-2.5 text-xs shrink-0">
            <Plus className="w-3.5 h-3.5 mr-1" /> Baru
          </Button>
        </div>

        {isEmpty && (
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {MOODS.map(({ key, label, icon: Icon, grad }) => {
              const isActive = active.mood === key;
              return (
                <button
                  key={key}
                  onClick={() => patchActive({ mood: key })}
                  className={`min-h-[52px] rounded-xl border px-1 py-1.5 text-center transition-all ${
                    isActive ? `border-transparent bg-gradient-to-br ${grad} text-white shadow-md`
                             : "border-border bg-background/70 hover:bg-secondary"
                  }`}
                >
                  <Icon className="w-4 h-4 mx-auto mb-0.5" />
                  <div className="text-[10px] font-semibold leading-tight">{label}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MESSAGES — full clean canvas */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-background/40">
        {active.messages.map((m) => {
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <img src={botAvatar} alt="" width={28} height={28} loading="lazy"
                  className="w-7 h-7 rounded-full bg-white shrink-0 mt-1 object-cover" />
              )}
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed shadow-sm ${
                mine ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-br-md"
                     : "bg-secondary text-foreground rounded-bl-md"
              }`}>
                {m.image && (
                  <img src={m.image} alt="lampiran" className="rounded-lg mb-1.5 max-h-56 object-cover" loading="lazy" />
                )}
                {m.content && (
                  <div className="prose prose-sm max-w-none prose-p:my-0 prose-ul:my-1 prose-li:my-0 dark:prose-invert whitespace-pre-wrap break-words">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
                <div className={`flex items-center gap-2 mt-1 ${mine ? "justify-end" : "justify-between"}`}>
                  <span className={`text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                    {new Date(m.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {!mine && m.content && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => speak(m)}
                        className={`flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 transition-colors ${
                          speakingId === m.id
                            ? "bg-pink-500 text-white"
                            : "bg-background/70 text-muted-foreground hover:bg-secondary"
                        }`}
                        title={speakingId === m.id ? "Hentikan suara" : "Dengarkan"}
                      >
                        {speakingId === m.id ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        {speakingId === m.id ? "Stop" : "Dengar"}
                      </button>
                      <button
                        onClick={() => copyMsg(m.content)}
                        className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-background/70 text-muted-foreground hover:bg-secondary transition-colors"
                        title="Salin pesan"
                      >
                        <Copy className="w-3 h-3" /> Salin
                      </button>
                      {m.id !== "welcome" && (
                        <button
                          onClick={() => regenerate(m.id)}
                          disabled={sending}
                          className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-background/70 text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                          title="Pesan ulang"
                        >
                          <RotateCcw className="w-3 h-3" /> Ulangi
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Bot Galau lagi {active.deepThink ? "mikir dalam" : "mikir"}…
          </div>
        )}
      </div>

      {isEmpty && (
        <div className="px-3 pb-2 grid grid-cols-2 gap-2 bg-card">
          {["Aku lagi overthinking", "Aku kangen dia", "Aku habis patah hati", "Aku butuh ditenangin"].map((q) => (
            <button key={q} onClick={() => sendMessage(q)} className="rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-left hover:bg-secondary transition-colors">
              <MessageCircleHeart className="w-3.5 h-3.5 inline mr-1.5 text-pink-500" />{q}
            </button>
          ))}
        </div>
      )}

      {/* MODE BAR */}
      <div className="border-t border-border px-2 py-1.5 flex items-center gap-1.5 bg-card">
        <Select value={active.aiMode} onValueChange={(v) => patchActive({ aiMode: v as AiMode })}>
          <SelectTrigger className="h-9 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="biasa">⚡ Biasa</SelectItem>
            <SelectItem value="pro">👑 Pro</SelectItem>
            <SelectItem value="super_pro">💎 Super Pro</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => patchActive({ deepThink: !active.deepThink })}
          className={`h-9 px-2.5 rounded-[12px] border text-xs font-semibold flex items-center gap-1 transition-all ${
            active.deepThink
              ? "border-transparent bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow"
              : "border-border bg-secondary/60 hover:bg-secondary"
          }`}
          title="Mode berpikir mendalam"
        >
          <Brain className="w-3.5 h-3.5" /> Deep
        </button>
        <div className="flex-1" />
        {pendingImage && (
          <div className="relative">
            <img src={pendingImage} alt="preview" className="h-9 w-9 rounded-lg object-cover border border-border" />
            <button onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* INPUT BAR */}
      <div className="border-t border-border p-2 flex items-center gap-1.5 bg-card">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <Button size="icon" variant="ghost" onClick={pickImage} className="h-10 w-10 shrink-0" title="Kirim foto">
          <ImagePlus className="w-5 h-5 text-pink-500" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleVoice}
          disabled={sending}
          className={`h-10 w-10 shrink-0 ${recording ? "bg-rose-500 text-white animate-pulse" : ""}`}
          title={recording ? "Berhenti merekam" : "Kirim pesan suara (VN)"}
        >
          <Mic className={`w-5 h-5 ${recording ? "" : "text-pink-500"}`} />
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={recording ? "Mendengarkan suaramu…" : "Curhat ke Bot Galau AI…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          maxLength={1000}
          className="flex-1"
        />
        <Button
          size="icon"
          disabled={sending || (!text.trim() && !pendingImage)}
          onClick={() => sendMessage()}
          className="h-10 w-10 shrink-0 bg-gradient-to-br from-pink-500 to-rose-600"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      <div className="px-3 pb-2 text-[10px] text-muted-foreground leading-relaxed bg-card text-center">
        <Sparkles className="w-3 h-3 inline mr-1 text-pink-500" />
        AI ini buat teman curhat ringan, bukan pengganti bantuan profesional · <span className="font-semibold">by Agung Adi</span>
      </div>
    </div>
  );
}

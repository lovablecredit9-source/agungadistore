import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { moderateOutgoing } from "@/lib/chat-moderation";
import ReactMarkdown from "react-markdown";
import {
  HeartCrack, Frown, Angry, CloudDrizzle, Users,
  Send, Loader2, Sparkles, Bot, MessageCircleHeart, Zap, Crown, Gem,
} from "lucide-react";

type AiMode = "biasa" | "pro" | "super_pro";
const AI_MODES: { key: AiMode; label: string; icon: any; grad: string; desc: string }[] = [
  { key: "biasa", label: "Biasa", icon: Zap, grad: "from-slate-400 to-slate-600", desc: "Singkat & santai" },
  { key: "pro", label: "Pro", icon: Crown, grad: "from-indigo-400 to-purple-600", desc: "Lebih empatik" },
  { key: "super_pro", label: "Super Pro", icon: Gem, grad: "from-fuchsia-500 to-rose-600", desc: "Konselor mendalam" },
];

type Mood = "sedih" | "marah" | "patah hati" | "cemas" | "butuh teman";

const MOODS: { key: Mood; label: string; icon: any; grad: string }[] = [
  { key: "sedih", label: "Sedih", icon: CloudDrizzle, grad: "from-sky-400 to-blue-600" },
  { key: "patah hati", label: "Patah Hati", icon: HeartCrack, grad: "from-rose-400 to-pink-600" },
  { key: "marah", label: "Marah", icon: Angry, grad: "from-orange-400 to-red-600" },
  { key: "cemas", label: "Cemas", icon: Frown, grad: "from-amber-400 to-yellow-600" },
  { key: "butuh teman", label: "Butuh Teman", icon: Users, grad: "from-emerald-400 to-teal-600" },
];

interface Msg { id: string; role: "user" | "assistant"; content: string; createdAt: string; }

const starterMessages: Msg[] = [{
  id: "welcome",
  role: "assistant",
  content: "Aku Bot Galau AI. Cerita aja pelan-pelan, aku dengerin tanpa nge-judge 💔",
  createdAt: new Date().toISOString(),
}];

const makeId = () => {
  try { return crypto.randomUUID(); } catch { return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};

export default function BotGalauTab() {
  const [mood, setMood] = useState<Mood>("butuh teman");
  const [messages, setMessages] = useState<Msg[]>(starterMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const resetChat = () => {
    setMessages(starterMessages.map((m) => ({ ...m, createdAt: new Date().toISOString() })));
    setText("");
  };

  const sendMessage = async (quickText?: string) => {
    const raw = text.trim();
    const outgoing = (quickText || raw).trim();
    if (!outgoing || sending) return;
    let cleaned = raw;
    const mod = moderateOutgoing(outgoing);
    cleaned = mod.cleaned;
    if (!mod.ok) {
      toast.warning("Pesan disensor: " + mod.reasons.join(", "));
    }
    const userMsg: Msg = { id: makeId(), role: "user", content: cleaned, createdAt: new Date().toISOString() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setText("");
    setSending(true);
    const { data, error } = await supabase.functions.invoke("bot-galau-ai", {
      body: {
        mood,
        messages: nextMessages
          .filter((m) => m.id !== "welcome")
          .slice(-12)
          .map(({ role, content }) => ({ role, content })),
      },
    });
    setSending(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Bot Galau lagi susah dihubungi");
      return;
    }
    setMessages((prev) => [...prev, {
      id: makeId(),
      role: "assistant",
      content: data?.reply || "Aku dengerin kok. Coba ceritain lagi pelan-pelan ya.",
      createdAt: new Date().toISOString(),
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-170px)] min-h-[520px] rounded-2xl border border-border bg-card overflow-hidden animate-fade-in">
      <div className="px-3 py-3 border-b border-border bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-purple-500/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shrink-0">
              <HeartCrack className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight">Bot Galau AI</h2>
              <p className="text-[11px] text-muted-foreground truncate">Chat AI khusus curhat galau, bukan Anon Chat.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={resetChat} className="h-9 px-3 text-xs">
            Baru
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {MOODS.map(({ key, label, icon: Icon, grad }) => {
            const active = mood === key;
            return (
              <button
                key={key}
                onClick={() => setMood(key)}
                className={`min-h-[54px] rounded-xl border px-1.5 py-2 text-center transition-all ${
                  active ? `border-transparent bg-gradient-to-br ${grad} text-white shadow-md`
                         : "border-border bg-background/70 hover:bg-secondary"
                }`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1" />
                <div className="text-[10px] font-semibold leading-tight">{label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background/50">
        {messages.map((m) => {
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shrink-0 mt-1"><Bot className="w-4 h-4 text-white" /></div>}
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed shadow-sm ${
                mine ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-br-md"
                     : "bg-secondary text-foreground rounded-bl-md"
              }`}>
                <div className="prose prose-sm max-w-none prose-p:my-0 prose-ul:my-1 prose-li:my-0 dark:prose-invert whitespace-pre-wrap break-words">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                <div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                  {new Date(m.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Bot Galau lagi mikir…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="px-3 pb-2 grid grid-cols-2 gap-2 bg-card">
          {["Aku lagi overthinking", "Aku kangen dia", "Aku habis patah hati", "Aku butuh ditenangin"].map((q) => (
            <button key={q} onClick={() => sendMessage(q)} className="rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-left hover:bg-secondary transition-colors">
              <MessageCircleHeart className="w-3.5 h-3.5 inline mr-1.5 text-pink-500" />{q}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-2 flex items-center gap-2 bg-card">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Curhat ke Bot Galau AI…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          maxLength={1000}
          className="flex-1"
        />
        <Button size="icon" disabled={sending || !text.trim()} onClick={() => sendMessage()} className="h-10 w-10 shrink-0 bg-gradient-to-br from-pink-500 to-rose-600">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      <div className="px-3 pb-3 text-[10px] text-muted-foreground leading-relaxed bg-card">
        <Sparkles className="w-3 h-3 inline mr-1 text-pink-500" />AI ini buat teman curhat ringan, bukan pengganti bantuan profesional.
      </div>
    </div>
  );
}

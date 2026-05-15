import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles, Bot, User, Loader2, Trash2, ShoppingBag, Music, Gamepad2, VenetianMask, AlertCircle, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import storeAvatar from "@/assets/store-qris.jpg";

interface Msg { role: "user" | "assistant"; content: string }

const STORAGE_KEY = "store_ai_history_v1";

const QUICK_PROMPTS = [
  { icon: ShoppingBag, label: "Produk terlaris", q: "Tampilkan 5 produk terlaris beserta harga dan link." },
  { icon: Megaphone, label: "Sponsor aktif", q: "Apa saja sponsor yang sedang aktif sekarang?" },
  { icon: Music, label: "Level musik aku", q: "Berapa level musik aku dan total menit dengar?" },
  { icon: Gamepad2, label: "Stat game aku", q: "Tampilkan nama akun game, gem, dan total transaksi aku." },
  { icon: VenetianMask, label: "Tentang Anon Chat", q: "Apa itu Anon Chat dan bagaimana cara pakainya?" },
  { icon: AlertCircle, label: "Lapor kendala", q: "Aku ada kendala, kemana aku harus lapor?" },
  { icon: Bot, label: "Z Bot WhatsApp", q: "Z Bot itu apa? Gratis atau berbayar?" },
];

export default function StoreAITab() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>(() => {
    try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const visitorId = localStorage.getItem("balance_visitor_id") || getVisitorId();
      const { data, error } = await supabase.functions.invoke("store-ai-chat", {
        body: { visitorId, messages: next },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply || "(kosong)";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.message || "Coba lagi.", variant: "destructive" });
      setMessages(next);
    } finally {
      setLoading(false);
    }
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
              <p className="text-[11px] text-muted-foreground font-medium">Tanya seputar produk, musik, game, sponsor, akun, dan kendala 🚀</p>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" onClick={clearChat} className="shrink-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

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
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-background border rounded-tl-sm"}`}>
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

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Tanya apapun seputar toko…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 max-h-32"
        />
        <Button onClick={() => send()} disabled={loading || !input.trim()} className="rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 hover:opacity-90 shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

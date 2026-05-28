import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getVisitorId } from "@/lib/visitor-id";
import { moderateOutgoing } from "@/lib/chat-moderation";
import { maskUsername } from "@/lib/mask-username";
import {
  Heart, HeartCrack, Frown, Angry, CloudDrizzle, Users,
  Send, Image as ImageIcon, LogOut, Loader2, RefreshCw, Sparkles,
} from "lucide-react";

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
  session_id: string;
  sender_visitor_id: string;
  text: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

interface Session {
  id: string;
  partner_visitor: string;
  partner_nickname: string;
  partner_mood: string;
}

const randomNick = () => {
  const adj = ["Galau", "Senja", "Hujan", "Diam", "Bisik", "Awan", "Kabut", "Bulan"];
  const noun = ["Anonim", "Pejuang", "Pendengar", "Pelangi", "Bintang", "Camar"];
  return `${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]}`;
};

export default function BotGalauTab() {
  const visitorId = getVisitorId();
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem("galau_nick") || randomNick());
  const [mood, setMood] = useState<Mood>("butuh teman");
  const [phase, setPhase] = useState<"lobby" | "searching" | "chat">("lobby");
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => { localStorage.setItem("galau_nick", nickname); }, [nickname]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Realtime subscribe when in chat
  useEffect(() => {
    if (phase !== "chat" || !session) return;
    const ch = supabase
      .channel(`galau:${session.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "galau_messages",
        filter: `session_id=eq.${session.id}`,
      }, (payload: any) => {
        setMessages((prev) => prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as Msg]);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "galau_sessions",
        filter: `id=eq.${session.id}`,
      }, (payload: any) => {
        if (payload.new?.status === "ended") {
          toast.info("Lawan bicara mengakhiri sesi.");
          endLocal();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [phase, session?.id]);

  // Polling matchmaking
  const findMatch = useCallback(async () => {
    const { data, error } = await supabase.rpc("galau_find_match", {
      p_visitor: visitorId, p_nickname: nickname, p_mood: mood,
    });
    if (error) { toast.error("Gagal mencari: " + error.message); setPhase("lobby"); return; }
    const row = (data as any[])?.[0];
    if (row?.session_id) {
      setSession({
        id: row.session_id,
        partner_visitor: row.partner_visitor,
        partner_nickname: row.partner_nickname || "Anonim",
        partner_mood: row.partner_mood || "—",
      });
      // load any existing messages
      const { data: msgs } = await supabase
        .from("galau_messages").select("*")
        .eq("session_id", row.session_id).order("created_at", { ascending: true });
      setMessages((msgs as Msg[]) || []);
      setPhase("chat");
      toast.success("Terhubung! 💬");
    }
  }, [visitorId, nickname, mood]);

  // Detect when we get matched while waiting (someone else picked us)
  const checkPicked = useCallback(async () => {
    const { data } = await supabase
      .from("galau_sessions")
      .select("*")
      .or(`visitor_a.eq.${visitorId},visitor_b.eq.${visitorId}`)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    const s = (data as any[])?.[0];
    if (s) {
      const isA = s.visitor_a === visitorId;
      setSession({
        id: s.id,
        partner_visitor: isA ? s.visitor_b : s.visitor_a,
        partner_nickname: (isA ? s.nickname_b : s.nickname_a) || "Anonim",
        partner_mood: (isA ? s.mood_b : s.mood_a) || "—",
      });
      const { data: msgs } = await supabase
        .from("galau_messages").select("*")
        .eq("session_id", s.id).order("created_at", { ascending: true });
      setMessages((msgs as Msg[]) || []);
      setPhase("chat");
      toast.success("Terhubung! 💬");
    }
  }, [visitorId]);

  useEffect(() => {
    if (phase !== "searching") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = window.setInterval(checkPicked, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, checkPicked]);

  const startSearch = async () => {
    if (!nickname.trim()) { toast.error("Nama samaran wajib"); return; }
    setPhase("searching");
    await findMatch();
  };

  const cancelSearch = async () => {
    await supabase.from("galau_queue").delete().eq("visitor_id", visitorId);
    setPhase("lobby");
  };

  const endLocal = () => {
    setPhase("lobby");
    setSession(null);
    setMessages([]);
  };

  const endChat = async () => {
    if (!session) return;
    await supabase.rpc("galau_end_session", { p_session: session.id, p_visitor: visitorId });
    toast.success("Sesi diakhiri");
    endLocal();
  };

  const sendMessage = async (override?: { url: string; type: string; mime: string }) => {
    if (!session) return;
    const raw = text.trim();
    if (!raw && !override) return;
    let cleaned = raw;
    if (raw) {
      const mod = moderateOutgoing(raw);
      cleaned = mod.cleaned;
      if (!mod.ok) {
        await supabase.rpc("report_chat_violation", {
          p_visitor_id: visitorId, p_kind: "galau", p_detail: mod.reasons.join("; "),
        });
        toast.warning("Pesan disensor: " + mod.reasons.join(", "));
      }
    }
    setSending(true);
    const { error } = await supabase.from("galau_messages").insert({
      session_id: session.id,
      sender_visitor_id: visitorId,
      text: cleaned || null,
      media_url: override?.url || null,
      media_type: override?.type || null,
      media_mime: override?.mime || null,
    });
    setSending(false);
    if (error) { toast.error("Gagal kirim: " + error.message); return; }
    setText("");
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Maksimal 5MB"); return; }
    if (!f.type.startsWith("image/")) { toast.error("Hanya gambar"); return; }
    setUploading(true);
    const path = `${session?.id || "tmp"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${f.name.split(".").pop() || "jpg"}`;
    const { error: upErr } = await supabase.storage.from("galau-media").upload(path, f, {
      cacheControl: "3600", upsert: false, contentType: f.type,
    });
    if (upErr) { setUploading(false); toast.error("Upload gagal: " + upErr.message); return; }
    const { data: pub } = supabase.storage.from("galau-media").getPublicUrl(path);
    setUploading(false);
    await sendMessage({ url: pub.publicUrl, type: "image", mime: f.type });
  };

  // ===== UI =====
  if (phase === "chat" && session) {
    return (
      <div className="flex flex-col h-[calc(100dvh-180px)] min-h-[500px] rounded-2xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-purple-500/10">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[15px] font-semibold truncate">
              <Sparkles className="w-4 h-4 text-pink-500 shrink-0" />
              {maskUsername(session.partner_nickname)}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">Mood: {session.partner_mood}</div>
          </div>
          <Button size="sm" variant="outline" onClick={endChat} className="h-9 px-3 text-xs">
            <LogOut className="w-3.5 h-3.5" /> Akhiri
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-background/50">
          {messages.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Mulai ngobrol… semuanya anonim. Bersikap baik ya 💖
            </div>
          )}
          {messages.map((m) => {
            const mine = m.sender_visitor_id === visitorId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-[14px] leading-relaxed shadow-sm ${
                  mine ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-br-md"
                       : "bg-secondary text-foreground rounded-bl-md"
                }`}>
                  {m.media_url && m.media_type === "image" && (
                    <img src={m.media_url} alt="" className="rounded-lg mb-1 max-h-60 object-contain" />
                  )}
                  {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
                  <div className={`text-[10px] mt-0.5 ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-2 flex items-center gap-2 bg-card">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
          <Button size="icon" variant="ghost" disabled={uploading} onClick={() => fileRef.current?.click()} className="h-10 w-10 shrink-0">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Curhat di sini… (anonim)"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            maxLength={800}
            className="flex-1"
          />
          <Button size="icon" disabled={sending || (!text.trim())} onClick={() => sendMessage()} className="h-10 w-10 shrink-0 bg-gradient-to-br from-pink-500 to-rose-600">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center animate-pulse">
          <Heart className="w-8 h-8 text-white" />
        </div>
        <div>
          <div className="text-base font-semibold">Mencari teman curhat…</div>
          <div className="text-xs text-muted-foreground mt-1">Mood: <b>{mood}</b> · Nama: <b>{maskUsername(nickname)}</b></div>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={findMatch}><RefreshCw className="w-3.5 h-3.5" /> Coba lagi</Button>
          <Button variant="destructive" size="sm" onClick={cancelSearch}>Batal</Button>
        </div>
      </div>
    );
  }

  // Lobby
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-2xl bg-gradient-to-br from-pink-500/15 via-rose-500/10 to-purple-500/15 border border-pink-500/20 p-4 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-2 shadow-lg">
          <HeartCrack className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-lg font-bold">Bot Galau 💔</h2>
        <p className="text-xs text-muted-foreground mt-1">Ngobrol anonim sama orang asing yang lagi sefrekuensi. Aman, gratis, tanpa identitas.</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Nama Samaran</label>
        <div className="flex gap-2">
          <Input value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 24))} maxLength={24} />
          <Button variant="outline" size="icon" onClick={() => setNickname(randomNick())}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Lagi Ngerasa Apa?</label>
        <div className="grid grid-cols-2 gap-2">
          {MOODS.map(({ key, label, icon: Icon, grad }) => {
            const active = mood === key;
            return (
              <button
                key={key}
                onClick={() => setMood(key)}
                className={`relative p-3 rounded-xl border text-left transition-all ${
                  active ? `border-transparent bg-gradient-to-br ${grad} text-white shadow-lg scale-[1.02]`
                         : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <div className="text-sm font-semibold">{label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={startSearch} size="lg" className="w-full bg-gradient-to-br from-pink-500 to-rose-600 text-white">
        <Heart className="w-4 h-4" /> Cari Teman Sefrekuensi
      </Button>

      <div className="text-[11px] text-muted-foreground text-center px-4 leading-relaxed">
        ⚠️ Dilarang share nomor HP / akun sosmed. Kata kasar & tuduhan penipuan otomatis disensor. Lebih dari 3× pelanggaran dalam 24 jam = blokir 7 hari.
      </div>
    </div>
  );
}

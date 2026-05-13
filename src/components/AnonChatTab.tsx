import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Settings as SettingsIcon, Send, X, RefreshCw, UserPlus, Heart, ChevronRight, Sparkles, Shield } from "lucide-react";
import { toast } from "sonner";

type View = "lobby" | "prefs" | "interest" | "searching" | "chat" | "friends";

const INTERESTS = ["Apapun","Curhat","Main RP","Meme","Kesepian","Game","Anime","Film","Musik","Travel","Coding","Olahraga","Nongkrong","Belajar"];

function getVisitorId() {
  try {
    let v = localStorage.getItem("agung_visitor_id");
    if (!v) { v = crypto.randomUUID(); localStorage.setItem("agung_visitor_id", v); }
    return v;
  } catch { return "anon-" + Math.random().toString(36).slice(2); }
}

function genNick() {
  const list = ["Senja","Hujan","Kopi","Bintang","Awan","Rembulan","Mawar","Angin","Lentera","Pelangi"];
  return list[Math.floor(Math.random()*list.length)] + Math.floor(Math.random()*900+100);
}

export default function AnonChatTab() {
  const visitor = useMemo(() => getVisitorId(), []);
  const [view, setView] = useState<View>("lobby");
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem("anon_nick") || genNick());
  const [myGender, setMyGender] = useState<string>(() => localStorage.getItem("anon_my_gender") || "any");
  const [prefGender, setPrefGender] = useState<string>(() => localStorage.getItem("anon_pref_gender") || "any");
  const [interest, setInterest] = useState<string>(() => localStorage.getItem("anon_interest") || "Apapun");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [partner, setPartner] = useState<{ nick: string; gender: string | null } | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; sender: string; content: string; created_at: string }>>([]);
  const [draft, setDraft] = useState("");
  const [sessionStatus, setSessionStatus] = useState<"active" | "ended">("active");
  const [searchSecs, setSearchSecs] = useState(0);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem("anon_nick", nickname); }, [nickname]);
  useEffect(() => { localStorage.setItem("anon_my_gender", myGender); }, [myGender]);
  useEffect(() => { localStorage.setItem("anon_pref_gender", prefGender); }, [prefGender]);
  useEffect(() => { localStorage.setItem("anon_interest", interest); }, [interest]);

  // Online queue count
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase.from("anon_chat_queue").select("*", { count: "exact", head: true });
      setOnlineCount(count || 0);
    };
    fetchCount();
    const ch = supabase.channel("anon_queue_count")
      .on("postgres_changes", { event: "*", schema: "public", table: "anon_chat_queue" }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Search timer + queue subscription waiting for matched session
  useEffect(() => {
    if (view !== "searching") return;
    setSearchSecs(0);
    const t = setInterval(() => setSearchSecs(s => s + 1), 1000);
    const ch = supabase.channel(`anon_wait_${visitor}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anon_chat_sessions" }, async (payload: any) => {
        const r = payload.new;
        if (r.visitor_a === visitor || r.visitor_b === visitor) {
          await enterSession(r.id, r.visitor_a === visitor ? r.nickname_b : r.nickname_a, r.visitor_a === visitor ? r.gender_b : r.gender_a);
        }
      }).subscribe();
    // Poll-retry every 6s in case stuck
    const retry = setInterval(() => { void doMatch(true); }, 6000);
    return () => { clearInterval(t); clearInterval(retry); supabase.removeChannel(ch); };
  }, [view, visitor]);

  // Session realtime: messages + status
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`anon_sess_${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anon_chat_messages", filter: `session_id=eq.${sessionId}` },
        (payload: any) => setMessages(prev => [...prev, payload.new]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anon_chat_sessions", filter: `id=eq.${sessionId}` },
        (payload: any) => { if (payload.new.status === "ended") setSessionStatus("ended"); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const enterSession = async (id: string, partnerNick: string | null, partnerGender: string | null) => {
    setSessionId(id);
    setPartner({ nick: partnerNick || "Stranger", gender: partnerGender });
    setSessionStatus("active");
    const { data } = await supabase.from("anon_chat_messages").select("id,sender_visitor_id,content,created_at").eq("session_id", id).order("created_at");
    setMessages((data || []).map((m: any) => ({ id: m.id, sender: m.sender_visitor_id, content: m.content, created_at: m.created_at })));
    setView("chat");
  };

  const doMatch = async (silent = false) => {
    const { data, error } = await supabase.rpc("anon_chat_find_or_queue", {
      p_visitor: visitor, p_nickname: nickname, p_my_gender: myGender,
      p_pref_gender: prefGender, p_interest: interest === "Apapun" ? "any" : interest,
    });
    if (error) { if (!silent) toast.error("Gagal mencari: " + error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    if (row.session_id) {
      await enterSession(row.session_id, row.partner_nickname, row.partner_gender);
    } else if (!silent) {
      setView("searching");
    }
  };

  const cancelSearch = async () => {
    await supabase.rpc("anon_chat_leave_queue", { p_visitor: visitor });
    setView("lobby");
  };

  const endChat = async () => {
    if (sessionId) await supabase.rpc("anon_chat_end_session", { p_session: sessionId, p_visitor: visitor });
    setSessionId(null); setPartner(null); setMessages([]); setView("lobby");
  };

  const newPartner = async () => { await endChat(); await doMatch(); };

  const sendMessage = async () => {
    if (!sessionId || !draft.trim() || sessionStatus === "ended") return;
    const text = draft.trim().slice(0, 1000);
    setDraft("");
    const { error } = await supabase.from("anon_chat_messages").insert({ session_id: sessionId, sender_visitor_id: visitor, content: text });
    if (error) { toast.error(error.message); setDraft(text); }
  };

  // ============ RENDER ============
  if (view === "chat") {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px] rounded-3xl overflow-hidden border-2 border-emerald-400/30 bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-950 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.4)]">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 backdrop-blur">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/40">
            {partner?.gender === "male" ? "🧑" : partner?.gender === "female" ? "👩" : "🥷"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-emerald-50 truncate">{partner?.nick}</div>
            <div className="text-xs text-emerald-300/80 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${sessionStatus === "active" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
              {sessionStatus === "active" ? "terhubung" : "chat berakhir"}
            </div>
          </div>
          <button onClick={endChat} className="w-9 h-9 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 flex items-center justify-center transition" title="Akhiri">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-center text-xs text-emerald-300/50 py-2">— Awal obrolan anonim —</div>
          {messages.map(m => {
            const mine = m.sender === visitor;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm break-words shadow ${
                  mine
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-sm"
                    : "bg-slate-800/90 text-slate-100 rounded-bl-sm border border-slate-700/50"
                }`}>
                  {m.content}
                </div>
              </div>
            );
          })}
          {sessionStatus === "ended" && (
            <div className="text-center text-xs text-rose-300/80 mt-4 py-2 bg-rose-500/10 rounded-xl">Chat sudah berakhir</div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-emerald-400/20 bg-slate-950/80 space-y-2">
          {sessionStatus === "active" ? (
            <div className="flex items-center gap-2">
              <input
                value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Ketik pesan rahasia..."
                className="flex-1 bg-slate-900/70 border border-emerald-400/30 rounded-full px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                maxLength={1000}
              />
              <button onClick={sendMessage} disabled={!draft.trim()}
                className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center disabled:opacity-40 shadow-lg shadow-emerald-500/40">
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={newPartner} className="py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-sm font-semibold flex items-center justify-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Partner Baru
            </button>
            <button onClick={endChat} className="py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/40 text-slate-200 text-sm font-semibold flex items-center justify-center gap-1.5">
              <X className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "interest") {
    return (
      <div className="rounded-3xl border-2 border-emerald-400/30 bg-slate-950 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-800">
          <button onClick={() => setView("prefs")} className="text-emerald-300 text-sm font-semibold flex items-center gap-1">
            <ChevronRight className="w-4 h-4 rotate-180" /> Kembali
          </button>
          <div className="flex-1 text-center font-bold text-slate-100">Ketertarikan</div>
          <div className="w-16" />
        </div>
        <p className="text-xs text-slate-400 p-4 pb-2">Kami akan mempertemukanmu dengan partner yang ingin membahas topik yang sama.</p>
        <div className="max-h-[50vh] overflow-y-auto">
          {INTERESTS.map(it => (
            <button key={it} onClick={() => { setInterest(it); setView("prefs"); }}
              className={`w-full text-left px-5 py-3.5 border-b border-slate-800/60 flex items-center justify-between hover:bg-slate-900 ${interest === it ? "text-emerald-300" : "text-slate-200"}`}>
              <span>{it}</span>
              {interest === it && <Heart className="w-4 h-4 fill-current" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === "prefs") {
    return (
      <div className="rounded-3xl border-2 border-emerald-400/30 bg-gradient-to-b from-slate-950 to-emerald-950/20 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setView("lobby")} className="text-emerald-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Preferensi</div>
          <div className="w-12" />
        </div>

        <div>
          <label className="text-xs text-slate-400 flex items-center gap-1 mb-2"><Users className="w-3 h-3" /> Nickname kamu</label>
          <div className="flex gap-2">
            <input value={nickname} onChange={e => setNickname(e.target.value.slice(0, 20))}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100" />
            <button onClick={() => setNickname(genNick())} className="px-3 rounded-xl bg-emerald-500/20 text-emerald-200 text-xs font-semibold border border-emerald-400/30">
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-2 block">Gender saya</label>
          <div className="grid grid-cols-3 gap-2">
            {[{v:"male",l:"Pria"},{v:"female",l:"Wanita"},{v:"any",l:"Rahasia"}].map(o => (
              <button key={o.v} onClick={() => setMyGender(o.v)}
                className={`py-2.5 rounded-xl text-sm font-semibold border ${myGender === o.v ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30" : "bg-slate-900 text-slate-300 border-slate-700"}`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-2 block">Pilih gender partner</label>
          <div className="grid grid-cols-3 gap-2">
            {[{v:"male",l:"Pria"},{v:"female",l:"Wanita"},{v:"any",l:"Apapun"}].map(o => (
              <button key={o.v} onClick={() => setPrefGender(o.v)}
                className={`py-2.5 rounded-xl text-sm font-semibold border ${prefGender === o.v ? "bg-teal-500 text-white border-teal-400 shadow-lg shadow-teal-500/30" : "bg-slate-900 text-slate-300 border-slate-700"}`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-2 block">Pilih ketertarikan</label>
          <button onClick={() => setView("interest")}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between text-slate-100">
            <span>{interest}</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        <button onClick={() => { setView("lobby"); toast.success("Preferensi tersimpan"); }}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/40">
          OKE
        </button>

        <InnerNav active="settings" onChange={(k) => {
          if (k === "search") setView("lobby");
          else if (k === "friends") setView("friends");
        }} />
      </div>
    );
  }

  if (view === "friends") {
    return (
      <div className="rounded-3xl overflow-hidden border-2 border-emerald-400/30 bg-gradient-to-b from-emerald-950/30 via-slate-950 to-slate-950 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-center gap-2 py-4 border-b border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
          <Users className="w-5 h-5 text-emerald-300" />
          <span className="text-base font-extrabold text-emerald-100">Teman</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Users className="w-10 h-10 text-emerald-300/70" />
          </div>
          <h3 className="font-bold text-slate-100">Belum ada teman</h3>
          <p className="text-xs text-slate-400 max-w-[260px]">Fitur menambahkan teman dari obrolan akan segera hadir. Saat ini chat bersifat sepenuhnya anonim & sementara.</p>
        </div>
        <InnerNav active="friends" onChange={(k) => {
          if (k === "search") setView("lobby");
          else if (k === "settings") setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "searching") {
    return (
      <div className="rounded-3xl border-2 border-emerald-400/30 bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-950 p-8 text-center min-h-[500px] flex flex-col items-center justify-center">
        <div className="relative w-32 h-32 mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-5xl shadow-2xl shadow-emerald-500/50">
            🥷
          </div>
        </div>
        <div className="text-xl font-bold text-emerald-100 mb-1">Mencari partner...</div>
        <div className="text-sm text-emerald-300/70 mb-6">{Math.floor(searchSecs/60).toString().padStart(2,"0")}:{(searchSecs%60).toString().padStart(2,"0")}</div>
        <div className="text-xs text-slate-400 mb-8">{onlineCount} orang juga sedang mencari</div>
        <button onClick={cancelSearch}
          className="px-8 py-3 rounded-2xl bg-slate-800 text-slate-200 font-semibold border border-slate-700 hover:bg-slate-700">
          Batal
        </button>
      </div>
    );
  }

  // LOBBY
  return (
    <div className="rounded-3xl overflow-hidden border-2 border-emerald-400/30 bg-gradient-to-b from-emerald-950/30 via-slate-950 to-slate-950 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.4)]">
      {/* Header brand */}
      <div className="flex items-center justify-center gap-2 py-4 border-b border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
        <span className="text-2xl">🥷</span>
        <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">samaran.chat</span>
      </div>

      {/* Hero illustration */}
      <div className="relative h-44 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 300 160" className="w-full h-full opacity-90">
          <defs>
            <linearGradient id="cloud-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#a7f3d0" />
              <stop offset="1" stopColor="#5eead4" />
            </linearGradient>
          </defs>
          <ellipse cx="40" cy="40" rx="36" ry="18" fill="url(#cloud-grad)" opacity="0.85" />
          <ellipse cx="65" cy="32" rx="26" ry="14" fill="url(#cloud-grad)" opacity="0.7" />
          <ellipse cx="240" cy="115" rx="50" ry="20" fill="url(#cloud-grad)" opacity="0.85" />
          <ellipse cx="270" cy="105" rx="28" ry="14" fill="url(#cloud-grad)" opacity="0.6" />
          <path d="M60 120 Q100 30 150 90 Q200 150 180 60" stroke="#34d399" strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.7" />
          <g transform="translate(170 60) rotate(15)">
            <polygon points="0,0 30,8 0,16 6,8" fill="#10b981" />
            <polygon points="0,0 30,8 6,8" fill="#34d399" />
          </g>
        </svg>
      </div>

      <div className="px-6 pb-6 text-center space-y-2">
        <h2 className="text-xl font-bold text-slate-100 leading-tight">Temukan seseorang untuk mengobrol</h2>
        <p className="text-sm text-emerald-300/80">Cepat, anonim, seru</p>
      </div>

      <div className="px-5 pb-5">
        <button onClick={() => doMatch()}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 text-white font-extrabold tracking-wide shadow-[0_10px_30px_-5px_rgba(16,185,129,0.6)] hover:scale-[1.01] active:scale-[0.99] transition flex items-center justify-center gap-2">
          <Search className="w-5 h-5" /> MULAI CARI
        </button>
      </div>

      <div className="px-5 pb-6 space-y-3">
        <button onClick={() => setView("prefs")}
          className="w-full flex items-center justify-center gap-2 py-2 text-emerald-300 font-semibold text-sm">
          <SettingsIcon className="w-4 h-4" /> Preferensi pencarian
        </button>
        <div className="text-center text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {prefGender === "male" ? "Pria" : prefGender === "female" ? "Wanita" : "Semua gender"}
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Heart className="w-3.5 h-3.5" /> {interest}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-emerald-400/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {onlineCount} orang online
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 pt-2 border-t border-slate-800/60 mt-2">
        <div className="flex items-start gap-2 text-xs text-slate-400">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p>Identitas asli kamu disembunyikan. Jangan bagikan info pribadi (nomor HP, alamat, atau data sensitif) ke partner.</p>
        </div>
      </div>

      {/* Inner bottom nav (anon.chat style) */}
      <InnerNav active="search" onChange={(k) => {
        if (k === "search") setView("lobby");
        else if (k === "friends") setView("friends");
        else setView("prefs");
      }} />
    </div>
  );
}

function InnerNav({ active, onChange }: { active: "search" | "friends" | "settings"; onChange: (k: "search" | "friends" | "settings") => void }) {
  const items: Array<{ k: "search" | "friends" | "settings"; Icon: any; label: string }> = [
    { k: "search", Icon: Search, label: "Cari" },
    { k: "friends", Icon: Users, label: "Teman" },
    { k: "settings", Icon: SettingsIcon, label: "Pengaturan" },
  ];
  return (
    <div className="flex items-center justify-around border-t border-emerald-400/15 bg-slate-950/80 backdrop-blur py-2.5">
      {items.map(({ k, Icon, label }) => {
        const on = active === k;
        return (
          <button key={k} onClick={() => onChange(k)}
            className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-xl transition ${on ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"}`}>
            <Icon className={`w-5 h-5 ${on ? "drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]" : ""}`} strokeWidth={on ? 2.4 : 1.8} />
            <span className="text-[9.5px] font-semibold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Settings as SettingsIcon, Send, X, RefreshCw, UserPlus, Heart, ChevronRight, Sparkles, Shield, ImagePlus, Smile, Reply, Trash2, Check, CheckCheck, MessageCircle, UserCheck, UserX, HelpCircle, Bell, Phone, Volume2, VolumeX, Eye, AlertTriangle, LogOut, Copy, Flag, Plus, FileText, Moon, MessageSquare, Globe, Lock, ThumbsUp, Info, Link2 } from "lucide-react";
import { toast } from "sonner";
import { moderateOutgoing } from "@/lib/chat-moderation";
import { formatBanRemaining, type BanInfo } from "@/hooks/useAccountBan";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AnonAccountDialog, fetchAnonAccount, type AnonAccount } from "@/components/AnonAccountDialog";
import { useTheme } from "@/lib/theme";
import { useLang } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/languages";
import { Key, Keyboard, EyeOff, PhoneCall } from "lucide-react";

const CS_WA = "085769302532";
const CS_WA_LINK = `https://wa.me/62${CS_WA.replace(/^0/, "")}`;
function shortId(id: string) {
  const clean = id.replace(/-/g, "").toUpperCase();
  return "#" + clean.slice(0, 8);
}
const AVATAR_PRESETS = [
  { id: "ninja", label: "Ninja", gradient: "from-indigo-500 to-purple-600", skin: "#fde68a", accent: "#4f46e5" },
  { id: "leaf", label: "Daun", gradient: "from-emerald-400 to-teal-500", skin: "#bbf7d0", accent: "#059669" },
  { id: "cat", label: "Kucing", gradient: "from-amber-400 to-orange-500", skin: "#fed7aa", accent: "#f97316" },
  { id: "star", label: "Bintang", gradient: "from-cyan-400 to-blue-600", skin: "#cffafe", accent: "#0284c7" },
  { id: "rose", label: "Mawar", gradient: "from-pink-500 to-rose-600", skin: "#fbcfe8", accent: "#e11d48" },
];
function presetById(id?: string | null) {
  return AVATAR_PRESETS.find((a) => a.id === id) || AVATAR_PRESETS[0];
}
function AvatarGraphic({ preset, className = "w-full h-full" }: { preset: ReturnType<typeof presetById>; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={preset.label}>
      <rect width="64" height="64" rx="18" fill={preset.accent} opacity="0.22" />
      {preset.id === "cat" && (
        <>
          <path d="M17 24 22 12l8 8h4l8-8 5 12" fill={preset.skin} stroke="white" strokeOpacity="0.45" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="32" cy="34" r="18" fill={preset.skin} />
          <circle cx="25" cy="32" r="2.4" fill="#0f172a" /><circle cx="39" cy="32" r="2.4" fill="#0f172a" />
          <path d="M32 36v3m-7 2c4 4 10 4 14 0" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M13 36h12M13 42h12M39 36h12M39 42h12" stroke="white" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {preset.id !== "cat" && (
        <>
          <circle cx="32" cy="26" r="13" fill={preset.skin} />
          <path d="M14 58c2.8-13 11-20 18-20s15.2 7 18 20" fill={preset.skin} />
          <path d="M19 23c5-11 19-13 28 0-6-1-10-4-15-8-3 5-7 7-13 8Z" fill={preset.accent} opacity="0.9" />
          {preset.id === "ninja" && <path d="M18 26h28v8H18z" fill="#0f172a" opacity="0.9" />}
          {preset.id === "leaf" && <path d="M42 12c-10 0-17 5-18 15 9 0 17-5 18-15Z" fill="#34d399" />}
          {preset.id === "star" && <path d="m46 12 2.4 5 5.6.8-4 3.8.9 5.4-4.9-2.6-4.9 2.6.9-5.4-4-3.8 5.6-.8L46 12Z" fill="#fef08a" />}
          {preset.id === "rose" && <path d="M46 18c0 5-5 8-14 13-9-5-14-8-14-13 0-7 8-10 14-3 6-7 14-4 14 3Z" fill="#fb7185" />}
          <circle cx="27" cy="28" r="2" fill="#0f172a" /><circle cx="37" cy="28" r="2" fill="#0f172a" />
          <path d="M27 34c3 2.5 7 2.5 10 0" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  );
}
function playPing() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch {}
}

interface AnonMsg {
  id: string;
  sender: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  is_read: boolean;
  reply_to_id: string | null;
  is_deleted: boolean;
  deleted_for?: string[] | null;
  local_blocked?: boolean;
}
interface AnonReaction { id: string; message_id: string; visitor_id: string; emoji: string; }
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];
interface AnonProfile { visitor_id: string; nickname: string | null; avatar_url: string | null; avatar_preset: string | null; show_last_seen: boolean; last_seen_at: string; }
type PublicBioResponse = { success?: boolean; bio?: string | null; error?: string };
type UpdateBioResponse = { success?: boolean; account?: AnonAccount | null; error?: string };

type View = "lobby" | "prefs" | "account" | "interest" | "searching" | "chat" | "friends" | "support" | "notif" | "appearance" | "chatopts" | "language" | "privacy";

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
  const [messages, setMessages] = useState<AnonMsg[]>([]);
  const [reactions, setReactions] = useState<AnonReaction[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<AnonMsg | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sessionStatus, setSessionStatus] = useState<"active" | "ended">("active");
  const [searchSecs, setSearchSecs] = useState(0);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [friends, setFriends] = useState<{ friend_visitor: string; friend_nickname: string }[]>([]);
  const [friendReqs, setFriendReqs] = useState<{ id: string; from_visitor: string; from_nickname: string }[]>([]);
  const [friendStatusForPartner, setFriendStatusForPartner] = useState<"none" | "pending_out" | "pending_in" | "friend">("none");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(() => localStorage.getItem("anon_sound") !== "off");
  const [notifOn, setNotifOn] = useState<boolean>(() => localStorage.getItem("anon_notif") !== "off");
  const [revealedImgs, setRevealedImgs] = useState<Set<string>>(new Set());
  const lastIncomingId = useRef<string | null>(null);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [myProfile, setMyProfile] = useState<AnonProfile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<AnonProfile | null>(null);
  const [partnerBio, setPartnerBio] = useState<string | null>(null);
  const [showPartnerBio, setShowPartnerBio] = useState(false);
  const [avatarPreset, setAvatarPreset] = useState<string>(() => localStorage.getItem("anon_avatar_preset") || "ninja");
  const [avatarUrl, setAvatarUrl] = useState<string>(() => localStorage.getItem("anon_avatar_url") || "");
  const [showLastSeen, setShowLastSeen] = useState<boolean>(() => localStorage.getItem("anon_show_last_seen") !== "off");
  const [confirmClose, setConfirmClose] = useState<boolean>(() => localStorage.getItem("anon_confirm_close") === "on");
  const [keyboardMode, setKeyboardMode] = useState<"button" | "keyboard">(() => (localStorage.getItem("anon_keyboard_mode") as "button" | "keyboard") || "button");
  const [mediaBlur, setMediaBlur] = useState<"off" | "temp" | "all">(() => (localStorage.getItem("anon_media_blur") as "off" | "temp" | "all") || "temp");
  const [onlineStatus, setOnlineStatus] = useState<boolean>(() => localStorage.getItem("anon_online_status") !== "off");
  const [whoCanCall, setWhoCanCall] = useState<"all" | "friends" | "none">(() => (localStorage.getItem("anon_who_can_call") as "all" | "friends" | "none") || "all");
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [anonAccount, setAnonAccount] = useState<AnonAccount | null>(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savedBio, setSavedBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);

  useEffect(() => { fetchAnonAccount(visitor).then(setAnonAccount); }, [visitor]);
  useEffect(() => {
    if (anonAccount?.bio !== undefined && anonAccount?.bio !== null) {
      const b = anonAccount.bio || "";
      setBioDraft(b);
      setSavedBio(b);
      return;
    }
    // Guest: ambil bio dari profil visitor
    (async () => {
      const { data } = await supabase.from("anon_chat_profiles" as any).select("bio").eq("visitor_id", visitor).maybeSingle();
      const b = (data as { bio?: string | null } | null)?.bio || "";
      setBioDraft(b);
      setSavedBio(b);
    })();
  }, [anonAccount?.bio, visitor]);

  useEffect(() => { localStorage.setItem("anon_sound", soundOn ? "on" : "off"); }, [soundOn]);
  useEffect(() => { localStorage.setItem("anon_notif", notifOn ? "on" : "off"); }, [notifOn]);
  useEffect(() => { localStorage.setItem("anon_avatar_preset", avatarPreset); }, [avatarPreset]);
  useEffect(() => { localStorage.setItem("anon_avatar_url", avatarUrl); }, [avatarUrl]);
  useEffect(() => { localStorage.setItem("anon_show_last_seen", showLastSeen ? "on" : "off"); }, [showLastSeen]);
  useEffect(() => { localStorage.setItem("anon_confirm_close", confirmClose ? "on" : "off"); }, [confirmClose]);
  useEffect(() => { localStorage.setItem("anon_keyboard_mode", keyboardMode); }, [keyboardMode]);
  useEffect(() => { localStorage.setItem("anon_media_blur", mediaBlur); }, [mediaBlur]);
  useEffect(() => { localStorage.setItem("anon_online_status", onlineStatus ? "on" : "off"); }, [onlineStatus]);
  useEffect(() => { localStorage.setItem("anon_who_can_call", whoCanCall); }, [whoCanCall]);

  const activeBan = !!banInfo && (banInfo.is_permanent || !banInfo.banned_until || new Date(banInfo.banned_until).getTime() > Date.now());
  const myAvatar = presetById(myProfile?.avatar_preset || avatarPreset);
  const partnerAvatar = presetById(partnerProfile?.avatar_preset || (partner?.gender === "female" ? "rose" : partner?.gender === "male" ? "star" : "ninja"));
  const partnerLastSeen = partnerProfile?.show_last_seen
    ? `terakhir dilihat ${new Date(partnerProfile.last_seen_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
    : "terakhir dilihat disembunyikan";

  const refreshBan = useCallback(async () => {
    const { data } = await supabase.rpc("get_account_ban_info", { p_visitor_id: visitor } as any);
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as BanInfo) : null;
    setBanInfo(row);
  }, [visitor]);

  const touchProfile = useCallback(async () => {
    const { data } = await supabase.rpc("touch_anon_chat_profile" as any, {
      p_visitor_id: visitor,
      p_nickname: nickname,
      p_avatar_url: avatarUrl || null,
      p_avatar_preset: avatarPreset,
      p_show_last_seen: showLastSeen,
    });
    if (data) setMyProfile(data as unknown as AnonProfile);
  }, [visitor, nickname, avatarUrl, avatarPreset, showLastSeen]);

  const loadPartnerProfile = useCallback(async (session: string) => {
    const { data: sess } = await supabase.from("anon_chat_sessions").select("visitor_a, visitor_b").eq("id", session).maybeSingle();
    if (!sess) return;
    const other = sess.visitor_a === visitor ? sess.visitor_b : sess.visitor_a;
    const { data } = await supabase.from("anon_chat_profiles" as any).select("*").eq("visitor_id", other).maybeSingle();
    setPartnerProfile((data as unknown as AnonProfile) || null);
    const { data: bioData } = await supabase.functions.invoke("anon-chat-auth", {
      body: { action: "public_bio", visitorId: visitor, targetVisitorId: other },
    });
    const bioResponse = bioData as PublicBioResponse | null;
    setPartnerBio(bioResponse?.bio || null);
    setShowPartnerBio(false);
  }, [visitor]);

  useEffect(() => {
    refreshBan();

    const refreshOnReturn = () => refreshBan();
    const channel = supabase
      .channel(`anon_chat_ban_status_${visitor}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_bans" }, refreshBan)
      .subscribe();

    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("balance-auth-changed", refreshOnReturn as EventListener);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("balance-auth-changed", refreshOnReturn as EventListener);
      supabase.removeChannel(channel);
    };
  }, [refreshBan, visitor]);
  useEffect(() => {
    touchProfile();
    const interval = window.setInterval(touchProfile, 30000);
    const onFocus = () => touchProfile();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [touchProfile]);


  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender === visitor || last.local_blocked) { lastIncomingId.current = last.id; return; }
    if (lastIncomingId.current === last.id) return;
    lastIncomingId.current = last.id;
    if (soundOn) playPing();
    if (notifOn && document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      try { new Notification("💬 Pesan baru dari " + (partner?.nick || "Stranger"), { body: last.content || (last.image_url ? "📷 Foto" : ""), silent: !soundOn }); } catch {}
    }
  }, [messages, visitor, soundOn, notifOn, partner?.nick]);

  const requestNotifPerm = async () => {
    if (!("Notification" in window)) { toast.error("Browser tidak mendukung notifikasi", { description: "Coba pakai Chrome/Edge terbaru atau aplikasi browser lain." }); return; }
    if (!window.isSecureContext) { toast.error("Notifikasi butuh koneksi aman", { description: "Buka dari alamat HTTPS / aplikasi yang terpasang." }); return; }
    if (Notification.permission === "denied") { toast.error("Izin notifikasi diblokir browser", { description: "Aktifkan lagi dari setelan situs/browser, lalu kembali ke halaman ini." }); return; }
    const p = await Notification.requestPermission();
    if (p === "granted") { setNotifOn(true); toast.success("Notifikasi diaktifkan"); }
    else toast.error("Izin notifikasi belum aktif", { description: "Jika tombol browser tidak muncul, cek setelan izin situs di address bar." });
  };

  const saveBio = async () => {
    setSavingBio(true);
    try {
      const bio = bioDraft.trim().slice(0, 200);
      const { data, error } = await supabase.functions.invoke("anon-chat-auth", {
        body: { action: "update_bio", visitorId: visitor, bio },
      });
      if (error) throw new Error(error.message);
      const response = data as UpdateBioResponse | null;
      if (response?.error) throw new Error(response.error);
      if (response?.account) setAnonAccount(response.account);
      setBioDraft(bio);
      setSavedBio(bio);
      setEditingBio(false);
      toast.success("Deskripsi Anon Chat tersimpan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan deskripsi");
    } finally {
      setSavingBio(false);
    }
  };

  const logoutToGuest = () => {
    if (!confirm("Putuskan akun & jadi Tamu lagi?\n\nSemua riwayat chat anonim, teman & permintaan akan hilang dari perangkat ini.")) return;
    try {
      localStorage.removeItem("agung_visitor_id");
      localStorage.removeItem("anon_nick");
      localStorage.removeItem("anon_my_gender");
      localStorage.removeItem("anon_pref_gender");
      localStorage.removeItem("anon_interest");
    } catch {}
    toast.success("Sesi diputus. Memuat ulang sebagai Tamu…");
    setTimeout(() => window.location.reload(), 600);
  };

  useEffect(() => { localStorage.setItem("anon_nick", nickname); }, [nickname]);
  useEffect(() => { localStorage.setItem("anon_my_gender", myGender); }, [myGender]);
  useEffect(() => { localStorage.setItem("anon_pref_gender", prefGender); }, [prefGender]);
  useEffect(() => { localStorage.setItem("anon_interest", interest); }, [interest]);

  const explainNotif = () => {
    if (!("Notification" in window)) return "Browser tidak mendukung notifikasi.";
    if (!window.isSecureContext) return "Notifikasi hanya aktif di HTTPS / aplikasi terpasang.";
    if (Notification.permission === "denied") return "Izin sudah diblokir di browser. Buka setelan situs lalu ubah Notifications menjadi Allow.";
    if (Notification.permission === "default") return "Izin belum diminta atau belum dipilih. Tekan toggle notifikasi.";
    return "Izin browser aktif. Notifikasi muncul saat tab tidak aktif dan toggle aplikasi menyala.";
  };

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

  // Session realtime: messages + reactions + typing + status
  useEffect(() => {
    if (!sessionId) return;
    const markRead = (mid: string) => { void supabase.from("anon_chat_messages").update({ is_read: true } as any).eq("id", mid); };
    const ch = supabase.channel(`anon_sess_${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anon_chat_messages", filter: `session_id=eq.${sessionId}` },
        (p: any) => {
          const nm = mapMsg(p.new);
          setMessages(prev => prev.some(m => m.id === nm.id) ? prev : [...prev, nm]);
          if (nm.sender !== visitor) markRead(nm.id);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anon_chat_messages", filter: `session_id=eq.${sessionId}` },
        (p: any) => { const nm = mapMsg(p.new); setMessages(prev => prev.map(m => m.id === nm.id ? nm : m)); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anon_chat_reactions" },
        (p: any) => { const r = p.new as AnonReaction; setReactions(prev => prev.some(x => x.id === r.id) ? prev : [...prev, r]); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "anon_chat_reactions" },
        (p: any) => { const r = p.old as any; setReactions(prev => prev.filter(x => x.id !== r.id)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "anon_chat_typing" },
        (p: any) => {
          const row = p.new || p.old;
          if (!row || row.session_id !== sessionId || row.sender_visitor_id === visitor) return;
          const typing = !!p.new?.is_typing && p.eventType !== "DELETE";
          const ts = p.new?.updated_at ? new Date(p.new.updated_at).getTime() : 0;
          setOtherTyping(typing && Date.now() - ts < 6000);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anon_chat_sessions", filter: `id=eq.${sessionId}` },
        (payload: any) => { if (payload.new.status === "ended") setSessionStatus("ended"); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, visitor]);

  useEffect(() => {
    if (!otherTyping) return;
    const t = window.setTimeout(() => setOtherTyping(false), 4500);
    return () => window.clearTimeout(t);
  }, [otherTyping]);

  // Friends + incoming requests + realtime
  const loadFriends = useCallback(async () => {
    const { data } = await supabase.from("anon_chat_friends").select("friend_visitor, friend_nickname").eq("visitor_id", visitor).order("created_at", { ascending: false });
    setFriends((data || []) as any);
    const { data: reqs } = await supabase.from("anon_chat_friend_requests").select("id, from_visitor, from_nickname").eq("to_visitor", visitor).eq("status", "pending").order("created_at", { ascending: false });
    setFriendReqs((reqs || []) as any);
  }, [visitor]);

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => {
    const ch = supabase.channel(`anon_friends_${visitor}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "anon_chat_friends", filter: `visitor_id=eq.${visitor}` }, loadFriends)
      .on("postgres_changes", { event: "*", schema: "public", table: "anon_chat_friend_requests", filter: `to_visitor=eq.${visitor}` }, (p: any) => {
        loadFriends();
        if (p.eventType === "INSERT" && p.new?.status === "pending") {
          toast.success(`💌 ${p.new.from_nickname} ingin berteman`);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "anon_chat_friend_requests", filter: `from_visitor=eq.${visitor}` }, (p: any) => {
        if (p.eventType === "UPDATE" && p.new?.status === "accepted") {
          toast.success(`✅ Permintaan teman diterima!`);
          loadFriends();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visitor, loadFriends]);

  // Detect friend status with current partner
  useEffect(() => {
    if (!sessionId || !partner) { setFriendStatusForPartner("none"); return; }
    (async () => {
      const { data: sess } = await supabase.from("anon_chat_sessions").select("visitor_a, visitor_b").eq("id", sessionId).maybeSingle();
      if (!sess) return;
      const other = sess.visitor_a === visitor ? sess.visitor_b : sess.visitor_a;
      const { data: f } = await supabase.from("anon_chat_friends").select("id").eq("visitor_id", visitor).eq("friend_visitor", other).maybeSingle();
      if (f) { setFriendStatusForPartner("friend"); return; }
      const { data: out } = await supabase.from("anon_chat_friend_requests").select("id").eq("from_visitor", visitor).eq("to_visitor", other).eq("status", "pending").maybeSingle();
      if (out) { setFriendStatusForPartner("pending_out"); return; }
      const { data: inc } = await supabase.from("anon_chat_friend_requests").select("id").eq("from_visitor", other).eq("to_visitor", visitor).eq("status", "pending").maybeSingle();
      setFriendStatusForPartner(inc ? "pending_in" : "none");
    })();
  }, [sessionId, partner, visitor, friends, friendReqs]);

  const sendFriendRequest = async () => {
    if (!sessionId) return;
    const { data: sess } = await supabase.from("anon_chat_sessions").select("visitor_a, visitor_b, nickname_a, nickname_b").eq("id", sessionId).maybeSingle();
    if (!sess) return;
    const other = sess.visitor_a === visitor ? sess.visitor_b : sess.visitor_a;
    const otherNick = sess.visitor_a === visitor ? sess.nickname_b : sess.nickname_a;
    const { data, error } = await supabase.rpc("anon_chat_send_friend_request", {
      p_from_visitor: visitor, p_from_nickname: nickname,
      p_to_visitor: other, p_to_nickname: otherNick, p_session_id: sessionId,
    });
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.already_friend) { toast.info("Kalian sudah berteman"); setFriendStatusForPartner("friend"); }
    else if (row?.already_pending) { toast.info("Permintaan sudah terkirim"); setFriendStatusForPartner("pending_out"); }
    else { toast.success("💌 Permintaan teman terkirim"); setFriendStatusForPartner("pending_out"); }
    loadFriends();
  };

  const respondFriendRequest = async (id: string, accept: boolean) => {
    const { error } = await supabase.rpc("anon_chat_respond_friend_request", {
      p_request_id: id, p_visitor: visitor, p_my_nickname: nickname, p_accept: accept,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(accept ? "✅ Teman ditambahkan" : "Permintaan ditolak");
    loadFriends();
  };

  const startFriendChat = async (friendVisitor: string) => {
    const { data, error } = await supabase.rpc("anon_chat_start_friend_session", {
      p_visitor: visitor, p_my_nickname: nickname, p_my_gender: myGender, p_friend_visitor: friendVisitor,
    });
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.session_id) await enterSession(row.session_id, row.partner_nickname, row.partner_gender);
  };

  const removeFriend = async (friendVisitor: string) => {
    if (!confirm("Hapus teman ini?")) return;
    await supabase.from("anon_chat_friends").delete().eq("visitor_id", visitor).eq("friend_visitor", friendVisitor);
    await supabase.from("anon_chat_friends").delete().eq("visitor_id", friendVisitor).eq("friend_visitor", visitor);
    toast.success("Teman dihapus");
    loadFriends();
  };

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, otherTyping]);

  const mapMsg = (m: any): AnonMsg => ({
    id: m.id, sender: m.sender_visitor_id, content: m.content, image_url: m.image_url ?? null,
    created_at: m.created_at, is_read: !!m.is_read, reply_to_id: m.reply_to_id ?? null, is_deleted: !!m.is_deleted,
    deleted_for: m.deleted_for ?? [],
  });

  const enterSession = async (id: string, partnerNick: string | null, partnerGender: string | null) => {
    setSessionId(id);
    setPartner({ nick: partnerNick || "Stranger", gender: partnerGender });
    await loadPartnerProfile(id);
    setSessionStatus("active");
    const { data } = await supabase.from("anon_chat_messages").select("*").eq("session_id", id).order("created_at");
    const list = (data || []).map(mapMsg);
    setMessages(list);
    const unread = list.filter(m => m.sender !== visitor && !m.is_read).map(m => m.id);
    if (unread.length) await supabase.from("anon_chat_messages").update({ is_read: true } as any).in("id", unread);
    if (list.length) {
      const { data: rx } = await supabase.from("anon_chat_reactions").select("*").in("message_id", list.map(m => m.id));
      setReactions((rx || []) as AnonReaction[]);
    } else setReactions([]);
    setView("chat");
  };

  const doMatch = async (silent = false) => {
    if (activeBan) { toast.error("Akun diblokir dari chat", { description: formatBanRemaining(banInfo) }); return; }
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
    setSessionId(null); setPartner(null); setMessages([]); setReactions([]); setReplyTo(null); setView("lobby");
  };

  const newPartner = async () => { await endChat(); await doMatch(); };

  const pushTyping = useCallback(async (typing: boolean) => {
    if (!sessionId) return;
    try {
      await supabase.from("anon_chat_typing").upsert({
        session_id: sessionId, sender_visitor_id: visitor, is_typing: typing, updated_at: new Date().toISOString(),
      } as any, { onConflict: "session_id,sender_visitor_id" } as any);
    } catch {}
  }, [sessionId, visitor]);

  const onChangeDraft = (v: string) => {
    setDraft(v);
    pushTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => pushTyping(false), 2500);
  };

  const sendMessage = async () => {
    if (!sessionId || !draft.trim() || sessionStatus === "ended" || activeBan) return;
    const text = draft.trim().slice(0, 1000);
    setDraft("");
    pushTyping(false);

    const moderation = moderateOutgoing(text);
    if (moderation.hadContact && !anonAccount) {
      // Tanpa akun Anon Chat, berbagi kontak diblokir total dan dicatat
      try {
        await supabase.rpc("report_chat_violation", {
          p_visitor_id: visitor,
          p_kind: "contact_share_no_account",
          p_detail: text.slice(0, 200),
        } as any);
        await refreshBan();
      } catch {}
      setShowAccountDialog(true);
      toast.error("Diblokir: berbagi kontak butuh akun Anon Chat", {
        description: "Daftar/Login akun Anon Chat dulu agar pesan tidak diblokir total. Pelanggaran tetap dicatat.",
      });
      return;
    }
    if (!moderation.ok) {
      let violationCount = 0;
      try {
        const { data } = await supabase.rpc("report_chat_violation", {
          p_visitor_id: visitor,
          p_kind: moderation.hadContact ? "contact_share" : "banned_word",
          p_detail: text.slice(0, 200),
        } as any);
        violationCount = Number(data || 0);
        await refreshBan();
      } catch {}
      setReplyTo(null);
      toast.message("Pesan tidak diteruskan", {
        description: `${moderation.reasons.join(". ")} · Peringatan ${violationCount}/3. Untuk laporan resmi, hubungi WA ${CS_WA}.`,
        action: { label: "WA CS", onClick: () => window.open(CS_WA_LINK, "_blank") },
      });
      return;
    }

    const payload: any = { session_id: sessionId, sender_visitor_id: visitor, content: text };
    if (replyTo) payload.reply_to_id = replyTo.id;
    setReplyTo(null);
    const { error } = await supabase.from("anon_chat_messages").insert(payload);
    if (error) { toast.error(error.message); setDraft(text); }
  };

  const sendImage = async (file: File) => {
    if (!sessionId || !file || sessionStatus === "ended" || activeBan) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Gambar maksimal 5MB"); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `anon/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file);
    if (upErr) { toast.error("Gagal upload gambar"); return; }
    const { data: u } = supabase.storage.from("chat-images").getPublicUrl(path);
    const payload: any = { session_id: sessionId, sender_visitor_id: visitor, image_url: u.publicUrl };
    if (replyTo) payload.reply_to_id = replyTo.id;
    setReplyTo(null);
    await supabase.from("anon_chat_messages").insert(payload);
  };

  const deleteForEveryone = async (m: AnonMsg) => {
    if (m.sender !== visitor) return;
    await supabase.from("anon_chat_messages").update({
      is_deleted: true, content: null, image_url: null, deleted_at: new Date().toISOString(),
    } as any).eq("id", m.id);
  };

  const deleteForMe = async (m: AnonMsg) => {
    const next = Array.from(new Set([...(m.deleted_for || []), visitor]));
    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, deleted_for: next } : x));
    await supabase.from("anon_chat_messages").update({ deleted_for: next } as any).eq("id", m.id);
  };

  const uploadAvatar = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Foto profil maksimal 2MB"); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `anon-avatars/${visitor}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) { toast.error("Gagal upload foto profil"); return; }
    const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    await touchProfile();
    toast.success("Foto profil tersimpan");
  };

  const toggleReaction = async (m: AnonMsg, emoji: string) => {
    setEmojiFor(null);
    const existing = reactions.find(r => r.message_id === m.id && r.visitor_id === visitor && r.emoji === emoji);
    if (existing) await supabase.from("anon_chat_reactions").delete().eq("id", existing.id);
    else await supabase.from("anon_chat_reactions").insert({ message_id: m.id, visitor_id: visitor, emoji } as any);
  };

  const reactionsByMsg = useMemo(() => {
    const map: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const r of reactions) {
      if (!map[r.message_id]) map[r.message_id] = {};
      const slot = map[r.message_id][r.emoji] || { count: 0, mine: false };
      slot.count += 1;
      if (r.visitor_id === visitor) slot.mine = true;
      map[r.message_id][r.emoji] = slot;
    }
    return map;
  }, [reactions, visitor]);

  const messagesById = useMemo(() => {
    const m: Record<string, AnonMsg> = {};
    for (const x of messages) m[x.id] = x;
    return m;
  }, [messages]);

  const dateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Hari ini";
    if (d.toDateString() === yest.toDateString()) return "Kemarin";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  // ============ RENDER ============
  if (view === "chat") {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px] rounded-3xl overflow-hidden border-2 border-emerald-400/30 bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-950 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.4)]">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 backdrop-blur">
          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${partnerAvatar.gradient} flex items-center justify-center text-xl shadow-lg shadow-emerald-500/40 overflow-hidden`}>
            {partnerProfile?.avatar_url ? <img src={partnerProfile.avatar_url} alt="Avatar partner" className="h-full w-full object-cover" /> : <AvatarGraphic preset={partnerAvatar} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-emerald-50 truncate flex items-center gap-1.5">
              {partner?.nick}
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300">{partner?.gender === "male" ? "♂ Pria" : partner?.gender === "female" ? "♀ Wanita" : "Anonim"}</span>
            </div>
            <div className="text-xs text-emerald-300/80 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${sessionStatus === "active" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
              {sessionStatus === "active" ? "terhubung" : "chat berakhir"}
              <span className="text-slate-500">•</span>
              <span className="text-slate-400/80 italic">{partnerLastSeen}</span>
            </div>
          </div>
          {sessionStatus === "active" && (
            friendStatusForPartner === "friend" ? (
              <span className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold flex items-center gap-1" title="Sudah berteman">
                <UserCheck className="w-3 h-3" /> Teman
              </span>
            ) : friendStatusForPartner === "pending_out" ? (
              <span className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-semibold">
                Menunggu...
              </span>
            ) : friendStatusForPartner === "pending_in" ? (
              <button onClick={async () => {
                const { data: sess } = await supabase.from("anon_chat_sessions").select("visitor_a, visitor_b").eq("id", sessionId!).maybeSingle();
                if (!sess) return;
                const other = sess.visitor_a === visitor ? sess.visitor_b : sess.visitor_a;
                const { data: req } = await supabase.from("anon_chat_friend_requests").select("id").eq("from_visitor", other).eq("to_visitor", visitor).eq("status", "pending").maybeSingle();
                if (req) await respondFriendRequest(req.id, true);
              }} className="px-2 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Terima
              </button>
            ) : (
              <button onClick={sendFriendRequest} className="px-2 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold flex items-center gap-1" title="Tambah teman">
                <UserPlus className="w-3 h-3" /> Add
              </button>
            )
          )}
          <button onClick={endChat} className="w-9 h-9 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 flex items-center justify-center transition" title="Akhiri">
            <X className="w-4 h-4" />
          </button>
        </div>
        {partnerBio && partnerBio.trim() && (
          <button
            type="button"
            onClick={() => setShowPartnerBio(v => !v)}
            className="w-full text-left px-3 py-1.5 border-b border-emerald-400/10 bg-slate-950/40 hover:bg-slate-900/60 transition flex items-start gap-2"
            title={showPartnerBio ? "Sembunyikan deskripsi" : "Lihat deskripsi partner"}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70 mt-0.5 shrink-0">Bio</span>
            <span className={`text-xs text-slate-200 italic flex-1 ${showPartnerBio ? "" : "line-clamp-1"}`}>
              "{partnerBio}"
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-emerald-300/60 shrink-0 mt-0.5 transition-transform ${showPartnerBio ? "rotate-90" : ""}`} />
          </button>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="text-center text-xs text-emerald-300/50 py-2">— Awal obrolan anonim —</div>
          {messages.map((m, idx) => {
            if ((m.deleted_for || []).includes(visitor)) return null;
            const mine = m.sender === visitor;
            const replied = m.reply_to_id ? messagesById[m.reply_to_id] : null;
            const rx = reactionsByMsg[m.id];
            const prev = messages[idx - 1];
            const showDate = !prev || dateLabel(prev.created_at) !== dateLabel(m.created_at);
            const grouped = prev && prev.sender === m.sender && !showDate &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
            return (
              <div key={m.id}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-emerald-400/20 bg-slate-900/60 text-emerald-200/80">
                      {dateLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-1.5"} animate-fade-in`}>
                  <div className="relative group max-w-[78%]">
                    <div
                      onDoubleClick={() => !m.is_deleted && setEmojiFor(emojiFor === m.id ? null : m.id)}
                      className={`relative px-3 py-2 text-sm break-words shadow-md ${
                        mine
                          ? `bg-gradient-to-br from-emerald-500 to-teal-600 text-white ${grouped ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"}`
                          : `bg-slate-800/90 text-slate-100 border border-slate-700/50 ${grouped ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-sm"}`
                      } ${m.is_deleted ? "italic opacity-70" : ""}`}
                    >
                      {replied && !m.is_deleted && (
                        <div className={`mb-1 border-l-2 pl-2 py-1 rounded text-[11px] ${mine ? "border-white/50 bg-white/10" : "border-emerald-400/60 bg-slate-900/60"}`}>
                          <p className="font-semibold opacity-80">{replied.sender === visitor ? "Kamu" : partner?.nick || "Partner"}</p>
                          <p className="truncate opacity-80">{replied.is_deleted ? "Pesan dihapus" : (replied.content || (replied.image_url ? "📷 Foto" : ""))}</p>
                        </div>
                      )}
                      {m.is_deleted ? (
                        <p className="flex items-center gap-1"><Trash2 className="w-3 h-3" /> Pesan ini dihapus</p>
                      ) : (
                        <>
                          {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                          {m.image_url && (() => {
                            const revealed = mine || revealedImgs.has(m.id);
                            return (
                              <div className="relative mt-1 rounded-lg overflow-hidden">
                                <img src={m.image_url} alt="" className={`max-w-full rounded-lg transition ${revealed ? "" : "blur-2xl scale-105"}`} />
                                {!revealed && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                                    <div className="text-[10px] text-white/90 px-2 py-1 rounded-full bg-amber-500/80 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Foto disensor</div>
                                    <button onClick={() => setRevealedImgs(prev => { const n = new Set(prev); n.add(m.id); return n; })} className="px-3 py-1.5 rounded-full bg-white/95 text-slate-900 text-xs font-bold flex items-center gap-1">
                                      <Eye className="w-3.5 h-3.5" /> Tampilkan
                                    </button>
                                  </div>
                                )}
                                {!mine && (
                                  <button
                                    onClick={() => { toast.message("Foto dilaporkan", { description: `Hubungi WA ${CS_WA} untuk laporan resmi & barang bukti.`, action: { label: "WA CS", onClick: () => window.open(CS_WA_LINK, "_blank") } }); }}
                                    className="absolute top-1 right-1 px-2 py-0.5 rounded-full bg-rose-500/90 text-white text-[9px] font-bold flex items-center gap-0.5 shadow"
                                    title="Laporkan foto"
                                  >
                                    <Flag className="w-2.5 h-2.5" /> Lapor
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}
                      <div className={`text-[9px] mt-1 flex items-center gap-0.5 ${mine ? "text-white/70 justify-end" : "text-slate-400"}`}>
                        {m.local_blocked && (
                          <span className="mr-1 px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-100 text-[8.5px] font-bold flex items-center gap-0.5" title={`Tidak diteruskan ke partner. Lapor: WA ${CS_WA}`}>
                            <AlertTriangle className="w-2.5 h-2.5" /> hanya kamu
                          </span>
                        )}
                        {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        {mine && !m.is_deleted && !m.local_blocked && (
                          <span className="ml-0.5">
                            {m.is_read ? <CheckCheck className="w-3 h-3 text-cyan-200" /> : <Check className="w-3 h-3" />}
                          </span>
                        )}
                      </div>
                    </div>

                    {rx && Object.keys(rx).length > 0 && !m.is_deleted && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                        {Object.entries(rx).map(([emo, { count, mine: isMine }]) => (
                          <button key={emo} onClick={() => toggleReaction(m, emo)}
                            className={`text-[11px] px-1.5 py-0.5 rounded-full border bg-slate-900/80 flex items-center gap-0.5 ${isMine ? "border-emerald-400" : "border-slate-700"}`}>
                            <span>{emo}</span><span className="text-slate-400">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {!m.is_deleted && (
                      <div className={`absolute -top-3 ${mine ? "right-1" : "left-1"} flex gap-1 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity`}>
                        <button onClick={() => setEmojiFor(emojiFor === m.id ? null : m.id)}
                          className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 shadow flex items-center justify-center hover:bg-slate-800">
                          <Smile className="w-3.5 h-3.5 text-slate-200" />
                        </button>
                        <button onClick={() => setReplyTo(m)}
                          className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 shadow flex items-center justify-center hover:bg-slate-800">
                          <Reply className="w-3.5 h-3.5 text-slate-200" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 shadow flex items-center justify-center hover:bg-slate-800" aria-label="Opsi hapus">
                              <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={mine ? "end" : "start"} className="w-44 bg-slate-950 border-slate-800 text-slate-100">
                            <DropdownMenuItem onClick={() => deleteForMe(m)}>Hapus untuk saya</DropdownMenuItem>
                            {mine && <DropdownMenuItem onClick={() => deleteForEveryone(m)} className="text-rose-300">Hapus untuk semua</DropdownMenuItem>}
                            <DropdownMenuItem>Batal</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    {emojiFor === m.id && (
                      <div className={`absolute z-20 -top-10 ${mine ? "right-0" : "left-0"} bg-slate-900 border border-slate-700 rounded-full px-1.5 py-1 flex gap-0.5 shadow-xl`}>
                        {EMOJIS.map(e => (
                          <button key={e} onClick={() => toggleReaction(m, e)} className="w-7 h-7 rounded-full hover:bg-slate-800 text-base">{e}</button>
                        ))}
                        <button onClick={() => setEmojiFor(null)} className="w-7 h-7 rounded-full hover:bg-slate-800 flex items-center justify-center">
                          <X className="w-3.5 h-3.5 text-slate-300" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {otherTyping && (
            <div className="flex justify-start animate-fade-in mt-1.5">
              <div className="bg-slate-800/90 border border-slate-700/50 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-bounce" style={{ animationDelay: "240ms" }} />
              </div>
            </div>
          )}
          {sessionStatus === "ended" && (
            <div className="text-center text-xs text-rose-300/80 mt-4 py-2 bg-rose-500/10 rounded-xl">Chat sudah berakhir</div>
          )}
        </div>

        {/* Input */}
        <div className="p-2.5 border-t border-emerald-400/20 bg-slate-950/80 space-y-2">
          {activeBan && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-300 mt-0.5" />
              <span>Akun diblokir dari chat: {banInfo?.reason} · {formatBanRemaining(banInfo)}</span>
            </div>
          )}
          {replyTo && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-400/30 bg-slate-900/70 px-2.5 py-2 text-[11px] animate-fade-in">
              <Reply className="w-3.5 h-3.5 text-emerald-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-emerald-200">
                  Membalas {replyTo.sender === visitor ? "diri sendiri" : (partner?.nick || "partner")}
                </p>
                <p className="truncate text-slate-300/80">{replyTo.content || (replyTo.image_url ? "📷 Foto" : "")}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-slate-800 rounded-full">
                <X className="w-3.5 h-3.5 text-slate-300" />
              </button>
            </div>
          )}
          {showEmojiInput && !activeBan && (
            <div className="grid grid-cols-8 gap-1 rounded-2xl border border-emerald-400/20 bg-slate-900/80 p-2 animate-fade-in">
              {[...EMOJIS, "😍", "🤣", "😭", "😎", "🤝", "💯", "🎉", "🤔", "😡", "😴", "✨", "🙌", "😇", "😜", "👌", "💬"].map((e) => (
                <button key={e} onClick={() => setDraft((d) => d + e)} className="h-8 rounded-lg hover:bg-slate-800 text-lg">{e}</button>
              ))}
            </div>
          )}
          {sessionStatus === "active" && !activeBan ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowEmojiInput(v => !v)} className="w-10 h-10 rounded-full bg-slate-900/70 border border-emerald-400/30 flex items-center justify-center shrink-0 hover:bg-slate-800/70 transition">
                <Plus className="w-[18px] h-[18px] text-emerald-300" />
              </button>
              <label className="w-10 h-10 rounded-full bg-slate-900/70 border border-emerald-400/30 flex items-center justify-center cursor-pointer shrink-0 hover:bg-slate-800/70 transition">
                <ImagePlus className="w-[18px] h-[18px] text-emerald-300" />
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) sendImage(e.target.files[0]); e.target.value = ""; }} />
              </label>
              <input
                value={draft}
                onChange={e => onChangeDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                onBlur={() => pushTyping(false)}
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

  if (view === "account") {
    return (
      <div className="rounded-3xl border-2 border-emerald-400/30 bg-gradient-to-b from-slate-950 to-emerald-950/20 p-5 space-y-5 max-h-[calc(100vh-160px)] overflow-y-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => setView("prefs")} className="text-emerald-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Pengaturan akun</div>
          <div className="w-12" />
        </div>

        {/* Identitas akun */}
        <div className="rounded-2xl border border-emerald-400/20 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">ID akun perangkat</span>
            <button onClick={() => { try { navigator.clipboard.writeText(visitor); toast.success("ID disalin"); } catch {} }}
              className="text-[11px] font-mono px-2 py-1 rounded-md bg-slate-800 text-emerald-200 flex items-center gap-1 border border-slate-700">
              {shortId(visitor)} <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Status</span>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">Mandiri (khusus Anon Chat)</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">Nama tampil</span>
            <span className="text-xs text-slate-100 font-semibold truncate max-w-[60%] text-right">{nickname}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-bold text-emerald-100">Akun Anon Chat (mandiri)</div>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">Daftar email + sandi khusus Anon Chat. Tidak terhubung ke akun saldo.</p>
            </div>
          </div>
          {anonAccount ? (
            <div className="rounded-xl bg-slate-900/70 border border-emerald-400/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-emerald-300/70 uppercase tracking-wide">Email terhubung</div>
                  <div className="text-xs font-bold text-slate-100 truncate">{anonAccount.email}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 shrink-0">Login</span>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-slate-700 p-2">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Deskripsi profil</div>
                <div className="text-[11px] text-slate-200 italic break-words">
                  {anonAccount.bio?.trim() ? anonAccount.bio : "Belum ada deskripsi — ceritakan dirimu singkat."}
                </div>
              </div>
              <button onClick={() => setShowAccountDialog(true)} className="w-full py-2 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-100 text-xs font-bold">
                {anonAccount.bio?.trim() ? "Ubah Deskripsi" : "Buat Deskripsi"}
              </button>
              <button onClick={() => setShowAccountDialog(true)} className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-bold">
                Kelola akun (ganti email / sandi / putuskan)
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAccountDialog(true)} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold">
              Daftar / Login dengan email
            </button>
          )}
        </div>
        <AnonAccountDialog open={showAccountDialog} onOpenChange={setShowAccountDialog} visitorId={visitor} account={anonAccount} onAccountChange={setAnonAccount} />

        <button onClick={logoutToGuest}
          className="w-full py-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 text-sm font-bold flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Reset Akun Anon
        </button>
        <p className="text-[10px] text-slate-500 -mt-2 text-center">Riwayat chat anonim, teman, & permintaan di perangkat ini akan terpisah dari akun saldo.</p>

        <div className="border-t border-slate-800 pt-4 space-y-4">
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

          <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-slate-900/60 p-3">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${myAvatar.gradient} flex items-center justify-center text-2xl overflow-hidden shrink-0`}>
                {avatarUrl ? <img src={avatarUrl} alt="Foto profil" className="h-full w-full object-cover" /> : <AvatarGraphic preset={myAvatar} />}
              </div>
              <label className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                <ImagePlus className="w-4 h-4" /> Upload foto profil
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); e.target.value = ""; }} />
              </label>
              {avatarUrl && <button onClick={() => setAvatarUrl("")} className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-200 border border-rose-400/30 flex items-center justify-center"><X className="w-4 h-4" /></button>}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {AVATAR_PRESETS.map((a) => (
                <button key={a.id} onClick={() => setAvatarPreset(a.id)} className={`h-10 rounded-xl bg-gradient-to-br ${a.gradient} text-xl border ${avatarPreset === a.id ? "border-white shadow-lg" : "border-transparent opacity-75"}`} title={a.label}><AvatarGraphic preset={a} className="h-full w-full" /></button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <div>
              <div className="text-sm font-bold text-slate-100">Terakhir dilihat</div>
              <div className="text-[11px] text-slate-400">Bisa diaktifkan/nonaktifkan setiap pengguna</div>
            </div>
            <button onClick={() => setShowLastSeen(v => !v)} className={`w-12 h-7 rounded-full p-0.5 transition ${showLastSeen ? "bg-emerald-500" : "bg-slate-700"}`}>
              <div className={`w-6 h-6 rounded-full bg-white transition ${showLastSeen ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-2 block">Gender saya</label>
            <div className="grid grid-cols-3 gap-2">
              {[{v:"male",l:"🧑 Pria"},{v:"female",l:"👩 Wanita"},{v:"any",l:"🥷 Anonim"}].map(o => (
                <button key={o.v} onClick={() => setMyGender(o.v)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border ${myGender === o.v ? "bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30" : "bg-slate-900 text-slate-300 border-slate-700"}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Preferensi gender partner dihapus — cukup pilih gender sendiri di atas */}

          <div>
            <label className="text-xs text-slate-400 mb-2 block">Pilih ketertarikan</label>
            <button onClick={() => setView("interest")}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between text-slate-100">
              <span>{interest}</span>
              <ChevronRight className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>

        <button onClick={() => { setView("prefs"); toast.success("Tersimpan"); }}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/40">
          SIMPAN
        </button>
      </div>
    );
  }

  if (view === "support") {
    const FAQ = [
      { q: "Apa itu Anon Chat?", a: "Fitur chat anonim untuk bertemu orang baru tanpa membuka identitas asli. Tetap jaga privasi & jangan bagikan data pribadi." },
      { q: "Bagaimana cara mencari partner?", a: "Tekan 'MULAI CARI' di lobi. Sistem mencocokkan kamu berdasarkan gender & ketertarikan." },
      { q: "Apakah Anon Chat berbayar?", a: "Tidak. Semua fitur dasar (cari partner, kirim pesan, gambar, teman) gratis. Tidak ada saldo terkait — akun Anon Chat terpisah dari saldo toko." },
      { q: "Bisakah saya buat akun Anon Chat?", a: "Bisa. Buka Pengaturan → 'Akun Anon Chat (mandiri)' lalu Daftar dengan email + sandi. Akun ini terpisah dari akun saldo." },
      { q: "Apa fungsi akun Anon Chat?", a: "Menyimpan teman & profil lintas perangkat, plus jadi syarat tambahan agar pesan tertentu (mis. yang mengandung kontak) tidak diblokir total." },
      { q: "Saya lupa sandi akun Anon, bagaimana?", a: "Saat ini reset belum tersedia mandiri. Hubungi WA CS untuk verifikasi manual." },
      { q: "Apakah pesan saya dibaca admin?", a: "Tidak. Pesan bersifat antar-pengguna. Admin hanya dapat melihat laporan pelanggaran kalau kamu lapor." },
      { q: "Mengapa pesan saya ditolak?", a: "Pesan terdeteksi sensitif (mis. tuduhan / kata terlarang), jadi tidak dikirim ke partner. Untuk laporan resmi, hubungi WA CS." },
      { q: "Mengapa kirim nomor HP/akun medsos diblokir?", a: "Untuk mencegah penipuan & doxing. Jika kamu sudah punya akun Anon Chat, sebagian pesan akan disensor saja, bukan diblokir penuh." },
      { q: "Mengapa foto partner buram?", a: "Semua foto dari partner disensor otomatis untuk perlindungan dari konten 18+. Ketuk 'Tampilkan' jika ingin melihat — risiko ditanggung pengguna." },
      { q: "Berapa batas ukuran gambar?", a: "Maksimal 5 MB per gambar. Foto profil maksimal 2 MB." },
      { q: "Apa yang terjadi jika melanggar aturan chat?", a: "Pelanggaran tetap dicatat sebagai peringatan. Admin bisa meninjau laporan jika ada penyalahgunaan." },
      { q: "Kenapa terakhir dilihat bisa hilang?", a: "Setiap pengguna bisa menyalakan atau menyembunyikan terakhir dilihat dari Pengaturan akun Anon Chat." },
      { q: "Bagaimana hapus pesan?", a: "Tekan-tahan pesan → pilih 'Hapus untuk saya' (sembunyikan dari layarmu) atau 'Hapus untuk semua' (hanya untuk pesan milikmu)." },
      { q: "Bagaimana balas pesan tertentu?", a: "Geser pesan ke kanan atau ketuk ikon balas, lalu ketik balasan." },
      { q: "Cara menambah teman?", a: "Saat sedang chatting, tekan ikon teman di header partner → 'Kirim permintaan'. Partner harus menerima dulu." },
      { q: "Bagaimana akhiri chat?", a: "Tekan tombol keluar di header chat. Sesi langsung berakhir untuk kedua pihak." },
      { q: "Kenapa notifikasi tidak muncul?", a: "Pastikan izin notifikasi diaktifkan (Pengaturan → Notifikasi), gunakan HTTPS / aplikasi terpasang, dan tab tidak di-mute oleh sistem." },
      { q: "Bagaimana jika ketemu pengguna nakal/penipu?", a: "Akhiri chat, tekan 'Lapor' di foto, dan hubungi WhatsApp CS dengan bukti." },
      { q: "Hilangkan riwayat & teman?", a: "Pengaturan akun → Logout & jadi Tamu / Reset sesi Tamu." },
    ];
    return (
      <div className="rounded-3xl border-2 border-emerald-400/30 bg-gradient-to-b from-slate-950 to-emerald-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-emerald-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Dukungan</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Phone className="w-5 h-5 text-emerald-300 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-emerald-100">Customer Service WhatsApp</div>
                <div className="text-xs text-emerald-200/80">Respon cepat 08.00 – 22.00 WIB</div>
                <div className="font-mono text-emerald-300 text-sm mt-0.5">{CS_WA}</div>
              </div>
            </div>
            <a href={CS_WA_LINK} target="_blank" rel="noreferrer"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40">
              <MessageCircle className="w-4 h-4" /> Chat CS via WhatsApp
            </a>
          </div>

          <div>
            <h4 className="text-xs font-bold text-emerald-300 mb-2 px-1">Pertanyaan umum</h4>
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
              {FAQ.map((f, i) => (
                <details key={i} className="group">
                  <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between hover:bg-slate-800/40">
                    <span className="text-sm text-slate-100 font-semibold pr-2">{f.q}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-open:rotate-90 transition" />
                  </summary>
                  <div className="px-4 pb-3 text-xs text-slate-300 leading-relaxed">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
        <InnerNav active="settings" onChange={(k) => {
          if (k === "search") setView("lobby");
          else if (k === "friends") setView("friends");
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "notif") {
    const perm = typeof Notification !== "undefined" ? Notification.permission : "default";
    return (
      <div className="rounded-3xl border-2 border-emerald-400/30 bg-gradient-to-b from-slate-950 to-emerald-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-emerald-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Notifikasi & Suara</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3">
            {soundOn ? <Volume2 className="w-5 h-5 text-emerald-300" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-100">Suara pesan masuk</div>
              <div className="text-[11px] text-slate-400">Bunyikan ping saat pesan baru di chat anonim</div>
            </div>
            <button onClick={() => { setSoundOn(s => !s); if (!soundOn) playPing(); }}
              className={`w-12 h-7 rounded-full p-0.5 transition ${soundOn ? "bg-emerald-500" : "bg-slate-700"}`}>
              <div className={`w-6 h-6 rounded-full bg-white transition ${soundOn ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3">
            <Bell className={`w-5 h-5 ${notifOn ? "text-emerald-300" : "text-slate-400"}`} />
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-100">Notifikasi anon chat</div>
              <div className="text-[11px] text-slate-400">Tampilkan notifikasi browser saat tab tidak aktif</div>
              <div className="text-[10px] mt-0.5">
                Status izin: <span className={perm === "granted" ? "text-emerald-300" : perm === "denied" ? "text-rose-300" : "text-amber-300"}>{perm}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{explainNotif()}</div>
            </div>
            <button onClick={() => { if (perm !== "granted") requestNotifPerm(); else setNotifOn(n => !n); }}
              className={`w-12 h-7 rounded-full p-0.5 transition ${notifOn && perm === "granted" ? "bg-emerald-500" : "bg-slate-700"}`}>
              <div className={`w-6 h-6 rounded-full bg-white transition ${notifOn && perm === "granted" ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-3 text-[11px] text-amber-100/90 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
            <span>Notifikasi & suara hanya untuk percakapan anon chat. Pengaturan ini tersimpan di perangkat ini.</span>
          </div>
        </div>
        <InnerNav active="settings" onChange={(k) => {
          if (k === "search") setView("lobby");
          else if (k === "friends") setView("friends");
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "prefs") {
    const genderLabel = myGender === "male" ? "pria" : myGender === "female" ? "wanita" : "rahasia";
    return (
      <div className="rounded-3xl overflow-hidden border-2 border-emerald-400/30 bg-gradient-to-b from-slate-950 via-slate-950 to-emerald-950/20 min-h-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <div className="w-12" />
          <div className="font-bold text-slate-100 text-base">Setelan</div>
          <button onClick={() => setView("account")} className="text-emerald-300 text-sm font-semibold">Edit</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Avatar + nickname + gender */}
          <div className="flex flex-col items-center gap-2">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-xl ring-4 ring-slate-900 bg-gradient-to-br ${myAvatar.gradient} overflow-hidden`}>
              {avatarUrl ? <img src={avatarUrl} alt="Foto profil" className="h-full w-full object-cover" /> : <AvatarGraphic preset={myAvatar} />}
            </div>
            <div className="text-xl font-bold text-slate-100 mt-1">{nickname}</div>
            <div className="text-sm text-slate-400 flex items-center gap-1.5">
              <span>{genderLabel}</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-[10px] text-emerald-300/80">{shortId(visitor)}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-emerald-200 border border-emerald-400/30 font-bold">ANON</span>
            </div>
          </div>

          {/* Tentang saya */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-base font-bold text-slate-100">Deskripsi saya</div>
              {editingBio && <span className="text-[10px] text-slate-500">{bioDraft.length}/200</span>}
            </div>
            {!editingBio ? (
              savedBio.trim() ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-slate-950/60 border border-slate-700 p-3 text-xs text-slate-200 italic break-words">"{savedBio}"</div>
                  <button
                    onClick={() => { setBioDraft(savedBio); setEditingBio(true); }}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" /> Ubah Deskripsi
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setBioDraft(""); setEditingBio(true); }}
                  className="w-full py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" /> Buat Deskripsi
                </button>
              )
            ) : (
              <div className="space-y-2">
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value.slice(0, 200))}
                  rows={3}
                  autoFocus
                  placeholder="Tulis deskripsi singkat yang akan terlihat oleh partner chat…"
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 resize-none focus:border-emerald-400/60"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setBioDraft(savedBio); setEditingBio(false); }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    onClick={saveBio}
                    disabled={savingBio || bioDraft.trim() === savedBio.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" /> {savingBio ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
                {!anonAccount && (
                  <p className="text-[10px] text-slate-500 italic">Disimpan untuk perangkat ini. Daftar akun agar tetap tersimpan saat ganti perangkat.</p>
                )}
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-2 italic">{showLastSeen ? "Terakhir dilihat aktif untuk partner chat." : "Terakhir dilihat kamu disembunyikan."}</div>
          </div>

          {/* Settings list */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
            {[
              { icon: Link2, label: "Pengaturan akun", desc: "Email, sandi & deskripsi", onClick: () => setView("account") },
              { icon: HelpCircle, label: "Dukungan", desc: "FAQ + tombol CS WhatsApp", onClick: () => setView("support") },
              { icon: Bell, label: "Notifikasi dan suara", desc: (soundOn ? "Suara aktif" : "Suara mati") + " · " + (notifOn ? "Notifikasi aktif" : "Notifikasi mati"), onClick: () => setView("notif") },
              { icon: Moon, label: "Tampilan", desc: "Tema gelap aktif", onClick: () => toast.info("Tema gelap aktif untuk Anon Chat") },
              { icon: MessageSquare, label: "Opsi Obrolan", desc: showLastSeen ? "Terakhir dilihat: aktif" : "Terakhir dilihat: nonaktif", onClick: () => setShowLastSeen(v => !v) },
              { icon: Globe, label: "Bahasa", desc: "Mengikuti bahasa aplikasi", onClick: () => toast.info("Atur bahasa dari menu utama aplikasi") },
              { icon: Lock, label: "Privasi", desc: "Anon Chat tidak menyimpan identitas asli", onClick: () => toast.info("Anon Chat tanpa identitas asli — chat terhapus saat sesi berakhir") },
              { icon: ThumbsUp, label: "Beri rating", desc: "Bantu kami berkembang", onClick: () => { try { window.open("https://wa.me/6285769302532?text=" + encodeURIComponent("Halo, saya mau beri rating Anon Chat"), "_blank"); } catch { /* ignore */ } } },
              { icon: Info, label: "Tentang", desc: "Anon Chat by Agung Adi Store", onClick: () => toast.info("Anon Chat — bagian dari Agung Adi Store. Murah & Terpercaya.") },
            ].map((it, i) => (
              <button key={i} onClick={it.onClick}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/40 transition">
                <it.icon className="w-5 h-5 text-emerald-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-100 font-semibold text-sm">{it.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{it.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
        </div>

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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {friendReqs.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-amber-300 mb-2 px-1">Permintaan masuk ({friendReqs.length})</h4>
              <div className="space-y-2">
                {friendReqs.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-400/30">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-lg shrink-0">🥷</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-amber-100 truncate">{r.from_nickname}</div>
                      <div className="text-[10px] text-amber-300/70">ingin berteman</div>
                    </div>
                    <button onClick={() => respondFriendRequest(r.id, true)} className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center" title="Terima">
                      <UserCheck className="w-4 h-4" />
                    </button>
                    <button onClick={() => respondFriendRequest(r.id, false)} className="w-8 h-8 rounded-full bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 flex items-center justify-center" title="Tolak">
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-emerald-300 mb-2 px-1">Daftar teman ({friends.length})</h4>
            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center gap-3 py-10">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-10 h-10 text-emerald-300/70" />
                </div>
                <h3 className="font-bold text-slate-100">Belum ada teman</h3>
                <p className="text-xs text-slate-400 max-w-[260px]">Saat sedang chat, ketuk tombol <UserPlus className="inline w-3 h-3" /> Add di header untuk menambahkan teman.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map(f => (
                  <div key={f.friend_visitor} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-emerald-400/20 hover:border-emerald-400/50 transition">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-lg shrink-0">🥷</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-emerald-100 truncate">{f.friend_nickname}</div>
                      <div className="text-[10px] text-emerald-300/60 italic">Status & terakhir dilihat tidak ditampilkan</div>
                    </div>
                    <button onClick={() => startFriendChat(f.friend_visitor)} className="px-3 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1" title="Chat">
                      <MessageCircle className="w-3.5 h-3.5" /> Chat
                    </button>
                    <button onClick={() => removeFriend(f.friend_visitor)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 flex items-center justify-center" title="Hapus">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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

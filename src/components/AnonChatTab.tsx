import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Settings as SettingsIcon, Send, X, RefreshCw, UserPlus, Heart, ChevronRight, Sparkles, Shield, ImagePlus, Smile, Reply, Trash2, Check, CheckCheck, MessageCircle, UserCheck, UserX, HelpCircle, Bell, Phone, Volume2, VolumeX, Eye, AlertTriangle, LogOut, Copy, Flag, Plus, FileText, Moon, MessageSquare, Globe, Lock, ThumbsUp, Info, Link2, Mic, Compass, User as UserIcon, Music as MusicIcon, Gamepad2, Film as FilmIcon, Trophy, Code as CodeIcon, Camera, ArrowLeft, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { moderateOutgoing } from "@/lib/chat-moderation";
import { formatBanRemaining, type BanInfo } from "@/hooks/useAccountBan";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AnonAccountDialog, fetchAnonAccount, type AnonAccount } from "@/components/AnonAccountDialog";
import { useTheme } from "@/lib/theme";
import { useLang } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/languages";
import { requestMicrophoneStream } from "@/lib/microphone-permission";
import { Key, Keyboard, EyeOff, PhoneCall, Archive, HardDrive, BookOpen, Smartphone, ArrowRight, ClipboardList, VenetianMask, Zap, Paperclip, Video as VideoIcon, Download } from "lucide-react";
import tutorialImg1 from "@/assets/anon-tutorial-1.jpg";
import tutorialImg2 from "@/assets/anon-tutorial-2.jpg";
import tutorialImg3 from "@/assets/anon-tutorial-3.jpg";
import tutorialImg4 from "@/assets/anon-tutorial-4.jpg";
import { AnonPremiumDialog, useAnonPremium } from "@/components/anon/AnonPremiumDialog";

const CS_WA = "085769302532";
const CS_WA_LINK = `https://wa.me/62${CS_WA.replace(/^0/, "")}`;
function shortId(id: string) {
  const clean = id.replace(/-/g, "").toUpperCase();
  return "#" + clean.slice(0, 8);
}
const AVATAR_PRESETS = [
  { id: "ninja", label: "Ninja", gradient: "from-indigo-500 to-purple-600", skin: "#fde68a", accent: "#4f46e5" },
  { id: "leaf", label: "Daun", gradient: "from-purple-400 to-violet-500", skin: "#bbf7d0", accent: "#059669" },
  { id: "cat", label: "Kucing", gradient: "from-amber-400 to-orange-500", skin: "#fed7aa", accent: "#f97316" },
  { id: "star", label: "Bintang", gradient: "from-fuchsia-400 to-blue-600", skin: "#cffafe", accent: "#0284c7" },
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
          {preset.id === "leaf" && <path d="M42 12c-10 0-17 5-18 15 9 0 17-5 18-15Z" fill="#a78bfa" />}
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
  delivered_at?: string | null;
  read_at?: string | null;
  reply_to_id: string | null;
  is_deleted: boolean;
  deleted_for?: string[] | null;
  local_blocked?: boolean;
  media_url?: string | null;
  media_type?: string | null; // 'image' | 'audio' | 'video' | 'file' | 'call'
  media_name?: string | null;
  media_size?: number | null;
  caption?: string | null;
  view_once?: boolean;
  viewed_at?: string | null;
  audio_duration?: number | null;
}
interface AnonReaction { id: string; message_id: string; visitor_id: string; emoji: string; }
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];
interface AnonProfile { visitor_id: string; nickname: string | null; avatar_url: string | null; avatar_preset: string | null; show_last_seen: boolean; last_seen_at: string; who_can_call?: "all" | "friends" | "none" | null; }
type PublicBioResponse = { success?: boolean; bio?: string | null; error?: string };
type UpdateBioResponse = { success?: boolean; account?: AnonAccount | null; error?: string };

type View = "lobby" | "prefs" | "account" | "interest" | "searching" | "chat" | "friends" | "explore" | "onboarding" | "support" | "notif" | "appearance" | "chatopts" | "language" | "privacy" | "about" | "about_privacy" | "about_rules" | "about_tutorial" | "about_system" | "history" | "callhistory";

interface AnonCallLog {
  id: string;
  visitor_id: string;
  partner_visitor: string;
  partner_nickname: string | null;
  session_id: string | null;
  direction: "outgoing" | "incoming";
  status: "answered" | "missed" | "declined" | "cancelled" | "ended";
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
}
interface AnonMatchHistory {
  id: string;
  visitor_id: string;
  partner_visitor: string;
  partner_nickname: string | null;
  session_id: string | null;
  last_session_at: string;
}

const INTERESTS = ["Apapun","Curhat","Main RP","Meme","Kesepian","Game","Anime","Film","Musik","Travel","Coding","Olahraga","Nongkrong","Belajar"];

// Kategori minat untuk onboarding (mirip referensi anon.chat)
const INTEREST_CARDS: { id: string; label: string; Icon: any; gradient: string; ring: string }[] = [
  { id: "Musik",    label: "Musik",    Icon: MusicIcon, gradient: "from-purple-500/30 to-violet-600/20", ring: "ring-purple-400/60" },
  { id: "Game",     label: "Game",     Icon: Gamepad2,  gradient: "from-emerald-500/30 to-teal-600/20",  ring: "ring-emerald-400/60" },
  { id: "Film",     label: "Film",     Icon: FilmIcon,  gradient: "from-slate-500/30 to-slate-700/20",   ring: "ring-slate-300/60" },
  { id: "Olahraga", label: "Olahraga", Icon: Trophy,    gradient: "from-orange-500/30 to-amber-600/20",  ring: "ring-orange-400/60" },
  { id: "Anime",    label: "Anime",    Icon: Sparkles,  gradient: "from-pink-500/30 to-rose-600/20",     ring: "ring-pink-400/60" },
  { id: "Coding",   label: "Coding",   Icon: CodeIcon,  gradient: "from-sky-500/30 to-indigo-600/20",    ring: "ring-sky-400/60" },
];

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
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useLang();
  const [view, setView] = useState<View>("lobby");
  // Broadcast view to outer page so the bottom navigation can decide whether to show
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent("anon-chat-view", { detail: view })); } catch {}
    return () => { try { window.dispatchEvent(new CustomEvent("anon-chat-view", { detail: "lobby" })); } catch {} };
  }, [view]);
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem("anon_nick") || genNick());
  const [myGender, setMyGender] = useState<string>(() => localStorage.getItem("anon_my_gender") || "any");
  const [prefGender, setPrefGender] = useState<string>(() => localStorage.getItem("anon_pref_gender") || "any");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumFocus, setPremiumFocus] = useState<"gender" | "call">("gender");
  const { status: premiumStatus, refresh: refreshPremium, isPremium } = useAnonPremium(visitor);
  const openPremium = (focus: "gender" | "call") => { setPremiumFocus(focus); setPremiumOpen(true); };
  const premiumModal = (
    <AnonPremiumDialog
      open={premiumOpen}
      onClose={() => setPremiumOpen(false)}
      visitorId={visitor}
      status={premiumStatus}
      highlight={premiumFocus}
      onSuccess={() => { void refreshPremium(); }}
    />
  );
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
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [anonAccount, setAnonAccount] = useState<AnonAccount | null>(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savedBio, setSavedBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);

  // Partner visitor id for current session (for call logs / blocking)
  const partnerVisitorRef = useRef<string | null>(null);
  // Photo preview before send
  const [photoPreview, setPhotoPreview] = useState<{ file: File; url: string; caption: string; viewOnce: boolean } | null>(null);
  const [viewOnceViewer, setViewOnceViewer] = useState<{ id: string; url: string; revealed: boolean; shielded: boolean } | null>(null);
  const viewOnceImageRef = useRef<HTMLImageElement>(null);
  const viewOnceShieldRef = useRef<HTMLDivElement>(null);
  const viewOnceCloseTimerRef = useRef<number | null>(null);
  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const recordStartRef = useRef<number>(0);
  // Call log refs
  const callDirRef = useRef<"outgoing" | "incoming" | null>(null);
  const callStartedAtRef = useRef<string | null>(null);
  const callAnsweredAtRef = useRef<string | null>(null);
  const callConnectedRef = useRef(false);
  // History lists
  const [callLogs, setCallLogs] = useState<AnonCallLog[]>([]);
  const [matchHistory, setMatchHistory] = useState<AnonMatchHistory[]>([]);
  // Audio playback state for voice notes
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Onboarding & Explore (baru)
  const [onboardStep, setOnboardStep] = useState<1 | 2 | 3>(1);
  const [onboardInterests, setOnboardInterests] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("anon_onboard_interests") || "[]"); } catch { return []; }
  });
  const [exploreList, setExploreList] = useState<AnonProfile[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  useEffect(() => { try { localStorage.setItem("anon_onboard_interests", JSON.stringify(onboardInterests)); } catch {} }, [onboardInterests]);

  const loadExplore = useCallback(async () => {
    setExploreLoading(true);
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("anon_chat_profiles" as any)
        .select("*")
        .neq("visitor_id", visitor)
        .gte("last_seen_at", cutoff)
        .order("last_seen_at", { ascending: false })
        .limit(50);
      setExploreList(((data as unknown) as AnonProfile[]) || []);
    } finally {
      setExploreLoading(false);
    }
  }, [visitor]);

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
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNowTick(Date.now()), 20000); return () => window.clearInterval(t); }, []);
  const partnerLastSeenMs = partnerProfile?.last_seen_at ? new Date(partnerProfile.last_seen_at).getTime() : 0;
  const partnerOnline = partnerLastSeenMs > 0 && (nowTick - partnerLastSeenMs) < 60_000;
  const formatLastSeen = (ms: number) => {
    if (!ms) return "offline";
    const diff = Math.max(0, nowTick - ms);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    return new Date(ms).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  };
  const partnerShowLastSeen = partnerProfile?.show_last_seen !== false;
  const partnerLastSeen = partnerOnline ? "online" : `terakhir dilihat ${formatLastSeen(partnerLastSeenMs)}`;
  const partnerWhoCanCall = (partnerProfile?.who_can_call as "all" | "friends" | "none" | undefined) || "friends";

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
      p_who_can_call: whoCanCall,
    });
    if (data) setMyProfile(data as unknown as AnonProfile);
  }, [visitor, nickname, avatarUrl, avatarPreset, showLastSeen, whoCanCall]);

  const loadPartnerProfile = useCallback(async (session: string) => {
    const { data: sess } = await supabase.from("anon_chat_sessions").select("visitor_a, visitor_b").eq("id", session).maybeSingle();
    if (!sess) return;
    const other = sess.visitor_a === visitor ? sess.visitor_b : sess.visitor_a;
    partnerVisitorRef.current = other;
    const { data } = await supabase.from("anon_chat_profiles" as any).select("*").eq("visitor_id", other).maybeSingle();
    setPartnerProfile((data as unknown as AnonProfile) || null);
    const { data: bioData } = await supabase.functions.invoke("anon-chat-auth", {
      body: { action: "public_bio", visitorId: visitor, targetVisitorId: other },
    });
    const bioResponse = bioData as PublicBioResponse | null;
    setPartnerBio(bioResponse?.bio || null);
    setShowPartnerBio(false);
  }, [visitor]);

  const loadCallLogs = useCallback(async () => {
    const { data } = await supabase.from("anon_chat_call_logs" as any).select("*").eq("visitor_id", visitor).order("started_at", { ascending: false }).limit(100);
    setCallLogs((data as unknown as AnonCallLog[]) || []);
  }, [visitor]);

  const loadMatchHistory = useCallback(async () => {
    const { data } = await supabase.from("anon_chat_match_history" as any).select("*").eq("visitor_id", visitor).order("last_session_at", { ascending: false }).limit(100);
    setMatchHistory((data as unknown as AnonMatchHistory[]) || []);
  }, [visitor]);

  const blockMatchPartner = useCallback(async (partnerVisitor: string) => {
    if (!confirm("Hapus dari riwayat dan jangan pertemukan lagi dengan pengguna ini?")) return;
    await supabase.from("anon_chat_blocked_matches" as any).insert({ visitor_id: visitor, blocked_visitor: partnerVisitor } as any);
    await supabase.from("anon_chat_match_history" as any).delete().eq("visitor_id", visitor).eq("partner_visitor", partnerVisitor);
    toast.success("Dihapus dari riwayat. Tidak akan dipertemukan lagi.");
    loadMatchHistory();
  }, [visitor, loadMatchHistory]);

  const deleteCallLog = useCallback(async (id: string) => {
    await supabase.from("anon_chat_call_logs" as any).delete().eq("id", id).eq("visitor_id", visitor);
    setCallLogs(prev => prev.filter(c => c.id !== id));
  }, [visitor]);

  const insertCallLog = useCallback(async (status: AnonCallLog["status"]) => {
    if (!callDirRef.current || !callStartedAtRef.current || !partnerVisitorRef.current) return;
    const startedAt = callStartedAtRef.current;
    const answeredAt = callAnsweredAtRef.current;
    const endedAt = new Date().toISOString();
    const duration = answeredAt ? Math.max(0, Math.floor((Date.parse(endedAt) - Date.parse(answeredAt)) / 1000)) : 0;
    const dir = callDirRef.current;
    try {
      await supabase.from("anon_chat_call_logs" as any).insert({
        visitor_id: visitor,
        partner_visitor: partnerVisitorRef.current,
        partner_nickname: partner?.nick || null,
        session_id: sessionId,
        direction: dir,
        status,
        started_at: startedAt,
        answered_at: answeredAt,
        ended_at: endedAt,
        duration_seconds: duration,
      } as any);
    } catch {}
    // Tampilkan event call sebagai bubble di chat (gaya WhatsApp).
    // Hanya sisi caller (outgoing) yang insert agar tidak duplikat — partner ikut lihat via realtime.
    if (sessionId && dir === "outgoing") {
      try {
        await supabase.from("anon_chat_messages").insert({
          session_id: sessionId,
          sender_visitor_id: visitor,
          media_type: "call",
          content: JSON.stringify({ status, duration, direction: "outgoing" }),
        } as any);
      } catch {}
    }
    callDirRef.current = null; callStartedAtRef.current = null; callAnsweredAtRef.current = null; callConnectedRef.current = false;
  }, [visitor, partner, sessionId]);


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

  // Realtime subscribe to partner profile updates (last_seen_at, avatar, dll)
  useEffect(() => {
    const pv = partnerVisitorRef.current;
    if (!pv || !sessionId) return;
    const ch = supabase
      .channel(`anon-partner-${pv}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anon_chat_profiles", filter: `visitor_id=eq.${pv}` }, (payload) => {
        setPartnerProfile(payload.new as unknown as AnonProfile);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, partnerProfile?.visitor_id]);


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
    const sid = sessionId;
    const markDelivered = () => { void supabase.rpc("anon_chat_mark_delivered" as any, { p_session: sid, p_visitor: visitor }); };
    const markRead = () => { void supabase.rpc("anon_chat_mark_read" as any, { p_session: sid, p_visitor: visitor }); };
    const ch = supabase.channel(`anon_sess_${sid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anon_chat_messages", filter: `session_id=eq.${sid}` },
        (p: any) => {
          const nm = mapMsg(p.new);
          setMessages(prev => prev.some(m => m.id === nm.id) ? prev : [...prev, nm]);
          if (nm.sender !== visitor) {
            // Pesan partner masuk: kalau chat sedang dibuka → langsung baca, kalau tidak → cuma delivered
            if (view === "chat" && document.visibilityState === "visible") markRead();
            else markDelivered();
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anon_chat_messages", filter: `session_id=eq.${sid}` },
        (p: any) => { const nm = mapMsg(p.new); setMessages(prev => prev.map(m => m.id === nm.id ? nm : m)); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anon_chat_reactions" },
        (p: any) => { const r = p.new as AnonReaction; setReactions(prev => prev.some(x => x.id === r.id) ? prev : [...prev, r]); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "anon_chat_reactions" },
        (p: any) => { const r = p.old as any; setReactions(prev => prev.filter(x => x.id !== r.id)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "anon_chat_typing" },
        (p: any) => {
          const row = p.new || p.old;
          if (!row || row.session_id !== sid || row.sender_visitor_id === visitor) return;
          const typing = !!p.new?.is_typing && p.eventType !== "DELETE";
          const ts = p.new?.updated_at ? new Date(p.new.updated_at).getTime() : 0;
          setOtherTyping(typing && Date.now() - ts < 6000);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anon_chat_sessions", filter: `id=eq.${sid}` },
        (payload: any) => { if (payload.new.status === "ended") setSessionStatus("ended"); })
      .subscribe();
    // Saat tab kembali fokus / chat dibuka → tandai read
    const onFocus = () => { if (view === "chat") markRead(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [sessionId, visitor, view]);

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
    created_at: m.created_at, is_read: !!m.is_read,
    delivered_at: m.delivered_at ?? null, read_at: m.read_at ?? null,
    reply_to_id: m.reply_to_id ?? null, is_deleted: !!m.is_deleted,
    deleted_for: m.deleted_for ?? [],
    media_url: m.media_url ?? null, media_type: m.media_type ?? null, caption: m.caption ?? null,
    media_name: m.media_name ?? null, media_size: m.media_size ?? null,
    view_once: !!m.view_once, viewed_at: m.viewed_at ?? null, audio_duration: m.audio_duration ?? null,
  });

  const enterSession = async (id: string, partnerNick: string | null, partnerGender: string | null) => {
    setSessionId(id);
    setPartner({ nick: partnerNick || "Stranger", gender: partnerGender });
    await loadPartnerProfile(id);
    setSessionStatus("active");
    const { data } = await supabase.from("anon_chat_messages").select("*").eq("session_id", id).order("created_at");
    const list = (data || []).map(mapMsg);
    setMessages(list);
    // Tandai semua pesan partner sebagai delivered + read (centang biru)
    void supabase.rpc("anon_chat_mark_read" as any, { p_session: id, p_visitor: visitor });
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
      p_pref_gender: isPremium ? prefGender : "any", p_interest: interest === "Apapun" ? "any" : interest,
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

  // Back button: for friends, keep the session intact (history persists, can reopen). For random, end the chat.
  const backFromChat = async () => {
    if (friendStatusForPartner === "friend") {
      setSessionId(null); setPartner(null); setMessages([]); setReactions([]); setReplyTo(null); setView("lobby");
      return;
    }
    await endChat();
  };

  const newPartner = async () => { await endChat(); await doMatch(); };

  // ============ VOICE CALL (WebRTC P2P via Supabase Realtime signaling) ============
  const [callState, setCallState] = useState<"idle" | "outgoing" | "incoming" | "connected">("idle");
  const [callMuted, setCallMuted] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceChanRef = useRef<any>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const callTimerRef = useRef<any>(null);

  const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

  const cleanupCall = useCallback((notifyPeer = false, statusOverride?: AnonCallLog["status"]) => {
    if (notifyPeer && voiceChanRef.current) {
      try { voiceChanRef.current.send({ type: "broadcast", event: "voice", payload: { kind: "hangup", from: visitor } }); } catch {}
    }
    // Log call if there was a started call
    if (callDirRef.current && callStartedAtRef.current) {
      let status: AnonCallLog["status"] = statusOverride || "ended";
      if (!statusOverride) {
        if (callConnectedRef.current) status = "ended";
        else if (callDirRef.current === "outgoing") status = "cancelled";
        else status = "missed";
      }
      insertCallLog(status);
    }
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    try { pcRef.current?.getSenders().forEach(s => s.track?.stop()); } catch {}
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    try { localStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    localStreamRef.current = null;
    if (remoteAudioRef.current) { try { remoteAudioRef.current.srcObject = null; } catch {} }
    pendingOfferRef.current = null;
    setCallState("idle"); setCallMuted(false); setCallSeconds(0);
  }, [visitor, insertCallLog]);

  const ensurePc = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && voiceChanRef.current) {
        voiceChanRef.current.send({ type: "broadcast", event: "voice", payload: { kind: "ice", from: visitor, candidate: e.candidate.toJSON() } });
      }
    };
    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") {
        setCallState("connected");
        if (!callConnectedRef.current) { callConnectedRef.current = true; if (!callAnsweredAtRef.current) callAnsweredAtRef.current = new Date().toISOString(); }
        if (!callTimerRef.current) callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
      } else if (st === "failed" || st === "disconnected" || st === "closed") {
        if (callState !== "idle") { toast.info("Panggilan terputus"); cleanupCall(false); }
      }
    };
    pcRef.current = pc;
    return pc;
  }, [visitor, callState, cleanupCall]);

  const startVoiceCall = useCallback(async () => {
    if (!sessionId || sessionStatus !== "active") return;
    if (callState !== "idle") return;
    if (!isPremium) {
      toast.error("Voice call khusus member Premium");
      openPremium("call");
      return;
    }
    const isFriend = friendStatusForPartner === "friend";
    if (partnerWhoCanCall === "none") {
      toast.error("Pengguna tidak dapat menerima panggilan");
      return;
    }
    if (partnerWhoCanCall === "friends" && !isFriend) {
      toast.error("Hanya teman yang bisa melakukan panggilan");
      return;
    }
    try {
      const stream = await requestMicrophoneStream();
      localStreamRef.current = stream;
      const pc = ensurePc();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      voiceChanRef.current?.send({ type: "broadcast", event: "voice", payload: { kind: "offer", from: visitor, sdp: offer } });
      callDirRef.current = "outgoing";
      callStartedAtRef.current = new Date().toISOString();
      callAnsweredAtRef.current = null;
      callConnectedRef.current = false;
      setCallState("outgoing");
      toast.info("Memanggil partner...");
    } catch (e: any) {
      toast.error("Gagal mengakses mikrofon", { description: e?.message || "Cek izin mikrofon di browser." });
      cleanupCall(false);
    }
  }, [sessionId, sessionStatus, callState, ensurePc, visitor, cleanupCall, partnerWhoCanCall, friendStatusForPartner, isPremium]);

  const acceptVoiceCall = useCallback(async () => {
    if (!pendingOfferRef.current) return;
    try {
      const stream = await requestMicrophoneStream();
      localStreamRef.current = stream;
      const pc = ensurePc();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      voiceChanRef.current?.send({ type: "broadcast", event: "voice", payload: { kind: "answer", from: visitor, sdp: answer } });
      pendingOfferRef.current = null;
      callAnsweredAtRef.current = new Date().toISOString();
      callConnectedRef.current = true;
      setCallState("connected");
    } catch (e: any) {
      toast.error("Gagal menerima panggilan", { description: e?.message || "Cek izin mikrofon di browser." });
      cleanupCall(true);
    }
  }, [ensurePc, visitor, cleanupCall]);

  const declineVoiceCall = useCallback(() => {
    cleanupCall(true, "declined");
  }, [cleanupCall]);

  const toggleCallMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    const newMuted = !callMuted;
    tracks.forEach(t => { t.enabled = !newMuted; });
    setCallMuted(newMuted);
  }, [callMuted]);

  // Subscribe signaling channel per session
  useEffect(() => {
    if (!sessionId) { cleanupCall(false); return; }
    const ch = supabase.channel(`voice_${sessionId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "voice" }, async ({ payload }: any) => {
      if (!payload || payload.from === visitor) return;
      const pc = pcRef.current;
      if (payload.kind === "offer") {
        pendingOfferRef.current = payload.sdp;
        callDirRef.current = "incoming";
        callStartedAtRef.current = new Date().toISOString();
        callAnsweredAtRef.current = null;
        callConnectedRef.current = false;
        setCallState("incoming");
        playPing();
      } else if (payload.kind === "answer" && pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          if (!callAnsweredAtRef.current) callAnsweredAtRef.current = new Date().toISOString();
          callConnectedRef.current = true;
        } catch {}
      } else if (payload.kind === "ice" && pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
      } else if (payload.kind === "hangup") {
        toast.info("Partner mengakhiri panggilan");
        cleanupCall(false);
      }
    }).subscribe();
    voiceChanRef.current = ch;
    return () => { try { supabase.removeChannel(ch); } catch {} voiceChanRef.current = null; cleanupCall(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const fmtCallTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

  const openPhotoPreview = (file: File) => {
    if (!sessionId || sessionStatus === "ended" || activeBan) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Gambar maksimal 5MB"); return; }
    const url = URL.createObjectURL(file);
    setPhotoPreview({ file, url, caption: "", viewOnce: false });
  };

  const sendPhoto = async () => {
    if (!photoPreview || !sessionId) return;
    const { file, caption, viewOnce } = photoPreview;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `anon/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file);
    if (upErr) { toast.error("Gagal upload gambar"); return; }
    const { data: u } = supabase.storage.from("chat-images").getPublicUrl(path);
    const payload: any = {
      session_id: sessionId,
      sender_visitor_id: visitor,
      media_url: u.publicUrl,
      media_type: "image",
      caption: caption.trim() || null,
      view_once: viewOnce,
    };
    if (replyTo) payload.reply_to_id = replyTo.id;
    setReplyTo(null);
    try { URL.revokeObjectURL(photoPreview.url); } catch {}
    setPhotoPreview(null);
    await supabase.from("anon_chat_messages").insert(payload);
  };

  const startRecording = async () => {
    if (!sessionId || sessionStatus === "ended" || activeBan || recording) return;
    try {
      const stream = await requestMicrophoneStream();
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const blob = new Blob(recordChunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) { toast.message("Pesan suara terlalu pendek"); return; }
        const path = `anon/${sessionId}/voice-${Date.now()}.webm`;
        const { error: upErr } = await supabase.storage.from("chat-images").upload(path, blob, { contentType: "audio/webm" });
        if (upErr) { toast.error("Gagal upload pesan suara"); return; }
        const { data: u } = supabase.storage.from("chat-images").getPublicUrl(path);
        const payload: any = {
          session_id: sessionId,
          sender_visitor_id: visitor,
          media_url: u.publicUrl,
          media_type: "audio",
          audio_duration: duration,
        };
        if (replyTo) payload.reply_to_id = replyTo.id;
        setReplyTo(null);
        await supabase.from("anon_chat_messages").insert(payload);
      };
      recordStartRef.current = Date.now();
      mr.start();
      recorderRef.current = mr;
      setRecording(true); setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch (e: any) {
      toast.error("Gagal akses mikrofon", { description: e?.message || "" });
    }
  };

  const stopRecording = (cancel = false) => {
    if (!recorderRef.current) return;
    try {
      if (cancel) {
        recorderRef.current.ondataavailable = null as any;
        recorderRef.current.onstop = () => { try { recorderRef.current?.stream?.getTracks().forEach(t => t.stop()); } catch {} };
      }
      recorderRef.current.stop();
    } catch {}
    recorderRef.current = null;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    setRecording(false); setRecordSecs(0);
  };

  // Kirim video / dokumen / file lain ke bucket anon-chat-media
  const sendAnyFile = async (file: File, kind: "video" | "file") => {
    if (!sessionId || sessionStatus === "ended" || activeBan) return;
    const max = kind === "video" ? 20 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > max) { toast.error(kind === "video" ? "Video maksimal 20MB" : "File maksimal 20MB"); return; }
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || (kind === "video" ? "video.mp4" : "file");
    const path = `anon/${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
    toast.message(kind === "video" ? "Mengunggah video…" : "Mengunggah file…");
    const { error: upErr } = await supabase.storage.from("anon-chat-media").upload(path, file, { contentType: file.type || undefined });
    if (upErr) { toast.error("Gagal upload: " + upErr.message); return; }
    const { data: u } = supabase.storage.from("anon-chat-media").getPublicUrl(path);
    const payload: any = {
      session_id: sessionId,
      sender_visitor_id: visitor,
      media_url: u.publicUrl,
      media_type: kind,
      media_name: file.name,
      media_size: file.size,
    };
    if (replyTo) payload.reply_to_id = replyTo.id;
    setReplyTo(null);
    const { error } = await supabase.from("anon_chat_messages").insert(payload);
    if (error) toast.error(error.message);
  };

  const markViewOnceSeen = async (m: AnonMsg) => {
    if (m.sender === visitor || m.viewed_at) return;
    const now = new Date().toISOString();
    setMessages(prev => prev.map(x => x.id === m.id ? { ...x, viewed_at: now } : x));
    await supabase.from("anon_chat_messages").update({ viewed_at: now } as any).eq("id", m.id);
  };

  const openViewOncePhoto = (m: AnonMsg, url: string) => {
    if (m.sender === visitor || m.viewed_at) return;
    setViewOnceViewer({ id: m.id, url, revealed: false, shielded: true });
    window.setTimeout(() => setViewOnceViewer(prev => prev?.id === m.id ? { ...prev, revealed: true, shielded: false } : prev), 220);
    void markViewOnceSeen(m);
  };

  const emergencyCloseViewOnce = useCallback(() => {
    if (viewOnceCloseTimerRef.current) window.clearTimeout(viewOnceCloseTimerRef.current);
    const img = viewOnceImageRef.current;
    const shield = viewOnceShieldRef.current;
    if (img) {
      img.removeAttribute("src");
      img.style.visibility = "hidden";
      img.style.opacity = "0";
      img.style.filter = "blur(80px) brightness(0)";
    }
    if (shield) {
      shield.style.opacity = "1";
      shield.style.pointerEvents = "auto";
    }
    setViewOnceViewer(prev => prev ? { ...prev, revealed: false, shielded: true } : prev);
    viewOnceCloseTimerRef.current = window.setTimeout(() => setViewOnceViewer(null), 80);
  }, []);

  // Auto-hide view-once photo on focus/visibility/input changes (web best-effort anti-screenshot)
  useEffect(() => {
    if (!viewOnceViewer) return;
    const close = () => emergencyCloseViewOnce();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || (e.shiftKey && (e.metaKey || e.ctrlKey)) || (e.metaKey && /^[0-9]$/.test(e.key))) {
        e.preventDefault();
        try { navigator.clipboard.writeText(""); } catch {}
        close();
      }
    };
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") close();
    };
    const onVis = () => { if (document.visibilityState !== "visible") close(); };
    window.addEventListener("blur", close);
    window.addEventListener("pagehide", close);
    window.addEventListener("keyup", onKey);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("orientationchange", close);
    document.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", close);
      window.removeEventListener("pagehide", close);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("orientationchange", close);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
      if (viewOnceCloseTimerRef.current) { window.clearTimeout(viewOnceCloseTimerRef.current); viewOnceCloseTimerRef.current = null; }
    };
  }, [emergencyCloseViewOnce, viewOnceViewer]);


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
      <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px] rounded-3xl overflow-hidden border border-purple-500/20 bg-[#0c0820] shadow-[0_20px_60px_-20px_rgba(168,85,247,0.4)]">
        {/* Top bar: back · anon.chat · menu */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center px-3 py-2.5 bg-[#0c0820] border-b border-purple-500/15">
          <button onClick={backFromChat} className="w-9 h-9 rounded-full hover:bg-white/5 text-slate-200 flex items-center justify-center" title="Kembali">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center text-[15px] font-extrabold text-white tracking-tight">
            anon<span className="bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-clip-text text-transparent">.chat</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full hover:bg-white/5 text-slate-200 flex items-center justify-center" title="Menu">
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-slate-950 border-slate-800 text-slate-100">
              {friendStatusForPartner !== "friend" && (
                <DropdownMenuItem onClick={newPartner}>Partner baru</DropdownMenuItem>
              )}
              {(() => {
                const isFriend = friendStatusForPartner === "friend";
                const callBlocked = partnerWhoCanCall === "none" || (partnerWhoCanCall === "friends" && !isFriend);
                const label = callState !== "idle"
                  ? "Panggilan aktif"
                  : partnerWhoCanCall === "none"
                    ? "Pengguna tidak dapat call"
                    : (partnerWhoCanCall === "friends" && !isFriend)
                      ? "Hanya teman yang bisa call"
                      : "Mulai voice call";
                return (
                  <DropdownMenuItem onClick={startVoiceCall} disabled={callState !== "idle" || callBlocked}>
                    {label}
                  </DropdownMenuItem>
                );
              })()}
              {friendStatusForPartner !== "friend" ? (
                <DropdownMenuItem onClick={endChat} className="text-rose-300">Akhiri chat</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => { const pv = partnerVisitorRef.current; if (pv) { removeFriend(pv); endChat(); } }} className="text-rose-300">Hapus pertemanan</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Partner row */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-purple-500/10 bg-[#0c0820]">
          <div className="relative shrink-0">
            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${partnerAvatar.gradient} flex items-center justify-center text-xl shadow-lg shadow-purple-500/30 overflow-hidden ring-2 ${partnerOnline ? "ring-emerald-400/70" : "ring-transparent"}`}>
              {partnerProfile?.avatar_url ? <img src={partnerProfile.avatar_url} alt="Avatar partner" className="h-full w-full object-cover" /> : <AvatarGraphic preset={partnerAvatar} />}
            </div>
            {partnerOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0c0820] animate-pulse" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-50 truncate text-[15px] leading-tight">{partner?.nick}</div>
            {partnerShowLastSeen ? (
              <div className="text-[11px] text-slate-300/80 flex items-center gap-1.5 mt-0.5 truncate">
                {partnerOnline ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> <span className="text-emerald-300/90 font-medium">online</span></>
                ) : sessionStatus === "active" ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" /> <span className="truncate">{partnerLastSeen}</span></>
                ) : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Sesi berakhir</>
                )}
              </div>
            ) : sessionStatus !== "active" ? (
              <div className="text-[11px] text-slate-300/80 flex items-center gap-1.5 mt-0.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Sesi berakhir
              </div>
            ) : null}
          </div>
          {sessionStatus === "active" && (
            friendStatusForPartner === "friend" ? (
              <span className="px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-200 text-[11px] font-semibold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Teman
              </span>
            ) : friendStatusForPartner === "pending_out" ? (
              <span className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-200/80 text-[11px] font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Terkirim
              </span>
            ) : friendStatusForPartner === "pending_in" ? (
              <button onClick={async () => {
                const { data: sess } = await supabase.from("anon_chat_sessions").select("visitor_a, visitor_b").eq("id", sessionId!).maybeSingle();
                if (!sess) return;
                const other = sess.visitor_a === visitor ? sess.visitor_b : sess.visitor_a;
                const { data: req } = await supabase.from("anon_chat_friend_requests").select("id").eq("from_visitor", other).eq("to_visitor", visitor).eq("status", "pending").maybeSingle();
                if (req) await respondFriendRequest(req.id, true);
              }} className="px-3 py-1.5 rounded-full bg-purple-500 hover:bg-purple-400 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-lg shadow-purple-500/40">
                <UserCheck className="w-3.5 h-3.5" /> Terima
              </button>
            ) : (
              <button onClick={sendFriendRequest} className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-400 hover:to-violet-400 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-lg shadow-purple-500/40">
                <UserPlus className="w-3.5 h-3.5" /> Tambah Teman
              </button>
            )
          )}
        </div>
        {partnerBio && partnerBio.trim() && (
          <button
            type="button"
            onClick={() => setShowPartnerBio(v => !v)}
            className="w-full text-left px-3 py-1.5 border-b border-purple-400/10 bg-slate-950/40 hover:bg-slate-900/60 transition flex items-start gap-2"
            title={showPartnerBio ? "Sembunyikan deskripsi" : "Lihat deskripsi partner"}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300/70 mt-0.5 shrink-0">Bio</span>
            <span className={`text-xs text-slate-200 italic flex-1 ${showPartnerBio ? "" : "line-clamp-1"}`}>
              "{partnerBio}"
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-purple-300/60 shrink-0 mt-0.5 transition-transform ${showPartnerBio ? "rotate-90" : ""}`} />
          </button>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="text-center text-xs text-purple-300/50 py-2">— Awal obrolan anonim —</div>
          {callState !== "idle" && (
            <div className="my-2 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600/30 to-violet-600/30 border border-purple-400/30 flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full bg-purple-500/30 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-purple-100" />
                {(callState === "outgoing" || callState === "incoming") && (
                  <span className="absolute inset-0 rounded-full border-2 border-purple-300/60 animate-ping" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[12px] font-bold text-white truncate">
                  {callState === "outgoing" && "Memanggil..."}
                  {callState === "incoming" && `${partner?.nick || "Partner"} memanggil`}
                  {callState === "connected" && (callMuted ? "Mic dimatikan" : "Tersambung")}
                </div>
                <div className="text-[10px] text-purple-200/80 tabular-nums">
                  {callState === "connected" ? fmtCallTime(callSeconds) : "Voice call · WebRTC"}
                </div>
              </div>
              {callState === "incoming" && (
                <>
                  <button onClick={acceptVoiceCall} className="h-9 px-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-[12px] font-bold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Terima
                  </button>
                  <button onClick={declineVoiceCall} className="h-9 px-3 rounded-full bg-rose-500 hover:bg-rose-400 text-white text-[12px] font-bold flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5" /> Tolak
                  </button>
                </>
              )}
              {callState === "connected" && (
                <button onClick={toggleCallMute} className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" title={callMuted ? "Aktifkan mic" : "Matikan mic"}>
                  {callMuted ? <VolumeX className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <button onClick={() => cleanupCall(true)} className="h-9 w-9 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center" title="Akhiri panggilan">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          {photoPreview && (() => {
            const closePreview = () => {
              try { URL.revokeObjectURL(photoPreview.url); } catch { /* ignore */ }
              setPhotoPreview(null);
            };
            return (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={closePreview}>
              <div className="bg-slate-950 border border-purple-400/30 rounded-2xl p-3 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100">Kirim Foto</span>
                  <button onClick={closePreview} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
                </div>
                <img src={photoPreview.url} alt="" className="w-full max-h-[50vh] object-contain rounded-xl bg-black" />
                <input value={photoPreview.caption} onChange={e => setPhotoPreview(p => p ? { ...p, caption: e.target.value.slice(0, 500) } : p)} placeholder="Tambahkan teks (opsional)..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100" maxLength={500} />
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                  <input type="checkbox" checked={photoPreview.viewOnce} onChange={e => setPhotoPreview(p => p ? { ...p, viewOnce: e.target.checked } : p)} />
                  <Eye className="w-3.5 h-3.5 text-amber-300" /> Sekali lihat (foto hilang setelah dibuka)
                </label>
                <button onClick={sendPhoto} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Kirim</button>
              </div>
            </div>
            );
          })()}
          {viewOnceViewer && (
            <div
              className="fixed inset-0 z-[9999] bg-black flex flex-col"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={() => setViewOnceViewer(prev => prev ? { ...prev, shielded: true } : prev)}
              onPointerUp={() => setViewOnceViewer(prev => prev ? { ...prev, shielded: false } : prev)}
              onPointerCancel={emergencyCloseViewOnce}
              onTouchStart={() => setViewOnceViewer(prev => prev ? { ...prev, shielded: true } : prev)}
              onTouchEnd={() => setViewOnceViewer(prev => prev ? { ...prev, shielded: false } : prev)}
              style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="h-14 px-3 flex items-center justify-between text-white bg-black/90 shrink-0">
                <button
                  onClick={emergencyCloseViewOnce}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition"
                  aria-label="Tutup foto sekali lihat"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
                  <Eye className="w-4 h-4" /> Foto sekali lihat
                </div>
                <div className="w-10" />
              </div>
              <div
                className="relative flex-1 min-h-0 flex items-center justify-center bg-black select-none overflow-hidden"
                style={{ WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}
              >
                <div
                  ref={viewOnceShieldRef}
                  className={`absolute inset-0 z-10 bg-black transition-opacity duration-75 ${viewOnceViewer.shielded || !viewOnceViewer.revealed ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                />
                <img
                  ref={viewOnceImageRef}
                  src={viewOnceViewer.url}
                  alt="Foto sekali lihat"
                  className={`max-w-full max-h-full object-contain select-none pointer-events-none transition-[opacity,filter] duration-75 ${viewOnceViewer.revealed && !viewOnceViewer.shielded ? "opacity-100 blur-0" : "opacity-0 blur-3xl"}`}
                  draggable={false}
                  style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
                />
              </div>
              <div className="px-4 py-3 text-center text-[11px] text-white/70 bg-black/90 shrink-0">
                Screenshot dilarang. Foto akan tertutup otomatis jika layar berpindah.
              </div>
            </div>
          )}
          {messages.map((m, idx) => {
            if ((m.deleted_for || []).includes(visitor)) return null;
            const mine = m.sender === visitor;
            const replied = m.reply_to_id ? messagesById[m.reply_to_id] : null;
            const rx = reactionsByMsg[m.id];
            const prev = messages[idx - 1];
            const showDate = !prev || dateLabel(prev.created_at) !== dateLabel(m.created_at);
            const grouped = prev && prev.sender === m.sender && !showDate &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
            // Bubble panggilan gaya WhatsApp (mengikuti sisi mine/partner)
            if (m.media_type === "call" && !m.is_deleted) {
              let info: { status?: string; duration?: number } = {};
              try { info = JSON.parse(m.content || "{}"); } catch {}
              const status = info.status || "ended";
              const dur = Number(info.duration || 0);
              const isMissed = status === "missed" || status === "cancelled" || status === "declined";
              const subtitle = (status === "answered" || status === "ended")
                ? (dur > 0 ? `${Math.floor(dur/60)}:${String(dur%60).padStart(2,"0")}` : "Selesai")
                : (mine
                    ? (status === "declined" ? "Ditolak" : status === "cancelled" ? "Dibatalkan" : "Tidak dijawab")
                    : "Tidak terjawab");
              return (
                <div key={m.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-purple-400/20 bg-slate-900/60 text-purple-200/80">
                        {dateLabel(m.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"} mt-1.5 animate-fade-in`}>
                    <div className={`relative px-3 py-2.5 rounded-2xl shadow-md flex items-center gap-3 min-w-[220px] max-w-[78%] ${
                      mine
                        ? "bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-br-sm"
                        : "bg-slate-800/90 text-slate-100 border border-slate-700/50 rounded-bl-sm"
                    }`}>
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${mine ? "bg-white/15" : "bg-slate-700/70"}`}>
                        <PhoneCall className={`w-5 h-5 ${isMissed ? "text-rose-300" : (mine ? "text-white" : "text-emerald-300")}`} />
                      </span>
                      <div className="leading-tight flex-1 min-w-0">
                        <p className="font-bold text-[14px]">Telepon suara</p>
                        <p className={`text-[12px] ${isMissed ? (mine ? "text-rose-100" : "text-rose-300") : (mine ? "text-white/80" : "text-slate-400")}`}>
                          {subtitle}
                        </p>
                      </div>
                      <span className={`text-[10px] self-end shrink-0 ${mine ? "text-white/70" : "text-slate-400"}`}>
                        {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-purple-400/20 bg-slate-900/60 text-purple-200/80">
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
                          ? `bg-gradient-to-br from-purple-500 to-violet-600 text-white ${grouped ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"}`
                          : `bg-slate-800/90 text-slate-100 border border-slate-700/50 ${grouped ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-sm"}`
                      } ${m.is_deleted ? "italic opacity-70" : ""}`}
                    >
                      {replied && !m.is_deleted && (
                        <div className={`mb-1 border-l-2 pl-2 py-1 rounded text-[11px] ${mine ? "border-white/50 bg-white/10" : "border-purple-400/60 bg-slate-900/60"}`}>
                          <p className="font-semibold opacity-80">{replied.sender === visitor ? "Kamu" : partner?.nick || "Partner"}</p>
                          <p className="truncate opacity-80">{replied.is_deleted ? "Pesan dihapus" : (replied.content || (replied.image_url ? "📷 Foto" : ""))}</p>
                        </div>
                      )}
                      {m.is_deleted ? (
                        <p className="flex items-center gap-1"><Trash2 className="w-3 h-3" /> Pesan ini dihapus</p>
                      ) : (
                        <>
                          {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                          {m.media_type === "audio" && m.media_url && (
                            <div className="mt-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/30">
                              <audio controls src={m.media_url} className="w-full max-w-[220px] h-8" />
                              {m.audio_duration ? <span className="text-[10px] opacity-70">{Math.floor(m.audio_duration/60)}:{String(m.audio_duration%60).padStart(2,"0")}</span> : null}
                            </div>
                          )}
                          {m.media_type === "video" && m.media_url && (
                            <div className="mt-1 rounded-lg overflow-hidden bg-black/40 max-w-[260px]">
                              <video controls src={m.media_url} className="w-full max-h-[320px]" />
                            </div>
                          )}
                          {m.media_type === "file" && m.media_url && (
                            <a href={m.media_url} target="_blank" rel="noopener noreferrer" download={m.media_name || true}
                              className={`mt-1 flex items-center gap-2 px-3 py-2 rounded-lg ${mine ? "bg-white/15 hover:bg-white/20" : "bg-slate-700/60 hover:bg-slate-700"} transition min-w-[200px] max-w-[260px]`}>
                              <span className="w-9 h-9 rounded-lg bg-black/30 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[12px] font-semibold truncate">{m.media_name || "File"}</span>
                                <span className="block text-[10px] opacity-70">{m.media_size ? `${(m.media_size/1024).toFixed(m.media_size > 1024*1024 ? 1 : 0)} ${m.media_size > 1024*1024 ? "MB" : "KB"}` : "Unduh"}</span>
                              </span>
                              <Download className="w-4 h-4 shrink-0 opacity-80" />
                            </a>
                          )}
                          {((m.media_type === "image" && m.media_url) || m.image_url) && (() => {
                            const url = m.media_url || m.image_url!;
                            const isViewOnce = !!m.view_once;
                            const alreadyViewed = isViewOnce && !!m.viewed_at;
                            const revealed = mine || revealedImgs.has(m.id);
                            if (isViewOnce && mine) {
                              return (
                                <div className="mt-1 min-w-[180px] px-3 py-2.5 rounded-lg bg-black/25 text-[12px] flex items-center gap-2">
                                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0"><Eye className="w-4 h-4" /></div>
                                  <div className="min-w-0">
                                    <p className="font-semibold leading-tight">Foto sekali lihat</p>
                                    <p className="text-[10px] opacity-75">Terkirim · tidak tampil di chat</p>
                                  </div>
                                </div>
                              );
                            }
                            if (alreadyViewed) {
                              return (
                                <div className="mt-1 min-w-[180px] px-3 py-2.5 rounded-lg bg-slate-700/60 text-[12px] flex items-center gap-2">
                                  <div className="w-9 h-9 rounded-full bg-slate-600/80 flex items-center justify-center shrink-0"><EyeOff className="w-4 h-4" /></div>
                                  <div className="min-w-0">
                                    <p className="font-semibold leading-tight">Dibuka</p>
                                    <p className="text-[10px] opacity-75">Foto sekali lihat sudah hilang</p>
                                  </div>
                                </div>
                              );
                            }
                            if (isViewOnce) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => openViewOncePhoto(m, url)}
                                  className="mt-1 min-w-[190px] px-3 py-2.5 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-left flex items-center gap-2 transition"
                                >
                                  <div className="w-10 h-10 rounded-full border border-amber-300/50 bg-amber-400/15 text-amber-200 flex items-center justify-center shrink-0"><Eye className="w-5 h-5" /></div>
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold leading-tight">Foto sekali lihat</p>
                                    <p className="text-[10px] opacity-75">Ketuk untuk membuka</p>
                                  </div>
                                </button>
                              );
                            }
                            return (
                              <div className="relative mt-1 rounded-lg overflow-hidden">
                                <img src={url} alt="" className={`max-w-full rounded-lg transition ${revealed ? "" : "blur-2xl scale-105"}`} />
                                {!revealed && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                                    <div className="text-[10px] text-white/90 px-2 py-1 rounded-full bg-amber-500/80 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Foto disensor</div>
                                    <button onClick={() => { setRevealedImgs(prev => { const n = new Set(prev); n.add(m.id); return n; }); }} className="px-3 py-1.5 rounded-full bg-white/95 text-slate-900 text-xs font-bold flex items-center gap-1">
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
                          {m.caption && <p className="mt-1 whitespace-pre-wrap break-words text-[13px] opacity-95">{m.caption}</p>}
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
                          <span className="ml-0.5" title={m.read_at ? "Dibaca" : m.delivered_at ? "Sampai" : "Terkirim"}>
                            {m.read_at
                              ? <CheckCheck className="w-3 h-3 text-sky-300" />
                              : m.delivered_at
                                ? <CheckCheck className="w-3 h-3 text-white/70" />
                                : <Check className="w-3 h-3 text-white/70" />}
                          </span>
                        )}
                      </div>
                    </div>

                    {rx && Object.keys(rx).length > 0 && !m.is_deleted && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                        {Object.entries(rx).map(([emo, { count, mine: isMine }]) => (
                          <button key={emo} onClick={() => toggleReaction(m, emo)}
                            className={`text-[11px] px-1.5 py-0.5 rounded-full border bg-slate-900/80 flex items-center gap-0.5 ${isMine ? "border-purple-400" : "border-slate-700"}`}>
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
                <span className="w-1.5 h-1.5 rounded-full bg-purple-300/80 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-300/80 animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-300/80 animate-bounce" style={{ animationDelay: "240ms" }} />
              </div>
            </div>
          )}
          {sessionStatus === "ended" && (
            <div className="text-center text-xs text-rose-300/80 mt-4 py-2 bg-rose-500/10 rounded-xl">Chat sudah berakhir</div>
          )}
        </div>

        {/* Input */}
        <div className="p-2.5 border-t border-purple-400/20 bg-slate-950/80 space-y-2">
          {activeBan && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-300 mt-0.5" />
              <span>Akun diblokir dari chat: {banInfo?.reason} · {formatBanRemaining(banInfo)}</span>
            </div>
          )}
          {replyTo && (
            <div className="flex items-start gap-2 rounded-lg border border-purple-400/30 bg-slate-900/70 px-2.5 py-2 text-[11px] animate-fade-in">
              <Reply className="w-3.5 h-3.5 text-purple-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-purple-200">
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
            <div className="grid grid-cols-8 gap-1 rounded-2xl border border-purple-400/20 bg-slate-900/80 p-2 animate-fade-in">
              {[...EMOJIS, "😍", "🤣", "😭", "😎", "🤝", "💯", "🎉", "🤔", "😡", "😴", "✨", "🙌", "😇", "😜", "👌", "💬"].map((e) => (
                <button key={e} onClick={() => setDraft((d) => d + e)} className="h-8 rounded-lg hover:bg-slate-800 text-lg">{e}</button>
              ))}
            </div>
          )}
          {sessionStatus === "active" && !activeBan ? (
            recording ? (
              <div className="flex items-center gap-2">
                <button onClick={() => stopRecording(true)} className="w-11 h-11 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 flex items-center justify-center" title="Batal">
                  <X className="w-5 h-5" />
                </button>
                <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-500/10 border border-rose-400/30">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  <span className="text-sm font-bold text-rose-100">Merekam…</span>
                  <span className="ml-auto text-sm font-mono text-rose-100 tabular-nums">{fmtCallTime(recordSecs)}</span>
                </div>
                <button onClick={() => stopRecording(false)} className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/40 shrink-0" title="Kirim">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="w-9 h-9 rounded-full bg-slate-900/70 border border-purple-400/20 flex items-center justify-center cursor-pointer shrink-0 hover:bg-slate-800/70 transition" title="Kirim foto">
                  <ImagePlus className="w-[16px] h-[16px] text-purple-300" />
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) openPhotoPreview(e.target.files[0]); e.target.value = ""; }} />
                </label>
                <label className="w-9 h-9 rounded-full bg-slate-900/70 border border-purple-400/20 flex items-center justify-center cursor-pointer shrink-0 hover:bg-slate-800/70 transition" title="Kirim video / file">
                  <Paperclip className="w-[16px] h-[16px] text-purple-300" />
                  <input type="file" accept="video/*,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) sendAnyFile(f, f.type.startsWith("video/") ? "video" : "file");
                      e.target.value = "";
                    }} />
                </label>
                <div className="flex-1 relative">
                  <input
                    value={draft}
                    onChange={e => onChangeDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                    onBlur={() => pushTyping(false)}
                    placeholder="Ketik pesan..."
                    className="w-full bg-slate-900/70 border border-purple-400/20 rounded-full pl-4 pr-11 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-400/60"
                    maxLength={1000}
                  />
                  <button onClick={() => setShowEmojiInput(v => !v)} type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-slate-800 text-purple-300 flex items-center justify-center" title="Emoji">
                    <Smile className="w-[18px] h-[18px]" />
                  </button>
                </div>
                {draft.trim() ? (
                  <button onClick={sendMessage}
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/40 shrink-0" title="Kirim">
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={startRecording}
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/40 shrink-0" title="Rekam suara">
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          ) : sessionStatus === "ended" ? (
            <button onClick={newPartner} className="w-full py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/40">
              <RefreshCw className="w-4 h-4" /> Cari Partner Baru
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (view === "callhistory") {
    const fmtDur = (s: number) => s > 0 ? `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}` : "—";
    const statusLabel: Record<string, string> = { answered: "Terjawab", missed: "Tak terjawab", declined: "Ditolak", cancelled: "Dibatalkan", ended: "Selesai" };
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-slate-950 min-h-[500px] flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b border-slate-800">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Kembali</button>
          <div className="flex-1 text-center font-bold text-slate-100">Riwayat Panggilan</div>
          <button onClick={loadCallLogs} className="text-purple-300"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {callLogs.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-10">Belum ada panggilan.</div>
          ) : callLogs.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-purple-400/20">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${c.status === "answered" || c.status === "ended" ? "bg-emerald-500/20 text-emerald-300" : c.status === "missed" ? "bg-rose-500/20 text-rose-300" : "bg-slate-700 text-slate-300"}`}>
                <Phone className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100 truncate text-sm">{c.partner_nickname || "Stranger"}</div>
                <div className="text-[10px] text-slate-400">
                  {c.direction === "outgoing" ? "↗ Keluar" : "↙ Masuk"} · {statusLabel[c.status] || c.status} · {fmtDur(c.duration_seconds)}
                </div>
                <div className="text-[10px] text-slate-500">{new Date(c.started_at).toLocaleString("id-ID")}</div>
              </div>
              <button onClick={() => deleteCallLog(c.id)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "history") {
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-slate-950 min-h-[500px] flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b border-slate-800">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Kembali</button>
          <div className="flex-1 text-center font-bold text-slate-100">Riwayat Match</div>
          <button onClick={loadMatchHistory} className="text-purple-300"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <p className="text-[11px] text-slate-400 italic px-4 py-2 border-b border-slate-800/50">Hapus partner agar tidak dipertemukan lagi saat cari acak. Tetap bisa ditemui jika sudah berteman.</p>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {matchHistory.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-10">Belum ada riwayat match.</div>
          ) : matchHistory.map(h => (
            <div key={h.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-purple-400/20">
              <div className="w-9 h-9 rounded-full bg-purple-500/30 flex items-center justify-center text-lg shrink-0">🥷</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100 truncate text-sm">{h.partner_nickname || "Stranger"}</div>
                <div className="text-[10px] text-slate-400">{new Date(h.last_session_at).toLocaleString("id-ID")}</div>
              </div>
              <button onClick={() => blockMatchPartner(h.partner_visitor)} className="px-3 h-8 rounded-full bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 text-[11px] font-bold flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Hapus
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "interest") {
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-slate-950 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-slate-800">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm font-semibold flex items-center gap-1">
            <ChevronRight className="w-4 h-4 rotate-180" /> Kembali
          </button>
          <div className="flex-1 text-center font-bold text-slate-100">Ketertarikan</div>
          <div className="w-16" />
        </div>
        <p className="text-xs text-slate-400 p-4 pb-2">Kami akan mempertemukanmu dengan partner yang ingin membahas topik yang sama.</p>
        <div className="max-h-[50vh] overflow-y-auto">
          {INTERESTS.map(it => (
            <button key={it} onClick={() => { setInterest(it); setView("prefs"); }}
              className={`w-full text-left px-5 py-3.5 border-b border-slate-800/60 flex items-center justify-between hover:bg-slate-900 ${interest === it ? "text-purple-300" : "text-slate-200"}`}>
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
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 p-5 space-y-5 max-h-[calc(100vh-160px)] overflow-y-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Pengaturan akun</div>
          <div className="w-12" />
        </div>

        {/* Identitas akun */}
        <div className="rounded-2xl border border-purple-400/20 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">ID akun perangkat</span>
            <button onClick={() => { try { navigator.clipboard.writeText(visitor); toast.success("ID disalin"); } catch {} }}
              className="text-[11px] font-mono px-2 py-1 rounded-md bg-slate-800 text-purple-200 flex items-center gap-1 border border-slate-700">
              {shortId(visitor)} <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Status</span>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/40">Mandiri (khusus Anon Chat)</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">Nama tampil</span>
            <span className="text-xs text-slate-100 font-semibold truncate max-w-[60%] text-right">{nickname}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-purple-300 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-bold text-purple-100">Akun Anon Chat (mandiri)</div>
              <p className="text-[11px] text-purple-200/80 mt-0.5">Daftar email + sandi khusus Anon Chat. Tidak terhubung ke akun saldo.</p>
            </div>
          </div>
          {anonAccount ? (
            <div className="rounded-xl bg-slate-900/70 border border-purple-400/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-purple-300/70 uppercase tracking-wide">Email terhubung</div>
                  <div className="text-xs font-bold text-slate-100 truncate">{anonAccount.email}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/40 shrink-0">Login</span>
              </div>
              <div className="rounded-lg bg-slate-950/60 border border-slate-700 p-2">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Deskripsi profil</div>
                <div className="text-[11px] text-slate-200 italic break-words">
                  {anonAccount.bio?.trim() ? anonAccount.bio : "Belum ada deskripsi — ceritakan dirimu singkat."}
                </div>
              </div>
              <button onClick={() => setShowAccountDialog(true)} className="w-full py-2 rounded-lg bg-purple-500/30 hover:bg-purple-500/40 border border-purple-400/50 text-purple-100 text-xs font-bold">
                {anonAccount.bio?.trim() ? "Ubah Deskripsi" : "Buat Deskripsi"}
              </button>
              <button onClick={() => setShowAccountDialog(true)} className="w-full py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-100 text-xs font-bold">
                Kelola akun (ganti email / sandi / putuskan)
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAccountDialog(true)} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white text-xs font-bold">
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
              <button onClick={() => setNickname(genNick())} className="px-3 rounded-xl bg-purple-500/20 text-purple-200 text-xs font-semibold border border-purple-400/30">
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-purple-400/20 bg-slate-900/60 p-3">
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
            <button onClick={() => setShowLastSeen(v => !v)} className={`w-12 h-7 rounded-full p-0.5 transition ${showLastSeen ? "bg-purple-500" : "bg-slate-700"}`}>
              <div className={`w-6 h-6 rounded-full bg-white transition ${showLastSeen ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-2 block">Gender saya</label>
            <div className="grid grid-cols-3 gap-2">
              {[{v:"male",l:"🧑 Pria"},{v:"female",l:"👩 Wanita"},{v:"any",l:"🥷 Anonim"}].map(o => (
                <button key={o.v} onClick={() => setMyGender(o.v)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border ${myGender === o.v ? "bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/30" : "bg-slate-900 text-slate-300 border-slate-700"}`}>
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
              <ChevronRight className="w-4 h-4 text-purple-400" />
            </button>
          </div>
        </div>

        <button onClick={() => { setView("prefs"); toast.success("Tersimpan"); }}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-500 text-white font-bold shadow-lg shadow-purple-500/40">
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
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Dukungan</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-2xl border border-purple-400/30 bg-purple-500/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Phone className="w-5 h-5 text-purple-300 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-purple-100">Customer Service WhatsApp</div>
                <div className="text-xs text-purple-200/80">Respon cepat 08.00 – 22.00 WIB</div>
                <div className="font-mono text-purple-300 text-sm mt-0.5">{CS_WA}</div>
              </div>
            </div>
            <a href={CS_WA_LINK} target="_blank" rel="noreferrer"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/40">
              <MessageCircle className="w-4 h-4" /> Chat CS via WhatsApp
            </a>
          </div>

          <div>
            <h4 className="text-xs font-bold text-purple-300 mb-2 px-1">Pertanyaan umum</h4>
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
        <InnerNav active="account" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "notif") {
    const perm = typeof Notification !== "undefined" ? Notification.permission : "default";
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Notifikasi & Suara</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3">
            {soundOn ? <Volume2 className="w-5 h-5 text-purple-300" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-100">Suara pesan masuk</div>
              <div className="text-[11px] text-slate-400">Bunyikan ping saat pesan baru di chat anonim</div>
            </div>
            <button onClick={() => { setSoundOn(s => !s); if (!soundOn) playPing(); }}
              className={`w-12 h-7 rounded-full p-0.5 transition ${soundOn ? "bg-purple-500" : "bg-slate-700"}`}>
              <div className={`w-6 h-6 rounded-full bg-white transition ${soundOn ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3">
            <Bell className={`w-5 h-5 ${notifOn ? "text-purple-300" : "text-slate-400"}`} />
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-100">Notifikasi anon chat</div>
              <div className="text-[11px] text-slate-400">Tampilkan notifikasi browser saat tab tidak aktif</div>
              <div className="text-[10px] mt-0.5">
                Status izin: <span className={perm === "granted" ? "text-purple-300" : perm === "denied" ? "text-rose-300" : "text-amber-300"}>{perm}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{explainNotif()}</div>
            </div>
            <button onClick={() => { if (perm !== "granted") requestNotifPerm(); else setNotifOn(n => !n); }}
              className={`w-12 h-7 rounded-full p-0.5 transition ${notifOn && perm === "granted" ? "bg-purple-500" : "bg-slate-700"}`}>
              <div className={`w-6 h-6 rounded-full bg-white transition ${notifOn && perm === "granted" ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-3 text-[11px] text-amber-100/90 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
            <span>Notifikasi & suara hanya untuk percakapan anon chat. Pengaturan ini tersimpan di perangkat ini.</span>
          </div>
        </div>
        <InnerNav active="account" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "appearance") {
    const opts: Array<{ key: typeof theme; label: string }> = [
      { key: "dark", label: "Tema gelap" },
      { key: "light", label: "Tema terang" },
      { key: "system", label: "Tema tampilan perangkat" },
    ];
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Tampilan</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
            {opts.map(o => (
              <button key={o.key} onClick={() => { setTheme(o.key); toast.success(o.label + " diterapkan"); }}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-800/40">
                <Check className={`w-5 h-5 ${theme === o.key ? "text-purple-400" : "text-transparent"}`} />
                <span className="text-slate-100 text-sm">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
        <InnerNav active="account" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "chatopts") {
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Opsi Obrolan</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold"><Key className="w-4 h-4" /> Konfirmasi Ganda</div>
            <p className="text-[11px] text-slate-400">Aplikasi akan meminta konfirmasi sebelum menutup obrolan sementara</p>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3">
              <div className="flex-1 text-sm text-slate-100">Meminta konfirmasi</div>
              <button onClick={() => setConfirmClose(v => !v)}
                className={`w-12 h-7 rounded-full p-0.5 transition ${confirmClose ? "bg-purple-500" : "bg-slate-700"}`}>
                <div className={`w-6 h-6 rounded-full bg-white transition ${confirmClose ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold"><Keyboard className="w-4 h-4" /> Pilihan Keyboard</div>
            <p className="text-[11px] text-slate-400">Pilih apa yang akan ditampilkan di awal obrolan: tampilkan tombol interaksi obrolan atau buka keyboard ketik</p>
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
              {[{k:"keyboard",label:"Buka keyboard"},{k:"button",label:"Tampilkan tombol"}].map(o => (
                <button key={o.k} onClick={() => setKeyboardMode(o.k as "button" | "keyboard")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/40">
                  <Check className={`w-5 h-5 ${keyboardMode === o.k ? "text-purple-400" : "text-transparent"}`} />
                  <span className="text-slate-100 text-sm">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <InnerNav active="account" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "language") {
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Bahasa</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-[11px] text-slate-400 px-1">Kamu hanya akan dicocokkan dengan pengguna yang bahasanya sama</p>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => { setLang(l.code); toast.success(l.name); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/40">
                <Check className={`w-5 h-5 shrink-0 ${lang === l.code ? "text-purple-400" : "text-transparent"}`} />
                <span className="text-base">{l.flag}</span>
                <span className="text-slate-100 text-sm flex-1 truncate">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
        <InnerNav active="account" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "privacy") {
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Privasi</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold"><UserCheck className="w-4 h-4" /> Status online</div>
            <p className="text-[11px] text-slate-400">Jika status online disembunyikan, kamu tidak bisa melihat status online pengguna lain</p>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3">
              <div className="flex-1 text-sm text-slate-100">Tampilkan status online saya</div>
              <button onClick={() => setOnlineStatus(v => !v)}
                className={`w-12 h-7 rounded-full p-0.5 transition ${onlineStatus ? "bg-purple-500" : "bg-slate-700"}`}>
                <div className={`w-6 h-6 rounded-full bg-white transition ${onlineStatus ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold"><EyeOff className="w-4 h-4" /> Media kabur</div>
            <p className="text-[11px] text-slate-400">Gambar dan video yang masuk akan dibuat kabur. Anda masih bisa melihat yang aslinya dengan mengetuknya</p>
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
              {[{k:"off",label:"Nonaktifkan"},{k:"temp",label:"Aktifkan di chat sementara"},{k:"all",label:"Aktifkan di semua chat"}].map(o => (
                <button key={o.k} onClick={() => setMediaBlur(o.k as "off" | "temp" | "all")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/40">
                  <Check className={`w-5 h-5 ${mediaBlur === o.k ? "text-purple-400" : "text-transparent"}`} />
                  <span className="text-slate-100 text-sm">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold"><PhoneCall className="w-4 h-4" /> Siapa yang dapat menelepon saya</div>
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
              {[{k:"all",label:"Semua"},{k:"friends",label:"Teman"},{k:"none",label:"Tak seorang pun"}].map(o => (
                <button key={o.k} onClick={() => setWhoCanCall(o.k as "all" | "friends" | "none")}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/40">
                  <Check className={`w-5 h-5 ${whoCanCall === o.k ? "text-purple-400" : "text-transparent"}`} />
                  <span className="text-slate-100 text-sm">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <InnerNav active="account" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  const APP_VERSION = "v5.35.0";
  const aboutBack = (target: View = "about") => (
    <InnerNav active="account" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
  );

  if (view === "about") {
    const items = [
      { icon: Archive, label: "Pulihkan langganan", onClick: async () => {
        try {
          const acc = await fetchAnonAccount(visitor);
          if (acc) { setAnonAccount(acc); toast.success("Akun dipulihkan"); }
          else toast.info("Tidak ada langganan aktif");
        } catch { toast.error("Gagal memulihkan"); }
      } },
      { icon: HardDrive, label: "Privasi data", onClick: () => setView("about_privacy") },
      { icon: ClipboardList, label: "Aturan", onClick: () => setView("about_rules") },
      { icon: BookOpen, label: "Tutorial", onClick: () => { setTutorialStep(0); setView("about_tutorial"); } },
      { icon: Smartphone, label: "Informasi Sistem", onClick: () => setView("about_system") },
    ];
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("prefs")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Tentang</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
            {items.map((it, i) => (
              <button key={i} onClick={it.onClick} className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-800/40">
                <it.icon className="w-5 h-5 text-purple-300 shrink-0" />
                <span className="text-slate-100 text-sm flex-1">{it.label}</span>
              </button>
            ))}
          </div>
        </div>
        {aboutBack()}
      </div>
    );
  }

  if (view === "about_privacy") {
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("about")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Privasi data</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-slate-200 text-sm leading-relaxed">
          <h3 className="font-bold text-base text-slate-100">Privasi data</h3>
          <p>
            Seluruh chat dan file media disimpan di server kami.<br />
            Mereka digunakan untuk:<br />
            — sistem deteksi otomatis spam<br />
            — memulihkan chat setelah aplikasi diinstal ulang
          </p>
          <p>
            Datamu tidak pernah dan tidak akan pernah dijual ke siapa pun. Selain itu, datamu terjaga aman dari akses langsung para penjahat siber. Data hanya dapat diakses oleh sistem anti spam
          </p>
        </div>
        {aboutBack()}
      </div>
    );
  }

  if (view === "about_rules") {
    const rules = [
      { t: "Iklan", d: "Dilarang keras membagikan tautan atau mempromosikan saluran pihak ketiga, akun pribadi, situs web, atau platform eksternal lainnya di awal obrolan atau selama percakapan apa pun." },
      { t: "Menjual dan meminta-minta", d: "Upaya untuk menjual barang atau jasa apa pun tidak diperbolehkan. Meminta uang, bantuan materi, atau permintaan serupa juga dilarang keras." },
      { t: "Mengirim pornografi anak", d: "Berkomunikasi dengan cara apa pun yang termasuk pelecehan atau eksploitasi anak adalah tindakan yang sangat dilarang." },
      { t: "Penghinaan dan Ancaman", d: "Menghina, melecehkan, atau mengancam pengguna lain dengan cara apa pun tidak diperbolehkan." },
      { t: "Kekerasan", d: "Membagikan konten yang menggambarkan atau mempromosikan kekerasan dalam bentuk apa pun dilarang keras." },
      { t: "Konten Penghinaan", d: "Menyebarkan ujaran kebencian terhadap suku, agama, ras, atau golongan tertentu akan langsung diberi sanksi." },
      { t: "Spam", d: "Mengirim pesan berulang, karakter acak, atau konten yang mengganggu pengguna lain akan menyebabkan akun diblokir otomatis." },
      { t: "Identitas Palsu", d: "Berpura-pura menjadi orang lain atau menyamar sebagai admin / staf resmi adalah pelanggaran berat." },
    ];
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("about")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Aturan</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {rules.map(r => (
            <div key={r.t}>
              <h3 className="font-bold text-slate-100 text-base mb-1.5">{r.t}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{r.d}</p>
            </div>
          ))}
        </div>
        {aboutBack()}
      </div>
    );
  }

  if (view === "about_tutorial") {
    const slides = [
      {
        img: tutorialImg1,
        title: "1. Mulai Chat Anonim",
        text: "Buka tab Anon Chat lalu tekan tombol ungu besar bertuliskan \"Mulai Chat Anonim\". Sistem akan langsung mencarikan partner acak untukmu.",
      },
      {
        img: tutorialImg2,
        title: "2. Pilih Minatmu",
        text: "Centang beberapa minat (Musik, Game, Film, dll). Partner yang dicarikan akan punya minat serupa supaya obrolan lebih nyambung.",
      },
      {
        img: tutorialImg3,
        title: "3. Ngobrol & Kirim Media",
        text: "Setelah dapat partner, ketik pesan di kolom bawah. Tekan ikon kamera untuk kirim foto, atau ikon mic untuk pesan suara. Bisa juga panggilan telepon.",
      },
      {
        img: tutorialImg4,
        title: "4. Tambahkan Jadi Teman",
        text: "Cocok dengan partnermu? Tekan tombol \"Tambah Teman\" di header chat. Kalau diterima, kalian bisa lanjut ngobrol kapan saja di tab Teman.",
      },
    ];
    const s = slides[tutorialStep];
    const last = tutorialStep === slides.length - 1;
    return (
      <div className="rounded-3xl border-2 border-indigo-400/30 bg-gradient-to-b from-indigo-950/40 via-slate-950 to-slate-950 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-center gap-2 px-5 py-4 border-b border-slate-800/60 relative">
          <span className="text-2xl">🥷</span>
          <span className="font-extrabold text-indigo-100 text-lg">Tutorial anon.chat</span>
          <button onClick={() => setView("about")} className="absolute right-4 text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col">
          <div className="rounded-2xl overflow-hidden shadow-2xl shadow-indigo-900/40 bg-slate-900 border border-slate-800">
            <img
              src={s.img}
              alt={s.title}
              loading="lazy"
              width={1024}
              height={1536}
              className="w-full h-auto block"
            />
          </div>
          <h3 className="text-indigo-100 text-lg font-bold mt-5 text-center">{s.title}</h3>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed text-center px-1">{s.text}</p>
          <div className="flex gap-1.5 justify-center mt-5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setTutorialStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === tutorialStep ? "w-6 bg-indigo-400" : "w-1.5 bg-slate-700"}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center justify-between mt-6 gap-3">
            <button
              onClick={() => setTutorialStep(s => Math.max(0, s - 1))}
              disabled={tutorialStep === 0}
              className="px-4 py-2.5 rounded-full text-sm font-semibold text-slate-300 bg-slate-800/60 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Kembali
            </button>
            <button
              onClick={() => last ? setView("about") : setTutorialStep(s => s + 1)}
              className="flex-1 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/40 font-semibold text-sm"
            >
              {last ? "Selesai" : `Lanjut (${tutorialStep + 1}/${slides.length})`}
              {!last && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "about_system") {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const uaData = (typeof navigator !== "undefined" ? (navigator as Navigator & { userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string; mobile?: boolean } }).userAgentData : undefined);
    const deviceModel = (() => {
      const m = ua.match(/\(([^)]+)\)/);
      if (!m) return "Browser";
      const parts = m[1].split(";").map(s => s.trim());
      const mobile = parts.find(p => /Build|SM-|CPH|Pixel|iPhone|Mi |Redmi|OPPO|vivo/i.test(p));
      return mobile || parts[parts.length - 1] || "Browser";
    })();
    const osName = (() => {
      if (uaData?.platform) return uaData.platform;
      if (/Android (\d+)/i.test(ua)) return "Android " + ua.match(/Android (\d+)/i)![1];
      if (/iPhone OS (\d+)/i.test(ua)) return "iOS " + ua.match(/iPhone OS (\d+)/i)![1];
      if (/Windows NT/i.test(ua)) return "Windows";
      if (/Mac OS X/i.test(ua)) return "macOS";
      if (/Linux/i.test(ua)) return "Linux";
      return "Unknown";
    })();
    const Field = ({ label, value }: { label: string; value: string }) => (
      <div className="py-3">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-slate-100 text-sm font-mono break-all mt-0.5">{value}</div>
      </div>
    );
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <button onClick={() => setView("about")} className="text-purple-300 text-sm">← Kembali</button>
          <div className="font-bold text-slate-100">Informasi Sistem</div>
          <div className="w-12" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 px-4 divide-y divide-slate-800">
            <Field label="Versi aplikasi" value={APP_VERSION} />
            <Field label="ID Akun" value={visitor} />
            <Field label="Perangkat" value={deviceModel} />
            <Field label="Sistem" value={osName} />
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 divide-y divide-slate-800 overflow-hidden">
            <button onClick={() => setView("about_rules")} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/40">
              <FileText className="w-5 h-5 text-purple-300 shrink-0" />
              <span className="text-slate-100 text-sm">Ketentuan Penggunaan</span>
            </button>
            <button onClick={() => setView("about_privacy")} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/40">
              <ClipboardList className="w-5 h-5 text-purple-300 shrink-0" />
              <span className="text-slate-100 text-sm">Kebijakan Privasi</span>
            </button>
          </div>
        </div>
        {aboutBack()}
      </div>
    );
  }

  if (view === "prefs") {
    const genderLabel = myGender === "male" ? "pria" : myGender === "female" ? "wanita" : "rahasia";
    return (
      <div className="rounded-3xl overflow-hidden border-2 border-purple-400/30 bg-gradient-to-b from-slate-950 via-slate-950 to-purple-950/20 min-h-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <div className="w-12" />
          <div className="font-bold text-slate-100 text-base">Setelan</div>
          <button onClick={() => setView("account")} className="text-purple-300 text-sm font-semibold">Edit</button>
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
              <span className="font-mono text-[10px] text-purple-300/80">{shortId(visitor)}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-purple-200 border border-purple-400/30 font-bold">ANON</span>
            </div>
          </div>

          {premiumModal}
          {/* Mode pencarian partner */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-base font-bold text-slate-100">Mode pencarian</div>
              {isPremium ? (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 font-bold">PREMIUM</span>
              ) : (
                <button onClick={() => openPremium("gender")} className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 font-bold">Upgrade</button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Random gratis. Filter gender khusus Premium.</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "any", label: "Random", emoji: "🎲", locked: false },
                { id: "male", label: "Pria", emoji: "👨", locked: !isPremium },
                { id: "female", label: "Wanita", emoji: "👩", locked: !isPremium },
              ].map((m) => {
                const sel = prefGender === m.id;
                return (
                  <button key={m.id}
                    onClick={() => { if (m.locked) { openPremium("gender"); return; } setPrefGender(m.id); }}
                    className={`relative rounded-2xl border px-2 py-3 text-center transition ${sel && !m.locked ? "border-fuchsia-400/60 bg-fuchsia-500/10 shadow-[0_0_24px_-10px_rgba(217,70,239,0.9)]" : "border-slate-700 bg-slate-950/50 hover:bg-slate-900"}`}>
                    <div className="text-xl leading-none mb-1">{m.emoji}</div>
                    <div className="text-[11px] font-bold text-slate-100">{m.label}</div>
                    {m.locked ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-amber-300 font-bold"><Lock className="w-2.5 h-2.5" /> Premium</span>
                    ) : (
                      <span className="mt-1 inline-block text-[9px] text-emerald-300 font-bold">{m.id === "any" ? "Gratis" : "Aktif"}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <button onClick={() => openPremium("call")}
              className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400/90 to-orange-500/90 text-slate-900 text-xs font-extrabold flex items-center justify-center gap-2">
              <PhoneCall className="w-3.5 h-3.5" /> {isPremium ? "Voice call aktif — kelola langganan" : "Buka Voice Call & Filter Gender"}
            </button>
            {isPremium && premiumStatus?.expires_at && (
              <p className="text-[10px] text-emerald-300/80 text-center mt-2">Aktif s/d {new Date(premiumStatus.expires_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
            )}
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
                  className="w-full py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-100 text-xs font-bold flex items-center justify-center gap-2"
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
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 resize-none focus:border-purple-400/60"
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
                    className="flex-1 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-100 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
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
              { icon: PhoneCall, label: "Riwayat panggilan", desc: "Voice call masuk & keluar", onClick: () => { loadCallLogs(); setView("callhistory"); } },
              { icon: ClipboardList, label: "Riwayat match", desc: "Partner yang pernah ditemui", onClick: () => { loadMatchHistory(); setView("history"); } },
              { icon: HelpCircle, label: "Dukungan", desc: "FAQ + tombol CS WhatsApp", onClick: () => setView("support") },
              { icon: Bell, label: "Notifikasi dan suara", desc: (soundOn ? "Suara aktif" : "Suara mati") + " · " + (notifOn ? "Notifikasi aktif" : "Notifikasi mati"), onClick: () => setView("notif") },
              { icon: Moon, label: "Tampilan", desc: theme === "dark" ? "Tema gelap" : theme === "light" ? "Tema terang" : "Tema sistem", onClick: () => setView("appearance") },
              { icon: MessageSquare, label: "Opsi Obrolan", desc: confirmClose ? "Konfirmasi ganda aktif" : "Konfirmasi ganda nonaktif", onClick: () => setView("chatopts") },
              { icon: Globe, label: "Bahasa", desc: LANGUAGES.find(l => l.code === lang)?.name || lang, onClick: () => setView("language") },
              { icon: Lock, label: "Privasi", desc: onlineStatus ? "Status online aktif" : "Status online disembunyikan", onClick: () => setView("privacy") },
              { icon: ThumbsUp, label: "Beri rating", desc: "Bantu kami berkembang", onClick: () => { try { window.open("https://wa.me/6285769302532?text=" + encodeURIComponent("Halo, saya mau beri rating Anon Chat"), "_blank"); } catch { /* ignore */ } } },
              { icon: Info, label: "Tentang", desc: "Anon Chat by Agung Adi Store", onClick: () => setView("about") },
            ].map((it, i) => (
              <button key={i} onClick={it.onClick}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-800/40 transition">
                <it.icon className="w-5 h-5 text-purple-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-100 font-semibold text-sm">{it.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{it.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
        </div>

        <InnerNav active="account" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "friends") {
    return (
      <div className="rounded-3xl overflow-hidden border-2 border-purple-400/30 bg-gradient-to-b from-purple-950/30 via-slate-950 to-slate-950 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-center gap-2 py-4 border-b border-purple-400/20 bg-gradient-to-r from-purple-500/10 to-violet-500/10">
          <Users className="w-5 h-5 text-purple-300" />
          <span className="text-base font-extrabold text-purple-100">Teman</span>
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
                    <button onClick={() => respondFriendRequest(r.id, true)} className="w-8 h-8 rounded-full bg-purple-500 hover:bg-purple-600 text-white flex items-center justify-center" title="Terima">
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
            <h4 className="text-xs font-bold text-purple-300 mb-2 px-1">Daftar teman ({friends.length})</h4>
            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center gap-3 py-10">
                <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-10 h-10 text-purple-300/70" />
                </div>
                <h3 className="font-bold text-slate-100">Belum ada teman</h3>
                <p className="text-xs text-slate-400 max-w-[260px]">Saat sedang chat, ketuk tombol <UserPlus className="inline w-3 h-3" /> Add di header untuk menambahkan teman.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map(f => (
                  <div key={f.friend_visitor} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-purple-400/20 hover:border-purple-400/50 transition">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center text-lg shrink-0">🥷</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-purple-100 truncate">{f.friend_nickname}</div>
                      <div className="text-[10px] text-purple-300/60 italic">Status & terakhir dilihat tidak ditampilkan</div>
                    </div>
                    <button onClick={() => startFriendChat(f.friend_visitor)} className="px-3 h-8 rounded-full bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold flex items-center gap-1" title="Chat">
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
        <InnerNav active="friends" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "explore") {
    return (
      <div className="rounded-3xl overflow-hidden border-2 border-purple-400/30 bg-gradient-to-b from-purple-950/30 via-slate-950 to-slate-950 min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between gap-2 py-4 px-4 border-b border-purple-400/20 bg-gradient-to-r from-purple-500/10 to-violet-500/10">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-purple-300" />
            <span className="text-base font-extrabold text-purple-100">Jelajah</span>
          </div>
          <button onClick={loadExplore} className="text-purple-300 text-xs flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/15 border border-purple-400/30">
            <RefreshCw className={`w-3.5 h-3.5 ${exploreLoading ? "animate-spin" : ""}`} /> Muat ulang
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-[11px] text-slate-400 italic px-1 mb-1">Pengguna anonim aktif dalam 5 menit terakhir.</p>
          {exploreLoading && exploreList.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-10">Memuat...</div>
          ) : exploreList.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-10">
              <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Compass className="w-10 h-10 text-purple-300/70" />
              </div>
              <h3 className="font-bold text-slate-100">Belum ada pengguna online</h3>
              <p className="text-xs text-slate-400 max-w-[260px]">Coba lagi sebentar atau langsung tekan tab Obrolan untuk cari partner acak.</p>
            </div>
          ) : (
            exploreList.map((p) => {
              const av = presetById(p.avatar_preset);
              return (
                <div key={p.visitor_id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-purple-400/20 hover:border-purple-400/50 transition">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${av.gradient} flex items-center justify-center overflow-hidden shrink-0`}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : <AvatarGraphic preset={av} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-purple-100 truncate flex items-center gap-1.5">
                      {p.nickname || "Anonim"}
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[10px] text-purple-300/60">aktif baru saja</div>
                  </div>
                  <button onClick={() => { toast.info("Tekan Obrolan untuk cari partner — chat langsung ke pengguna belum tersedia."); }}
                    className="px-3 h-8 rounded-full bg-purple-500/20 hover:bg-purple-500/40 border border-purple-400/40 text-purple-100 text-xs font-bold flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> Sapa
                  </button>
                </div>
              );
            })
          )}
        </div>
        <InnerNav active="explore" friendBadge={friendReqs.length} onChange={(k) => {
          if (k === "chat") setView("lobby");
          else if (k === "friends") setView("friends");
          else if (k === "explore") { setView("explore"); loadExplore(); }
          else setView("prefs");
        }} />
      </div>
    );
  }

  if (view === "onboarding") {
    const stepDone1 = !!nickname;
    const stepDone2 = onboardInterests.length > 0;
    const goSearch = () => {
      try { localStorage.setItem("anon_onboarded", "1"); } catch {}
      if (onboardInterests.length > 0) setInterest(onboardInterests[0]);
      doMatch();
    };
    return (
      <div className="rounded-3xl border-2 border-purple-400/30 bg-gradient-to-b from-[#0d0820] via-[#0a0618] to-[#0a0618] min-h-[500px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-purple-400/20">
          <button onClick={() => setView("lobby")} className="text-purple-300 text-sm flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Kembali</button>
          <div className="text-base font-extrabold text-white">anon<span className="bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-clip-text text-transparent">.chat</span></div>
          <div className="w-12" />
        </div>
        <div className="px-5 pt-5 flex items-center justify-between gap-2">
          {[
            { n: 1, label: "Profil", done: stepDone1 },
            { n: 2, label: "Minat",  done: stepDone2 },
            { n: 3, label: "Siap!",  done: false },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex-1 flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${onboardStep === s.n ? "bg-purple-500 border-purple-300 text-white" : s.done ? "bg-purple-500/30 border-purple-400 text-purple-100" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
                  {s.done && onboardStep !== s.n ? <Check className="w-4 h-4" /> : s.n}
                </div>
                <span className="text-[10px] text-slate-300 font-semibold">{s.label}</span>
              </div>
              {i < arr.length - 1 && <div className={`flex-1 h-0.5 ${s.done ? "bg-purple-400/60" : "bg-slate-700"}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {onboardStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-extrabold text-white text-center">Buat Profil Anon</h2>
              <p className="text-sm text-slate-400 text-center">Nama samaran ini hanya muncul saat chat — tidak terhubung ke akun aslimu.</p>
              <div className="flex flex-col items-center gap-3 py-2">
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${myAvatar.gradient} flex items-center justify-center overflow-hidden shadow-xl`}>
                  {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <AvatarGraphic preset={myAvatar} />}
                </div>
                <div className="grid grid-cols-5 gap-2 w-full">
                  {AVATAR_PRESETS.map((a) => (
                    <button key={a.id} onClick={() => setAvatarPreset(a.id)} className={`h-12 rounded-xl bg-gradient-to-br ${a.gradient} border ${avatarPreset === a.id ? "border-white shadow-lg" : "border-transparent opacity-75"}`}><AvatarGraphic preset={a} className="h-full w-full" /></button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nama samaran</label>
                <div className="flex gap-2">
                  <input value={nickname} onChange={e => setNickname(e.target.value.slice(0, 20))} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100" />
                  <button onClick={() => setNickname(genNick())} className="px-3 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-400/30"><Sparkles className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )}

          {onboardStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-extrabold text-white text-center">Pilih Minat</h2>
              <p className="text-sm text-slate-400 text-center">Pilih beberapa minat yang kamu sukai agar kami bisa mencarikan partner yang lebih cocok untukmu.</p>
              <div className="grid grid-cols-2 gap-3">
                {INTEREST_CARDS.map(({ id, label, Icon, gradient, ring }) => {
                  const on = onboardInterests.includes(id);
                  return (
                    <button key={id} onClick={() => setOnboardInterests((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                      className={`relative rounded-2xl p-4 border bg-gradient-to-br ${gradient} ${on ? `ring-2 ${ring} border-transparent` : "border-slate-700/60"} flex items-center gap-3 transition`}>
                      <div className="w-9 h-9 rounded-xl bg-slate-950/60 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-bold text-slate-100">{label}</span>
                      {on && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                    </button>
                  );
                })}
              </div>
              <div className="rounded-2xl border border-purple-400/30 bg-purple-500/5 p-3 flex items-start gap-2">
                <Shield className="w-4 h-4 text-purple-300 mt-0.5 shrink-0" />
                <div className="text-[11px] text-purple-200/80"><b className="text-purple-100">Privasi Terjamin</b><br />Minatmu bersifat anonim dan hanya digunakan untuk mencarikan partner yang cocok.</div>
              </div>
            </div>
          )}

          {onboardStep === 3 && (
            <div className="space-y-4 text-center">
              <h2 className="text-2xl font-extrabold text-white">Siap Mencari Partner!</h2>
              <p className="text-sm text-slate-400">Profil dan minatmu sudah siap. Tekan tombol di bawah untuk mulai mencari partner anonim.</p>
              <div className="rounded-2xl border border-purple-400/30 bg-slate-900/60 p-4 text-left space-y-2">
                <div className="text-xs text-purple-300/80">Nama samaran</div>
                <div className="font-bold text-slate-100">{nickname}</div>
                <div className="text-xs text-purple-300/80 mt-3">Minat ({onboardInterests.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {onboardInterests.length === 0 ? <span className="text-slate-500 text-xs italic">Belum dipilih</span> :
                    onboardInterests.map(i => <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-100">{i}</span>)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex gap-2">
          {onboardStep > 1 && (
            <button onClick={() => setOnboardStep((s) => (s - 1) as 1 | 2 | 3)} className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold">← Kembali</button>
          )}
          {onboardStep < 3 ? (
            <button onClick={() => setOnboardStep((s) => (s + 1) as 1 | 2 | 3)} disabled={onboardStep === 2 && onboardInterests.length === 0}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold disabled:opacity-50">
              Lanjut
            </button>
          ) : (
            <button onClick={goSearch} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold flex items-center justify-center gap-2">
              <Search className="w-4 h-4" /> Cari Partner
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-500 text-center pb-3 flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> 100% Aman & Anonim</p>
      </div>
    );
  }

  if (view === "searching") {
    const modeLabel = !isPremium || prefGender === "any" ? "Random" : prefGender === "male" ? "Pria" : "Wanita";
    const steps = ["Menghubungkan ke server", "Mencocokkan minat", "Menemukan partner"];
    const stepIdx = Math.min(2, Math.floor(searchSecs / 3));
    const progress = Math.min(95, 12 + searchSecs * 11);
    return (
      <div className="relative overflow-hidden rounded-[28px] border border-purple-400/30 bg-[#08041a] p-8 text-center min-h-[500px] flex flex-col items-center justify-center">
        {premiumModal}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 -left-10 w-64 h-64 rounded-full bg-fuchsia-600/25 blur-[80px] animate-pulse" />
          <div className="absolute -bottom-24 -right-10 w-64 h-64 rounded-full bg-violet-600/25 blur-[90px] animate-pulse [animation-delay:1.1s]" />
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </div>

        <div className="relative w-40 h-40 mb-7">
          <div className="absolute inset-0 rounded-full border border-fuchsia-400/25 animate-[spin_14s_linear_infinite]" style={{ borderStyle: "dashed" }} />
          <div className="absolute inset-2 rounded-full bg-purple-500/15 animate-ping" />
          <div className="absolute inset-5 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-600/25 blur-md animate-pulse" />
          <div className="absolute inset-7 rounded-full bg-gradient-to-br from-purple-400 to-violet-600 flex items-center justify-center text-5xl shadow-[0_0_60px_-10px_rgba(217,70,239,0.9)]">🥷</div>
          <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
            <span className="absolute left-1/2 -top-1 -translate-x-1/2 w-3 h-3 rounded-full bg-fuchsia-300 shadow-[0_0_16px_rgba(240,171,252,0.9)]" />
          </div>
        </div>

        <div className="relative text-xl font-black text-white tracking-tight">Mencari partner…</div>
        <div className="relative mt-1 inline-flex items-center gap-2 text-[11px] text-slate-300">
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-bold">{modeLabel}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-bold">{interest}</span>
        </div>

        <div className="relative w-full max-w-xs mt-6">
          <div className="h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-400 tabular-nums">
            <span>{steps[stepIdx]}…</span>
            <span>{Math.floor(searchSecs / 60).toString().padStart(2, "0")}:{(searchSecs % 60).toString().padStart(2, "0")}</span>
          </div>
        </div>

        <div className="relative mt-4 text-[11px] text-slate-400">{onlineCount} orang juga sedang mencari</div>

        {!isPremium && (
          <button onClick={() => openPremium("gender")}
            className="relative mt-5 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[11px] font-bold">
            ✨ Upgrade Premium untuk filter gender & voice call
          </button>
        )}

        <button onClick={cancelSearch}
          className="relative mt-6 px-8 py-3 rounded-2xl bg-white/5 text-slate-200 font-semibold border border-white/10 hover:bg-white/10">
          Batal
        </button>
      </div>
    );
  }


  // LOBBY — anon.chat ninja style
  return (
    <div className="relative rounded-[28px] overflow-hidden border border-purple-500/30 bg-[#08041a] shadow-[0_30px_80px_-20px_rgba(168,85,247,0.55)]">
      {/* Animated aurora background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-fuchsia-600/30 blur-[80px] animate-pulse" />
        <div className="absolute top-10 -right-20 w-80 h-80 rounded-full bg-violet-600/30 blur-[90px] animate-pulse [animation-delay:1.2s]" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-purple-700/25 blur-[100px] animate-pulse [animation-delay:2.4s]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.15),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      </div>

      <div className="relative">
        {/* Top safety chip + help */}
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 backdrop-blur border border-emerald-400/30 text-[11px] font-semibold text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Aman & Terenkripsi
          </div>
          <button onClick={() => setView("prefs")} className="w-9 h-9 rounded-full bg-white/5 backdrop-blur border border-white/10 flex items-center justify-center text-slate-200 hover:bg-white/10 transition" title="Pengaturan">
            <span className="text-base">?</span>
          </button>
        </div>

        {/* Hero */}
        <div className="px-6 pt-6 pb-3 text-center">
          <div className="relative mx-auto w-28 h-28 mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-fuchsia-500/40 via-purple-500/30 to-violet-500/40 blur-2xl animate-pulse" />
            <div className="absolute inset-0 rounded-full border border-purple-400/30" />
            <div className="absolute inset-2 rounded-full border border-fuchsia-400/20 animate-[spin_18s_linear_infinite]" style={{ borderStyle: "dashed" }} />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-600/40 to-fuchsia-600/30 backdrop-blur flex items-center justify-center text-[56px] leading-none shadow-[inset_0_0_30px_rgba(168,85,247,0.4)]">🥷</div>
          </div>
          <h1 className="text-[34px] font-black tracking-tight text-white leading-none">
            anon<span className="bg-gradient-to-r from-fuchsia-300 via-purple-300 to-violet-300 bg-clip-text text-transparent">.chat</span>
          </h1>
          <p className="text-[13px] text-slate-300 mt-2.5 font-medium">Ngobrol bebas, identitas tetap rahasia</p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10.5px] text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-emerald-300 tabular-nums">{onlineCount.toLocaleString("id-ID")}</span> orang online sekarang
          </div>
        </div>

        {/* Main CTA */}
        <div className="px-5 pt-4 pb-3">
          <button onClick={() => {
              let onboarded = false;
              try { onboarded = localStorage.getItem("anon_onboarded") === "1"; } catch {}
              if (!onboarded) { setOnboardStep(1); setView("onboarding"); } else { doMatch(); }
            }}
            className="group relative w-full py-[18px] rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-purple-600 text-white font-extrabold text-[15px] shadow-[0_20px_50px_-12px_rgba(217,70,239,0.7)] hover:shadow-[0_25px_60px_-12px_rgba(217,70,239,0.85)] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 overflow-hidden">
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <span className="relative w-7 h-7 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </span>
            <span className="relative tracking-wide">Mulai Chat Anonim</span>
            <ChevronRight className="relative w-5 h-5 absolute right-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <Zap className="w-3 h-3 text-amber-300" /> Match dalam &lt; 3 detik
          </div>
        </div>

        {/* Quick filters chips */}
        <div className="px-4 pb-3 flex items-center justify-center gap-2 flex-wrap">
          <button onClick={() => setView("prefs")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur border border-white/10 text-[11px] font-semibold text-slate-200 hover:bg-white/10 transition">
            <Users className="w-3 h-3 text-fuchsia-300" /> {prefGender === "male" ? "Pria" : prefGender === "female" ? "Wanita" : "Semua"}
          </button>
          <button onClick={() => setView("interest")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur border border-white/10 text-[11px] font-semibold text-slate-200 hover:bg-white/10 transition">
            <Heart className="w-3 h-3 text-rose-300" /> {interest}
          </button>
        </div>

        {/* Feature cards */}
        <div className="px-4 pb-4 grid grid-cols-3 gap-2">
          {[
            { Icon: VenetianMask, title: "Anonim", desc: "Identitas rahasia", grad: "from-fuchsia-500/20 to-fuchsia-700/10", ring: "border-fuchsia-400/30", icon: "text-fuchsia-300" },
            { Icon: Lock, title: "Privat", desc: "Aman & terjaga", grad: "from-purple-500/20 to-purple-700/10", ring: "border-purple-400/30", icon: "text-purple-300" },
            { Icon: Zap, title: "Cepat", desc: "Tanpa registrasi", grad: "from-violet-500/20 to-violet-700/10", ring: "border-violet-400/30", icon: "text-violet-300" },
          ].map(({ Icon, title, desc, grad, ring, icon }) => (
            <div key={title} className={`rounded-2xl border ${ring} bg-gradient-to-b ${grad} backdrop-blur p-3 text-center hover:scale-[1.03] transition-transform`}>
              <div className="w-9 h-9 mx-auto mb-1.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Icon className={`w-4 h-4 ${icon}`} />
              </div>
              <div className="text-[11px] font-extrabold text-white leading-tight">{title}</div>
              <div className="text-[9.5px] text-slate-400 leading-snug mt-0.5">{desc}</div>
            </div>
          ))}
        </div>

        {/* Tips card */}
        <div className="px-4 pb-4">
          <button onClick={() => setView("about_rules" as any)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-3 flex items-start gap-2.5 text-left hover:bg-white/[0.06] transition group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-purple-200" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-extrabold text-white mb-1 flex items-center gap-1.5">
                Tips Aman Chat
                <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold">PENTING</span>
              </div>
              <ul className="text-[10.5px] text-slate-400 space-y-0.5 list-disc pl-4 marker:text-purple-400">
                <li>Jangan bagikan informasi pribadi</li>
                <li>Bersikap baik dan saling menghargai</li>
                <li>Laporkan jika menemukan pelanggaran</li>
              </ul>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 mt-1 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Inner bottom nav */}
        <InnerNav active="chat" friendBadge={friendReqs.length} onChange={(k) => {
            if (k === "chat") setView("lobby");
            else if (k === "friends") setView("friends");
            else if (k === "explore") { setView("explore"); loadExplore(); }
            else setView("prefs");
          }} />
      </div>
    </div>
  );
}

type NavKey = "chat" | "friends" | "explore" | "account";
function InnerNav({ active, onChange, friendBadge = 0 }: { active: NavKey; onChange: (k: NavKey) => void; friendBadge?: number }) {
  const items: Array<{ k: NavKey; Icon: any; label: string; badge?: number }> = [
    { k: "chat", Icon: MessageCircle, label: "Obrolan" },
    { k: "friends", Icon: Users, label: "Teman", badge: friendBadge },
    { k: "explore", Icon: Compass, label: "Jelajah" },
    { k: "account", Icon: UserIcon, label: "Akun" },
  ];
  return (
    <div className="flex items-center justify-around border-t border-purple-400/15 bg-slate-950/80 backdrop-blur py-2.5">
      {items.map(({ k, Icon, label, badge }) => {
        const on = active === k;
        return (
          <button key={k} onClick={() => onChange(k)}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition ${on ? "text-purple-300" : "text-slate-500 hover:text-slate-300"}`}>
            <span className="relative">
              <Icon className={`w-5 h-5 ${on ? "drop-shadow-[0_0_6px_rgba(192,132,252,0.7)]" : ""}`} strokeWidth={on ? 2.4 : 1.8} />
              {badge && badge > 0 ? (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center border border-slate-950">{badge > 99 ? "99+" : badge}</span>
              ) : null}
            </span>
            <span className="text-[9.5px] font-semibold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, Heart, Trophy, Crown, Sparkles, Radio, Lightbulb, Calendar,
  Target, Coins, Send, X, Trash2, Music2, Clock, Share2, Moon, Mic2, BarChart3,
  Loader2, Play, ChevronRight, Zap, Star, Award, TrendingUp, Pencil, Check, ShieldAlert,
} from "lucide-react";
import type { PlaybackState } from "@/components/PlaylistTab";
import { useToast } from "@/hooks/use-toast";
import { useAudioBandsDOM } from "@/lib/audio-visualizer";
import PlayfulHero3D from "@/components/PlayfulHero3D";
import { moderateOutgoing } from "@/lib/chat-moderation";
import AccountAvatar from "@/components/AccountAvatar";

interface Props {
  visitorId: string;
  playbackState?: PlaybackState;
  onPlaySong?: (song: { id: string; title: string; artist: string; file_url: string; cover_url: string | null }) => void;
}

type ModalType = "comments" | "leaderboard" | "wrapped" | "quests" | "moodRadio" | "recommend" | "lyrics" | "level" | null;

const LEVEL_INFO: Record<string, { color: string; gradient: string; icon: typeof Trophy; minSec: number; nextSec: number; label: string }> = {
  Bronze:             { color: "from-amber-700 to-orange-800",   gradient: "from-amber-600/30 to-orange-700/30",   icon: Award,      minSec: 0,         nextSec: 600,        label: "🥉 Bronze" },
  Silver:             { color: "from-slate-300 to-slate-500",    gradient: "from-slate-300/30 to-slate-500/30",    icon: Star,       minSec: 600,       nextSec: 1800,       label: "🥈 Silver" },
  Gold:               { color: "from-yellow-400 to-amber-500",   gradient: "from-yellow-400/30 to-amber-500/30",   icon: Crown,      minSec: 1800,      nextSec: 3600,       label: "🥇 Gold" },
  Platinum:           { color: "from-cyan-300 to-blue-400",      gradient: "from-cyan-300/30 to-blue-400/30",      icon: Trophy,     minSec: 3600,      nextSec: 7200,       label: "💎 Platinum" },
  Diamond:            { color: "from-fuchsia-400 to-purple-500", gradient: "from-fuchsia-400/30 to-purple-500/30", icon: Sparkles,   minSec: 7200,      nextSec: 18000,      label: "💠 Diamond" },
  Master:             { color: "from-rose-400 to-red-600",       gradient: "from-rose-400/30 to-red-600/30",       icon: Trophy,     minSec: 18000,     nextSec: 43200,      label: "🏆 Master" },
  "Master Pro":       { color: "from-red-500 to-orange-600",     gradient: "from-red-500/30 to-orange-600/30",     icon: Crown,      minSec: 43200,     nextSec: 86400,      label: "👑 Master Pro" },
  Legenda:            { color: "from-indigo-400 to-purple-600",  gradient: "from-indigo-400/30 to-purple-600/30",  icon: Sparkles,   minSec: 86400,     nextSec: 172800,     label: "🌟 Legenda" },
  "Legenda Pro":      { color: "from-violet-500 to-fuchsia-600", gradient: "from-violet-500/30 to-fuchsia-600/30", icon: Sparkles,   minSec: 172800,    nextSec: 432000,     label: "✨ Legenda Pro" },
  Warrior:            { color: "from-emerald-500 to-teal-700",   gradient: "from-emerald-500/30 to-teal-700/30",   icon: Award,      minSec: 432000,    nextSec: 1036800,    label: "⚔️ Warrior" },
  "Grand Master":     { color: "from-amber-300 to-yellow-600",   gradient: "from-amber-300/30 to-yellow-600/30",   icon: Crown,      minSec: 1036800,   nextSec: 2592000,    label: "🏵️ Grand Master" },
  "Ninja Master":     { color: "from-zinc-700 to-black",         gradient: "from-zinc-700/30 to-black/30",         icon: Zap,        minSec: 2592000,   nextSec: 5184000,    label: "🥷 Ninja Master" },
  "Legend Immortal":  { color: "from-pink-400 to-rose-600",      gradient: "from-pink-400/30 to-rose-600/30",      icon: Sparkles,   minSec: 5184000,   nextSec: 12960000,   label: "💖 Legend Immortal" },
  "Legend Pro Immortal": { color: "from-yellow-300 via-pink-400 to-purple-500", gradient: "from-yellow-300/30 via-pink-400/30 to-purple-500/30", icon: Crown, minSec: 12960000, nextSec: 31536000, label: "👑✨ Legend Pro Immortal" },
};

const REACTIONS = ["❤️", "🔥", "😍", "🎵", "👏", "😢"];

const fmtDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  if (m === 0 && s > 0) return `${Math.floor(s)}d`;
  return `${m}m`;
};

export default function MusicMegaHub({ visitorId, playbackState, onPlaySong }: Props) {
  const { toast } = useToast();
  const [modal, setModal] = useState<ModalType>(null);
  const [level, setLevel] = useState<{ level: string; total_seconds: number } | null>(null);
  const [quests, setQuests] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [acct, setAcct] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [commentReacts, setCommentReacts] = useState<Record<string, { counts: Record<string, number>; mine: Set<string> }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [restrictedUntil, setRestrictedUntil] = useState<number>(0);
  const [topFans, setTopFans] = useState<any[]>([]);
  const [wrapped, setWrapped] = useState<any | null>(null);
  const [moodRadio, setMoodRadio] = useState<any | null>(null);
  const [recommendData, setRecommendData] = useState<any | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [lyrics, setLyrics] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState(0);

  const currentSong = playbackState?.song ?? null;
  const isPlaying = !!playbackState?.isPlaying;
  const currentSongId = currentSong?.id;
  const currentSongType: "playlist" | "public" = (currentSong as any)?.source === "public" ? "public" : "playlist";

  // Load level (sinkron dengan AKUN SALDO — total dari semua perangkat di akun yang sama)
  const loadLevel = async () => {
    if (!visitorId) return;
    const { data } = await supabase.rpc("get_account_music_xp", { p_visitor_id: visitorId });
    const row = Array.isArray(data) ? data[0] : data;
    setLevel(row ? { level: row.level, total_seconds: Number(row.total_seconds) } : { level: "Bronze", total_seconds: 0 });
  };

  useEffect(() => { loadLevel(); }, [visitorId]);

  // Realtime XP updates → cukup refresh akun (bukan langsung set), supaya total akun ikut akumulasi
  useEffect(() => {
    if (!visitorId) return;
    const ch = supabase.channel(`xp-${visitorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "music_listener_xp" },
        () => { loadLevel(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visitorId]);

  // Refresh saat tracker berhasil menyimpan dengar lagu
  useEffect(() => {
    const refresh = () => {
      loadLevel();
      if (modal === "quests") loadQuests();
      if (modal === "leaderboard" && currentSongId) {
        supabase.rpc("get_song_top_fans_account", { p_song_id: currentSongId, p_song_type: currentSongType, p_limit: 10 })
          .then(({ data }) => setTopFans(data || []));
      }
      if (modal === "wrapped") {
        supabase.rpc("get_music_wrapped", { p_visitor_id: visitorId, p_days: 1 })
          .then(({ data }) => setWrapped(data?.[0] || null));
      }
    };
    window.addEventListener("music-listen-logged", refresh);
    return () => window.removeEventListener("music-listen-logged", refresh);
  }, [visitorId, modal, currentSongId, currentSongType]);

  // Periodic level refresh while playing
  useEffect(() => {
    if (!visitorId) return;
    const t = setInterval(loadLevel, isPlaying ? 10000 : 60000);
    return () => clearInterval(t);
  }, [visitorId, isPlaying]);

  // Load all songs (for AI)
  useEffect(() => {
    supabase.from("playlist_songs").select("id,title,artist,file_url,cover_url").order("created_at", { ascending: false })
      .then(({ data }) => setAllSongs(data || []));
  }, []);

  // Load comments/reactions when modal opens or song changes
  const loadComments = async () => {
    if (!currentSongId) return;
    const { data } = await supabase.from("song_comments")
      .select("*").eq("song_id", currentSongId).eq("song_type", currentSongType)
      .order("created_at", { ascending: false }).limit(50);
    setComments(data || []);
    const { data: reacts } = await supabase.from("song_reactions")
      .select("emoji,visitor_id").eq("song_id", currentSongId).eq("song_type", currentSongType);
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    (reacts || []).forEach((r: any) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      if (r.visitor_id === visitorId) mine.add(r.emoji);
    });
    setReactionCounts(counts);
    setMyReactions(mine);

    // Reaksi per komentar
    const ids = (data || []).map((c: any) => c.id);
    if (ids.length) {
      const { data: cr } = await supabase.from("song_comment_reactions")
        .select("comment_id,emoji,visitor_id").in("comment_id", ids);
      const map: Record<string, { counts: Record<string, number>; mine: Set<string> }> = {};
      (cr || []).forEach((r: any) => {
        if (!map[r.comment_id]) map[r.comment_id] = { counts: {}, mine: new Set() };
        map[r.comment_id].counts[r.emoji] = (map[r.comment_id].counts[r.emoji] || 0) + 1;
        if (r.visitor_id === visitorId) map[r.comment_id].mine.add(r.emoji);
      });
      setCommentReacts(map);
    } else {
      setCommentReacts({});
    }
  };

  // Ambil identitas akun saldo (nama + foto) untuk komentar
  useEffect(() => {
    if (!visitorId) { setAcct(null); return; }
    supabase.from("user_balances").select("username,avatar_url").eq("visitor_id", visitorId).maybeSingle()
      .then(({ data }) => setAcct(data ? { username: (data as any).username, avatar_url: (data as any).avatar_url } : null));
  }, [visitorId]);

  // Ambil status pembatasan komentar
  const loadRestriction = async () => {
    if (!visitorId) return;
    const { data } = await supabase.from("comment_restrictions")
      .select("restricted_until").eq("visitor_id", visitorId).maybeSingle();
    const until = (data as any)?.restricted_until ? new Date((data as any).restricted_until).getTime() : 0;
    setRestrictedUntil(until > Date.now() ? until : 0);
  };
  useEffect(() => { if (modal === "comments") loadRestriction(); }, [modal, visitorId]);

  useEffect(() => { if (modal === "comments" && currentSongId) loadComments(); }, [modal, currentSongId]);

  // Load top fans (per akun saldo)
  useEffect(() => {
    if (modal !== "leaderboard" || !currentSongId) return;
    supabase.rpc("get_song_top_fans_account", { p_song_id: currentSongId, p_song_type: currentSongType, p_limit: 10 })
      .then(({ data }) => setTopFans(data || []));
  }, [modal, currentSongId, currentSongType]);

  // Load wrapped
  useEffect(() => {
    if (modal !== "wrapped" || !visitorId) return;
    supabase.rpc("get_music_wrapped", { p_visitor_id: visitorId, p_days: 1 })
      .then(({ data }) => setWrapped(data?.[0] || null));
  }, [modal, visitorId]);

  // Load quests
  const loadQuests = async () => {
    if (!visitorId) return;
    const { data } = await supabase.rpc("ensure_music_daily_quests", { p_visitor_id: visitorId });
    setQuests(data || []);
  };
  useEffect(() => { if (modal === "quests" && visitorId) loadQuests(); }, [modal, visitorId]);

  // Load lyrics
  useEffect(() => {
    if (modal !== "lyrics" || !currentSongId) { setLyrics([]); return; }
    supabase.from("song_lyrics").select("*").eq("song_id", currentSongId).order("line_order")
      .then(({ data }) => setLyrics(data || []));
  }, [modal, currentSongId]);

  // Sleep timer
  useEffect(() => {
    if (sleepRemaining <= 0) return;
    const t = setInterval(() => setSleepRemaining(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [sleepRemaining]);

  useEffect(() => {
    if (sleepRemaining === 0 && sleepMinutes !== null) {
      // pause player by triggering global audio pause
      try {
        document.querySelectorAll("audio").forEach(a => a.pause());
        toast({ title: "😴 Sleep timer", description: "Musik dihentikan." });
      } catch { /* noop */ }
      setSleepMinutes(null);
    }
  }, [sleepRemaining, sleepMinutes, toast]);

  const startSleep = (mins: number) => {
    setSleepMinutes(mins);
    setSleepRemaining(mins * 60);
    toast({ title: "⏰ Sleep timer aktif", description: `Musik akan berhenti dalam ${mins} menit.` });
  };

  const cancelSleep = () => { setSleepMinutes(null); setSleepRemaining(0); };

  // Cek pembatasan + moderasi. Return teks bersih atau null jika ditolak.
  const guardComment = async (raw: string): Promise<string | null> => {
    if (restrictedUntil > Date.now()) {
      const mins = Math.ceil((restrictedUntil - Date.now()) / 60000);
      toast({ title: "🚫 Komentar dibatasi", description: `Kamu dibatasi berkomentar. Coba lagi dalam ~${mins} menit.`, variant: "destructive" });
      return null;
    }
    const mod = moderateOutgoing(raw);
    if (!mod.ok) {
      // Catat pelanggaran → batasi 3 jam (berulang makin lama)
      let until = 0;
      if (visitorId) {
        const { data } = await supabase.rpc("register_comment_violation", { p_visitor_id: visitorId, p_reason: mod.reasons.join("; ") });
        const row = Array.isArray(data) ? data[0] : data;
        until = (row as any)?.restricted_until ? new Date((row as any).restricted_until).getTime() : Date.now() + 3 * 3600 * 1000;
        setRestrictedUntil(until);
      }
      const hrs = until ? Math.ceil((until - Date.now()) / 3600000) : 3;
      toast({
        title: "⚠️ Pelanggaran terdeteksi",
        description: `${mod.reasons.join(". ")}. Dilarang membagikan nomor/akun sosmed. Kamu dibatasi berkomentar ${hrs} jam.`,
        variant: "destructive",
      });
      return null;
    }
    return mod.cleaned;
  };

  // Post comment
  const postComment = async () => {
    if (!newComment.trim() || !currentSongId || !visitorId) return;
    setPosting(true);
    const clean = await guardComment(newComment.trim());
    if (clean === null) { setPosting(false); return; }
    const { error } = await supabase.from("song_comments").insert({
      song_id: currentSongId, song_type: currentSongType,
      visitor_id: visitorId, message: clean,
      display_name: acct?.username || localStorage.getItem("display_name") || "Anonim",
      avatar_url: acct?.avatar_url || null,
    });
    setPosting(false);
    if (error) { toast({ title: "Gagal komen", description: error.message, variant: "destructive" }); return; }
    // Quest progress (WIB date)
    const wibDate = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    await supabase.rpc("ensure_music_daily_quests", { p_visitor_id: visitorId });
    await supabase.from("music_daily_quests")
      .update({ current_value: 1, is_completed: true })
      .eq("visitor_id", visitorId).eq("quest_type", "comment_song")
      .eq("quest_date", wibDate);
    setNewComment("");
    loadComments();
  };

  const deleteComment = async (id: string) => {
    await supabase.from("song_comments").delete().eq("id", id).eq("visitor_id", visitorId);
    loadComments();
  };

  const startEdit = (c: any) => { setEditingId(c.id); setEditText(c.message); };
  const cancelEdit = () => { setEditingId(null); setEditText(""); };
  const saveEdit = async (id: string) => {
    if (!editText.trim() || !visitorId) return;
    const clean = await guardComment(editText.trim());
    if (clean === null) return;
    const { error } = await supabase.from("song_comments")
      .update({ message: clean, edited: true, updated_at: new Date().toISOString() })
      .eq("id", id).eq("visitor_id", visitorId);
    if (error) { toast({ title: "Gagal edit", description: error.message, variant: "destructive" }); return; }
    cancelEdit();
    loadComments();
  };

  const toggleCommentReaction = async (commentId: string, emoji: string) => {
    if (!visitorId) return;
    const mine = commentReacts[commentId]?.mine;
    if (mine?.has(emoji)) {
      await supabase.from("song_comment_reactions").delete()
        .eq("comment_id", commentId).eq("visitor_id", visitorId).eq("emoji", emoji);
    } else {
      await supabase.from("song_comment_reactions")
        .insert({ comment_id: commentId, visitor_id: visitorId, emoji });
    }
    loadComments();
  };

  const toggleReaction = async (emoji: string) => {
    if (!currentSongId || !visitorId) return;
    if (myReactions.has(emoji)) {
      await supabase.from("song_reactions").delete()
        .eq("song_id", currentSongId).eq("song_type", currentSongType)
        .eq("visitor_id", visitorId).eq("emoji", emoji);
    } else {
      await supabase.from("song_reactions").insert({
        song_id: currentSongId, song_type: currentSongType,
        visitor_id: visitorId, emoji,
      });
    }
    loadComments();
  };

  const claimQuest = async (id: string) => {
    const { data, error } = await supabase.rpc("claim_music_quest", { p_visitor_id: visitorId, p_quest_id: id });
    if (error || !data?.[0]?.success) {
      toast({ title: "Gagal klaim", description: error?.message || data?.[0]?.message, variant: "destructive" });
      return;
    }
    toast({ title: "🎉 Berhasil!", description: data[0].message });
    loadQuests();
  };

  const callAI = async (mode: "mood_radio" | "recommend", mood?: string) => {
    setAiLoading(true);
    try {
      const history = [];
      if (visitorId) {
        const { data } = await supabase.from("song_listening_log")
          .select("song_title,song_artist").eq("visitor_id", visitorId)
          .order("listened_at", { ascending: false }).limit(15);
        history.push(...(data || []).map(d => ({ title: d.song_title, artist: d.song_artist })));
      }
      const { data, error } = await supabase.functions.invoke("music-ai-curator", {
        body: { mode, songs: allSongs, history, mood: mood || "chill" },
      });
      if (error) throw error;
      if (mode === "mood_radio") setMoodRadio(data);
      else setRecommendData(data);
    } catch (e: any) {
      toast({ title: "AI gagal", description: e?.message || "Coba lagi", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const playFromAi = (songId: string) => {
    const song = allSongs.find(s => s.id === songId);
    if (song) onPlaySong?.(song);
  };

  const shareSong = async () => {
    if (!currentSong) return;
    const url = `${window.location.origin}/?play=${currentSong.id}`;
    const text = `🎵 Lagi dengar "${(currentSong as any).title}" — ${(currentSong as any).artist}\n${url}`;
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ title: (currentSong as any).title, text, url });
        shared = true;
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Disalin", description: "Link lagu disalin ke clipboard." });
        shared = true;
      }
    } catch { /* user cancelled */ }
    if (shared && visitorId) {
      try { await supabase.rpc("bump_music_share_quest", { p_visitor_id: visitorId }); } catch { /* noop */ }
    }
  };

  // Lyric sync
  const currentTime = playbackState?.currentTime ?? 0;
  const activeLyricIdx = useMemo(() => {
    if (lyrics.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (Number(lyrics[i].time_seconds) <= currentTime + 0.3) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, currentTime]);

  const lyricListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (modal !== "lyrics" || activeLyricIdx < 0) return;
    const el = lyricListRef.current?.children[activeLyricIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLyricIdx, modal]);

  // Visualizer bars (in mini card)
  const visualizerRef = useRef<HTMLDivElement>(null);
  useAudioBandsDOM(visualizerRef as any, 32, isPlaying, 40);

  const lvl = LEVEL_INFO[level?.level || "Bronze"] || LEVEL_INFO.Bronze;
  const totalSec = level?.total_seconds || 0;
  const xpProgress = lvl.nextSec > lvl.minSec
    ? Math.min(100, ((totalSec - lvl.minSec) / (lvl.nextSec - lvl.minSec)) * 100)
    : 100;

  const features = [
    { key: "level", icon: lvl.icon, label: lvl.label.replace(/[^\w]/g, ""), gradient: lvl.color, badge: lvl.label.split(" ")[0], desc: fmtDuration(totalSec) },
    { key: "quests", icon: Target, label: "Quest", gradient: "from-emerald-400 to-teal-500", badge: "🎯", desc: "Daily" },
    { key: "moodRadio", icon: Radio, label: "AI Radio", gradient: "from-purple-500 to-fuchsia-500", badge: "✨", desc: "Mood" },
    { key: "recommend", icon: Lightbulb, label: "For You", gradient: "from-pink-500 to-rose-500", badge: "🤖", desc: "AI" },
    { key: "wrapped", icon: BarChart3, label: "Wrapped", gradient: "from-orange-400 to-red-500", badge: "📊", desc: "Stats" },
    { key: "comments", icon: MessageCircle, label: "Komen", gradient: "from-cyan-400 to-blue-500", badge: "💬", desc: currentSong ? "Now" : "—" },
    { key: "leaderboard", icon: Trophy, label: "Top Fans", gradient: "from-yellow-400 to-amber-500", badge: "🏆", desc: currentSong ? "Now" : "—" },
    { key: "lyrics", icon: Mic2, label: "Lirik", gradient: "from-indigo-500 to-purple-600", badge: "🎤", desc: currentSong ? "Sync" : "—" },
  ];

  return (
    <div className="space-y-3">
      {/* Playful 3D Music Hero */}
      <PlayfulHero3D
        title="Music Mega Hub 🎶"
        subtitle="Naik level, selesaikan quest, & dengarkan radio AI buatmu!"
        emoji="🎧"
        gradient="from-violet-600 via-fuchsia-500 to-pink-500"
        ctaLabel={level ? `Level: ${lvl.label}` : "Mulai Dengar"}
        variant="music"
        height={180}
      />

      {/* AUDIO STUDIO QUICK LAUNCH */}
      <motion.button
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        onClick={() => window.dispatchEvent(new CustomEvent("open-audio-fx"))}
        className="w-full relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-r from-cyan-600/30 via-fuchsia-600/30 to-amber-500/30 backdrop-blur-md p-3.5 shadow-xl text-left active:scale-[0.98] transition-transform"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center shadow-lg ring-2 ring-white/30">
            <BarChart3 className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-bold text-cyan-200">🎚️ Audio Studio</p>
            <p className="text-sm font-extrabold text-white truncate">Equalizer · Balance L/R · Bass · Pitch</p>
            <p className="text-[10.5px] text-white/70">EQ 5-band, Surround 3D, Crossfade, Loop A-B & lainnya</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80" />
        </div>
      </motion.button>

      {/* LEVEL CARD + Visualizer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${lvl.gradient} backdrop-blur-md p-3.5 shadow-xl`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 to-transparent" />
        <div className="relative flex items-center gap-3">
          <motion.div
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className={`w-12 h-12 rounded-full bg-gradient-to-br ${lvl.color} flex items-center justify-center shadow-2xl ring-2 ring-white/30`}
          >
            <lvl.icon className="w-6 h-6 text-white drop-shadow" strokeWidth={2.5} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/80">Listener Level</p>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[9px] font-black text-white">{lvl.label}</span>
            </div>
            <p className="text-base font-black text-white">{fmtDuration(totalSec)} <span className="text-xs font-bold text-white/70">total dengar</span></p>
            <div className="mt-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
              <motion.div
                animate={{ width: `${xpProgress}%` }}
                className={`h-full bg-gradient-to-r from-white to-white/70 shadow-[0_0_8px_rgba(255,255,255,0.6)]`}
              />
            </div>
            <p className="text-[9px] text-white/70 mt-0.5">
              {totalSec >= lvl.nextSec ? "MAX LEVEL" : `${fmtDuration(Math.max(0, lvl.nextSec - totalSec))} ke level berikut`}
            </p>
          </div>
          {/* Visualizer */}
          <div ref={visualizerRef} className="flex items-end gap-[2px] h-10 flex-shrink-0">
            {Array.from({ length: 32 }).map((_, i) => (
              <span key={i} className="w-[2px] bg-white/80 rounded-full" style={{ height: 2 }} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* FEATURE GRID */}
      <div className="grid grid-cols-4 gap-2">
        {features.map((f, i) => (
          <motion.button
            key={f.key}
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 260 }}
            whileTap={{ scale: 0.92 }}
            whileHover={{ y: -3 }}
            onClick={() => setModal(f.key as ModalType)}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/80 backdrop-blur-md p-2 shadow-lg group"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-15 group-hover:opacity-25 transition-opacity`} />
            <div className={`absolute -top-3 -right-3 w-10 h-10 rounded-full bg-gradient-to-br ${f.gradient} opacity-40 blur-xl`} />
            <div className="relative flex flex-col items-center gap-0.5">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-md`}>
                <f.icon className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-extrabold text-foreground mt-0.5">{f.label}</span>
              <span className="text-[8px] font-bold text-muted-foreground">{f.desc}</span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* SLEEP TIMER + SHARE Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/50 to-purple-950/50 backdrop-blur-md p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Moon className="w-4 h-4 text-indigo-300 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase text-indigo-200">Sleep Timer</p>
              {sleepRemaining > 0 ? (
                <p className="text-xs font-black text-white">
                  {Math.floor(sleepRemaining / 60)}:{String(sleepRemaining % 60).padStart(2, "0")} <span className="text-[9px] font-bold text-indigo-300">tersisa</span>
                </p>
              ) : (
                <p className="text-[10px] text-indigo-300/80">Auto-pause musik</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {sleepRemaining > 0 ? (
              <button onClick={cancelSleep} className="px-2 py-1 rounded-lg bg-red-500/30 border border-red-400/40 text-[10px] font-black text-red-200">Batal</button>
            ) : (
              <>
                {[15, 30, 60].map(m => (
                  <button key={m} onClick={() => startSleep(m)} className="px-2 py-1 rounded-lg bg-indigo-500/30 border border-indigo-400/40 text-[10px] font-black text-indigo-100 hover:bg-indigo-500/50">{m}m</button>
                ))}
              </>
            )}
            {currentSong && (
              <button onClick={shareSong} className="ml-1 w-7 h-7 rounded-lg bg-fuchsia-500/30 border border-fuchsia-400/40 flex items-center justify-center">
                <Share2 className="w-3.5 h-3.5 text-fuchsia-200" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* MODAL */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2"
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl bg-card border border-white/10 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-fuchsia-950/30 to-purple-950/30">
                <h3 className="font-black text-foreground flex items-center gap-2">
                  {modal === "comments" && <><MessageCircle className="w-4 h-4 text-cyan-400" /> Komentar Lagu</>}
                  {modal === "leaderboard" && <><Trophy className="w-4 h-4 text-amber-400" /> Top Fans</>}
                  {modal === "wrapped" && <><BarChart3 className="w-4 h-4 text-orange-400" /> Wrapped Hari Ini</>}
                  {modal === "quests" && <><Target className="w-4 h-4 text-emerald-400" /> Music Quest Harian</>}
                  {modal === "moodRadio" && <><Radio className="w-4 h-4 text-purple-400" /> AI Mood Radio</>}
                  {modal === "recommend" && <><Lightbulb className="w-4 h-4 text-pink-400" /> Rekomendasi AI</>}
                  {modal === "lyrics" && <><Mic2 className="w-4 h-4 text-indigo-400" /> Lirik Sync</>}
                  {modal === "level" && <><Crown className="w-4 h-4 text-yellow-400" /> Listener Level</>}
                </h3>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center hover:bg-muted/60">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* COMMENTS */}
                {modal === "comments" && (
                  <div className="space-y-3">
                    {!currentSong ? (
                      <p className="text-center text-sm text-muted-foreground py-8">Putar lagu dulu untuk komentar.</p>
                    ) : (
                      <>
                        <div className="rounded-xl bg-muted/30 p-2 flex items-center gap-2">
                          <Music2 className="w-4 h-4 text-fuchsia-400" />
                          <div className="text-xs"><b>{(currentSong as any).title}</b> · {(currentSong as any).artist}</div>
                        </div>
                        {/* Reactions */}
                        <div className="flex flex-wrap gap-1.5">
                          {REACTIONS.map(e => (
                            <button key={e} onClick={() => toggleReaction(e)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-full border text-sm transition ${
                                myReactions.has(e) ? "bg-fuchsia-500/30 border-fuchsia-400" : "bg-muted/30 border-border hover:bg-muted/50"
                              }`}>
                              <span>{e}</span>
                              <span className="text-[10px] font-bold tabular-nums">{reactionCounts[e] || 0}</span>
                            </button>
                          ))}
                        </div>
                        {/* List */}
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {comments.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Belum ada komentar. Jadi yang pertama!</p>}
                          {comments.map(c => {
                            const cr = commentReacts[c.id] || { counts: {}, mine: new Set<string>() };
                            const isMine = c.visitor_id === visitorId;
                            const isEditing = editingId === c.id;
                            return (
                            <div key={c.id} className="rounded-xl bg-muted/30 p-2.5 border border-border">
                              <div className="flex items-start gap-2">
                                <AccountAvatar visitorId={c.visitor_id} username={c.display_name} avatarUrl={c.avatar_url ?? undefined} size={28} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="flex items-center gap-1 min-w-0">
                                      <p className="text-[11px] font-bold text-foreground truncate">{c.display_name}</p>
                                      <AccountStatusBadge visitorId={c.visitor_id} size={12} />
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-[9px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString("id-ID")}{c.edited ? " · diedit" : ""}</span>
                                      {isMine && !isEditing && (
                                        <>
                                          <button onClick={() => startEdit(c)} className="text-cyan-400 hover:text-cyan-300"><Pencil className="w-3 h-3" /></button>
                                          <button onClick={() => deleteComment(c.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <input value={editText} onChange={e => setEditText(e.target.value)}
                                        className="flex-1 bg-muted/40 rounded-lg px-2 py-1 text-xs outline-none border border-cyan-400/50" />
                                      <button onClick={() => saveEdit(c.id)} className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></button>
                                      <button onClick={cancelEdit} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-foreground/90 break-words">{c.message}</p>
                                  )}
                                  {/* Reaksi komentar */}
                                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                    <button onClick={() => toggleCommentReaction(c.id, "❤️")}
                                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[10px] transition ${cr.mine.has("❤️") ? "bg-rose-500/25 border-rose-400" : "bg-muted/30 border-border hover:bg-muted/50"}`}>
                                      <Heart className={`w-3 h-3 ${cr.mine.has("❤️") ? "fill-rose-400 text-rose-400" : ""}`} />
                                      <span className="tabular-nums">{cr.counts["❤️"] || 0}</span>
                                    </button>
                                    {["🔥", "😂", "👍"].map(e => (
                                      <button key={e} onClick={() => toggleCommentReaction(c.id, e)}
                                        className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[10px] transition ${cr.mine.has(e) ? "bg-fuchsia-500/25 border-fuchsia-400" : "bg-muted/30 border-border hover:bg-muted/50"}`}>
                                        <span>{e}</span>
                                        <span className="tabular-nums">{cr.counts[e] || 0}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ); })}
                        </div>
                        {restrictedUntil > Date.now() && (
                          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-2 text-[11px] text-red-400 font-semibold">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            Komentar dibatasi sampai {new Date(restrictedUntil).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} karena pelanggaran.
                          </div>
                        )}
                        {/* Input */}
                        <div className="flex items-center gap-2 pt-2 border-t border-border">
                          <AccountAvatar visitorId={visitorId} username={acct?.username} avatarUrl={acct?.avatar_url} size={28} />
                          <input value={newComment} onChange={e => setNewComment(e.target.value)}
                            placeholder={restrictedUntil > Date.now() ? "Kamu sedang dibatasi…" : "Tulis komentar…"}
                            disabled={restrictedUntil > Date.now()}
                            className="flex-1 bg-muted/40 rounded-xl px-3 py-2 text-xs outline-none border border-border focus:border-fuchsia-400 disabled:opacity-50" />
                          <button onClick={postComment} disabled={posting || !newComment.trim() || restrictedUntil > Date.now()}
                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center disabled:opacity-50">
                            {posting ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* LEADERBOARD */}
                {modal === "leaderboard" && (
                  <div className="space-y-2">
                    {!currentSong ? (
                      <p className="text-center text-sm text-muted-foreground py-8">Putar lagu untuk lihat top fans.</p>
                    ) : topFans.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">Belum ada fans tercatat.</p>
                    ) : (
                      topFans.map((f, i) => (
                        <div key={f.visitor_id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                          i === 0 ? "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-400/40" :
                          i === 1 ? "bg-gradient-to-r from-slate-400/20 to-slate-500/20 border-slate-400/40" :
                          i === 2 ? "bg-gradient-to-r from-amber-700/20 to-orange-700/20 border-amber-600/40" :
                          "bg-muted/30 border-border"
                        }`}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-xs bg-card shrink-0">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </div>
                          <AccountAvatar visitorId={f.visitor_id} username={f.display_name} avatarUrl={f.avatar_url} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{f.display_name}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtDuration(Number(f.total_seconds))} dengar</p>
                          </div>
                          {f.visitor_id === visitorId && <span className="text-[9px] font-black text-fuchsia-400">KAMU</span>}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* WRAPPED */}
                {modal === "wrapped" && (
                  <div className="space-y-3">
                    {!wrapped ? <p className="text-center text-sm text-muted-foreground py-8">Memuat…</p> : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 border border-fuchsia-400/30 p-3">
                            <p className="text-[10px] font-black uppercase text-fuchsia-300">Total Dengar</p>
                            <p className="text-2xl font-black text-white">{fmtDuration(Number(wrapped.total_seconds || 0))}</p>
                          </div>
                          <div className="rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 p-3">
                            <p className="text-[10px] font-black uppercase text-cyan-300">Lagu Unik</p>
                            <p className="text-2xl font-black text-white">{wrapped.unique_songs || 0}</p>
                          </div>
                        </div>
                        {wrapped.top_song_title && (
                          <div className="rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 p-3">
                            <p className="text-[10px] font-black uppercase text-yellow-300 mb-1">🎵 Lagu Favorit</p>
                            <p className="text-base font-black text-white truncate">{wrapped.top_song_title}</p>
                            <p className="text-xs text-white/70 truncate">{wrapped.top_song_artist}</p>
                            <p className="text-[10px] text-white/60 mt-1">{fmtDuration(Number(wrapped.top_song_seconds || 0))}</p>
                          </div>
                        )}
                        {wrapped.top_artist && (
                          <div className="rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-400/30 p-3">
                            <p className="text-[10px] font-black uppercase text-pink-300 mb-1">⭐ Artist Top</p>
                            <p className="text-base font-black text-white truncate">{wrapped.top_artist}</p>
                            <p className="text-[10px] text-white/60 mt-1">{fmtDuration(Number(wrapped.top_artist_seconds || 0))}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* QUESTS */}
                {modal === "quests" && (
                  <div className="space-y-2">
                    {quests.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">Memuat…</p> : (
                      quests.map(q => {
                        const pct = Math.min(100, (q.current_value / q.target_value) * 100);
                        const titles: Record<string, string> = {
                          listen_seconds: `Dengar musik ${Math.floor(q.target_value / 60)} menit`,
                          listen_long: `Maraton dengar ${Math.floor(q.target_value / 60)} menit hari ini`,
                          like_songs: `Like ${q.target_value} lagu`,
                          comment_song: `Komentar di ${q.target_value} lagu`,
                          comment_extra: `Komentar di ${q.target_value} lagu berbeda`,
                          share_song: `Bagikan ${q.target_value} lagu`,
                          react_songs: `Beri ${q.target_value} reaksi (emoji)`,
                          unique_artists: `Dengar ${q.target_value} artis berbeda`,
                          unique_songs: `Putar ${q.target_value} lagu berbeda`,
                          finish_songs: `Selesaikan ${q.target_value} lagu (≥1 menit)`,
                          replay_liked: `Dengar ${q.target_value} lagu yang sudah di-like`,
                          open_artist_tab: `Buka tab Artist ${q.target_value}x`,
                          play_playlist: `Putar ${q.target_value} playlist`,
                          listen_marathon: `Marathon ${Math.floor(q.target_value / 60)} menit hari ini`,
                        };
                        const isTimeQuest = q.quest_type === "listen_seconds" || q.quest_type === "listen_long" || q.quest_type === "listen_marathon";
                        return (
                          <div key={q.id} className="rounded-2xl bg-muted/30 border border-border p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-black text-foreground flex items-center gap-1">
                                <Target className="w-3.5 h-3.5 text-emerald-400" />
                                {titles[q.quest_type] || q.quest_type}
                              </p>
                              <span className="flex items-center gap-1 text-[10px] font-black text-yellow-300">
                                <Coins className="w-3 h-3" /> +{q.reward_coins}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden mb-1.5">
                              <div className={`h-full bg-gradient-to-r ${q.is_completed ? "from-emerald-400 to-teal-500" : "from-cyan-400 to-blue-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {isTimeQuest ? `${fmtDuration(q.current_value)}/${fmtDuration(q.target_value)}` : `${q.current_value}/${q.target_value}`}
                              </span>
                              {q.is_claimed ? (
                                <span className="text-[10px] font-black text-emerald-400">✓ Sudah klaim</span>
                              ) : q.is_completed ? (
                                <button onClick={() => claimQuest(q.id)} className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black">KLAIM</button>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Selesaikan dulu</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* MOOD RADIO */}
                {modal === "moodRadio" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">AI bikin radio sesuai mood-mu dari semua lagu di playlist.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {["chill", "party", "fokus", "gym", "tidur", "pagi"].map(m => (
                        <button key={m} disabled={aiLoading} onClick={() => callAI("mood_radio", m)}
                          className="px-3 py-2 rounded-xl bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 border border-purple-400/40 text-xs font-black capitalize disabled:opacity-50">
                          {m}
                        </button>
                      ))}
                    </div>
                    {aiLoading && <p className="text-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> AI sedang meracik…</p>}
                    {moodRadio && !aiLoading && (
                      <div className="space-y-2">
                        <div className="rounded-2xl bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border border-purple-400/40 p-3">
                          <p className="text-sm font-black text-white">📻 {moodRadio.title}</p>
                          <p className="text-[11px] text-white/70 mt-0.5">{moodRadio.description}</p>
                        </div>
                        {(moodRadio.song_ids || []).map((id: string) => {
                          const s = allSongs.find(x => x.id === id);
                          if (!s) return null;
                          return (
                            <button key={id} onClick={() => playFromAi(id)} className="w-full flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 text-left">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center flex-shrink-0">
                                {s.cover_url ? <img src={s.cover_url} className="w-full h-full object-cover rounded-lg" /> : <Music2 className="w-4 h-4 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{s.title}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{s.artist}</p>
                              </div>
                              <Play className="w-4 h-4 text-purple-400" fill="currentColor" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* RECOMMEND */}
                {modal === "recommend" && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">AI bikin rekomendasi personal berdasarkan history dengarmu.</p>
                    {!recommendData && !aiLoading && (
                      <button onClick={() => callAI("recommend")}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-sm shadow-lg flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4" /> Buatkan Rekomendasi
                      </button>
                    )}
                    {aiLoading && <p className="text-center text-xs text-muted-foreground"><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> AI memproses…</p>}
                    {recommendData && !aiLoading && (
                      <div className="space-y-2">
                        <div className="rounded-2xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-400/40 p-3">
                          <p className="text-sm font-black text-white">💡 {recommendData.title}</p>
                          <p className="text-[11px] text-white/70 mt-0.5">{recommendData.description}</p>
                        </div>
                        {(recommendData.song_ids || []).map((id: string) => {
                          const s = allSongs.find(x => x.id === id);
                          if (!s) return null;
                          return (
                            <button key={id} onClick={() => playFromAi(id)} className="w-full flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 text-left">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center flex-shrink-0">
                                {s.cover_url ? <img src={s.cover_url} className="w-full h-full object-cover rounded-lg" /> : <Music2 className="w-4 h-4 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate">{s.title}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{s.artist}</p>
                              </div>
                              <Play className="w-4 h-4 text-pink-400" fill="currentColor" />
                            </button>
                          );
                        })}
                        <button onClick={() => callAI("recommend")} className="w-full text-[10px] font-bold text-pink-400 py-1">↻ Refresh rekomendasi</button>
                      </div>
                    )}
                  </div>
                )}

                {/* LYRICS SYNC */}
                {modal === "lyrics" && (
                  <div className="space-y-2">
                    {!currentSong ? <p className="text-center text-sm text-muted-foreground py-8">Putar lagu dulu.</p> :
                     lyrics.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">Lirik belum tersedia untuk lagu ini.</p> :
                    (
                      <div ref={lyricListRef} className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                        {lyrics.map((line, i) => (
                          <p key={line.id}
                            className={`text-center py-1.5 px-2 rounded-lg transition-all ${
                              i === activeLyricIdx ? "text-white font-black text-base bg-gradient-to-r from-indigo-500/40 to-purple-500/40 scale-105 shadow-lg" :
                              i < activeLyricIdx ? "text-muted-foreground/50 text-xs" :
                              "text-foreground/70 text-sm"
                            }`}>
                            {line.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* LEVEL DETAIL */}
                {modal === "level" && (
                  <div className="space-y-3">
                    <div className={`rounded-2xl bg-gradient-to-br ${lvl.color} p-4 text-center shadow-2xl`}>
                      <lvl.icon className="w-12 h-12 text-white mx-auto mb-2" strokeWidth={2.5} />
                      <p className="text-2xl font-black text-white">{lvl.label}</p>
                      <p className="text-xs text-white/80 mt-1">{fmtDuration(totalSec)} total dengar</p>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(LEVEL_INFO).map(([key, info]) => {
                        const reached = totalSec >= info.minSec;
                        const isCurrent = key === level?.level;
                        return (
                          <div key={key} className={`flex items-center gap-2 p-2 rounded-xl border ${
                            isCurrent ? "bg-gradient-to-r " + info.color + " border-white/30" :
                            reached ? "bg-emerald-500/10 border-emerald-400/30" : "bg-muted/20 border-border"
                          }`}>
                            <info.icon className={`w-5 h-5 ${reached ? "text-white" : "text-muted-foreground"}`} />
                            <div className="flex-1">
                              <p className={`text-xs font-black ${reached ? "text-white" : "text-muted-foreground"}`}>{info.label}</p>
                              <p className={`text-[10px] ${reached ? "text-white/70" : "text-muted-foreground/60"}`}>{fmtDuration(info.minSec)} dengar</p>
                            </div>
                            {isCurrent && <span className="text-[9px] font-black text-white px-2 py-0.5 rounded bg-black/30">SEKARANG</span>}
                            {reached && !isCurrent && <span className="text-emerald-400">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

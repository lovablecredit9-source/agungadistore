import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { User, LogIn, LogOut, UserPlus, Search, Trophy, Users, Heart, Edit2, Loader2, Crown, Medal, Award, Eye, Sparkles, Star, Flame, Zap, Target, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { adjustGameLevelPoints, getPointMultiplier } from "./gameStore";

interface GameProfile {
  visitor_id: string;
  display_name: string;
  description: string;
  is_guest: boolean;
  email?: string;
  phone?: string;
  stats?: GameStat[];
  followers?: number;
  following?: number;
  isFollowing?: boolean;
}

interface GameStat {
  game_type: string;
  wins: number;
  losses: number;
  total_questions: number;
  points: number;
}

interface LeaderboardEntry extends GameStat {
  visitor_id: string;
  display_name: string;
  is_guest: boolean;
}

const GAME_LABELS: Record<string, string> = {
  suit: "Suit AI",
  tebak: "Tebak Kata",
  tebak_gambar: "Tebak Gambar",
  teka_teki: "Teka-Teki",
  tebak_angka: "Tebak Angka",
  tebak_barang: "Tebak Barang",
  kuis: "Kuis Ya/Tidak",
  teka_teki_v2: "Puzzle Huruf",
  ular_tangga: "Ular Tangga",
  ludo: "Ludo King",
  pilihan_ganda: "Pilihan Ganda",
};

// Hook to manage game profile
export function useGameProfile(boundVisitorId?: string | null) {
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const visitorId = getVisitorId();
  const gameVisitorId = boundVisitorId || localStorage.getItem("balance_visitor_id") || visitorId;

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("game-profile", {
        body: { action: "get_or_create", visitorId: gameVisitorId },
      });
      if (data && !data.error) {
        // Also fetch full profile with stats
        const { data: full } = await supabase.functions.invoke("game-profile", {
          body: { action: "get_profile", visitorId: gameVisitorId },
        });
        setProfile(full?.error ? data : full);
      }
    } catch { }
    setLoading(false);
  }, [gameVisitorId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const logout = () => {
    setProfile(null);
    localStorage.removeItem("game_profile_session");
    // Reset to guest
    fetchProfile();
  };

  return { profile, loading, fetchProfile, logout, visitorId: gameVisitorId };
}

// Profile badge shown in game menu
export function GameProfileBadge({ profile, onClick }: { profile: GameProfile | null; onClick: () => void }) {
  if (!profile) return null;
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 bg-accent/20 border border-accent/30 rounded-lg px-2 py-1 text-xs hover:bg-accent/30 transition-colors">
      <User className="w-3 h-3 text-accent" />
      <span className="font-bold truncate max-w-[80px]">{profile.display_name}</span>
      {profile.is_guest && <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">Guest</span>}
    </button>
  );
}

// Main Profile Dialog
export function GameProfileDialog({ profile, onUpdate, visitorId }: {
  profile: GameProfile | null;
  onUpdate: () => void;
  visitorId: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("profile");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="group relative flex items-center gap-1.5 rounded-full p-[1.5px] overflow-hidden quick-action-float">
          <span className="absolute inset-0 game-border-rainbow rounded-full" />
          <span className="relative flex items-center gap-1.5 bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-300 backdrop-blur rounded-full px-2.5 py-1 text-xs shadow-lg shadow-pink-500/25">
            <span className="relative w-5 h-5 rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-md shadow-fuchsia-500/40">
              <span className="text-[10px] font-black text-white drop-shadow">
                {(profile?.display_name || "P").charAt(0).toUpperCase()}
              </span>
              <Sparkles className="absolute -top-1 -right-1 w-2.5 h-2.5 text-yellow-300 quick-action-bounce" />
            </span>
            <span className="font-black truncate max-w-[80px] text-violet-950 drop-shadow-sm">
              {profile?.display_name || "Profil"}
            </span>
            {profile?.is_guest && (
              <span className="text-[8px] font-black text-yellow-950 bg-gradient-to-r from-yellow-300 to-amber-400 px-1.5 py-0.5 rounded-full shadow-sm">
                GUEST
              </span>
            )}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto p-0 border-0 bg-gradient-to-br from-amber-50 via-pink-50 to-cyan-50 text-violet-950 shadow-2xl shadow-pink-500/30">
        <DialogHeader className="p-4 pb-0 bg-gradient-to-r from-amber-200/80 via-pink-200/80 to-cyan-200/80">
          <DialogTitle className="flex items-center gap-2 text-base font-black">
            <User className="w-5 h-5 text-fuchsia-600" /> Profil Game
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full bg-gradient-to-b from-pink-50/80 to-cyan-50/80">
          <TabsList className="w-full grid grid-cols-4 mx-4 bg-white/70 border border-pink-200 shadow-inner" style={{ width: "calc(100% - 2rem)" }}>
            <TabsTrigger value="profile" className="text-xs gap-1 font-black data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white"><User className="w-3 h-3" /> Profil</TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-xs gap-1 font-black data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-400 data-[state=active]:to-orange-500 data-[state=active]:text-white"><Trophy className="w-3 h-3" /> Top</TabsTrigger>
            <TabsTrigger value="search" className="text-xs gap-1 font-black data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white"><Search className="w-3 h-3" /> Cari</TabsTrigger>
            <TabsTrigger value="auth" className="text-xs gap-1 font-black data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white">
              <Edit2 className="w-3 h-3" /> Edit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="px-4 pb-4">
            <ProfileView profile={profile} visitorId={visitorId} onUpdate={onUpdate} />
          </TabsContent>

          <TabsContent value="leaderboard" className="px-4 pb-4">
            <LeaderboardView visitorId={visitorId} />
          </TabsContent>

          <TabsContent value="search" className="px-4 pb-4">
            <SearchView visitorId={visitorId} />
          </TabsContent>

          <TabsContent value="auth" className="px-4 pb-4">
            <EditProfileView profile={profile} visitorId={visitorId} onUpdate={onUpdate} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Profile View
function ProfileView({ profile, visitorId, onUpdate }: { profile: GameProfile | null; visitorId: string; onUpdate: () => void }) {
  if (!profile) return <p className="text-sm text-muted-foreground py-4">Memuat profil...</p>;

  const totalWins = profile.stats?.reduce((s, st) => s + st.wins, 0) || 0;
  const totalLosses = profile.stats?.reduce((s, st) => s + st.losses, 0) || 0;
  const totalQuestions = profile.stats?.reduce((s, st) => s + st.total_questions, 0) || 0;
  const totalPoints = profile.stats?.reduce((s, st) => s + st.points, 0) || 0;

  return (
    <div className="space-y-3 mt-2">
      {/* 🌈 Hero Profile Card */}
      <div className="relative overflow-hidden rounded-2xl p-[2px] game-hero-pulse">
        <div className="absolute inset-0 game-border-rainbow" />
        <div className="relative rounded-[14px] update-aurora-bg p-4 text-center overflow-hidden">
          {/* Floating bg emojis */}
          <div className="absolute top-2 left-3 text-lg float-emoji opacity-60" style={{ animationDelay: "0s" }}>🎮</div>
          <div className="absolute top-3 right-3 text-lg float-emoji opacity-60" style={{ animationDelay: "0.7s" }}>⭐</div>
          <div className="absolute bottom-2 left-4 text-base float-emoji opacity-50" style={{ animationDelay: "1.2s" }}>🏆</div>
          <div className="absolute bottom-3 right-4 text-base float-emoji opacity-50" style={{ animationDelay: "1.8s" }}>✨</div>

          {/* Avatar with rainbow ring */}
          <div className="relative inline-block">
            <div className="absolute -inset-1 rounded-full game-border-rainbow opacity-90 blur-[2px]" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-500 mx-auto flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-fuchsia-500/50 quick-action-float">
              {profile.display_name.charAt(0).toUpperCase()}
              <Crown className="absolute -top-2 -right-1 w-5 h-5 text-yellow-300 fill-yellow-300 drop-shadow-lg quick-action-bounce" />
            </div>
          </div>

          <h3 className="font-black text-xl mt-2 bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent drop-shadow">
            {profile.display_name}
          </h3>
          {profile.description && (
            <p className="text-xs text-white/80 mt-0.5 px-2 line-clamp-2">{profile.description}</p>
          )}
          <div className="flex justify-center gap-2 mt-2">
            {profile.is_guest ? (
              <span className="text-[10px] font-black text-yellow-950 bg-gradient-to-r from-yellow-300 to-amber-400 px-2 py-0.5 rounded-full shadow game-chip-bounce">
                👤 GUEST
              </span>
            ) : (
              <span className="text-[10px] font-black text-emerald-50 bg-gradient-to-r from-emerald-500 to-cyan-500 px-2 py-0.5 rounded-full shadow game-chip-bounce">
                ✓ TERVERIFIKASI
              </span>
            )}
            <span className="text-[10px] font-black text-white bg-gradient-to-r from-fuchsia-500 to-violet-600 px-2 py-0.5 rounded-full shadow game-chip-bounce" style={{ animationDelay: "0.3s" }}>
              <Star className="w-2.5 h-2.5 inline fill-current" /> PRO PLAYER
            </span>
          </div>
        </div>
      </div>

      {/* 📊 Social Stats — 3 colorful cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Follower", value: profile.followers || 0, icon: Users, grad: "from-pink-500 to-rose-600", glow: "shadow-pink-500/40" },
          { label: "Following", value: profile.following || 0, icon: Heart, grad: "from-violet-500 to-fuchsia-600", glow: "shadow-violet-500/40" },
          { label: "Poin", value: totalPoints, icon: Sparkles, grad: "from-amber-400 to-orange-600", glow: "shadow-amber-500/40" },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`relative rounded-xl p-2.5 bg-gradient-to-br ${s.grad} text-white shadow-lg ${s.glow} stat-pop overflow-hidden`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-white/15 blur-xl" />
            <s.icon className="w-3.5 h-3.5 mb-0.5 opacity-90 quick-action-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
            <p className="font-black text-lg leading-none drop-shadow">{s.value}</p>
            <p className="text-[9px] font-bold opacity-90 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 🎯 Game Stats — W/L/Q with icons */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Menang", value: totalWins, icon: Trophy, grad: "from-emerald-500 to-green-600", glow: "shadow-emerald-500/40" },
          { label: "Kalah", value: totalLosses, icon: Flame, grad: "from-rose-500 to-red-600", glow: "shadow-rose-500/40" },
          { label: "Soal", value: totalQuestions, icon: Target, grad: "from-cyan-500 to-blue-600", glow: "shadow-cyan-500/40" },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`relative rounded-xl p-2.5 bg-gradient-to-br ${s.grad} text-white shadow-lg ${s.glow} stat-pop overflow-hidden`}
            style={{ animationDelay: `${(i + 3) * 0.1}s` }}
          >
            <div className="absolute -bottom-2 -left-2 w-10 h-10 rounded-full bg-white/15 blur-xl" />
            <s.icon className="w-3.5 h-3.5 mb-0.5 opacity-90 quick-action-bounce" style={{ animationDelay: `${(i + 3) * 0.2}s` }} />
            <p className="font-black text-lg leading-none drop-shadow">{s.value}</p>
            <p className="text-[9px] font-bold opacity-90 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Win Rate progress */}
      {(totalWins + totalLosses) > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-300 via-pink-400 to-cyan-400 p-3 border border-white/50 shadow-lg shadow-pink-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-black text-violet-950 flex items-center gap-1 drop-shadow-sm">
              <Zap className="w-3 h-3 text-yellow-100 fill-yellow-100" /> Win Rate
            </span>
            <span className="text-sm font-black text-violet-950 drop-shadow-sm">
              {Math.round((totalWins / (totalWins + totalLosses)) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/35 overflow-hidden">
            <div
              className="h-full bg-white rounded-full shadow-lg shadow-white/60"
              style={{ width: `${Math.round((totalWins / (totalWins + totalLosses)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {profile.stats && profile.stats.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="font-black text-xs flex items-center gap-1.5 px-1">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-500" />
            <span className="bg-gradient-to-r from-fuchsia-600 to-cyan-600 bg-clip-text text-transparent uppercase tracking-wider">
              Statistik per Game
            </span>
          </h4>
          {profile.stats.map((st, i) => {
            const palette = [
              "from-pink-500/20 to-rose-500/20 border-pink-500/40",
              "from-cyan-500/20 to-blue-500/20 border-cyan-500/40",
              "from-emerald-500/20 to-green-500/20 border-emerald-500/40",
              "from-amber-500/20 to-orange-500/20 border-amber-500/40",
              "from-violet-500/20 to-fuchsia-500/20 border-violet-500/40",
            ];
            const c = palette[i % palette.length];
            return (
              <div
                key={st.game_type}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs bg-gradient-to-r ${c} border backdrop-blur`}
              >
                <span className="font-black flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {GAME_LABELS[st.game_type] || st.game_type}
                </span>
                <div className="flex gap-1.5 text-[10px] font-black">
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">{st.wins}W</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300">{st.losses}L</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">{st.points}pts</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Auth View (Register / Login for guests)
function AuthView({ visitorId, currentName, onSuccess }: { visitorId: string; currentName?: string; onSuccess: () => void }) {
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(currentName || "");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRegister = async () => {
    if (!password || password.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    if (!email && !phone) {
      toast({ title: "Email atau No HP wajib diisi", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("game-profile", {
      body: { action: "register", visitorId, email: email || undefined, phone: phone || undefined, password, displayName: displayName || undefined },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || "Error", variant: "destructive" });
    } else {
      toast({ title: "Akun berhasil dibuat! 🎉" });
      localStorage.setItem("game_profile_session", visitorId);
      onSuccess();
    }
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      toast({ title: "Isi semua field", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("game-profile", {
      body: { action: "login", identifier, password },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Login gagal", description: data?.error || "Error", variant: "destructive" });
    } else {
      // Bind visitor_id to this profile
      localStorage.setItem("balance_visitor_id", data.visitor_id);
      localStorage.setItem("game_profile_session", data.visitor_id);
      toast({ title: `Selamat datang, ${data.display_name}! 🎮` });
      onSuccess();
    }
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="flex gap-2">
        <Button variant={authMode === "register" ? "default" : "outline"} size="sm" className="flex-1 text-xs gap-1" onClick={() => setAuthMode("register")}>
          <UserPlus className="w-3 h-3" /> Bind Akun
        </Button>
        <Button variant={authMode === "login" ? "default" : "outline"} size="sm" className="flex-1 text-xs gap-1" onClick={() => setAuthMode("login")}>
          <LogIn className="w-3 h-3" /> Login
        </Button>
      </div>

      {authMode === "register" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Bind akun guest kamu agar data aman & bisa login di device lain.</p>
          <Input placeholder="Nama tampilan" value={displayName} onChange={e => setDisplayName(e.target.value)} className="text-xs h-9" />
          <Input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="text-xs h-9" />
          <Input placeholder="No HP (opsional)" value={phone} onChange={e => setPhone(e.target.value)} className="text-xs h-9" />
          <Input placeholder="Password (min 6)" type="password" value={password} onChange={e => setPassword(e.target.value)} className="text-xs h-9" />
          <Button className="w-full text-xs" disabled={loading} onClick={handleRegister}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buat Akun"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Login dengan akun yang sudah di-bind.</p>
          <Input placeholder="Email / No HP / Nama" value={identifier} onChange={e => setIdentifier(e.target.value)} className="text-xs h-9" />
          <Input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="text-xs h-9" />
          <Button className="w-full text-xs" disabled={loading} onClick={handleLogin}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Login"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Edit Profile (for bound accounts)
function EditProfileView({ profile, visitorId, onUpdate }: { profile: GameProfile | null; visitorId: string; onUpdate: () => void }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("game-profile", {
      body: { action: "update_profile", visitorId, displayName },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || "Error", variant: "destructive" });
    } else {
      toast({ title: "Nama profil diperbarui! ✅" });
      onUpdate();
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Yakin reset akun game? Semua poin, level, statistik & menang/kalah akan kembali ke 0. Tindakan ini tidak bisa dibatalkan.")) return;
    setResetting(true);
    const { data, error } = await supabase.functions.invoke("game-profile", {
      body: { action: "reset_account", visitorId },
    });
    if (error || data?.error) {
      setResetting(false);
      toast({ title: "Gagal reset", description: data?.error || "Error", variant: "destructive" });
      return;
    }
    // Bersihkan cache poin/level lokal untuk semua kunci visitor
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("game_player_data")) localStorage.removeItem(k);
      });
    } catch {}
    try { window.dispatchEvent(new CustomEvent("game-level-updated")); } catch {}
    setResetting(false);
    toast({ title: "Akun game direset ke 0 🔄" });
    onUpdate();
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="space-y-2">
        <label className="text-xs font-bold">Nama Profil (sesuai akun saldo)</label>
        <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="text-xs h-9" placeholder="Nama tampilan" />
      </div>
      <Button className="w-full text-xs" disabled={loading} onClick={handleSave}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Simpan Nama"}
      </Button>
      <Button variant="destructive" size="sm" className="w-full text-xs gap-1" disabled={resetting} onClick={handleReset}>
        {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RotateCcw className="w-3 h-3" /> Reset Akun (Kembali ke 0)</>}
      </Button>
    </div>
  );
}


// Leaderboard View
function LeaderboardView({ visitorId }: { visitorId: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [gameFilter, setGameFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [viewProfile, setViewProfile] = useState<GameProfile | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("game-profile", {
      body: { action: "leaderboard", gameType: gameFilter || undefined },
    });
    setEntries(data?.error ? [] : (Array.isArray(data) ? data : []));
    setLoading(false);
  }, [gameFilter]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const viewPlayerProfile = async (vid: string) => {
    const { data } = await supabase.functions.invoke("game-profile", {
      body: { action: "get_profile", visitorId, targetVisitorId: vid },
    });
    if (data && !data.error) setViewProfile(data);
  };

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (i === 1) return <Medal className="w-4 h-4 text-gray-400" />;
    if (i === 2) return <Award className="w-4 h-4 text-amber-700" />;
    return <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">{i + 1}</span>;
  };

  if (viewProfile) {
    return <PlayerProfileCard profile={viewProfile} visitorId={visitorId} onBack={() => setViewProfile(null)} onUpdate={fetchLeaderboard} />;
  }

  return (
    <div className="space-y-2 mt-2">
      <select
        value={gameFilter}
        onChange={e => setGameFilter(e.target.value)}
        className="w-full text-xs bg-muted rounded-lg px-2 py-1.5 border-0"
      >
        <option value="">Semua Game</option>
        {Object.entries(GAME_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Belum ada data leaderboard</p>
      ) : (
        <div className="space-y-1">
          {entries.map((e, i) => (
            <motion.button
              key={`${e.visitor_id}-${e.game_type}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => viewPlayerProfile(e.visitor_id)}
              className="w-full flex items-center gap-2 bg-muted/50 hover:bg-muted rounded-lg px-2 py-1.5 text-left transition-colors"
            >
              {rankIcon(i)}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate">{e.display_name}</p>
                <p className="text-[10px] text-muted-foreground">{GAME_LABELS[e.game_type] || e.game_type}</p>
              </div>
              <div className="text-right text-[10px]">
                <p className="font-bold">{e.points} pts</p>
                <p className="text-muted-foreground">{e.wins}W {e.losses}L</p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// Search View
function SearchView({ visitorId }: { visitorId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ visitor_id: string; display_name: string; description: string; is_guest: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewProfile, setViewProfile] = useState<GameProfile | null>(null);

  const handleSearch = async () => {
    if (query.length < 2) return;
    setLoading(true);
    const { data } = await supabase.functions.invoke("game-profile", {
      body: { action: "search", query },
    });
    setResults(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const viewPlayerProfile = async (vid: string) => {
    const { data } = await supabase.functions.invoke("game-profile", {
      body: { action: "get_profile", visitorId, targetVisitorId: vid },
    });
    if (data && !data.error) setViewProfile(data);
  };

  if (viewProfile) {
    return <PlayerProfileCard profile={viewProfile} visitorId={visitorId} onBack={() => setViewProfile(null)} onUpdate={() => viewPlayerProfile(viewProfile.visitor_id)} />;
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-2">
        <Input placeholder="Cari nama pemain..." value={query} onChange={e => setQuery(e.target.value)} className="text-xs h-9" onKeyDown={e => e.key === "Enter" && handleSearch()} />
        <Button size="sm" className="h-9 text-xs" disabled={loading || query.length < 2} onClick={handleSearch}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map(r => (
            <button
              key={r.visitor_id}
              onClick={() => viewPlayerProfile(r.visitor_id)}
              className="w-full flex items-center gap-2 bg-muted/50 hover:bg-muted rounded-lg px-2 py-1.5 text-left transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-primary-foreground">
                {r.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate">{r.display_name}</p>
                {r.description && <p className="text-[10px] text-muted-foreground truncate">{r.description}</p>}
              </div>
              {r.is_guest && <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">Guest</span>}
              <Eye className="w-3 h-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Player Profile Card (viewed from search/leaderboard)
function PlayerProfileCard({ profile, visitorId, onBack, onUpdate }: {
  profile: GameProfile;
  visitorId: string;
  onBack: () => void;
  onUpdate: () => void;
}) {
  const [following, setFollowing] = useState(profile.isFollowing || false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleFollow = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("game-profile", {
      body: { action: "follow", visitorId, targetVisitorId: profile.visitor_id },
    });
    if (data && !data.error) {
      setFollowing(data.followed);
      toast({ title: data.followed ? "Followed! ❤️" : "Unfollowed" });
      onUpdate();
    }
    setLoading(false);
  };

  const totalPoints = profile.stats?.reduce((s, st) => s + st.points, 0) || 0;
  const totalWins = profile.stats?.reduce((s, st) => s + st.wins, 0) || 0;
  const totalLosses = profile.stats?.reduce((s, st) => s + st.losses, 0) || 0;

  return (
    <div className="space-y-3 mt-2">
      <Button variant="ghost" size="sm" className="text-xs gap-1 -ml-2" onClick={onBack}>← Kembali</Button>

      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center text-xl font-bold text-primary-foreground">
          {profile.display_name.charAt(0).toUpperCase()}
        </div>
        <h3 className="font-extrabold text-base mt-1">{profile.display_name}</h3>
        {profile.description && <p className="text-xs text-muted-foreground">{profile.description}</p>}
      </div>

      <div className="flex justify-center gap-4 text-center text-xs">
        <div><p className="font-extrabold">{profile.followers || 0}</p><p className="text-[10px] text-muted-foreground">Follower</p></div>
        <div><p className="font-extrabold">{profile.following || 0}</p><p className="text-[10px] text-muted-foreground">Following</p></div>
        <div><p className="font-extrabold">{totalPoints}</p><p className="text-[10px] text-muted-foreground">Poin</p></div>
      </div>

      {profile.visitor_id !== visitorId && (
        <Button
          variant={following ? "outline" : "default"}
          size="sm"
          className="w-full text-xs gap-1"
          disabled={loading}
          onClick={handleFollow}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className={`w-3 h-3 ${following ? "fill-red-500 text-red-500" : ""}`} />}
          {following ? "Unfollow" : "Follow"}
        </Button>
      )}

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-green-500/10 rounded-lg p-2"><p className="font-bold text-green-600 text-sm">{totalWins}</p><p className="text-[10px] text-muted-foreground">Menang</p></div>
        <div className="bg-red-500/10 rounded-lg p-2"><p className="font-bold text-red-600 text-sm">{totalLosses}</p><p className="text-[10px] text-muted-foreground">Kalah</p></div>
      </div>

      {profile.stats && profile.stats.length > 0 && (
        <div className="space-y-1">
          <h4 className="font-bold text-xs text-muted-foreground">Statistik</h4>
          {profile.stats.map(st => (
            <div key={st.game_type} className="flex items-center justify-between bg-muted/50 rounded-lg px-2 py-1.5 text-xs">
              <span className="font-semibold">{GAME_LABELS[st.game_type] || st.game_type}</span>
              <span className="text-[10px]">{st.wins}W {st.losses}L · {st.points}pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to update stats after game
export async function updateGameStats(
  visitorId: string,
  gameType: string,
  won: boolean,
  points: number,
  questionsAnswered = 1,
  meta?: { basePoints?: number },
) {
  let trackedPoints = points;
  try {
    const hasBasePoints = typeof meta?.basePoints === "number" && Number.isFinite(meta.basePoints);
    const localPointMultiplier = getPointMultiplier();
    const useServerBaseRecalc = hasBasePoints && localPointMultiplier <= 1;
    const { data } = await supabase.functions.invoke("game-profile", {
      body: {
        action: "update_stats",
        visitorId,
        gameType,
        won,
        points,
        questionsAnswered,
        ...(useServerBaseRecalc ? { basePoints: meta!.basePoints } : {}),
      },
    });
    if (typeof data?.awardedPoints === "number") {
      trackedPoints = Math.max(points, data.awardedPoints);
      if (data.awardedPoints !== points && data.awardedPoints > points) {
        adjustGameLevelPoints(data.awardedPoints - points);
      }
    }
  } catch { }
  // Daily mission tracking (silent)
  try {
    const { trackDailyMission } = await import("@/lib/daily-mission");
    await trackDailyMission(visitorId, "game_play", 1);
    if (won) await trackDailyMission(visitorId, "game_win", 1);
    if (trackedPoints > 0) await trackDailyMission(visitorId, "game_points", trackedPoints);
  } catch { }
  return trackedPoints;
}

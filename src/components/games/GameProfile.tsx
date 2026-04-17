import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { User, LogIn, LogOut, UserPlus, Search, Trophy, Users, Heart, Edit2, Loader2, Crown, Medal, Award, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";

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
export function useGameProfile() {
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const visitorId = getVisitorId();
  const gameVisitorId = localStorage.getItem("balance_visitor_id") || visitorId;

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
        <button className="flex items-center gap-1.5 bg-accent/20 border border-accent/30 rounded-lg px-2 py-1 text-xs hover:bg-accent/30 transition-colors">
          <User className="w-3 h-3 text-accent" />
          <span className="font-bold truncate max-w-[80px]">{profile?.display_name || "Profil"}</span>
          {profile?.is_guest && <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">Guest</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="w-5 h-5 text-primary" /> Profil Game
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mx-4" style={{ width: "calc(100% - 2rem)" }}>
            <TabsTrigger value="profile" className="text-xs gap-1"><User className="w-3 h-3" /> Profil</TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-xs gap-1"><Trophy className="w-3 h-3" /> Top</TabsTrigger>
            <TabsTrigger value="search" className="text-xs gap-1"><Search className="w-3 h-3" /> Cari</TabsTrigger>
            <TabsTrigger value="auth" className="text-xs gap-1">
              {profile?.is_guest ? <LogIn className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
              {profile?.is_guest ? "Login" : "Edit"}
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
            {profile?.is_guest ? (
              <AuthView visitorId={visitorId} currentName={profile?.display_name} onSuccess={onUpdate} />
            ) : (
              <EditProfileView profile={profile} visitorId={visitorId} onUpdate={onUpdate} />
            )}
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
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center text-2xl font-bold text-primary-foreground">
          {profile.display_name.charAt(0).toUpperCase()}
        </div>
        <h3 className="font-extrabold text-lg mt-2">{profile.display_name}</h3>
        {profile.description && <p className="text-xs text-muted-foreground">{profile.description}</p>}
        {profile.is_guest && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Guest</span>}
      </div>

      <div className="flex justify-center gap-6 text-center">
        <div>
          <p className="font-extrabold text-lg">{profile.followers || 0}</p>
          <p className="text-[10px] text-muted-foreground">Follower</p>
        </div>
        <div>
          <p className="font-extrabold text-lg">{profile.following || 0}</p>
          <p className="text-[10px] text-muted-foreground">Following</p>
        </div>
        <div>
          <p className="font-extrabold text-lg">{totalPoints}</p>
          <p className="text-[10px] text-muted-foreground">Poin</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-500/10 rounded-lg p-2">
          <p className="font-bold text-green-600 text-sm">{totalWins}</p>
          <p className="text-[10px] text-muted-foreground">Menang</p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-2">
          <p className="font-bold text-red-600 text-sm">{totalLosses}</p>
          <p className="text-[10px] text-muted-foreground">Kalah</p>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-2">
          <p className="font-bold text-blue-600 text-sm">{totalQuestions}</p>
          <p className="text-[10px] text-muted-foreground">Soal</p>
        </div>
      </div>

      {profile.stats && profile.stats.length > 0 && (
        <div className="space-y-1">
          <h4 className="font-bold text-xs text-muted-foreground">Statistik per Game</h4>
          {profile.stats.map(st => (
            <div key={st.game_type} className="flex items-center justify-between bg-muted/50 rounded-lg px-2 py-1.5 text-xs">
              <span className="font-semibold">{GAME_LABELS[st.game_type] || st.game_type}</span>
              <div className="flex gap-2 text-[10px]">
                <span className="text-green-600">{st.wins}W</span>
                <span className="text-red-600">{st.losses}L</span>
                <span className="text-blue-600">{st.points}pts</span>
              </div>
            </div>
          ))}
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
  const [description, setDescription] = useState(profile?.description || "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("game-profile", {
      body: { action: "update_profile", visitorId, displayName, description },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || "Error", variant: "destructive" });
    } else {
      toast({ title: "Profil diperbarui! ✅" });
      onUpdate();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("game_profile_session");
    localStorage.removeItem("balance_visitor_id");
    toast({ title: "Berhasil logout" });
    window.location.reload();
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="space-y-2">
        <label className="text-xs font-bold">Nama Tampilan</label>
        <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="text-xs h-9" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold">Deskripsi</label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} className="text-xs min-h-[60px]" placeholder="Tentang kamu..." />
      </div>
      <Button className="w-full text-xs" disabled={loading} onClick={handleSave}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Simpan Perubahan"}
      </Button>
      <Button variant="destructive" size="sm" className="w-full text-xs gap-1" onClick={handleLogout}>
        <LogOut className="w-3 h-3" /> Logout
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
export async function updateGameStats(visitorId: string, gameType: string, won: boolean, points: number, questionsAnswered = 1) {
  try {
    await supabase.functions.invoke("game-profile", {
      body: { action: "update_stats", visitorId, gameType, won, points, questionsAnswered },
    });
  } catch { }
  // Daily mission tracking (silent)
  try {
    const { trackDailyMission } = await import("@/lib/daily-mission");
    trackDailyMission(visitorId, "game_play", 1);
    if (won) trackDailyMission(visitorId, "game_win", 1);
    if (points > 0) trackDailyMission(visitorId, "game_points", points);
  } catch { }
}

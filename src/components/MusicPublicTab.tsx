import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Music, Upload, Loader2, Globe, Lock, User, Search, Heart,
  UserPlus, UserMinus, Play, Eye, CheckCircle2, Clock, XCircle,
  ChevronLeft, Share2, Bluetooth, Volume2, Headphones, Speaker, Smartphone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { getVisitorId } from "@/lib/visitor-id";

interface MusicProfile {
  id: string;
  visitor_id: string;
  username: string;
  description: string;
  avatar_url: string | null;
  created_at: string;
}

interface PublicSong {
  id: string;
  visitor_id: string;
  title: string;
  artist: string;
  description: string;
  file_url: string;
  cover_url: string | null;
  duration: number;
  file_size: number;
  status: string;
  visibility: string;
  created_at: string;
}

interface UserFollow {
  id: string;
  follower_visitor_id: string;
  following_visitor_id: string;
}

type SubTab = "explore" | "upload" | "my-songs" | "profile";

interface MusicPublicTabProps {
  onPlaySong?: (song: { id: string; title: string; artist: string; file_url: string; cover_url: string | null }) => void;
}

const MusicPublicTab = ({ onPlaySong }: MusicPublicTabProps) => {
  const [subTab, setSubTab] = useState<SubTab>("explore");
  const [visitorId, setVisitorId] = useState("");
  const [myProfile, setMyProfile] = useState<MusicProfile | null>(null);
  const [profiles, setProfiles] = useState<MusicProfile[]>([]);
  const [publicSongs, setPublicSongs] = useState<PublicSong[]>([]);
  const [mySongs, setMySongs] = useState<PublicSong[]>([]);
  const [follows, setFollows] = useState<UserFollow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadArtist, setUploadArtist] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<"public" | "private">("public");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCover, setUploadCover] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5MB

  // Profile setup
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileDesc, setProfileDesc] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // View profile
  const [viewingProfile, setViewingProfile] = useState<MusicProfile | null>(null);
  const [viewProfileSongs, setViewProfileSongs] = useState<PublicSong[]>([]);

  // Audio devices (bluetooth etc)
  const [audioDevices, setAudioDevices] = useState<{ deviceId: string; label: string }[]>([]);

  const { toast } = useToast();

  // Detect audio output devices without requesting microphone permission.
  useEffect(() => {
    const detectDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const outputs = allDevices
          .filter(d => d.kind === "audiooutput")
          .map(d => ({ deviceId: d.deviceId, label: d.label || "Perangkat Audio" }));
        setAudioDevices(outputs);
      } catch {}
    };
    detectDevices();
    navigator.mediaDevices?.addEventListener("devicechange", detectDevices);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", detectDevices);
  }, []);

  const isGenericAudioLabel = (label: string) => {
    const normalized = label.trim().toLowerCase();
    return !normalized || ["perangkat audio", "audio output", "default", "speaker", "communications"].includes(normalized);
  };

  const getPreferredAudioDevice = () => {
    const bluetoothDevice = audioDevices.find(d => {
      const label = d.label.toLowerCase();
      return label.includes("bluetooth") || label.includes("bt") || label.includes("airpod") || label.includes("buds");
    });
    if (bluetoothDevice) return bluetoothDevice;

    const namedDevice = audioDevices.find(d => !isGenericAudioLabel(d.label));
    return namedDevice || audioDevices[0];
  };

  const getDeviceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("bluetooth") || l.includes("bt") || l.includes("airpod") || l.includes("buds")) return <Bluetooth className="w-3.5 h-3.5 text-primary" />;
    if (l.includes("headphone") || l.includes("headset")) return <Headphones className="w-3.5 h-3.5 text-primary" />;
    if (l.includes("speaker") || l.includes("external")) return <Speaker className="w-3.5 h-3.5 text-primary" />;
    if (l.includes("phone") || l.includes("earpiece")) return <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />;
    return <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const handleShare = async (text: string, url?: string) => {
    const shareData = { title: text, text, url: url || window.location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(url || window.location.href);
      toast({ title: "Link disalin!" });
    }
  };

  useEffect(() => {
    const init = async () => {
      const vid = await getVisitorId();
      setVisitorId(vid);
      await loadData(vid);
    };
    init();
  }, []);

  const loadData = async (vid: string) => {
    setLoading(true);
    const [profileRes, songsRes, followsRes, allProfiles] = await Promise.all([
      supabase.from("music_profiles").select("*").eq("visitor_id", vid).maybeSingle(),
      supabase.from("public_songs").select("*").eq("status", "approved").eq("visibility", "public").order("created_at", { ascending: false }),
      supabase.from("user_follows").select("*").or(`follower_visitor_id.eq.${vid},following_visitor_id.eq.${vid}`),
      supabase.from("music_profiles").select("*").order("created_at", { ascending: false }),
    ]);
    if (profileRes.data) setMyProfile(profileRes.data as MusicProfile);
    if (songsRes.data) setPublicSongs(songsRes.data as PublicSong[]);
    if (followsRes.data) setFollows(followsRes.data as UserFollow[]);
    if (allProfiles.data) setProfiles(allProfiles.data as MusicProfile[]);

    // Load my songs
    const myRes = await supabase.from("public_songs").select("*").eq("visitor_id", vid).order("created_at", { ascending: false });
    if (myRes.data) setMySongs(myRes.data as PublicSong[]);
    setLoading(false);
  };

  const handleCreateProfile = async () => {
    if (!profileUsername.trim() || profileUsername.trim().length < 3) {
      toast({ title: "Username minimal 3 karakter", variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase.from("music_profiles").upsert({
      visitor_id: visitorId,
      username: profileUsername.trim(),
      description: profileDesc.trim(),
    }, { onConflict: "visitor_id" });
    if (error) {
      if (error.message.includes("unique") || error.message.includes("duplicate")) {
        toast({ title: "Username sudah dipakai", variant: "destructive" });
      } else {
        toast({ title: "Gagal menyimpan profil", variant: "destructive" });
      }
    } else {
      toast({ title: "Profil disimpan!" });
      setShowProfileSetup(false);
      await loadData(visitorId);
    }
    setSavingProfile(false);
  };

  const handleUpload = async () => {
    if (!myProfile) {
      setShowProfileSetup(true);
      return;
    }
    if (!uploadTitle.trim() || !uploadFile) {
      toast({ title: "Judul dan file lagu wajib diisi", variant: "destructive" });
      return;
    }
    if (uploadFile.size > MAX_FILE_SIZE) {
      toast({ title: `File terlalu besar! Maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB`, variant: "destructive" });
      return;
    }
    if (uploadCover && uploadCover.size > MAX_COVER_SIZE) {
      toast({ title: `Cover terlalu besar! Maksimal ${MAX_COVER_SIZE / 1024 / 1024}MB`, variant: "destructive" });
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadStep("Mempersiapkan...");
    try {
      // Step 1: Get audio duration (client-side, fast)
      setUploadStep("Membaca metadata audio...");
      setUploadProgress(5);
      let duration = 0;
      try {
        const audio = new Audio(URL.createObjectURL(uploadFile));
        await new Promise<void>((res) => {
          audio.onloadedmetadata = () => { duration = Math.round(audio.duration); res(); };
          audio.onerror = () => res();
          setTimeout(() => res(), 3000);
        });
      } catch {}

      // Step 2: Upload audio file
      setUploadStep("Mengupload file audio...");
      setUploadProgress(15);
      const ext = uploadFile.name.split(".").pop();
      const filePath = `public/${visitorId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("music-files").upload(filePath, uploadFile, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw new Error("Gagal upload audio: " + upErr.message);
      setUploadProgress(70);
      const { data: urlData } = supabase.storage.from("music-files").getPublicUrl(filePath);

      // Step 3: Upload cover (optional)
      let coverUrl = null;
      if (uploadCover) {
        setUploadStep("Mengupload cover...");
        setUploadProgress(75);
        const coverExt = uploadCover.name.split(".").pop();
        const coverPath = `public/covers/${visitorId}/${Date.now()}.${coverExt}`;
        const { error: coverErr } = await supabase.storage.from("music-files").upload(coverPath, uploadCover);
        if (coverErr) console.error("Cover upload error:", coverErr);
        else {
          const { data: coverUrlData } = supabase.storage.from("music-files").getPublicUrl(coverPath);
          coverUrl = coverUrlData.publicUrl;
        }
      }
      setUploadProgress(85);

      // Step 4: Save song record
      setUploadStep("Menyimpan data lagu...");
      const { data: songData, error: songErr } = await supabase.from("public_songs").insert({
        visitor_id: visitorId,
        title: uploadTitle.trim(),
        artist: uploadArtist.trim() || myProfile.username,
        description: uploadDesc.trim(),
        file_url: urlData.publicUrl,
        cover_url: coverUrl,
        duration,
        file_size: uploadFile.size,
        visibility: uploadVisibility,
        status: uploadVisibility === "private" ? "approved" : "pending",
      }).select().single();

      if (songErr) throw new Error("Gagal menyimpan data: " + songErr.message);
      setUploadProgress(95);

      // Step 5: Trigger AI copyright check (non-blocking)
      if (uploadVisibility === "public" && songData) {
        setUploadStep("Memulai pengecekan AI...");
        supabase.functions.invoke("check-copyright", {
          body: { song_id: songData.id, title: uploadTitle.trim(), artist: uploadArtist.trim() || myProfile.username }
        }).catch(console.error);
      }

      setUploadProgress(100);
      setUploadStep("Selesai!");
      toast({ title: uploadVisibility === "public" ? "Lagu diupload! Menunggu persetujuan admin." : "Lagu pribadi diupload!" });
      setUploadTitle(""); setUploadArtist(""); setUploadDesc("");
      setUploadFile(null); setUploadCover(null);
      await loadData(visitorId);
      setSubTab("my-songs");
    } catch (e: any) {
      toast({ title: e.message || "Gagal upload", variant: "destructive" });
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadStep("");
  };

  const handleFollow = async (targetVid: string) => {
    if (!myProfile) { setShowProfileSetup(true); return; }
    const existing = follows.find(f => f.follower_visitor_id === visitorId && f.following_visitor_id === targetVid);
    if (existing) {
      await supabase.from("user_follows").delete().eq("id", existing.id);
    } else {
      await supabase.from("user_follows").insert({ follower_visitor_id: visitorId, following_visitor_id: targetVid });
    }
    await loadData(visitorId);
  };

  const isFollowing = (targetVid: string) => follows.some(f => f.follower_visitor_id === visitorId && f.following_visitor_id === targetVid);
  const followerCount = (vid: string) => follows.filter(f => f.following_visitor_id === vid).length;
  const followingCount = (vid: string) => follows.filter(f => f.follower_visitor_id === vid).length;

  const openProfile = async (profile: MusicProfile) => {
    setViewingProfile(profile);
    const { data } = await supabase.from("public_songs").select("*")
      .eq("visitor_id", profile.visitor_id)
      .eq("status", "approved").eq("visibility", "public")
      .order("created_at", { ascending: false });
    setViewProfileSongs((data || []) as PublicSong[]);
  };

  const getProfileByVid = (vid: string) => profiles.find(p => p.visitor_id === vid);

  const filteredSongs = publicSongs.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProfiles = profiles.filter(p =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase()) && p.visitor_id !== visitorId
  );

  const statusBadge = (status: string) => {
    if (status === "approved") return <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" /> Disetujui</span>;
    if (status === "rejected") return <span className="inline-flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3" /> Ditolak</span>;
    return <span className="inline-flex items-center gap-1 text-xs text-yellow-600"><Clock className="w-3 h-3" /> Menunggu</span>;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shimmer">
        <Loader2 className="animate-spin w-7 h-7 text-primary" />
      </div>
      <p className="text-xs text-muted-foreground font-medium">Memuat komunitas musik...</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Premium Aurora Hero Header */}
      <div className="relative rounded-2xl p-[1.5px] overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(var(--neon-purple)/0.85), hsl(var(--neon-pink)/0.85) 50%, hsl(var(--neon-cyan)/0.85))",
          backgroundSize: "300% 300%",
          animation: "aurora-shift 9s ease infinite",
        }}
      >
        <div className="relative rounded-[14px] bg-background/85 backdrop-blur-xl p-5 overflow-hidden">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-10 -left-8 w-40 h-40 rounded-full blur-3xl opacity-40" style={{ background: "hsl(var(--neon-purple)/0.6)" }} />
          <div className="pointer-events-none absolute -bottom-10 -right-8 w-44 h-44 rounded-full blur-3xl opacity-30" style={{ background: "hsl(var(--neon-cyan)/0.6)" }} />
          <div className="pointer-events-none absolute top-2 right-2 opacity-[0.07]">
            <Music className="w-28 h-28" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-xl opacity-70" style={{ background: "linear-gradient(135deg, hsl(var(--neon-purple)), hsl(var(--neon-pink)))" }} />
                <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, hsl(var(--neon-purple)), hsl(var(--neon-pink)) 50%, hsl(var(--neon-cyan)))" }}>
                  <Globe className="w-5 h-5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-monoton text-xl leading-tight tracking-[0.15em] bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, hsl(var(--neon-cyan)), hsl(var(--neon-pink)))" }}>
                    Musik Publik
                  </h2>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white" style={{ background: "hsl(var(--neon-pink)/0.85)", boxShadow: "0 0 8px hsl(var(--neon-pink)/0.6)" }}>
                    <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Komunitas musik premium · Aurora Edition</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: publicSongs.length, label: "Lagu", color: "var(--neon-cyan)" },
                { val: profiles.length, label: "Pengguna", color: "var(--neon-purple)" },
                { val: mySongs.length, label: "Laguku", color: "var(--neon-pink)" },
              ].map((s, i) => (
                <div key={i} className="relative rounded-xl p-[1px] overflow-hidden" style={{ background: `linear-gradient(135deg, hsl(${s.color}/0.6), transparent)` }}>
                  <div className="rounded-[10px] bg-background/80 backdrop-blur-sm px-3 py-2 text-center">
                    <p className="text-base font-extrabold tabular-nums" style={{ color: `hsl(${s.color})`, textShadow: `0 0 10px hsl(${s.color}/0.6)` }}>{s.val}</p>
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Premium Aurora Sub-Navigation */}
      <div className="relative rounded-2xl p-[1.5px] overflow-hidden"
        style={{
          background: "linear-gradient(120deg, hsl(var(--neon-cyan)/0.7), hsl(var(--neon-purple)/0.7) 50%, hsl(var(--neon-pink)/0.7))",
          backgroundSize: "300% 300%",
          animation: "aurora-shift 8s ease infinite",
        }}
      >
        <div className="relative rounded-[14px] bg-background/85 backdrop-blur-xl p-1.5 overflow-x-auto scrollbar-hide">
          <div className="pointer-events-none absolute -top-6 left-1/4 w-24 h-24 rounded-full blur-3xl opacity-40" style={{ background: "hsl(var(--neon-cyan)/0.6)" }} />
          <div className="pointer-events-none absolute -bottom-8 right-1/4 w-24 h-24 rounded-full blur-3xl opacity-30" style={{ background: "hsl(var(--neon-pink)/0.6)" }} />
          <div className="relative grid grid-cols-4 gap-1.5">
            {([
              { key: "explore" as SubTab, label: "Jelajahi", icon: Globe, color: "var(--neon-cyan)" },
              { key: "upload" as SubTab, label: "Upload", icon: Upload, color: "var(--neon-purple)" },
              { key: "my-songs" as SubTab, label: "Laguku", icon: Music, color: "var(--neon-pink)" },
              { key: "profile" as SubTab, label: "Profil", icon: User, color: "var(--neon-yellow)" },
            ]).map(({ key, label, icon: Icon, color }) => {
              const active = subTab === key;
              return (
                <button
                  key={key}
                  onClick={() => { if (key === "upload" && !myProfile) { setShowProfileSetup(true); return; } setSubTab(key); }}
                  className={`relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-300 overflow-hidden ${
                    active ? "text-white scale-[1.04]" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  style={active ? {
                    background: `linear-gradient(135deg, hsl(${color}/0.95), hsl(${color}/0.6))`,
                    boxShadow: `0 0 18px hsl(${color}/0.5), 0 4px 14px hsl(${color}/0.3), inset 0 1px 0 hsl(0 0% 100%/0.2)`,
                  } : undefined}
                >
                  {active && (
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: "shine-sweep 2.6s ease-in-out infinite" }} />
                  )}
                  <Icon className={`w-4 h-4 relative ${active ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]" : ""}`} />
                  <span className="relative tracking-wide">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Explore Tab */}
      {subTab === "explore" && (
        <div className="space-y-3">
          {/* Audio Device Info */}
          {audioDevices.length > 0 && (() => {
            const preferredDevice = getPreferredAudioDevice();
            return preferredDevice ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                {getDeviceIcon(preferredDevice.label)}
                <span className="truncate">{preferredDevice.label}</span>
                {audioDevices.length > 1 && <span className="text-muted-foreground/60 ml-auto">+{audioDevices.length - 1}</span>}
              </div>
            ) : null;
          })()}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cari lagu atau user..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="pl-9" />
          </div>

          {searchQuery && filteredProfiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Pengguna</h3>
              {filteredProfiles.map(p => (
                <Card key={p.id} className="cursor-pointer hover:bg-accent/50 transition" onClick={() => openProfile(p)}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {p.username[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{p.username}</div>
                        <div className="text-xs text-muted-foreground">{followerCount(p.visitor_id)} pengikut</div>
                      </div>
                    </div>
                    <Button size="sm" variant={isFollowing(p.visitor_id) ? "secondary" : "default"}
                      onClick={e => { e.stopPropagation(); handleFollow(p.visitor_id); }}>
                      {isFollowing(p.visitor_id) ? <><UserMinus className="w-3 h-3 mr-1" /> Unfollow</> : <><UserPlus className="w-3 h-3 mr-1" /> Follow</>}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {!searchQuery && <h3 className="text-sm font-semibold text-muted-foreground">Lagu Publik</h3>}
          {filteredSongs.length === 0 && (
              <div className="flex flex-col items-center py-8 gap-2">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <Music className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Belum ada lagu publik</p>
              </div>
            )}
            {filteredSongs.map(song => {
              const profile = getProfileByVid(song.visitor_id);
              return (
                <Card key={song.id} className="overflow-hidden glass-card hover:shadow-lg hover:scale-[1.01] transition-all duration-200 border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {song.cover_url ? (
                        <img src={song.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center">
                          <Music className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{song.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                        {profile && (
                          <button className="text-[10px] text-primary font-semibold hover:underline" onClick={() => openProfile(profile)}>
                            @{profile.username}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full" onClick={() => handleShare(`${song.title} - ${song.artist}`, window.location.href)}>
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20" onClick={() => onPlaySong?.({
                          id: song.id, title: song.title, artist: song.artist, file_url: song.file_url, cover_url: song.cover_url
                        })}>
                          <Play className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Tab */}
      {subTab === "upload" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Lagu</h3>
            <Input placeholder="Judul lagu *" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
            <Input placeholder="Artis (kosong = username kamu)" value={uploadArtist} onChange={e => setUploadArtist(e.target.value)} />
            <Textarea placeholder="Deskripsi lagu..." value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} rows={2} />
            
            <div className="flex gap-2">
              <Button variant={uploadVisibility === "public" ? "default" : "outline"} size="sm"
                onClick={() => setUploadVisibility("public")} className="gap-1">
                <Globe className="w-3.5 h-3.5" /> Publik
              </Button>
              <Button variant={uploadVisibility === "private" ? "default" : "outline"} size="sm"
                onClick={() => setUploadVisibility("private")} className="gap-1">
                <Lock className="w-3.5 h-3.5" /> Pribadi
              </Button>
            </div>
            {uploadVisibility === "public" && (
              <p className="text-xs text-yellow-600">⚠️ Lagu publik akan dicek AI & perlu persetujuan admin sebelum tampil</p>
            )}

            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0] || null;
                if (f && f.size > MAX_FILE_SIZE) {
                  toast({ title: `File terlalu besar! Maks ${MAX_FILE_SIZE / 1024 / 1024}MB`, variant: "destructive" });
                  return;
                }
                setUploadFile(f);
              }} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full gap-1">
                <Music className="w-3.5 h-3.5" /> {uploadFile ? `${uploadFile.name} (${(uploadFile.size / 1024 / 1024).toFixed(1)}MB)` : "Pilih file audio * (maks 20MB)"}
              </Button>
              <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0] || null;
                if (f && f.size > MAX_COVER_SIZE) {
                  toast({ title: `Cover terlalu besar! Maks ${MAX_COVER_SIZE / 1024 / 1024}MB`, variant: "destructive" });
                  return;
                }
                setUploadCover(f);
              }} />
              <Button variant="outline" size="sm" onClick={() => coverRef.current?.click()} className="w-full gap-1">
                🖼️ {uploadCover ? uploadCover.name : "Cover (opsional, maks 5MB)"}
              </Button>
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{uploadStep} ({uploadProgress}%)</p>
              </div>
            )}

            <Button onClick={handleUpload} disabled={uploading} className="w-full">
              {uploading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? uploadStep : "Upload"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* My Songs Tab */}
      {subTab === "my-songs" && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Lagu Saya ({mySongs.length})</h3>
          {mySongs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada lagu yang diupload</p>}
          {mySongs.map(song => (
            <Card key={song.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {song.cover_url ? (
                    <img src={song.cover_url} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{song.title}</div>
                    <div className="flex items-center gap-2 text-xs">
                      {song.visibility === "private" ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                      {statusBadge(song.status)}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => onPlaySong?.({
                    id: song.id, title: song.title, artist: song.artist, file_url: song.file_url, cover_url: song.cover_url
                  })}>
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Profile Tab */}
      {subTab === "profile" && (
        <div className="space-y-3">
          {myProfile ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                    {myProfile.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{myProfile.username}</div>
                    <div className="text-xs text-muted-foreground">{myProfile.description || "Belum ada deskripsi"}</div>
                    <div className="flex gap-3 text-xs mt-1">
                      <span><strong>{followerCount(visitorId)}</strong> Pengikut</span>
                      <span><strong>{followingCount(visitorId)}</strong> Mengikuti</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setProfileUsername(myProfile.username); setProfileDesc(myProfile.description || ""); setShowProfileSetup(true); }}>
                    Edit Profil
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleShare(`Profil musik @${myProfile.username}`, window.location.href)}>
                    <Share2 className="w-3 h-3 mr-1" /> Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 text-center space-y-2">
                <User className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Buat profil untuk mulai upload dan berinteraksi</p>
                <Button onClick={() => setShowProfileSetup(true)}>Buat Profil</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Profile Setup Dialog */}
      <Dialog open={showProfileSetup} onOpenChange={setShowProfileSetup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Profil Musik</DialogTitle>
            <DialogDescription>Username dan deskripsi untuk komunitas musik</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Username (min 3 karakter) *" value={profileUsername} onChange={e => setProfileUsername(e.target.value)} />
            <Textarea placeholder="Deskripsi tentang kamu..." value={profileDesc} onChange={e => setProfileDesc(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button onClick={handleCreateProfile} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={!!viewingProfile} onOpenChange={() => setViewingProfile(null)}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          {viewingProfile && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {viewingProfile.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div>{viewingProfile.username}</div>
                    <div className="text-xs font-normal text-muted-foreground">{viewingProfile.description || ""}</div>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  <span className="flex gap-3 text-xs mt-1">
                    <span><strong>{followerCount(viewingProfile.visitor_id)}</strong> Pengikut</span>
                    <span><strong>{followingCount(viewingProfile.visitor_id)}</strong> Mengikuti</span>
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                {viewingProfile.visitor_id !== visitorId && (
                  <Button size="sm" variant={isFollowing(viewingProfile.visitor_id) ? "secondary" : "default"}
                    onClick={() => handleFollow(viewingProfile.visitor_id)}>
                    {isFollowing(viewingProfile.visitor_id) ? <><UserMinus className="w-3 h-3 mr-1" /> Unfollow</> : <><UserPlus className="w-3 h-3 mr-1" /> Follow</>}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleShare(`Profil musik @${viewingProfile.username}`, window.location.href)}>
                  <Share2 className="w-3 h-3 mr-1" /> Share
                </Button>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Lagu ({viewProfileSongs.length})</h4>
                {viewProfileSongs.map(song => (
                  <div key={song.id} className="flex items-center gap-2 p-2 rounded hover:bg-accent/50 cursor-pointer"
                    onClick={() => onPlaySong?.({ id: song.id, title: song.title, artist: song.artist, file_url: song.file_url, cover_url: song.cover_url })}>
                    {song.cover_url ? <img src={song.cover_url} alt="" className="w-8 h-8 rounded object-cover" /> :
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center"><Music className="w-3 h-3 text-primary" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{song.title}</div>
                      <div className="text-xs text-muted-foreground">{song.artist}</div>
                    </div>
                    <Play className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
                {viewProfileSongs.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Belum ada lagu</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MusicPublicTab;

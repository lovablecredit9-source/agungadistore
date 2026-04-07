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
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadArtist, setUploadArtist] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadVisibility, setUploadVisibility] = useState<"public" | "private">("public");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCover, setUploadCover] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

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

  // Detect audio output devices
  useEffect(() => {
    const detectDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const outputs = allDevices.filter(d => d.kind === "audiooutput").map(d => ({ deviceId: d.deviceId, label: d.label || "Perangkat Audio" }));
        setAudioDevices(outputs);
      } catch {}
    };
    detectDevices();
    navigator.mediaDevices?.addEventListener("devicechange", detectDevices);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", detectDevices);
  }, []);

  const getDeviceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("bluetooth") || l.includes("bt") || l.includes("airpod") || l.includes("buds")) return <Bluetooth className="w-3.5 h-3.5 text-blue-500" />;
    if (l.includes("headphone") || l.includes("headset")) return <Headphones className="w-3.5 h-3.5 text-primary" />;
    if (l.includes("speaker") || l.includes("external")) return <Speaker className="w-3.5 h-3.5 text-primary" />;
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
    setUploading(true);
    try {
      const ext = uploadFile.name.split(".").pop();
      const filePath = `public/${visitorId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("music-files").upload(filePath, uploadFile);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("music-files").getPublicUrl(filePath);

      let coverUrl = null;
      if (uploadCover) {
        const coverExt = uploadCover.name.split(".").pop();
        const coverPath = `public/covers/${visitorId}/${Date.now()}.${coverExt}`;
        await supabase.storage.from("music-files").upload(coverPath, uploadCover);
        const { data: coverUrlData } = supabase.storage.from("music-files").getPublicUrl(coverPath);
        coverUrl = coverUrlData.publicUrl;
      }

      // Get audio duration
      let duration = 0;
      try {
        const audio = new Audio(URL.createObjectURL(uploadFile));
        await new Promise<void>((res) => {
          audio.onloadedmetadata = () => { duration = Math.round(audio.duration); res(); };
          audio.onerror = () => res();
          setTimeout(() => res(), 3000);
        });
      } catch {}

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

      if (songErr) throw songErr;

      // Trigger AI copyright check for public songs
      if (uploadVisibility === "public" && songData) {
        supabase.functions.invoke("check-copyright", {
          body: { song_id: songData.id, title: uploadTitle.trim(), artist: uploadArtist.trim() || myProfile.username }
        }).catch(console.error);
      }

      toast({ title: uploadVisibility === "public" ? "Lagu diupload! Menunggu persetujuan admin." : "Lagu pribadi diupload!" });
      setUploadTitle(""); setUploadArtist(""); setUploadDesc("");
      setUploadFile(null); setUploadCover(null);
      await loadData(visitorId);
      setSubTab("my-songs");
    } catch (e: any) {
      toast({ title: "Gagal upload: " + (e.message || ""), variant: "destructive" });
    }
    setUploading(false);
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

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {[
          { key: "explore" as SubTab, label: "Jelajahi", icon: Globe },
          { key: "upload" as SubTab, label: "Upload", icon: Upload },
          { key: "my-songs" as SubTab, label: "Laguku", icon: Music },
          { key: "profile" as SubTab, label: "Profil", icon: User },
        ].map(tab => (
          <Button key={tab.key} variant={subTab === tab.key ? "default" : "ghost"} size="sm"
            onClick={() => { if (tab.key === "upload" && !myProfile) { setShowProfileSetup(true); return; } setSubTab(tab.key); }}
            className="gap-1 text-xs whitespace-nowrap">
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </Button>
        ))}
      </div>

      {/* Explore Tab */}
      {subTab === "explore" && (
        <div className="space-y-3">
          {/* Audio Device Info */}
          {audioDevices.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {getDeviceIcon(audioDevices.find(d => d.label.toLowerCase().includes("bluetooth") || d.label.toLowerCase().includes("bt"))?.label || audioDevices[0].label)}
              <span className="truncate">
                {audioDevices.find(d => d.label.toLowerCase().includes("bluetooth") || d.label.toLowerCase().includes("bt"))?.label || audioDevices[0].label}
              </span>
              {audioDevices.length > 1 && <span className="text-muted-foreground/60 ml-auto">+{audioDevices.length - 1}</span>}
            </div>
          )}
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
            {filteredSongs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada lagu publik</p>}
            {filteredSongs.map(song => {
              const profile = getProfileByVid(song.visitor_id);
              return (
                <Card key={song.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {song.cover_url ? (
                        <img src={song.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Music className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{song.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{song.artist}</div>
                        {profile && (
                          <button className="text-xs text-primary hover:underline" onClick={() => openProfile(profile)}>
                            @{profile.username}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleShare(`${song.title} - ${song.artist}`, window.location.href)}>
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => onPlaySong?.({
                          id: song.id, title: song.title, artist: song.artist, file_url: song.file_url, cover_url: song.cover_url
                        })}>
                          <Play className="w-4 h-4" />
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
              <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full gap-1">
                <Music className="w-3.5 h-3.5" /> {uploadFile ? uploadFile.name : "Pilih file audio *"}
              </Button>
              <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => setUploadCover(e.target.files?.[0] || null)} />
              <Button variant="outline" size="sm" onClick={() => coverRef.current?.click()} className="w-full gap-1">
                🖼️ {uploadCover ? uploadCover.name : "Cover (opsional)"}
              </Button>
            </div>

            <Button onClick={handleUpload} disabled={uploading} className="w-full">
              {uploading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload
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

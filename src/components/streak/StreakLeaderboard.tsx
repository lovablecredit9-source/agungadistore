import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Crown, Medal, Award, Loader2, UserPlus, Pencil, Camera } from "lucide-react";
import { getVisitorId } from "@/lib/visitor-id";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface LeaderboardEntry {
  id: string;
  visitor_id: string;
  current_streak: number;
  longest_streak: number;
  total_claims: number;
  total_bonus_points: number;
  display_name: string;
  avatar_url: string | null;
}

interface StreakProfile {
  id?: string;
  visitor_id: string;
  username: string;
  avatar_url: string | null;
  description: string;
}

export default function StreakLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myProfile, setMyProfile] = useState<StreakProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ username: "", description: "", avatar_url: "" });
  const visitorId = getVisitorId();

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: lb }, { data: prof }] = await Promise.all([
      supabase.from("streak_leaderboard" as any).select("*").limit(10),
      supabase.from("streak_profiles_public" as any).select("*").eq("visitor_id", visitorId).maybeSingle(),
    ]);
    if (lb) {
      setEntries(lb as unknown as LeaderboardEntry[]);
      const myIdx = (lb as any[]).findIndex((e: any) => e.visitor_id === visitorId);
      setMyRank(myIdx >= 0 ? myIdx + 1 : null);
    }
    if (prof) {
      const p = prof as any;
      setMyProfile({ id: p.id, visitor_id: p.visitor_id, username: p.username, avatar_url: p.avatar_url, description: p.description || "" });
      setForm({ username: p.username || "", description: p.description || "", avatar_url: p.avatar_url || "" });
    }
    setLoading(false);
  }

  function getRankIcon(rank: number) {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" fill="currentColor" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-orange-600" />;
    return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{rank}</span>;
  }

  function getRankGradient(rank: number) {
    if (rank === 1) return "from-yellow-400 via-amber-500 to-orange-600";
    if (rank === 2) return "from-slate-300 via-slate-400 to-slate-500";
    if (rank === 3) return "from-orange-400 via-orange-500 to-orange-700";
    return "from-muted to-muted";
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 2MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `streak-avatars/${visitorId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Gagal upload foto");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
    setForm(f => ({ ...f, avatar_url: data.publicUrl }));
    setUploading(false);
    toast.success("Foto siap disimpan");
  }

  async function handleSave() {
    const username = form.username.trim();
    if (username.length < 3) {
      toast.error("Username minimal 3 karakter");
      return;
    }
    if (username.length > 24) {
      toast.error("Username maksimal 24 karakter");
      return;
    }
    setSaving(true);
    const payload = {
      visitor_id: visitorId,
      username,
      avatar_url: form.avatar_url || null,
      description: form.description.trim(),
    };
    let error;
    if (myProfile?.id) {
      ({ error } = await supabase.from("streak_profiles" as any).update(payload).eq("visitor_id", visitorId));
    } else {
      ({ error } = await supabase.from("streak_profiles" as any).insert(payload));
    }
    if (error) {
      toast.error(error.message?.includes("duplicate") ? "Username/profil sudah ada" : "Gagal menyimpan");
      setSaving(false);
      return;
    }
    toast.success(myProfile ? "Profil streak diperbarui!" : "Profil streak dibuat! 🎉");
    setDialogOpen(false);
    setSaving(false);
    fetchAll();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card-strong rounded-2xl border p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" /> Top 10 Streak Champion
          </h4>
          <div className="flex items-center gap-1.5">
            {myRank !== null && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/20 text-primary">
                Rank #{myRank}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="h-7 px-2 gap-1 text-[10px] font-bold border-primary/40 text-primary hover:bg-primary/10"
            >
              {myProfile ? <><Pencil className="w-3 h-3" /> Edit</> : <><UserPlus className="w-3 h-3" /> Buat Profil</>}
            </Button>
          </div>
        </div>

        {!myProfile && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-primary/10 border border-primary/30 rounded-lg p-2.5 text-[10px] text-primary font-medium flex items-start gap-1.5"
          >
            <Trophy className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Buat profil Streak (username + foto sendiri) untuk masuk leaderboard. Terpisah dari profil game!</span>
          </motion.div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Belum ada juara. Buat profil & jadi yang pertama!</p>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry, i) => {
              const rank = i + 1;
              const isMe = entry.visitor_id === visitorId;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-2.5 rounded-xl p-2.5 transition-all ${
                    isMe ? "bg-primary/15 border border-primary/40 shadow-md" : "bg-muted/40"
                  } ${rank <= 3 ? "relative overflow-hidden" : ""}`}
                >
                  {rank <= 3 && (
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-r ${getRankGradient(rank)} opacity-10`}
                      animate={{ opacity: [0.05, 0.15, 0.05] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2.5 w-full">
                    <div className="w-7 h-7 flex items-center justify-center shrink-0">
                      {getRankIcon(rank)}
                    </div>
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt={entry.display_name} className="w-9 h-9 rounded-full object-cover border-2 border-border" />
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br ${getRankGradient(rank)}`}>
                        {entry.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">
                        {entry.display_name} {isMe && <span className="text-primary">(Kamu)</span>}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Flame className="w-3 h-3 icon-3d-flame" strokeWidth={2.5} /> {entry.current_streak}</span>
                        <span className="flex items-center gap-1"><Trophy className="w-3 h-3 icon-3d-trophy" strokeWidth={2.5} /> {entry.longest_streak}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold text-foreground">{entry.longest_streak}</p>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-wider">terbaik</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {myProfile ? "Edit Profil Streak" : "Buat Profil Streak"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Profil khusus untuk leaderboard streak. Terpisah dari profil game & saldo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="avatar" className="w-20 h-20 rounded-full object-cover border-4 border-primary/30" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center text-2xl font-extrabold text-white border-4 border-primary/30">
                    {(form.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">Maks 2MB</p>
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label className="text-xs font-bold">Username Streak <span className="text-destructive">*</span></label>
              <Input
                value={form.username}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="Contoh: StreakMaster"
                maxLength={24}
                className="h-10"
              />
              <p className="text-[10px] text-muted-foreground">3-24 karakter. Akan tampil di leaderboard.</p>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-bold">Bio (opsional)</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ceritakan dirimu..."
                maxLength={120}
                rows={2}
                className="resize-none"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || uploading || form.username.trim().length < 3}
              className="w-full h-11 font-bold bg-gradient-to-r from-yellow-500 to-orange-600 hover:opacity-90"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Menyimpan...</> : myProfile ? "Update Profil" : "Buat Profil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

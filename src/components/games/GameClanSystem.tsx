import { useEffect, useState } from "react";
import { Shield, Users, Plus, Trophy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Props { visitorId: string | null }

interface Clan {
  tag: string;
  name: string;
  motto: string;
  level: number;
  members: number;
  trophies: number;
}

const SUGGESTED: Clan[] = [
  { tag: "NXS", name: "Nexus Reborn", motto: "Never lose hope!", level: 12, members: 28, trophies: 14820 },
  { tag: "DRG", name: "Dragon Slayers", motto: "We breathe fire", level: 9, members: 22, trophies: 9540 },
  { tag: "SHD", name: "Shadow Wolves", motto: "Hunt as one", level: 7, members: 18, trophies: 6210 },
  { tag: "CYB", name: "Cyber Punks", motto: "Hack the planet", level: 5, members: 12, trophies: 3120 },
];

export default function GameClanSystem({ visitorId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"my" | "browse" | "create">("my");
  const [my, setMy] = useState<Clan | null>(null);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [motto, setMotto] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visitorId) return;
    try {
      const raw = localStorage.getItem(`clan_${visitorId}`);
      if (raw) setMy(JSON.parse(raw));
    } catch { /* noop */ }
  }, [visitorId]);

  function persist(c: Clan | null) {
    if (!visitorId) return;
    try { c ? localStorage.setItem(`clan_${visitorId}`, JSON.stringify(c)) : localStorage.removeItem(`clan_${visitorId}`); } catch { /* noop */ }
  }

  function joinClan(c: Clan) {
    setMy(c);
    persist(c);
    toast({ title: `🛡️ Bergabung dengan ${c.name}`, description: `Tag: [${c.tag}]` });
    setTab("my");
  }

  function leaveClan() {
    setMy(null); persist(null);
    toast({ title: "Keluar dari klan", description: "Kamu tidak tergabung di klan manapun." });
  }

  async function createClan() {
    if (!name.trim() || !tag.trim()) { toast({ title: "Lengkapi nama & tag" }); return; }
    setCreating(true);
    setTimeout(() => {
      const c: Clan = { tag: tag.toUpperCase().slice(0, 4), name: name.trim().slice(0, 24), motto: motto.trim().slice(0, 40) || "Nakama forever", level: 1, members: 1, trophies: 0 };
      setMy(c); persist(c); setCreating(false);
      toast({ title: `✨ Klan ${c.name} dibuat!`, description: `Tag [${c.tag}] siap berperang.` });
      setTab("my");
    }, 900);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)} disabled={!visitorId}
        className="w-full cyber-card-cyan rounded-2xl p-3 text-left relative overflow-hidden disabled:opacity-50"
      >
        <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/30 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-3">
          <Shield className="w-9 h-9 icon-3d-zap" strokeWidth={2.5} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest neon-text-cyan uppercase">Clan / Guild</div>
            <div className="font-extrabold text-white text-sm truncate">{my ? `[${my.tag}] ${my.name}` : "Bergabung atau buat klanmu"}</div>
            <div className="text-[10px] text-white/70">{my ? `Lvl ${my.level} • ${my.members} member • 🏆 ${my.trophies}` : "Perang klan, leaderboard guild"}</div>
          </div>
          <Users className="w-4 h-4 text-cyan-300" />
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-cyan-950 via-slate-950 to-purple-950 border-cyan-500/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="neon-gradient-text text-xl font-black flex items-center gap-2"><Shield className="w-5 h-5" /> CLAN HALL</DialogTitle></DialogHeader>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-black/40 border border-cyan-500/30">
            {[{ id: "my", l: "Klan-ku" }, { id: "browse", l: "Cari" }, { id: "create", l: "Buat" }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`py-1.5 rounded-md text-[11px] font-black ${tab === t.id ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white" : "text-white/60"}`}>{t.l}</button>
            ))}
          </div>

          {tab === "my" && (
            my ? (
              <div className="space-y-3">
                <div className="rounded-2xl p-4 bg-gradient-to-br from-cyan-600/30 to-purple-600/30 border border-cyan-400/40">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-pink-500 flex items-center justify-center text-2xl font-black text-black shadow-lg">{my.tag}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-white text-lg truncate">{my.name}</div>
                      <div className="text-[11px] text-white/70 italic truncate">"{my.motto}"</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-black/40 rounded-lg p-1.5"><div className="text-[9px] text-white/60 uppercase">Level</div><div className="font-black text-white">{my.level}</div></div>
                    <div className="bg-black/40 rounded-lg p-1.5"><div className="text-[9px] text-white/60 uppercase">Member</div><div className="font-black text-white">{my.members}</div></div>
                    <div className="bg-black/40 rounded-lg p-1.5"><div className="text-[9px] text-white/60 uppercase">Trofi</div><div className="font-black neon-text-yellow flex items-center justify-center gap-0.5"><Trophy className="w-3 h-3" />{my.trophies}</div></div>
                  </div>
                </div>
                <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                  <div className="text-[11px] font-black neon-text-pink uppercase mb-2">Perang Klan Mingguan</div>
                  <div className="text-[11px] text-white/70 mb-2">Mainkan game AI untuk kontribusi ke trofi klan!</div>
                  <Button size="sm" disabled className="w-full h-7 text-[10px] bg-pink-500/30 text-pink-200">Berlangsung — kontribusi otomatis</Button>
                </div>
                <Button onClick={leaveClan} variant="destructive" className="w-full h-8 text-[11px]">Keluar Klan</Button>
              </div>
            ) : <p className="text-center text-white/60 text-sm py-6">Kamu belum tergabung di klan.</p>
          )}

          {tab === "browse" && (
            <div className="space-y-2">
              {SUGGESTED.map(c => (
                <div key={c.tag} className="rounded-xl bg-black/30 border border-white/10 p-2.5 flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center font-black text-black text-sm shrink-0">{c.tag}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">{c.name}</div>
                    <div className="text-[10px] text-white/60 truncate">Lvl {c.level} • {c.members} member • 🏆 {c.trophies}</div>
                  </div>
                  <Button size="sm" disabled={!!my} onClick={() => joinClan(c)} className="h-7 text-[10px] bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black">{my ? "—" : "JOIN"}</Button>
                </div>
              ))}
            </div>
          )}

          {tab === "create" && (
            <div className="space-y-2">
              <Input placeholder="Nama klan (max 24)" maxLength={24} value={name} onChange={e => setName(e.target.value)} className="bg-black/40 border-cyan-500/30 text-white" />
              <Input placeholder="Tag (max 4 huruf)" maxLength={4} value={tag} onChange={e => setTag(e.target.value.toUpperCase())} className="bg-black/40 border-cyan-500/30 text-white uppercase" />
              <Input placeholder="Motto klan (opsional)" maxLength={40} value={motto} onChange={e => setMotto(e.target.value)} className="bg-black/40 border-cyan-500/30 text-white" />
              <Button onClick={createClan} disabled={creating || !!my} className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Buat Klan</>}
              </Button>
              {my && <p className="text-[10px] text-yellow-300 text-center">Keluar dulu dari klan saat ini untuk membuat klan baru.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

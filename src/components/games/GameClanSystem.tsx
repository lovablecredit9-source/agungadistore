import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Loader2, Crown, Search, Lock, Globe, LogOut, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props { visitorId: string | null }
interface Clan { id: string; name: string; tag: string; motto: string; visibility: string; join_code: string | null; leader_visitor_id: string; leader_name: string; member_count: number; max_members: number; level: number; total_xp: number; }
interface Member { id: string; visitor_id: string; display_name: string; role: string; contributed_xp: number; }

function randomCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }

export default function GameClanSystem({ visitorId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(""); const [tag, setTag] = useState(""); const [motto, setMotto] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [search, setSearch] = useState(""); const [results, setResults] = useState<Clan[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [myName, setMyName] = useState("Member");

  useEffect(() => { if (visitorId && open) loadAll(); /* eslint-disable-next-line */ }, [visitorId, open]);

  async function loadAll() {
    if (!visitorId) return;
    setLoading(true);
    const { data: gp } = await supabase.from("game_profiles").select("display_name").eq("visitor_id", visitorId).maybeSingle();
    setMyName(gp?.display_name || `Player_${visitorId.slice(0, 4)}`);
    const { data: mem } = await supabase.from("game_clan_members").select("clan_id").eq("visitor_id", visitorId).maybeSingle();
    if (mem) {
      const { data: clan } = await supabase.from("game_clans").select("*").eq("id", mem.clan_id).maybeSingle();
      setMyClan(clan as any);
      if (clan) {
        const { data: ms } = await supabase.from("game_clan_members").select("*").eq("clan_id", clan.id).order("contributed_xp", { ascending: false });
        setMembers((ms || []) as any);
      }
    } else {
      setMyClan(null); setMembers([]);
      doSearch("");
    }
    setLoading(false);
  }

  async function doSearch(q: string) {
    const base = supabase.from("game_clans").select("*").eq("visibility", "public").order("total_xp", { ascending: false }).limit(20);
    const { data } = q.trim() ? await base.or(`name.ilike.%${q}%,tag.ilike.%${q}%`) : await base;
    setResults((data || []) as any);
  }

  async function createClan() {
    if (!visitorId) return;
    if (name.trim().length < 3) { toast({ title: "Nama min 3 karakter", variant: "destructive" }); return; }
    if (!/^[A-Za-z0-9]{2,5}$/.test(tag.trim())) { toast({ title: "Tag 2-5 huruf/angka", variant: "destructive" }); return; }
    setLoading(true);
    const code = isPrivate ? randomCode() : null;
    const { data: clan, error } = await supabase.from("game_clans").insert({
      name: name.trim(), tag: tag.trim().toUpperCase(), motto: motto.trim(),
      visibility: isPrivate ? "private" : "public", join_code: code,
      leader_visitor_id: visitorId, leader_name: myName, member_count: 1,
    }).select().single();
    if (error) { toast({ title: "Gagal buat clan", description: error.message, variant: "destructive" }); setLoading(false); return; }
    await supabase.from("game_clan_members").insert({
      clan_id: clan.id, visitor_id: visitorId, display_name: myName, role: "leader",
    });
    toast({ title: "🛡️ Clan dibuat!", description: code ? `Kode privat: ${code}` : "Klan publik aktif" });
    setName(""); setTag(""); setMotto(""); setIsPrivate(false);
    loadAll();
  }

  async function joinClan(c: Clan, useCode?: string) {
    if (!visitorId) return;
    if (c.visibility === "private" && c.join_code !== useCode) {
      toast({ title: "Kode salah", variant: "destructive" }); return;
    }
    if (c.member_count >= c.max_members) { toast({ title: "Clan penuh", variant: "destructive" }); return; }
    setLoading(true);
    const { error: e1 } = await supabase.from("game_clan_members").insert({
      clan_id: c.id, visitor_id: visitorId, display_name: myName,
    });
    if (e1) { toast({ title: "Sudah di clan lain", description: "Keluar dulu untuk bergabung", variant: "destructive" }); setLoading(false); return; }
    await supabase.from("game_clans").update({ member_count: c.member_count + 1 }).eq("id", c.id);
    toast({ title: `🎉 Gabung ${c.name}!` });
    loadAll();
  }

  async function joinByCode() {
    const c = results.find(r => r.join_code === joinCode);
    if (c) { joinClan(c, joinCode); return; }
    const { data } = await supabase.from("game_clans").select("*").eq("join_code", joinCode.trim()).maybeSingle();
    if (!data) { toast({ title: "Kode tidak ditemukan", variant: "destructive" }); return; }
    joinClan(data as any, joinCode.trim());
  }

  async function leaveClan() {
    if (!myClan || !visitorId) return;
    const isLeader = myClan.leader_visitor_id === visitorId;
    setLoading(true);
    if (isLeader && myClan.member_count <= 1) {
      await supabase.from("game_clans").delete().eq("id", myClan.id);
      toast({ title: "Clan dibubarkan" });
    } else if (isLeader) {
      toast({ title: "Pindah leader dulu", description: "Leader tidak bisa keluar saat ada anggota lain", variant: "destructive" });
      setLoading(false); return;
    } else {
      await supabase.from("game_clan_members").delete().eq("clan_id", myClan.id).eq("visitor_id", visitorId);
      await supabase.from("game_clans").update({ member_count: Math.max(1, myClan.member_count - 1) }).eq("id", myClan.id);
      toast({ title: "Keluar dari clan" });
    }
    loadAll();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!visitorId}
        className="w-full cyber-card-cyan rounded-2xl p-3 text-left relative overflow-hidden disabled:opacity-50">
        <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/30 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-3">
          <Users className="w-9 h-9 icon-3d-trophy" strokeWidth={2.5} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest neon-text-cyan uppercase">Clan / Guild</div>
            <div className="font-extrabold text-white text-sm">{myClan ? `${myClan.name} [${myClan.tag}]` : "Buat / Cari Klan"}</div>
            <div className="text-[10px] text-white/70">{myClan ? `Lv ${myClan.level} • ${myClan.member_count}/${myClan.max_members} anggota` : "Bangun komunitas"}</div>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white">{myClan ? "OPEN" : "JOIN"}</span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-cyan-950 via-slate-950 to-blue-950 border-cyan-500/40 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-black text-white flex items-center gap-2"><Users className="w-5 h-5 text-cyan-400" /> CLAN HQ</DialogTitle></DialogHeader>

          {loading && <div className="py-6 text-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto" /></div>}

          {!loading && myClan && (
            <div className="space-y-3">
              <div className="rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-black text-white">{myClan.name} <span className="text-cyan-300 text-sm">[{myClan.tag}]</span></div>
                    <div className="text-[11px] text-white/70 italic">"{myClan.motto || "—"}"</div>
                  </div>
                  <div className="text-center">
                    <Crown className="w-6 h-6 text-yellow-300 mx-auto" />
                    <div className="text-[9px] font-black text-white/70">Lv {myClan.level}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="bg-black/30 rounded-lg p-1.5"><div className="text-sm font-black neon-text-cyan">{myClan.member_count}/{myClan.max_members}</div><div className="text-[9px] text-white/60">ANGGOTA</div></div>
                  <div className="bg-black/30 rounded-lg p-1.5"><div className="text-sm font-black neon-text-yellow">{myClan.total_xp.toLocaleString("id-ID")}</div><div className="text-[9px] text-white/60">TOTAL XP</div></div>
                  <div className="bg-black/30 rounded-lg p-1.5"><div className="text-sm font-black text-pink-300">{myClan.visibility === "private" ? <Lock className="w-3 h-3 mx-auto" /> : <Globe className="w-3 h-3 mx-auto" />}</div><div className="text-[9px] text-white/60">{myClan.visibility.toUpperCase()}</div></div>
                </div>
                {myClan.join_code && myClan.leader_visitor_id === visitorId && (
                  <div className="mt-2 flex items-center justify-between bg-black/40 rounded-lg p-2">
                    <span className="text-[10px] text-white/70">KODE INVITE:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-black text-cyan-300 tabular-nums tracking-widest">{myClan.join_code}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(myClan.join_code!); toast({ title: "Kode disalin" }); }}><Copy className="w-3 h-3" /></Button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-black text-white/60 uppercase tracking-wider mb-2">Anggota</div>
                <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                  {members.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-2 bg-black/30 rounded-lg p-2">
                      <span className="text-[10px] font-black text-white/40 w-5">#{i + 1}</span>
                      <span className="flex-1 text-xs font-bold text-white truncate">{m.display_name}</span>
                      {m.role === "leader" && <Crown className="w-3 h-3 text-yellow-300" />}
                      <span className="text-[10px] font-black neon-text-yellow tabular-nums">{m.contributed_xp} XP</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={leaveClan} variant="destructive" className="w-full"><LogOut className="w-4 h-4 mr-1" /> {myClan.leader_visitor_id === visitorId ? "Bubarkan Clan" : "Keluar Clan"}</Button>
            </div>
          )}

          {!loading && !myClan && (
            <Tabs defaultValue="search">
              <TabsList className="grid w-full grid-cols-3 bg-black/40">
                <TabsTrigger value="search" className="text-[11px] font-black"><Search className="w-3 h-3 mr-1" /> Cari</TabsTrigger>
                <TabsTrigger value="code" className="text-[11px] font-black"><Lock className="w-3 h-3 mr-1" /> Kode</TabsTrigger>
                <TabsTrigger value="create" className="text-[11px] font-black"><Plus className="w-3 h-3 mr-1" /> Buat</TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-2 mt-3">
                <div className="flex gap-1.5">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / tag..." className="bg-black/40 border-cyan-500/30 text-white h-9 text-xs" />
                  <Button size="sm" onClick={() => doSearch(search)} className="bg-cyan-500 text-white"><Search className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                  {results.length === 0 && <div className="text-center text-xs text-white/50 py-4">Belum ada clan publik. Jadilah yang pertama!</div>}
                  {results.map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-black/40 rounded-lg p-2 border border-cyan-500/20">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-white text-[10px]">{c.tag}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-extrabold text-white truncate">{c.name}</div>
                        <div className="text-[9px] text-white/60">Lv {c.level} • {c.member_count}/{c.max_members} • {c.total_xp.toLocaleString("id-ID")} XP</div>
                      </div>
                      <Button size="sm" onClick={() => joinClan(c)} disabled={c.member_count >= c.max_members} className="h-7 text-[10px] bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black">JOIN</Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="code" className="space-y-2 mt-3">
                <p className="text-[11px] text-white/70">Masukkan kode 6-digit dari leader clan privat.</p>
                <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" className="text-center text-2xl font-black tracking-widest bg-black/40 border-cyan-500/30 text-white" />
                <Button onClick={joinByCode} disabled={joinCode.length !== 6} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black">GABUNG VIA KODE</Button>
              </TabsContent>

              <TabsContent value="create" className="space-y-2 mt-3">
                <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} placeholder="Nama Clan (3-30)" className="bg-black/40 border-cyan-500/30 text-white h-9 text-xs" />
                <Input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))} placeholder="TAG (2-5)" className="bg-black/40 border-cyan-500/30 text-white h-9 text-xs uppercase font-black" />
                <Textarea value={motto} onChange={(e) => setMotto(e.target.value.slice(0, 120))} placeholder="Motto klan..." className="bg-black/40 border-cyan-500/30 text-white text-xs min-h-[60px]" />
                <div className="flex items-center justify-between bg-black/40 rounded-lg p-2 border border-cyan-500/20">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">{isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />} {isPrivate ? "Private (kode only)" : "Public (bisa dicari)"}</div>
                    <div className="text-[9px] text-white/60">{isPrivate ? "Hanya yang punya kode bisa join" : "Tampil di pencarian publik"}</div>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>
                <Button onClick={createClan} disabled={loading} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> BUAT CLAN</>}
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

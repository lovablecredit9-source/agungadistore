import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Gift, Target, RefreshCw, Swords, Coins, Gem, Check, Clock, Crown, Flame, Trophy, Sparkles,
} from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

const RARITY: Record<string, string> = {
  common: "from-slate-500/30 to-slate-600/30 border-slate-400/40",
  rare: "from-sky-500/30 to-blue-600/30 border-sky-400/50",
  epic: "from-fuchsia-500/30 to-purple-600/30 border-fuchsia-400/50",
  legendary: "from-amber-400/40 to-red-500/40 border-amber-300/70",
};

export default function StreakExpansionHub({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [boxResult, setBoxResult] = useState<any>(null);

  async function load() {
    if (!visitorId) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("streak-expansion", { body: { action: "overview", visitorId } });
      if (!error && !res?.error && res) setData(res);
    } catch {
      // silent — avoid spamming toast on transient network errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [visitorId]);

  async function call(action: string, payload: any, busyKey: string) {
    setBusy(busyKey);
    try {
      const { data: res, error } = await supabase.functions.invoke("streak-expansion", { body: { action, visitorId, ...payload } });
      if (error || res?.error) {
        toast({ title: "Gagal", description: res?.error || error?.message, variant: "destructive" });
        return null;
      }
      return res;
    } finally {
      setBusy(null);
    }
  }

  async function openBox(box: any, method: "free" | "coin" | "gem") {
    const res = await call("open_box", { boxId: box.id, paymentMethod: method }, `box-${box.id}`);
    if (res?.success) {
      setBoxResult({ box, ...res });
      load();
      onUpdate?.();
    }
  }

  async function buyRotating(active: any, method: "coin" | "gem") {
    const res = await call("buy_rotating", { activeId: active.id, paymentMethod: method }, `rot-${active.id}`);
    if (res?.success) {
      toast({ title: "✨ Berhasil!", description: `${res.reward_label} • -${res.cost} ${method === "gem" ? "💎" : "🪙"}` });
      load();
      onUpdate?.();
    }
  }

  async function claimEvent(ev: any) {
    const res = await call("claim_event", { eventId: ev.id }, `ev-${ev.id}`);
    if (res?.success) {
      toast({ title: `🎯 ${ev.name} Selesai!`, description: ev.reward_label });
      load();
      onUpdate?.();
    }
  }

  async function attackBoss(boss: any) {
    const res = await call("attack_boss", { bossId: boss.id }, `boss-${boss.id}`);
    if (res?.success) {
      if (res.is_kill) {
        toast({ title: "🏆 BOSS KALAH!", description: `Damage: ${res.damage}. Hadiah: ${res.kill_reward?.label || "Top 50% kontributor"}` });
      } else {
        toast({ title: `⚔️ -${res.damage} HP`, description: `Sisa HP boss: ${res.new_hp.toLocaleString()}` });
      }
      load();
      onUpdate?.();
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-fuchsia-300" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-fuchsia-300" />
          <h3 className="font-black text-base sm:text-lg text-foreground">
            Streak Expansion
          </h3>
          <Badge className="bg-fuchsia-500/40 text-fuchsia-100 border-fuchsia-400/60 text-[9px] px-1.5 py-0 h-4">NEW</Badge>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <span className="text-amber-300 flex items-center gap-0.5"><Coins className="h-3 w-3" />{data.user_coins}</span>
          <span className="text-cyan-300 flex items-center gap-0.5"><Gem className="h-3 w-3" />{data.user_gems}</span>
        </div>
      </div>

      <Tabs defaultValue="boxes" className="w-full">
        <TabsList className="grid grid-cols-4 bg-black/30 border border-fuchsia-400/30 h-auto p-1 mb-2">
          <TabsTrigger value="boxes" className="text-[10px] sm:text-xs data-[state=active]:bg-fuchsia-500/40 px-1 py-1.5"><Gift className="h-3 w-3 mr-0.5" />Box</TabsTrigger>
          <TabsTrigger value="events" className="text-[10px] sm:text-xs data-[state=active]:bg-amber-500/40 px-1 py-1.5"><Target className="h-3 w-3 mr-0.5" />Event</TabsTrigger>
          <TabsTrigger value="rotating" className="text-[10px] sm:text-xs data-[state=active]:bg-cyan-500/40 px-1 py-1.5"><RefreshCw className="h-3 w-3 mr-0.5" />Shop</TabsTrigger>
          <TabsTrigger value="boss" className="text-[10px] sm:text-xs data-[state=active]:bg-red-500/40 px-1 py-1.5"><Swords className="h-3 w-3 mr-0.5" />Boss</TabsTrigger>
        </TabsList>

        {/* MYSTERY BOXES */}
        <TabsContent value="boxes" className="mt-2 space-y-2">
          {data.boxes.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Belum ada box</p>}
          {data.boxes.map((b: any) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl bg-gradient-to-br ${RARITY[b.rarity] || RARITY.common} border-2 p-2.5`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-3xl">{b.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-sm text-white truncate">{b.name}</p>
                    <Badge className="text-[8px] h-3 px-1 bg-black/40 text-white border-0 uppercase">{b.rarity}</Badge>
                  </div>
                  <p className="text-[10px] text-white/80 truncate">{b.description}</p>
                  <p className="text-[9px] text-white/60">Sisa hari ini: {b.claimed_today ? 0 : b.daily_limit}/{b.daily_limit}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                {b.is_free ? (
                  <Button size="sm" disabled={b.claimed_today || busy === `box-${b.id}`}
                    onClick={() => openBox(b, "free")}
                    className="flex-1 h-8 text-[11px] bg-emerald-500 hover:bg-emerald-600 text-white">
                    {busy === `box-${b.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : b.claimed_today ? <><Check className="h-3 w-3 mr-1" />Sudah</> : <><Sparkles className="h-3 w-3 mr-1" />GRATIS</>}
                  </Button>
                ) : (
                  <>
                    {b.cost_coins > 0 && (
                      <Button size="sm" disabled={b.claimed_today || busy === `box-${b.id}` || data.user_coins < b.cost_coins}
                        onClick={() => openBox(b, "coin")}
                        className="flex-1 h-8 text-[11px] bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50">
                        {busy === `box-${b.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Coins className="h-3 w-3 mr-1" />{b.cost_coins}</>}
                      </Button>
                    )}
                    {b.cost_gems > 0 && (
                      <Button size="sm" disabled={b.claimed_today || busy === `box-${b.id}` || data.user_gems < b.cost_gems}
                        onClick={() => openBox(b, "gem")}
                        className="flex-1 h-8 text-[11px] bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50">
                        {busy === `box-${b.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Gem className="h-3 w-3 mr-1" />{b.cost_gems}</>}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </TabsContent>

        {/* MINI EVENTS */}
        <TabsContent value="events" className="mt-2 space-y-2">
          {data.events.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Belum ada event aktif</p>}
          {data.events.map((ev: any) => {
            const pct = Math.min(100, (ev.current_value / ev.target_value) * 100);
            return (
              <motion.div key={ev.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400/40 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-2xl">{ev.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-amber-100 truncate">{ev.name}</p>
                    <p className="text-[10px] text-amber-200/80 truncate">{ev.description}</p>
                  </div>
                  {ev.is_claimed && <Badge className="bg-emerald-500/40 text-emerald-100 border-emerald-400/50 text-[9px] h-4"><Check className="h-2.5 w-2.5 mr-0.5" />Klaim</Badge>}
                </div>
                <Progress value={pct} className="h-1.5 mb-1.5" />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-amber-100">
                    {ev.current_value}/{ev.target_value} • <span className="text-amber-300 font-bold">{ev.reward_label}</span>
                  </p>
                  <Button size="sm" disabled={ev.is_claimed || !ev.is_complete || busy === `ev-${ev.id}`}
                    onClick={() => claimEvent(ev)}
                    className="h-7 px-2 text-[10px] bg-amber-500 hover:bg-amber-600 text-white">
                    {busy === `ev-${ev.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : ev.is_claimed ? "Diklaim" : ev.is_complete ? "Klaim" : "Belum"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* ROTATING SHOP */}
        <TabsContent value="rotating" className="mt-2">
          <div className="mb-2 p-2 rounded-lg bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-400/30">
            <p className="text-[10px] font-bold text-cyan-100 flex items-center gap-1"><Clock className="h-3 w-3" />Item berputar otomatis tiap hari (00:00 WIB)</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.rotating.length === 0 && <p className="col-span-2 text-xs text-center text-muted-foreground py-4">Belum ada item</p>}
            {data.rotating.map((r: any) => {
              const item = r.item;
              if (!item) return null;
              return (
                <motion.div key={r.id} whileHover={{ scale: 1.02 }}
                  className={`rounded-xl bg-gradient-to-br ${RARITY[item.rarity] || RARITY.common} border-2 p-2 relative`}>
                  {r.discount_pct > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-red-300 shadow-lg">
                      -{r.discount_pct}%
                    </div>
                  )}
                  <div className="text-center mb-1.5">
                    <div className="text-3xl mb-0.5">{item.icon}</div>
                    <p className="font-bold text-[11px] text-white truncate">{item.name}</p>
                    <p className="text-[9px] text-white/70">Sisa: {r.left_today}/{r.daily_limit}</p>
                  </div>
                  <div className="flex gap-1">
                    {item.base_cost_coins > 0 && (
                      <Button size="sm" disabled={r.left_today <= 0 || busy === `rot-${r.id}` || data.user_coins < r.final_cost_coins}
                        onClick={() => buyRotating(r, "coin")}
                        className="flex-1 h-7 text-[10px] bg-amber-500 hover:bg-amber-600 text-white px-1 disabled:opacity-50">
                        {busy === `rot-${r.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Coins className="h-3 w-3 mr-0.5" />{r.final_cost_coins}</>}
                      </Button>
                    )}
                    {item.base_cost_gems > 0 && (
                      <Button size="sm" disabled={r.left_today <= 0 || busy === `rot-${r.id}` || data.user_gems < r.final_cost_gems}
                        onClick={() => buyRotating(r, "gem")}
                        className="flex-1 h-7 text-[10px] bg-cyan-500 hover:bg-cyan-600 text-white px-1 disabled:opacity-50">
                        {busy === `rot-${r.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Gem className="h-3 w-3 mr-0.5" />{r.final_cost_gems}</>}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* BOSS RAID */}
        <TabsContent value="boss" className="mt-2 space-y-2">
          {!data.boss && <p className="text-xs text-center text-muted-foreground py-4">Belum ada boss aktif. Cek lagi besok!</p>}
          {data.boss && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-gradient-to-br from-red-950/60 via-rose-900/40 to-orange-950/60 border-2 border-red-400/50 p-3">
              <div className="text-center mb-2">
                <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-5xl mb-1">{data.boss.icon}</motion.div>
                <p className="font-black text-lg text-red-100">{data.boss.name}</p>
                <p className="text-[10px] text-red-200/80 px-2">{data.boss.description}</p>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-[10px] text-red-100 mb-0.5">
                  <span>HP</span>
                  <span className="tabular-nums">{data.boss.current_hp.toLocaleString()} / {data.boss.max_hp.toLocaleString()}</span>
                </div>
                <div className="h-2.5 rounded-full bg-black/50 overflow-hidden border border-red-500/30">
                  <motion.div className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"
                    initial={{ width: 0 }} animate={{ width: `${data.boss.hp_pct}%` }} transition={{ duration: 0.6 }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2 text-[10px]">
                <div className="rounded-lg bg-black/40 border border-red-400/30 p-1.5">
                  <p className="text-red-300/70">Damage Kamu</p>
                  <p className="font-black text-red-100 text-sm tabular-nums">{data.boss.my_contribution.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-black/40 border border-amber-400/30 p-1.5">
                  <p className="text-amber-300/70">Hadiah Top 50%</p>
                  <p className="font-black text-amber-100 text-[11px] truncate">{data.boss.reward_label}</p>
                </div>
              </div>
              <Button disabled={busy === `boss-${data.boss.id}` || data.boss.is_defeated || data.user_coins < data.boss.attack_cost_coins}
                onClick={() => attackBoss(data.boss)}
                className="w-full h-9 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-black">
                {busy === `boss-${data.boss.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : data.boss.is_defeated ? <><Trophy className="h-4 w-4 mr-1" />KALAH</> : <><Swords className="h-4 w-4 mr-1" />Serang ({data.boss.attack_cost_coins} <Coins className="h-3 w-3 ml-0.5" />)</>}
              </Button>
              {data.boss.top_contributors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-red-400/20">
                  <p className="text-[10px] font-bold text-red-200 mb-1 flex items-center gap-1"><Crown className="h-3 w-3" />Top 5 Kontributor</p>
                  <div className="space-y-0.5">
                    {data.boss.top_contributors.slice(0, 5).map((c: any, i: number) => (
                      <div key={c.visitor_id} className={`flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded ${c.is_me ? "bg-amber-500/30 text-amber-100" : "text-red-100/80"}`}>
                        <span>#{i + 1} {c.is_me ? "Kamu" : `Player ${c.visitor_id.slice(0, 6)}`}</span>
                        <span className="font-bold tabular-nums">{c.damage.toLocaleString()} dmg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {boxResult && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setBoxResult(null)}>
            <motion.div initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
              className={`max-w-xs w-full rounded-3xl bg-gradient-to-br ${RARITY[boxResult.reward.rarity] || RARITY.common} border-4 p-5 text-center`}
              onClick={(e) => e.stopPropagation()}>
              <motion.div animate={{ rotate: [0, 360], scale: [1, 1.3, 1] }} transition={{ duration: 1.2 }} className="text-7xl mb-2">{boxResult.box.icon}</motion.div>
              <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">Selamat!</p>
              <p className="text-2xl font-black text-white mb-1">{boxResult.reward.label}</p>
              <Badge className="bg-black/40 text-white border-0 text-[10px] uppercase mb-3">{boxResult.reward.rarity}</Badge>
              <Button onClick={() => setBoxResult(null)} className="w-full bg-white/90 text-black hover:bg-white font-bold">Mantap!</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
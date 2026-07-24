import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Flame, Loader2, Crown, Check, Lock, Gem, Target, Trophy,
  Sparkles, Zap, History, Calendar, Star, Rocket, Award, ChevronRight,
} from "lucide-react";

interface FirePassTabProps {
  visitorId: string;
}

export default function FirePassTab({ visitorId }: FirePassTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [history, setHistory] = useState<{ badges: any[]; tiers: any[]; missions: any[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    if (!visitorId) return;
    setLoading(true);
    const [statusRes, missionRes] = await Promise.all([
      supabase.functions.invoke("fire-pass", { body: { action: "status", visitorId } }),
      supabase.functions.invoke("fire-pass", { body: { action: "list_missions", visitorId } }),
    ]);
    const s = statusRes.data as any;
    const m = missionRes.data as any;
    setSeason(s?.season); setTiers(s?.tiers || []); setProgress(s?.progress);
    setMissions(m?.missions || []);
    setLoading(false);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase.functions.invoke("fire-pass", { body: { action: "history", visitorId } });
    setHistory(data as any);
    setHistoryLoading(false);
  };

  useEffect(() => { load(); }, [visitorId]);

  if (!visitorId) return null;

  const claim = async (tierLevel: number, track: "free" | "premium") => {
    setClaiming(`${track}-${tierLevel}`);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "claim_tier", visitorId, tierLevel, track } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🔥 Reward diklaim!", description: (data as any).reward_label });
      load();
    } catch (e) { toast({ title: "Gagal", description: String(e), variant: "destructive" }); }
    finally { setClaiming(null); }
  };

  const claimMission = async (missionId: string) => {
    setClaiming(`mission-${missionId}`);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "claim_mission", visitorId, missionId } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🏅 Badge didapat!", description: `+${(data as any).badges_awarded} badge` });
      load();
    } catch (e) { toast({ title: "Gagal", description: String(e), variant: "destructive" }); }
    finally { setClaiming(null); }
  };

  const gemCostFor = (b: number) => (b <= 5 ? 20 : b <= 15 ? 50 : 100);

  const completeWithGems = async (missionId: string, badgeReward: number) => {
    const cost = gemCostFor(badgeReward);
    if (!confirm(`Selesaikan misi ini pakai ${cost} 💎?\n\nBonus: +${Math.max(1, Math.ceil(badgeReward * 0.5))} badge ekstra (total ${badgeReward + Math.max(1, Math.ceil(badgeReward * 0.5))} 🏅).`)) return;
    setClaiming(`gem-${missionId}`);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "complete_with_gems", visitorId, missionId } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "💎 Misi selesai!", description: `-${(data as any).gem_cost} 💎 · +${(data as any).badges_awarded} 🏅 (bonus +${(data as any).bonus})` });
      load();
    } catch (e) { toast({ title: "Gagal", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
    finally { setClaiming(null); }
  };

  const buyPremium = async (method: "saldo" | "gems") => {
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "buy_premium", visitorId, method } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🔥 Premium aktif!" });
      load();
    } catch (e) { toast({ title: "Gagal", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
    finally { setBuying(false); }
  };

  const buyProMissions = async (method: "saldo" | "gems") => {
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("fire-pass", { body: { action: "buy_pro_missions", visitorId, method } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "🔮 Misi PRO aktif 30 hari!" });
      load();
    } catch (e) { toast({ title: "Gagal", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
    finally { setBuying(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="relative">
        <Flame className="w-12 h-12 text-orange-500 animate-pulse" />
        <div className="absolute inset-0 blur-2xl bg-orange-500/50 animate-pulse" />
      </div>
      <div className="text-xs font-bold text-orange-400/80 uppercase tracking-widest">Menyalakan Fire Pass…</div>
    </div>
  );
  if (!season) return <div className="p-8 text-center text-sm text-muted-foreground">Belum ada season Fire Pass aktif</div>;

  const badges = progress?.badges || 0;
  const isPremium = !!progress?.is_premium;
  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000));

  // ── Season stats
  const maxTier = tiers.length > 0 ? tiers[tiers.length - 1] : null;
  const maxBadges = maxTier?.badge_required || 100;
  const currentTierLevel = tiers.filter(t => badges >= t.badge_required).length;
  const nextTier = tiers.find(t => badges < t.badge_required);
  const seasonPct = Math.min(100, (badges / maxBadges) * 100);
  const claimedFreeCount = progress?.claimed_free_tiers?.length || 0;
  const claimedPremCount = progress?.claimed_premium_tiers?.length || 0;

  const renderTierRow = (t: any, track: "free" | "premium") => {
    const canClaim = badges >= t.badge_required;
    const claimed = track === "free"
      ? progress?.claimed_free_tiers?.includes(t.tier_level)
      : progress?.claimed_premium_tiers?.includes(t.tier_level);
    const label = track === "free" ? t.free_reward_label : t.premium_reward_label;
    const pct = Math.min(100, (badges / t.badge_required) * 100);
    const locked = track === "premium" && !isPremium;

    return (
      <div
        key={`${track}-${t.id}`}
        className={`relative overflow-hidden rounded-xl border transition-all ${
          claimed
            ? "border-emerald-500/40 bg-emerald-500/5"
            : canClaim && !locked
              ? track === "premium"
                ? "border-yellow-400/60 bg-gradient-to-r from-yellow-500/15 via-amber-500/10 to-orange-500/15 shadow-[0_0_20px_-8px_rgba(250,204,21,0.5)]"
                : "border-orange-400/60 bg-gradient-to-r from-orange-500/10 to-red-500/10 shadow-[0_0_16px_-8px_rgba(249,115,22,0.5)]"
              : "border-white/5 bg-white/[0.02] opacity-80"
        }`}
      >
        {canClaim && !claimed && !locked && (
          <div className="absolute -top-8 -right-8 w-16 h-16 rounded-full bg-orange-400/30 blur-2xl animate-pulse pointer-events-none" />
        )}
        <div className="relative p-2.5 flex items-center gap-2.5">
          {/* Tier badge */}
          <div className={`shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center text-[9px] font-black ${
            claimed
              ? "bg-gradient-to-br from-emerald-400 to-green-600 text-white"
              : canClaim && !locked
                ? track === "premium"
                  ? "bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-black shadow-lg"
                  : "bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg"
                : "bg-white/5 text-white/50 border border-white/10"
          }`}>
            <div className="text-[8px] uppercase leading-none opacity-80">Tier</div>
            <div className="text-sm leading-none">{t.tier_level}</div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <div className="text-[11px] font-bold truncate flex items-center gap-1">
                {track === "premium" && <Crown className="w-3 h-3 text-yellow-400 shrink-0" />}
                <span className="truncate">{label || "-"}</span>
              </div>
              <div className="text-[9px] font-black text-yellow-500 whitespace-nowrap">🏅{t.badge_required}</div>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  claimed
                    ? "bg-emerald-400"
                    : track === "premium"
                      ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                      : "bg-gradient-to-r from-orange-400 to-red-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Action */}
          <div className="shrink-0">
            {claimed ? (
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-400" strokeWidth={3} />
              </div>
            ) : locked ? (
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5 text-yellow-500/70" />
              </div>
            ) : (
              <Button
                size="sm"
                className={`h-9 min-w-[64px] text-[10px] font-black uppercase tracking-wider ${
                  track === "premium"
                    ? "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black shadow-lg"
                    : canClaim
                      ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg"
                      : ""
                }`}
                disabled={!canClaim || claiming === `${track}-${t.tier_level}`}
                onClick={() => claim(t.tier_level, track)}
              >
                {claiming === `${track}-${t.tier_level}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const dailyMissions = missions.filter(m => m.mission_type === "daily");
  const weeklyMissions = missions.filter(m => m.mission_type === "weekly");
  const monthlyMissions = missions.filter(m => m.mission_type === "monthly");
  const proMissions = missions.filter(m => m.mission_type === "pro");
  const proUntil = progress?.pro_missions_until ? new Date(progress.pro_missions_until).getTime() : 0;
  const proActive = proUntil > Date.now();
  const proDaysLeft = proActive ? Math.max(0, Math.ceil((proUntil - Date.now()) / 86400000)) : 0;
  const proPriceSaldo = season.pro_price_saldo_in ?? 30000;
  const proPriceGems = season.pro_price_gems ?? 500;

  const renderMission = (m: any) => {
    const pct = Math.min(100, ((m.current_value || 0) / m.target_value) * 100);
    const ready = m.is_completed && !m.is_claimed;
    return (
      <div
        key={m.id}
        className={`relative overflow-hidden rounded-xl border p-2.5 transition-all ${
          m.is_claimed
            ? "border-emerald-500/30 bg-emerald-500/5"
            : ready
              ? "border-orange-400/60 bg-gradient-to-br from-orange-500/15 to-red-500/10 shadow-[0_0_20px_-8px_rgba(249,115,22,0.6)]"
              : m.locked
                ? "border-white/5 bg-white/[0.02] opacity-70"
                : "border-orange-500/20 bg-gradient-to-br from-orange-500/[0.06] to-transparent"
        }`}
      >
        {ready && (
          <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-orange-400/40 blur-2xl animate-pulse pointer-events-none" />
        )}
        <div className="relative space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-1 h-1 rounded-full ${ready ? "bg-orange-400 animate-pulse" : m.is_claimed ? "bg-emerald-400" : "bg-white/30"}`} />
                <div className="text-[11px] font-black truncate">{m.title}</div>
              </div>
              <div className="text-[9px] text-white/50 truncate ml-2.5">{m.description}</div>
            </div>
            <div className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-black ${
              ready ? "bg-orange-500 text-white" : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
            }`}>+{m.badge_reward} 🏅</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 rounded-full flex-1 bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  m.is_claimed
                    ? "bg-emerald-400"
                    : ready
                      ? "bg-gradient-to-r from-orange-400 to-red-500"
                      : "bg-gradient-to-r from-orange-500/60 to-red-500/60"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[9px] font-bold text-white/60 whitespace-nowrap tabular-nums">{m.current_value}/{m.target_value}</div>
          </div>
          {m.is_claimed ? (
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold"><Check className="w-3 h-3" strokeWidth={3} /> Sudah diklaim</div>
          ) : ready ? (
            <Button size="sm" className="w-full h-7 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:brightness-110 text-white shadow-lg" disabled={claiming === `mission-${m.id}`} onClick={() => claimMission(m.id)}>
              {claiming === `mission-${m.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <>🔥 Klaim +{m.badge_reward} Badge</>}
            </Button>
          ) : m.locked ? (
            <div className="text-[9px] text-white/40 text-center flex items-center justify-center gap-1 py-1"><Lock className="w-3 h-3" /> Terkunci</div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-[10px] font-bold border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/15 text-cyan-300"
              disabled={claiming === `gem-${m.id}`}
              onClick={() => completeWithGems(m.id, m.badge_reward || 1)}
            >
              {claiming === `gem-${m.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Gem className="w-3 h-3 mr-1" />Selesai instan {gemCostFor(m.badge_reward || 1)} 💎</>}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const missionSummary = (list: any[]) => {
    const ready = list.filter(m => m.is_completed && !m.is_claimed).length;
    const done = list.filter(m => m.is_claimed).length;
    return { ready, done, total: list.length };
  };

  return (
    <div className="p-3 space-y-4 pb-24">
      {/* ═══════════════ HERO ═══════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-orange-500/40 bg-gradient-to-br from-[#1a0a0a] via-[#2a0f12] to-[#1a0a1f] p-4">
        {/* animated blobs */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-orange-500/40 blur-3xl animate-pulse" />
        <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-red-600/30 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full bg-pink-500/20 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        {/* grid overlay */}
        <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 blur-lg bg-orange-500/60 animate-pulse" />
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 flex items-center justify-center shadow-lg">
                  <Flame className="w-6 h-6 text-white drop-shadow" strokeWidth={2.5} />
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-[0.2em] font-black text-orange-300/80">Fire Pass · S{season.season_number}</div>
                <div className="font-black text-lg leading-tight bg-gradient-to-r from-yellow-200 via-orange-200 to-pink-200 bg-clip-text text-transparent truncate">{season.name}</div>
              </div>
            </div>
            {isPremium ? (
              <div className="shrink-0 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 text-black text-[10px] font-black flex items-center gap-1 shadow-lg">
                <Crown className="w-3 h-3" strokeWidth={3} /> PREMIUM
              </div>
            ) : (
              <div className="shrink-0 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/80 text-[10px] font-black uppercase tracking-wider">Free</div>
            )}
          </div>

          {/* Big badge counter */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-orange-300/70 font-bold">Total Badge</div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black bg-gradient-to-b from-yellow-200 to-orange-500 bg-clip-text text-transparent tabular-nums">{badges.toLocaleString("id-ID")}</span>
                <span className="text-lg">🏅</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest text-orange-300/70 font-bold">Sisa Musim</div>
              <div className="text-xl font-black text-white flex items-center gap-1 justify-end">
                <Calendar className="w-4 h-4 text-orange-400" /> {daysLeft}<span className="text-xs text-white/60">hari</span>
              </div>
            </div>
          </div>

          {/* Progress to next tier */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-white/70">Tier {currentTierLevel} / {tiers.length}</span>
              {nextTier ? (
                <span className="text-orange-300">Butuh {nextTier.badge_required - badges} 🏅 lagi</span>
              ) : (
                <span className="text-yellow-300 flex items-center gap-1"><Trophy className="w-3 h-3" /> Max tier!</span>
              )}
            </div>
            <div className="relative h-2.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 shadow-[0_0_12px_rgba(249,115,22,0.6)] transition-all"
                style={{ width: `${seasonPct}%` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-shimmer-bar" style={{ backgroundSize: "200% 100%" }} />
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="p-1.5 rounded-lg bg-black/30 border border-white/5 text-center">
              <div className="text-[8px] uppercase text-white/50 font-bold">Free Klaim</div>
              <div className="text-sm font-black text-orange-300">{claimedFreeCount}<span className="text-[9px] text-white/40">/{tiers.length}</span></div>
            </div>
            <div className="p-1.5 rounded-lg bg-black/30 border border-yellow-500/20 text-center">
              <div className="text-[8px] uppercase text-yellow-400/70 font-bold">👑 Premium</div>
              <div className="text-sm font-black text-yellow-300">{claimedPremCount}<span className="text-[9px] text-white/40">/{tiers.length}</span></div>
            </div>
            <div className="p-1.5 rounded-lg bg-black/30 border border-white/5 text-center">
              <div className="text-[8px] uppercase text-white/50 font-bold">Misi Siap</div>
              <div className="text-sm font-black text-pink-300">{missions.filter(m => m.is_completed && !m.is_claimed).length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ UPGRADE PREMIUM CTA ═══════════════ */}
      {!isPremium && (
        <div className="relative overflow-hidden rounded-2xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/15 via-amber-500/10 to-orange-500/15 p-3">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-yellow-400/30 blur-3xl animate-pulse" />
          <div className="relative flex items-center gap-3">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Crown className="w-6 h-6 text-black" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black bg-gradient-to-r from-yellow-200 to-orange-300 bg-clip-text text-transparent">Aktifkan Premium</div>
              <div className="text-[10px] text-yellow-100/70">Reward tier ekslusif · badge lebih besar</div>
            </div>
          </div>
          <div className="relative grid grid-cols-2 gap-2 mt-3">
            <Button onClick={() => buyPremium("saldo")} disabled={buying} className="h-9 text-[11px] font-black bg-gradient-to-r from-yellow-400 to-orange-500 hover:brightness-110 text-black shadow-lg">
              💰 Rp{Number(season.price_saldo_in).toLocaleString("id-ID")}
            </Button>
            <Button onClick={() => buyPremium("gems")} disabled={buying} variant="outline" className="h-9 text-[11px] font-black border-yellow-400/50 bg-yellow-400/5 hover:bg-yellow-400/15 text-yellow-200">
              <Gem className="w-3.5 h-3.5 mr-1" />{season.price_gems}
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════ MISSIONS ═══════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-orange-950/40 via-black/30 to-red-950/40 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow">
              <Target className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-black">Misi Fire Pass</div>
              <div className="text-[9px] text-white/50">Selesaikan misi · dapat badge · naik tier</div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="daily">
          <TabsList className="grid grid-cols-4 h-9 bg-black/30 border border-white/5 p-0.5 rounded-xl">
            {[
              { v: "daily", i: Sparkles, l: "Harian", s: missionSummary(dailyMissions), gradient: "from-cyan-500 to-blue-500" },
              { v: "weekly", i: Trophy, l: "Mingguan", s: missionSummary(weeklyMissions), gradient: "from-purple-500 to-pink-500" },
              { v: "monthly", i: Award, l: "Bulanan", s: missionSummary(monthlyMissions), gradient: "from-orange-500 to-red-500" },
              { v: "pro", i: Zap, l: "PRO", s: missionSummary(proMissions), gradient: "from-fuchsia-500 to-purple-600" },
            ].map(({ v, i: Icon, l, s, gradient }) => (
              <TabsTrigger
                key={v}
                value={v}
                className={`relative text-[10px] font-black uppercase tracking-wide rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:${gradient} data-[state=active]:text-white data-[state=active]:shadow-lg`}
              >
                <Icon className="w-3 h-3 mr-0.5" />{l}
                {s.ready > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-orange-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse">{s.ready}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {[
            { v: "daily", list: dailyMissions, label: "harian" },
            { v: "weekly", list: weeklyMissions, label: "mingguan" },
            { v: "monthly", list: monthlyMissions, label: "bulanan" },
          ].map(({ v, list, label }) => (
            <TabsContent key={v} value={v} className="space-y-1.5 mt-3">
              {list.length === 0 ? (
                <div className="text-[11px] text-center text-white/40 py-6">Tidak ada misi {label}</div>
              ) : list.map(renderMission)}
            </TabsContent>
          ))}

          <TabsContent value="pro" className="space-y-2 mt-3">
            {(() => {
              const totalBadges = proMissions.reduce((s, m) => s + (m.badge_reward || 0), 0);
              const claimedCount = proMissions.filter(m => m.is_claimed).length;
              const readyCount = proMissions.filter(m => m.is_completed && !m.is_claimed).length;
              const sortedPro = [...proMissions].sort((a, b) => {
                const score = (m: any) => (m.is_claimed ? 2 : m.is_completed ? 0 : 1);
                return score(a) - score(b) || (a.badge_reward || 0) - (b.badge_reward || 0);
              });
              return (
                <>
                  {/* PRO hero */}
                  <div className="relative overflow-hidden rounded-2xl p-3 bg-gradient-to-br from-purple-900/60 via-fuchsia-800/40 to-pink-900/60 border border-fuchsia-400/40">
                    <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-fuchsia-500/40 blur-3xl animate-pulse" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-purple-500/40 blur-3xl animate-pulse" />
                    <div className="relative flex items-center gap-2.5 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-400 via-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                        <Rocket className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] uppercase tracking-[0.2em] font-black text-fuchsia-200">Fire Pass PRO</div>
                        <div className="text-base font-black bg-gradient-to-r from-yellow-200 via-pink-200 to-purple-200 bg-clip-text text-transparent leading-tight">
                          {proMissions.length} Misi · {totalBadges} 🏅
                        </div>
                      </div>
                      {proActive && (
                        <div className="shrink-0 px-2 py-1 rounded-full bg-gradient-to-r from-yellow-300 to-pink-400 text-black text-[9px] font-black shadow animate-pulse">AKTIF</div>
                      )}
                    </div>
                    <div className="relative text-[10px] text-fuchsia-100/80">
                      {proActive ? (
                        <>✨ Sisa <b className="text-yellow-300">{proDaysLeft} hari</b> · {claimedCount}/{proMissions.length} klaim{readyCount > 0 && <> · <span className="text-yellow-300 font-black">{readyCount} siap!</span></>}</>
                      ) : (
                        "🔒 Beli akses untuk buka misi & badge besar"
                      )}
                    </div>
                  </div>

                  {!proActive && (
                    <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/40 bg-gradient-to-br from-purple-950/60 via-fuchsia-950/40 to-pink-950/60 p-3">
                      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.3),transparent_60%)]" />
                      <div className="relative space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Zap className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-black bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">Buka Misi PRO</div>
                            <div className="text-[9px] text-purple-200/60">Akses 30 hari · hadiah sampai 150 🏅</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="p-1.5 rounded-lg bg-black/40 border border-purple-500/30">
                            <div className="text-[8px] uppercase text-purple-200/60 font-bold">Misi</div>
                            <div className="text-sm font-black text-white">{proMissions.length}+</div>
                          </div>
                          <div className="p-1.5 rounded-lg bg-black/40 border border-purple-500/30">
                            <div className="text-[8px] uppercase text-purple-200/60 font-bold">Badge</div>
                            <div className="text-sm font-black text-yellow-300">{totalBadges}🏅</div>
                          </div>
                          <div className="p-1.5 rounded-lg bg-black/40 border border-purple-500/30">
                            <div className="text-[8px] uppercase text-purple-200/60 font-bold">Durasi</div>
                            <div className="text-sm font-black text-white">30hr</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button onClick={() => buyProMissions("saldo")} disabled={buying} className="h-9 text-[11px] font-black bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:brightness-110 text-white shadow-lg">
                            💰 Rp{Number(proPriceSaldo).toLocaleString("id-ID")}
                          </Button>
                          <Button onClick={() => buyProMissions("gems")} disabled={buying} variant="outline" className="h-9 text-[11px] font-black border-fuchsia-400/50 bg-fuchsia-500/5 hover:bg-fuchsia-500/15 text-fuchsia-200">
                            <Gem className="w-3.5 h-3.5 mr-1" />{proPriceGems}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {sortedPro.length === 0 ? (
                    <div className="text-[11px] text-center text-white/40 py-6">Belum ada misi PRO</div>
                  ) : (
                    <div className="space-y-1.5">
                      {sortedPro.map(m => (
                        <div key={m.id} className={proActive ? "" : "opacity-60 pointer-events-none"}>
                          {renderMission(m)}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══════════════ TIER REWARDS ═══════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-orange-950/40 via-black/30 to-yellow-950/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow">
              <Star className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-black">Tier Reward</div>
              <div className="text-[9px] text-white/50">Jalur Free & Premium · {tiers.length} tier</div>
            </div>
          </div>
          {nextTier && (
            <div className="text-right">
              <div className="text-[8px] uppercase text-white/50 font-bold">Berikutnya</div>
              <div className="text-[11px] font-black text-orange-300 flex items-center gap-0.5">Tier {nextTier.tier_level} <ChevronRight className="w-3 h-3" /></div>
            </div>
          )}
        </div>

        <Tabs defaultValue="free" onValueChange={(v) => { if (v === "history" && !history) loadHistory(); }}>
          <TabsList className="grid grid-cols-3 h-10 bg-black/30 border border-white/5 p-0.5 rounded-xl w-full">
            <TabsTrigger value="free" className="text-[11px] font-black uppercase tracking-wide rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow">🎁 Free</TabsTrigger>
            <TabsTrigger value="premium" className="text-[11px] font-black uppercase tracking-wide rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-amber-500 data-[state=active]:text-black data-[state=active]:shadow">👑 Premium</TabsTrigger>
            <TabsTrigger value="history" className="text-[11px] font-black uppercase tracking-wide rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow"><History className="w-3 h-3 mr-0.5" />Riwayat</TabsTrigger>
          </TabsList>

          <TabsContent value="free" className="space-y-1.5 mt-3">
            {tiers.map(t => renderTierRow(t, "free"))}
          </TabsContent>

          <TabsContent value="premium" className="space-y-1.5 mt-3">
            {!isPremium && (
              <div className="rounded-xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 p-2.5 text-center text-[11px] font-bold text-yellow-200 flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Aktifkan Premium untuk klaim jalur ini
              </div>
            )}
            {tiers.map(t => renderTierRow(t, "premium"))}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-3">
            {historyLoading || !history ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: "Tier", v: history.tiers.length, c: "from-orange-500 to-red-500", i: Star },
                    { l: "Misi", v: history.missions.length, c: "from-purple-500 to-pink-500", i: Target },
                    { l: "Badge", v: history.badges.reduce((s, b) => s + (b.amount || 0), 0), c: "from-yellow-400 to-amber-500", i: Award },
                  ].map(({ l, v, c, i: Icon }) => (
                    <div key={l} className="relative overflow-hidden rounded-xl border border-white/5 bg-black/30 p-2.5 text-center">
                      <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${c}`} />
                      <div className="relative">
                        <Icon className={`w-4 h-4 mx-auto mb-1 bg-gradient-to-br ${c} bg-clip-text text-transparent`} style={{ WebkitTextStroke: "1.5px currentColor" }} />
                        <div className="text-[9px] uppercase text-white/50 font-bold">{l}</div>
                        <div className={`text-lg font-black bg-gradient-to-br ${c} bg-clip-text text-transparent`}>{v.toLocaleString("id-ID")}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-black text-orange-300 flex items-center gap-1 uppercase tracking-wide"><Trophy className="w-3.5 h-3.5" /> Reward Tier Diklaim</div>
                  {history.tiers.length === 0 ? (
                    <div className="text-[10px] text-center text-white/40 py-3">Belum ada tier diklaim</div>
                  ) : history.tiers.map((r, i) => (
                    <div key={i} className={`p-2 rounded-lg text-[11px] flex items-center justify-between ${r.track === "premium" ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-white/[0.03] border border-white/10"}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {r.track === "premium" ? <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" /> : <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                        <div className="min-w-0">
                          <div className="font-black truncate">Tier {r.tier_level} · {r.track === "premium" ? "Premium" : "Free"}</div>
                          <div className="text-[10px] text-white/50 truncate">{r.label || "-"}</div>
                        </div>
                      </div>
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" strokeWidth={3} />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-black text-purple-300 flex items-center gap-1 uppercase tracking-wide"><Target className="w-3.5 h-3.5" /> Misi Diklaim</div>
                  {history.missions.length === 0 ? (
                    <div className="text-[10px] text-center text-white/40 py-3">Belum ada misi diklaim</div>
                  ) : history.missions.map((m, i) => (
                    <div key={i} className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/20 text-[11px] flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-black truncate">{m.title}</div>
                        <div className="text-[9px] text-white/50">
                          {m.mission_type} · {new Date(m.claimed_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-orange-400 whitespace-nowrap">+{m.badge_reward} 🏅</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-black text-yellow-300 flex items-center gap-1 uppercase tracking-wide"><Award className="w-3.5 h-3.5" /> Log Badge</div>
                  {history.badges.length === 0 ? (
                    <div className="text-[10px] text-center text-white/40 py-3">Belum ada badge</div>
                  ) : history.badges.slice(0, 30).map((b, i) => (
                    <div key={i} className="p-1.5 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-[10px] flex items-center justify-between">
                      <div className="truncate min-w-0"><span className="text-white/50">{new Date(b.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span> · <span className="font-bold">{b.source}</span></div>
                      <div className="font-black text-yellow-400 whitespace-nowrap shrink-0 ml-2">+{b.amount} 🏅</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

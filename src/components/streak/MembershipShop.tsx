import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Crown, Coins, Wallet, Snowflake, Gem, Sparkles, Check, Gift, Lock, X } from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  price_idr: number;
  price_coins: number;
  bonus_multiplier: number;
  bonus_freeze_count: number;
  bonus_streak_coins: number;
  bonus_gems: number;
  daily_reward_coins?: number;
  icon: string;
  badge_color: string;
  is_featured: boolean;
}

interface ActiveMembership {
  id: string;
  plan_id: string;
  plan_name: string;
  expires_at: string;
  starts_at: string;
  bonus_multiplier: number;
}

interface DailyClaimInfo {
  available: boolean;
  claimed_today: boolean;
  coins_today: number;
  plan_name: string | null;
  next_unlock: string;
}

function formatDay(d: Date) {
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function useCountdown(targetIso?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return "";
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Tema warna berdasar tier
function getTheme(plan?: Plan | null) {
  const days = plan?.duration_days || 0;
  if (days >= 30) {
    return {
      glow: "from-amber-400 via-yellow-500 to-orange-500",
      panel: "from-[#3a2a0d] via-[#4a2f0e] to-[#2a1d08]",
      border: "border-amber-400/60",
      accent: "text-amber-300",
      badge: "bg-amber-500/30 text-amber-100 border-amber-400/60",
      letter: "M",
    };
  }
  if (days >= 7) {
    return {
      glow: "from-fuchsia-400 via-purple-500 to-violet-600",
      panel: "from-[#2a1340] via-[#3a1856] to-[#1f0d33]",
      border: "border-fuchsia-400/60",
      accent: "text-fuchsia-300",
      badge: "bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-400/60",
      letter: "W",
    };
  }
  return {
    glow: "from-cyan-400 via-sky-500 to-blue-600",
    panel: "from-[#0a1f3a] via-[#0e2c52] to-[#081a30]",
    border: "border-cyan-400/60",
    accent: "text-cyan-300",
    badge: "bg-cyan-500/30 text-cyan-100 border-cyan-400/60",
    letter: "T",
  };
}

export default function MembershipShop({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [active, setActive] = useState<ActiveMembership[]>([]);
  const [coins, setCoins] = useState(0);
  const [gameBalance, setGameBalance] = useState(0);
  const [mainBalance, setMainBalance] = useState(0);
  const [pinDialog, setPinDialog] = useState<{ planId: string } | null>(null);
  const [pin, setPin] = useState("");
  const [dailyClaim, setDailyClaim] = useState<DailyClaimInfo | null>(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const countdown = useCountdown(dailyClaim?.next_unlock);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("purchase-membership", { body: { action: "list", visitorId } });
      const list: Plan[] = data?.plans || [];
      setPlans(list);
      setActive(data?.active_memberships || []);
      setCoins(data?.user_coins || 0);
      setGameBalance(data?.game_balance || 0);
      setMainBalance(data?.main_balance || 0);
      setDailyClaim(data?.daily_claim || null);
      // Auto pilih paket pertama / featured
      if (!selectedPlanId && list.length > 0) {
        const featured = list.find((p) => p.is_featured) || list[0];
        setSelectedPlanId(featured.id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  const selected = useMemo(() => plans.find((p) => p.id === selectedPlanId) || plans[0], [plans, selectedPlanId]);
  const theme = getTheme(selected);
  const totalBalance = gameBalance + mainBalance;

  // Gabungan membership aktif untuk hitung sisa hari kalender
  const activeForSelected = useMemo(() => {
    if (!selected) return null;
    return active.find((m) => m.plan_id === selected.id) || active[0] || null;
  }, [active, selected]);

  // Generate daftar tanggal untuk grid kalender hadiah harian (durasi paket terpilih)
  const calendarDays = useMemo(() => {
    if (!selected) return [];
    const total = selected.duration_days;
    const startWIB = new Date();
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(startWIB);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selected]);

  // Apakah hari ini (index 0) sudah klaim?
  const claimedToday = !!dailyClaim?.claimed_today;

  async function purchase(planId: string, pinValue?: string) {
    const busyKey = `${planId}-balance`;
    setBusy(busyKey);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-membership", {
        body: { action: "purchase", visitorId, planId, paymentSource: "auto", pin: pinValue },
      });
      if (error || data?.error) {
        if (data?.needPin) {
          setPinDialog({ planId });
          setBusy(null);
          return;
        }
        toast({ title: "Gagal", description: data?.error || error?.message || "Terjadi kesalahan", variant: "destructive" });
        return;
      }
      const bonus = data?.bonus;
      const bonusBits: string[] = [];
      if (bonus?.streak_coins) bonusBits.push(`+${bonus.streak_coins} Koin`);
      if (bonus?.gems) bonusBits.push(`+${bonus.gems} Gem`);
      if (bonus?.freeze) bonusBits.push(`+${bonus.freeze} Freeze`);
      toast({
        title: "🎉 Membership Aktif!",
        description: `${data?.plan_name}${bonusBits.length ? " · " + bonusBits.join(" · ") : ""}`,
      });
      setPinDialog(null);
      setPin("");
      await load();
      onUpdate?.();
    } finally {
      setBusy(null);
    }
  }

  async function claimDaily() {
    setClaimingDaily(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-membership", {
        body: { action: "daily-claim", visitorId },
      });
      if (error || data?.error) {
        toast({ title: "Gagal klaim", description: data?.error || error?.message || "Terjadi kesalahan", variant: "destructive" });
        return;
      }
      toast({
        title: "🎁 Hadiah Harian!",
        description: `+${data?.coins_awarded?.toLocaleString("id-ID")} Streak Coins`,
      });
      await load();
      onUpdate?.();
    } finally {
      setClaimingDaily(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/30 p-10 text-center">
        <Loader2 className="h-7 w-7 animate-spin mx-auto text-purple-300" />
      </div>
    );
  }

  if (!selected) {
    return <div className="text-center text-xs text-white/60 py-8">Belum ada paket membership</div>;
  }

  return (
    <div className="rounded-2xl overflow-hidden border-2 border-purple-500/40 bg-gradient-to-br from-[#1a0d2e] via-[#15102e] to-[#0d0820] shadow-2xl">
      {/* TOP BAR — saldo & info */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-black/40 border-b border-purple-500/30">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className="bg-yellow-500/30 text-yellow-100 border-yellow-400/50 gap-1 text-[10px] h-5">
            <Coins className="h-3 w-3" /> {coins.toLocaleString("id-ID")}
          </Badge>
          <Badge className="bg-emerald-500/30 text-emerald-100 border-emerald-400/50 gap-1 text-[10px] h-5">
            <Wallet className="h-3 w-3" /> Rp{totalBalance.toLocaleString("id-ID")}
          </Badge>
        </div>
        <Badge className="bg-purple-500/40 text-purple-100 border-purple-400/60 text-[10px] h-5 uppercase tracking-wider">
          Top-Up
        </Badge>
      </div>

      {/* MAIN AREA: panel kiri + sidebar kanan */}
      <div className="grid grid-cols-[1fr_92px] gap-2 p-2.5">
        {/* PANEL KIRI — paket terpilih */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.25 }}
            className={`relative rounded-xl overflow-hidden border-2 ${theme.border} bg-gradient-to-br ${theme.panel} p-3`}
          >
            {/* Header: judul beli */}
            <div className="text-center mb-2">
              <p className="text-[10px] text-white/80">
                ✦ Beli dalam <span className="font-black text-white">Rp{selected.price_idr.toLocaleString("id-ID")}</span> untuk mendapatkan{" "}
                <Coins className="h-3 w-3 inline text-yellow-300 -mt-0.5" />{" "}
                <span className="font-black text-yellow-300">{selected.bonus_streak_coins}</span>
              </p>
            </div>

            {/* Body: badge logo + nama */}
            <div className="flex items-stretch gap-2.5">
              <div className="flex flex-col items-center justify-center min-w-[88px]">
                <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border-2 ${theme.border} bg-gradient-to-br ${theme.glow} shadow-lg`}>
                  <span className="text-3xl font-black text-white drop-shadow-lg">{theme.letter}</span>
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                </div>
                <div className="mt-1.5 text-center">
                  <p className="text-[10px] font-black text-white uppercase tracking-wide leading-tight">MEMBERSHIP</p>
                  <p className={`text-[10px] font-black ${theme.accent} uppercase tracking-wide leading-tight`}>
                    {selected.name.replace(/membership/i, "").trim() || `${selected.duration_days} HARI`}
                  </p>
                </div>
              </div>

              {/* Detail hadiah */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between bg-black/30 rounded-lg px-2 py-1.5 border border-white/10">
                  <span className="text-[10px] font-bold text-white/80 uppercase">Hadiah Instan</span>
                  <span className="flex items-center gap-1 text-[11px] font-black text-yellow-300">
                    <Coins className="h-3 w-3" />{selected.bonus_streak_coins.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-black/30 rounded-lg px-2 py-1.5 border border-white/10">
                  <span className="text-[10px] font-bold text-white/80 uppercase">Hadiah Harian</span>
                  <span className="flex items-center gap-1 text-[11px] font-black text-amber-300">
                    <Gift className="h-3 w-3" />{(selected.daily_reward_coins || 0).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-black/30 rounded-lg px-2 py-1.5 border border-white/10">
                  <span className="text-[10px] font-bold text-white/80 uppercase">Bonus</span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <Badge className="h-4 px-1 text-[9px] bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-400/50">x{selected.bonus_multiplier}</Badge>
                    {selected.bonus_gems > 0 && (
                      <Badge className="h-4 px-1 text-[9px] bg-cyan-500/30 text-cyan-100 border-cyan-400/50 gap-0.5"><Gem className="h-2.5 w-2.5" />{selected.bonus_gems}</Badge>
                    )}
                    {selected.bonus_freeze_count > 0 && (
                      <Badge className="h-4 px-1 text-[9px] bg-sky-500/30 text-sky-100 border-sky-400/50 gap-0.5"><Snowflake className="h-2.5 w-2.5" />{selected.bonus_freeze_count}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-white/60 text-center pt-0.5">
                  Efektif selama <span className="text-white font-bold">{selected.duration_days} hari</span> setelah pembelian
                </p>
              </div>
            </div>

            {/* Tombol beli besar */}
            <Button
              size="lg"
              disabled={totalBalance < selected.price_idr || busy === `${selected.id}-balance`}
              onClick={() => purchase(selected.id)}
              className={`mt-2.5 w-full h-11 text-sm font-black uppercase tracking-wider bg-gradient-to-r ${theme.glow} hover:brightness-110 text-white shadow-lg disabled:opacity-50`}
            >
              {busy === `${selected.id}-balance` ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <><Wallet className="h-4 w-4 mr-2" />RP{selected.price_idr.toLocaleString("id-ID")}</>
              )}
            </Button>

            {activeForSelected && (
              <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-emerald-300">
                <Check className="h-3 w-3" />
                <span className="font-bold">Aktif s.d. {new Date(activeForSelected.expires_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* SIDEBAR KANAN — daftar paket */}
        <div className="flex flex-col gap-1.5">
          {plans.map((p) => {
            const t = getTheme(p);
            const isSel = p.id === selected.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={`relative rounded-lg border-2 transition-all overflow-hidden text-left p-1.5 ${
                  isSel
                    ? `${t.border} bg-gradient-to-br ${t.panel} shadow-lg ring-2 ring-white/20`
                    : "border-white/10 bg-black/30 hover:bg-black/40"
                }`}
              >
                {/* Reward chip atas */}
                <div className="flex items-center justify-end gap-0.5 mb-1">
                  <Coins className="h-2.5 w-2.5 text-yellow-300" />
                  <span className="text-[9px] font-black text-yellow-200">{p.bonus_streak_coins}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black text-white bg-gradient-to-br ${t.glow} border ${t.border} shrink-0`}>
                    {t.letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-white uppercase truncate leading-tight">{p.name.replace(/membership/i, "").trim() || `${p.duration_days}H`}</p>
                    <p className="text-[8px] font-bold text-white/70 leading-tight">RP{(p.price_idr / 1000).toFixed(0)}K</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* HADIAH HARIAN GRID */}
      <div className="px-2.5 pb-3">
        <div className="bg-black/40 rounded-xl border border-purple-500/30 p-2.5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-1 h-3 bg-yellow-400 rounded-sm" />
              <p className="text-[11px] font-black text-white uppercase tracking-wider">Hadiah Harian</p>
              <span className="text-[9px] text-white/60">(Refresh setiap hari pada <span className="text-yellow-300 font-bold">00:00</span>)</span>
            </div>
            {dailyClaim && dailyClaim.coins_today > 0 && !claimedToday && (
              <Button
                size="sm"
                disabled={claimingDaily || !dailyClaim.available}
                onClick={claimDaily}
                className="h-7 px-2 text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                {claimingDaily ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Gift className="h-3 w-3 mr-1" />KLAIM</>}
              </Button>
            )}
            {claimedToday && (
              <Badge className="bg-white/10 text-white/70 border-white/20 text-[10px] gap-1 h-6">
                <Lock className="h-2.5 w-2.5" />
                <span className="font-mono tabular-nums">{countdown}</span>
              </Badge>
            )}
          </div>

          {/* Strip kalender harian (scroll horizontal) */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {calendarDays.map((d, idx) => {
              const isToday = idx === 0;
              const isLocked = idx > 0 || (isToday && claimedToday);
              const reward = selected.daily_reward_coins || 0;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.015 }}
                  className={`shrink-0 w-[58px] rounded-lg border-2 overflow-hidden ${
                    isToday && !claimedToday
                      ? `${theme.border} bg-gradient-to-b ${theme.panel} shadow-lg`
                      : claimedToday && isToday
                      ? "border-emerald-400/60 bg-emerald-900/30"
                      : "border-white/10 bg-black/40"
                  }`}
                >
                  <div className={`text-center text-[9px] font-bold py-0.5 ${
                    isToday ? `${theme.accent} bg-black/30` : "text-white/50"
                  }`}>
                    {formatDay(d)}
                  </div>
                  <div className="relative h-12 flex items-center justify-center bg-gradient-to-b from-white/5 to-transparent">
                    {isLocked ? (
                      <Lock className="h-4 w-4 text-white/40" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <Coins className="h-4 w-4 text-yellow-300" />
                        <span className="text-[9px] font-black text-yellow-200 mt-0.5">+{reward}</span>
                      </div>
                    )}
                    {claimedToday && isToday && (
                      <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-[1px]">
                        <Check className="h-5 w-5 text-emerald-300" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="text-[9px] text-center text-white/50 mt-2">
            {active.length > 0
              ? <>✨ Membership aktif! Klaim setiap hari sebelum jam <span className="text-yellow-300 font-bold">00:00 WIB</span></>
              : <>🔒 Beli Membership dulu untuk membuka hadiah harian</>
            }
          </p>
        </div>
      </div>

      {/* PIN DIALOG */}
      <Dialog open={!!pinDialog} onOpenChange={(open) => { if (!open) { setPinDialog(null); setPin(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-500" /> Verifikasi PIN
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Masukkan PIN saldo untuk menyelesaikan pembelian membership.</p>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-center text-lg tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPinDialog(null); setPin(""); }}>Batal</Button>
            <Button
              disabled={pin.length < 4 || !!busy}
              onClick={() => pinDialog && purchase(pinDialog.planId, pin)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

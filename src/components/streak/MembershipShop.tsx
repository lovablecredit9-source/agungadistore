import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Crown, Coins, Wallet, Snowflake, Gem, Sparkles, Clock, Check, Gift, Lock } from "lucide-react";

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
  plan_name: string;
  expires_at: string;
  bonus_multiplier: number;
}

interface DailyClaimInfo {
  available: boolean;
  claimed_today: boolean;
  coins_today: number;
  plan_name: string | null;
  next_unlock: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function useCountdown(targetIso?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return "";
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return "Tersedia!";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

  const countdown = useCountdown(dailyClaim?.next_unlock);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("purchase-membership", { body: { action: "list", visitorId } });
      setPlans(data?.plans || []);
      setActive(data?.active_memberships || []);
      setCoins(data?.user_coins || 0);
      setGameBalance(data?.game_balance || 0);
      setMainBalance(data?.main_balance || 0);
      setDailyClaim(data?.daily_claim || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

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
        description: `${data?.plan_name} berlaku s.d. ${formatDate(data?.expires_at || "")}${bonusBits.length ? " · " + bonusBits.join(" · ") : ""}`,
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
        description: `+${data?.coins_awarded?.toLocaleString("id-ID")} Streak Coins dari ${data?.plan_name}`,
      });
      await load();
      onUpdate?.();
    } finally {
      setClaimingDaily(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-400/30 p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-300" />
      </div>
    );
  }

  const totalBalance = gameBalance + mainBalance;
  const hasActive = active.length > 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 via-yellow-500/15 to-orange-500/15 border-2 border-amber-400/40 p-3 sm:p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-300" />
          <h3 className="font-bold text-base sm:text-lg bg-gradient-to-r from-amber-200 via-yellow-100 to-orange-200 bg-clip-text text-transparent">
            Membership Streak
          </h3>
          <Badge className="bg-amber-500/40 text-amber-100 border-amber-400/60 text-[9px] px-1.5 py-0 h-4">VIP</Badge>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <Badge className="bg-yellow-500/30 text-yellow-100 border-yellow-400/50 gap-1">
            <Coins className="h-3 w-3" /> {coins.toLocaleString("id-ID")}
          </Badge>
          <Badge className="bg-emerald-500/30 text-emerald-100 border-emerald-400/50 gap-1">
            <Wallet className="h-3 w-3" /> Rp{totalBalance.toLocaleString("id-ID")}
          </Badge>
        </div>
      </div>

      {hasActive && (
        <div className="mb-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <Check className="h-4 w-4 text-emerald-300" />
            <p className="text-xs font-bold text-emerald-100">Membership Aktif</p>
          </div>
          {active.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-[11px] text-emerald-100/90">
              <span>👑 {m.plan_name} · x{m.bonus_multiplier}</span>
              <span className="flex items-center gap-1 text-emerald-200/80"><Clock className="h-3 w-3" />{formatDate(m.expires_at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* KARTU KLAIM HARIAN */}
      {hasActive && dailyClaim && dailyClaim.coins_today > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-3 rounded-xl border-2 p-3 ${
            dailyClaim.available
              ? "bg-gradient-to-r from-yellow-500/25 via-amber-500/25 to-orange-500/25 border-amber-300/60 shadow-lg shadow-amber-500/20"
              : "bg-gradient-to-r from-slate-700/40 to-slate-800/40 border-white/15"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                dailyClaim.available ? "bg-amber-400/30 border border-amber-300/60" : "bg-white/10 border border-white/20"
              }`}>
                {dailyClaim.available ? <Gift className="h-5 w-5 text-amber-200" /> : <Lock className="h-5 w-5 text-white/60" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Hadiah Harian VIP</p>
                <p className="text-[10px] text-white/70 truncate">
                  {dailyClaim.plan_name ? `Dari ${dailyClaim.plan_name}` : "Klaim setiap hari"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Coins className="h-3 w-3 text-yellow-300" />
                  <span className="text-[11px] font-black text-yellow-200">+{dailyClaim.coins_today.toLocaleString("id-ID")}</span>
                  <span className="text-[10px] text-white/60">Streak Coins</span>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              {dailyClaim.available ? (
                <Button
                  size="sm"
                  disabled={claimingDaily}
                  onClick={claimDaily}
                  className="h-9 px-3 text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                >
                  {claimingDaily ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Gift className="h-3.5 w-3.5 mr-1" />Klaim</>}
                </Button>
              ) : (
                <div className="text-center">
                  <Badge className="bg-white/10 text-white/80 border-white/20 text-[10px] gap-1">
                    <Lock className="h-2.5 w-2.5" />Terkunci
                  </Badge>
                  <p className="text-[10px] font-mono text-amber-200/80 mt-0.5 tabular-nums">{countdown}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-2.5">
        {plans.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-4">Belum ada paket membership</p>
        )}
        {plans.map((p) => {
          const canPayBalance = p.price_idr > 0 && totalBalance >= p.price_idr;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-xl border-2 p-2.5 ${p.is_featured ? "bg-gradient-to-br from-amber-500/25 to-orange-500/25 border-amber-300/60 shadow-lg shadow-amber-500/20" : "bg-gradient-to-br from-slate-700/40 to-slate-800/40 border-white/15"}`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="text-2xl shrink-0 w-10 h-10 rounded-full flex items-center justify-center border"
                  style={{ background: `${p.badge_color}22`, borderColor: `${p.badge_color}66` }}
                >
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-black text-sm text-white truncate">{p.name}</p>
                    <Badge className="text-[9px] h-4 px-1 bg-white/15 text-white border-white/25">{p.duration_days} hari</Badge>
                    {p.is_featured && (
                      <Badge className="text-[9px] h-4 px-1 bg-amber-400/40 text-amber-100 border-amber-300/60 gap-0.5">
                        <Sparkles className="h-2.5 w-2.5" />HOT
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-white/70 line-clamp-2">{p.description}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge className="text-[9px] h-4 px-1 bg-fuchsia-500/30 text-fuchsia-100 border-fuchsia-400/50">x{p.bonus_multiplier} bonus</Badge>
                    {!!p.daily_reward_coins && p.daily_reward_coins > 0 && (
                      <Badge className="text-[9px] h-4 px-1 bg-amber-500/30 text-amber-100 border-amber-400/50 gap-0.5">
                        <Gift className="h-2.5 w-2.5" />+{p.daily_reward_coins}/hari
                      </Badge>
                    )}
                    {p.bonus_streak_coins > 0 && (
                      <Badge className="text-[9px] h-4 px-1 bg-yellow-500/30 text-yellow-100 border-yellow-400/50 gap-0.5">
                        <Coins className="h-2.5 w-2.5" />+{p.bonus_streak_coins}
                      </Badge>
                    )}
                    {p.bonus_gems > 0 && (
                      <Badge className="text-[9px] h-4 px-1 bg-cyan-500/30 text-cyan-100 border-cyan-400/50 gap-0.5">
                        <Gem className="h-2.5 w-2.5" />+{p.bonus_gems}
                      </Badge>
                    )}
                    {p.bonus_freeze_count > 0 && (
                      <Badge className="text-[9px] h-4 px-1 bg-sky-500/30 text-sky-100 border-sky-400/50 gap-0.5">
                        <Snowflake className="h-2.5 w-2.5" />+{p.bonus_freeze_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2.5">
                <Button
                  size="sm"
                  disabled={!canPayBalance || busy === `${p.id}-balance` || p.price_idr <= 0}
                  onClick={() => purchase(p.id)}
                  className="w-full h-9 text-[11px] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white disabled:opacity-50"
                >
                  {busy === `${p.id}-balance` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="h-3.5 w-3.5 mr-1.5" />
                      Beli · Rp{p.price_idr > 0 ? p.price_idr.toLocaleString("id-ID") : "—"}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

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

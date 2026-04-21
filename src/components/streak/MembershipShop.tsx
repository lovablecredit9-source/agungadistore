import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Crown, Coins, Wallet, Snowflake, Gem, Sparkles, Clock, Check } from "lucide-react";

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

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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
  const [pinDialog, setPinDialog] = useState<{ planId: string; method: "balance" } | null>(null);
  const [pin, setPin] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("purchase-membership", { body: { action: "list", visitorId } });
      setPlans(data?.plans || []);
      setActive(data?.active_memberships || []);
      setCoins(data?.user_coins || 0);
      setGameBalance(data?.game_balance || 0);
      setMainBalance(data?.main_balance || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  async function purchase(planId: string, method: "coins" | "balance", pinValue?: string) {
    const busyKey = `${planId}-${method}`;
    setBusy(busyKey);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-membership", {
        body: { action: "purchase", visitorId, planId, paymentMethod: method, paymentSource: "auto", pin: pinValue },
      });
      if (error || data?.error) {
        if (data?.needPin) {
          setPinDialog({ planId, method: "balance" });
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

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-400/30 p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-300" />
      </div>
    );
  }

  const totalBalance = gameBalance + mainBalance;

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

      {active.length > 0 && (
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

      <div className="grid grid-cols-1 gap-2.5">
        {plans.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-4">Belum ada paket membership</p>
        )}
        {plans.map((p) => {
          const canPayCoins = p.price_coins > 0 && coins >= p.price_coins;
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

              <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                <Button
                  size="sm"
                  disabled={!canPayCoins || busy === `${p.id}-coins` || p.price_coins <= 0}
                  onClick={() => purchase(p.id, "coins")}
                  className="h-9 text-[11px] bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white disabled:opacity-50 px-1"
                >
                  {busy === `${p.id}-coins` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Coins className="h-3 w-3 mr-1" />
                      {p.price_coins > 0 ? p.price_coins.toLocaleString("id-ID") : "—"}
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  disabled={!canPayBalance || busy === `${p.id}-balance` || p.price_idr <= 0}
                  onClick={() => purchase(p.id, "balance")}
                  className="h-9 text-[11px] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white disabled:opacity-50 px-1"
                >
                  {busy === `${p.id}-balance` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Wallet className="h-3 w-3 mr-1" />
                      Rp{p.price_idr > 0 ? p.price_idr.toLocaleString("id-ID") : "—"}
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
              onClick={() => pinDialog && purchase(pinDialog.planId, pinDialog.method, pin)}
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

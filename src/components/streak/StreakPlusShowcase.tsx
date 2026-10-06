import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Flame, Gem, Shield, Gift, Zap, Sparkles, CalendarDays, Check, Minus } from "lucide-react";

interface Plan { id: string; name: string; description: string; duration_days: number; price_idr: number; bonus_multiplier: number; bonus_freeze_count: number; bonus_streak_coins: number; bonus_gems: number; daily_reward_coins?: number; bonus_daily_gems?: number; icon: string; is_featured: boolean }

const BENEFITS = [
  { Icon: Flame, label: "Bonus Streak Reward" }, { Icon: Gem, label: "Bonus Coin" }, { Icon: Shield, label: "Extra Protection" },
  { Icon: Gift, label: "Daily Bonus" }, { Icon: Zap, label: "Exclusive Shop" }, { Icon: Crown, label: "Exclusive Badge" },
  { Icon: Sparkles, label: "Premium Effects" }, { Icon: CalendarDays, label: "Monthly Reward" },
];

/** Hero + comparison for Streak Plus. Data comes from admin-configured plans (category "plus"); purchase uses existing MembershipShop. */
export default function StreakPlusShowcase({ visitorId }: { visitorId: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [active, setActive] = useState<any>(null);

  useEffect(() => {
    supabase.functions.invoke("purchase-membership", { body: { action: "list", visitorId, category: "plus" } }).then(({ data }) => {
      setPlans(data?.plans || []);
      const act = (data?.active || data?.activeMemberships || []) as any[];
      const plusIds = new Set((data?.plans || []).map((p: Plan) => p.id));
      setActive((Array.isArray(act) ? act : [act]).find((m: any) => m && plusIds.has(m.plan_id)) || null);
    });
  }, [visitorId]);

  const rows: { label: string; v: (p: Plan | null) => string | boolean }[] = [
    { label: "Daily Streak", v: () => true },
    { label: "Bonus Reward", v: (p) => p ? `x${Number(p.bonus_multiplier).toFixed(1)}` : false },
    { label: "Protection", v: (p) => p && p.bonus_freeze_count > 0 ? `${p.bonus_freeze_count}🛡️` : false },
    { label: "Daily Coin", v: (p) => p && p.daily_reward_coins ? `+${p.daily_reward_coins}` : false },
    { label: "Exclusive Shop", v: (p) => !!p },
    { label: "Bonus Awal", v: (p) => p && p.bonus_streak_coins ? `${p.bonus_streak_coins}🔥` : false },
    { label: "Bonus Gem", v: (p) => p && p.bonus_gems ? `${p.bonus_gems}💎` : false },
  ];

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl plus-hero-bg border border-amber-300/40 p-5 text-center">
        {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="rarity-particle rarity-legendary" style={{ left: `${10 + i * 15}%`, bottom: 6, animationDelay: `${i * 0.6}s` }} />)}
        <motion.div initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative flex justify-center">
          <Crown className="w-12 h-12 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,.7)]" />
        </motion.div>
        <h3 className="relative mt-1 text-2xl font-black tracking-tight text-amber-100">STREAK PLUS</h3>
        <p className="relative text-xs text-white/75 font-semibold">Buat Streak kamu lebih powerful.</p>
        {active && (
          <div className="relative mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-black text-[11px] font-black">
            <Check className="w-3 h-3" /> {active.plan_name} aktif s/d {new Date(active.expires_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        )}
        <div className="relative mt-4 grid grid-cols-4 gap-2">
          {BENEFITS.map(({ Icon, label }) => (
            <div key={label} className="rounded-xl bg-black/35 border border-white/10 p-2 flex flex-col items-center gap-1">
              <Icon className="w-4 h-4 text-amber-300" /><span className="text-[9px] leading-tight font-bold text-white/85">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {plans.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {plans.map((p, i) => (
            <div key={p.id} className={`rarity-card ${["rarity-legendary", "rarity-rare", "rarity-mythic"][i % 3]} p-3 text-center`}>
              {p.is_featured && <span className="relative text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-black">POPULER</span>}
              <div className="relative text-2xl mt-1">{p.icon}</div>
              <div className="relative text-[11px] font-black text-white">{p.name}</div>
              <div className="relative text-sm font-black text-amber-200 tabular-nums">Rp{p.price_idr.toLocaleString("id-ID")}</div>
              <div className="relative text-[9px] text-white/60">/ {p.duration_days} hari</div>
            </div>
          ))}
        </div>
      )}

      {plans.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead><tr className="text-white/70">
              <th className="text-left p-2 font-black">Benefit</th><th className="p-2 font-black">FREE</th>
              {plans.map((p) => <th key={p.id} className="p-2 font-black text-amber-200">{p.name.replace("PLUS ", "")}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-white/5">
                  <td className="p-2 font-bold text-white/85">{r.label}</td>
                  {[null, ...plans].map((p, i) => {
                    const v = r.v(p);
                    return <td key={i} className="p-2 text-center font-black text-white">{v === true ? <Check className="w-3 h-3 mx-auto text-emerald-300" /> : v ? v : <Minus className="w-3 h-3 mx-auto text-white/30" />}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-center text-white/50">Harga & benefit diatur admin. Pembayaran memakai Saldo Utama + PIN.</p>
    </div>
  );
}

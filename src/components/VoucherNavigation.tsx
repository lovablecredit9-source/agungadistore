import { motion } from "framer-motion";
import { Ticket, History, Sparkles, ShoppingBag, Zap, Gift, TrendingUp, Award } from "lucide-react";
import CountUp from "@/components/CountUp";

type VoucherSection = "claim" | "recent" | "tips";

interface Props {
  active: VoucherSection;
  onChange: (s: VoucherSection) => void;
  totalClaimed: number;
  todayCount: number;
  pendingCodes: number;
  onGoProduk: () => void;
  onGoSaldo: () => void;
  onGoHistory: () => void;
}

/**
 * Navigasi voucher yang keren — hero stats + quick actions + segmented tabs.
 * Dipakai di paling atas tab Voucher untuk pengalaman lebih premium.
 */
export default function VoucherNavigation({
  active, onChange, totalClaimed, todayCount, pendingCodes,
  onGoProduk, onGoSaldo, onGoHistory,
}: Props) {
  const tabs: { id: VoucherSection; label: string; icon: typeof Ticket; color: string }[] = [
    { id: "claim",  label: "Klaim",   icon: Ticket,    color: "from-emerald-500 to-teal-500" },
    { id: "recent", label: "Terbaru", icon: History,   color: "from-sky-500 to-blue-500" },
    { id: "tips",   label: "Tips",    color: "from-violet-500 to-fuchsia-500", icon: Sparkles },
  ];

  const quickActions = [
    { icon: ShoppingBag, label: "Produk",  bg: "bg-amber-50 dark:bg-amber-500/10",  ring: "ring-amber-500/20",  color: "text-amber-600",  onClick: onGoProduk },
    { icon: Zap,         label: "Top Up",  bg: "bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-500/20", color: "text-emerald-600", onClick: onGoSaldo },
    { icon: History,     label: "Riwayat", bg: "bg-sky-50 dark:bg-sky-500/10",      ring: "ring-sky-500/20",     color: "text-sky-600",     onClick: onGoHistory },
    { icon: Gift,        label: "Hadiah",  bg: "bg-rose-50 dark:bg-rose-500/10",    ring: "ring-rose-500/20",    color: "text-rose-600",    onClick: () => onChange("tips") },
  ];

  return (
    <div className="space-y-3">
      {/* === Stats Strip === */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-3 gap-2"
      >
        <div className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 rounded-2xl p-3 text-center">
          <Award className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-lg font-extrabold text-primary leading-none mt-1"><CountUp value={totalClaimed} /></p>
        </div>
        <div className="bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 rounded-2xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Hari Ini</p>
          <p className="text-lg font-extrabold text-accent leading-none mt-1"><CountUp value={todayCount} /></p>
        </div>
        <div className="bg-gradient-to-br from-fuchsia-500/15 to-pink-500/5 border border-fuchsia-500/20 rounded-2xl p-3 text-center">
          <Ticket className="w-4 h-4 text-fuchsia-500 mx-auto mb-1" />
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="text-lg font-extrabold text-fuchsia-500 leading-none mt-1"><CountUp value={pendingCodes} /></p>
        </div>
      </motion.div>

      {/* === Quick Actions === */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-4 gap-2 bg-card border border-border/60 rounded-2xl p-3 shadow-sm"
      >
        {quickActions.map((a, i) => (
          <motion.button
            key={a.label}
            type="button"
            whileTap={{ scale: 0.94 }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i + 0.1 }}
            onClick={a.onClick}
            className="flex flex-col items-center gap-1.5 p-1.5 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ${a.bg} ${a.ring}`}>
              <a.icon className={`w-5 h-5 ${a.color}`} strokeWidth={2.2} />
            </span>
            <span className="text-[10px] font-bold text-foreground">{a.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* === Segmented Tabs === */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative bg-card border border-border/60 rounded-2xl p-1.5 shadow-sm flex gap-1"
      >
        {tabs.map((tb) => {
          const isActive = active === tb.id;
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => onChange(tb.id)}
              className="relative flex-1 z-10"
            >
              {isActive && (
                <motion.div
                  layoutId="voucher-tab-pill"
                  className={`absolute inset-0 rounded-xl bg-gradient-to-r ${tb.color} shadow-lg`}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className={`relative flex items-center justify-center gap-1.5 py-2.5 text-xs font-extrabold transition-colors ${isActive ? "text-white" : "text-muted-foreground"}`}>
                <Icon className="w-3.5 h-3.5" />
                {tb.label}
              </span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}

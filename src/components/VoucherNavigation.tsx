import { Ticket, History, Sparkles, ShoppingBag, Zap, Gift } from "lucide-react";
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
 * Navigasi voucher minimalis ala Instagram/TikTok — flat, tanpa gradient berlebihan.
 */
export default function VoucherNavigation({
  active, onChange, totalClaimed, todayCount, pendingCodes,
  onGoProduk, onGoSaldo, onGoHistory,
}: Props) {
  const tabs: { id: VoucherSection; label: string; icon: typeof Ticket }[] = [
    { id: "claim",  label: "Klaim",   icon: Ticket },
    { id: "recent", label: "Terbaru", icon: History },
    { id: "tips",   label: "Tips",    icon: Sparkles },
  ];

  const quickActions = [
    { icon: ShoppingBag, label: "Produk",  onClick: onGoProduk },
    { icon: Zap,         label: "Top Up",  onClick: onGoSaldo },
    { icon: History,     label: "Riwayat", onClick: onGoHistory },
    { icon: Gift,        label: "Hadiah",  onClick: () => onChange("tips") },
  ];

  return (
    <div className="space-y-3">
      {/* === Stats Strip — flat === */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-lg font-bold text-foreground leading-none mt-1.5"><CountUp value={totalClaimed} /></p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Hari Ini</p>
          <p className="text-lg font-bold text-foreground leading-none mt-1.5"><CountUp value={todayCount} /></p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="text-lg font-bold text-foreground leading-none mt-1.5"><CountUp value={pendingCodes} /></p>
        </div>
      </div>

      {/* === Quick Actions — outline icons === */}
      <div className="grid grid-cols-4 gap-1 bg-card border border-border rounded-xl p-2">
        {quickActions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="flex flex-col items-center gap-1.5 py-2 rounded-lg hover:bg-muted/50 active:bg-muted/70 transition-colors"
          >
            <a.icon className="w-5 h-5 text-foreground" strokeWidth={1.7} />
            <span className="text-[10px] font-medium text-foreground">{a.label}</span>
          </button>
        ))}
      </div>

      {/* === Segmented Tabs — underline indicator === */}
      <div className="flex border-b border-border">
        {tabs.map((tb) => {
          const isActive = active === tb.id;
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => onChange(tb.id)}
              className="relative flex-1 py-2.5"
            >
              <span className={`flex items-center justify-center gap-1.5 text-xs transition-colors ${isActive ? "text-foreground font-semibold" : "text-muted-foreground font-normal"}`}>
                <Icon className="w-4 h-4" strokeWidth={isActive ? 2.2 : 1.7} />
                {tb.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

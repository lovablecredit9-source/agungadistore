import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet, ArrowUpCircle, History, ShoppingBag, Ticket, TrendingUp,
  TrendingDown, Sparkles, ChevronRight,
} from "lucide-react";
import CountUp from "@/components/CountUp";
import { motion } from "framer-motion";
import { BanBanner } from "@/components/BanBanner";

interface BalanceTx {
  id: string;
  amount: number;
  created_at: string;
  type: string;
  description: string | null;
}

interface VoucherItem {
  id: string;
  code: string;
  discount_amount: number;
  expires_at: string | null;
}

interface Props {
  username: string;
  balance: number;
  gameBalance: number;
  transactions: BalanceTx[];
  vouchers?: VoucherItem[];
  formatPrice: (n: number) => string;
  onTopUp: () => void;
  onHistory: () => void;
  onShop: () => void;
  onVoucher: () => void;
}

/**
 * Wallet Dashboard — clean & minimal.
 * Tampil di paling atas tab Saldo, gaya putih bersih ala fintech (Dana/OVO).
 * Berisi: Hero saldo CountUp, 4 quick actions, mini chart 7 hari, voucher aktif.
 */
export default function WalletDashboard({
  username, balance, gameBalance, transactions, vouchers = [],
  formatPrice, onTopUp, onHistory, onShop, onVoucher,
}: Props) {
  // Build last-7-days in/out chart data
  const chart = useMemo(() => {
    const days: { label: string; date: string; in: number; out: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("id-ID", { weekday: "short" }).slice(0, 3);
      days.push({ label, date: key, in: 0, out: 0 });
    }
    transactions.forEach(tx => {
      const k = tx.created_at.slice(0, 10);
      const day = days.find(d => d.date === k);
      if (!day) return;
      if (tx.amount > 0) day.in += tx.amount;
      else day.out += Math.abs(tx.amount);
    });
    const max = Math.max(1, ...days.flatMap(d => [d.in, d.out]));
    const totalIn = days.reduce((s, d) => s + d.in, 0);
    const totalOut = days.reduce((s, d) => s + d.out, 0);
    return { days, max, totalIn, totalOut };
  }, [transactions]);

  const activeVouchers = vouchers.filter(v => !v.expires_at || new Date(v.expires_at) > new Date()).slice(0, 3);

  const quickActions = [
    { icon: ArrowUpCircle, label: "Top Up", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", ring: "ring-emerald-500/20", onClick: onTopUp },
    { icon: History, label: "Riwayat", color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-500/10", ring: "ring-sky-500/20", onClick: onHistory },
    { icon: ShoppingBag, label: "Belanja", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-500/10", ring: "ring-violet-500/20", onClick: onShop },
    { icon: Ticket, label: "Voucher", color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-500/10", ring: "ring-rose-500/20", onClick: onVoucher },
  ];

  return (
    <div className="space-y-3">
      <BanBanner />
      {/* === Hero Saldo Card - minimal clean white === */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="overflow-hidden border border-border/60 shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Saldo Tersedia
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Hai, {username} 👋</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
            </div>

            <p className="text-3xl font-extrabold text-foreground tracking-tight mt-1">
              <CountUp value={balance} format={(n) => formatPrice(n)} />
            </p>

            {gameBalance > 0 && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  + Saldo IN <CountUp value={gameBalance} format={(n) => formatPrice(n)} />
                </span>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {quickActions.map((a, i) => (
                <motion.button
                  key={a.label}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i + 0.15 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={a.onClick}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/40 transition-colors"
                >
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ${a.bg} ${a.ring}`}>
                    <a.icon className={`w-5 h-5 ${a.color}`} strokeWidth={2.2} />
                  </span>
                  <span className="text-[10px] font-bold text-foreground">{a.label}</span>
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* === Mini Chart 7 hari === */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border border-border/60 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-extrabold text-foreground">Aktivitas 7 Hari</p>
                <p className="text-[10px] text-muted-foreground">Saldo masuk vs keluar</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <TrendingUp className="w-3 h-3" /> {formatPrice(chart.totalIn)}
                </span>
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <TrendingDown className="w-3 h-3" /> {formatPrice(chart.totalOut)}
                </span>
              </div>
            </div>

            <div className="flex items-end justify-between gap-1.5 h-24">
              {chart.days.map((d, i) => {
                const inH = (d.in / chart.max) * 100;
                const outH = (d.out / chart.max) * 100;
                const isToday = i === chart.days.length - 1;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-0.5 h-20">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${inH}%` }}
                        transition={{ duration: 0.6, delay: 0.05 * i }}
                        className="w-1/2 rounded-t bg-emerald-500/80 min-h-[2px]"
                        title={`Masuk: ${formatPrice(d.in)}`}
                      />
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${outH}%` }}
                        transition={{ duration: 0.6, delay: 0.05 * i + 0.1 }}
                        className="w-1/2 rounded-t bg-rose-500/80 min-h-[2px]"
                        title={`Keluar: ${formatPrice(d.out)}`}
                      />
                    </div>
                    <span className={`text-[9px] font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {chart.totalIn === 0 && chart.totalOut === 0 && (
              <p className="text-[10px] text-center text-muted-foreground mt-2 italic">
                Belum ada aktivitas - yuk mulai transaksi!
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* === Voucher Aktif === */}
      {activeVouchers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border border-border/60 shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-rose-500" />
                  <p className="text-[11px] font-extrabold text-foreground">Voucher Aktif</p>
                </div>
                <button
                  type="button"
                  onClick={onVoucher}
                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
                >
                  Semua <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                {activeVouchers.map(v => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-500/5 dark:to-pink-500/5 border border-rose-200/50 dark:border-rose-500/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-card flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Ticket className="w-4 h-4 text-rose-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-foreground truncate font-mono">{v.code}</p>
                        <p className="text-[9px] text-muted-foreground">
                          Diskon {formatPrice(v.discount_amount)}
                          {v.expires_at && ` • Expire ${new Date(v.expires_at).toLocaleDateString("id-ID")}`}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/10" onClick={onVoucher}>
                      Pakai
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

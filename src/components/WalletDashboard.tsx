import { useMemo } from "react";
import {
  Wallet, ArrowUpCircle, History, ShoppingBag, Ticket, TrendingUp,
  TrendingDown, Sparkles, ChevronRight,
} from "lucide-react";
import CountUp from "@/components/CountUp";
import { motion } from "framer-motion";
import { BanBanner } from "@/components/BanBanner";
import BalanceAnalytics from "@/components/BalanceAnalytics";

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
 * Wallet Dashboard — Aurora Neon Premium.
 * Hero saldo, quick actions warna-warni, mini chart aktivitas, voucher aktif.
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
    { icon: ArrowUpCircle, label: "Top Up", color: "from-emerald-500 to-green-500", glow: "16,185,129", onClick: onTopUp },
    { icon: History, label: "Riwayat", color: "from-cyan-400 to-blue-500", glow: "34,211,238", onClick: onHistory },
    { icon: ShoppingBag, label: "Belanja", color: "from-purple-500 to-violet-600", glow: "168,85,247", onClick: onShop },
    { icon: Ticket, label: "Voucher", color: "from-pink-500 to-rose-500", glow: "236,72,153", onClick: onVoucher },
  ];

  return (
    <div className="space-y-3">
      <BanBanner />

      {/* === Hero Saldo Card - Aurora Neon Premium === */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-3xl overflow-hidden p-[1.5px] aurora-shift"
        style={{ background: "linear-gradient(135deg, hsl(150 80% 50%/0.7), hsl(190 95% 55%/0.7), hsl(280 90% 65%/0.7), hsl(150 80% 50%/0.7))", backgroundSize: "300% 300%" }}
      >
        <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-5 overflow-hidden">
          {/* Decorative glow blobs */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="pointer-events-none absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-cyan-400/10 blur-2xl" />

          <div className="relative flex items-start justify-between mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.18em] font-extrabold bg-gradient-to-r from-emerald-500 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
                  💎 Saldo Tersedia
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-500 text-[8px] font-bold">LIVE</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 truncate">Hai, <span className="font-bold text-foreground">{username}</span> 👋</p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-400 to-purple-500 blur-md opacity-70 animate-pulse" />
              <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-400 to-purple-500 flex items-center justify-center shadow-2xl">
                <Wallet className="w-6 h-6 text-white" strokeWidth={2.2} />
              </div>
            </div>
          </div>

          <div className="relative mt-3">
            <p className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-500 via-cyan-400 to-purple-500 bg-clip-text text-transparent leading-none">
              <CountUp value={balance} format={(n) => formatPrice(n)} />
            </p>
          </div>

          {gameBalance > 0 && (
            <div className="relative mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-400/15 to-amber-500/15 border border-yellow-400/40 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-[10px] font-extrabold bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">
                + Saldo IN <CountUp value={gameBalance} format={(n) => formatPrice(n)} />
              </span>
            </div>
          )}

          {/* Quick Actions - Aurora Neon */}
          <div className="relative grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-white/10">
            {quickActions.map((a, i) => (
              <motion.button
                key={a.label}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i + 0.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={a.onClick}
                className="group relative flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/30 hover:bg-white/[0.08] transition-all overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${a.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                <div className="relative">
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${a.color} blur-md opacity-50 group-hover:opacity-90 transition-opacity scale-110`} />
                  <span className={`relative w-11 h-11 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center shadow-lg`}>
                    <a.icon className="w-5 h-5 text-white" strokeWidth={2.4} />
                  </span>
                </div>
                <span className="relative text-[10px] font-extrabold text-foreground">{a.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* === Mini Chart 7 hari - Aurora Premium === */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative rounded-3xl overflow-hidden p-[1.5px] aurora-shift"
        style={{ background: "linear-gradient(135deg, hsl(150 80% 50%/0.5), hsl(330 90% 60%/0.5), hsl(190 95% 55%/0.5), hsl(150 80% 50%/0.5))", backgroundSize: "300% 300%" }}
      >
        <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-4 overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-rose-500/15 blur-3xl" />

          <div className="relative flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-rose-500 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
                </div>
                <p className="text-xs font-extrabold bg-gradient-to-r from-emerald-500 via-cyan-400 to-rose-500 bg-clip-text text-transparent uppercase tracking-wider">Aktivitas 7 Hari</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 ml-7">Saldo masuk vs keluar</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-[10px] font-extrabold">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                <TrendingUp className="w-3 h-3" /> {formatPrice(chart.totalIn)}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-500">
                <TrendingDown className="w-3 h-3" /> {formatPrice(chart.totalOut)}
              </span>
            </div>
          </div>

          <div className="relative flex items-end justify-between gap-1.5 h-28 px-1">
            {chart.days.map((d, i) => {
              const inH = (d.in / chart.max) * 100;
              const outH = (d.out / chart.max) * 100;
              const isToday = i === chart.days.length - 1;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-end justify-center gap-0.5 h-24">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${inH}%` }}
                      transition={{ duration: 0.6, delay: 0.05 * i }}
                      className="relative w-1/2 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 min-h-[3px] shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                      title={`Masuk: ${formatPrice(d.in)}`}
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${outH}%` }}
                      transition={{ duration: 0.6, delay: 0.05 * i + 0.1 }}
                      className="relative w-1/2 rounded-t-md bg-gradient-to-t from-rose-600 to-rose-400 min-h-[3px] shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                      title={`Keluar: ${formatPrice(d.out)}`}
                    />
                  </div>
                  <span className={`text-[9px] font-extrabold ${isToday ? "px-1.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 text-white shadow-lg" : "text-muted-foreground"}`}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          {chart.totalIn === 0 && chart.totalOut === 0 && (
            <p className="relative text-[10px] text-center text-muted-foreground mt-3 italic">
              ✨ Belum ada aktivitas — yuk mulai transaksi!
            </p>
          )}
        </div>
      </motion.div>

      {/* === Analitik Saldo Lanjutan === */}
      <BalanceAnalytics balance={balance} transactions={transactions} formatPrice={formatPrice} />

      {/* === Voucher Aktif - Aurora Premium === */}
      {activeVouchers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative rounded-3xl overflow-hidden p-[1.5px] aurora-shift"
          style={{ background: "linear-gradient(135deg, hsl(330 90% 60%/0.6), hsl(280 90% 65%/0.6), hsl(0 90% 60%/0.6), hsl(330 90% 60%/0.6))", backgroundSize: "300% 300%" }}
        >
          <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-4 overflow-hidden">
            <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pink-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-purple-500/15 blur-3xl" />

            <div className="relative flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 blur-md opacity-60" />
                  <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
                    <Ticket className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
                  </div>
                </div>
                <p className="text-xs font-extrabold bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 bg-clip-text text-transparent uppercase tracking-wider">🎟️ Voucher Aktif</p>
              </div>
              <button
                type="button"
                onClick={onVoucher}
                className="group inline-flex items-center gap-0.5 px-2 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-[10px] font-extrabold text-pink-500 hover:bg-pink-500/25 transition-colors"
              >
                Semua <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="relative space-y-2">
              {activeVouchers.map(v => (
                <div
                  key={v.id}
                  className="group relative flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-purple-500/10 border border-pink-500/20 hover:border-pink-500/40 transition-all overflow-hidden"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-pink-500 to-rose-500" />
                  <div className="flex items-center gap-2.5 min-w-0 relative">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                      <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
                        <Ticket className="w-4 h-4 text-white" strokeWidth={2.4} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-foreground truncate font-mono tracking-wider">{v.code}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        💰 Diskon <span className="font-bold text-pink-500">{formatPrice(v.discount_amount)}</span>
                        {v.expires_at && ` • ⏱️ ${new Date(v.expires_at).toLocaleDateString("id-ID")}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onVoucher}
                    className="relative h-7 px-3 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-extrabold shadow-lg hover:scale-105 active:scale-95 transition-transform"
                  >
                    Pakai →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

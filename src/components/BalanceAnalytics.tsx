import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import {
  BarChart3, TrendingUp, TrendingDown, Wallet, Calendar,
  ArrowUpRight, ArrowDownRight, Activity, PieChart as PieIcon, Sparkles,
} from "lucide-react";

interface BalanceTx {
  id: string;
  amount: number;
  created_at: string;
  type: string;
  description: string | null;
}

interface Props {
  balance: number;
  transactions: BalanceTx[];
  formatPrice: (n: number) => string;
}

type Period = 7 | 30 | 90;

const PERIOD_LABEL: Record<Period, string> = {
  7: "7 Hari",
  30: "30 Hari",
  90: "90 Hari",
};

const CATEGORY_COLORS = [
  "#10b981", "#06b6d4", "#a855f7", "#ec4899",
  "#f59e0b", "#3b82f6", "#ef4444", "#84cc16",
];

function categorize(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("topup") || t.includes("deposit")) return "Top Up";
  if (t.includes("purchase") || t.includes("buy") || t.includes("checkout")) return "Belanja";
  if (t.includes("game") || t.includes("spin") || t.includes("luck")) return "Game";
  if (t.includes("voucher") || t.includes("discount")) return "Voucher";
  if (t.includes("music") || t.includes("song")) return "Musik";
  if (t.includes("refund") || t.includes("cancel")) return "Refund";
  if (t.includes("bonus") || t.includes("reward") || t.includes("streak")) return "Bonus";
  if (t.includes("transfer")) return "Transfer";
  return "Lainnya";
}

export default function BalanceAnalytics({ balance, transactions, formatPrice }: Props) {
  const [period, setPeriod] = useState<Period>(30);

  const data = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (period - 1));
    start.setHours(0, 0, 0, 0);

    const inRange = transactions.filter(t => new Date(t.created_at) >= start);

    // Daily series
    const days: { date: string; label: string; in: number; out: number; net: number; cumulative: number }[] = [];
    for (let i = 0; i < period; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = period <= 7
        ? d.toLocaleDateString("id-ID", { weekday: "short" }).slice(0, 3)
        : `${d.getDate()}/${d.getMonth() + 1}`;
      days.push({ date: key, label, in: 0, out: 0, net: 0, cumulative: 0 });
    }
    inRange.forEach(tx => {
      const k = tx.created_at.slice(0, 10);
      const d = days.find(x => x.date === k);
      if (!d) return;
      if (tx.amount > 0) d.in += tx.amount;
      else d.out += Math.abs(tx.amount);
    });

    // Cumulative net flow inside the period
    let acc = 0;
    days.forEach(d => {
      d.net = d.in - d.out;
      acc += d.net;
      d.cumulative = acc;
    });

    const totalIn = days.reduce((s, d) => s + d.in, 0);
    const totalOut = days.reduce((s, d) => s + d.out, 0);
    const net = totalIn - totalOut;
    const avgDaily = totalOut / period;
    const activeDays = days.filter(d => d.in > 0 || d.out > 0).length;

    // Biggest income/expense
    let biggestIn: BalanceTx | null = null;
    let biggestOut: BalanceTx | null = null;
    inRange.forEach(t => {
      if (t.amount > 0 && (!biggestIn || t.amount > biggestIn.amount)) biggestIn = t;
      if (t.amount < 0 && (!biggestOut || t.amount < biggestOut.amount)) biggestOut = t;
    });

    // Category breakdown (expenses only)
    const catMap = new Map<string, number>();
    inRange.forEach(t => {
      if (t.amount >= 0) return;
      const c = categorize(t.type);
      catMap.set(c, (catMap.get(c) || 0) + Math.abs(t.amount));
    });
    const categories = Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Trend vs previous period
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - period);
    const prevEnd = new Date(start);
    let prevOut = 0;
    transactions.forEach(t => {
      const d = new Date(t.created_at);
      if (d >= prevStart && d < prevEnd && t.amount < 0) prevOut += Math.abs(t.amount);
    });
    const trendPct = prevOut > 0 ? Math.round(((totalOut - prevOut) / prevOut) * 100) : null;

    return {
      days, totalIn, totalOut, net, avgDaily, activeDays,
      biggestIn, biggestOut, categories, trendPct,
    };
  }, [transactions, period]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="relative rounded-3xl overflow-hidden p-[1.5px] aurora-shift"
      style={{
        background: "linear-gradient(135deg, hsl(190 95% 55%/0.6), hsl(280 90% 65%/0.6), hsl(150 80% 50%/0.6), hsl(190 95% 55%/0.6))",
        backgroundSize: "300% 300%",
      }}
    >
      <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-4 overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-purple-500/15 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 blur-md opacity-60" />
              <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg">
                <BarChart3 className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
              </div>
            </div>
            <div>
              <p className="text-xs font-extrabold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent uppercase tracking-wider">
                Analitik Saldo
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Insight pintar keuangan kamu</p>
            </div>
          </div>
          {data.trendPct !== null && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
              data.trendPct > 0
                ? "bg-rose-500/15 border-rose-500/30 text-rose-500"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
            }`}>
              {data.trendPct > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(data.trendPct)}%
            </span>
          )}
        </div>

        {/* Period filter */}
        <div className="relative grid grid-cols-3 gap-1.5 mb-3 p-1 rounded-xl bg-white/[0.04] border border-white/10">
          {([7, 30, 90] as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`relative h-7 rounded-lg text-[10px] font-extrabold transition-all ${
                period === p
                  ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="relative grid grid-cols-2 gap-2 mb-3">
          <div className="relative p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 overflow-hidden">
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-wider">
              <TrendingUp className="w-3 h-3" /> Masuk
            </div>
            <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">{formatPrice(data.totalIn)}</p>
          </div>
          <div className="relative p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 overflow-hidden">
            <div className="flex items-center gap-1 text-[9px] font-bold text-rose-500 uppercase tracking-wider">
              <TrendingDown className="w-3 h-3" /> Keluar
            </div>
            <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">{formatPrice(data.totalOut)}</p>
          </div>
          <div className={`relative p-2.5 rounded-xl border overflow-hidden ${
            data.net >= 0 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-amber-500/10 border-amber-500/20"
          }`}>
            <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${
              data.net >= 0 ? "text-cyan-500" : "text-amber-500"
            }`}>
              <Wallet className="w-3 h-3" /> Net Flow
            </div>
            <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">
              {data.net >= 0 ? "+" : ""}{formatPrice(data.net)}
            </p>
          </div>
          <div className="relative p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 overflow-hidden">
            <div className="flex items-center gap-1 text-[9px] font-bold text-purple-500 uppercase tracking-wider">
              <Activity className="w-3 h-3" /> Avg/Hari
            </div>
            <p className="text-sm font-extrabold text-foreground mt-0.5 truncate">{formatPrice(Math.round(data.avgDaily))}</p>
          </div>
        </div>

        {/* Area chart cumulative */}
        <div className="relative rounded-xl bg-white/[0.03] border border-white/10 p-2 mb-3">
          <div className="flex items-center justify-between mb-1 px-1">
            <p className="text-[10px] font-extrabold text-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> Tren Net Flow
            </p>
            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" /> {data.activeDays} hari aktif
            </p>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={data.days} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.2} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }}
                formatter={(v: number) => formatPrice(v)}
              />
              <Area type="monotone" dataKey="cumulative" stroke="#06b6d4" strokeWidth={2} fill="url(#netGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category breakdown */}
        {data.categories.length > 0 && (
          <div className="relative rounded-xl bg-white/[0.03] border border-white/10 p-3 mb-3">
            <div className="flex items-center gap-1 mb-2">
              <PieIcon className="w-3 h-3 text-pink-500" />
              <p className="text-[10px] font-extrabold text-foreground">Kategori Pengeluaran</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <ResponsiveContainer width={80} height={80}>
                  <PieChart>
                    <Pie
                      data={data.categories}
                      dataKey="value"
                      innerRadius={20}
                      outerRadius={38}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {data.categories.map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }}
                      formatter={(v: number) => formatPrice(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                {data.categories.slice(0, 4).map((c, i) => {
                  const pct = Math.round((c.value / data.totalOut) * 100);
                  return (
                    <div key={c.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                      <span className="text-[10px] font-bold text-foreground truncate flex-1">{c.name}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Highlights */}
        {(data.biggestIn || data.biggestOut) && (
          <div className="relative grid grid-cols-2 gap-2">
            {data.biggestIn && (
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider">🚀 Top Income</p>
                <p className="text-[11px] font-extrabold text-foreground mt-0.5 truncate">{formatPrice((data.biggestIn as BalanceTx).amount)}</p>
                <p className="text-[8px] text-muted-foreground truncate">{(data.biggestIn as BalanceTx).description || (data.biggestIn as BalanceTx).type}</p>
              </div>
            )}
            {data.biggestOut && (
              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/10 to-rose-500/5 border border-rose-500/20">
                <p className="text-[8px] font-bold text-rose-500 uppercase tracking-wider">💸 Top Expense</p>
                <p className="text-[11px] font-extrabold text-foreground mt-0.5 truncate">{formatPrice(Math.abs((data.biggestOut as BalanceTx).amount))}</p>
                <p className="text-[8px] text-muted-foreground truncate">{(data.biggestOut as BalanceTx).description || (data.biggestOut as BalanceTx).type}</p>
              </div>
            )}
          </div>
        )}

        {data.totalIn === 0 && data.totalOut === 0 && (
          <p className="relative text-[10px] text-center text-muted-foreground mt-3 italic">
            ✨ Belum ada data di periode ini
          </p>
        )}
      </div>
    </motion.div>
  );
}

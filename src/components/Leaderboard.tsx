import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import {
  Trophy, Crown, Medal, Wallet, ShoppingBag, Package, Gem, CreditCard,
  Coins, Activity, Flame, Music2, ArrowUpCircle, Eye, EyeOff, RefreshCw, Loader2, Users, Gamepad2, UserCheck,
} from "lucide-react";

import { motion } from "framer-motion";

interface Row {
  visitor_id?: string;
  username?: string;
  phone?: string;
  title?: string;
  image_url?: string | null;
  value: number;
  online?: boolean;
  last_active?: string;
  longest?: number;
  level?: string;
}

interface Boards {
  topDeposit: Row[];
  topOrderUser: Row[];
  topOrderProduk: Row[];
  topSaldo: Row[];
  topKredit: Row[];
  topSaldoIn: Row[];
  topGem: Row[];
  topAktif: Row[];
  topStreak: Row[];
  topMusik: Row[];
  topLevelGame: Row[];
  allUsers: Row[];
  totalUsers?: number;
  onlineCount?: number;
  offlineCount?: number;
}

type Fmt = (n: number) => string;
type BoardKey = Exclude<keyof Boards, "totalUsers" | "onlineCount" | "offlineCount">;


function maskPhone(phone: string): string {
  const p = (phone || "").trim();
  if (!p) return "-";
  if (p.length <= 4) return "••••";
  return p.slice(0, 3) + "••••" + p.slice(-2);
}

function maskName(name: string): string {
  const n = (name || "").trim();
  if (!n) return "•••";
  if (n.length <= 2) return n[0] + "•••";
  return n.slice(0, 2) + "•••" + n.slice(-1);
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} mnt lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

const rankColor = (i: number) =>
  i === 0 ? "from-yellow-400 to-amber-500"
  : i === 1 ? "from-slate-300 to-slate-400"
  : i === 2 ? "from-amber-600 to-orange-700"
  : "from-muted-foreground/40 to-muted-foreground/30";

interface BoardDef {
  key: BoardKey;
  label: string;
  icon: any;
  grad: string;
  format: (n: number) => string;
  isProduct?: boolean;
  suffix?: (r: Row) => string;
}

export default function Leaderboard({ formatPrice }: { formatPrice: Fmt }) {
  const [data, setData] = useState<Boards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false); // reveal nama sendiri saja
  const [active, setActive] = useState<BoardKey>("topDeposit");
  const myVid = getVisitorId();

  async function load() {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.functions.invoke("leaderboards", { body: {} });
    if (err || (res as any)?.error) {
      setError("Gagal memuat peringkat. Coba lagi.");
      setLoading(false);
      return;
    }
    setData(res as Boards);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const boards: BoardDef[] = [
    { key: "topDeposit", label: "Top Deposit", icon: ArrowUpCircle, grad: "from-emerald-500 to-green-600", format: formatPrice },
    { key: "topOrderUser", label: "Top Order User", icon: ShoppingBag, grad: "from-orange-500 to-red-500", format: (n) => `${n}×` },
    { key: "topOrderProduk", label: "Top Order Produk", icon: Package, grad: "from-amber-500 to-orange-600", format: (n) => `${n} terjual`, isProduct: true },
    { key: "topSaldo", label: "Top Saldo", icon: Wallet, grad: "from-cyan-500 to-blue-600", format: formatPrice },
    { key: "topKredit", label: "Top Kredit", icon: CreditCard, grad: "from-violet-500 to-purple-600", format: (n) => `${n.toLocaleString("id-ID")} kredit` },
    { key: "topSaldoIn", label: "Top Saldo IN", icon: Coins, grad: "from-yellow-400 to-amber-500", format: (n) => `${n.toLocaleString("id-ID")}` },
    { key: "topGem", label: "Top Gem", icon: Gem, grad: "from-fuchsia-500 to-pink-600", format: (n) => `${n.toLocaleString("id-ID")} 💎` },
    { key: "topAktif", label: "Top Aktif", icon: Activity, grad: "from-teal-500 to-emerald-600", format: () => "", suffix: (r) => timeAgo(r.last_active) },
    { key: "topStreak", label: "Top Streak", icon: Flame, grad: "from-red-500 to-orange-600", format: (n) => `${n} hari 🔥` },
    { key: "topMusik", label: "Top Musik", icon: Music2, grad: "from-indigo-500 to-purple-600", format: fmtDuration },
    { key: "topLevelGame", label: "Top Level Game", icon: Gamepad2, grad: "from-lime-500 to-green-600", format: (n) => `Lv.${n} 🎮` },
    { key: "allUsers", label: "Pengguna Aktif", icon: UserCheck, grad: "from-sky-500 to-indigo-600", format: () => "", suffix: (r) => r.online ? "🟢 Online" : timeAgo(r.last_active) },

  ];

  const activeDef = boards.find((b) => b.key === active)!;
  const rows = (data?.[active] as Row[] | undefined) || [];

  return (
    <div className="space-y-3">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden p-[1.5px]"
        style={{ background: "linear-gradient(135deg, hsl(45 95% 55%/0.7), hsl(280 90% 65%/0.7), hsl(190 95% 55%/0.7))" }}
      >
        <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-4 overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-yellow-500/15 blur-3xl" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shrink-0">
                <Trophy className="w-6 h-6 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent">Peringkat</h2>
                <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                  <Users className="w-3 h-3" /> {(data?.totalUsers ?? 0).toLocaleString("id-ID")} pengguna terdaftar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition-colors ${reveal ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-500" : "bg-rose-500/15 border-rose-500/40 text-rose-500"}`}
                title="Tampilkan nama & no HP milik sendiri"
              >
                {reveal ? <><Eye className="w-3.5 h-3.5" /> Punyaku</> : <><EyeOff className="w-3.5 h-3.5" /> Disensor</>}
              </button>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted/60 hover:bg-muted transition-colors"
                title="Muat ulang"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Board selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {boards.map((b) => {
          const on = b.key === active;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setActive(b.key)}
              className={`group relative shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold transition-all ${on ? "text-white shadow-lg" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
              style={on ? undefined : undefined}
            >
              {on && <span className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${b.grad}`} />}
              <b.icon className="relative w-3.5 h-3.5" strokeWidth={2.2} />
              <span className="relative">{b.label}</span>
            </button>
          );
        })}
      </div>

      {/* Summary khusus Pengguna Aktif */}
      {active === "allUsers" && !loading && !error && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-muted/40 border border-border/50 p-2.5 text-center">
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-base font-extrabold text-foreground leading-none mt-1">{(data?.totalUsers ?? 0).toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-2.5 text-center">
            <p className="text-[9px] font-medium text-green-600 uppercase tracking-wider flex items-center justify-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Online</p>
            <p className="text-base font-extrabold text-green-600 leading-none mt-1">{(data?.onlineCount ?? 0).toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-2xl bg-muted/40 border border-border/50 p-2.5 text-center">
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Offline</p>
            <p className="text-base font-extrabold text-muted-foreground leading-none mt-1">{(data?.offlineCount ?? 0).toLocaleString("id-ID")}</p>
          </div>
        </div>
      )}

      {/* List */}

      <div className="relative rounded-3xl overflow-hidden p-[1.5px]" style={{ background: `linear-gradient(135deg, hsl(var(--border)), transparent)` }}>
        <div className="relative rounded-[22px] bg-card/95 backdrop-blur-xl p-3 min-h-[240px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-xs">Memuat peringkat…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-xs text-rose-500">{error}</p>
              <button onClick={load} className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold">Coba lagi</button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-16">Belum ada data untuk {activeDef.label}.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <motion.div
                  key={(r.visitor_id || r.title || "") + i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/30 border border-border/50"
                >
                  {/* Rank */}
                  <div className={`relative w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br ${rankColor(i)} flex items-center justify-center shadow`}>
                    {i < 3 ? (
                      i === 0 ? <Crown className="w-4 h-4 text-white" /> : <Medal className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-xs font-extrabold text-white">{i + 1}</span>
                    )}
                  </div>

                  {activeDef.isProduct ? (
                    <>
                      {r.image_url ? (
                        <img src={r.image_url} alt={r.title} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{r.title}</p>
                      </div>
                    </>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-foreground truncate">
                          {reveal && r.visitor_id === myVid ? (r.username || "Pengguna") : maskName(r.username || "")}
                        </p>
                        {r.visitor_id === myVid && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[8px] font-bold">
                            KAMU
                          </span>
                        )}
                        {r.online && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-500 text-[8px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> ONLINE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate font-mono">
                        {reveal && r.visitor_id === myVid ? (r.phone || "-") : maskPhone(r.phone || "")}
                      </p>
                    </div>
                  )}

                  {/* Value */}
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-extrabold bg-gradient-to-r ${activeDef.grad} bg-clip-text text-transparent`}>
                      {activeDef.format(r.value)}{activeDef.suffix ? activeDef.suffix(r) : ""}
                    </p>
                    {active === "topStreak" && r.longest ? (
                      <p className="text-[9px] text-muted-foreground">rekor {r.longest} hari</p>
                    ) : active === "topMusik" && r.level ? (
                      <p className="text-[9px] text-muted-foreground">{r.level}</p>
                    ) : active === "topLevelGame" && r.longest ? (
                      <p className="text-[9px] text-muted-foreground">{r.longest.toLocaleString("id-ID")} poin</p>
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <p className="text-center text-[9px] text-muted-foreground mt-3 italic">
            🔒 Nama & no HP pengguna lain selalu disensor. Tombol {reveal ? "\"Punyaku\"" : "\"Disensor\""} hanya menampilkan data milikmu sendiri.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Users, Search, Crown, Ban, Circle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserRow {
  id: string;
  visitor_id: string;
  username: string;
  phone: string;
  email: string | null;
  balance: number;
  updated_at: string;
  last_seen_at?: string | null;
  created_at: string;
}

const ONLINE_MS = 5 * 60 * 1000;

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

export default function AdminTotalUserTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [bans, setBans] = useState<Record<string, { permanent: boolean; until: string | null; reason: string }>>({});
  const [premium, setPremium] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: ub } = await supabase
        .from("user_balances")
        .select("id, visitor_id, username, phone, email, balance, updated_at, last_seen_at, created_at")
        .order("updated_at", { ascending: false })
        .limit(1000);
      setUsers((ub as UserRow[]) ?? []);

      const { data: ban } = await supabase
        .from("account_bans")
        .select("visitor_id, is_permanent, banned_until, reason")
        .eq("is_active", true);
      const bmap: Record<string, { permanent: boolean; until: string | null; reason: string }> = {};
      (ban ?? []).forEach((b: any) => {
        bmap[b.visitor_id] = { permanent: b.is_permanent, until: b.banned_until, reason: b.reason };
      });
      setBans(bmap);

      const { data: subs } = await supabase
        .from("store_premium_subscriptions")
        .select("visitor_id")
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());
      setPremium(new Set((subs ?? []).map((s: any) => s.visitor_id)));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const isOnline = (u: UserRow) => now - new Date(u.updated_at).getTime() < ONLINE_MS;

  const stats = useMemo(() => {
    const online = users.filter(isOnline).length;
    return {
      total: users.length,
      online,
      offline: users.length - online,
      premium: users.filter((u) => premium.has(u.visitor_id)).length,
      banned: Object.keys(bans).length,
    };
  }, [users, premium, bans, now]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) => u.username?.toLowerCase().includes(s) || u.phone?.includes(s) || u.email?.toLowerCase().includes(s),
    );
  }, [users, q]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 border border-primary/20 p-4">
        <p className="text-sm font-black flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Total Pengguna Terdaftar</p>
        <p className="text-[11px] text-muted-foreground">Pantau semua akun saldo, status online, premium, dan banned.</p>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border bg-card p-3 text-center shadow-sm">
          <p className="text-2xl font-black">{stats.total}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Total User</p>
        </div>
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-center shadow-sm">
          <p className="text-2xl font-black text-green-600 flex items-center justify-center gap-1">
            <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 animate-pulse" />{stats.online}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Online</p>
        </div>
        <div className="rounded-2xl border bg-card p-3 text-center shadow-sm">
          <p className="text-2xl font-black text-muted-foreground">{stats.offline}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Offline</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-center shadow-sm">
          <p className="text-2xl font-black text-amber-600 flex items-center justify-center gap-1"><Crown className="w-4 h-4" />{stats.premium}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Premium</p>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-center shadow-sm">
          <p className="text-2xl font-black text-red-600 flex items-center justify-center gap-1"><Ban className="w-4 h-4" />{stats.banned}</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Banned</p>
        </div>
        <button onClick={load} className="rounded-2xl border bg-card p-3 text-center shadow-sm hover:bg-muted/50 transition">
          {loading ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : <RefreshCw className="w-5 h-5 mx-auto text-primary" />}
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-1">Refresh</p>
        </button>
      </div>

      {/* Pencarian */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari username / no HP / email..." className="pl-9" />
      </div>

      {/* Daftar user */}
      <div className="space-y-1.5">
        {filtered.map((u) => {
          const online = isOnline(u);
          const ban = bans[u.visitor_id];
          const isPrem = premium.has(u.visitor_id);
          return (
            <div key={u.id} className="rounded-xl border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate flex items-center gap-1">
                    {u.username}
                    {isPrem && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{u.phone}{u.email ? ` · ${u.email}` : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold">Rp {u.balance.toLocaleString("id-ID")}</p>
                  <p className="text-[9px] text-muted-foreground">{online ? "🟢 Online" : `Aktif ${fmt(u.updated_at)}`}</p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {ban ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 font-black">
                    ⛔ {ban.permanent ? "BANNED PERMANEN" : `BANNED s/d ${fmt(ban.until)}`}
                  </span>
                ) : (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 font-black">✅ AKTIF</span>
                )}
                {isPrem && <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 font-black">👑 PREMIUM</span>}
                <span className="text-[9px] text-muted-foreground ml-auto">Gabung {fmt(u.created_at)}</span>
              </div>
              {ban && <p className="text-[9px] text-red-500/80 mt-1">Alasan: {ban.reason}</p>}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Tidak ada user ditemukan</p>}
      </div>
    </div>
  );
}

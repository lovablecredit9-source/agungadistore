import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Link2, Power, Bell, BellOff, RefreshCw, Trash2, Copy, Check, MessageSquare, Wallet, Coins, Gem, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getVisitorId } from "@/lib/visitor-id";

interface Props {
  visitorId?: string | null;
  onNeedLogin?: () => void;
}

interface Link {
  id: string;
  visitor_id: string;
  telegram_chat_id: string;
  telegram_username: string;
  telegram_first_name: string;
  enabled: boolean;
  notif_deposit: boolean;
  notif_purchase: boolean;
  notif_login: boolean;
  notif_admin_message: boolean;
  notif_balance_change: boolean;
  connected_at: string;
}

const NOTIF_FIELDS: { key: keyof Link; label: string; desc: string; icon: any }[] = [
  { key: "notif_deposit", label: "Deposit", desc: "Notif ketika deposit masuk / diproses.", icon: Wallet },
  { key: "notif_purchase", label: "Pembelian", desc: "Notif ketika ada order produk / gem / membership.", icon: Send },
  { key: "notif_login", label: "Login Perangkat", desc: "Peringatan saat akun login di perangkat baru.", icon: ShieldCheck },
  { key: "notif_admin_message", label: "Pesan Admin", desc: "Terima pesan / broadcast admin di Telegram.", icon: MessageSquare },
  { key: "notif_balance_change", label: "Perubahan Saldo", desc: "Notif saldo IN / koin / gem berubah.", icon: Coins },
];

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function TelegramAvatar({ visitorId, fallbackChar }: { visitorId: string; fallbackChar: string }) {
  const [failed, setFailed] = useState(false);
  const src = `${SUPABASE_URL}/functions/v1/telegram-avatar?vid=${encodeURIComponent(visitorId)}&t=${Date.now()}`;
  return (
    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold shrink-0">
      {failed ? (
        <span>{fallbackChar}</span>
      ) : (
        <img src={src} alt="tg" className="w-full h-full object-cover" onError={() => setFailed(true)} loading="lazy" />
      )}
    </div>
  );
}

const TEST_TYPES: { key: NotifKey; label: string; icon: any; grad: string; prefField: keyof Link }[] = [
  { key: "deposit", label: "Deposit", icon: Wallet, grad: "from-emerald-500 to-teal-600", prefField: "notif_deposit" },
  { key: "purchase", label: "Pembelian", icon: Send, grad: "from-sky-500 to-blue-600", prefField: "notif_purchase" },
  { key: "login", label: "Login", icon: ShieldCheck, grad: "from-amber-500 to-orange-600", prefField: "notif_login" },
  { key: "admin_message", label: "Admin", icon: MessageSquare, grad: "from-fuchsia-500 to-purple-600", prefField: "notif_admin_message" },
  { key: "balance_change", label: "Saldo", icon: Coins, grad: "from-rose-500 to-pink-600", prefField: "notif_balance_change" },
];
type NotifKey = "deposit" | "purchase" | "login" | "admin_message" | "balance_change";

function TestNotifPanel({ visitorId, enabled, link }: { visitorId: string; enabled: boolean; link: Link }) {
  const [busy, setBusy] = useState<NotifKey | null>(null);
  const [perType, setPerType] = useState<Record<string, number>>({});
  const [totalRemaining, setTotalRemaining] = useState<number>(10);
  const [cooldownMin, setCooldownMin] = useState<number | null>(null);
  const PER_TYPE = 2;
  const TOTAL = 10;

  const loadUsage = useCallback(async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("telegram_test_log" as any)
      .select("type, created_at")
      .eq("visitor_id", visitorId)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: true });
    const rows = (data as any[]) ?? [];
    const counts: Record<string, number> = {};
    rows.forEach((r) => { counts[r.type] = (counts[r.type] ?? 0) + 1; });
    setPerType(counts);
    setTotalRemaining(Math.max(0, TOTAL - rows.length));
    if (rows.length >= TOTAL && rows.length) {
      const first = new Date(rows[0].created_at).getTime();
      const wait = Math.max(1, Math.ceil((first + 3600_000 - Date.now()) / 60000));
      setCooldownMin(wait);
    } else setCooldownMin(null);
  }, [visitorId]);
  useEffect(() => { loadUsage(); }, [loadUsage]);

  const runTest = async (type: NotifKey) => {
    if (!enabled) { toast.error("Aktifkan Telegram dulu."); return; }
    if (!(link as any)[TEST_TYPES.find(t => t.key === type)!.prefField]) {
      toast.error("Nyalakan preferensi notif ini dulu."); return;
    }
    setBusy(type);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-test-notif", { body: { visitor_id: visitorId, type } });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Gagal test.");
      } else {
        const d: any = data;
        toast.success(`✅ Terkirim! Sisa tombol ini ${d?.per_type_remaining ?? 0}/${PER_TYPE} • Total ${d?.total_remaining ?? 0}/${TOTAL} jam ini.`);
      }
      await loadUsage();
    } finally { setBusy(null); }
  };

  return (
    <div className="relative rounded-3xl p-4 bg-gradient-to-br from-indigo-500/5 via-fuchsia-500/5 to-cyan-500/5 backdrop-blur-xl border border-fuchsia-500/20 space-y-3 shadow-xl overflow-hidden">
      <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/40">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-orbitron font-black text-sm uppercase tracking-wider bg-gradient-to-r from-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">Test Notif</div>
            <div className="text-[10px] text-muted-foreground font-space">2× per tombol • Maks {TOTAL}× total /jam</div>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-orbitron font-bold border ${totalRemaining === 0 ? "bg-red-500/10 text-red-600 border-red-500/30" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"}`}>
          {totalRemaining}/{TOTAL} <span className="opacity-70">TOTAL</span>
        </div>
      </div>

      <div className="relative grid grid-cols-5 gap-1.5">
        {TEST_TYPES.map((t) => {
          const prefOn = !!(link as any)[t.prefField];
          const typeUsed = perType[t.key] ?? 0;
          const typeRemaining = Math.max(0, PER_TYPE - typeUsed);
          const typeMaxed = typeRemaining === 0;
          const totalMaxed = totalRemaining === 0;
          const disabled = !enabled || !prefOn || busy !== null || typeMaxed || totalMaxed;
          return (
            <button
              key={t.key}
              onClick={() => runTest(t.key)}
              disabled={disabled}
              className={`group relative py-2.5 rounded-xl bg-gradient-to-br ${t.grad} text-white shadow-md flex flex-col items-center gap-1 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition`}
              title={!enabled ? "Telegram OFF" : !prefOn ? "Notif ini dimatikan" : typeMaxed ? "Limit tombol ini tercapai" : totalMaxed ? "Limit total tercapai" : `Test ${t.label}`}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/10 transition" />
              {busy === t.key ? (
                <RefreshCw className="w-4 h-4 animate-spin relative" />
              ) : (
                <t.icon className="w-4 h-4 relative drop-shadow" />
              )}
              <span className="relative font-orbitron text-[9px] font-bold tracking-wide">{t.label.toUpperCase()}</span>
              <span className={`relative text-[8px] font-orbitron font-bold px-1 rounded ${typeMaxed ? "bg-black/40" : "bg-white/25"}`}>{typeRemaining}/{PER_TYPE}</span>
            </button>
          );
        })}
      </div>

      <div className="relative flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Sparkles className="w-3 h-3 text-fuchsia-500" />
        <span>
          {cooldownMin
            ? <>Limit total tercapai — tersedia lagi ~<b className="text-foreground">{cooldownMin} menit</b></>
            : <>Setiap tombol maks <b className="text-foreground">2×/jam</b>, total <b className="text-foreground">{TOTAL}×/jam</b>.</>}
        </span>
      </div>
    </div>
  );
}





export default function TelegramConnectTab({ visitorId, onNeedLogin }: Props) {
  const vid = visitorId || null;
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<Link | null>(null);
  const [botUsername, setBotUsername] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [stats, setStats] = useState({ saldoIn: 0, coins: 0, gems: 0 });

  const load = useCallback(async () => {
    if (!vid) { setLoading(false); return; }
    setLoading(true);
    const [linkQ, botQ, balQ, profQ] = await Promise.all([
      supabase.from("telegram_user_links" as any).select("*").eq("visitor_id", vid).maybeSingle(),
      supabase.from("telegram_bot_config").select("bot_username").limit(1).maybeSingle(),
      supabase.from("game_balance" as any).select("amount").eq("visitor_id", vid).maybeSingle(),
      supabase.from("game_profiles" as any).select("coins, gems").eq("visitor_id", vid).maybeSingle(),
    ]);
    setLink((linkQ.data as any) || null);
    setBotUsername(((botQ.data as any)?.bot_username as string) || "");
    setStats({
      saldoIn: ((balQ.data as any)?.amount as number) || 0,
      coins: ((profQ.data as any)?.coins as number) || 0,
      gems: ((profQ.data as any)?.gems as number) || 0,
    });
    setLoading(false);
  }, [vid]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when link row changes
  useEffect(() => {
    if (!vid) return;
    const ch = supabase
      .channel(`tg_link_${vid}_${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_user_links", filter: `visitor_id=eq.${vid}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [vid, load]);

  const handleConnect = async () => {
    if (!vid) { onNeedLogin?.(); return; }
    const val = input.trim();
    if (!val) { toast.error("Masukkan ID atau username Telegram-mu."); return; }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-link-direct", {
        body: { visitor_id: vid, input: val },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Gagal menghubungkan.");
        return;
      }
      toast.success("Telegram berhasil terhubung!");
      setInput("");
      await load();
    } finally {
      setConnecting(false);
    }
  };


  const handleToggle = async (field: keyof Link, value: boolean) => {
    if (!link) return;
    setLink({ ...link, [field]: value } as Link);
    const { error } = await supabase.from("telegram_user_links" as any).update({ [field]: value }).eq("id", link.id);
    if (error) { toast.error("Gagal update: " + error.message); load(); }
  };

  const handleUnlink = async () => {
    if (!link) return;
    if (!confirm("Yakin hapus koneksi Telegram? Notifikasi tidak akan dikirim lagi.")) return;
    const { error } = await supabase.from("telegram_user_links" as any).delete().eq("id", link.id);
    if (error) { toast.error("Gagal hapus: " + error.message); return; }
    setLink(null);
    toast.success("Koneksi Telegram dihapus.");
  };

  if (!vid) {
    return (
      <div className="p-6 rounded-2xl bg-card/70 backdrop-blur border border-border/40 text-center">
        <Send className="w-10 h-10 mx-auto mb-3 text-primary" />
        <h3 className="text-lg font-bold mb-1">Konek Telegram</h3>
        <p className="text-sm text-muted-foreground mb-4">Login akun saldo dulu untuk menghubungkan Telegram-mu.</p>
        <button onClick={onNeedLogin} className="px-5 py-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold">Ke Login Saldo</button>
      </div>
    );
  }

  

  return (
    <div className="space-y-4 pb-8 relative">
      {/* Ambient glow background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-sky-500/20 blur-3xl animate-pulse" />
        <div className="absolute top-40 -right-20 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl animate-pulse [animation-delay:800ms]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      {/* HERO — Cyber Neon */}
      <div className="relative rounded-[28px] overflow-hidden shadow-2xl shadow-indigo-500/40">
        {/* base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1e3d] via-[#1e1b4b] to-[#0e7490]" />
        {/* animated grid */}
        <div className="absolute inset-0 tg-grid-bg opacity-60" />
        {/* neon orbs */}
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-cyan-400/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 w-64 h-64 rounded-full bg-fuchsia-500/30 blur-3xl" />
        {/* scanline */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300 to-transparent" />

        <div className="relative p-5 text-white">
          <div className="flex items-center gap-3">
            {/* Rotating conic border icon */}
            <div className="relative w-16 h-16 rounded-2xl tg-conic-border">
              <div className="absolute inset-[2px] rounded-[14px] bg-[#0b1e3d] flex items-center justify-center z-10">
                <Send className="w-7 h-7 -rotate-12 text-cyan-300 drop-shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-orbitron text-[22px] font-black uppercase bg-gradient-to-r from-cyan-200 via-white to-fuchsia-200 bg-clip-text text-transparent drop-shadow">
                  Konek Telegram
                </h2>
                <span className={`font-orbitron px-2 py-0.5 rounded-md text-[9px] font-bold border tracking-widest ${link?.enabled ? "bg-emerald-400/20 border-emerald-300/70 text-emerald-100 shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-white/10 border-white/30 text-white/80"}`}>
                  {link ? (link.enabled ? "◉ LIVE" : "○ OFF") : "IDLE"}
                </span>
              </div>
              <p className="font-space text-[11px] text-cyan-100/90 mt-1 tracking-wide">
                &gt; realtime_sync • neural_notify • secure_link
              </p>
            </div>
          </div>
          {botUsername && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur border border-cyan-300/40 text-[11px] font-space">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,1)] animate-pulse" />
              <span className="text-cyan-100/80">bot online</span>
              <span className="font-orbitron font-bold text-white">@{botUsername}</span>
            </div>
          )}
        </div>
      </div>

      {/* STATS — Holo cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "SALDO", value: `Rp${stats.saldoIn.toLocaleString("id-ID")}`, icon: Wallet, grad: "from-emerald-400 to-teal-600", ring: "ring-emerald-300/50" },
          { label: "KOIN", value: stats.coins.toLocaleString("id-ID"), icon: Coins, grad: "from-amber-400 to-orange-600", ring: "ring-amber-300/50" },
          { label: "GEM", value: stats.gems.toLocaleString("id-ID"), icon: Gem, grad: "from-fuchsia-400 to-purple-600", ring: "ring-fuchsia-300/50" },
        ].map((s) => (
          <div key={s.label} className={`relative rounded-2xl p-3 bg-gradient-to-br ${s.grad} text-white shadow-lg overflow-hidden ring-1 ${s.ring}`}>
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,white_1px,transparent_1px)] [background-size:14px_14px]" />
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/25 blur-xl" />
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-white/25 backdrop-blur flex items-center justify-center mb-1.5 border border-white/30">
                <s.icon className="w-4 h-4" />
              </div>
              <div className="font-orbitron text-[9px] tracking-[0.2em] opacity-90 font-bold">{s.label}</div>
              <div className="font-orbitron text-[13px] font-black truncate mt-0.5 drop-shadow">{s.value}</div>
            </div>
          </div>
        ))}
      </div>


      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground rounded-2xl bg-card/60 border border-border/40 backdrop-blur">
          <div className="w-8 h-8 mx-auto mb-2 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
          Memuat…
        </div>
      ) : link ? (
        <>
          {/* Linked card */}
          <div className="relative rounded-3xl p-4 bg-card/80 backdrop-blur-xl border border-border/40 space-y-4 shadow-xl">
            {link.enabled && (
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
            )}
            <div className="flex items-center gap-3">
              <div className="relative">
                {link.enabled && <div className="absolute inset-0 rounded-full bg-emerald-400/50 blur-md animate-pulse" />}
                <div className="relative">
                  <TelegramAvatar
                    visitorId={link.visitor_id}
                    fallbackChar={(link.telegram_first_name || link.telegram_username || "T").charAt(0).toUpperCase()}
                  />
                  <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card ${link.enabled ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate flex items-center gap-1.5">
                  {link.telegram_first_name || "Telegram User"}
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {link.telegram_username ? `@${link.telegram_username}` : `ID: ${link.telegram_chat_id}`}
                </div>
                <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                  Terhubung {new Date(link.connected_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleToggle("enabled", !link.enabled)}
              className={`group relative w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 overflow-hidden transition-all ${link.enabled ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30" : "bg-muted text-foreground hover:bg-muted/70"}`}
            >
              {link.enabled && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              )}
              <Power className="w-4 h-4 relative" />
              <span className="font-orbitron tracking-wider relative">{link.enabled ? "TELEGRAM AKTIF — TAP OFF" : "NONAKTIF — TAP ON"}</span>
            </button>

            {/* Toggle notifikasi */}
            <div className="pt-1 space-y-2">
              <div className="font-orbitron text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Preferensi Notifikasi
                <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent ml-1" />
              </div>
              {NOTIF_FIELDS.map((f) => {
                const active = !!(link as any)[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() => handleToggle(f.key, !active)}
                    disabled={!link.enabled}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${active && link.enabled ? "bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent border-sky-500/40 shadow-sm" : "bg-muted/30 border-border/30 hover:bg-muted/50"} ${!link.enabled ? "opacity-50" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${active ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/40" : "bg-muted text-muted-foreground"}`}>
                      <f.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-bold">{f.label}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{f.desc}</div>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition shrink-0 ${active ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-muted-foreground/30"}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${active ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleUnlink}
                className="flex-1 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/15 text-red-600 font-bold text-sm flex items-center justify-center gap-1.5 border border-red-500/20 transition"
              >
                <Trash2 className="w-4 h-4" /> Hapus Koneksi
              </button>
            </div>
          </div>

          {/* TEST NOTIFIKASI — max 2x/jam */}
          <TestNotifPanel visitorId={link.visitor_id} enabled={link.enabled} link={link} />
        </>

      ) : (
        <div className="relative rounded-3xl p-6 bg-card/80 backdrop-blur-xl border border-border/40 space-y-4 shadow-xl overflow-hidden">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="relative text-center space-y-2">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-2xl bg-sky-500/30 blur-xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-xl shadow-sky-500/40">
                <Link2 className="w-8 h-8 text-white" />
              </div>
            </div>
            <h3 className="font-orbitron font-black text-xl uppercase tracking-wider bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">Belum Terkoneksi</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">Hubungkan Telegram untuk terima notif deposit, pembelian, login perangkat, dan pesan admin langsung ke chat.</p>
          </div>

          <div className="relative space-y-3 text-left">
            <label className="font-orbitron text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> ID atau Username Telegram
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm font-mono">@</div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/^@/, ""))}
                placeholder="username atau 123456789"
                className="w-full pl-8 pr-4 py-3.5 rounded-2xl bg-muted/50 border-2 border-border/40 text-sm font-mono focus:outline-none focus:border-sky-500 focus:bg-background transition"
                disabled={connecting}
              />
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-sky-500/5 to-blue-500/5 border border-sky-500/20 p-3 space-y-1.5">
              {[
                { n: 1, t: <>Buka bot {botUsername ? <span className="font-bold text-foreground">@{botUsername}</span> : "Telegram"} lalu ketik <code className="px-1 rounded bg-muted font-mono text-[10px]">/start</code></> },
                { n: 2, t: <>Masukkan <b>@username</b> atau <b>ID numerik</b> Telegram di atas</> },
                { n: 3, t: <>Ketuk <b>Hubungkan</b> — bot langsung kirim konfirmasi</> },
              ].map((s) => (
                <div key={s.n} className="flex gap-2.5 items-start text-xs text-muted-foreground">
                  <div className="w-5 h-5 shrink-0 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{s.n}</div>
                  <div className="leading-relaxed pt-0.5">{s.t}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConnect}
                disabled={connecting || !input.trim()}
                className="group relative flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 overflow-hidden shadow-lg shadow-blue-500/40"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {connecting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin relative" /><span className="relative">Menghubungkan…</span></>
                ) : (
                  <><Link2 className="w-4 h-4 relative" /><span className="font-orbitron tracking-widest relative">HUBUNGKAN</span></>
                )}
              </button>
              {botUsername && (
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3.5 rounded-2xl bg-muted hover:bg-muted/70 text-foreground font-bold text-sm flex items-center justify-center gap-1.5 border border-border/40 transition"
                >
                  <Send className="w-4 h-4" /> Buka Bot
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground text-center px-4 justify-center">
        <BellOff className="w-3 h-3" />
        Notifikasi Telegram bisa diaktifkan/dimatikan kapan saja.
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Link2, Power, Bell, BellOff, RefreshCw, Trash2, Copy, Check, MessageSquare, Wallet, Coins, Gem, ShieldCheck } from "lucide-react";
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

      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/30">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-700" />
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,white_1px,transparent_1px),radial-gradient(circle_at_80%_60%,white_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-14 -left-10 w-52 h-52 rounded-full bg-cyan-300/30 blur-3xl" />

        <div className="relative p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-white/40 blur-md animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-lg">
                <Send className="w-7 h-7 -rotate-12 drop-shadow" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Konek Telegram</h2>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${link?.enabled ? "bg-emerald-400/30 border-emerald-200/60 text-white" : "bg-white/10 border-white/30 text-white/80"}`}>
                  {link ? (link.enabled ? "● LIVE" : "○ OFF") : "IDLE"}
                </span>
              </div>
              <p className="text-xs text-white/85 mt-0.5">Pantau akun & terima notifikasi realtime lewat bot</p>
            </div>
          </div>
          {botUsername && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur border border-white/25 text-[11px]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span className="opacity-90">Bot aktif:</span>
              <span className="font-bold">@{botUsername}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Saldo IN", value: `Rp ${stats.saldoIn.toLocaleString("id-ID")}`, icon: Wallet, grad: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/30" },
          { label: "Koin", value: stats.coins.toLocaleString("id-ID"), icon: Coins, grad: "from-amber-500 to-orange-500", glow: "shadow-amber-500/30" },
          { label: "Gem", value: stats.gems.toLocaleString("id-ID"), icon: Gem, grad: "from-fuchsia-500 to-purple-600", glow: "shadow-fuchsia-500/30" },
        ].map((s) => (
          <div key={s.label} className={`relative rounded-2xl p-3 bg-gradient-to-br ${s.grad} text-white shadow-lg ${s.glow} overflow-hidden`}>
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/20 blur-xl" />
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center mb-1.5">
                <s.icon className="w-4 h-4" />
              </div>
              <div className="text-[10px] uppercase tracking-wider opacity-90 font-semibold">{s.label}</div>
              <div className="text-sm font-black truncate">{s.value}</div>
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
              <span className="relative">{link.enabled ? "Telegram Aktif — Ketuk untuk Matikan" : "Nonaktif — Ketuk untuk Hidupkan"}</span>
            </button>

            {/* Toggle notifikasi */}
            <div className="pt-1 space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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
            <h3 className="font-black text-lg">Belum Terkoneksi</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">Hubungkan Telegram untuk terima notif deposit, pembelian, login perangkat, dan pesan admin langsung ke chat.</p>
          </div>

          <div className="relative space-y-3 text-left">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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
                  <><Link2 className="w-4 h-4 relative" /><span className="relative">Hubungkan</span></>
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

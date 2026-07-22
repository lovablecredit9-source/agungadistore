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
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Konek Telegram</h2>
            <p className="text-xs text-white/80">Terima notifikasi & pantau akun via bot</p>
          </div>
        </div>
        {botUsername && (
          <p className="text-xs text-white/90">Bot: <span className="font-semibold">@{botUsername}</span></p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Saldo IN", value: `Rp ${stats.saldoIn.toLocaleString("id-ID")}`, icon: Wallet, grad: "from-emerald-500 to-teal-500" },
          { label: "Koin", value: stats.coins.toLocaleString("id-ID"), icon: Coins, grad: "from-amber-500 to-orange-500" },
          { label: "Gem", value: stats.gems.toLocaleString("id-ID"), icon: Gem, grad: "from-fuchsia-500 to-purple-600" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-3 bg-gradient-to-br ${s.grad} text-white shadow`}>
            <s.icon className="w-4 h-4 mb-1 opacity-90" />
            <div className="text-[10px] uppercase tracking-wide opacity-90">{s.label}</div>
            <div className="text-sm font-bold truncate">{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Memuat...</div>
      ) : link ? (
        <>
          {/* Linked card */}
          <div className="rounded-2xl p-4 bg-card/80 backdrop-blur border border-border/40 space-y-3">
            <div className="flex items-center gap-3">
              <TelegramAvatar
                visitorId={link.visitor_id}
                fallbackChar={(link.telegram_first_name || link.telegram_username || "T").charAt(0).toUpperCase()}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{link.telegram_first_name || "Telegram User"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {link.telegram_username ? `@${link.telegram_username}` : `ID: ${link.telegram_chat_id}`}
                </div>
              </div>
              <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${link.enabled ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                {link.enabled ? "AKTIF" : "NONAKTIF"}
              </div>
            </div>

            <button
              onClick={() => handleToggle("enabled", !link.enabled)}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${link.enabled ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white" : "bg-muted text-foreground"}`}
            >
              <Power className="w-4 h-4" />
              {link.enabled ? "Telegram Aktif — Klik untuk Matikan" : "Telegram Nonaktif — Klik untuk Hidupkan"}
            </button>

            {/* Toggle notifikasi */}
            <div className="pt-2 border-t border-border/40 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Preferensi Notifikasi
              </div>
              {NOTIF_FIELDS.map((f) => {
                const active = !!(link as any)[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() => handleToggle(f.key, !active)}
                    disabled={!link.enabled}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition ${active && link.enabled ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border/30"} ${!link.enabled ? "opacity-50" : ""}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
                      <f.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-semibold">{f.label}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{f.desc}</div>
                    </div>
                    <div className={`w-10 h-6 rounded-full relative transition ${active ? "bg-emerald-500" : "bg-muted-foreground/30"}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${active ? "left-[calc(100%-1.375rem)]" : "left-0.5"}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleUnlink}
                className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-600 font-semibold text-sm flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Hapus Koneksi
              </button>
            </div>

          </div>
        </>
      ) : (
        <div className="rounded-2xl p-5 bg-card/80 backdrop-blur border border-border/40 text-center space-y-3">
          <Link2 className="w-10 h-10 mx-auto text-sky-500" />
          <h3 className="font-bold">Belum Terkoneksi</h3>
          <p className="text-sm text-muted-foreground">Hubungkan Telegram-mu untuk terima notif deposit, pembelian, login perangkat, dan pesan admin langsung ke chat.</p>

          <div className="space-y-3 text-left">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              ID atau Username Telegram
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Contoh: @username atau 123456789"
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border/40 text-sm font-mono focus:outline-none focus:border-sky-500"
              disabled={connecting}
            />
            <ol className="text-xs text-muted-foreground space-y-1 pl-4 list-decimal">
              <li>Buka bot {botUsername ? <span className="font-semibold text-foreground">@{botUsername}</span> : "Telegram"} lalu ketik <code className="px-1 rounded bg-muted font-mono">/start</code> dulu (wajib, agar bot bisa kirim pesan).</li>
              <li>Masukkan <b>username</b> (contoh <code className="px-1 rounded bg-muted">@budi</code>) atau <b>ID numerik</b> Telegram-mu di atas.</li>
              <li>Klik tombol Hubungkan — bot langsung kirim konfirmasi ke chat kamu.</li>
            </ol>
            <div className="flex gap-2">
              <button
                onClick={handleConnect}
                disabled={connecting || !input.trim()}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Link2 className="w-4 h-4" /> {connecting ? "Menghubungkan..." : "Hubungkan"}
              </button>
              {botUsername && (
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" /> Buka Bot
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center px-4">
        Kamu dapat mengaktifkan/mematikan notifikasi Telegram kapan saja. Wajib ketik /start di bot dulu supaya bot bisa mengirim pesan ke akunmu.
      </div>

    </div>
  );
}

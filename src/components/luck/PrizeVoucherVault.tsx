import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Ticket, RefreshCw, CheckCircle2, Clock } from "lucide-react";

interface PrizeVoucher {
  id: string;
  category: "anon" | "quest" | "confess" | "diskon" | string;
  code: string;
  label: string;
  value: number;
  unit: string;
  max_uses: number;
  expires_at: string | null;
  created_at: string;
  is_used: boolean;
}

const CATS: Record<string, { name: string; emoji: string; grad: string; hint: string }> = {
  anon: { name: "Anon Chat", emoji: "💬", grad: "from-cyan-500 to-blue-600", hint: "Aktifkan di tab Anon Chat → Premium → Masukkan kode." },
  quest: { name: "Premium Quest", emoji: "🏆", grad: "from-violet-500 to-purple-700", hint: "Aktifkan di tab Quest Mission. Durasi ditambahkan ke masa aktif yang sedang berjalan." },
  confess: { name: "Confess", emoji: "🤫", grad: "from-pink-500 to-rose-600", hint: "Pakai saat kirim Confess untuk potongan harga." },
  diskon: { name: "Diskon Spin", emoji: "🎯", grad: "from-emerald-500 to-teal-600", hint: "Aktifkan di tab Diskon untuk memotong biaya spin." },
};

function timeLeft(iso: string | null) {
  if (!iso) return "Tanpa batas";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Kadaluarsa";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d} hari ${h} jam lagi`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h} jam ${m} menit lagi`;
}

export default function PrizeVoucherVault({ visitorId }: { visitorId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState<PrizeVoucher[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    if (!visitorId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "my_vouchers" },
      });
      if (error) throw error;
      setVouchers(data?.vouchers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [visitorId]);

  const filtered = useMemo(
    () => (filter === "all" ? vouchers : vouchers.filter((v) => v.category === filter)),
    [vouchers, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: vouchers.length };
    for (const v of vouchers) c[v.category] = (c[v.category] || 0) + 1;
    return c;
  }, [vouchers]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Kode disalin", description: code });
    } catch {
      toast({ title: "Gagal menyalin", description: code, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-gradient-to-br from-amber-500/10 via-fuchsia-500/10 to-cyan-500/10 border-amber-400/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="text-sm font-black text-amber-200">VOUCHER HADIAH</h3>
              <p className="text-[10px] text-white/60">Semua kode voucher hasil spin Lucky Royale ada di sini.</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={load} className="h-8 px-2 text-white/70">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {["all", "anon", "quest", "confess", "diskon"].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-black border transition ${
              filter === k
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-black border-amber-300"
                : "bg-black/40 text-white/70 border-white/15"
            }`}
          >
            {k === "all" ? "🎁 SEMUA" : `${CATS[k].emoji} ${CATS[k].name.toUpperCase()}`} ({counts[k] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center bg-black/40 border-white/10">
          <div className="text-3xl mb-2">🎟️</div>
          <p className="text-xs text-white/70 font-bold">Belum ada voucher hadiah.</p>
          <p className="text-[10px] text-white/50 mt-1">Menangkan voucher Anon Chat, Premium Quest, atau Confess dari spin Lucky Royale.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => {
            const cat = CATS[v.category] || CATS.diskon;
            const expired = v.expires_at ? new Date(v.expires_at).getTime() <= Date.now() : false;
            const dead = expired || v.is_used;
            return (
              <Card key={v.id} className={`p-3 border ${dead ? "bg-black/50 border-white/10 opacity-60" : "bg-black/40 border-amber-400/25"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`text-[8px] px-1.5 py-0 border-0 bg-gradient-to-r ${cat.grad} text-white font-black`}>
                        {cat.emoji} {cat.name}
                      </Badge>
                      {v.is_used && <Badge className="text-[8px] px-1.5 py-0 bg-white/10 text-white/70 border-0">TERPAKAI</Badge>}
                      {expired && !v.is_used && <Badge className="text-[8px] px-1.5 py-0 bg-red-500/20 text-red-300 border-0">KADALUARSA</Badge>}
                    </div>
                    <div className="text-xs font-black text-white mt-1 truncate">{v.label}</div>
                    <div className="mt-1 font-mono text-sm font-black tracking-widest text-amber-300">{v.code}</div>
                    <div className="mt-1 flex items-center gap-2 text-[9px] text-white/55">
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {timeLeft(v.expires_at)}</span>
                      <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Batas pakai: {v.max_uses} orang</span>
                    </div>
                    <p className="text-[9px] text-white/45 mt-1">{cat.hint}</p>
                  </div>
                  <Button size="sm" onClick={() => copy(v.code)} disabled={dead}
                    className="h-8 px-2.5 bg-gradient-to-br from-amber-500 to-orange-600 text-black font-black shrink-0">
                    <Copy className="w-3.5 h-3.5 mr-1" /> Salin
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

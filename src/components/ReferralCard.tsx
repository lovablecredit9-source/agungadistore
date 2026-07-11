import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Gift, Copy, Share2, Users, Loader2, Ticket } from "lucide-react";

interface Props {
  /** visitor id akun saldo yang aktif */
  activeVisitorId?: string | null;
}

interface RefInfo {
  code: string;
  uses_count: number;
  total_reward: number;
  already_redeemed: boolean;
  reward: number;
}

const fmt = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export default function ReferralCard({ activeVisitorId }: Props) {
  const { toast } = useToast();
  const [info, setInfo] = useState<RefInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const load = async () => {
    if (!activeVisitorId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("store-referral", {
        body: { action: "get", visitorId: activeVisitorId },
      });
      if ((data as any)?.code) setInfo(data as RefInfo);
      else setInfo(null);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeVisitorId]);

  const copy = async () => {
    if (!info) return;
    try { await navigator.clipboard.writeText(info.code); toast({ title: "Kode disalin!", description: info.code }); } catch {}
  };

  const share = async () => {
    if (!info) return;
    const text = `Yuk belanja di Agung Adi Store! Pakai kode referral aku "${info.code}" biar kita berdua langsung dapat saldo ${fmt(info.reward)} 💰`;
    try {
      if (navigator.share) await navigator.share({ title: "Referral Agung Adi Store", text });
      else { await navigator.clipboard.writeText(text); toast({ title: "Teks ajakan disalin!" }); }
    } catch {}
  };

  const redeem = async () => {
    const code = redeemCode.trim().toUpperCase();
    if (!code) return;
    setRedeeming(true);
    try {
      const { data } = await supabase.functions.invoke("store-referral", {
        body: { action: "redeem", visitorId: activeVisitorId, code },
      });
      const res = data as any;
      if (res?.success) {
        toast({ title: "🎉 Berhasil!", description: `Saldo ${fmt(res.reward)} langsung masuk ke akunmu!` });
        setRedeemCode("");
        load();
      } else {
        toast({ title: "Gagal", description: res?.error || "Coba lagi", variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal", description: "Coba lagi", variant: "destructive" });
    } finally {
      setRedeeming(false);
    }
  };

  if (!activeVisitorId) return null;

  return (
    <Card className="p-4 space-y-3 border-2 border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-violet-500/5 to-transparent">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg">
          <Gift className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-black text-sm">Ajak Teman, Dapat Saldo</h3>
          <p className="text-[10px] text-muted-foreground">Kamu & teman sama-sama dapat saldo {info ? fmt(info.reward) : "Rp 2.000"} langsung masuk</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : info ? (
        <>
          <div className="rounded-xl bg-background/70 border border-fuchsia-500/20 p-3">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1">Kode referralmu</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono font-black text-lg tracking-widest text-fuchsia-600 dark:text-fuchsia-400">{info.code}</div>
              <Button size="sm" variant="outline" onClick={copy}><Copy className="w-4 h-4" /></Button>
              <Button size="sm" onClick={share}><Share2 className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-background/70 border p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-fuchsia-600 dark:text-fuchsia-400"><Users className="w-3.5 h-3.5" /><span className="text-lg font-black tabular-nums">{info.uses_count}</span></div>
              <p className="text-[9px] text-muted-foreground font-bold">Teman diajak</p>
            </div>
            <div className="rounded-xl bg-background/70 border p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400"><Ticket className="w-3.5 h-3.5" /><span className="text-sm font-black tabular-nums">{fmt(info.total_reward)}</span></div>
              <p className="text-[9px] text-muted-foreground font-bold">Total hadiah</p>
            </div>
          </div>

          {!info.already_redeemed && (
            <div className="rounded-xl bg-background/70 border border-violet-500/20 p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Punya kode teman? Tukar di sini</p>
              <div className="flex items-center gap-2">
                <Input
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="REF-XXXXXX"
                  className="font-mono uppercase"
                />
                <Button onClick={redeem} disabled={redeeming || !redeemCode.trim()}>
                  {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tukar"}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">Login akun saldo dulu untuk memakai program referral.</p>
      )}
    </Card>
  );
}

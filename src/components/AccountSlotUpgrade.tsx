import { useState } from "react";
import { useServerFn } from "@/lib/server-fn-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Crown, Loader2 } from "lucide-react";
import { buyAccountSlots, type SlotResult } from "@/lib/account-slots.functions";

const PLANS = [
  { id: "1m", label: "1 Bulan", price: 10000 },
  { id: "2m", label: "2 Bulan", price: 20000 },
  { id: "1y", label: "1 Tahun", price: 30000 },
  { id: "perm", label: "Permanen", price: 50000 },
] as const;

interface Props {
  visitorId: string;
  status: SlotResult | null;
  onUpdated: (s: SlotResult) => void;
}

export default function AccountSlotUpgrade({ visitorId, status, onUpdated }: Props) {
  const { toast } = useToast();
  const buy = useServerFn(buyAccountSlots);
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<(typeof PLANS)[number]["id"]>("1m");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const daysLeft = status?.expires_at ? Math.max(0, Math.ceil((new Date(status.expires_at).getTime() - Date.now()) / 86400000)) : null;
  const history = status?.history ?? [];
  const historyList = history.length > 0 && (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground">Riwayat paket</p>
      {history.map((h, i) => {
        const expired = h.expires_at && new Date(h.expires_at) <= new Date();
        return (
          <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1 text-[10px]">
            <span><strong>{h.label}</strong> · dibeli {fmt(h.created_at)}</span>
            <span className={expired ? "text-muted-foreground line-through" : "text-primary font-semibold"}>
              {h.expires_at ? `s/d ${fmt(h.expires_at)}` : "Permanen"}
            </span>
          </div>
        );
      })}
    </div>
  );

  if (status?.permanent) {
    return (
      <div className="rounded-xl border border-border bg-muted/50 p-2.5 space-y-2">
        <p className="text-[11px] flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-primary" /> Slot 10 akun aktif <strong>permanen</strong></p>
        {historyList}
      </div>
    );
  }

  const submit = async () => {
    if (!/^\d{6}$/.test(pin)) return toast({ title: "PIN harus 6 digit", variant: "destructive" });
    setLoading(true);
    try {
      const r = await buy({ data: { visitorId, plan, pin } });
      if (!r.ok) return toast({ title: "Gagal", description: r.error, variant: "destructive" });
      onUpdated(r);
      setOpen(false); setPin("");
      toast({ title: "✅ Slot akun jadi 10", description: r.permanent ? "Berlaku permanen" : `Aktif sampai ${new Date(r.expires_at!).toLocaleDateString("id-ID")}` });
    } catch {
      toast({ title: "Sistem sedang gangguan, coba lagi", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] leading-snug">
          <p className="font-semibold flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-primary" /> Upgrade 10 Slot Akun</p>
          <p className="text-muted-foreground">
            {status?.active && status.expires_at
              ? `Aktif sampai ${fmt(status.expires_at)} (${daysLeft} hari lagi). Perpanjang kapan saja, waktunya ditambahkan.`
              : "Gratis 5 akun. Bayar pakai saldo untuk 10 akun."}
          </p>
        </div>
        {!open && <Button size="sm" className="h-7 text-[11px]" onClick={() => setOpen(true)}>{status?.active ? "Perpanjang" : "Beli"}</Button>}
      </div>
      {open && (
        <div className="space-y-2">
          {status?.active && status.expires_at && (
            <p className="text-[10px] text-muted-foreground">
              Setelah perpanjang: aktif sampai <strong>{PLANS.find((p) => p.id === plan)!.id === "perm" ? "Permanen" : fmt(new Date(new Date(status.expires_at).getTime() + ({ "1m": 30, "2m": 60, "1y": 365, perm: 0 }[plan]) * 86400000).toISOString())}</strong>
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={`rounded-lg border px-2 py-1.5 text-left text-[11px] ${plan === p.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
              >
                <span className="block font-semibold">{p.label}</span>
                <span className="text-muted-foreground">Rp{p.price.toLocaleString("id-ID")}</span>
              </button>
            ))}
          </div>
          <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN 6 digit" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="h-8 text-xs" />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-8 flex-1 text-xs" onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Bayar dengan Saldo"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpen(false)}>Batal</Button>
          </div>
        </div>
      )}
      {historyList}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Gem, Wallet, Smartphone, Check, X, Loader2, Sparkles, ShieldCheck, PhoneCall, Users } from "lucide-react";

export interface AnonPremiumPlan { code: string; name: string; days: number; price: number; gems: number | null }
export interface AnonPremiumStatus {
  is_premium: boolean;
  plan_name: string | null;
  expires_at: string | null;
  plans: AnonPremiumPlan[];
  balance: number;
  gems: number;
  has_account: boolean;
}

const FALLBACK_PLANS: AnonPremiumPlan[] = [
  { code: "day", name: "1 Hari", days: 1, price: 5000, gems: 50 },
  { code: "week", name: "1 Minggu", days: 7, price: 20000, gems: 200 },
  { code: "month", name: "1 Bulan", days: 30, price: 30000, gems: 500 },
  { code: "year", name: "1 Tahun", days: 365, price: 50000, gems: null },
];

export function useAnonPremium(visitorId: string) {
  const [status, setStatus] = useState<AnonPremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!visitorId) return;
    const { data, error } = await supabase.functions.invoke("anon-premium", {
      body: { action: "status", visitorId },
    });
    if (!error && data) setStatus(data as AnonPremiumStatus);
    setLoading(false);
  }, [visitorId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { status, loading, refresh, isPremium: !!status?.is_premium };
}

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export function AnonPremiumDialog({
  open, onClose, visitorId, status, onSuccess, highlight = "gender",
}: {
  open: boolean;
  onClose: () => void;
  visitorId: string;
  status: AnonPremiumStatus | null;
  onSuccess: () => void;
  highlight?: "gender" | "call";
}) {
  const plans = status?.plans?.length ? status.plans : FALLBACK_PLANS;
  const [planCode, setPlanCode] = useState("week");
  const [method, setMethod] = useState<"saldo" | "gem" | "digital">("saldo");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setPin(""); setBusy(false); } }, [open]);

  if (!open) return null;
  const plan = plans.find((p) => p.code === planCode) || plans[0];
  const gemDisabled = plan.gems == null;

  const buy = async () => {
    if (busy) return;
    if (method === "gem" && gemDisabled) { toast.error("Paket ini tidak bisa dibayar dengan Gem"); return; }
    if (method === "saldo" && !/^\d{6}$/.test(pin)) { toast.error("Masukkan PIN 6 digit"); return; }
    setBusy(true);
    let data: any = null;
    let errMsg: string | null = null;
    try {
      const resp = await supabase.functions.invoke("anon-premium", {
        body: { action: "buy", visitorId, plan: plan.code, method, pin },
      });
      data = resp.data;
      if (resp.error) {
        errMsg = "Pembelian gagal";
        const ctx: any = (resp.error as any).context;
        try {
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          if (body?.error) errMsg = String(body.error);
        } catch { /* body bukan JSON */ }
      }
    } catch (e: any) {
      errMsg = e?.message || "Pembelian gagal";
    }
    setBusy(false);
    const res: any = data || {};
    if (errMsg || res.error) { toast.error(res.error || errMsg); return; }
    if (res.manual && res.wa_link) {
      window.open(res.wa_link, "_blank");
      toast.info("Lanjutkan pembayaran digital lewat admin di WhatsApp");
      return;
    }
    toast.success(`Premium ${plan.name} aktif! 🎉`);
    onSuccess();
    onClose();
  };


  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-amber-400/30 bg-[#0b0616] shadow-[0_-20px_60px_-10px_rgba(245,158,11,0.35)] animate-scale-in">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-3xl sm:rounded-3xl">
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-amber-500/20 blur-[70px] animate-pulse" />
          <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-fuchsia-600/20 blur-[70px] animate-pulse [animation-delay:1s]" />
        </div>

        <div className="relative p-5">
          <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 text-slate-300 flex items-center justify-center hover:bg-white/10" aria-label="Tutup">
            <X className="w-4 h-4" />
          </button>

          <div className="text-center pt-1 pb-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Crown className="w-7 h-7 text-slate-900" />
            </div>
            <h2 className="mt-3 text-xl font-black text-white">Anon Premium</h2>
            <p className="text-[12px] text-slate-400 mt-1">
              {highlight === "call" ? "Voice call hanya untuk member Premium." : "Filter gender partner hanya untuk member Premium."}
            </p>
            {status?.is_premium && status.expires_at && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-bold text-emerald-200">
                <ShieldCheck className="w-3 h-3" /> Aktif s/d {new Date(status.expires_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { Icon: Users, t: "Filter Gender", d: "Cari partner pria / wanita" },
              { Icon: PhoneCall, t: "Voice Call", d: "Telepon suara tanpa batas" },
              { Icon: Sparkles, t: "Prioritas Match", d: "Antrian lebih cepat" },
              { Icon: ShieldCheck, t: "Badge Premium", d: "Tampil eksklusif" },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                <Icon className="w-4 h-4 text-amber-300 mb-1" />
                <div className="text-[11.5px] font-bold text-white leading-tight">{t}</div>
                <div className="text-[9.5px] text-slate-400 leading-snug">{d}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-4">
            {plans.map((p) => {
              const sel = p.code === plan.code;
              return (
                <button key={p.code} onClick={() => { setPlanCode(p.code); if (p.gems == null && method === "gem") setMethod("saldo"); }}
                  className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${sel ? "border-amber-400/60 bg-amber-500/10 shadow-[0_0_25px_-8px_rgba(245,158,11,0.6)]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <div>
                    <div className="text-sm font-extrabold text-white flex items-center gap-2">
                      {p.name}
                      {p.code === "month" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200 font-bold">POPULER</span>}
                      {p.code === "year" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold">HEMAT</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {rupiah(p.price)}{p.gems != null ? ` • ${p.gems} Gem` : " • saldo / digital"}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${sel ? "bg-amber-400 border-amber-400" : "border-white/20"}`}>
                    {sel && <Check className="w-3 h-3 text-slate-900" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {([
              { id: "saldo", Icon: Wallet, label: "Saldo", sub: status ? rupiah(status.balance) : "" },
              { id: "gem", Icon: Gem, label: "Gem", sub: status ? `${status.gems} Gem` : "" },
            ] as const).map(({ id, Icon, label, sub }) => {
              const disabled = id === "gem" && gemDisabled;
              const sel = method === id;
              return (
                <button key={id} disabled={disabled} onClick={() => setMethod(id)}
                  className={`rounded-2xl border px-2 py-2.5 text-center transition disabled:opacity-40 ${sel ? "border-fuchsia-400/60 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${sel ? "text-fuchsia-300" : "text-slate-400"}`} />
                  <div className="text-[11px] font-bold text-white">{label}</div>
                  <div className="text-[9px] text-slate-400 truncate">{sub}</div>
                </button>
              );
            })}
          </div>

          {method === "saldo" && (
            <input
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" placeholder="PIN 6 digit"
              className="w-full mb-3 bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2.5 text-center tracking-[0.5em] text-sm text-slate-100 outline-none focus:border-fuchsia-400/60"
            />
          )}

          {confirming ? (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 mb-2">
              <div className="text-[12px] font-bold text-amber-100 text-center">
                {isRenew ? "Perpanjang" : "Beli"} Premium {plan.name}?
              </div>
              <div className="text-[11px] text-slate-300 text-center mt-1">
                Bayar {method === "gem" ? `${plan.gems} 💎 Gem` : rupiah(plan.price)}
                {isRenew ? " · masa aktif ditambah dari sisa waktu kamu" : ""}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={() => setConfirming(false)} disabled={busy}
                  className="py-2.5 rounded-xl border border-white/15 bg-white/5 text-[12px] font-bold text-white">Batal</button>
                <button onClick={buy} disabled={busy}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-[12px] font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-60">
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Ya, {isRenew ? "Perpanjang" : "Beli"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={askConfirm} disabled={busy}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-slate-900 font-extrabold text-sm shadow-[0_18px_45px_-12px_rgba(245,158,11,0.7)] active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              {isRenew ? "Perpanjang" : "Aktifkan"} {plan.name} — {method === "gem" ? `${plan.gems} Gem` : rupiah(plan.price)}
            </button>
          )}
          <p className="text-[10px] text-slate-500 text-center mt-2">Pembayaran hanya Saldo atau Gem. Premium aktif otomatis setelah berhasil.</p>

        </div>
      </div>
    </div>
  );
}

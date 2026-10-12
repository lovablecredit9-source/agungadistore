import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Zap, Gem, Loader2, Lock, Crown, Check, AlertTriangle, History, ShieldCheck, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { applyServerBoosters } from "./gameStore";

interface Props {
  visitorId: string | null;
  onActivated?: () => void;
  trigger?: React.ReactNode;
}

type Tier = { multiplier: number; min_level: number; requires_membership: boolean };
type Duration = { key: string; label: string; minutes: number };
type Booster = { id: string; multiplier: number; duration_key: string; duration_minutes: number; gem_cost: number; starts_at: string; expires_at: string; created_at?: string };
type Status = {
  tiers: Tier[]; durations: Duration[]; prices: Record<string, number>; serverNow: string;
  gems: number; level: number; membership: { plan_name: string; expires_at: string } | null;
  active: Booster[]; history: Booster[];
};

const SHORT: Record<string, string> = { "10m": "10m", "30m": "30m", "1h": "1j", "2h": "2j", "3h": "3j", "1d": "1h", "2d": "2h", "10d": "10h", "30d": "30h", "2mo": "2bln", "6mo": "6bln", "1y": "1thn" };
const tierTone = (m: number) => m >= 10 ? "from-amber-300 via-yellow-400 to-amber-600" : m >= 8 ? "from-amber-400 to-yellow-600" : m >= 6 ? "from-pink-500 to-orange-500" : m >= 4 ? "from-violet-500 to-fuchsia-500" : "from-sky-500 to-cyan-400";
const wib = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB";
const left = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000)); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}h ${h}j` : h ? `${h}j ${mm}m` : `${mm}m`;
};
const newRef = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

async function callFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("point-booster", { body });
  if (error) {
    // Ambil pesan backend yang bermakna, bukan "non-2xx".
    let msg = "Gagal menghubungi server.";
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* abaikan */ }
    throw new Error(msg);
  }
  if (!data?.ok) throw new Error(data?.error || "Gagal");
  return data as Status;
}

/** Booster Center: semua harga, kunci, Gem, dan masa aktif berasal dari fungsi server point-booster. */
export default function BuyBoosterDialog({ visitorId, onActivated, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<number>(2);
  const [dur, setDur] = useState("1h");
  const [confirm, setConfirm] = useState(false);
  const [buying, setBuying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const skew = useRef(0);
  const refRef = useRef<string>(newRef());
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!visitorId) return;
    setErr(null);
    try {
      const s = await callFn({ action: "status", visitorId });
      skew.current = new Date(s.serverNow).getTime() - Date.now();
      setSt(s); applyServerBoosters(s.active, s.serverNow);
    } catch (e) { setErr((e as Error).message); }
  }, [visitorId]);

  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => { if (!open) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [open]);

  const serverNow = now + skew.current;
  const active = useMemo(() => (st?.active || []).filter((b) => new Date(b.expires_at).getTime() > serverNow), [st, serverNow]);
  const total = active.reduce((s, b) => s + b.multiplier, 0);
  const tier = st?.tiers.find((t) => t.multiplier === sel);
  const price = st?.prices[`${sel}:${dur}`];
  const durObj = st?.durations.find((d) => d.key === dur);
  const levelOk = (t: Tier) => (st?.level ?? 1) >= t.min_level;
  const memberOk = (t: Tier) => !t.requires_membership || !!st?.membership;
  const owned = active.find((b) => b.multiplier === sel);
  const locked = tier ? !levelOk(tier) || !memberOk(tier) : true;
  const short = price != null && st ? Math.max(0, price - st.gems) : 0;

  const buy = async () => {
    if (!visitorId || buying) return;
    setBuying(true);
    try {
      const s = await callFn({ action: "buy", visitorId, multiplier: sel, durationKey: dur, purchaseRef: refRef.current });
      skew.current = new Date(s.serverNow).getTime() - Date.now();
      setSt(s); applyServerBoosters(s.active, s.serverNow);
      const t = s.active.reduce((a, b) => a + b.multiplier, 0);
      toast({ title: `Booster x${sel} aktif`, description: `+${sel} pengali · ${durObj?.label} · total sekarang x${t}` });
      refRef.current = newRef(); setConfirm(false); onActivated?.();
    } catch (e) {
      toast({ title: "Pembelian gagal", description: (e as Error).message, variant: "destructive" });
      void load();
    } finally { setBuying(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirm(false); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1 h-7 text-[10px] font-bold">
            <Zap className="w-3 h-3 text-yellow-500" /> Booster Poin
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only"><DialogTitle>Booster Poin</DialogTitle></DialogHeader>
        {!visitorId ? <p className="p-6 text-sm">Login akun Saldo dulu untuk memakai Booster Poin.</p>
          : err ? <div className="p-6 space-y-3"><p className="text-sm text-destructive">{err}</p><Button size="sm" onClick={load}>Coba lagi</Button></div>
          : !st ? <div className="grid h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          : (
          <div className="space-y-4 pb-4">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-5 text-white">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/30 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300"><Zap className="h-3.5 w-3.5" /> Booster Poin</p>
                  <p className="mt-2 text-5xl font-black tabular-nums">{total > 0 ? `x${total}` : "x1"}</p>
                  <p className="text-xs text-white/70">{total > 0 ? "Pengali aktif (dijumlah)" : "Belum ada booster aktif"}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur">
                  <p className="text-[10px] uppercase text-white/60">Gem kamu</p>
                  <p className="flex items-center justify-end gap-1 text-lg font-extrabold tabular-nums"><Gem className="h-4 w-4 text-fuchsia-300" />{st.gems.toLocaleString("id-ID")}</p>
                  <p className="text-[10px] text-white/60">Level {st.level}{st.membership ? ` · ${st.membership.plan_name}` : ""}</p>
                </div>
              </div>
              {active.length > 1 && (
                <p className="relative mt-3 text-sm font-bold tabular-nums text-white/90">{active.map((b) => `x${b.multiplier}`).join(" + ")} = x{total}</p>
              )}
            </section>

            <div className="space-y-4 px-4">
              {/* Aktif + timeline */}
              {active.length > 0 && (
                <section aria-label="Booster aktif" className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Booster aktif</h3>
                  {(() => {
                    const maxMs = Math.max(...active.map((b) => new Date(b.expires_at).getTime() - serverNow));
                    return [...active].sort((a, b) => +new Date(a.expires_at) - +new Date(b.expires_at)).map((b) => {
                      const ms = new Date(b.expires_at).getTime() - serverNow;
                      return (
                        <div key={b.id} className="rounded-xl border border-border bg-card/70 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`rounded-lg bg-gradient-to-r ${tierTone(b.multiplier)} px-2 py-0.5 text-sm font-black text-white`}>x{b.multiplier}</span>
                            {ms < 3600000 ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive"><AlertTriangle className="h-3 w-3" />Segera habis · {left(ms)}</span>
                              : <span className="text-[11px] font-bold text-primary">Aktif · sisa {left(ms)}</span>}
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full bg-gradient-to-r ${tierTone(b.multiplier)}`} style={{ width: `${Math.max(3, (ms / maxMs) * 100)}%` }} /></div>
                          <p className="mt-1.5 text-[10px] text-muted-foreground">Berakhir {wib(b.expires_at)}</p>
                        </div>
                      );
                    });
                  })()}
                </section>
              )}

              {/* Pilih pengali */}
              <section aria-label="Pilih booster" className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pilih pengali</h3>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {st.tiers.map((t) => {
                    const lk = !levelOk(t) || !memberOk(t);
                    const on = active.some((b) => b.multiplier === t.multiplier);
                    return (
                      <button key={t.multiplier} onClick={() => setSel(t.multiplier)} aria-pressed={sel === t.multiplier}
                        className={`relative rounded-xl border p-2 text-center transition ${sel === t.multiplier ? "border-primary ring-2 ring-primary/40" : "border-border"} ${lk ? "bg-muted/40" : "bg-card"}`}>
                        <span className={`block text-lg font-black ${lk ? "text-muted-foreground" : `bg-gradient-to-r ${tierTone(t.multiplier)} bg-clip-text text-transparent`}`}>x{t.multiplier}</span>
                        <span className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground">
                          {on ? <><Check className="h-2.5 w-2.5 text-primary" />Aktif</> : lk ? <><Lock className="h-2.5 w-2.5" />{t.requires_membership && !memberOk(t) ? "Member" : `Lv ${t.min_level}`}</> : `Lv ${t.min_level}`}
                        </span>
                        {t.requires_membership && <Crown className="absolute right-1 top-1 h-3 w-3 text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Durasi */}
              <section aria-label="Durasi" className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Durasi</h3>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {st.durations.map((d) => (
                    <button key={d.key} onClick={() => setDur(d.key)} aria-pressed={dur === d.key} title={d.label}
                      className={`h-10 rounded-lg text-xs font-bold transition ${dur === d.key ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground hover:bg-muted"}`}>
                      {SHORT[d.key] || d.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Kartu pembelian */}
              {tier && (
                <section className="rounded-2xl border border-border bg-card/80 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold">Booster x{sel} · {durObj?.label}</p>
                      <p className="text-[11px] text-muted-foreground">+{sel} pengali · bisa ditumpuk dengan booster lain</p>
                    </div>
                    <p className="flex items-center gap-1 text-xl font-black tabular-nums"><Gem className="h-4 w-4 text-fuchsia-500" />{price?.toLocaleString("id-ID") ?? "-"}</p>
                  </div>

                  {locked ? (
                    <div className="mt-3 space-y-2 rounded-xl bg-muted/50 p-3 text-xs">
                      <p className="flex items-center gap-1.5 font-bold"><Lock className="h-3.5 w-3.5" /> Terkunci</p>
                      <p className="flex items-center gap-1.5">{levelOk(tier) ? <Check className="h-3.5 w-3.5 text-primary" /> : <Lock className="h-3.5 w-3.5" />} Game Level {tier.min_level} (kamu Level {st.level})</p>
                      {!levelOk(tier) && <div className="h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (st.level / tier.min_level) * 100)}%` }} /></div>}
                      {tier.requires_membership && <p className="flex items-center gap-1.5">{memberOk(tier) ? <Check className="h-3.5 w-3.5 text-primary" /> : <Crown className="h-3.5 w-3.5 text-amber-500" />} Membership aktif{st.membership ? ` (${st.membership.plan_name})` : ""}</p>}
                      {!memberOk(tier) && <Button size="sm" variant="outline" className="w-full" onClick={() => { setOpen(false); window.location.assign("/streak"); }}>Lihat Membership</Button>}
                    </div>
                  ) : owned ? (
                    <Button disabled className="mt-3 w-full">x{sel} sudah aktif · sisa {left(new Date(owned.expires_at).getTime() - serverNow)}</Button>
                  ) : short > 0 ? (
                    <div className="mt-3 space-y-1 rounded-xl bg-destructive/10 p-3 text-xs">
                      <p className="font-bold text-destructive">Gem tidak cukup</p>
                      <p>Dibutuhkan {price?.toLocaleString("id-ID")} · Saldo {st.gems.toLocaleString("id-ID")} · Kurang {short.toLocaleString("id-ID")}</p>
                    </div>
                  ) : confirm ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-xs">
                      <p className="font-bold">Konfirmasi booster</p>
                      <p>Pengali: x{total || 0} + x{sel} = <strong>x{total + sel}</strong></p>
                      <p>Perkiraan berakhir: {wib(new Date(serverNow + (durObj?.minutes || 0) * 60000).toISOString())}</p>
                      <p>Gem setelah beli: {(st.gems - (price || 0)).toLocaleString("id-ID")}</p>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirm(false)} disabled={buying}><X className="mr-1 h-3.5 w-3.5" />Batal</Button>
                        <Button size="sm" className="flex-1" onClick={buy} disabled={buying}>{buying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Beli Booster"}</Button>
                      </div>
                    </div>
                  ) : (
                    <Button className="mt-3 w-full" onClick={() => setConfirm(true)}>Beli Booster</Button>
                  )}
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Harga, syarat, dan masa aktif diperiksa ulang oleh server.</p>
                </section>
              )}

              {/* Riwayat */}
              <section aria-label="Riwayat booster" className="space-y-2">
                <h3 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"><History className="h-3.5 w-3.5" /> Riwayat booster</h3>
                {st.history.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Belum ada pembelian booster.</p> : (
                  <ul className="divide-y divide-border rounded-xl border border-border text-xs">
                    {st.history.map((h) => {
                      const live = new Date(h.expires_at).getTime() > serverNow;
                      return (
                        <li key={h.id} className="flex items-center justify-between gap-2 p-2.5">
                          <span className="min-w-0"><strong>x{h.multiplier}</strong> · {st.durations.find((d) => d.key === h.duration_key)?.label ?? h.duration_key}<span className="block truncate text-[10px] text-muted-foreground">{wib(h.created_at || h.starts_at)} → {wib(h.expires_at)}</span></span>
                          <span className="shrink-0 text-right"><span className="block font-bold">-{h.gem_cost.toLocaleString("id-ID")} Gem</span><span className={`text-[10px] ${live ? "text-primary" : "text-muted-foreground"}`}>{live ? "Aktif" : "Berakhir"}</span></span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

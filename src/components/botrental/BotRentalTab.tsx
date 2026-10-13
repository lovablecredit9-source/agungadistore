import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Copy, Loader2, Plus, Server, Upload, Play, Square, RotateCcw, Trash2, FileText, Pencil, AlertTriangle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { botApi, rupiah, fmtDate, timeLeft, STATUS_LABEL, newRequestId, type Plan, type BotRow, type Rental, type BotTx } from "./api";
import AiAdapterCard from "./AiAdapterCard";

const ICONS: Record<string, string> = { "1h": "⚡", "1d": "🔥", "7d": "🚀", "1m": "💎", "2m": "👑", "6m": "💎", "1y": "🏆" };

type Checkout = { kind: "plan"; plan: Plan } | { kind: "slot"; slots: number };

interface Props { visitorId: string | null; onNeedLogin: () => void; onTopUp: () => void }

export default function BotRentalTab({ visitorId, onNeedLogin, onTopUp }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [slotPrice, setSlotPrice] = useState(0);
  const [rental, setRental] = useState<Rental | null>(null);
  const [active, setActive] = useState(false);
  const [bots, setBots] = useState<BotRow[]>([]);
  const [txs, setTxs] = useState<BotTx[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [noRentalOpen, setNoRentalOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const plansRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const cat = await botApi<{ plans: Plan[]; slot_price: number }>({ action: "catalog" });
    if (!cat.error) { setPlans(cat.plans); setSlotPrice(cat.slot_price); }
    if (visitorId) {
      const st = await botApi<any>({ action: "status", visitorId });
      if (!st.error) { setRental(st.rental); setActive(st.active); setBots(st.bots); setTxs(st.transactions); setBalance(st.balance); }
    }
    setLoading(false);
  }, [visitorId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const copy = (t: string) => { navigator.clipboard?.writeText(t); toast({ title: "ID disalin" }); };
  const addBot = () => {
    if (!visitorId) return onNeedLogin();
    if (!rental || !active) return setNoRentalOpen(true);
    if (bots.length >= rental.slots) return setCheckout({ kind: "slot", slots: 1 });
    setCreateOpen(true);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5 pb-6 max-w-3xl mx-auto">
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-accent/20 p-5 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.6)]">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/30 blur-3xl animate-pulse" aria-hidden />
        <p className="text-[11px] font-bold tracking-[0.2em] text-primary">SEWA SERVER BOT TELEGRAM</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-extrabold leading-tight">Jalankan Bot Telegram Kamu 24/7</h1>
        <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">Upload bot kamu, pilih masa sewa, dan kelola semuanya langsung dari Agung Adi Store.</p>
        {rental && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Status" value={active ? "🟢 AKTIF" : "🔴 HABIS"} />
            <Stat label="Sisa" value={active ? timeLeft(rental.expires_at, now) : "-"} />
            <Stat label="Slot" value={`${bots.length}/${rental.slots}`} />
          </div>
        )}
      </section>

      {/* Bot Saya */}
      {visitorId && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Bot Saya</h2>
            <Button size="sm" onClick={addBot} className="h-8 text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> TAMBAH BOT</Button>
          </div>
          {rental && !active && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs flex items-center justify-between gap-2">
              <span>🔴 MASA SEWA HABIS — bot dibekukan. File & konfigurasi tetap tersimpan.</span>
              <Button size="sm" className="h-7 text-[11px] shrink-0" onClick={() => plansRef.current?.scrollIntoView({ behavior: "smooth" })}>PERPANJANG SEWA</Button>
            </div>
          )}
          {bots.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
              {rental ? "Belum ada bot. Tekan Tambah Bot untuk mulai." : "Belum punya paket sewa. Pilih paket di bawah untuk mendapat 1 slot bot gratis."}
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {bots.map((b) => {
                const st = STATUS_LABEL[b.status] ?? { label: b.status, tone: "" };
                return (
                  <div key={b.id} className="rounded-2xl border border-border bg-card/70 backdrop-blur p-3.5 space-y-2 min-w-0">
                    <p className="font-bold truncate">🤖 {b.name}</p>
                    <p className={`text-xs font-bold ${st.tone}`}>● {st.label}</p>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      {b.telegram_username && <p className="truncate">@{b.telegram_username}</p>}
                      {rental && <p>Paket: {rental.bot_rental_plans?.duration_label ?? "-"}</p>}
                      {rental && <p>Sewa: {fmtDate(rental.started_at)} – {fmtDate(rental.expires_at)}</p>}
                      {rental && <p className="tabular-nums">Sisa: {active ? timeLeft(rental.expires_at, now) : "Habis"}</p>}
                      {rental?.last_transaction_id && (
                        <button className="flex items-center gap-1 font-mono hover:text-foreground" onClick={() => copy(rental.last_transaction_id!)}>
                          ID: {rental.last_transaction_id} <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]" onClick={() => setDetailId(b.id)}>Kelola</Button>
                      <Button size="sm" className="h-7 flex-1 text-[11px]" onClick={() => plansRef.current?.scrollIntoView({ behavior: "smooth" })}>{active ? "Perpanjang" : "PERPANJANG SEWA"}</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Paket */}
      <section ref={plansRef} className="space-y-2.5 scroll-mt-20">
        <h2 className="font-bold flex items-center gap-2"><Server className="w-4 h-4 text-primary" /> {rental ? "Perpanjang Sewa" : "Pilih Paket Sewa"}</h2>
        {rental && active && <p className="text-[11px] text-muted-foreground">Masa sewa baru ditambahkan dari tanggal berakhir saat ini ({fmtDate(rental.expires_at)}).</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {plans.map((p) => (
            <button key={p.code} onClick={() => (visitorId ? setCheckout({ kind: "plan", plan: p }) : onNeedLogin())}
              className="relative rounded-2xl border border-border bg-card/70 p-3 text-left transition hover:border-primary hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.7)] active:scale-[0.98]">
              {p.popular && <span className="absolute top-1.5 right-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">POPULER</span>}
              <p className="text-lg">{ICONS[p.code] ?? "🤖"}</p>
              <p className="text-xs font-bold">{p.duration_label.toUpperCase()}</p>
              <p className="text-sm font-extrabold text-primary">{rupiah(p.price)}</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Paket pertama memberi 1 slot bot gratis. Tambah bot: {rupiah(slotPrice)} / slot.</p>
      </section>

      {/* Riwayat */}
      {visitorId && txs.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold text-sm">Riwayat Sewa Bot</h2>
          {txs.map((t) => (
            <div key={t.transaction_id} className="rounded-xl border border-border bg-card/60 p-2.5 text-[11px] space-y-0.5">
              <div className="flex justify-between gap-2"><span className="font-bold">{t.kind === "NEW" ? "SEWA BOT TELEGRAM" : t.kind === "EXTEND" ? "PERPANJANG BOT" : t.kind === "SLOT" ? `TAMBAH ${t.slots_added} SLOT` : "PERPANJANGAN ADMIN"}</span><span className="font-bold">{t.amount > 0 ? `-${rupiah(t.amount)}` : "Gratis"}</span></div>
              {t.duration_label && <p className="text-muted-foreground">Paket: {t.duration_label}{t.discount > 0 ? ` · diskon ${rupiah(t.discount)}` : ""}</p>}
              {t.balance_before != null && <p className="text-muted-foreground">Saldo: {rupiah(t.balance_before)} → {rupiah(t.balance_after)}</p>}
              <div className="flex justify-between text-muted-foreground"><button className="font-mono flex items-center gap-1" onClick={() => copy(t.transaction_id)}>{t.transaction_id}<Copy className="w-3 h-3" /></button><span className="text-emerald-400 font-semibold">{t.status}</span></div>
              <p className="text-muted-foreground">{fmtDate(t.created_at)}</p>
            </div>
          ))}
        </section>
      )}

      {checkout && visitorId && (
        <CheckoutDialog visitorId={visitorId} checkout={checkout} balance={balance} slotPrice={slotPrice} onClose={() => setCheckout(null)}
          onTopUp={() => { setCheckout(null); onTopUp(); }} onDone={() => { setCheckout(null); load(); }} />
      )}
      {createOpen && visitorId && <CreateBotDialog visitorId={visitorId} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); }} />}
      {detailId && visitorId && <BotDetailDialog visitorId={visitorId} botId={detailId} onClose={() => setDetailId(null)} onChanged={load} onExtend={() => { setDetailId(null); plansRef.current?.scrollIntoView({ behavior: "smooth" }); }} />}
      <Dialog open={noRentalOpen} onOpenChange={setNoRentalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Belum ada paket aktif</DialogTitle>
            <DialogDescription>Anda belum memiliki paket sewa aktif. Silakan pilih paket sewa terlebih dahulu.</DialogDescription></DialogHeader>
          <Button onClick={() => { setNoRentalOpen(false); plansRef.current?.scrollIntoView({ behavior: "smooth" }); }}>LIHAT PAKET</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-background/50 border border-border/60 px-2 py-1.5 min-w-0"><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-xs font-bold truncate tabular-nums">{value}</p></div>;
}

function CheckoutDialog({ visitorId, checkout, balance, slotPrice, onClose, onDone, onTopUp }: {
  visitorId: string; checkout: Checkout; balance: number; slotPrice: number; onClose: () => void; onDone: () => void; onTopUp: () => void;
}) {
  const { toast } = useToast();
  const [voucher, setVoucher] = useState("");
  const [applied, setApplied] = useState("");
  const [slots, setSlots] = useState(checkout.kind === "slot" ? checkout.slots : 1);
  const [quote, setQuote] = useState<any>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; insufficient?: boolean } | null>(null);
  const reqId = useRef(newRequestId()); // one id per checkout → retries/double-click reuse it

  const params = checkout.kind === "plan" ? { kind: "plan", planCode: checkout.plan.code } : { kind: "slot", slots };
  useEffect(() => {
    botApi({ action: "quote", visitorId, ...params, voucher: applied || null }).then((q) => setQuote(q));
    reqId.current = newRequestId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, slots]);

  const pay = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(pin)) return setErr({ msg: "PIN harus 6 digit" });
    setBusy(true); setErr(null);
    const r = await botApi<any>({ action: "purchase", visitorId, ...params, voucher: applied || null, pin, requestId: reqId.current });
    setBusy(false);
    if (r.error) return setErr({ msg: r.error, insufficient: r.code === "insufficient" });
    toast({ title: "✅ Pembayaran berhasil", description: `ID ${r.transaction_id}` });
    onDone();
  };

  const total = quote?.total ?? (checkout.kind === "plan" ? checkout.plan.price : slotPrice * slots);
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{checkout.kind === "plan" ? "Checkout Sewa Bot" : "Tambah Slot Bot"}</DialogTitle>
          <DialogDescription>Harga dan diskon dihitung oleh server.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {checkout.kind === "plan" ? (
            <Row k="Paket" v={`${checkout.plan.duration_label}`} />
          ) : (
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Jumlah slot</span>
              <div className="flex items-center gap-2"><Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setSlots(Math.max(1, slots - 1))}>-</Button><span className="w-5 text-center font-bold">{slots}</span><Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setSlots(Math.min(20, slots + 1))}>+</Button></div></div>
          )}
          <Row k="Harga" v={rupiah(quote?.base)} />
          <div className="flex gap-1.5">
            <Input value={voucher} onChange={(e) => setVoucher(e.target.value.toUpperCase())} placeholder="Kode voucher" className="h-8 text-xs" />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setApplied(voucher.trim())}>Pakai</Button>
          </div>
          {applied && quote?.voucher_error && <p className="text-xs text-destructive">{quote.voucher_error}</p>}
          <Row k="Diskon" v={quote?.discount ? `-${rupiah(quote.discount)}` : "-"} />
          <Row k="Total" v={rupiah(total)} bold />
          <Row k="Saldo" v={rupiah(quote?.balance ?? balance)} />
          <Row k="Saldo setelah" v={rupiah(quote?.balance_after)} />
          <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN 6 digit" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="h-9" />
          {err && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-2 text-xs text-destructive space-y-1.5">
              <p>{err.insufficient ? "Saldo tidak cukup. " : ""}{err.msg}</p>
              {err.insufficient && <Button size="sm" className="h-7 text-[11px]" onClick={onTopUp}><Wallet className="w-3 h-3 mr-1" />Top Up Saldo</Button>}
            </div>
          )}
          <Button className="w-full" onClick={pay} disabled={busy || !quote || !!quote?.error}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : checkout.kind === "plan" ? "SEWA SEKARANG" : "BAYAR"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className={bold ? "font-extrabold text-primary" : "font-medium"}>{v}</span></div>;
}

async function fileToBase64(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

function CreateBotDialog({ visitorId, onClose, onDone }: { visitorId: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(""); const [token, setToken] = useState(""); const [owner, setOwner] = useState("");
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    const r = await botApi<any>({ action: "create_bot", visitorId, name, token, ownerTelegramId: owner });
    if (r.error) { setBusy(false); return setErr(r.error); }
    setToken("");
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setBusy(false); toast({ title: "Bot dibuat, tetapi file > 5 MB ditolak" }); return onDone(); }
      const u = await botApi<any>({ action: "upload_version", visitorId, botId: r.bot.id, fileName: file.name, base64: await fileToBase64(file) });
      if (u.error) toast({ title: "Bot dibuat, upload file gagal", description: u.error, variant: "destructive" });
      else if (u.message) toast({ title: "File tersimpan", description: u.message });
    }
    setBusy(false); toast({ title: "✅ Bot dibuat" }); onDone();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Tambah Bot</DialogTitle><DialogDescription>Token dikirim aman dan tidak pernah ditampilkan lagi.</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Nama Bot (label di web)" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <Input type="password" autoComplete="off" placeholder="Telegram Bot Token dari @BotFather" value={token} onChange={(e) => setToken(e.target.value)} />
          <Input inputMode="numeric" placeholder="Owner Telegram ID (opsional)" value={owner} onChange={(e) => setOwner(e.target.value.replace(/[^\d-]/g, ""))} />
          <label className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border p-4 text-xs text-muted-foreground cursor-pointer hover:border-primary">
            <Upload className="w-5 h-5" />{file ? `${file.name} (${Math.ceil(file.size / 1024)} KB)` : "Upload ZIP bot (maks 5 MB, wajib berisi adistore-bot.json)"}
            <input type="file" accept=".zip,.js,.mjs,.cjs" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <Button className="w-full" onClick={submit} disabled={busy || !name.trim() || !token.trim()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Bot"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BotDetailDialog({ visitorId, botId, onClose, onChanged, onExtend }: { visitorId: string; botId: string; onClose: () => void; onChanged: () => void; onExtend: () => void }) {
  const { toast } = useToast();
  const [d, setD] = useState<any>(null); const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState(false); const [name, setName] = useState(""); const [owner, setOwner] = useState(""); const [token, setToken] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const r = await botApi<any>({ action: "detail", visitorId, botId });
    if (r.error) { toast({ title: r.error, variant: "destructive" }); return onClose(); }
    setD(r); setName(r.bot.name); setOwner(r.bot.owner_telegram_id ?? "");
  }, [visitorId, botId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    const r = await botApi<any>({ action, visitorId, botId, ...extra });
    setBusy(null);
    if (r.error) toast({ title: r.error, variant: "destructive" });
    else toast({ title: r.message ? "Tersimpan" : "Berhasil", description: r.message });
    await load(); onChanged();
    return r;
  };
  if (!d) return <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md"><DialogTitle className="sr-only">Detail Bot</DialogTitle><Loader2 className="w-5 h-5 animate-spin mx-auto" /></DialogContent></Dialog>;
  const b = d.bot as BotRow; const st = STATUS_LABEL[b.status] ?? { label: b.status, tone: "" };
  const none = "Belum ada data";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="truncate">Detail Bot · {b.name}</DialogTitle><DialogDescription className={`font-bold ${st.tone}`}>● {st.label}</DialogDescription></DialogHeader>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-[11px] space-y-0.5">
          <p className="font-semibold">Runtime: Webhook Telegram (serverless)</p>
          <p className="text-muted-foreground">Bot dijalankan dari file <code>adistore-bot.json</code> di ZIP (daftar command & balasan). Kode JavaScript/Node.js tidak dijalankan demi keamanan.</p>
          {b.last_error && <p className="text-destructive">Error terakhir: {b.last_error}</p>}
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {[
            ["Username", b.telegram_username ? `@${b.telegram_username}` : none], ["Runtime", b.runtime],
            ["Mulai sewa", fmtDate(d.rental?.started_at)], ["Berakhir", fmtDate(d.rental?.expires_at)],
            ["ID Transaksi", d.rental?.last_transaction_id ?? "-"], ["Versi aktif", b.current_version ? `v${b.current_version}` : none],
            ["Uptime", b.status === "ACTIVE" && b.started_at ? timeLeft(new Date(2 * Date.now() - new Date(b.started_at).getTime()).toISOString()) : none],
            ["Pengguna", b.total_users ?? none], ["Pesan", b.total_messages ?? none], ["Command", b.total_commands ?? none],
            ["Aktivitas terakhir", b.last_activity_at ? fmtDate(b.last_activity_at) : "Belum ada aktivitas."], ["CPU / RAM", "Data belum tersedia"],
          ].map(([k, v]) => <div key={String(k)} className="rounded-lg bg-muted/40 p-1.5 min-w-0"><p className="text-muted-foreground">{k}</p><p className="font-semibold truncate">{String(v)}</p></div>)}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Button size="sm" className="h-8 text-[11px]" disabled={!d.active || !!busy} onClick={() => act("start")}><Play className="w-3 h-3 mr-1" />Start</Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" disabled={!!busy || b.status === "FROZEN"} onClick={() => act("stop")}><Square className="w-3 h-3 mr-1" />Stop</Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" disabled={!d.active || !!busy} onClick={() => act("restart")}><RotateCcw className="w-3 h-3 mr-1" />Restart</Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setEdit(!edit)}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" disabled={!!busy} onClick={() => fileRef.current?.click()}><Upload className="w-3 h-3 mr-1" />Ganti File</Button>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={onExtend}>Perpanjang</Button>
        </div>
        {!d.active && <p className="text-[11px] text-destructive">Perpanjang sewa untuk mengaktifkan bot.</p>}
        <input ref={fileRef} type="file" accept=".zip,.js,.mjs,.cjs" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          if (f.size > 5 * 1024 * 1024) return toast({ title: "Ukuran file maksimal 5 MB", variant: "destructive" });
          await act("upload_version", { fileName: f.name, base64: await fileToBase64(f) });
        }} />
        {edit && (
          <div className="space-y-1.5 rounded-xl border border-border p-2">
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Nama bot" className="h-8 text-xs" />
            <Input value={owner} onChange={(e) => setOwner(e.target.value.replace(/[^\d-]/g, ""))} placeholder="Owner Telegram ID" className="h-8 text-xs" />
            <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={b.has_token ? "Token tersimpan — isi untuk mengganti" : "Bot Token"} className="h-8 text-xs" />
            <Button size="sm" className="w-full h-8 text-xs" disabled={!!busy} onClick={async () => { const r = await act("update_bot", { name, ownerTelegramId: owner, token: token || undefined }); if (!r.error) { setToken(""); setEdit(false); } }}>Simpan</Button>
          </div>
        )}
        <AiAdapterCard visitorId={visitorId} bot={b} versions={d.versions} onDone={() => { load(); onChanged(); }} />
        <div className="space-y-1">
          <p className="text-xs font-bold">Versi</p>
          {d.versions.length === 0 ? <p className="text-[11px] text-muted-foreground">Belum ada file diunggah.</p> : d.versions.map((v: any) => (
            <div key={v.version} className="rounded-lg bg-muted/40 px-2 py-1.5 text-[11px] space-y-1">
              <div className="flex justify-between gap-2"><span className="truncate">v{v.version} · {v.file_name} · {Math.ceil(v.file_size / 1024)} KB</span>
                <span className={`shrink-0 font-semibold ${v.compatible ? "text-emerald-400" : "text-destructive"}`}>{b.current_version === v.version ? "AKTIF" : v.compatible ? "Kompatibel" : "Tidak kompatibel"}</span></div>
              {!v.compatible && v.compat_report?.reasons && <ul className="list-disc pl-4 text-muted-foreground">{v.compat_report.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>}
              {v.compatible && v.compat_report?.commands && <p className="text-muted-foreground">Command: {v.compat_report.commands.join(" ")}</p>}
              {v.compat_report?.ai_adapted && <div className="flex items-center gap-1"><span className="text-primary font-semibold">AI dari v{v.compat_report.source_version}</span><Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={async () => { const r = await botApi<any>({ action: "download_version", visitorId, botId, version: v.version }); if (r.url) window.open(r.url, "_blank"); else toast({ title: r.error, variant: "destructive" }); }}>Download</Button></div>}
              {b.current_version !== v.version && (
                <div className="flex gap-1">
                  {v.compatible && <Button size="sm" variant="outline" className="h-6 text-[10px]" disabled={!!busy} onClick={() => act("set_active_version", { version: v.version })}>Jadikan aktif</Button>}
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" disabled={!!busy} onClick={() => { if (confirm(`Hapus v${v.version}?`)) act("delete_version", { version: v.version }); }}>Hapus</Button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold flex items-center gap-1"><FileText className="w-3 h-3" />Log</p>
          <div className="max-h-40 overflow-y-auto rounded-lg bg-background/70 border border-border p-2 font-mono text-[10px] space-y-0.5">
            {d.logs.length === 0 ? <p className="text-muted-foreground">Belum ada log.</p> : d.logs.map((l: any, i: number) => <p key={i} className={l.level === "warn" ? "text-amber-400" : ""}>[{new Date(l.created_at).toLocaleTimeString("id-ID")}] {l.message}</p>)}
          </div>
        </div>
        {!confirmDel ? (
          <Button variant="outline" size="sm" className="h-8 text-xs text-destructive border-destructive/40" onClick={() => setConfirmDel(true)}><Trash2 className="w-3 h-3 mr-1" />Hapus Bot</Button>
        ) : (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 space-y-1.5 text-[11px]">
            <p className="font-bold">Hapus bot?</p>
            <p>File dan konfigurasi bot akan dihapus setelah proses penghapusan selesai. Riwayat transaksi tetap disimpan.</p>
            {d.active && <p className="text-destructive">Masa sewa masih aktif — slot bisa dipakai untuk bot lain, uang sewa tidak dikembalikan.</p>}
            <div className="flex gap-1.5"><Button size="sm" variant="destructive" className="h-7 text-[11px]" disabled={!!busy} onClick={async () => { const r = await act("delete_bot"); if (!r.error) onClose(); }}>Ya, hapus</Button><Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setConfirmDel(false)}>Batal</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

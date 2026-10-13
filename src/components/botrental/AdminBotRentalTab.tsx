import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { botApi, rupiah, fmtDate } from "./api";

const DURATIONS: [string, number][] = [["1 jam", 3600], ["1 hari", 86400], ["7 hari", 604800], ["1 bulan", 2592000], ["2 bulan", 5184000], ["6 bulan", 15552000], ["1 tahun", 31536000]];
const EMPTY_V = { code: "", discount_type: "percent", discount_value: 10, applies_to: "all", min_purchase: 0, max_uses: "", starts_at: "", ends_at: "", active: true };

export default function AdminBotRentalTab() {
  const { toast } = useToast();
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [ext, setExt] = useState<{ id: string; secs: number; reason: string } | null>(null);
  const [v, setV] = useState<any>(EMPTY_V);
  const [logs, setLogs] = useState<{ bot: string; rows: any[] } | null>(null);
  const [usage, setUsage] = useState<{ code: string; rows: any[] } | null>(null);

  const load = useCallback(async () => {
    const r = await botApi<any>({ action: "admin_overview" });
    if (r.error) toast({ title: r.error, variant: "destructive" }); else setD(r);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const run = async (body: Record<string, unknown>, ok = "Berhasil") => {
    setBusy(true); const r = await botApi<any>(body); setBusy(false);
    if (r.error) toast({ title: r.error, variant: "destructive" }); else { toast({ title: ok }); await load(); }
    return r;
  };

  if (!d) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  const rentals = d.rentals ?? []; const bots = d.bots ?? [];
  const now = Date.now();
  const count = (f: (r: any) => boolean) => rentals.filter(f).length;
  const stats = [
    ["Total Rental", rentals.length], ["Aktif", count((r) => r.status === "ACTIVE" && new Date(r.expires_at).getTime() > now)],
    ["Expired", count((r) => r.status === "EXPIRED")], ["Frozen", count((r) => r.status === "FROZEN")],
    ["Total Bot", bots.length], ["Deploy gagal", bots.filter((b: any) => b.status === "FAILED").length], ["Revenue", rupiah(d.revenue)],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Manajemen Sewa Bot</h2><Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4" /></Button></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {stats.map(([k, val]) => <div key={String(k)} className="rounded-xl border border-border bg-card p-2"><p className="text-[10px] text-muted-foreground">{k}</p><p className="font-bold">{String(val)}</p></div>)}
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold text-sm">Rental</h3>
        {rentals.length === 0 && <p className="text-xs text-muted-foreground">Belum ada rental.</p>}
        {rentals.map((r: any) => {
          const rb = bots.filter((b: any) => b.rental_id === r.id);
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 text-xs space-y-1.5">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-bold">{r.user_balances?.username ?? "-"}</span><span className="font-semibold">{r.status} · slot {rb.length}/{r.slots}</span></div>
              <p className="text-muted-foreground">Berakhir {fmtDate(r.expires_at)} · ID {r.last_transaction_id ?? "-"}</p>
              {rb.map((b: any) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-muted/40 px-2 py-1">
                  <span className="truncate">🤖 {b.name} {b.telegram_username ? `@${b.telegram_username}` : ""} · {b.status}</span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={async () => { const x = await botApi<any>({ action: "admin_logs", botId: b.id }); setLogs({ bot: b.name, rows: x.logs ?? [] }); }}>Log</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" disabled={busy} onClick={() => run({ action: "admin_stop_bot", botId: b.id }, "Bot dihentikan")}>Stop</Button>
                  </span>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" className="h-7 text-[11px]" onClick={() => setExt({ id: r.id, secs: 86400, reason: "" })}>Tambah masa sewa</Button>
                {r.status === "FROZEN"
                  ? <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => run({ action: "admin_unfreeze", rentalId: r.id, reason: "admin" }, "Diaktifkan")}>Aktifkan</Button>
                  : <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => { const reason = prompt("Alasan membekukan?"); if (reason) run({ action: "admin_freeze", rentalId: r.id, reason }, "Dibekukan"); }}>Bekukan</Button>}
              </div>
              {ext?.id === r.id && (
                <div className="space-y-1.5 rounded-lg border border-border p-2">
                  <div className="flex flex-wrap gap-1">{DURATIONS.map(([l, s]) => <Button key={l} size="sm" variant={ext.secs === s ? "default" : "outline"} className="h-6 text-[10px]" onClick={() => setExt({ ...ext, secs: s })}>{l}</Button>)}</div>
                  <Input placeholder="Alasan (wajib)" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} className="h-8 text-xs" />
                  <div className="flex gap-1.5"><Button size="sm" className="h-7 text-[11px]" disabled={busy || !ext.reason.trim()} onClick={async () => { const x = await run({ action: "admin_extend", rentalId: r.id, seconds: ext.secs, reason: ext.reason }, "Masa sewa ditambah"); if (!x.error) setExt(null); }}>Simpan</Button><Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setExt(null)}>Batal</Button></div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {logs && <section className="rounded-xl border border-border p-2 text-[10px] font-mono space-y-0.5 max-h-48 overflow-y-auto"><div className="flex justify-between font-sans text-xs font-bold"><span>Log {logs.bot}</span><button onClick={() => setLogs(null)}>✕</button></div>{logs.rows.length ? logs.rows.map((l, i) => <p key={i}>[{fmtDate(l.created_at)}] {l.message}</p>) : <p>Belum ada log.</p>}</section>}

      <section className="space-y-2">
        <h3 className="font-semibold text-sm">Paket & Harga</h3>
        {(d.plans ?? []).map((p: any) => <PlanRow key={p.code} p={p} busy={busy} onSave={(price, active) => run({ action: "admin_update_plan", code: p.code, price, active }, "Paket disimpan")} />)}
        <PlanRow p={{ duration_label: "Harga per slot bot", price: d.slot_price, active: true }} busy={busy} hideActive onSave={(price) => run({ action: "admin_slot_price", price }, "Harga slot disimpan")} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-sm">Voucher Sewa Bot</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl border border-border p-2">
          <Input placeholder="KODE" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} className="h-8 text-xs" />
          <select value={v.discount_type} onChange={(e) => setV({ ...v, discount_type: e.target.value })} className="h-8 rounded-md border border-input bg-background text-xs px-2"><option value="percent">Persen %</option><option value="fixed">Nominal Rp</option></select>
          <Input type="number" placeholder="Nilai" value={v.discount_value} onChange={(e) => setV({ ...v, discount_value: e.target.value })} className="h-8 text-xs" />
          <select value={v.applies_to} onChange={(e) => setV({ ...v, applies_to: e.target.value })} className="h-8 rounded-md border border-input bg-background text-xs px-2"><option value="all">Semua</option><option value="plan">Paket sewa</option><option value="slot">Tambah slot</option></select>
          <Input type="number" placeholder="Min. transaksi" value={v.min_purchase} onChange={(e) => setV({ ...v, min_purchase: e.target.value })} className="h-8 text-xs" />
          <Input type="number" placeholder="Maks. pemakaian" value={v.max_uses} onChange={(e) => setV({ ...v, max_uses: e.target.value })} className="h-8 text-xs" />
          <Input type="datetime-local" title="Mulai" value={v.starts_at} onChange={(e) => setV({ ...v, starts_at: e.target.value })} className="h-8 text-xs" />
          <Input type="datetime-local" title="Berakhir" value={v.ends_at} onChange={(e) => setV({ ...v, ends_at: e.target.value })} className="h-8 text-xs" />
          <Button size="sm" className="h-8 text-xs col-span-2" disabled={busy} onClick={async () => {
            const payload = { ...v, starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null, ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : null };
            const x = await run({ action: "admin_save_voucher", voucher: payload }, "Voucher disimpan"); if (!x.error) setV(EMPTY_V);
          }}>{v.id ? "Simpan perubahan" : "Buat voucher"}</Button>
          {v.id && <Button size="sm" variant="ghost" className="h-8 text-xs col-span-2" onClick={() => setV(EMPTY_V)}>Batal edit</Button>}
        </div>
        {(d.vouchers ?? []).map((x: any) => (
          <div key={x.id} className="flex flex-wrap items-center justify-between gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px]">
            <span><b>{x.code}</b> · {x.discount_type === "percent" ? `${x.discount_value}%` : rupiah(x.discount_value)} · {x.applies_to} · dipakai {x.used_count}{x.max_uses ? `/${x.max_uses}` : ""} · {x.active ? "aktif" : "nonaktif"}{x.ends_at ? ` · s/d ${fmtDate(x.ends_at)}` : ""}</span>
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setV({ ...x, max_uses: x.max_uses ?? "", starts_at: x.starts_at ? x.starts_at.slice(0, 16) : "", ends_at: x.ends_at ? x.ends_at.slice(0, 16) : "" })}>Edit</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" disabled={busy} onClick={() => run({ action: "admin_save_voucher", voucher: { ...x, active: !x.active } }, x.active ? "Voucher dinonaktifkan" : "Voucher diaktifkan")}>{x.active ? "Disable" : "Enable"}</Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={async () => { const u = await botApi<any>({ action: "admin_voucher_usage", voucherId: x.id }); setUsage({ code: x.code, rows: u.usage ?? [] }); }}>Pemakaian</Button>
            </span>
          </div>
        ))}
        {usage && <div className="rounded-lg border border-border p-2 text-[11px] space-y-0.5"><div className="flex justify-between font-bold"><span>Pemakaian {usage.code}</span><button onClick={() => setUsage(null)}>✕</button></div>{usage.rows.length ? usage.rows.map((u, i) => <p key={i}>{u.user_balances?.username ?? "-"} · {u.transaction_id} · -{rupiah(u.discount)} · {fmtDate(u.created_at)}</p>) : <p className="text-muted-foreground">Belum dipakai.</p>}</div>}
      </section>

      <section className="space-y-1">
        <h3 className="font-semibold text-sm">Transaksi Terbaru</h3>
        {(d.transactions ?? []).length === 0 && <p className="text-xs text-muted-foreground">Belum ada transaksi.</p>}
        {(d.transactions ?? []).map((t: any) => <p key={t.transaction_id} className="text-[11px] rounded bg-muted/40 px-2 py-1 font-mono">{t.transaction_id} · {t.kind} · {t.duration_label ?? `${t.slots_added} slot`} · {rupiah(t.amount)} · {t.status} · {fmtDate(t.created_at)}</p>)}
      </section>

      <section className="space-y-1">
        <h3 className="font-semibold text-sm">Audit Log Admin</h3>
        {(d.audit ?? []).length === 0 && <p className="text-xs text-muted-foreground">Belum ada aksi admin.</p>}
        {(d.audit ?? []).map((a: any) => <p key={a.id} className="text-[11px] rounded bg-muted/40 px-2 py-1">{fmtDate(a.created_at)} · {a.action}{a.old_expiry ? ` · ${fmtDate(a.old_expiry)} → ${fmtDate(a.new_expiry)}` : ""}{a.reason ? ` · ${a.reason}` : ""}</p>)}
      </section>
    </div>
  );
}

function PlanRow({ p, busy, onSave, hideActive }: { p: any; busy: boolean; onSave: (price: number, active: boolean) => void; hideActive?: boolean }) {
  const [price, setPrice] = useState(String(p.price)); const [active, setActive] = useState(p.active);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
      <span className="w-32 font-semibold">{p.duration_label}</span>
      <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-7 w-28 text-xs" />
      {!hideActive && <label className="flex items-center gap-1"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />aktif</label>}
      <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => onSave(Number(price), active)}>Simpan</Button>
    </div>
  );
}

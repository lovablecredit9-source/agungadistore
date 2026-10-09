import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronRight, Clock, Globe, Loader2, MonitorSmartphone, RefreshCw, ShieldCheck, Smartphone, Wifi, X, Cpu, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchLoginHistory, type ApiError } from "./securityApi";
import { browserLabel, deviceLabel, formatWib, ipLabel, isLegacyRow, methodLabel, networkLabel, osLabel, type LoginHistoryRow } from "./loginHistoryFormat";

type Scope = "all" | "this" | "other";
type Days = 7 | 30 | 90;

const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: "all", label: "Semua" },
  { id: "this", label: "Perangkat ini" },
  { id: "other", label: "Perangkat lain" },
];
const DAYS: Days[] = [7, 30, 90];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function Row({ icon: Icon, label, value, mono }: { icon: typeof Smartphone; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`break-words text-sm font-medium text-foreground ${mono ? "font-mono tracking-tight" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function DeviceCard({ row, onOpen }: { row: LoginHistoryRow; onOpen: () => void }) {
  const legacy = isLegacyRow(row);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group w-full rounded-2xl border p-3.5 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${row.is_this_device ? "border-success/40 bg-success/5" : "border-border bg-card/80"}`}
    >
      <div className="flex items-center justify-between gap-2">
        {row.is_this_device ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Perangkat ini
            <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] tracking-wide">AKTIF</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span className="h-2 w-2 rounded-full border border-muted-foreground/50" aria-hidden /> Perangkat lain
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>

      <div className="mt-2.5 space-y-1">
        {legacy ? (
          <p className="break-words text-sm font-semibold text-foreground">{row.device_info || "Perangkat tidak tercatat"}</p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Smartphone className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /><span className="break-words">{deviceLabel(row)}</span></p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="break-words">{osLabel(row)}</span></p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Globe className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="break-words">{browserLabel(row)}</span></p>
          </>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-1 border-t border-border/60 pt-2.5 text-xs text-muted-foreground min-[380px]:grid-cols-2">
        <span className="min-w-0 break-all">IP: <span className="font-mono text-foreground">{ipLabel(row)}</span></span>
        <span className="flex items-center gap-1"><Wifi className="h-3 w-3 shrink-0" aria-hidden />{networkLabel(row)}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3 shrink-0" aria-hidden />{formatWib(row.logged_in_at)}</p>
      <p className="mt-1 text-[11px] font-semibold text-success">Login berhasil</p>
    </button>
  );
}

export default function LoginActivityPanel({ visitorId, onClose }: { visitorId: string; onClose: () => void }) {
  const [scope, setScope] = useState<Scope>("all");
  const [days, setDays] = useState<Days>(30);
  const [rows, setRows] = useState<LoginHistoryRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [detail, setDetail] = useState<LoginHistoryRow | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (before: string | null) => {
    const id = ++reqId.current;
    if (before) setLoadingMore(true); else { setLoading(true); setError(null); }
    const res = await fetchLoginHistory(visitorId, { days, scope, before });
    if (id !== reqId.current) return; // filter/account changed meanwhile
    if (before) setLoadingMore(false); else setLoading(false);
    if (res.error) { setError(res.error); if (!before) setRows([]); return; }
    const list = res.data?.history ?? [];
    setRows((prev) => (before ? [...prev, ...list] : list));
    setNext(res.data?.hasMore ? res.data.nextBefore : null);
  }, [visitorId, days, scope]);

  useEffect(() => { void load(null); }, [load]);

  return (
    <section aria-labelledby="login-activity-title" className="rounded-3xl border border-border bg-card/90 p-4 shadow-sm backdrop-blur animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id="login-activity-title" className="flex items-center gap-2 text-base font-bold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Aktivitas Login
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">Pantau perangkat yang pernah digunakan untuk masuk ke akun.</p>
        </div>
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 rounded-full" onClick={onClose} aria-label="Tutup aktivitas login">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter perangkat">
        {SCOPES.map((s) => <Chip key={s.id} active={scope === s.id} onClick={() => setScope(s.id)}>{s.label}</Chip>)}
      </div>
      <div className="mt-1.5 flex gap-2" role="group" aria-label="Rentang waktu">
        {DAYS.map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d} hari</Chip>)}
      </div>

      <div className="mt-3 space-y-2.5" aria-live="polite">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/60" />)
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center" role="alert">
            <AlertCircle className="mx-auto h-6 w-6 text-destructive" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-foreground">Riwayat login gagal dimuat</p>
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5 rounded-xl" onClick={() => load(null)}>
              <RefreshCw className="h-3.5 w-3.5" /> Coba Lagi
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-foreground">Belum ada aktivitas login</p>
            <p className="mt-1 text-xs text-muted-foreground">Riwayat perangkat akan muncul setelah akun digunakan untuk login.</p>
          </div>
        ) : (
          <>
            {rows.map((r) => <DeviceCard key={r.id} row={r} onOpen={() => setDetail(r)} />)}
            {next && (
              <Button variant="outline" className="h-11 w-full rounded-2xl" disabled={loadingMore} onClick={() => load(next)}>
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Muat lebih banyak"}
              </Button>
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        IP dicatat oleh server saat login. Jenis jaringan dan model perangkat dilaporkan browser, jadi hanya sebagai informasi.
        Keluar dari satu perangkat tertentu belum tersedia; gunakan <strong>Logout Semua</strong> untuk mengeluarkan semua sesi.
      </p>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5 text-primary" /> Detail Perangkat</DialogTitle>
            <DialogDescription>{detail?.is_this_device ? "Perangkat yang sedang kamu gunakan." : "Perangkat yang pernah login ke akun ini."}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="divide-y divide-border/60">
              <Row icon={Smartphone} label="Perangkat" value={isLegacyRow(detail) ? (detail.device_info || "Tidak tersedia") : deviceLabel(detail)} />
              <Row icon={Cpu} label="Sistem operasi" value={osLabel(detail)} />
              <Row icon={Globe} label="Browser" value={browserLabel(detail)} />
              <Row icon={Globe} label={detail.ip_source === "server" ? "IP Address (dicatat server)" : "IP Address"} value={ipLabel(detail)} mono />
              <Row icon={Wifi} label="Jaringan (dilaporkan browser)" value={networkLabel(detail)} />
              <Row icon={Clock} label="Waktu login" value={formatWib(detail.logged_in_at)} />
              <Row icon={Clock} label="Aktivitas terakhir" value="Tidak tersedia" />
              <Row icon={KeyRound} label="Metode login" value={methodLabel(detail)} />
              <Row icon={ShieldCheck} label="Status login" value="Login berhasil" />
              {isLegacyRow(detail) && <p className="pt-2 text-[11px] text-muted-foreground">Catatan lama: dicatat sebelum detail perangkat lengkap tersedia.</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

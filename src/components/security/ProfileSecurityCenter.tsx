import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Edit2, History, KeyRound, LogOut, Mail, Plus, QrCode, ShieldAlert, ShieldCheck, Smartphone, Users } from "lucide-react";
import AccountAvatar from "@/components/AccountAvatar";
import { fetchSecuritySummary, type ApiError, type SecuritySummary } from "./securityApi";
import { formatWib } from "./loginHistoryFormat";

type User = { visitor_id: string; username: string; email?: string | null; phone?: string | null };

export function useSecuritySummary(visitorId: string, refreshKey = 0) {
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchSecuritySummary(visitorId);
    setLoading(false);
    if (res.error) { setError(res.error); setSummary(null); return; }
    setError(null);
    setSummary(res.data ?? null);
  }, [visitorId]);
  useEffect(() => { setSummary(null); void load(); }, [load, refreshKey]);
  return { summary, error, loading, reload: load };
}

function StatusPill({ tone, children }: { tone: "ok" | "off" | "na"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "border-success/30 bg-success/10 text-success" : tone === "off" ? "border-border bg-muted text-muted-foreground" : "border-border bg-card text-muted-foreground";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export function ProfileSecurityHeader({ user, summary, loading }: { user: User; summary: SecuritySummary | null; loading: boolean }) {
  return (
    <section aria-label="Profil dan keamanan" className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/5 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Profile &amp; Security</p>
      <div className="mt-3 flex items-center gap-3.5">
        <AccountAvatar visitorId={user.visitor_id} username={user.username} size={60} className="shrink-0 ring-2 ring-background shadow-md" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-extrabold leading-tight text-foreground">{user.username}</p>
          <p className="break-all text-xs text-muted-foreground">{user.email || user.phone || "Email belum diisi"}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-success"><span className="h-2 w-2 rounded-full bg-success" aria-hidden /> Akun aktif</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-live="polite">
        {loading && !summary ? (
          <span className="h-6 w-40 animate-pulse rounded-full bg-muted" />
        ) : summary ? (
          <>
            <StatusPill tone={summary.pinActive ? "ok" : "off"}><KeyRound className="h-3 w-3" aria-hidden />{summary.pinActive ? "PIN Aktif" : "PIN belum dibuat"}</StatusPill>
            <StatusPill tone={summary.twoFaEnabled ? "ok" : "off"}><ShieldCheck className="h-3 w-3" aria-hidden />{summary.twoFaEnabled ? "2FA Aktif" : "2FA nonaktif"}</StatusPill>
            {summary.emailVerified === true && <StatusPill tone="ok"><Mail className="h-3 w-3" aria-hidden />Email terverifikasi</StatusPill>}
            {summary.emailVerified === false && <StatusPill tone="off"><Mail className="h-3 w-3" aria-hidden />Email belum terverifikasi</StatusPill>}
          </>
        ) : null}
      </div>
    </section>
  );
}

export function SecuritySummaryCard({ summary, error, loading, onOpen, onRetry }: { summary: SecuritySummary | null; error: ApiError | null; loading: boolean; onOpen: () => void; onRetry: () => void }) {
  const items: Array<[string, string, boolean | null]> = summary ? [
    ["PIN", summary.pinActive ? "Aktif" : "Belum dibuat", summary.pinActive],
    ["2FA", summary.twoFaEnabled ? "Aktif" : "Nonaktif", summary.twoFaEnabled],
    ["Email", summary.emailVerified === true ? "Terverifikasi" : summary.emailVerified === false ? "Belum terverifikasi" : "Tidak tertaut akun login", summary.emailVerified],
    ["Perangkat", `${summary.devices30d} perangkat (30 hari)`, null],
    ["Login terakhir", formatWib(summary.lastLoginAt), null],
  ] : [];
  return (
    <section aria-labelledby="sec-summary-title" className="rounded-3xl border border-border bg-card/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 id="sec-summary-title" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Keamanan Akun
        </h4>
        <button type="button" onClick={onOpen} className="inline-flex min-h-9 items-center gap-0.5 rounded-full px-2 text-xs font-semibold text-primary hover:bg-primary/10">
          Security Center <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {loading && !summary ? (
        <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-muted/70" />)}</div>
      ) : error ? (
        <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs" role="alert">
          <p className="flex items-center gap-1.5 font-semibold text-foreground"><ShieldAlert className="h-4 w-4 text-destructive" aria-hidden /> Status keamanan gagal dimuat</p>
          <p className="mt-1 text-muted-foreground">{error.message}</p>
          <button type="button" onClick={onRetry} className="mt-2 min-h-9 rounded-xl border border-border px-3 font-semibold text-foreground">Coba Lagi</button>
        </div>
      ) : (
        <dl className="mt-2 divide-y divide-border/60">
          {items.map(([k, v, ok]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className={`text-right text-xs font-semibold ${ok === true ? "text-success" : "text-foreground"}`}>
                {ok === true && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" aria-hidden />}{v}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

type Action = { key: string; icon: typeof Edit2; title: string; subtitle: string; onClick: () => void; disabled?: boolean; tone?: "danger" | "accent"; active?: boolean; badge?: string };

export function ProfileActionGrid({ actions }: { actions: Action[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map(({ key, icon: Icon, title, subtitle, onClick, disabled, tone, active, badge }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-pressed={active}
          className={`group flex min-h-[64px] min-w-0 items-center gap-2.5 rounded-2xl border p-3 text-left transition-all hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none ${
            key === "code" ? "col-span-2" : ""
          } ${tone === "danger" ? "border-destructive/25 bg-destructive/5" : active ? "border-primary/40 bg-primary/10" : "border-border bg-card/90"}`}
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone === "danger" ? "bg-destructive/10 text-destructive" : tone === "accent" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className={`truncate text-[13px] font-bold ${tone === "danger" ? "text-destructive" : "text-foreground"}`}>{title}</span>
              {badge && <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{badge}</span>}
            </span>
            <span className="block text-[11px] leading-snug text-muted-foreground">{subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export const ProfileIcons = { Edit2, Users, Plus, LogOut, ShieldAlert, Smartphone, History, QrCode };

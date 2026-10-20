import { useEffect, useState } from "react";
import { Wallet, Plus, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apkApi } from "./api";

type Me = { username: string | null; balance: number; bonus_balance: number; totp_enabled: boolean; login_via: "auth" | "legacy"; pricing: string };
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

/** Balance read by the server from the wallet the session proves; APK PREMIUM has no tariff, so nothing is charged. */
export default function ApkBalanceCard({ onTopUp, onAuthError }: { onTopUp: () => void; onAuthError: (msg: string) => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    setErr(null);
    const r = await apkApi<Me>({ action: "me" });
    if (r.error) { setErr(r.error); if (["LOGIN_REQUIRED", "auth_required", "wallet_not_found"].includes(r.code ?? "")) onAuthError(r.error); return; }
    setMe(r);
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-label="Saldo akun" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Wallet className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        {err ? <p className="text-xs text-destructive">{err}</p> : !me ? <div className="h-9 w-40 rounded bg-muted motion-safe:animate-pulse" /> : (
          <>
            <p className="text-[11px] text-muted-foreground truncate">Saldo {me.username ? `• ${me.username}` : ""}</p>
            <p className="text-lg font-extrabold text-foreground leading-tight">{rp(me.balance)}{me.bonus_balance > 0 && <span className="ml-1.5 text-[11px] font-semibold text-primary">+{rp(me.bonus_balance)} bonus</span>}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-primary" />Akun aktif{me.login_via === "auth" ? " • login tersambung" : ""} • APK Premium gratis, saldo tidak dipotong
            </p>
          </>
        )}
      </div>
      <div className="flex gap-1.5">
        <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Muat ulang saldo" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
        <Button size="sm" className="h-9 gap-1" onClick={onTopUp}><Plus className="h-4 w-4" />Top Up</Button>
      </div>
    </section>
  );
}

import { Loader2, ShieldAlert } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SecuritySummary } from "./securityApi";

export default function LogoutAllDialog({ open, onOpenChange, summary, busy, onConfirm }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  summary: SecuritySummary | null;
  busy: boolean;
  onConfirm: () => void;
}) {
  const devices = summary?.devices30d ?? null;
  const others = devices === null ? null : Math.max(devices - 1, 0);
  const canRevoke = !!summary?.globalSignOutSupported;
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl">
        <AlertDialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive sm:mx-0">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </div>
          <AlertDialogTitle>Logout Semua Perangkat</AlertDialogTitle>
          <AlertDialogDescription>Semua sesi login akun ini akan dikeluarkan.</AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <dt className="text-[11px] text-muted-foreground">Perangkat ini</dt>
            <dd className="text-xl font-extrabold text-foreground">1</dd>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <dt className="text-[11px] text-muted-foreground">Perangkat lain (login 30 hari)</dt>
            <dd className="text-xl font-extrabold text-foreground">{others ?? "–"}</dd>
          </div>
        </dl>

        <div className="rounded-2xl border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
          {canRevoke ? (
            <>Akun ini memakai akun login (email/Google). Server akan <strong className="text-foreground">mencabut semua sesi</strong> di semua perangkat, lalu semua akun tersimpan di perangkat ini dihapus.</>
          ) : (
            <>Akun ini belum ditautkan ke akun login (email/Google), jadi <strong className="text-foreground">tidak ada sesi server yang bisa dicabut</strong> dari perangkat lain. Yang dilakukan: keluar di perangkat ini dan menghapus semua akun tersimpan di perangkat ini. Ganti sandi bila curiga ada perangkat lain.</>
          )}
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy} className="h-11 rounded-2xl">Batalkan</AlertDialogCancel>
          <Button variant="destructive" className="h-11 rounded-2xl" disabled={busy} onClick={onConfirm}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Logout Semua"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

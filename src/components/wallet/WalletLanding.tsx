import { Wallet, Lock, LogIn, UserPlus, KeyRound, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { onLogin: () => void; onRegister: () => void; onCode: () => void };

// Hanya fitur yang memang tersedia di aplikasi setelah login.
const BENEFITS = ["Kelola saldo", "Top Up", "Riwayat transaksi", "Belanja di Store", "Reward & Membership"];

export default function WalletLanding({ onLogin, onRegister, onCode }: Props) {
  return (
    <section aria-labelledby="wallet-landing-title" className="relative min-w-0 space-y-5 animate-fade-in motion-reduce:animate-none">
      <div className="text-center lg:text-left">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Agung Adi Store</p>
        <h2 id="wallet-landing-title" className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
          Dompet Digital
        </h2>
        <p className="mt-1 text-sm text-muted-foreground lg:text-base">Kelola saldo dengan aman dan mudah.</p>
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-primary/20 bg-gradient-to-br from-primary/90 via-primary to-accent p-5 text-primary-foreground shadow-xl shadow-primary/20 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary-foreground/15 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-accent/40 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur">
              <Wallet className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold">Saldo Utama</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
            <Lock className="h-3 w-3" /> Belum login
          </span>
        </div>
        <p className="relative mt-5 flex items-baseline gap-2 text-3xl font-black sm:text-4xl" aria-label="Saldo tersembunyi">
          <span>Rp</span><span className="tracking-[0.2em]">••••••</span>
        </p>
        <p className="relative mt-3 flex items-center gap-1.5 text-xs text-primary-foreground/85 sm:text-sm">
          <Lock className="h-3.5 w-3.5 shrink-0" /> Login untuk mengakses saldo dan transaksi kamu
        </p>
      </div>

      <div className="grid gap-2.5 lg:hidden">
        <Button onClick={onLogin} className="h-12 rounded-2xl gap-2 font-bold"><LogIn className="h-4 w-4" /> Login</Button>
        <Button onClick={onRegister} variant="outline" className="h-12 rounded-2xl gap-2 font-bold"><UserPlus className="h-4 w-4" /> Daftar</Button>
        <div className="flex items-center gap-2 py-0.5 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> atau <span className="h-px flex-1 bg-border" />
        </div>
        <Button onClick={onCode} variant="secondary" className="h-12 rounded-2xl gap-2 font-bold"><KeyRound className="h-4 w-4" /> Login dengan Kode</Button>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 lg:gap-2.5">
        {BENEFITS.map((b) => (
          <li key={b} className="flex min-w-0 items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5 text-xs font-semibold backdrop-blur lg:text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Check className="h-3 w-3" /></span>
            <span className="truncate">{b}</span>
          </li>
        ))}
      </ul>
      <p className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Transaksi saldo dilindungi PIN 6 digit.
      </p>
    </section>
  );
}

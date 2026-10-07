import { Wallet, Banknote, Gem, Coins, Gamepad2, Ticket, ChevronRight, type LucideIcon } from "lucide-react";
import { useWalletSummary } from "@/hooks/useWalletSummary";
import AccountAvatar from "@/components/AccountAvatar";

interface Props {
  visitorId: string;
  username: string;
  avatarUrl?: string | null;
  balance: number;
  gameBalance: number;
  hidden: boolean;
  formatPrice: (n: number) => string;
  onGo: (tab: string) => void;
}

const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("id-ID");

/** 6 currency cards + account identity for the existing Saldo tab. */
export default function WalletCurrencyGrid({ visitorId, username, avatarUrl, balance, gameBalance, hidden, formatPrice, onGo }: Props) {
  const { data } = useWalletSummary(visitorId);
  const mask = (s: string) => (hidden ? "••••" : s);
  const unlimited = !!data?.unlimitedUntil && new Date(data.unlimitedUntil) > new Date();
  const totalTickets = (data?.normalTickets ?? 0) + (data?.premiumTickets ?? 0);

  const cards: { key: string; icon: LucideIcon; name: string; value: string; note?: string; cta?: { label: string; tab: string } }[] = [
    { key: "main", icon: Wallet, name: "Saldo Utama", value: mask(formatPrice(Number(balance) || 0)), note: "Belanja & top up", cta: { label: "Riwayat", tab: "history" } },
    { key: "in", icon: Banknote, name: "Saldo IN", value: mask(formatPrice(Number(gameBalance) || 0)), note: "Game, Streak, Storage", cta: { label: "Plus Hub", tab: "plus" } },
    { key: "gem", icon: Gem, name: "Gem", value: data ? mask(`${fmt(data.gems)} 💎`) : "…", cta: { label: "Gem Shop", tab: "luckroyale" } },
    { key: "coin", icon: Coins, name: "Koin Streak", value: data ? mask(`${fmt(data.streakCoins)} 🪙`) : "…", cta: { label: "Streak Shop", tab: "streakshop" } },
    { key: "credit", icon: Gamepad2, name: "Kredit Game", value: data ? mask(unlimited ? "Unlimited" : `${fmt(data.credits)} Kredit`) : "…", note: unlimited ? `s/d ${new Date(data!.unlimitedUntil!).toLocaleDateString("id-ID")}` : undefined, cta: { label: "Main Game", tab: "game" } },
    { key: "ticket", icon: Ticket, name: "Tiket Spin", value: data ? mask(`${fmt(totalTickets)} Tiket`) : "…", note: data ? `Normal ${fmt(data.normalTickets)} · Premium ${fmt(data.premiumTickets)}` : undefined, cta: { label: "Luck Royale", tab: "luckroyale" } },
  ];

  return (
    <section aria-label="Wallet saya" className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <AccountAvatar visitorId={visitorId} username={username} avatarUrl={avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{username || "Akun"}</p>
          <p className="truncate text-[11px] text-muted-foreground">@{(username || "akun").toLowerCase().replace(/\s+/g, "")}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">Wallet Saya</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.key} className={`flex min-w-0 flex-col rounded-2xl border p-3 ${c.key === "main" ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <c.icon className={`h-4 w-4 shrink-0 ${c.key === "main" ? "text-primary" : ""}`} aria-hidden />
              <span className="truncate text-[10px] font-bold uppercase tracking-wider">{c.name}</span>
              {c.key === "main" && <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[8px] font-bold text-primary">LIVE</span>}
            </div>
            <p className="mt-1.5 truncate text-base font-extrabold text-foreground">{c.value}</p>
            {c.note && <p className="truncate text-[10px] text-muted-foreground">{c.note}</p>}
            {c.cta && (
              <button type="button" onClick={() => onGo(c.cta!.tab)} className="mt-2 inline-flex items-center gap-0.5 self-start text-[11px] font-semibold text-primary hover:underline">
                {c.cta.label} <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

import { Zap, ShieldCheck, LifeBuoy } from "lucide-react";
import { useResponseRate } from "@/hooks/useResponseRate";
import { useAdminOnline } from "@/components/support/useAdminOnline";

/** Kepala Support Center: status admin (dari aktivitas dashboard admin), persentase respon, tips keamanan. */
export default function LiveChatStatus() {
  const { rate, loading } = useResponseRate();
  const online = useAdminOnline();
  const speed = rate >= 90 ? "Biasanya dibalas < 15 menit" : rate >= 70 ? "Biasanya dibalas < 1 jam" : "Balasan mungkin agak lama";

  return (
    <section aria-label="Status Live Chat" className="relative overflow-hidden rounded-[22px] border border-border bg-card/80 p-4 backdrop-blur-md">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> Support Center
        </p>
        <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-foreground">Bagaimana kami bisa membantu?</h2>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-primary" : "bg-muted-foreground"}`} />
            </span>
            <p className="text-sm font-bold text-foreground">
              {online === null ? "Memeriksa status admin…" : online ? "🟢 Admin Online" : "⚫ Admin Offline"}
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            {loading ? "…" : `${Math.round(rate)}% respon`}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden /> {online ? speed : "Pesan tetap diterima dan dibalas saat admin kembali online"}
        </p>
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          Admin tidak pernah meminta PIN atau kode login. Jangan bagikan ke siapa pun.
        </p>
      </div>
    </section>
  );
}

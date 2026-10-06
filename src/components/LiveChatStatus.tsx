import { useEffect, useState } from "react";
import { Clock, Zap, ShieldCheck } from "lucide-react";
import { useResponseRate } from "@/hooks/useResponseRate";

const OPEN_HOUR = 7;   // 07:00 WIB
const CLOSE_HOUR = 23; // 23:00 WIB

function wibHour() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/** Status admin Live Chat: jam layanan (WIB), persentase respon, dan tips singkat. */
export default function LiveChatStatus() {
  const { rate, loading } = useResponseRate();
  const [hour, setHour] = useState(wibHour);
  useEffect(() => {
    const t = setInterval(() => setHour(wibHour()), 60_000);
    return () => clearInterval(t);
  }, []);
  const online = hour >= OPEN_HOUR && hour < CLOSE_HOUR;
  const speed = rate >= 90 ? "Biasanya dibalas < 15 menit" : rate >= 70 ? "Biasanya dibalas < 1 jam" : "Balasan mungkin agak lama";

  return (
    <section aria-label="Status Live Chat" className="rounded-2xl border border-border bg-card/80 p-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-primary" : "bg-muted-foreground"}`} />
          </span>
          <p className="text-sm font-bold text-foreground">{online ? "Admin sedang online" : "Admin sedang offline"}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
          {loading ? "…" : `${Math.round(rate)}% respon`}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10.5px] text-muted-foreground">
        <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden /> 07.00–23.00 WIB</div>
        <div className="col-span-2 flex items-center gap-1"><Zap className="h-3.5 w-3.5 shrink-0" aria-hidden /> {online ? speed : "Pesan tetap diterima, dibalas saat buka"}</div>
      </div>
      <p className="mt-2 flex items-start gap-1 text-[10.5px] text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        Admin tidak pernah meminta PIN atau kode login. Jangan bagikan ke siapa pun.
      </p>
    </section>
  );
}

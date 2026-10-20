import { useState } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SimCard } from "./simCard";
import { simCardText } from "./simCard";

export default function SimCardResult({ card, raw, latency }: { card: SimCard; raw?: string | null; latency?: number }) {
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(simCardText(card)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="space-y-3 animate-fade-in">
      <section aria-label={card.title} className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-md">
        <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Smartphone className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight text-foreground">{card.title}</p>
            {latency ? <p className="text-[10px] text-muted-foreground">Data langsung dari penyedia • {(latency / 1000).toFixed(1)} dtk</p> : null}
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void copy()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Tersalin" : "Salin"}
          </Button>
        </header>
        <dl className="divide-y divide-border/50">
          {card.rows.map((r) => (
            <div key={r.label} className="flex items-start gap-2 px-3 py-2.5">
              <span aria-hidden className="w-5 shrink-0 text-sm leading-5">{r.icon}</span>
              <dt className="w-24 shrink-0 text-[11px] font-semibold leading-5 text-muted-foreground">{r.label}</dt>
              <dd className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-5 text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {card.packages.length > 0 && (
        <section aria-label="Detail paket" className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Detail paket ({card.packages.length})</p>
          {card.packages.map((p, i) => (
            <div key={`${p.name}-${i}`} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-foreground">🎁 {p.name}</p>
                {p.expiry && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">s/d {p.expiry}</span>}
              </div>
              {p.quotas.map((q, j) => (
                <div key={j} className="space-y-1">
                  <div className="flex justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-muted-foreground">{q.name}</span>
                    <span className="shrink-0 font-semibold text-foreground">{q.remaining} / {q.total}</span>
                  </div>
                  {q.percent !== null && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={q.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Sisa ${q.name}`}>
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${q.percent}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {raw && (
        <div>
          <button type="button" className="text-xs font-semibold text-muted-foreground underline" onClick={() => setShowRaw((v) => !v)}>{showRaw ? "Sembunyikan" : "Lihat"} data mentah</button>
          {showRaw && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-2 text-[11px] text-foreground">{raw}</pre>}
        </div>
      )}
    </div>
  );
}

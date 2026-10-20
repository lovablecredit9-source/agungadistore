import { useState, type ReactNode } from "react";
import { Copy, Check, ExternalLink, Download, ChevronDown, ChevronUp, AlertTriangle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { NormItem, RunResult } from "./api";

function CopyBtn({ text, label = "Salin" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button" size="sm" variant="outline" className="h-8 gap-1.5"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
        catch { toast.error("Tidak bisa menyalin"); }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{done ? "Tersalin" : label}
    </Button>
  );
}

export default function ResultView({ result, itemActions, onPlayAudio }: { result: RunResult; itemActions?: (item: NormItem) => ReactNode; onPlayAudio?: (url: string) => void }) {
  const [showRaw, setShowRaw] = useState(false);
  const n = result.normalized;
  if (!result.ok || !n) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Gagal</p>
          <p className="break-words">{result.error || n?.error || "Permintaan gagal"}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">Berhasil</span>
        {typeof result.latency_ms === "number" && <span>{(result.latency_ms / 1000).toFixed(1)} detik</span>}
        {n.title && <span className="font-medium text-foreground truncate max-w-full">{n.title}</span>}
      </div>
      {!!result.redacted_links && (
        <p className="text-xs text-muted-foreground">Sebagian link berisi kunci rahasia provider sehingga disembunyikan demi keamanan.</p>
      )}
      {n.taskId && (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm flex flex-wrap items-center gap-2">
          <span>ID tugas: <b className="font-mono">{n.taskId}</b></span>
          <CopyBtn text={n.taskId} />
        </div>
      )}
      {n.texts.map((t, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3">
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{t}</p>
          <div className="mt-2"><CopyBtn text={t} /></div>
        </div>
      ))}
      {n.media.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {n.media.map((m, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{m.kind} • {m.label}</p>
              {m.kind === "image" && <img src={m.url} alt={m.label} loading="lazy" className="w-full max-h-80 object-contain rounded-lg bg-muted" />}
              {m.kind === "video" && <video src={m.url} controls preload="metadata" className="w-full max-h-80 rounded-lg bg-muted" />}
              {m.kind === "audio" && (onPlayAudio && /^https:\/\//i.test(m.url)
                ? <Button type="button" size="sm" className="h-9 w-full gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onPlayAudio(m.url)}><Play className="h-4 w-4" />Putar (tetap jalan di tab lain)</Button>
                : <audio src={m.url} controls preload="none" className="w-full" />)}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="h-8 gap-1.5">
                  <a href={m.url} target="_blank" rel="noopener noreferrer" download><Download className="h-3.5 w-3.5" />Buka / Unduh</a>
                </Button>
                {!m.url.startsWith("data:") && <CopyBtn text={m.url} label="Salin link" />}
              </div>
            </div>
          ))}
        </div>
      )}
      {n.items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {n.items.map((it, i) => (
            <li key={i} className="rounded-xl border border-border bg-card p-2.5 flex gap-3 min-w-0">
              {it.image && <img src={it.image} alt="" loading="lazy" className="h-16 w-24 shrink-0 rounded-md object-cover bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground line-clamp-2 break-words">{it.title}</p>
                {it.meta.length > 0 && (
                  <p className="text-xs text-muted-foreground line-clamp-2 break-words">{it.meta.map((m) => `${m.k}: ${m.v}`).join(" • ")}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {it.url && (
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs gap-1">
                      <a href={it.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />Buka</a>
                    </Button>
                  )}
                  {itemActions?.(it)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {result.raw && (
        <div>
          <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Respons asli provider
          </button>
          {showRaw && <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted p-2 text-[11px] text-foreground whitespace-pre-wrap break-all">{result.raw}</pre>}
        </div>
      )}
    </div>
  );
}

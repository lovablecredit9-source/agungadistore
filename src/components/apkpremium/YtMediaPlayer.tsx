import { useState } from "react";
import { AlertTriangle, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { YtEntry } from "./useYtHistory";

/** Native browser player on the real provider link. Provider links are temporary: a load error is shown as expired. */
export default function YtMediaPlayer({ item, onClose, onReprocess, onPlayed }: {
  item: YtEntry; onClose: () => void; onReprocess: (it: YtEntry) => void; onPlayed: (it: YtEntry) => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "playing" | "error">("loading");
  const [logged, setLogged] = useState(false);
  const video = item.media_kind === "video";
  const common = {
    src: item.media_url ?? undefined, controls: true, preload: "metadata" as const,
    onLoadedMetadata: () => setState((s) => (s === "loading" ? "ready" : s)),
    onPlay: () => { setState("playing"); if (!logged) { setLogged(true); onPlayed(item); } },
    onPause: () => setState("ready"),
    onError: () => setState("error"),
  };
  return (
    <div className="space-y-3 rounded-2xl border border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-primary/10 p-3 shadow-lg animate-fade-in">
      <div className="flex items-start gap-3">
        {item.thumbnail && <img src={item.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold text-foreground">{item.title}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {video ? "Video MP4" : "Audio MP3"}{item.quality ? ` • ${item.quality}p` : ""}{item.duration ? ` • ${item.duration}` : ""}
            {state === "playing" && !video && (
              <span aria-hidden className="flex h-3 items-end gap-0.5">
                {[0, 1, 2, 3].map((i) => <span key={i} className="w-0.5 rounded bg-destructive motion-safe:animate-pulse" style={{ height: `${40 + i * 15}%`, animationDelay: `${i * 120}ms` }} />)}
              </span>
            )}
          </p>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Tutup pemutar"><X className="h-4 w-4" /></Button>
      </div>
      {state === "error" ? (
        <div role="alert" className="space-y-2 rounded-xl bg-muted p-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-destructive" />Tautan media sudah kedaluwarsa atau tidak bisa diputar browser.</p>
          <p className="text-muted-foreground">Link dari penyedia hanya sementara. Proses ulang untuk mendapat link baru.</p>
          {item.url && <Button size="sm" className="gap-1" onClick={() => onReprocess(item)}><RotateCw className="h-3.5 w-3.5" />Proses ulang {video ? "MP4" : "MP3"}</Button>}
        </div>
      ) : video ? (
        <video {...common} playsInline className="aspect-video w-full rounded-xl bg-foreground/90" />
      ) : (
        <audio {...common} className="w-full" />
      )}
      {state === "loading" && <p className="text-[11px] text-muted-foreground">Memeriksa tautan media…</p>}
    </div>
  );
}

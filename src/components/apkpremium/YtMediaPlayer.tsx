import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { YtEntry } from "./useYtHistory";
import YtAudioControls, { Equalizer } from "./YtAudioControls";
import { useYtAudio, ytAudio } from "./ytAudioStore";

/**
 * Player on the real provider link. MP3 uses the shared app-wide audio (keeps playing on other tabs
 * until closed); MP4 uses a native video element. Provider links are temporary: a load error is shown as expired.
 */
export default function YtMediaPlayer({ item, onClose, onReprocess, onPlayed }: {
  item: YtEntry; onClose: () => void; onReprocess: (it: YtEntry) => void; onPlayed: (it: YtEntry) => void;
}) {
  const video = item.media_kind === "video";
  const audio = useYtAudio();
  const [vState, setVState] = useState<"loading" | "ready" | "playing" | "error">("loading");
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    if (video) return;
    ytAudio.setPlayedLogger(onPlayed);
    if (audio.item?.id !== item.id) ytAudio.play(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, video]);

  const state = video ? vState : audio.item?.id === item.id ? (audio.status === "error" ? "error" : audio.status === "playing" ? "playing" : audio.status === "loading" ? "loading" : "ready") : "loading";
  const close = () => { if (!video) ytAudio.stop(); onClose(); };

  return (
    <div className="space-y-3 rounded-2xl border border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-primary/10 p-3 shadow-lg animate-fade-in">
      <div className="flex items-start gap-3">
        {item.thumbnail && <img src={item.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold text-foreground">{item.title}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {video ? "Video MP4" : "Audio MP3"}{item.quality ? ` • ${item.quality}p` : ""}{item.duration ? ` • ${item.duration}` : ""}
            {!video && <Equalizer on={state === "playing"} />}
          </p>
          {!video && state !== "error" && <p className="mt-0.5 text-[10px] text-muted-foreground">Musik tetap jalan saat pindah tab. Tekan ✕ untuk mematikan.</p>}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={close} aria-label={video ? "Tutup pemutar" : "Matikan musik"}><X className="h-4 w-4" /></Button>
      </div>
      {state === "error" ? (
        <div role="alert" className="space-y-2 rounded-xl bg-muted p-3 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-destructive" />Tautan media sudah kedaluwarsa atau tidak bisa diputar browser.</p>
          <p className="text-muted-foreground">Link dari penyedia hanya sementara. Proses ulang untuk mendapat link baru.</p>
          {item.url && <Button size="sm" className="gap-1" onClick={() => { if (!video) ytAudio.stop(); onReprocess(item); }}><RotateCw className="h-3.5 w-3.5" />Proses ulang {video ? "MP4" : "MP3"}</Button>}
        </div>
      ) : video ? (
        <video src={item.media_url ?? undefined} controls preload="metadata" playsInline className="aspect-video w-full rounded-xl bg-foreground/90"
          onLoadedMetadata={() => setVState((s) => (s === "loading" ? "ready" : s))}
          onPlay={() => { ytAudio.stop(); setVState("playing"); if (!logged) { setLogged(true); onPlayed(item); } }}
          onPause={() => setVState("ready")} onError={() => setVState("error")} />
      ) : (
        <YtAudioControls />
      )}
      {state === "loading" && <p className="text-[11px] text-muted-foreground">Memeriksa tautan media…</p>}
    </div>
  );
}

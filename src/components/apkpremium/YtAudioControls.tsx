import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { fmtTime, useYtAudio, ytAudio } from "./ytAudioStore";

/** Play/pause, seek, time and volume for the shared YouTube MP3 audio. */
export default function YtAudioControls({ compact = false }: { compact?: boolean }) {
  const s = useYtAudio();
  const playing = s.status === "playing";
  const max = s.duration > 0 ? s.duration : 0;
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-muted/70 ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}>
      <button type="button" onClick={() => ytAudio.toggle()} aria-label={playing ? "Jeda musik" : "Putar musik"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform active:scale-90">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
      </button>
      <span className="w-[4.5rem] shrink-0 text-[11px] tabular-nums text-muted-foreground" aria-live="off">{fmtTime(s.time)} / {fmtTime(max)}</span>
      <input type="range" min={0} max={max || 1} step={0.5} value={Math.min(s.time, max || 1)} disabled={!max}
        onChange={(e) => ytAudio.seek(Number(e.target.value))} aria-label="Posisi lagu"
        className="h-1 min-w-0 flex-1 cursor-pointer accent-destructive" />
      {!compact && (
        <>
          <button type="button" onClick={() => ytAudio.setVolume(s.volume > 0 ? 0 : 1)} aria-label={s.volume > 0 ? "Bisukan" : "Bunyikan"} className="shrink-0 text-muted-foreground hover:text-foreground">
            {s.volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => ytAudio.setVolume(Number(e.target.value))} aria-label="Volume" className="h-1 w-16 shrink-0 cursor-pointer accent-destructive" />
        </>
      )}
    </div>
  );
}

export function Equalizer({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span aria-hidden className="flex h-3 items-end gap-0.5">
      {[0, 1, 2, 3].map((i) => <span key={i} className="w-0.5 rounded bg-destructive motion-safe:animate-pulse" style={{ height: `${40 + i * 15}%`, animationDelay: `${i * 120}ms` }} />)}
    </span>
  );
}

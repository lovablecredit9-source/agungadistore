import { AlertTriangle, Music2, X } from "lucide-react";
import YtAudioControls, { Equalizer } from "./YtAudioControls";
import { useYtAudio, ytAudio } from "./ytAudioStore";

/** Floating bar shown on every other tab while YouTube MP3 is loaded; closing it stops the music. */
export default function YtMiniPlayer({ hidden, onOpen }: { hidden?: boolean; onOpen?: () => void }) {
  const s = useYtAudio();
  if (!s.item || hidden) return null;
  return (
    <div role="region" aria-label="Pemutar musik YouTube"
      className="fixed inset-x-2 bottom-[5.5rem] z-40 mr-12 rounded-2xl border border-destructive/30 bg-card/95 p-2 shadow-xl backdrop-blur-md animate-fade-in md:inset-x-auto md:bottom-4 md:right-20 md:mr-0 md:w-96">
      <div className="mb-1.5 flex items-center gap-2">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label="Buka APK Premium">
          {s.item.thumbnail
            ? <img src={s.item.thumbnail} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
            : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-destructive/15 text-destructive"><Music2 className="h-4 w-4" /></span>}
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-foreground">{s.item.title}</span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">YouTube MP3 <Equalizer on={s.status === "playing"} /></span>
          </span>
        </button>
        <button type="button" onClick={() => ytAudio.stop()} aria-label="Matikan musik" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {s.status === "error"
        ? <p role="alert" className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-destructive" />Link lagu kedaluwarsa. Buka APK Premium untuk proses ulang.</p>
        : <YtAudioControls compact />}
    </div>
  );
}

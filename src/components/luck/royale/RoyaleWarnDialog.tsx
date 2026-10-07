import { AlertTriangle } from "lucide-react";

interface Props {
  entry: boolean;
  dontRemind: boolean;
  onDontRemindChange: (v: boolean) => void;
  onCancel: () => void;
  onAccept: () => void;
}

export default function RoyaleWarnDialog({ entry, dontRemind, onDontRemindChange, onCancel, onAccept }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm animate-fade-in sm:items-center" role="dialog" aria-modal="true" aria-labelledby="royale-warn-title">
      <div className="royale-glass w-full max-w-sm rounded-3xl p-5 animate-scale-in">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/15 ring-1 ring-amber-300/40">
            <AlertTriangle className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h3 id="royale-warn-title" className="text-[13px] font-black tracking-[0.2em] text-white">BEFORE YOU SPIN</h3>
            <p className="text-[11px] text-white/55">Rewards are randomized. Results may vary.</p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-[11px] leading-relaxed text-white/70">
          <li>• Hadiah ditentukan acak oleh server sesuai peluang yang tertera.</li>
          <li>• Gem yang sudah dipakai untuk spin tidak dikembalikan.</li>
          <li>• Mainkan untuk keseruan — kalau merasa dirugikan, sebaiknya tidak spin.</li>
        </ul>
        <label className="mt-3 flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3">
          <input type="checkbox" checked={dontRemind} onChange={(e) => onDontRemindChange(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          <span className="text-[11px] text-white/65">Jangan ingatkan lagi selama 1 hari</span>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="h-11 rounded-2xl border border-white/15 text-[11px] font-black tracking-wider text-white/75 hover:bg-white/5">
            {entry ? "KELUAR" : "BATAL"}
          </button>
          <button type="button" onClick={onAccept} className="royale-spin-btn h-11 rounded-2xl text-[11px] font-black tracking-[0.15em]">
            UNDERSTAND
          </button>
        </div>
      </div>
    </div>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Gem, Ticket, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SpinWarnPayload {
  tierName: string;
  grad: string;
  count: number;
  mode: "gems" | "ticket";
  cost: number;
  emoji: string;
  balanceAfter: number;
  risky?: boolean;
}

interface Props {
  data: SpinWarnPayload | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SpinWarnDialog({ data, onCancel, onConfirm }: Props) {
  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-3 bg-black/80 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 40, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/15 bg-[#0b0616] p-4 shadow-2xl"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${data.grad}`} />
            <motion.div
              className={`absolute -top-16 -right-10 w-40 h-40 rounded-full blur-3xl bg-gradient-to-br ${data.grad} opacity-30`}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <button
              onClick={onCancel}
              className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative flex items-center gap-2.5">
              <motion.span
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="inline-flex w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 items-center justify-center"
              >
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              </motion.span>
              <div className="min-w-0">
                <div className="text-[13px] font-black text-white leading-none">Konfirmasi Spin</div>
                <div className="text-[10px] font-bold text-white/50 mt-1 truncate">{data.tierName} · x{data.count}</div>
              </div>
            </div>

            <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/50 p-3 space-y-2">
              <Row label="Total biaya" value={`${data.emoji} ${data.cost.toLocaleString("id-ID")}`} strong />
              <Row
                label={data.mode === "gems" ? "Sisa gem" : "Sisa tiket"}
                value={`${data.balanceAfter.toLocaleString("id-ID")}`}
              />
              <div className="flex items-start gap-2 pt-1 text-[10px] font-semibold text-white/55 leading-snug">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                Hadiah bersifat acak & tidak bisa dibatalkan setelah spin dimulai.
              </div>
              {data.risky && (
                <motion.div
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-black text-rose-200"
                >
                  ⚠️ Taruhan besar! Pastikan kamu benar-benar siap.
                </motion.div>
              )}
            </div>

            <div className="relative mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={onCancel}
                className="h-11 rounded-2xl text-[11px] font-black border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
              >
                Batal
              </Button>
              <Button
                onClick={onConfirm}
                className={`h-11 rounded-2xl text-[11px] font-black bg-gradient-to-r ${data.grad} text-white shadow-lg hover:brightness-110 active:scale-95 gap-1.5`}
              >
                {data.mode === "gems" ? <Gem className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                Spin Sekarang
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-white/45">{label}</span>
      <span className={`tabular-nums ${strong ? "text-[13px] font-black text-white" : "text-[11px] font-black text-white/80"}`}>
        {value}
      </span>
    </div>
  );
}

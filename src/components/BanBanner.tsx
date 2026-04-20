import { AlertOctagon } from "lucide-react";
import { useAccountBan, formatBanRemaining, type BanInfo } from "@/hooks/useAccountBan";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, ReactNode } from "react";

function BanDetailsDialog({
  open,
  onOpenChange,
  info,
  fallbackLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: BanInfo | null;
  fallbackLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-red-500 bg-gradient-to-br from-red-950 to-red-900 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertOctagon className="h-5 w-5" /> Akun Dibanned
          </DialogTitle>
          <DialogDescription className="text-red-100">
            Anda tidak bisa menggunakan {fallbackLabel} karena akun sedang dibanned.
          </DialogDescription>
        </DialogHeader>
        {info && (
          <div className="space-y-2 text-sm">
            <p><strong>Alasan:</strong> {info.reason}</p>
            <p><strong>Status:</strong> {formatBanRemaining(info)}</p>
            <p className="text-xs opacity-80">Hubungi admin via WhatsApp jika ini kekeliruan.</p>
          </div>
        )}
        <Button onClick={() => onOpenChange(false)} className="bg-white text-red-700 hover:bg-red-50">Tutup</Button>
      </DialogContent>
    </Dialog>
  );
}

export function BanBanner({ className = "" }: { className?: string }) {
  const { banned, info } = useAccountBan();
  const [open, setOpen] = useState(false);

  if (!banned || !info) return null;

  return (
    <>
      <div className="relative z-50">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`w-full text-left rounded-2xl border-2 border-red-500 bg-gradient-to-br from-red-600/95 to-red-800/95 p-4 text-white shadow-xl ${className}`}
        >
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-6 w-6 shrink-0 animate-pulse" />
            <div className="flex-1 space-y-1">
              <p className="font-bold text-base">🚫 Akun Anda Dibanned</p>
              <p className="text-sm opacity-95">Alasan: {info.reason}</p>
              <p className="text-xs font-semibold bg-black/30 inline-block rounded-full px-2 py-0.5 mt-1">
                {formatBanRemaining(info)}
              </p>
              <p className="text-xs opacity-80 mt-1">Ketuk banner ini untuk lihat detail banding.</p>
            </div>
          </div>
        </button>
      </div>

      <BanDetailsDialog open={open} onOpenChange={setOpen} info={info} fallbackLabel="fitur ini" />
    </>
  );
}

export function BanGuard({ children, fallbackLabel = "fitur ini" }: { children: (locked: boolean, openPopup: () => void) => ReactNode; fallbackLabel?: string }) {
  const { banned, info } = useAccountBan();
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(banned, () => setOpen(true))}
      <BanDetailsDialog open={open && banned} onOpenChange={setOpen} info={info} fallbackLabel={fallbackLabel} />
    </>
  );
}


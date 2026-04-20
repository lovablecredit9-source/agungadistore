import { AlertOctagon } from "lucide-react";
import { useAccountBan, formatBanRemaining } from "@/hooks/useAccountBan";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, ReactNode } from "react";

export function BanBanner({ className = "" }: { className?: string }) {
  const { banned, info } = useAccountBan();
  if (!banned || !info) return null;
  return (
    <div className={`rounded-2xl border-2 border-red-500 bg-gradient-to-br from-red-600/95 to-red-800/95 p-4 text-white shadow-xl ${className}`}>
      <div className="flex items-start gap-3">
        <AlertOctagon className="h-6 w-6 shrink-0 animate-pulse" />
        <div className="flex-1 space-y-1">
          <p className="font-bold text-base">🚫 Akun Anda Dibanned</p>
          <p className="text-sm opacity-95">Alasan: {info.reason}</p>
          <p className="text-xs font-semibold bg-black/30 inline-block rounded-full px-2 py-0.5 mt-1">
            {formatBanRemaining(info)}
          </p>
          <p className="text-xs opacity-80 mt-1">Hubungi admin via WhatsApp untuk banding.</p>
        </div>
      </div>
    </div>
  );
}

export function BanGuard({ children, fallbackLabel = "fitur ini" }: { children: (locked: boolean, openPopup: () => void) => ReactNode; fallbackLabel?: string }) {
  const { banned, info } = useAccountBan();
  const [open, setOpen] = useState(false);
  return (
    <>
      {children(banned, () => setOpen(true))}
      <Dialog open={open && banned} onOpenChange={setOpen}>
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
          <Button onClick={() => setOpen(false)} className="bg-white text-red-700 hover:bg-red-50">Tutup</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DepositSummary, { useDepositPreview } from "./DepositSummary";

/** Panel admin: perkiraan pembagian (dari server) + lihat bukti pembayaran (signed URL, admin-only). */
export default function AdminDepositReview({ depositId, amount, status }: { depositId: string; amount: number; status: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const { preview } = useDepositPreview(open ? amount : 0, open);

  async function toggle() {
    const next = !open; setOpen(next);
    if (!next || url !== undefined) return;
    setLoading(true); setErr(null);
    const { data, error } = await supabase.functions.invoke("deposit-proof", { body: { action: "admin_url", depositId } });
    setLoading(false);
    if (error || (data as { error?: string })?.error) { setErr((data as { error?: string })?.error || "Gagal memuat bukti"); return; }
    setUrl((data as { url?: string | null }).url ?? null);
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={toggle} className="text-[11px] font-bold text-primary inline-flex items-center gap-1">
        <ImageIcon className="w-3.5 h-3.5" /> {open ? "Sembunyikan rincian & bukti" : "Lihat rincian & bukti pembayaran"}
      </button>
      {open && (
        <div className="space-y-2">
          <DepositSummary amount={amount} preview={preview} status={status} />
          <div className="rounded-xl border border-border bg-muted/30 p-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              : err ? <p className="text-[11px] text-destructive">{err}</p>
              : url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Bukti pembayaran" className="max-h-80 w-auto mx-auto rounded-lg object-contain" /></a>
              : <p className="text-[11px] text-muted-foreground text-center">User belum mengupload bukti di aplikasi (cek WhatsApp).</p>}
          </div>
        </div>
      )}
    </div>
  );
}

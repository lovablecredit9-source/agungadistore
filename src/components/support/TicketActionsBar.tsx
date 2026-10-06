import { useState } from "react";
import { Star, Lock, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminOnline } from "./useAdminOnline";

interface Ticket { id: string; status: string; priority?: string | null; rating?: number | null }

const PRIORITY: Record<string, { label: string; cls: string }> = {
  low: { label: "Rendah", cls: "bg-muted text-muted-foreground" },
  normal: { label: "Normal", cls: "bg-secondary text-secondary-foreground" },
  high: { label: "Tinggi", cls: "bg-primary/15 text-primary" },
  urgent: { label: "Darurat", cls: "bg-destructive/15 text-destructive" },
};

/** Baris aksi tiket untuk pengguna: status admin, prioritas, tutup/buka kembali, rating 1–5 (tersimpan di server). */
export default function TicketActionsBar({ ticket, onChanged }: { ticket: Ticket; onChanged?: () => void }) {
  const online = useAdminOnline();
  const [busy, setBusy] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const closed = ticket.status === "closed" || ticket.status === "resolved";
  const p = PRIORITY[ticket.priority || "normal"] || PRIORITY.normal;

  const act = async (action: "close" | "reopen" | "rate") => {
    if (action === "close" && !confirm("Tutup tiket ini? Kamu masih bisa membukanya kembali.")) return;
    setBusy(action);
    const { data, error } = await (supabase as any).rpc("ticket_user_action", {
      p_ticket_id: ticket.id, p_action: action, p_rating: action === "rate" ? stars : null, p_note: action === "rate" ? note : null,
    });
    setBusy(null);
    if (error || data?.error) { toast.error(data?.error || "Gagal, coba lagi"); return; }
    toast.success(action === "close" ? "Tiket ditutup" : action === "reopen" ? "Tiket dibuka kembali" : "Terima kasih atas rating kamu ⭐");
    onChanged?.();
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card/80 p-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-bold text-foreground">{online ? "🟢 Admin Online" : "⚫ Admin Offline"}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${p.cls}`}>Prioritas {p.label}</span>
        <div className="ml-auto flex gap-1.5">
          {!closed && (
            <button onClick={() => act("close")} disabled={!!busy} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-50">
              {busy === "close" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />} Tutup tiket
            </button>
          )}
          {closed && (
            <button onClick={() => act("reopen")} disabled={!!busy} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-50">
              {busy === "reopen" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Buka kembali
            </button>
          )}
        </div>
      </div>

      {closed && ticket.rating == null && (
        <div className="rounded-xl bg-muted/60 p-2.5">
          <p className="text-[12px] font-semibold text-foreground">Bagaimana pelayanan kami?</p>
          <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label="Rating layanan">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} bintang`} onClick={() => setStars(n)} className="p-0.5">
                <Star className={`h-6 w-6 ${n <= stars ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          {stars > 0 && (
            <div className="mt-2 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Catatan (opsional)"
                className="h-9 flex-1 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
              <button onClick={() => act("rate")} disabled={!!busy} className="rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">
                {busy === "rate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kirim"}
              </button>
            </div>
          )}
        </div>
      )}
      {closed && ticket.rating != null && (
        <p className="text-[11px] text-muted-foreground">Rating kamu: {"⭐".repeat(ticket.rating)}</p>
      )}
    </div>
  );
}

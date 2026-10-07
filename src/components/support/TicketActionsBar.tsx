import { useState } from "react";
import { Star, Loader2, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPresence, formatLastSeen } from "./useAdminOnline";

interface Ticket { id: string; status: string; priority?: string | null; rating?: number | null; closed_at?: string | null; updated_at?: string | null }

const PRIORITY: Record<string, { label: string; cls: string }> = {
  low: { label: "Rendah", cls: "bg-muted text-muted-foreground" },
  normal: { label: "Normal", cls: "bg-secondary text-secondary-foreground" },
  high: { label: "Tinggi", cls: "bg-primary/15 text-primary" },
  urgent: { label: "Darurat", cls: "bg-destructive/15 text-destructive" },
};

export const TICKET_STATUS: Record<string, { label: string; cls: string; active: boolean }> = {
  open: { label: "Terbuka", cls: "bg-primary/15 text-primary", active: true },
  pending: { label: "Menunggu", cls: "bg-secondary text-secondary-foreground", active: true },
  in_progress: { label: "Diproses", cls: "bg-primary/15 text-primary", active: true },
  resolved: { label: "Selesai", cls: "bg-muted text-muted-foreground", active: false },
  closed: { label: "Ditutup", cls: "bg-muted text-muted-foreground", active: false },
};
export const ticketIsClosed = (status?: string | null) => status === "closed" || status === "resolved";

/**
 * Info tiket untuk pengguna: status admin, status & prioritas tiket (hanya admin yang bisa mengubah),
 * rating 1–5 setelah selesai (divalidasi pemilik di server), dan tombol buat tiket baru bila ditutup.
 */
export default function TicketActionsBar({ ticket, ownerId, onChanged, onCreateNew }: {
  ticket: Ticket; ownerId: string; onChanged?: () => void; onCreateNew?: () => void;
}) {
  const { online, lastSeen } = useAdminPresence();
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const closed = ticketIsClosed(ticket.status);
  const p = PRIORITY[ticket.priority || "normal"] || PRIORITY.normal;
  const st = TICKET_STATUS[ticket.status] || { label: ticket.status, cls: "bg-muted text-muted-foreground", active: !closed };

  const rate = async () => {
    if (busy || stars < 1) return;
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC belum ada di tipe hasil generate
    const { data, error } = await (supabase as any).rpc("ticket_user_action", {
      p_ticket_id: ticket.id, p_owner_id: ownerId, p_action: "rate", p_rating: stars, p_note: note,
    });
    setBusy(false);
    if (error || data?.error) { toast.error(data?.error || "Gagal, coba lagi"); return; }
    toast.success("Terima kasih atas rating kamu ⭐");
    onChanged?.();
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card/80 p-2.5 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-bold text-foreground">{online ? "🟢 Admin online" : `⚫ Terakhir dilihat ${formatLastSeen(lastSeen)}`}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>Status {st.label}</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${p.cls}`}>Prioritas {p.label}</span>
      </div>

      {closed && (
        <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-2.5">
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 text-[11.5px] text-muted-foreground">
            <p className="font-semibold text-foreground">Tiket ditutup oleh Admin</p>
            {(ticket.closed_at || ticket.updated_at) && <p>Tanggal: {new Date((ticket.closed_at || ticket.updated_at)!).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
            <p>Masih ada kendala? Buat tiket baru.</p>
          </div>
          {onCreateNew && (
            <button onClick={onCreateNew} className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground">
              <Plus className="h-3 w-3" /> Tiket baru
            </button>
          )}
        </div>
      )}

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
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
              <button onClick={rate} disabled={busy} className="rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kirim"}
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

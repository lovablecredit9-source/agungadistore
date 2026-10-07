import { useTicketUserPresence, presenceLabel } from "./useAdminOnline";

/** Admin: status presence pemilik tiket (terpisah dari status tiket). */
export default function TicketUserPresence({ ticketId }: { ticketId: string }) {
  const p = presenceLabel(useTicketUserPresence(ticketId), "User");
  return <p className="text-[10px] font-semibold text-muted-foreground" aria-live="polite">{p.dot} {p.text}</p>;
}

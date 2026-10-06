import { useCallback, useEffect, useState } from "react";
import { Loader2, UserCheck, StickyNote, Zap, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Ticket { id: string; status: string; priority?: string | null; assigned_admin?: string | null; rating?: number | null; rating_note?: string | null; reopened_count?: number | null }
interface Note { id: string; author: string | null; note: string; created_at: string }
interface Reply { id: string; label: string; message: string; sort_order: number }

const STATUSES = [["open", "Terbuka"], ["pending", "Pending"], ["resolved", "Selesai"], ["closed", "Ditutup"]] as const;
const PRIORITIES = [["low", "Rendah"], ["normal", "Normal"], ["high", "Tinggi"], ["urgent", "Darurat"]] as const;

/** Alat admin per tiket: status, prioritas, ambil tiket, catatan internal, quick reply. */
export default function AdminTicketTools({ ticket, onChanged }: { ticket: Ticket; onChanged?: (t: Partial<Ticket>) => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; label: string; message: string } | null>(null);
  const [me, setMe] = useState("admin");

  const loadNotes = useCallback(async () => {
    const { data } = await (supabase as any).from("ticket_internal_notes").select("*").eq("ticket_id", ticket.id).order("created_at");
    setNotes(data || []);
  }, [ticket.id]);
  const loadReplies = useCallback(async () => {
    const { data } = await (supabase as any).from("ticket_quick_replies").select("*").order("sort_order");
    setReplies(data || []);
  }, []);

  useEffect(() => { void loadNotes(); }, [loadNotes]);
  useEffect(() => {
    void loadReplies();
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.email?.split("@")[0] || "admin"));
  }, [loadReplies]);

  const update = async (patch: Partial<Ticket> & { closed_at?: string | null }) => {
    setBusy(true);
    const { error } = await (supabase as any).from("support_tickets").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    setBusy(false);
    if (error) { toast.error("Gagal menyimpan: " + error.message); return; }
    onChanged?.(patch);
  };

  const setStatus = (s: string) => update({ status: s, closed_at: s === "closed" || s === "resolved" ? new Date().toISOString() : null });

  const addNote = async () => {
    const note = noteText.trim();
    if (!note) return;
    const { error } = await (supabase as any).from("ticket_internal_notes").insert({ ticket_id: ticket.id, note, author: me });
    if (error) { toast.error("Gagal menambah catatan"); return; }
    setNoteText(""); void loadNotes();
  };

  const sendReply = async (r: Reply) => {
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, sender_type: "admin", message: r.message } as any);
    if (error) toast.error("Gagal mengirim"); else toast.success("Quick reply terkirim");
  };

  const saveReply = async () => {
    if (!edit || !edit.label.trim() || !edit.message.trim()) return;
    const row = { label: edit.label.trim(), message: edit.message.trim(), updated_at: new Date().toISOString() };
    const q = edit.id
      ? (supabase as any).from("ticket_quick_replies").update(row).eq("id", edit.id)
      : (supabase as any).from("ticket_quick_replies").insert({ ...row, sort_order: replies.length + 1 });
    const { error } = await q;
    if (error) { toast.error("Gagal menyimpan quick reply"); return; }
    setEdit(null); void loadReplies();
  };
  const delReply = async (id: string) => {
    if (!confirm("Hapus quick reply ini?")) return;
    await (supabase as any).from("ticket_quick_replies").delete().eq("id", id);
    void loadReplies();
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-muted-foreground">Status:</span>
        {STATUSES.map(([v, l]) => (
          <button key={v} disabled={busy} onClick={() => setStatus(v)}
            className={`rounded-full border px-2 py-0.5 font-semibold ${ticket.status === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-muted-foreground">Prioritas:</span>
        {PRIORITIES.map(([v, l]) => (
          <button key={v} disabled={busy} onClick={() => update({ priority: v })}
            className={`rounded-full border px-2 py-0.5 font-semibold ${(ticket.priority || "normal") === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{l}</button>
        ))}
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <UserCheck className="h-3.5 w-3.5 text-primary" />
        <span>Ditangani: <strong>{ticket.assigned_admin || "belum ada"}</strong></span>
        {ticket.assigned_admin !== me && (
          <button onClick={() => update({ assigned_admin: me })} className="rounded-full bg-primary px-2 py-0.5 font-bold text-primary-foreground">Ambil tiket</button>
        )}
        {!!ticket.reopened_count && <span className="text-muted-foreground">· dibuka ulang {ticket.reopened_count}×</span>}
        {ticket.rating != null && <span className="text-muted-foreground">· rating {"⭐".repeat(ticket.rating)} {ticket.rating_note ? `"${ticket.rating_note}"` : ""}</span>}
      </div>

      {/* Quick reply */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold"><Zap className="h-3.5 w-3.5 text-primary" /> Quick Reply</span>
          <button onClick={() => { setManage((m) => !m); setEdit(null); }} className="text-[11px] text-primary">{manage ? "Selesai" : "Kelola"}</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {replies.map((r) => (
            <span key={r.id} className="flex items-center gap-1 rounded-full border border-border bg-muted/50 pl-2.5 pr-1 py-0.5">
              <button onClick={() => !manage && sendReply(r)} title={r.message} className="font-medium">{r.label}</button>
              {manage && (
                <>
                  <button aria-label="Ubah" onClick={() => setEdit({ id: r.id, label: r.label, message: r.message })} className="p-0.5"><Pencil className="h-3 w-3" /></button>
                  <button aria-label="Hapus" onClick={() => delReply(r.id)} className="p-0.5 text-destructive"><Trash2 className="h-3 w-3" /></button>
                </>
              )}
            </span>
          ))}
          {manage && !edit && (
            <button onClick={() => setEdit({ label: "", message: "" })} className="flex items-center gap-1 rounded-full border border-dashed border-primary px-2 py-0.5 text-primary"><Plus className="h-3 w-3" /> Tambah</button>
          )}
        </div>
        {edit && (
          <div className="mt-2 space-y-1.5 rounded-lg border border-border p-2">
            <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="Label singkat" className="h-8 w-full rounded-md border border-border bg-background px-2" />
            <textarea value={edit.message} onChange={(e) => setEdit({ ...edit, message: e.target.value })} placeholder="Isi pesan" rows={2} className="w-full rounded-md border border-border bg-background px-2 py-1" />
            <div className="flex justify-end gap-1.5">
              <button onClick={() => setEdit(null)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1"><X className="h-3 w-3" /> Batal</button>
              <button onClick={saveReply} className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-bold text-primary-foreground"><Check className="h-3 w-3" /> Simpan</button>
            </div>
          </div>
        )}
      </div>

      {/* Catatan internal */}
      <div>
        <p className="mb-1 flex items-center gap-1 font-semibold"><StickyNote className="h-3.5 w-3.5 text-primary" /> Catatan internal <span className="font-normal text-muted-foreground">(tidak terlihat pengguna)</span></p>
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {notes.length === 0 && <p className="text-muted-foreground">Belum ada catatan.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-md bg-muted/60 px-2 py-1">
              <span className="font-semibold">{n.author || "admin"}</span> · <span className="text-muted-foreground">{new Date(n.created_at).toLocaleString("id-ID")}</span>
              <p className="whitespace-pre-wrap">{n.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Tulis catatan…"
            className="h-8 flex-1 rounded-md border border-border bg-background px-2" />
          <button onClick={addNote} className="rounded-md bg-primary px-3 font-bold text-primary-foreground">Simpan</button>
        </div>
      </div>
    </div>
  );
}

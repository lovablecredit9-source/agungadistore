import { useCallback, useEffect, useState } from "react";
import { Heart, Loader2, Search, Sparkles, StickyNote, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ACTIVITY_STATUS_META, INTERESTS, addFavorite, fetchConnectHistory, fetchFavorites,
  fetchInterestMatches, fetchSocial, noteIsActive, removeFavorite, saveSocial, toggleFavorite,
  type ActivityStatus, type FavoriteRow, type SocialRow,
} from "@/lib/social-account";

interface Props { visitorId: string }

const NOTE_DURATIONS = [
  { label: "1 jam", hours: 1 },
  { label: "6 jam", hours: 6 },
  { label: "24 jam", hours: 24 },
  { label: "Tanpa batas", hours: 0 },
];

export default function SocialPanel({ visitorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [social, setSocial] = useState<SocialRow | null>(null);
  const [favs, setFavs] = useState<FavoriteRow[]>([]);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof fetchConnectHistory>>>([]);
  const [matches, setMatches] = useState<Awaited<ReturnType<typeof fetchInterestMatches>>>([]);
  const [note, setNote] = useState("");
  const [noteHours, setNoteHours] = useState(24);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const s = await fetchSocial(visitorId);
    setSocial(s);
    setNote(noteIsActive(s) ? s.note || "" : "");
    const [f, h, m] = await Promise.all([
      fetchFavorites(visitorId),
      fetchConnectHistory(visitorId),
      fetchInterestMatches(visitorId, s.interests || []),
    ]);
    setFavs(f); setHistory(h); setMatches(m);
    setLoading(false);
  }, [visitorId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const patch = async (p: Partial<SocialRow>) => {
    if (!social) return;
    const next = { ...social, ...p };
    setSocial(next);
    await saveSocial(visitorId, p);
  };

  const toggleInterest = async (name: string) => {
    if (!social) return;
    const cur = social.interests || [];
    const next = cur.includes(name) ? cur.filter((i) => i !== name) : [...cur, name];
    await patch({ interests: next });
    setMatches(await fetchInterestMatches(visitorId, next));
  };

  const saveNote = async () => {
    const expires = noteHours > 0 ? new Date(Date.now() + noteHours * 3600_000).toISOString() : null;
    await patch({ note: note.trim() || null, note_expires_at: note.trim() ? expires : null });
    toast.success(note.trim() ? "Catatan profil disimpan" : "Catatan dihapus");
  };

  const add = async () => {
    if (!newId.trim()) { toast.error("Isi ID pengguna"); return; }
    if (newId.trim() === visitorId) { toast.error("Tidak bisa menambah diri sendiri"); return; }
    setBusy(true);
    try {
      await addFavorite(visitorId, newId.trim(), newName.trim());
      setNewId(""); setNewName("");
      setFavs(await fetchFavorites(visitorId));
      toast.success("Ditambahkan ke daftar teman");
    } catch (e: any) {
      toast.error(e?.message || "Gagal menambahkan");
    } finally { setBusy(false); }
  };

  if (loading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>;

  const filtered = favs.filter((f) =>
    !q.trim() || (f.display_name || f.target_visitor_id).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Status aktivitas */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Status aktivitas</h3>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ACTIVITY_STATUS_META) as ActivityStatus[]).map((k) => {
            const m = ACTIVITY_STATUS_META[k];
            const on = social?.activity_status === k;
            return (
              <button key={k} onClick={() => patch({ activity_status: k })}
                className={`text-left rounded-xl border p-3 transition ${on ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`} /> {m.label}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Catatan profil sementara */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><StickyNote className="w-4 h-4 text-primary" /> Catatan profil sementara</h3>
        <Input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: Lagi cari teman ngobrol 👋" />
        <div className="flex flex-wrap gap-2 mt-2">
          {NOTE_DURATIONS.map((d) => (
            <button key={d.label} onClick={() => setNoteHours(d.hours)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${noteHours === d.hours ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              {d.label}
            </button>
          ))}
        </div>
        <Button size="sm" className="mt-3 w-full" onClick={saveNote}>Simpan catatan</Button>
        {social && noteIsActive(social) && social.note_expires_at && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Berlaku sampai {new Date(social.note_expires_at).toLocaleString("id-ID")}
          </p>
        )}
      </section>

      {/* Minat */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-primary" /> Minat kamu</h3>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = social?.interests?.includes(i);
            return (
              <button key={i} onClick={() => toggleInterest(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted/50"}`}>
                {i}
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <h4 className="text-xs font-bold text-muted-foreground mb-2">Rekomendasi partner minat serupa</h4>
          {matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada rekomendasi. Pilih beberapa minat dulu.</p>
          ) : (
            <div className="space-y-2">
              {matches.map((m) => (
                <div key={m.visitorId} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
                  <span className={`w-2 h-2 rounded-full ${ACTIVITY_STATUS_META[m.status]?.dot || "bg-slate-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">#{m.visitorId.slice(0, 6).toUpperCase()}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.shared.join(" • ")}</div>
                  </div>
                  <Button size="sm" variant="secondary" className="h-7 text-[11px]"
                    onClick={async () => { await addFavorite(visitorId, m.visitorId, `#${m.visitorId.slice(0, 6).toUpperCase()}`); setFavs(await fetchFavorites(visitorId)); toast.success("Ditambahkan"); }}>
                    Tambah
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Teman & favorit */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Teman & favorit</h3>
        <div className="flex gap-2">
          <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="ID pengguna" className="flex-1" />
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama" className="w-28" />
          <Button size="icon" onClick={add} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari teman…" className="pl-9" />
        </div>
        <div className="mt-3 space-y-2">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground">Belum ada teman tersimpan.</p>}
          {filtered.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{f.display_name || `#${f.target_visitor_id.slice(0, 6).toUpperCase()}`}</div>
                <div className="text-[10px] text-muted-foreground truncate">{f.target_visitor_id.slice(0, 12)}…</div>
              </div>
              <button aria-label="Favoritkan" onClick={async () => { await toggleFavorite(f.id, !f.is_favorite); setFavs(await fetchFavorites(visitorId)); }}>
                <Heart className={`w-4 h-4 ${f.is_favorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
              </button>
              <button aria-label="Hapus" onClick={async () => { await removeFavorite(f.id); setFavs(await fetchFavorites(visitorId)); }}>
                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Riwayat terhubung */}
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-bold mb-3">Riwayat pengguna terhubung</h3>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada riwayat.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{h.partner_nickname || `#${(h.partner_visitor || "").slice(0, 6).toUpperCase()}`}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString("id-ID")}</div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                  onClick={async () => { await addFavorite(visitorId, h.partner_visitor, h.partner_nickname || ""); setFavs(await fetchFavorites(visitorId)); toast.success("Disimpan ke teman"); }}>
                  Simpan
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

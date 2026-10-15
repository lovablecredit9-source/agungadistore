import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, KeyRound, Loader2, Pencil, PlugZap, Plus, RefreshCw, Trash2, X, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { apkApi } from "./api";

export type KeyColor = "green" | "yellow" | "red" | "grey" | "error";
export type ApiKeyItem = {
  id: string; label: string; masked: string; enabled: boolean; priority: number; status: string; status_message: string | null;
  quota_limit: number | null; quota_limit_source: string | null; quota_checked_at: string | null; exhausted_until: string | null;
  total_used: number; last_used_at: string | null; last_error_at: string | null; created_at: string;
  view: { state: string; usable: boolean; usedToday: number; limit: number | null; remaining: number | null; remainingSource: "provider" | "estimate" | null; pct: number | null; color: KeyColor; label: string };
};
export type KeySummary = { total: number; enabled: number; usable: number; exhausted: number; invalid: number; activeRemaining: number | null; activeRemainingKnownKeys: number; activeRemainingFromProviderOnly: boolean; usedToday: number };
export type KeysState = { keys: ApiKeyItem[]; summary: KeySummary; next_reset: string };

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-");
const COLOR: Record<KeyColor, { bar: string; dot: string; text: string }> = {
  green: { bar: "bg-success", dot: "bg-success", text: "text-success" },
  yellow: { bar: "bg-warning", dot: "bg-warning", text: "text-warning" },
  red: { bar: "bg-destructive", dot: "bg-destructive", text: "text-destructive" },
  grey: { bar: "bg-muted-foreground/40", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  error: { bar: "bg-destructive", dot: "bg-destructive ring-2 ring-destructive/40", text: "text-destructive" },
};
const LIMIT_SRC: Record<string, string> = { provider_message: "dari pesan provider", provider_header: "dari header provider", admin: "diatur admin" };

type Confirm = { title: string; body: string; run: () => Promise<void> } | null;

export default function ApiKeysPanel({ initial, mode, onModeChange, onChanged }: {
  initial: KeysState; mode: "auto" | "priority"; onModeChange: (m: "auto" | "priority") => Promise<void>; onChanged?: () => void;
}) {
  const [st, setSt] = useState<KeysState>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editLimit, setEditLimit] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);

  useEffect(() => setSt(initial), [initial]);

  const call = useCallback(async (label: string, body: Record<string, unknown>, success?: string) => {
    setBusy(label);
    const r = await apkApi<KeysState & { ok: boolean; message?: string; used_key?: string | null; attempts?: number }>(body);
    setBusy(null);
    if (r.keys) setSt({ keys: r.keys, summary: r.summary, next_reset: r.next_reset });
    if (r.error && !r.keys) { toast.error(r.error); return null; }
    if (success) toast.success(success);
    onChanged?.();
    return r;
  }, [onChanged]);

  // Auto refresh so colours follow quota changes made by live requests.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await apkApi<KeysState>({ action: "admin_keys" });
      if (r.keys) setSt({ keys: r.keys, summary: r.summary, next_reset: r.next_reset });
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const add = async () => {
    const r = await call("add", { action: "admin_key_add", label: newLabel.trim() || `API Key ${st.keys.length + 1}`, api_key: newKey }, "API key ditambahkan");
    if (r) { setNewKey(""); setNewLabel(""); }
  };
  const startEdit = (k: ApiKeyItem) => {
    setEditing(k.id); setEditLabel(k.label); setEditKey("");
    setEditLimit(k.quota_limit_source === "admin" && k.quota_limit != null ? String(k.quota_limit) : "");
  };
  const saveEdit = async (k: ApiKeyItem) => {
    const body: Record<string, unknown> = { action: "admin_key_update", id: k.id };
    if (editLabel.trim() !== k.label) body.label = editLabel.trim();
    if (editKey.trim()) body.api_key = editKey.trim();
    const wasAdmin = k.quota_limit_source === "admin";
    if (editLimit.trim()) body.quota_limit = Number(editLimit);
    else if (wasAdmin) body.quota_limit = null;
    const r = await call(`edit:${k.id}`, body, "Perubahan disimpan");
    if (r) { setEditing(null); setEditKey(""); }
  };
  const move = async (idx: number, dir: -1 | 1) => {
    const ids = st.keys.map((k) => k.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await call("reorder", { action: "admin_key_reorder", ids });
  };

  const s = st.summary;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4" aria-labelledby="apk-keys">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="apk-keys" className="font-bold text-foreground flex items-center gap-2"><KeyRound className="h-4 w-4" />API Key ({s.total})</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={!!busy || !s.usable} onClick={() => void call("test", { action: "admin_test" }).then((r) => r && (r.ok ? toast.success : toast.error)(`${r.message}${r.used_key ? ` • key: ${r.used_key}` : ""}`))} className="gap-1">
            {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}Uji rotasi
          </Button>
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void call("refresh", { action: "admin_keys" })} className="gap-1"><RefreshCw className="h-3.5 w-3.5" />Segarkan</Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
        {[
          ["Total key", s.total], ["Key aktif", s.enabled], ["Bisa dipakai", s.usable], ["Habis kuota", s.exhausted],
          ["Sisa kuota aktif", s.activeRemaining == null ? "Belum diketahui" : `${s.activeRemaining.toLocaleString("id-ID")} kredit`],
          ["Dipakai hari ini", `${s.usedToday.toLocaleString("id-ID")} req`],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl bg-muted px-2 py-2">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="text-sm font-bold text-foreground break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-muted-foreground">
        Sisa kuota aktif hanya menjumlahkan key aktif yang kuotanya diketahui ({s.activeRemainingKnownKeys} dari {s.enabled} key aktif)
        {s.activeRemaining != null && !s.activeRemainingFromProviderOnly ? " — sebagian berupa estimasi dari pemakaian lewat website ini" : ""}.
        Provider tidak menyediakan endpoint cek kuota; batas diketahui dari pesan “Limit … request/hari” saat kuota habis, header provider bila ada, atau diisi admin.
        Hitungan harian direset 00:00 WIB (berikutnya {fmt(st.next_reset)}).
      </p>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
        <span className="text-xs font-semibold text-foreground">Mode pemilihan:</span>
        {(["auto", "priority"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="radio" name="apk-mode" checked={mode === m} disabled={!!busy} onChange={() => void onModeChange(m)} className="accent-primary" />
            {m === "auto" ? "Auto Rotate (key aktif dengan pemakaian hari ini paling sedikit)" : "Prioritas Berurutan (selalu key teratas yang masih bisa)"}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!busy || !st.keys.length} onClick={() => setConfirm({ title: "Aktifkan semua API key?", body: "Semua key akan boleh dipilih sistem lagi (kecuali yang tidak valid atau kuotanya habis).", run: async () => { await call("bulk", { action: "admin_keys_bulk_enable", enabled: true }, "Semua key diaktifkan"); } })}>Aktifkan semua</Button>
        <Button size="sm" variant="outline" disabled={!!busy || !st.keys.length} onClick={() => setConfirm({ title: "Nonaktifkan semua API key?", body: "Semua fitur APK PREMIUM akan berhenti sampai ada key yang diaktifkan lagi.", run: async () => { await call("bulk", { action: "admin_keys_bulk_enable", enabled: false }, "Semua key dinonaktifkan"); } })}>Nonaktifkan semua</Button>
      </div>

      <ul className="space-y-2">
        {st.keys.map((k, i) => {
          const c = COLOR[k.view.color];
          const isEdit = editing === k.id;
          return (
            <li key={k.id} className="rounded-xl border border-border p-3 space-y-2" data-testid="apk-key-row">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer">
                  <Checkbox checked={k.enabled} disabled={!!busy} onCheckedChange={(v) => void call(`en:${k.id}`, { action: "admin_key_update", id: k.id, enabled: v === true }, v === true ? "Key diaktifkan" : "Key dinonaktifkan")} aria-label={`Aktifkan ${k.label}`} />
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>{k.label}
                </label>
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{k.masked}</code>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${c.text}`}><span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />{k.view.label}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!!busy || i === 0} onClick={() => void move(i, -1)} aria-label="Naikkan prioritas"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!!busy || i === st.keys.length - 1} onClick={() => void move(i, 1)} aria-label="Turunkan prioritas"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!!busy} onClick={() => (isEdit ? setEditing(null) : startEdit(k))} aria-label={isEdit ? "Tutup edit" : `Edit ${k.label}`}>{isEdit ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}</Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!!busy} onClick={() => void call(`t:${k.id}`, { action: "admin_key_test", id: k.id }).then((r) => r && (r.ok ? toast.success : toast.error)(r.message ?? ""))} aria-label={`Periksa ${k.label}`}>
                    {busy === `t:${k.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={!!busy} onClick={() => setConfirm({ title: `Hapus ${k.label}?`, body: `Key ${k.masked} akan dihapus permanen dari server. Tindakan ini tidak bisa dibatalkan.`, run: async () => { await call(`del:${k.id}`, { action: "admin_key_delete", id: k.id }, "Key dihapus"); } })} aria-label={`Hapus ${k.label}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Sisa kuota ${k.label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={k.view.pct ?? undefined}>
                  <div className={`h-full ${c.bar} transition-all`} style={{ width: `${k.view.pct ?? (k.view.color === "grey" ? 100 : 0)}%`, opacity: k.view.pct == null ? 0.35 : 1 }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>Sisa: <b className="text-foreground">{k.view.remaining == null ? "Belum diketahui" : `${k.view.remaining}${k.view.pct != null ? ` (${k.view.pct}%)` : ""}`}</b>{k.view.remainingSource === "estimate" ? " • estimasi" : k.view.remainingSource === "provider" ? " • provider" : ""}</span>
                  <span>Kuota maks: <b className="text-foreground">{k.view.limit ?? "Belum diketahui"}</b>{k.quota_limit_source ? ` (${LIMIT_SRC[k.quota_limit_source] ?? k.quota_limit_source})` : ""}</span>
                  <span>Dipakai hari ini: <b className="text-foreground">{k.view.usedToday}</b> • total {k.total_used}</span>
                  <span>Terakhir dipakai: {fmt(k.last_used_at)}</span>
                </div>
                {k.status_message && <p className="text-[11px] text-muted-foreground break-words">Status terakhir: {k.status_message}{k.exhausted_until && k.view.state === "exhausted" ? ` • dicoba lagi setelah ${fmt(k.exhausted_until)}` : ""}</p>}
              </div>

              {isEdit && (
                <div className="grid gap-2 sm:grid-cols-3 rounded-lg bg-muted/60 p-2">
                  <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} maxLength={60} placeholder="Label" aria-label="Label key" />
                  <Input type="password" autoComplete="off" value={editKey} onChange={(e) => setEditKey(e.target.value)} placeholder="Key baru (kosongkan bila tidak diganti)" aria-label="Ganti API key" />
                  <Input type="number" min={1} value={editLimit} onChange={(e) => setEditLimit(e.target.value)} placeholder={k.quota_limit_source && k.quota_limit_source !== "admin" ? `Kuota maks (${k.quota_limit} ${LIMIT_SRC[k.quota_limit_source]})` : "Kuota maks/hari (opsional)"} aria-label="Kuota maksimum per hari" />
                  <div className="sm:col-span-3 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
                    <Button size="sm" disabled={!!busy || !editLabel.trim()} onClick={() => void saveEdit(k)} className="gap-1">{busy === `edit:${k.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Simpan</Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {!st.keys.length && <li className="text-xs text-muted-foreground">Belum ada API key. Tambahkan minimal satu agar fitur APK PREMIUM bisa dipakai.</li>}
      </ul>

      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">Tambah API key</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={60} placeholder={`API Key ${st.keys.length + 1}`} aria-label="Label key baru" />
          <div className="relative">
            <Input type={showNew ? "text" : "password"} autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Tempel API key" className="pr-9" aria-label="API key baru" />
            <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? "Sembunyikan" : "Tampilkan"} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">{showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <Button disabled={!!busy || !newKey.trim()} onClick={() => void add()} className="gap-1">{busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Tambah</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Key disimpan terenkripsi di server. Setelah disimpan hanya 4 karakter terakhir yang ditampilkan.</p>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const c = confirm; setConfirm(null); if (c) void c.run(); }}>Ya, lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

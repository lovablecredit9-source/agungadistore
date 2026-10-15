import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, RefreshCw, Search, Power, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import FeatureRunner from "./FeatureRunner";
import ApiKeysPanel, { type KeysState } from "./ApiKeysPanel";
import { apkApi, CAT_ORDER, type ApkParam } from "./api";

type Provider = { name: string; base_url: string; enabled: boolean; rotation_mode: "auto" | "priority"; last_check_at: string | null; last_check_ok: boolean | null; last_check_message: string | null; updated_at: string };
type AdminFeature = { id: string; cat: string; path: string; method: "GET" | "POST"; form: boolean; fileField: string | null; label: string; help: string; sources: string[]; params: ApkParam[]; unsupported?: string; enabled: boolean; hidden: boolean };
type AdminState = KeysState & {
  provider: Provider | null; categories: Record<string, string>; hidden_categories: string[]; features: AdminFeature[];
  excluded: { path: string; file: string; reason: string }[]; stats: Record<string, { ok: number; fail: number }>;
  recent: { feature_id: string; status: string; http_status: number | null; latency_ms: number | null; error: string | null; created_at: string }[];
};
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-");

export default function AdminApkPremiumTab() {
  const [st, setSt] = useState<AdminState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [catF, setCatF] = useState("all");
  const [testing, setTesting] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);

  const load = async () => {
    setErr(null);
    const r = await apkApi<AdminState>({ action: "admin_get" });
    if (r.error || !r.features) { setErr(r.error || "Gagal memuat"); return; }
    setSt(r); setBase(r.provider?.base_url ?? "");
  };
  useEffect(() => { void load(); }, []);

  const save = async (patch: Record<string, unknown>, label: string) => {
    setBusy(label);
    const r = await apkApi<{ ok: boolean; provider: Provider }>({ action: "admin_save_provider", ...patch });
    setBusy(null);
    if (r.error) { toast.error(r.error); return; }
    toast.success("Tersimpan");
    setSt((s) => (s ? { ...s, provider: r.provider } : s));
  };
  const setFeature = async (id: string, patch: { enabled?: boolean; hidden?: boolean }) => {
    setSt((s) => (s ? { ...s, features: s.features.map((f) => (f.id === id ? { ...f, ...patch } : f)) } : s));
    const r = await apkApi({ action: "admin_set_feature", feature_id: id, ...patch });
    if (r.error) { toast.error(r.error); void load(); }
  };
  const setCategory = async (category: string, hidden: boolean) => {
    setSt((s) => (s ? { ...s, hidden_categories: hidden ? [...s.hidden_categories, category] : s.hidden_categories.filter((c) => c !== category) } : s));
    const r = await apkApi({ action: "admin_set_category", category, hidden });
    if (r.error) { toast.error(r.error); void load(); }
  };

  const cats = useMemo(() => {
    const present = new Set((st?.features ?? []).map((f) => f.cat));
    return [...CAT_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !CAT_ORDER.includes(c))];
  }, [st]);
  const keysInitial = useMemo(() => (st ? { keys: st.keys, summary: st.summary, next_reset: st.next_reset } : null), [st?.keys, st?.summary, st?.next_reset]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (st?.features ?? []).filter((f) => (catF === "all" || f.cat === catF) && (!s || `${f.label} ${f.id} ${f.path} ${f.sources.join(" ")}`.toLowerCase().includes(s)));
  }, [st, q, catF]);

  if (err) return <div className="p-4 text-sm text-destructive flex items-center gap-2">{err}<Button size="sm" variant="outline" onClick={() => void load()}>Coba lagi</Button></div>;
  if (!st) return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Memuat…</div>;
  const p = st.provider;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-labelledby="apk-prov">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="apk-prov" className="font-bold text-foreground">Provider: {p?.name ?? "JereAPI"}</h2>
          <div className="flex items-center gap-2 text-sm">
            <Power className="h-4 w-4 text-muted-foreground" /><span>{p?.enabled ? "Aktif" : "Nonaktif"}</span>
            <Switch checked={!!p?.enabled} disabled={!!busy || !st.keys.length} onCheckedChange={(v) => void save({ enabled: v }, "toggle")} aria-label="Aktifkan provider" />
          </div>
        </div>
        <div className="grid gap-3">
          <div className="space-y-1">
            <label htmlFor="apk-base" className="text-xs font-medium text-muted-foreground">API Base URL (https)</label>
            <div className="flex gap-2">
              <Input id="apk-base" value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://api.jerexd.my.id" />
              <Button variant="outline" disabled={!!busy || base === p?.base_url} onClick={() => void save({ base_url: base }, "base")} className="gap-1">
                {busy === "base" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Simpan
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} className="gap-1"><RefreshCw className="h-3.5 w-3.5" />Muat ulang</Button>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2 text-xs">
          <p><b>Uji rotasi terakhir:</b> {p?.last_check_ok == null ? "Belum pernah diuji" : p.last_check_ok ? "Berhasil" : "Gagal"} • {fmt(p?.last_check_at ?? null)}</p>
          {p?.last_check_message && <p className="text-muted-foreground break-words">{p.last_check_message}</p>}
        </div>
      </section>

      <ApiKeysPanel
        initial={keysInitial!}
        mode={p?.rotation_mode ?? "auto"}
        onModeChange={(m) => save({ rotation_mode: m }, "mode")}
      />

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-labelledby="apk-cats">
        <h2 id="apk-cats" className="font-bold text-foreground">Visibilitas kategori</h2>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => {
            const hidden = st.hidden_categories.includes(c);
            return (
              <label key={c} className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
                <Switch checked={!hidden} onCheckedChange={(v) => void setCategory(c, !v)} aria-label={`Tampilkan ${c}`} />
                {st.categories[c] ?? c} ({st.features.filter((f) => f.cat === c).length})
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-labelledby="apk-feat">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="apk-feat" className="font-bold text-foreground">Katalog endpoint ({st.features.length})</h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari fitur / path / plugin" className="pl-8 h-9" aria-label="Cari endpoint" />
            </div>
            <select value={catF} onChange={(e) => setCatF(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" aria-label="Filter kategori">
              <option value="all">Semua</option>
              {cats.map((c) => <option key={c} value={c}>{st.categories[c] ?? c}</option>)}
            </select>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {list.map((f) => {
            const s = st.stats[f.id];
            return (
              <li key={f.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{f.label}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{f.method} {f.path}</code>
                  {f.form && <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">upload: {f.fileField}</span>}
                  {f.unsupported && <span className="text-[10px] rounded bg-destructive/15 text-destructive px-1.5 py-0.5">Tidak didukung web</span>}
                  {s && <span className="text-[10px] text-muted-foreground">24 jam: {s.ok} ok / {s.fail} gagal</span>}
                  <div className="ml-auto flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1">Aktif<Switch checked={f.enabled} onCheckedChange={(v) => void setFeature(f.id, { enabled: v })} aria-label={`Aktifkan ${f.label}`} /></label>
                    <label className="flex items-center gap-1">Tampil<Switch checked={!f.hidden} onCheckedChange={(v) => void setFeature(f.id, { hidden: !v })} aria-label={`Tampilkan ${f.label}`} /></label>
                    {!f.unsupported && <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setTesting(testing === f.id ? null : f.id)}>{testing === f.id ? "Tutup" : "Uji"}</Button>}
                  </div>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground break-words">
                  Parameter: {f.params.length ? f.params.map((x) => `${x.key}${x.required && x.default == null ? "*" : ""}${x.default ? `=${x.default}` : ""}`).join(", ") : "-"} • Sumber: {f.sources.join(", ")}
                  {f.unsupported ? ` • ${f.unsupported}` : ""}
                </p>
                {testing === f.id && <div className="mt-2 rounded-xl border border-border p-3"><FeatureRunner feature={f} admin submitLabel="Uji live" /></div>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <button type="button" onClick={() => setShowExcluded((v) => !v)} className="flex w-full items-center justify-between font-bold text-foreground">
          Tidak dipindahkan dari source ({st.excluded.length}) {showExcluded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showExcluded && (
          <ul className="space-y-1 text-xs">
            {st.excluded.map((x, i) => <li key={i} className="break-words"><code>{x.path}</code> — {x.reason} <span className="text-muted-foreground">({x.file})</span></li>)}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <h2 className="font-bold text-foreground">Log 24 jam terakhir</h2>
        {!st.recent.length ? <p className="text-xs text-muted-foreground">Belum ada permintaan.</p> : (
          <ul className="space-y-1 text-xs">
            {st.recent.map((l, i) => (
              <li key={i} className="flex flex-wrap gap-2">
                <span className="text-muted-foreground">{fmt(l.created_at)}</span><code>{l.feature_id}</code>
                <span className={l.status === "ok" ? "text-primary" : "text-destructive"}>{l.status}</span>
                {l.http_status != null && <span>HTTP {l.http_status}</span>}{l.latency_ms != null && <span>{l.latency_ms} ms</span>}
                {l.error && <span className="text-muted-foreground break-all">{l.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

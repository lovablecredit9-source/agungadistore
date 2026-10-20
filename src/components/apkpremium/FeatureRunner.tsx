import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Play, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ResultView from "./ResultView";
import { ACCEPT_INPUT, apkApi, fileToPayload, PARAM_LABEL, type ApkParam, type NormItem, type RunResult } from "./api";

type Feature = { id: string; label: string; params: ApkParam[]; fileField: string | null; form: boolean; available?: boolean; reason?: string | null; accept?: string | null; fileOptional?: boolean };

/** Validates locally with the same rules the server re-checks. */
function localCheck(params: ApkParam[], values: Record<string, string>): string | null {
  for (const p of params) {
    const v = (values[p.key] ?? "").trim();
    if (!v) { if (p.required && p.default == null) return `${PARAM_LABEL[p.key] ?? p.key} wajib diisi`; continue; }
    if (p.type === "url") { try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) return "URL harus http/https"; } catch { return `${PARAM_LABEL[p.key] ?? p.key} harus URL lengkap (https://...)`; } }
    if (p.type === "number" && !/^-?\d+(\.\d+)?$/.test(v)) return `${PARAM_LABEL[p.key] ?? p.key} harus angka`;
  }
  return null;
}

export default function FeatureRunner({
  feature, admin = false, initial, submitLabel = "Jalankan", itemActions, autoRunKey, onResult, onPlayAudio,
}: { feature: Feature; admin?: boolean; initial?: Record<string, string>; submitLabel?: string; itemActions?: (it: NormItem) => ReactNode; autoRunKey?: number; onResult?: (values: Record<string, string>, result: RunResult) => void; onPlayAudio?: (url: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(initial ?? {}) }));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const disabled = !admin && feature.available === false;

  useEffect(() => { if (initial) setValues((v) => ({ ...v, ...initial })); }, [initial]);
  useEffect(() => () => ctl.current?.abort(), []);

  const run = async (override?: Record<string, string>) => {
    if (busy || disabled) return;
    const vals = override ?? values;
    const urlField = feature.params.some((p) => /^(url|urls|audio_url)$/.test(p.key));
    const e = localCheck(feature.params, vals) || (feature.form && feature.fileField && !file && !(feature.fileOptional && !urlField) && !(feature.fileOptional && feature.params.some((p) => /^(url|urls|audio_url)$/.test(p.key) && (vals[p.key] ?? "").trim())) ? (feature.fileOptional ? "Pilih file atau isi Link / URL" : "Pilih file terlebih dahulu") : null);
    if (e) { setErr(e); return; }
    setErr(null); setBusy(true); setResult(null);
    ctl.current = new AbortController();
    try {
      const payload: Record<string, unknown> = { action: admin ? "admin_run" : "run", feature_id: feature.id, params: vals };
      if (feature.form && feature.fileField && file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran file maksimal 5 MB");
        payload.file = await fileToPayload(file);
      }
      const r = await apkApi<RunResult>(payload, ctl.current.signal);
      if (ctl.current.signal.aborted) return;
      const final = r.error && !r.normalized ? { ok: false, error: r.error, code: r.code } : r;
      setResult(final);
      onResult?.(vals, final);
    } catch (x) {
      if (!ctl.current?.signal.aborted) {
        const final = { ok: false, error: (x as Error).message || "Permintaan gagal" };
        setResult(final);
        onResult?.(vals, final);
      }
    } finally {
      setBusy(false);
    }
  };

  // Lets parents trigger a run after prefilling (e.g. "MP3" on a search result).
  const lastAuto = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (autoRunKey && autoRunKey !== lastAuto.current) { lastAuto.current = autoRunKey; void run({ ...values, ...(initial ?? {}) }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunKey]);

  return (
    <div className="space-y-3">
      <form className="space-y-2.5" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        {feature.params.map((p) => {
          const id = `apk-${feature.id}-${p.key}`;
          const label = `${PARAM_LABEL[p.key] ?? p.key}${p.required && p.default == null ? " *" : ""}`;
          const common = {
            id, value: values[p.key] ?? "", disabled: busy || disabled,
            placeholder: p.default ? `Default: ${p.default}` : p.type === "url" ? "https://..." : "",
            onChange: (ev: { target: { value: string } }) => setValues((v) => ({ ...v, [p.key]: ev.target.value })),
          };
          return (
            <div key={p.key} className="space-y-1">
              <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
              {p.options?.length
                ? <select id={id} value={values[p.key] || p.default || ""} disabled={busy || disabled} onChange={(ev) => setValues((v) => ({ ...v, [p.key]: ev.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {p.default == null && <option value="" disabled>Pilih…</option>}
                    {p.options.map((o) => <option key={o} value={o}>{p.key === "quality" ? `${o}p` : o}</option>)}
                  </select>
                : p.type === "textarea"
                ? <Textarea {...common} rows={3} maxLength={4000} />
                : <Input {...common} type={p.type === "number" ? "number" : p.type === "url" ? "url" : "text"} inputMode={p.type === "number" ? "numeric" : undefined} maxLength={p.type === "url" ? 2048 : 4000} />}
              {p.hint && <p className="text-[11px] leading-snug text-muted-foreground">{p.hint}</p>}
            </div>
          );
        })}
        {feature.form && feature.fileField && (
          <div className="space-y-1">
            <label htmlFor={`apk-${feature.id}-file`} className="text-xs font-medium text-muted-foreground">File ({(ACCEPT_INPUT[feature.accept ?? "media"] ?? ACCEPT_INPUT.media).label}, maks 5 MB){feature.fileOptional ? (feature.params.some((p) => /^(url|urls|audio_url)$/.test(p.key)) ? " — atau isi Link / URL" : " — opsional") : " *"}</label>
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm cursor-pointer">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "Pilih file"}</span>
              <input id={`apk-${feature.id}-file`} type="file" accept={(ACCEPT_INPUT[feature.accept ?? "media"] ?? ACCEPT_INPUT.media).input} className="sr-only" disabled={busy || disabled} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}
        {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
        {disabled && feature.reason && <p className="text-xs text-muted-foreground">Belum tersedia: {feature.reason}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || disabled} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{busy ? "Memproses…" : submitLabel}
          </Button>
          {busy && (
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => { ctl.current?.abort(); setBusy(false); setResult({ ok: false, error: "Dibatalkan" }); }}>
              <Square className="h-4 w-4" />Batal
            </Button>
          )}
        </div>
      </form>
      {result && <ResultView result={result} itemActions={itemActions} onPlayAudio={onPlayAudio} />}
    </div>
  );
}

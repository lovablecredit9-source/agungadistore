import { useState } from "react";
import { Bot, Loader2, CheckCircle2, Circle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { botApi } from "./api";

type Feature = { name: string; kind: string; file?: string; status: string; reason?: string; alternative?: string };
type Failure = { stage: string; reason: string; file?: string; dependency?: string; tried: string[]; next: string[] };
const TONE: Record<string, string> = {
  PRESERVED: "text-emerald-400", COMPATIBLE: "text-emerald-400", ADAPTED: "text-amber-400", REPLACED: "text-sky-400", UNSUPPORTED: "text-destructive", "NOT COMPATIBLE": "text-destructive",
  SUPPORTED: "text-emerald-400", ADAPTABLE: "text-amber-400", REPLACEABLE: "text-sky-400", OPTIONAL: "text-muted-foreground",
};
const COMPAT: Record<string, string> = { FULLY_ADAPTABLE: "✅ FULLY ADAPTABLE", ADAPTABLE_WITH_CHANGES: "🟡 ADAPTABLE WITH CHANGES", NOT_ADAPTABLE: "❌ NOT ADAPTABLE" };
const STAGES = ["ANALYZING SOURCE", "MAPPING PROJECT", "ANALYZING DEPENDENCIES", "ANALYZING HANDLERS", "AI ADAPTATION", "VALIDATING", "CREATING VERSION", "READY"];

/** Universal AI Bot Adapter. Every number shown comes from the server's source scan or the stored AI version. */
export default function AiAdapterCard({ visitorId, bot, versions, onDone }: { visitorId: string; bot: any; versions: any[]; onDone: () => void }) {
  const { toast } = useToast();
  const originals = versions.filter((v) => !v.compat_report?.ai_adapted);
  const adapted = versions.filter((v) => v.compat_report?.ai_adapted);
  const [src, setSrc] = useState<number | null>(originals[0]?.version ?? null);
  const [stage, setStage] = useState<number>(-1);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [scan, setScan] = useState<any>(null);
  const [showDiff, setShowDiff] = useState(false);
  const busy = stage >= 0 && stage < 7;
  const latest = adapted.find((v) => v.compat_report?.source_version === src) ?? null;
  const rep = latest?.compat_report;
  const shownScan = scan ?? rep?.scan ?? null;

  const run = async () => {
    if (src == null) return;
    setFailure(null); setScan(null); setStage(0);
    const a = await botApi<any>({ action: "ai_analyze", visitorId, botId: bot.id, version: src });
    if (a.error) { setStage(-1); setFailure(a.failure ?? { stage: "ANALYZING SOURCE", reason: a.error, tried: [], next: ["Coba lagi"] }); return; }
    setScan(a.scan); setStage(4);
    const r = await botApi<any>({ action: "ai_adapt", visitorId, botId: bot.id, version: src });
    if (r.error) { setStage(-1); setFailure(r.failure ?? { stage: "AI ADAPTATION", reason: r.error, tried: [], next: ["Coba lagi (Retry)"] }); return; }
    setStage(7);
    toast({ title: `Versi AI v${r.version} dibuat`, description: "Aktifkan lalu uji di Telegram. Status sukses hanya setelah bot membalas." });
    onDone();
  };

  if (!originals.length) return null;
  const feats: Feature[] = rep?.features ?? [];
  const n = (s: string) => feats.filter((f) => f.status === s || (s === "PRESERVED" && f.status === "COMPATIBLE") || (s === "UNSUPPORTED" && f.status === "NOT COMPATIBLE")).length;
  const isActive = latest && bot.current_version === latest.version;
  const statusText = busy ? STAGES[stage] : failure ? "❌ Adaptasi gagal" : !latest ? "Belum diadaptasi" : isActive && bot.status === "ACTIVE" && bot.total_commands ? "✅ Aktif & sudah membalas di Telegram" : isActive ? "Aktif — menunggu tes Telegram" : "Diadaptasi — belum diaktifkan";
  const handlers = rep?.handlers;
  const staticHandlers: any[] = shownScan?.handlers ?? [];
  const byType = staticHandlers.reduce((m: Record<string, number>, h: any) => ({ ...m, [h.type]: (m[h.type] ?? 0) + 1 }), {});

  return (
    <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10 p-2.5 text-[11px] space-y-2">
      <p className="font-bold text-xs flex items-center gap-1"><Bot className="w-3.5 h-3.5" />UNIVERSAL AI BOT ADAPTER</p>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
        <span className="text-muted-foreground">Bot</span><span className="font-semibold truncate">{bot.telegram_username ? `@${bot.telegram_username}` : bot.name}</span>
        <span className="text-muted-foreground">Source</span>
        <select value={src ?? ""} onChange={(e) => { setSrc(Number(e.target.value)); setScan(null); setFailure(null); }} className="h-6 min-w-0 rounded border border-input bg-background px-1">
          {originals.map((v) => <option key={v.version} value={v.version}>v{v.version} · {v.file_name}</option>)}
        </select>
        <span className="text-muted-foreground">AI Provider</span><span className="font-semibold">Lapak VIP AI Router</span>
        <span className="text-muted-foreground">Runtime</span><span className="font-semibold">Deno Edge Webhook</span>
        <span className="text-muted-foreground">Status</span><span className="font-semibold">{statusText}</span>
        {rep?.compatibility && <><span className="text-muted-foreground">Compatibility</span><span className="font-semibold">{COMPAT[rep.compatibility] ?? rep.compatibility}</span></>}
        {latest && <><span className="text-muted-foreground">Versi AI</span><span className="font-semibold">v{latest.version} · {latest.file_name}</span></>}
      </div>

      {(busy || stage === 7) && (
        <ol className="grid grid-cols-2 gap-0.5 rounded-lg bg-background/60 p-1.5">
          {STAGES.map((s, i) => <li key={s} className="flex items-center gap-1">{i < stage || stage === 7 ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : i === stage || (stage === 4 && i < 7 && i > 4) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Circle className="w-3 h-3 text-muted-foreground" />}{s}</li>)}
        </ol>
      )}

      {failure && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-1.5 space-y-0.5">
          <p className="font-bold flex items-center gap-1"><XCircle className="w-3 h-3" />TAHAP GAGAL: {failure.stage}</p>
          <p><b>Alasan:</b> {failure.reason}</p>
          {failure.file && <p><b>File:</b> {failure.file}</p>}
          {failure.dependency && <p><b>Dependency:</b> {failure.dependency}</p>}
          {failure.tried?.length > 0 && <p><b>Sudah dicoba:</b> {failure.tried.join(" · ")}</p>}
          {failure.next?.length > 0 && <p><b>Solusi berikutnya:</b> {failure.next.join(" · ")}</p>}
        </div>
      )}

      {shownScan && (
        <div className="rounded-lg bg-background/60 p-1.5 space-y-0.5">
          <p className="font-semibold">Peta project (analisis statis)</p>
          <p>File dianalisis: {shownScan.fileCount ?? shownScan.files?.length} · Entry: {shownScan.entry ?? "-"} ({shownScan.entryReason ?? "-"}) · Library: {shownScan.telegramLib ?? "-"}</p>
          <p>Command: {shownScan.commands?.join(" ") || "-"}</p>
          <p>Handler: {Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(" · ") || "-"}</p>
          <p>Polling: {shownScan.polling ? "ya → webhook" : "tidak"} · Tulis file: {shownScan.fsWrite ? "ya" : "tidak"} · Timer/cron: {shownScan.timers ? "ya" : "tidak"} · ENV: {shownScan.envVars?.length ?? 0}</p>
          {shownScan.skipped?.length > 0 && <p className="text-amber-400">Tidak dibaca (terlalu besar): {shownScan.skipped.slice(0, 5).join(", ")}</p>}
        </div>
      )}

      {handlers && (
        <p>Hasil: <b>{handlers.commands.length}</b> command · <b>{handlers.hears.length}</b> teks · <b>{handlers.callbacks.length}</b> callback · <b>{handlers.keyboards}</b> keyboard · fallback {handlers.fallback} · fitur {n("PRESERVED")} preserved / {n("ADAPTED")} adapted / {n("REPLACED")} replaced / {n("UNSUPPORTED")} unsupported</p>
      )}

      {(rep?.deps ?? shownScan?.deps)?.length > 0 && (
        <details className="rounded-lg bg-background/60 p-1.5"><summary className="font-semibold cursor-pointer">Dependency ({(rep?.deps ?? shownScan.deps).length})</summary>
          <ul className="space-y-0.5 mt-1">{(rep?.deps ?? shownScan.deps).map((d: any) => <li key={d.name}><b>{d.name}</b> <span className={`font-semibold ${TONE[d.classification] ?? ""}`}>{d.classification}</span> · {d.usage}{d.replacement ? ` → ${d.replacement}` : ""}</li>)}</ul>
        </details>
      )}

      {feats.length > 0 && (
        <details className="rounded-lg bg-background/60 p-1.5" open><summary className="font-semibold cursor-pointer">Fitur ({feats.length})</summary>
          <ul className="space-y-0.5 mt-1 max-h-48 overflow-y-auto">{feats.map((f, i) => <li key={i}><span className={`font-semibold ${TONE[f.status] ?? ""}`}>{f.status}</span> · {f.name}{f.file ? ` (${f.file})` : ""}{f.reason ? ` — ${f.reason}` : ""}{f.alternative ? ` · Alternatif: ${f.alternative}` : ""}</li>)}</ul>
        </details>
      )}

      {(rep?.warnings ?? []).length > 0 && <ul className="list-disc pl-4 text-amber-400">{rep.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>}
      {(rep?.security ?? []).length > 0 && <div className="rounded-lg bg-background/60 p-1.5"><p className="font-semibold">Keamanan</p>{rep.security.map((s: string, i: number) => <p key={i}>• {s}</p>)}</div>}

      {rep?.usage && (
        <div className="rounded-lg bg-background/60 p-1.5"><p className="font-semibold">AI Router Usage</p>
          <p>Provider: Lapak VIP · Model: {rep.usage.model ?? "-"} · Panggilan: {rep.usage.calls ?? 1}</p>
          <p>Input: {rep.usage.input_tokens ?? "tidak dilaporkan"} · Output: {rep.usage.output_tokens ?? "tidak dilaporkan"} · Total: {rep.usage.total_tokens ?? "tidak dilaporkan"} · Biaya: {rep.usage.cost ?? "tidak dilaporkan"}</p></div>
      )}

      <div className="flex flex-wrap gap-1">
        <Button size="sm" className="h-7 text-[11px]" disabled={busy || src == null} onClick={run}>{busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : "🤖 "}{busy ? STAGES[stage] : failure ? "Coba lagi (Retry)" : "UPDATE PAKAI AI"}</Button>
        {latest && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setShowDiff(!showDiff)}>Lihat perubahan AI</Button>}
      </div>
      {latest && showDiff && (
        <pre className="rounded-lg bg-background/80 border border-border p-1.5 text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto">{(rep.diff ?? []).map((l: string, i: number) => <span key={i} className={l.startsWith("+") ? "text-emerald-400" : l.startsWith("-") ? "text-destructive" : ""}>{l}{"\n"}</span>)}{rep.summary ? `\n${rep.summary}` : ""}</pre>
      )}
      <p className="text-muted-foreground">AI membaca seluruh project lalu menerjemahkan command, teks, tombol & callback ke runtime webhook toko. Kode asli tidak dijalankan dan tidak ditimpa. Fitur yang butuh server/HTTP/database/SSH ditandai UNSUPPORTED beserta alternatifnya.</p>
    </div>
  );
}

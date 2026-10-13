import { useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { botApi } from "./api";

type Feature = { name: string; kind: string; status: string; reason?: string };
const TONE: Record<string, string> = { COMPATIBLE: "text-emerald-400", ADAPTED: "text-amber-400", "NOT COMPATIBLE": "text-destructive" };

/** AI Bot Code Adapter: every number shown comes from the server's source scan or the stored AI version. */
export default function AiAdapterCard({ visitorId, bot, versions, onDone }: { visitorId: string; bot: any; versions: any[]; onDone: () => void }) {
  const { toast } = useToast();
  const originals = versions.filter((v) => !v.compat_report?.ai_adapted);
  const adapted = versions.filter((v) => v.compat_report?.ai_adapted);
  const [src, setSrc] = useState<number | null>(originals[0]?.version ?? null);
  const [phase, setPhase] = useState<string | null>(null);
  const [scan, setScan] = useState<any>(null);
  const [runtime, setRuntime] = useState<string[][] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState<number | null>(null);
  const latest = adapted.find((v) => v.compat_report?.source_version === src) ?? null;

  const run = async () => {
    if (src == null) return;
    setErr(null); setPhase("Menganalisis...");
    const a = await botApi<any>({ action: "ai_analyze", visitorId, botId: bot.id, version: src });
    if (a.error) { setPhase(null); setErr(a.error); return; }
    setScan(a.scan); setRuntime(a.runtime);
    setPhase("Mengadaptasi...");
    const r = await botApi<any>({ action: "ai_adapt", visitorId, botId: bot.id, version: src });
    if (r.error) { setPhase(null); setErr(r.error); return; }
    setPhase("Validasi..."); setPhase(null);
    toast({ title: `Versi AI v${r.version} dibuat`, description: "Aktifkan lalu uji di Telegram. Status sukses hanya setelah bot membalas." });
    onDone();
  };

  const feats: Feature[] = latest?.compat_report?.features ?? [];
  const ok = feats.filter((f) => f.status === "COMPATIBLE").length;
  const adaptedN = feats.filter((f) => f.status === "ADAPTED").length;
  const bad = feats.filter((f) => f.status === "NOT COMPATIBLE").length;
  const pct = feats.length ? Math.round(((ok + adaptedN) / feats.length) * 100) : null;
  const isActive = latest && bot.current_version === latest.version;
  const status = phase ?? (err ? "❌ Tidak kompatibel" : !latest ? "Belum diadaptasi" : isActive && bot.status === "ACTIVE" && bot.total_commands ? "✅ Compatible (sudah membalas di Telegram)" : isActive ? "Aktif — menunggu tes Telegram" : "Diadaptasi — belum diaktifkan");

  if (!originals.length) return null;
  return (
    <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10 p-2.5 text-[11px] space-y-2">
      <p className="font-bold text-xs flex items-center gap-1"><Bot className="w-3.5 h-3.5" />AI BOT ADAPTER</p>
      <div className="grid grid-cols-2 gap-1">
        <span className="text-muted-foreground">Bot</span><span className="font-semibold truncate">{bot.telegram_username ? `@${bot.telegram_username}` : bot.name}</span>
        <span className="text-muted-foreground">Source</span>
        <select value={src ?? ""} onChange={(e) => setSrc(Number(e.target.value))} className="h-6 rounded border border-input bg-background px-1">
          {originals.map((v) => <option key={v.version} value={v.version}>v{v.version} · {v.file_name}</option>)}
        </select>
        <span className="text-muted-foreground">Runtime</span><span className="font-semibold">Deno Edge (webhook)</span>
        <span className="text-muted-foreground">Status</span><span className="font-semibold">{status}</span>
        {pct != null && <><span className="text-muted-foreground">Kompatibilitas</span><span className="font-semibold">{pct}% ({feats.length} fitur: {ok} kompatibel, {adaptedN} diadaptasi, {bad} tidak)</span></>}
        {latest && <><span className="text-muted-foreground">Command</span><span className="font-semibold">{latest.compat_report.commands?.length ?? 0} · {latest.compat_report.commands?.join(" ")}</span></>}
      </div>
      {scan && (
        <div className="rounded-lg bg-background/60 p-1.5 space-y-0.5">
          <p className="font-semibold">Analisis source</p>
          <p>Entry: {scan.entry ?? "-"} · Library: {scan.telegramLib ?? "-"} · Dependency: {scan.dependencies.join(", ") || "-"}</p>
          <p>Command terdeteksi: {scan.commands.join(" ") || "-"} · Handler pesan: {scan.textHandlers}</p>
          <p>Polling: {scan.polling ? "ya → webhook" : "tidak"} · Callback: {scan.callbacks ? "ya" : "tidak"} · ENV: {scan.envVars.join(", ") || "-"}</p>
          <p>child_process: {scan.childProcess ? "ya (tidak diadaptasi)" : "tidak"} · eval: {scan.evalUse ? "ya (tidak diadaptasi)" : "tidak"} · fs: {scan.fsUse ? "ya" : "tidak"} · server HTTP: {scan.httpServer ? "ya" : "tidak"}</p>
        </div>
      )}
      {runtime && <div className="rounded-lg bg-background/60 p-1.5 font-mono text-[10px]">{runtime.map(([k, v]) => <p key={k}>{k}: {v}</p>)}</div>}
      {err && <p className="text-destructive">❌ {err}</p>}
      {feats.length > 0 && (
        <ul className="space-y-0.5 max-h-32 overflow-y-auto">{feats.map((f, i) => <li key={i}><span className={`font-semibold ${TONE[f.status] ?? ""}`}>{f.status}</span> · {f.name}{f.reason ? ` — ${f.reason}` : ""}</li>)}</ul>
      )}
      <div className="flex flex-wrap gap-1">
        <Button size="sm" className="h-7 text-[11px]" disabled={!!phase || src == null} onClick={run}>{phase ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : "🤖 "}{phase ?? "UPDATE PAKAI AI"}</Button>
        {latest && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setShowDiff(showDiff === latest.version ? null : latest.version)}>Lihat perubahan AI</Button>}
      </div>
      {latest && showDiff === latest.version && (
        <pre className="rounded-lg bg-background/80 border border-border p-1.5 text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto">{(latest.compat_report.diff ?? []).map((l: string, i: number) => <span key={i} className={l.startsWith("+") ? "text-emerald-400" : l.startsWith("-") ? "text-destructive" : ""}>{l}{"\n"}</span>)}{latest.compat_report.summary ? `\n${latest.compat_report.summary}` : ""}</pre>
      )}
      <p className="text-muted-foreground">AI menerjemahkan command & balasan ke format webhook. Kode asli tidak dijalankan dan tidak ditimpa. Fitur yang tidak bisa diterjemahkan ditandai, bukan dihapus diam-diam.</p>
    </div>
  );
}

// AI Bot Code Adapter. Reads uploaded bot source as TEXT (never executed), statically detects
// features/risks, asks Lovable AI to translate the bot's command/reply logic into the declarative
// adistore-bot.json spec that bot-hook interprets. Anything that cannot be expressed as data is
// reported NOT COMPATIBLE instead of being silently dropped.
import { unzipSync, zipSync, strToU8 } from "npm:fflate@0.8.2";
import { SPEC_FILE, VARS, validateSpec, unsafePath, type BotSpec } from "../_shared/bot-spec.ts";

const MAX_SRC_FILE = 200 * 1024;
const MAX_SRC_TOTAL = 400 * 1024;
const TOKEN_LIKE = /\d{6,12}:[A-Za-z0-9_-]{30,60}/g;

export type Feature = { name: string; kind: string; status: "COMPATIBLE" | "ADAPTED" | "NOT COMPATIBLE"; reason?: string };
export type Scan = {
  files: string[]; entry: string | null; dependencies: string[]; telegramLib: string | null;
  polling: boolean; webhook: boolean; envVars: string[]; childProcess: boolean; evalUse: boolean;
  fsUse: boolean; httpServer: boolean; timers: boolean; dbConn: boolean; callbacks: boolean;
  commands: string[]; textHandlers: number;
};

export function readSources(fileName: string, bytes: Uint8Array): { ok: true; files: Record<string, string>; pkg: Record<string, unknown> | null } | { ok: false; error: string } {
  const dec = new TextDecoder();
  if (!/\.zip$/i.test(fileName)) return { ok: true, files: { [fileName]: dec.decode(bytes).slice(0, MAX_SRC_FILE) }, pkg: null };
  let total = 0; let bad: string | null = null;
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(bytes, { filter: (f) => {
      if (unsafePath(f.name)) { bad = f.name; return false; }
      if (f.name.includes("node_modules/")) return false;
      const ok = /(\.(c|m)?js|\.ts|package\.json)$/i.test(f.name) && f.originalSize <= MAX_SRC_FILE && total + f.originalSize <= MAX_SRC_TOTAL;
      if (ok) total += f.originalSize;
      return ok;
    } });
  } catch { return { ok: false, error: "ZIP rusak" }; }
  if (bad) return { ok: false, error: "Path berbahaya di ZIP" };
  const files: Record<string, string> = {}; let pkg: Record<string, unknown> | null = null;
  for (const [n, u] of Object.entries(raw)) {
    const t = dec.decode(u);
    if (n.split("/").pop() === "package.json") { try { pkg = pkg ?? JSON.parse(t); } catch { /* ignore */ } continue; }
    files[n] = t;
  }
  return { ok: true, files, pkg };
}

/** Pure static scan. Regex only; source is never evaluated. */
export function scanSource(files: Record<string, string>, pkg: Record<string, unknown> | null): Scan {
  const all = Object.values(files).join("\n");
  const deps = Object.keys({ ...(pkg?.dependencies as object ?? {}) });
  const libs = ["node-telegram-bot-api", "telegraf", "grammy"];
  const telegramLib = libs.find((l) => deps.includes(l) || all.includes(`'${l}'`) || all.includes(`"${l}"`)) ?? null;
  const cmds = new Set<string>();
  for (const m of all.matchAll(/onText\(\s*\/\^?\\?\/([a-z0-9_]+)/gi)) cmds.add("/" + m[1].toLowerCase());
  for (const m of all.matchAll(/\.command\(\s*\[?\s*['"`]\/?([a-z0-9_]+)['"`]/gi)) cmds.add("/" + m[1].toLowerCase());
  for (const m of all.matchAll(/(?:===|==|startsWith\()\s*['"`]\/([a-z0-9_]+)['"`]/gi)) cmds.add("/" + m[1].toLowerCase());
  if (/\.start\(\s*(async\s*)?\(/.test(all) && telegramLib !== "node-telegram-bot-api") cmds.add("/start");
  if (/\.help\(\s*(async\s*)?\(/.test(all)) cmds.add("/help");
  const main = typeof pkg?.main === "string" ? pkg.main as string : null;
  const entry = main ? Object.keys(files).find((f) => f.endsWith(main.replace(/^\.\//, ""))) ?? main : Object.keys(files).find((f) => /(index|bot|main|app)\.(c|m)?js$/i.test(f)) ?? Object.keys(files)[0] ?? null;
  return {
    files: Object.keys(files), entry, dependencies: deps, telegramLib,
    polling: /polling\s*:\s*true|startPolling\(|\.launch\(\s*\)|bot\.start\(\s*\)/.test(all),
    webhook: /setWebHook|setWebhook|webhookCallback|webhook\s*:/.test(all),
    envVars: [...new Set([...all.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))],
    childProcess: /child_process|\bexecSync\(|\bspawn\(/.test(all),
    evalUse: /\beval\(|new\s+Function\(/.test(all),
    fsUse: /require\(\s*['"](fs|node:fs)['"]\)|from\s+['"](fs|node:fs)['"]/.test(all),
    httpServer: /createServer\(|express\(\)|\.listen\(\s*\d/.test(all),
    timers: /setInterval\(/.test(all),
    dbConn: /mongoose|mysql|pg\b|sqlite|redis/.test(deps.join(" ") + all.slice(0, 2000)),
    callbacks: /callback_query|callbackQuery|action\(/.test(all),
    commands: [...cmds].slice(0, 50),
    textHandlers: (all.match(/\.on\(\s*['"](message|text)['"]|\.hears\(/g) ?? []).length,
  };
}

const SYS = `Kamu adalah AI Bot Code Adapter. Kamu menerima source bot Telegram Node.js. Runtime target TIDAK menjalankan JavaScript; runtime hanya menafsirkan spesifikasi JSON:
{"name":string,"version":string,"commands":{"/cmd":"teks balasan"},"fallback":{"mode":"echo","prefix":string}|{"mode":"text","text":string}|{"mode":"none"},"unknown_command":string}
Template boleh memakai variabel: ${VARS.map((v) => `{${v}}`).join(", ")}.
Aturan:
- Pertahankan SEMUA command dan teks balasan ASLI sepersis mungkin (salin string literal). Ganti ekspresi dinamis dengan variabel template yang setara (mis. msg.from.first_name -> {first_name}, msg.chat.id -> {chat_id}). Jangan mengarang fitur baru.
- Pesan biasa: jika source membalas/echo pesan biasa, petakan ke fallback.
- Fitur yang tidak bisa diekspresikan (callback/inline keyboard, database, HTTP eksternal, timer, file, perhitungan dinamis) tetap dicantumkan di features dengan status "NOT COMPATIBLE" dan alasan. Jika command punya bagian dinamis yang hilang, status "ADAPTED" dan jelaskan.
- JANGAN memasukkan token apa pun ke output.
Balas HANYA JSON: {"warnings":["..."],"spec":{...},"features":[{"name":"/start","kind":"command|message|callback|other","status":"COMPATIBLE|ADAPTED|NOT COMPATIBLE","reason":"..."}],"diff":["- baris lama","+ pengganti"],"summary":"..."}`;

/** Removes bot tokens, API keys, passwords and private keys before any source leaves the server. */
export function sanitizeSource(t: string): string {
  return t
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(TOKEN_LIKE, "[REDACTED_BOT_TOKEN]")
    .replace(/\b(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,})/g, "[REDACTED]")
    .replace(/((?:api[_-]?key|secret|token|password|passwd|pwd|credential|auth)[A-Za-z0-9_]*\s*[:=]\s*)(['"`])[^'"`\n]{4,}\2/gi, "$1$2[REDACTED]$2")
    .replace(/^(\s*[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*\s*=\s*).+$/gm, "$1[REDACTED]");
}

export type RouterCfg = { label: string; base_url: string; api_key: string; model: string };
/** Only the admin-selected custom router (Lapak VIP). Lovable AI is never used and never a fallback. */
// deno-lint-ignore no-explicit-any
export async function getRouter(db: any): Promise<RouterCfg | { error: string }> {
  const { data } = await db.from("ai_providers").select("label, provider_type, base_url, api_key, model").eq("is_selected", true).eq("is_active", true).maybeSingle();
  if (!data) return { error: "AI Router Lapak VIP belum dipilih/aktif di tab AI Key admin." };
  if (data.provider_type === "lovable" || !data.base_url || /lovable\.dev/i.test(data.base_url)) return { error: "Provider terpilih bukan AI Router Lapak VIP. Adapter menolak memakai AI Lovable." };
  if (!data.api_key) return { error: "AI Router Lapak VIP belum memiliki API key." };
  return { label: data.label, base_url: String(data.base_url).replace(/\/$/, ""), api_key: data.api_key, model: data.model || "auto" };
}

export type Usage = { model: string | null; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null; cost: number | null };

export async function aiAdapt(router: RouterCfg, files: Record<string, string>, scan: Scan, botName: string): Promise<
  { ok: true; spec: BotSpec; features: Feature[]; diff: string[]; summary: string; warnings: string[]; usage: Usage } | { ok: false; error: string; usage?: Usage }> {
  const src = Object.entries(files).map(([n, t]) => `// FILE: ${n}\n${sanitizeSource(t)}`).join("\n\n").slice(0, 120000);
  const user = `Nama bot: ${botName}\nCommand terdeteksi statis: ${scan.commands.join(", ") || "-"}\nCallback: ${scan.callbacks}\nPolling: ${scan.polling}\n\n${src}`;
  let r: Response;
  try {
    r = await fetch(`${router.base_url}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${router.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: router.model, stream: false, temperature: 0.1, messages: [{ role: "system", content: SYS }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(110000),
    });
  } catch (e) { return { ok: false, error: `AI Router Lapak VIP gagal merespons (${e instanceof Error && e.name === "TimeoutError" ? "timeout" : "jaringan"}).` }; }
  const raw = await r.text();
  if (!r.ok) {
    const detail = raw.replace(/\s+/g, " ").slice(0, 200);
    if (r.status === 402 || /credit|kredit|saldo|balance|quota/i.test(detail)) return { ok: false, error: `AI Router Lapak VIP tidak memiliki kredit (HTTP ${r.status}): ${detail}` };
    return { ok: false, error: `AI Router Lapak VIP gagal (HTTP ${r.status}): ${detail}` };
  }
  // Some routers always answer SSE; collect content.
  let content = ""; let j: any = null;
  if (raw.trimStart().startsWith("data:")) {
    for (const line of raw.split("\n")) { const t = line.trim(); if (!t.startsWith("data:")) continue; const p = t.slice(5).trim(); if (!p || p === "[DONE]") continue;
      try { const x = JSON.parse(p); j = x.usage ? x : j ?? x; const d = x?.choices?.[0]?.delta ?? x?.choices?.[0]?.message; if (typeof d?.content === "string") content += d.content; } catch { /* skip */ } }
  } else { try { j = JSON.parse(raw); content = String(j?.choices?.[0]?.message?.content ?? ""); } catch { return { ok: false, error: "Respons AI Router bukan JSON" }; } }
  const u = j?.usage ?? {};
  const usage: Usage = { model: j?.model ?? router.model, input_tokens: u.prompt_tokens ?? null, output_tokens: u.completion_tokens ?? null, total_tokens: u.total_tokens ?? null, cost: typeof u.cost === "number" ? u.cost : null };
  const m = content.match(/\{[\s\S]*\}/);
  let out: { spec?: unknown; features?: Feature[]; diff?: string[]; summary?: string; warnings?: string[] };
  try { out = JSON.parse(m ? m[0] : ""); } catch { return { ok: false, error: "ADAPTASI GAGAL: hasil AI bukan JSON valid", usage }; }
  const specRaw = JSON.parse(sanitizeSource(JSON.stringify(out.spec ?? {})));
  const v = validateSpec(specRaw);
  if (!v.ok) return { ok: false, error: "ADAPTASI GAGAL: validasi hasil AI gagal: " + v.errors.slice(0, 3).join("; "), usage };
  const features = (Array.isArray(out.features) ? out.features : []).slice(0, 80).map((f) => ({
    name: String(f?.name ?? "").slice(0, 60), kind: String(f?.kind ?? "other").slice(0, 20),
    status: (["COMPATIBLE", "ADAPTED", "NOT COMPATIBLE"].includes(f?.status) ? f.status : "NOT COMPATIBLE") as Feature["status"],
    reason: f?.reason ? String(f.reason).slice(0, 300) : undefined,
  }));
  const warnings = (Array.isArray(out.warnings) ? out.warnings : []).slice(0, 20).map((w) => String(w).slice(0, 300));
  for (const c of scan.commands) if (!v.spec.commands[c]) {
    warnings.push(`Command ${c} ada di source tetapi tidak ada di hasil AI`);
    if (!features.some((f) => f.name === c)) features.push({ name: c, kind: "command", status: "NOT COMPATIBLE", reason: "Tidak berhasil diterjemahkan AI" });
  }
  for (const c of Object.keys(v.spec.commands)) if (!features.some((f) => f.name === c)) features.push({ name: c, kind: "command", status: "COMPATIBLE" });
  if (scan.textHandlers && v.spec.fallback.mode === "none" && !features.some((f) => f.kind === "message")) features.push({ name: "pesan biasa", kind: "message", status: "NOT COMPATIBLE", reason: "Source punya handler pesan, hasil AI tidak memetakannya" });
  const diff = (Array.isArray(out.diff) ? out.diff : []).slice(0, 60).map((l) => sanitizeSource(String(l)).slice(0, 300));
  return { ok: true, spec: v.spec, features, diff, summary: sanitizeSource(String(out.summary ?? "")).slice(0, 600), warnings, usage };
}

export function runtimeReport() {
  return [
    ["Runtime", "Deno Edge Function (serverless, per request)"], ["Telegram Webhook", "SUPPORTED"], ["Telegram Bot API", "SUPPORTED (via store runtime)"],
    ["Eksekusi JS user", "NOT SUPPORTED (tanpa sandbox terisolasi)"], ["npm dependency user", "NOT SUPPORTED"], ["Long-running process", "NOT SUPPORTED"],
    ["Polling", "NOT SUPPORTED → diubah ke webhook"], ["Filesystem persisten", "NOT SUPPORTED"], ["Batas waktu", "per request (detik), tanpa proses 24/7"],
  ];
}

export function buildAdaptedZip(spec: BotSpec, meta: Record<string, unknown>, diff: string[]) {
  return zipSync({
    [SPEC_FILE]: strToU8(JSON.stringify(spec, null, 2)),
    "ADAPTATION.json": strToU8(JSON.stringify(meta, null, 2)),
    "CHANGES.diff": strToU8(diff.join("\n") + "\n"),
  });
}

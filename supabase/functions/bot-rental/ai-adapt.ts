// Universal AI Bot Adapter. Reads uploaded bot source as TEXT (never executed): file discovery,
// entry detection, require graph, multi-library handler detection (Telegraf, node-telegram-bot-api,
// grammY, TeleBot, raw API) and dependency usage. Then asks the admin-selected Lapak VIP AI Router
// (never Lovable AI, no fallback) to translate the bot into the data-only adistore-bot.json spec
// interpreted by bot-hook. Features that cannot run on the target are reported UNSUPPORTED with a
// reason and alternative instead of being silently dropped.
import { unzipSync, zipSync, strToU8 } from "npm:fflate@0.8.2";
import { SPEC_FILE, VARS, validateSpec, unsafePath, handlerCount, type BotSpec } from "../_shared/bot-spec.ts";

const MAX_SRC_FILE = 1024 * 1024;
const MAX_SRC_TOTAL = 4 * 1024 * 1024;
const MAX_PROMPT_SRC = 140_000;
const TOKEN_LIKE = /\d{6,12}:[A-Za-z0-9_-]{30,60}/g;
const TEXT_RE = /\.(c|m)?(js|ts)x?$|\.json$/i;

export type FeatureStatus = "PRESERVED" | "ADAPTED" | "REPLACED" | "UNSUPPORTED";
export type Feature = { name: string; kind: string; file?: string; status: FeatureStatus; reason?: string; alternative?: string };
export type DepClass = "SUPPORTED" | "ADAPTABLE" | "REPLACEABLE" | "OPTIONAL" | "UNSUPPORTED";
export type Dependency = { name: string; version?: string; usage: string; files: number; classification: DepClass; replacement?: string };
export type Handler = { type: string; trigger: string; file: string; line: number };
export type Compatibility = "FULLY_ADAPTABLE" | "ADAPTABLE_WITH_CHANGES" | "NOT_ADAPTABLE";
export type Scan = {
  files: string[]; fileCount: number; entry: string | null; entryReason: string; dependencies: string[]; deps: Dependency[];
  telegramLib: string | null; polling: boolean; webhook: boolean; envVars: string[]; childProcess: boolean; evalUse: boolean;
  fsUse: boolean; fsWrite: boolean; httpServer: boolean; timers: boolean; dbConn: boolean; callbacks: boolean;
  commands: string[]; handlers: Handler[]; textHandlers: number; graph: Record<string, string[]>; skipped: string[];
};
export type Failure = { stage: string; reason: string; file?: string; dependency?: string; tried: string[]; next: string[] };

export function readSources(fileName: string, bytes: Uint8Array): { ok: true; files: Record<string, string>; pkg: Record<string, unknown> | null; skipped: string[] } | { ok: false; error: string } {
  const dec = new TextDecoder();
  if (!/\.zip$/i.test(fileName)) return { ok: true, files: { [fileName]: dec.decode(bytes.slice(0, MAX_SRC_FILE)) }, pkg: null, skipped: [] };
  let total = 0; let bad: string | null = null; const skipped: string[] = [];
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(bytes, { filter: (f) => {
      if (unsafePath(f.name)) { bad = f.name; return false; }
      if (/(^|\/)(node_modules|\.git)\//.test(f.name) || /(package-lock|yarn\.lock|pnpm-lock)/.test(f.name) || !TEXT_RE.test(f.name)) return false;
      if (f.originalSize > MAX_SRC_FILE || total + f.originalSize > MAX_SRC_TOTAL) { skipped.push(f.name); return false; }
      total += f.originalSize; return true;
    } });
  } catch { return { ok: false, error: "ZIP rusak atau tidak dapat dibaca" }; }
  if (bad) return { ok: false, error: `Path berbahaya di ZIP: ${String(bad).slice(0, 80)}` };
  const files: Record<string, string> = {}; let pkg: Record<string, unknown> | null = null; let pkgDepth = 99;
  for (const [n, u] of Object.entries(raw)) {
    const t = dec.decode(u);
    if (n.split("/").pop() === "package.json") { const d = n.split("/").length; if (d < pkgDepth) { try { pkg = JSON.parse(t); pkgDepth = d; } catch { /* ignore */ } } continue; }
    if (/\.json$/i.test(n) && t.length > 50_000) continue; // big data dumps are not logic
    files[n] = t;
  }
  return { ok: true, files, pkg, skipped };
}

const DEP_RULES: Record<string, [DepClass, string, string]> = {
  "telegraf": ["ADAPTABLE", "Framework Telegram", "Handler diterjemahkan ke webhook Telegram"],
  "node-telegram-bot-api": ["ADAPTABLE", "Library Telegram", "Handler diterjemahkan ke webhook Telegram"],
  "grammy": ["ADAPTABLE", "Framework Telegram", "Handler diterjemahkan ke webhook Telegram"],
  "telebot": ["ADAPTABLE", "Library Telegram", "Handler diterjemahkan ke webhook Telegram"],
  "axios": ["REPLACEABLE", "HTTP client", "fetch"], "node-fetch": ["REPLACEABLE", "HTTP client", "fetch"], "got": ["REPLACEABLE", "HTTP client", "fetch"],
  "form-data": ["REPLACEABLE", "Multipart upload", "FormData bawaan"], "moment": ["REPLACEABLE", "Tanggal", "Intl / {expires_at}"], "moment-timezone": ["REPLACEABLE", "Zona waktu", "Intl.DateTimeFormat"],
  "dotenv": ["OPTIONAL", "Baca .env", "Secret server-side"], "chalk": ["OPTIONAL", "Warna log terminal", "Tidak diperlukan"],
  "node-cron": ["ADAPTABLE", "Penjadwal", "Scheduler/database job (belum tersedia di runtime bot toko)"], "cron": ["ADAPTABLE", "Penjadwal", "Scheduler/database job"],
  "qrcode": ["REPLACEABLE", "Generate QR", "Library QR murni JS / URL QR"],
  "canvas": ["UNSUPPORTED", "Gambar (native binary)", "Gambar statis / layanan render terpisah"], "sharp": ["UNSUPPORTED", "Gambar (native)", "Layanan render terpisah"],
  "archiver": ["UNSUPPORTED", "Buat ZIP di disk", "fflate di runtime terpisah"], "ssh2": ["UNSUPPORTED", "Koneksi SSH ke server", "Runtime eksternal/VPS"],
  "puppeteer": ["UNSUPPORTED", "Browser headless", "Runtime eksternal"], "child_process": ["UNSUPPORTED", "Shell", "Tidak diizinkan"],
  "mongoose": ["ADAPTABLE", "Database", "Database toko (belum tersedia untuk bot user)"], "mysql2": ["ADAPTABLE", "Database", "Database toko"], "pg": ["ADAPTABLE", "Database", "Database toko"],
  "sqlite3": ["ADAPTABLE", "Database file", "Database toko"], "better-sqlite3": ["ADAPTABLE", "Database file", "Database toko"], "lowdb": ["ADAPTABLE", "Database JSON file", "Database toko"], "redis": ["ADAPTABLE", "Cache", "Database toko"],
  "express": ["REPLACEABLE", "HTTP server", "Webhook bot-hook"],
};

function resolveRel(from: string, spec: string, names: Set<string>): string | null {
  const base = from.split("/").slice(0, -1);
  for (const p of spec.split("/")) { if (p === "..") base.pop(); else if (p !== ".") base.push(p); }
  const s = base.join("/");
  for (const c of [s, `${s}.js`, `${s}.ts`, `${s}.cjs`, `${s}.mjs`, `${s}.json`, `${s}/index.js`, `${s}/index.ts`]) if (names.has(c)) return c;
  return null;
}

/** Pure static scan. Regex/token based; source is never evaluated. */
export function scanSource(files: Record<string, string>, pkg: Record<string, unknown> | null, skipped: string[] = []): Scan {
  const names = new Set(Object.keys(files));
  const all = Object.values(files).join("\n");
  const depVer = { ...(pkg?.dependencies as Record<string, string> ?? {}) };
  const depNames = Object.keys(depVer);
  const telegramLib = ["telegraf", "node-telegram-bot-api", "grammy", "telebot"].find((l) => depNames.includes(l) || new RegExp(`['"\`]${l}['"\`]`).test(all)) ?? (/api\.telegram\.org\/bot/.test(all) ? "raw Telegram API" : null);

  // entry point
  const depth = (n: string) => n.split("/").length;
  const byBase = (b: string) => [...names].filter((n) => n === b || n.endsWith("/" + b)).sort((a, c) => depth(a) - depth(c))[0];
  let entry: string | null = null; let entryReason = "";
  const fromStart = typeof (pkg?.scripts as Record<string, string>)?.start === "string" ? ((pkg!.scripts as Record<string, string>).start.match(/(?:node|nodemon|ts-node|bun|deno run)\s+(?:[-\w=]+\s+)*([\w./-]+\.(?:c|m)?[jt]s)/)?.[1]) : undefined;
  const bin = typeof pkg?.bin === "string" ? pkg.bin as string : pkg?.bin && typeof pkg.bin === "object" ? Object.values(pkg.bin as Record<string, string>)[0] : undefined;
  for (const [cand, why] of [[pkg?.main as string, "package.json main"], [fromStart, "package.json scripts.start"], [bin, "package.json bin"]] as [string | undefined, string][]) {
    if (!cand) continue;
    const f = byBase(cand.replace(/^\.\//, ""));
    if (f) { entry = f; entryReason = why; break; }
  }
  if (!entry) for (const b of ["index.js", "main.js", "app.js", "bot.js", "server.js", "src/index.js", "src/main.js", "src/bot.js", "index.ts", "src/index.ts"]) { const f = byBase(b); if (f) { entry = f; entryReason = `nama file umum (${b})`; break; } }
  if (!entry) {
    const tg = [...names].filter((n) => /\.(c|m)?[jt]s$/.test(n) && /(new\s+Telegraf|new\s+TelegramBot|new\s+Bot\(|\.launch\(|startPolling|api\.telegram\.org)/.test(files[n])).sort((a, c) => depth(a) - depth(c));
    if (tg[0]) { entry = tg[0]; entryReason = "file yang membuat instance bot"; }
  }

  // require/import graph
  const graph: Record<string, string[]> = {};
  for (const [n, t] of Object.entries(files)) {
    const out = new Set<string>();
    for (const m of t.matchAll(/(?:require\(\s*|from\s+|import\(\s*)['"`](\.{1,2}\/[^'"`]+)['"`]/g)) { const r = resolveRel(n, m[1], names); if (r) out.add(r); }
    if (out.size) graph[n] = [...out];
  }

  // handlers (multi library)
  const handlers: Handler[] = [];
  const push = (type: string, trigger: string, file: string, idx: number, text: string) => {
    if (handlers.length >= 400) return;
    handlers.push({ type, trigger: trigger.slice(0, 80), file, line: text.slice(0, idx).split("\n").length });
  };
  for (const [n, t] of Object.entries(files)) {
    if (!/\.(c|m)?[jt]sx?$/.test(n)) continue;
    for (const m of t.matchAll(/\.command\(\s*\[([^\]]{1,400})\]/g)) for (const q of m[1].matchAll(/['"`]\/?([\w]{1,32})['"`]/g)) push("command", "/" + q[1].toLowerCase(), n, m.index!, t);
    for (const m of t.matchAll(/\.command\(\s*(['"`])\/?([\w]{1,32})\1/g)) push("command", "/" + m[2].toLowerCase(), n, m.index!, t);
    for (const m of t.matchAll(/\bonText\(\s*\/\^?\\?\/([\w]{1,32})/g)) push("command", "/" + m[1].toLowerCase(), n, m.index!, t);
    for (const m of t.matchAll(/\.(start|help|settings)\(\s*(async\b|\(|ctx\b|function\b|[A-Za-z_$][\w$]*\s*\))/g)) push("command", "/" + m[1], n, m.index!, t);
    for (const m of t.matchAll(/(?:===?|startsWith\(|case)\s*(['"`])\/([\w]{1,32})\1/g)) push("command", "/" + m[2].toLowerCase(), n, m.index!, t);
    for (const m of t.matchAll(/\.hears\(\s*(['"`])([^'"`\n]{1,100})\1/g)) push("hears", m[2], n, m.index!, t);
    for (const m of t.matchAll(/\.hears\(\s*\/([^/\n]{1,80})\//g)) push("hears-regex", m[1], n, m.index!, t);
    for (const m of t.matchAll(/\.(?:action|callbackQuery)\(\s*(['"`])([^'"`\n]{1,64})\1/g)) push("callback", m[2], n, m.index!, t);
    for (const m of t.matchAll(/\.(?:action|callbackQuery)\(\s*\/([^/\n]{1,80})\//g)) push("callback-regex", m[1], n, m.index!, t);
    for (const m of t.matchAll(/\.on\(\s*(?:message\(\s*)?(['"`])(message|text|callback_query|inline_query|photo|document|video|audio|voice|sticker|contact|location|channel_post|chat_member|my_chat_member|new_chat_members|pre_checkout_query|successful_payment)\1/g)) push("event", m[2], n, m.index!, t);
    for (const m of t.matchAll(/\.(?:inlineQuery|on_inline)\(/g)) push("event", "inline_query", n, m.index!, t);
    for (const m of t.matchAll(/callback_data\s*:\s*(['"`])([^'"`\n]{1,64})\1/g)) push("button", m[2], n, m.index!, t);
    for (const m of t.matchAll(/Markup\.button\.callback\(\s*(['"`])[^'"`]*\1\s*,\s*(['"`])([^'"`\n]{1,64})\2/g)) push("button", m[3], n, m.index!, t);
  }
  const commands = [...new Set(handlers.filter((h) => h.type === "command").map((h) => h.trigger))].slice(0, 100);

  // dependency usage
  const deps: Dependency[] = depNames.map((d) => {
    const used = Object.entries(files).filter(([, t]) => new RegExp(`(?:require\\(|from\\s+|import\\()\\s*['"\`]${d.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?:/[^'"\`]*)?['"\`]`).test(t)).map(([n]) => n);
    const rule = DEP_RULES[d];
    if (!used.length) return { name: d, version: depVer[d], usage: "Tidak di-require di source", files: 0, classification: "OPTIONAL" as DepClass, replacement: "Tidak dipakai, bukan blocker" };
    return { name: d, version: depVer[d], usage: `${rule?.[1] ?? "Library"} · dipakai di ${used.slice(0, 3).join(", ")}${used.length > 3 ? ` +${used.length - 3}` : ""}`, files: used.length, classification: (rule?.[0] ?? "ADAPTABLE") as DepClass, replacement: rule?.[2] ?? "Dianalisis AI" };
  });

  return {
    files: Object.keys(files), fileCount: names.size, entry, entryReason: entry ? entryReason : "tidak ditemukan otomatis — ditentukan AI", dependencies: depNames, deps, telegramLib,
    polling: /polling\s*:\s*true|startPolling\(|\.launch\(|bot\.start\(\s*\)/.test(all),
    webhook: /setWebHook|setWebhook|webhookCallback|webhook\s*:/.test(all),
    envVars: [...new Set([...all.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))].slice(0, 40),
    childProcess: /child_process|\bexecSync\(|\bspawn\(/.test(all),
    evalUse: /\beval\(|new\s+Function\(/.test(all),
    fsUse: /require\(\s*['"](fs|node:fs|fs\/promises)['"]\)|from\s+['"](fs|node:fs|fs\/promises)['"]/.test(all),
    fsWrite: /\b(writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|createWriteStream|unlinkSync|renameSync)\(/.test(all),
    httpServer: /createServer\(|express\(\)|\.listen\(\s*\d/.test(all),
    timers: /setInterval\(|cron\.schedule\(/.test(all),
    dbConn: /mongoose|mysql|\bpg\b|sqlite|redis|lowdb/.test(depNames.join(" ")),
    callbacks: handlers.some((h) => h.type.startsWith("callback") || h.type === "button") || /callback_query/.test(all),
    commands, handlers, textHandlers: handlers.filter((h) => h.type === "event" && (h.trigger === "text" || h.trigger === "message")).length + handlers.filter((h) => h.type.startsWith("hears")).length,
    graph, skipped,
  };
}

/** Removes bot tokens, API keys, passwords and private keys before any source leaves the server. */
export function sanitizeSource(t: string): string {
  return t
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(TOKEN_LIKE, "[REDACTED_BOT_TOKEN]")
    .replace(/\b(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abp]-[A-Za-z0-9-]{10,})/g, "[REDACTED]")
    .replace(/(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s'"`]+/gi, "$1://[REDACTED]")
    .replace(/((?:api[_-]?key|secret|token|password|passwd|pwd|credential|auth|license[_-]?key|pat|aes)[A-Za-z0-9_]*['"`]?\s*[:=]\s*)(['"`])[^'"`\n]{4,}\2/gi, "$1$2[REDACTED]$2")
    .replace(/^(\s*[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PAT|AES)[A-Z0-9_]*\s*=\s*).+$/gm, "$1[REDACTED]");
}

/** Builds the source bundle for AI: project map, entry first, then modules reachable from it, then handler snippets. */
export function buildBundle(files: Record<string, string>, scan: Scan): { text: string; included: string[]; snippetOnly: string[] } {
  const order: string[] = []; const seen = new Set<string>();
  const visit = (f: string) => { if (seen.has(f) || !files[f]) return; seen.add(f); order.push(f); for (const c of scan.graph[f] ?? []) visit(c); };
  if (scan.entry) visit(scan.entry);
  for (const h of scan.handlers) visit(h.file);
  for (const f of Object.keys(files)) if (/\.(c|m)?[jt]sx?$/.test(f)) visit(f);
  const map = [
    `ENTRYPOINT: ${scan.entry ?? "?"} (${scan.entryReason})`, `LIBRARY: ${scan.telegramLib ?? "?"}`,
    `FILES (${scan.fileCount}): ${scan.files.slice(0, 80).join(", ")}${scan.files.length > 80 ? " ..." : ""}`,
    `MODULE GRAPH: ${Object.entries(scan.graph).slice(0, 60).map(([k, v]) => `${k} -> ${v.join(", ")}`).join(" | ") || "-"}`,
    `DEPENDENCIES: ${scan.deps.map((d) => `${d.name} [${d.classification}; ${d.usage}]`).join(" | ") || "-"}`,
    `HANDLERS (static): ${scan.handlers.slice(0, 150).map((h) => `${h.type}:${h.trigger}@${h.file}:${h.line}`).join(" | ") || "-"}`,
    `ENV: ${scan.envVars.join(", ") || "-"} · fs write: ${scan.fsWrite} · timers: ${scan.timers} · db: ${scan.dbConn} · http server: ${scan.httpServer}`,
  ].join("\n");
  let budget = MAX_PROMPT_SRC - map.length; const included: string[] = []; const snippetOnly: string[] = []; const parts: string[] = [];
  for (const f of order) {
    const t = sanitizeSource(files[f]);
    if (t.length + 40 <= budget) { parts.push(`// ===== FILE: ${f} =====\n${t}`); budget -= t.length + 40; included.push(f); }
    else snippetOnly.push(f);
  }
  // handler snippets for files that did not fit (keeps reply texts and buttons visible to AI)
  for (const f of snippetOnly) {
    const lines = sanitizeSource(files[f]).split("\n");
    for (const h of scan.handlers.filter((x) => x.file === f)) {
      const s = lines.slice(Math.max(0, h.line - 1), h.line + 30).join("\n");
      if (s.length + 60 > budget) break;
      parts.push(`// ===== SNIPPET ${f}:${h.line} (${h.type} ${h.trigger}) =====\n${s}`); budget -= s.length + 60;
    }
    if (budget < 2000) break;
  }
  return { text: `PROJECT MAP\n${map}\n\nSOURCE\n${parts.join("\n\n")}`, included, snippetOnly };
}

const SPEC_DOC = `{"name":string,"version":string,
 "commands":{"/cmd":"teks"},            // boleh kosong jika bot hanya pakai tombol/teks
 "hears":{"teks persis":"balasan"},      // Telegraf hears / cek teks persis (case-insensitive)
 "callbacks":{"callback_data":"balasan"},// bot.action / callback_query (maks 64 byte)
 "buttons":{"/start":[[{"text":"🛒 Beli","data":"buy"},{"text":"Web","url":"https://..."}]], "cb:buy":[[...]], "hears:menu":[[...]]},
 "fallback":{"mode":"echo","prefix":string}|{"mode":"text","text":string}|{"mode":"none"},
 "unknown_command":string}`;

const SYS = `Kamu adalah Universal AI Bot Adapter. Kamu menerima PROJECT MAP dan source bot Telegram (Telegraf, node-telegram-bot-api, grammY, TeleBot, atau API mentah), bisa multi-file.
Runtime target: webhook Telegram di Deno Edge milik toko yang HANYA menafsirkan spesifikasi data (tidak menjalankan JavaScript user, tidak ada HTTP eksternal, database, file, cron, SSH, atau perhitungan dinamis):
${SPEC_DOC}
Variabel template yang tersedia: ${VARS.map((v) => `{${v}}`).join(", ")}.
Tugas:
1. Pahami seluruh project: entrypoint, modul yang di-require, semua handler (command, hears, action/callback, on message/text, inline keyboard, menu).
2. Terjemahkan SEBANYAK MUNGKIN ke spec: salin teks balasan ASLI dan tombol inline (text + callback_data/url) persis. Bagian dinamis diganti variabel template yang setara, atau teks statis yang jujur menjelaskan (mis. "Daftar produk diambil dari server — fitur ini belum didukung").
3. JANGAN menghapus fitur diam-diam. Setiap fitur wajib ada di "features" dengan status PRESERVED (teks/tombol sama persis), ADAPTED (diubah agar jalan), REPLACED (diganti mekanisme lain), atau UNSUPPORTED (+ reason + alternative).
4. Klasifikasikan setiap dependency berdasarkan PEMAKAIAN NYATA: SUPPORTED | ADAPTABLE | REPLACEABLE | OPTIONAL | UNSUPPORTED. Dependency yang tidak dipakai = OPTIONAL, bukan blocker.
5. compatibility: FULLY_ADAPTABLE (semua fitur PRESERVED/ADAPTED tanpa kehilangan logika), ADAPTABLE_WITH_CHANGES (ada fitur UNSUPPORTED/REPLACED), NOT_ADAPTABLE (tidak ada handler Telegram sama sekali yang bisa dipetakan).
6. JANGAN memasukkan token/secret apa pun.
Balas HANYA satu objek JSON:
{"entrypoint":"...","library":"...","has_telegram_handlers":true,"compatibility":"...","spec":{...},
"features":[{"name":"/start","kind":"command|hears|callback|message|menu|payment|scheduler|database|network|filesystem|admin|other","file":"...","status":"PRESERVED|ADAPTED|REPLACED|UNSUPPORTED","reason":"...","alternative":"..."}],
"dependencies":[{"name":"...","usage":"...","classification":"...","replacement":"..."}],
"diff":["- kode lama","+ pengganti"],"warnings":["..."],"security_findings":["..."],"summary":"..."}`;

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

export type Usage = { model: string | null; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null; cost: number | null; calls: number };
const addUsage = (a: Usage, b: Partial<Usage>): Usage => ({
  model: b.model ?? a.model, calls: a.calls + 1, cost: b.cost != null ? (a.cost ?? 0) + b.cost : a.cost,
  input_tokens: b.input_tokens != null ? (a.input_tokens ?? 0) + b.input_tokens : a.input_tokens,
  output_tokens: b.output_tokens != null ? (a.output_tokens ?? 0) + b.output_tokens : a.output_tokens,
  total_tokens: b.total_tokens != null ? (a.total_tokens ?? 0) + b.total_tokens : a.total_tokens,
});

// deno-lint-ignore no-explicit-any
async function callRouter(router: RouterCfg, system: string, user: string, timeoutMs: number): Promise<{ ok: true; content: string; usage: Partial<Usage> } | { ok: false; error: string }> {
  let r: Response;
  try {
    r = await fetch(`${router.base_url}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${router.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: router.model, stream: false, temperature: 0.1, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) { return { ok: false, error: `AI Router Lapak VIP gagal merespons (${e instanceof Error && e.name === "TimeoutError" ? "timeout" : "jaringan"}).` }; }
  const raw = await r.text();
  if (!r.ok) {
    const detail = raw.replace(/\s+/g, " ").slice(0, 240);
    if (r.status === 402 || /insufficient|credit|kredit|saldo|balance|quota/i.test(detail)) return { ok: false, error: `AI Router Lapak VIP tidak memiliki kredit (HTTP ${r.status}): ${detail}` };
    return { ok: false, error: `AI Router Lapak VIP gagal (HTTP ${r.status}): ${detail}` };
  }
  // deno-lint-ignore no-explicit-any
  let content = ""; let j: any = null;
  if (raw.trimStart().startsWith("data:")) {
    for (const line of raw.split("\n")) {
      const t = line.trim(); if (!t.startsWith("data:")) continue; const p = t.slice(5).trim(); if (!p || p === "[DONE]") continue;
      try { const x = JSON.parse(p); j = x.usage ? x : j ?? x; const d = x?.choices?.[0]?.delta ?? x?.choices?.[0]?.message; if (typeof d?.content === "string") content += d.content; } catch { /* skip */ }
    }
  } else { try { j = JSON.parse(raw); content = String(j?.choices?.[0]?.message?.content ?? ""); } catch { return { ok: false, error: "Respons AI Router bukan JSON" }; } }
  const u = j?.usage ?? {};
  return { ok: true, content, usage: { model: j?.model ?? router.model, input_tokens: u.prompt_tokens ?? null, output_tokens: u.completion_tokens ?? null, total_tokens: u.total_tokens ?? null, cost: typeof u.cost === "number" ? u.cost : null } };
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const s = content.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "");
  const a = s.indexOf("{"); const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

const STATUSES: FeatureStatus[] = ["PRESERVED", "ADAPTED", "REPLACED", "UNSUPPORTED"];
const CLASSES: DepClass[] = ["SUPPORTED", "ADAPTABLE", "REPLACEABLE", "OPTIONAL", "UNSUPPORTED"];
const legacyStatus = (s: unknown): FeatureStatus => s === "COMPATIBLE" ? "PRESERVED" : s === "NOT COMPATIBLE" ? "UNSUPPORTED" : STATUSES.includes(s as FeatureStatus) ? s as FeatureStatus : "UNSUPPORTED";

export type AdaptOk = {
  ok: true; spec: BotSpec; features: Feature[]; dependencies: Dependency[]; diff: string[]; summary: string; warnings: string[];
  security: string[]; compatibility: Compatibility; entrypoint: string | null; library: string | null; usage: Usage; secondOpinion: boolean; bundle: { included: string[]; snippetOnly: string[] };
};

export async function aiAdapt(router: RouterCfg, files: Record<string, string>, scan: Scan, botName: string): Promise<AdaptOk | { ok: false; failure: Failure; usage: Usage }> {
  const bundle = buildBundle(files, scan);
  let usage: Usage = { model: router.model, input_tokens: null, output_tokens: null, total_tokens: null, cost: null, calls: 0 };
  const tried: string[] = [`Analisis statis ${scan.fileCount} file, ${scan.handlers.length} handler, ${scan.deps.length} dependency`, `Kirim ${bundle.included.length} file penuh + snippet ${bundle.snippetOnly.length} file ke AI Router Lapak VIP`];
  const fail = (stage: string, reason: string, next: string[], extra: Partial<Failure> = {}) => ({ ok: false as const, failure: { stage, reason, tried, next, ...extra }, usage });

  const first = await callRouter(router, SYS, `Nama bot: ${botName}\n\n${bundle.text}`, 85_000);
  if (!first.ok) return fail("AI ADAPTATION", first.error, ["Coba lagi (Retry)", "Periksa saldo/kunci AI Router Lapak VIP di tab AI Key admin"]);
  usage = addUsage(usage, first.usage);
  let out = parseJsonObject(first.content);
  if (!out) return fail("VALIDATING", "Hasil AI bukan JSON valid", ["Coba lagi (Retry) — model 'auto' kadang memilih model berbeda"]);
  let v = validateSpec(sanitizeObj(out.spec ?? {}));
  let secondOpinion = false;

  // Second opinion: static scan or AI claims handlers exist but spec came back empty/invalid.
  if (!v.ok && (scan.telegramLib || scan.handlers.length || out.has_telegram_handlers)) {
    secondOpinion = true;
    tried.push(`Validasi pertama gagal (${v.errors.slice(0, 2).join("; ")}) → verifikasi kedua fokus handler`);
    const focus = scan.handlers.slice(0, 120).map((h) => `${h.type}:${h.trigger}@${h.file}:${h.line}`).join("\n") || "(parser statis tidak menemukan handler, cari sendiri di source)";
    const second = await callRouter(router, SYS, `VERIFIKASI KEDUA. Percobaan sebelumnya menghasilkan spec tidak valid: ${v.errors.slice(0, 3).join("; ")}.\nApakah source memiliki handler Telegram? Jika YA, petakan setiap handler di bawah ke commands/hears/callbacks/buttons/fallback (minimal satu). Jika TIDAK ada sama sekali, set has_telegram_handlers=false dan compatibility=NOT_ADAPTABLE.\nHandler statis:\n${focus}\n\n${bundle.text.slice(0, 90_000)}`, 55_000);
    if (!second.ok) return fail("AI SECOND OPINION", second.error, ["Coba lagi (Retry)"]);
    usage = addUsage(usage, second.usage);
    const out2 = parseJsonObject(second.content);
    if (out2) { out = out2; v = validateSpec(sanitizeObj(out.spec ?? {})); }
  }
  if (!v.ok) {
    const noHandlers = out.has_telegram_handlers === false;
    return fail("VALIDATING", noHandlers ? "AI menyimpulkan source tidak memiliki handler Telegram yang bisa dipetakan" : `Spec hasil AI tidak valid: ${v.errors.slice(0, 3).join("; ")}`,
      noHandlers ? ["Pastikan ZIP berisi file bot Telegram, bukan hanya library/modul"] : ["Coba lagi (Retry)", "Jika berulang, kirim ZIP ke admin untuk dicek manual"], { file: scan.entry ?? undefined });
  }
  const spec = v.spec;

  // deno-lint-ignore no-explicit-any
  const features: Feature[] = (Array.isArray(out.features) ? out.features : []).slice(0, 150).map((f: any) => ({
    name: String(f?.name ?? "").slice(0, 80), kind: String(f?.kind ?? "other").slice(0, 20), file: f?.file ? String(f.file).slice(0, 120) : undefined,
    status: legacyStatus(f?.status), reason: f?.reason ? sanitizeSource(String(f.reason)).slice(0, 400) : undefined, alternative: f?.alternative ? String(f.alternative).slice(0, 300) : undefined,
  }));
  const warnings = (Array.isArray(out.warnings) ? out.warnings : []).slice(0, 30).map((w) => sanitizeSource(String(w)).slice(0, 300));
  // never let a statically detected handler vanish silently
  for (const c of scan.commands) if (!spec.commands[c]) {
    warnings.push(`Command ${c} ada di source tetapi tidak ada di hasil AI`);
    if (!features.some((f) => f.name === c)) features.push({ name: c, kind: "command", status: "UNSUPPORTED", reason: "Tidak berhasil diterjemahkan AI", file: scan.handlers.find((h) => h.trigger === c)?.file });
  }
  for (const h of scan.handlers.filter((x) => x.type === "callback")) if (!spec.callbacks?.[h.trigger] && !features.some((f) => f.name === h.trigger || f.name.includes(h.trigger))) {
    features.push({ name: h.trigger, kind: "callback", file: h.file, status: "UNSUPPORTED", reason: "Callback ada di source tetapi tidak dipetakan AI" });
  }
  for (const c of Object.keys(spec.commands)) if (!features.some((f) => f.name === c)) features.push({ name: c, kind: "command", status: "PRESERVED" });

  // dependencies: AI classification merged over static usage (static "unused" stays OPTIONAL)
  const aiDeps = new Map<string, Record<string, unknown>>();
  // deno-lint-ignore no-explicit-any
  for (const d of (Array.isArray(out.dependencies) ? out.dependencies : []) as any[]) if (d?.name) aiDeps.set(String(d.name), d);
  const dependencies: Dependency[] = scan.deps.map((d) => {
    const a = aiDeps.get(d.name);
    if (!a || d.files === 0) return d;
    const cls = CLASSES.includes(a.classification as DepClass) ? a.classification as DepClass : d.classification;
    return { ...d, classification: cls, usage: a.usage ? String(a.usage).slice(0, 200) : d.usage, replacement: a.replacement ? String(a.replacement).slice(0, 200) : d.replacement };
  });

  // compatibility is derived, never taken blindly from AI
  const unsupported = features.filter((f) => f.status === "UNSUPPORTED" || f.status === "REPLACED").length;
  let compatibility: Compatibility = out.compatibility === "NOT_ADAPTABLE" ? "NOT_ADAPTABLE" : unsupported || warnings.length ? "ADAPTABLE_WITH_CHANGES" : "FULLY_ADAPTABLE";
  if (handlerCount(spec) > 0 && compatibility === "NOT_ADAPTABLE") compatibility = "ADAPTABLE_WITH_CHANGES";

  return {
    ok: true, spec, features, dependencies, warnings, compatibility, secondOpinion, usage,
    diff: (Array.isArray(out.diff) ? out.diff : []).slice(0, 80).map((l) => sanitizeSource(String(l)).slice(0, 300)),
    summary: sanitizeSource(String(out.summary ?? "")).slice(0, 800),
    security: (Array.isArray(out.security_findings) ? out.security_findings : []).slice(0, 20).map((s) => sanitizeSource(String(s)).slice(0, 300)),
    entrypoint: typeof out.entrypoint === "string" ? out.entrypoint.slice(0, 120) : scan.entry, library: typeof out.library === "string" ? out.library.slice(0, 60) : scan.telegramLib,
    bundle: { included: bundle.included, snippetOnly: bundle.snippetOnly },
  };
}

const sanitizeObj = (o: unknown) => JSON.parse(sanitizeSource(JSON.stringify(o)));

export function runtimeReport() {
  return [
    ["Runtime", "Deno Edge Function (serverless, per request)"], ["Telegram Webhook", "SUPPORTED"], ["Command / teks / tombol inline / callback", "SUPPORTED (spec data)"],
    ["Eksekusi JS user", "NOT SUPPORTED (tanpa sandbox terisolasi)"], ["HTTP eksternal, database, cron, file, SSH buatan user", "NOT SUPPORTED di runtime bot toko"],
    ["Long-running process / polling", "NOT SUPPORTED → diubah ke webhook"], ["Batas waktu", "per request (detik), tanpa proses 24/7"],
  ];
}

export function buildAdaptedZip(spec: BotSpec, meta: Record<string, unknown>, diff: string[]) {
  return zipSync({
    [SPEC_FILE]: strToU8(JSON.stringify(spec, null, 2)),
    "ADAPTATION.json": strToU8(JSON.stringify(meta, null, 2)),
    "CHANGES.diff": strToU8(diff.join("\n") + "\n"),
  });
}

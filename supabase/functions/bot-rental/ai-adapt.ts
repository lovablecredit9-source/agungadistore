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
Balas HANYA JSON: {"spec":{...},"features":[{"name":"/start","kind":"command|message|callback|other","status":"COMPATIBLE|ADAPTED|NOT COMPATIBLE","reason":"..."}],"diff":["- baris lama","+ pengganti"],"summary":"..."}`;

export async function aiAdapt(files: Record<string, string>, scan: Scan, botName: string) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { ok: false as const, error: "Layanan AI belum dikonfigurasi" };
  const src = Object.entries(files).map(([n, t]) => `// FILE: ${n}\n${t.replace(TOKEN_LIKE, "<REDACTED_TOKEN>")}`).join("\n\n").slice(0, 120000);
  const user = `Nama bot: ${botName}\nCommand terdeteksi statis: ${scan.commands.join(", ") || "-"}\nCallback: ${scan.callbacks}\n\n${src}`;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", response_format: { type: "json_object" }, messages: [{ role: "system", content: SYS }, { role: "user", content: user }] }),
  });
  if (r.status === 429) return { ok: false as const, error: "AI sedang sibuk (batas permintaan). Coba lagi sebentar." };
  if (r.status === 402) return { ok: false as const, error: "Kredit AI habis. Hubungi admin." };
  if (!r.ok) return { ok: false as const, error: `AI gagal (HTTP ${r.status})` };
  const j = await r.json();
  let out: { spec?: unknown; features?: Feature[]; diff?: string[]; summary?: string };
  try { out = JSON.parse(String(j.choices?.[0]?.message?.content ?? "").replace(/^```json\s*|```$/g, "")); } catch { return { ok: false as const, error: "Hasil AI bukan JSON valid" }; }
  const specRaw = JSON.parse(JSON.stringify(out.spec ?? {}).replace(TOKEN_LIKE, "<REDACTED_TOKEN>"));
  const v = validateSpec(specRaw);
  if (!v.ok) return { ok: false as const, error: "Validasi hasil AI gagal: " + v.errors.slice(0, 3).join("; ") };
  const features = (Array.isArray(out.features) ? out.features : []).slice(0, 80).map((f) => ({
    name: String(f.name ?? "").slice(0, 60), kind: String(f.kind ?? "other").slice(0, 20),
    status: (["COMPATIBLE", "ADAPTED", "NOT COMPATIBLE"].includes(f.status) ? f.status : "NOT COMPATIBLE") as Feature["status"],
    reason: f.reason ? String(f.reason).slice(0, 300) : undefined,
  }));
  // Every statically detected command must be present in the spec or flagged; never silently dropped.
  for (const c of scan.commands) if (!v.spec.commands[c] && !features.some((f) => f.name === c)) features.push({ name: c, kind: "command", status: "NOT COMPATIBLE", reason: "Command ada di source tetapi tidak berhasil diterjemahkan AI" });
  for (const c of Object.keys(v.spec.commands)) if (!features.some((f) => f.name === c)) features.push({ name: c, kind: "command", status: "COMPATIBLE" });
  const diff = (Array.isArray(out.diff) ? out.diff : []).slice(0, 60).map((l) => String(l).replace(TOKEN_LIKE, "<REDACTED_TOKEN>").slice(0, 300));
  return { ok: true as const, spec: v.spec, features, diff, summary: String(out.summary ?? "").slice(0, 600) };
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

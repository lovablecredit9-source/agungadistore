// Webhook-compatible bot spec ("adistore-bot.json"). Pure data: the store's own code
// interprets it per Telegram update. No user code is ever executed.
// Shared by bot-rental (validation on upload), bot-hook (runtime) and Vitest.

export const SPEC_FILE = "adistore-bot.json";
export const MAX_COMMANDS = 50;
export const MAX_REPLY = 4000;
export const VARS = ["first_name", "username", "chat_id", "user_id", "text", "bot_name", "version", "status", "expires_at", "time_left", "transaction_id"] as const;

export type Button = { text: string; data?: string; url?: string };
export type BotSpec = {
  name?: string;
  version?: string;
  /** "/cmd" -> reply. May be empty when the bot works through text/buttons only. */
  commands: Record<string, string>;
  /** exact text (case-insensitive) -> reply, e.g. Telegraf bot.hears("Menu") */
  hears?: Record<string, string>;
  /** callback_data -> reply, e.g. Telegraf bot.action("buy") */
  callbacks?: Record<string, string>;
  /** inline keyboard per handler key: "/cmd", "hears:<text>", "cb:<data>" */
  buttons?: Record<string, Button[][]>;
  fallback: { mode: "echo"; prefix?: string } | { mode: "text"; text: string } | { mode: "none" };
  unknown_command?: string;
};

export type CompatReport = { compatible: boolean; runtime: string; reasons: string[]; dependencies: string[]; commands?: string[] };

const CMD_RE = /^\/[a-z0-9_]{1,32}$/;
export const MAX_MAP = 300;

function textMap(raw: unknown, field: string, errors: string[], keyOk: (k: string) => boolean, norm: (k: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) { errors.push(`Field "${field}" harus objek`); return out; }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_MAP) errors.push(`Maksimal ${MAX_MAP} entri di ${field}`);
  for (const [k0, v] of entries.slice(0, MAX_MAP)) {
    const k = norm(k0);
    if (!keyOk(k)) { errors.push(`Kunci ${field} tidak valid: ${k0.slice(0, 40)}`); continue; }
    if (typeof v !== "string" || !v.trim()) { errors.push(`Balasan ${field} ${k.slice(0, 40)} wajib teks`); continue; }
    if (v.length > MAX_REPLY) { errors.push(`Balasan ${field} ${k.slice(0, 40)} melebihi ${MAX_REPLY} karakter`); continue; }
    out[k] = v;
  }
  return out;
}

function buttonMap(raw: unknown, errors: string[]): Record<string, Button[][]> {
  const out: Record<string, Button[][]> = {};
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) { errors.push('Field "buttons" harus objek'); return out; }
  for (const [k, rows] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_MAP)) {
    if (!Array.isArray(rows)) continue;
    const clean: Button[][] = [];
    for (const row of rows.slice(0, 10)) {
      if (!Array.isArray(row)) continue;
      const r: Button[] = [];
      for (const b of row.slice(0, 8)) {
        if (!b || typeof b !== "object") continue;
        const x = b as Record<string, unknown>;
        const text = typeof x.text === "string" ? x.text.slice(0, 64) : "";
        if (!text) continue;
        if (typeof x.url === "string" && /^https:\/\//.test(x.url)) r.push({ text, url: x.url.slice(0, 500) });
        else if (typeof x.data === "string" && x.data && new TextEncoder().encode(x.data).length <= 64) r.push({ text, data: x.data });
      }
      if (r.length) clean.push(r);
    }
    if (clean.length) out[k.slice(0, 80)] = clean;
  }
  return out;
}

/** Validates parsed JSON from adistore-bot.json. Returns spec or list of problems. */
export function validateSpec(raw: unknown): { ok: true; spec: BotSpec } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["adistore-bot.json harus berupa objek JSON"] };
  const r = raw as Record<string, unknown>;
  if (r.commands !== undefined && (typeof r.commands !== "object" || Array.isArray(r.commands) || r.commands === null)) errors.push('Field "commands" wajib berupa objek, contoh {"/start": "Halo"}');
  const commands = textMap(r.commands, "commands", errors, (k) => CMD_RE.test(k), (k) => k.trim().toLowerCase());
  const hears = textMap(r.hears, "hears", errors, (k) => k.length > 0 && k.length <= 100, (k) => k.trim().toLowerCase());
  const callbacks = textMap(r.callbacks, "callbacks", errors, (k) => k.length > 0 && new TextEncoder().encode(k).length <= 64, (k) => k);
  const buttons = buttonMap(r.buttons, errors);
  let fallback: BotSpec["fallback"] = { mode: "none" };
  const fb = r.fallback;
  if (fb === "echo") fallback = { mode: "echo" };
  else if (fb && typeof fb === "object") {
    const f = fb as Record<string, unknown>;
    if (f.mode === "echo") fallback = { mode: "echo", prefix: typeof f.prefix === "string" ? f.prefix.slice(0, 200) : undefined };
    else if (f.mode === "text" && typeof f.text === "string" && f.text.length <= MAX_REPLY) fallback = { mode: "text", text: f.text };
    else if (f.mode !== "none") errors.push('Field "fallback" harus "echo", {mode:"echo"}, {mode:"text",text}, atau {mode:"none"}');
  } else if (fb !== undefined && fb !== null && fb !== "none") errors.push('Field "fallback" tidak valid');
  const handlerCount = Object.keys(commands).length + Object.keys(hears).length + Object.keys(callbacks).length + (fallback.mode !== "none" ? 1 : 0);
  if (!errors.length && handlerCount === 0) errors.push("Tidak ada handler: isi minimal satu dari commands, hears, callbacks, atau fallback");
  const unknown = typeof r.unknown_command === "string" && r.unknown_command.trim() && !isAnalysisNote(r.unknown_command) ? r.unknown_command.slice(0, MAX_REPLY) : undefined;
  if (errors.length) return { ok: false, errors };
  const spec: BotSpec = { name: typeof r.name === "string" ? r.name.slice(0, 60) : undefined, version: typeof r.version === "string" ? r.version.slice(0, 20) : undefined, commands, fallback, unknown_command: unknown };
  if (Object.keys(hears).length) spec.hears = hears;
  if (Object.keys(callbacks).length) spec.callbacks = callbacks;
  if (Object.keys(buttons).length) spec.buttons = buttons;
  return { ok: true, spec };
}

/** Number of handlers (commands + text triggers + callbacks + fallback). */
export function handlerCount(spec: BotSpec): number {
  return Object.keys(spec.commands).length + Object.keys(spec.hears ?? {}).length + Object.keys(spec.callbacks ?? {}).length + (spec.fallback.mode !== "none" ? 1 : 0);
}

/** Reasons a Node.js project cannot run on the serverless webhook runtime. */
export function nodeIncompatibility(pkg: Record<string, unknown> | null, jsFiles: string[]): CompatReport {
  const deps = Object.keys({ ...(pkg?.dependencies as object ?? {}), ...(pkg?.devDependencies as object ?? {}) });
  const reasons = [
    "Bot tidak kompatibel dengan runtime serverless saat ini.",
    "Kode JavaScript milik user tidak dapat dijalankan dengan aman: runtime bawaan tidak punya sandbox terisolasi (kode akan berjalan di server yang sama dengan database & kunci rahasia toko).",
  ];
  if (deps.length) reasons.push(`Dependency yang membutuhkan proses Node.js: ${deps.slice(0, 15).join(", ")}.`);
  const polling = deps.filter((d) => ["telegraf", "node-telegram-bot-api", "grammy", "@whiskeysockets/baileys", "whatsapp-web.js"].includes(d));
  if (polling.length) reasons.push(`${polling.join(", ")} memakai proses 24/7 (polling/socket) yang tidak didukung runtime webhook.`);
  if (!pkg && jsFiles.length) reasons.push(`Ditemukan file JS (${jsFiles.slice(0, 5).join(", ")}) tanpa ${SPEC_FILE}.`);
  reasons.push(`Agar kompatibel, tambahkan file ${SPEC_FILE} berisi daftar command & balasan.`);
  return { compatible: false, runtime: "nodejs", reasons, dependencies: deps };
}

/** Rejects unsafe archive paths (traversal, absolute, drive letters, backslashes, NUL). */
export function unsafePath(name: string): boolean {
  return !name || name.includes("\0") || name.includes("\\") || name.startsWith("/") || /^[a-zA-Z]:/.test(name) || name.split("/").some((p) => p === "..");
}

export type ReplyCtx = Partial<Record<(typeof VARS)[number], string>>;

export function renderTemplate(t: string, ctx: ReplyCtx): string {
  return t.replace(/\{([a-z_]+)\}/g, (m, k) => (k in ctx ? String(ctx[k as keyof ReplyCtx] ?? "") : m)).slice(0, MAX_REPLY);
}

/** Telegram inline keyboard for a handler key, or undefined. */
export function keyboardFor(spec: BotSpec, key: string | null) {
  const rows = key ? spec.buttons?.[key] : undefined;
  if (!rows?.length) return undefined;
  return { inline_keyboard: rows.map((r) => r.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))) };
}

/** True for adapter/AI analysis notes that must never be sent to Telegram users as a reply. */
export function isAnalysisNote(t: string): boolean {
  const s = t.toLowerCase();
  return /terdeteksi di source|tidak ada handler|detected in (the )?source|no (explicit )?(fallback|handler)|unknown_command/.test(s);
}

/** "/cmd@Bot arg" -> { cmd: "/cmd", args: "arg" } (bot mention stripped, lowercased). */
export function parseCommand(text: string): { cmd: string; args: string } | null {
  const m = text.trim().match(/^(\/[A-Za-z0-9_]{1,32})(?:@[A-Za-z0-9_]{3,64})?(?:\s+([\s\S]*))?$/);
  return m ? { cmd: m[1].toLowerCase(), args: (m[2] ?? "").trim() } : null;
}

/** Decide the reply for one message. Returns null when the bot should stay silent. */
export function replyFor(spec: BotSpec, text: string, ctx: ReplyCtx): { reply: string | null; isCommand: boolean; key?: string | null } {
  const t = text.trim();
  if (t.startsWith("/")) {
    const cmd = parseCommand(t)?.cmd ?? t.split(/\s+/)[0].split("@")[0].toLowerCase();
    const tpl = spec.commands[cmd];
    if (tpl) return { reply: renderTemplate(tpl, ctx), isCommand: true, key: cmd };
    const uc = spec.unknown_command && !isAnalysisNote(spec.unknown_command) ? spec.unknown_command : null;
    return { reply: uc ? renderTemplate(uc, ctx) : null, isCommand: true, key: null };
  }
  const h = spec.hears?.[t.toLowerCase()];
  if (h) return { reply: renderTemplate(h, ctx), isCommand: false, key: `hears:${t.toLowerCase()}` };
  if (spec.fallback.mode === "echo") return { reply: ((spec.fallback.prefix ? renderTemplate(spec.fallback.prefix, ctx) : "") + t).slice(0, MAX_REPLY) || null, isCommand: false, key: null };
  if (spec.fallback.mode === "text") return { reply: renderTemplate(spec.fallback.text, ctx), isCommand: false, key: null };
  return { reply: null, isCommand: false, key: null };
}

/** Reply for an inline button press. */
export function callbackReply(spec: BotSpec, data: string, ctx: ReplyCtx): { reply: string | null; key: string } {
  const tpl = spec.callbacks?.[data];
  return { reply: tpl ? renderTemplate(tpl, ctx) : null, key: `cb:${data}` };
}

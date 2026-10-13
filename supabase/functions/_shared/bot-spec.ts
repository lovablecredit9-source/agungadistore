// Webhook-compatible bot spec ("adistore-bot.json"). Pure data: the store's own code
// interprets it per Telegram update. No user code is ever executed.
// Shared by bot-rental (validation on upload), bot-hook (runtime) and Vitest.

export const SPEC_FILE = "adistore-bot.json";
export const MAX_COMMANDS = 50;
export const MAX_REPLY = 4000;
export const VARS = ["first_name", "username", "chat_id", "user_id", "text", "bot_name", "version", "status", "expires_at", "time_left", "transaction_id"] as const;

export type BotSpec = {
  name?: string;
  version?: string;
  commands: Record<string, string>;
  fallback: { mode: "echo"; prefix?: string } | { mode: "text"; text: string } | { mode: "none" };
  unknown_command?: string;
};

export type CompatReport = { compatible: boolean; runtime: string; reasons: string[]; dependencies: string[]; commands?: string[] };

const CMD_RE = /^\/[a-z0-9_]{1,32}$/;

/** Validates parsed JSON from adistore-bot.json. Returns spec or list of problems. */
export function validateSpec(raw: unknown): { ok: true; spec: BotSpec } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["adistore-bot.json harus berupa objek JSON"] };
  const r = raw as Record<string, unknown>;
  const cmds = r.commands;
  const commands: Record<string, string> = {};
  if (!cmds || typeof cmds !== "object" || Array.isArray(cmds)) errors.push("Field \"commands\" wajib berupa objek, contoh {\"/start\": \"Halo\"}");
  else {
    const entries = Object.entries(cmds as Record<string, unknown>);
    if (entries.length === 0) errors.push("Minimal 1 command");
    if (entries.length > MAX_COMMANDS) errors.push(`Maksimal ${MAX_COMMANDS} command`);
    for (const [k, v] of entries.slice(0, MAX_COMMANDS)) {
      const key = k.trim().toLowerCase();
      if (!CMD_RE.test(key)) { errors.push(`Nama command tidak valid: ${k.slice(0, 40)}`); continue; }
      if (typeof v !== "string" || !v.trim()) { errors.push(`Balasan ${key} wajib teks`); continue; }
      if (v.length > MAX_REPLY) { errors.push(`Balasan ${key} melebihi ${MAX_REPLY} karakter`); continue; }
      commands[key] = v;
    }
  }
  let fallback: BotSpec["fallback"] = { mode: "none" };
  const fb = r.fallback;
  if (fb === "echo") fallback = { mode: "echo" };
  else if (fb && typeof fb === "object") {
    const f = fb as Record<string, unknown>;
    if (f.mode === "echo") fallback = { mode: "echo", prefix: typeof f.prefix === "string" ? f.prefix.slice(0, 200) : undefined };
    else if (f.mode === "text" && typeof f.text === "string" && f.text.length <= MAX_REPLY) fallback = { mode: "text", text: f.text };
    else if (f.mode !== "none") errors.push("Field \"fallback\" harus \"echo\", {mode:\"echo\"}, {mode:\"text\",text}, atau {mode:\"none\"}");
  } else if (fb !== undefined && fb !== null && fb !== "none") errors.push("Field \"fallback\" tidak valid");
  const unknown = typeof r.unknown_command === "string" ? r.unknown_command.slice(0, MAX_REPLY) : undefined;
  if (errors.length) return { ok: false, errors };
  return { ok: true, spec: { name: typeof r.name === "string" ? r.name.slice(0, 60) : undefined, version: typeof r.version === "string" ? r.version.slice(0, 20) : undefined, commands, fallback, unknown_command: unknown } };
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

/** Decide the reply for one message. Returns null when the bot should stay silent. */
export function replyFor(spec: BotSpec, text: string, ctx: ReplyCtx): { reply: string | null; isCommand: boolean } {
  const t = text.trim();
  if (t.startsWith("/")) {
    const cmd = t.split(/\s+/)[0].split("@")[0].toLowerCase();
    const tpl = spec.commands[cmd];
    if (tpl) return { reply: renderTemplate(tpl, ctx), isCommand: true };
    return { reply: spec.unknown_command ? renderTemplate(spec.unknown_command, ctx) : null, isCommand: true };
  }
  if (spec.fallback.mode === "echo") return { reply: ((spec.fallback.prefix ? renderTemplate(spec.fallback.prefix, ctx) : "") + t).slice(0, MAX_REPLY) || null, isCommand: false };
  if (spec.fallback.mode === "text") return { reply: renderTemplate(spec.fallback.text, ctx), isCommand: false };
  return { reply: null, isCommand: false };
}

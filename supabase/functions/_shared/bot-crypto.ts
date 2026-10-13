// AES-GCM encryption for user bot tokens (key = BOT_TOKEN_KEY secret) and per-bot webhook secret.
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey() {
  const raw = Deno.env.get("BOT_TOKEN_KEY");
  if (!raw) throw new Error("BOT_TOKEN_KEY missing");
  const h = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc.encode(token)));
  return `enc:v1:${b64(iv)}:${b64(ct)}`;
}

/** Accepts legacy plaintext rows too (caller should re-encrypt them). */
export async function decryptToken(stored: string | null): Promise<string | null> {
  if (!stored) return null;
  if (!stored.startsWith("enc:v1:")) return stored;
  const [, , iv, ct] = stored.split(":");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(), unb64(ct));
  return dec.decode(pt);
}

/** Telegram secret_token for a bot's webhook (A-Z a-z 0-9 _ -, max 256). */
export async function hookSecret(botId: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(Deno.env.get("BOT_HOOK_SECRET") ?? ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`bot-hook:${botId}`)));
  return Array.from(sig, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string | null, b: string) {
  if (!a || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Strip anything token-shaped before text reaches logs/UI. */
export const redact = (s: string) => s.replace(/\d{6,12}:[A-Za-z0-9_-]{30,60}/g, "[token]");

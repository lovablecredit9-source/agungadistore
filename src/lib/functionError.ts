import { supabase } from "@/integrations/supabase/client";

const GENERIC = /non-2xx|Failed to send a request|FunctionsHttpError|FunctionsFetchError/i;

/** Pick the most human message: data.error → data.message → error.message → fallback. */
export function getFunctionError(error: unknown, data?: unknown, fallback = "Terjadi kesalahan. Coba lagi sebentar."): string {
  const d = data as { error?: unknown; message?: unknown } | null | undefined;
  if (d && typeof d.error === "string" && d.error.trim()) return d.error;
  if (d && typeof d.message === "string" && d.message.trim() && d.error) return d.message;
  const msg = (error as { message?: string } | null)?.message;
  if (msg && !GENERIC.test(msg)) return msg;
  if (msg && /Failed to send|FetchError/i.test(msg)) return "Koneksi ke server gagal. Periksa internet kamu lalu coba lagi.";
  return fallback;
}

let installed = false;

/**
 * Wraps supabase.functions.invoke once so every caller gets the server's JSON error body as `data`
 * and a readable `error.message` instead of "Edge Function returned a non-2xx status code".
 * `error` stays non-null, so existing control flow is unchanged.
 */
export function installFunctionErrorUnwrap() {
  if (installed) return;
  installed = true;
  const fns = supabase.functions;
  const original = fns.invoke.bind(fns);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fns as any).invoke = async (name: string, options?: any) => {
    const res = await original(name, options);
    if (!res.error) return res;
    let body: unknown = null;
    const ctx = (res.error as { context?: Response }).context;
    if (ctx && typeof (ctx as Response).clone === "function") {
      try { body = await ctx.clone().json(); } catch { /* not JSON */ }
    }
    const message = getFunctionError(res.error, body);
    const err = Object.assign(new Error(message), { name: res.error.name, context: ctx, status: ctx?.status });
    return { data: body ?? res.data, error: err };
  };
}

import { supabase } from "@/integrations/supabase/client";

/**
 * Calls the existing `luck-royale-nyawa` function. On a 4xx the server sends `{ error: "..." }`
 * (e.g. "Butuh 740 💎"); supabase-js hides that behind a generic "non-2xx" error, so we read the
 * body and return it as `data` — callers already show `data.error` to the user.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeRoyale(options: { body: Record<string, unknown> }): Promise<{ data: any; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", options);
  if (!error) return { data, error: null };
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.clone().json();
      if (body && typeof body.error === "string") return { data: body, error: null };
    } catch { /* body not JSON — fall through */ }
  }
  return { data: null, error };
}

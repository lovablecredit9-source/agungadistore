import { supabase } from "@/integrations/supabase/client";

/** Pesan error asli dari fungsi server (status 4xx tidak mengisi `data`). */
export async function readFunctionError(error: unknown): Promise<string | null> {
  try {
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.clone().json();
      return body?.error || body?.reason || null;
    }
  } catch { /* abaikan */ }
  return null;
}

/** Verifikasi PIN akun saldo. Mengembalikan pesan yang tepat (PIN salah / belum dibuat / terlalu banyak percobaan). */
export async function verifyPin(visitorId: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  const clean = String(pin || "").replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "PIN harus 6 digit angka" };
  const { data, error } = await supabase.functions.invoke("manage-pin", {
    body: { action: "verify", visitorId, pin: clean },
  });
  if (!error && data?.valid) return { ok: true };
  const msg = data?.error || data?.reason || (await readFunctionError(error)) || "PIN salah";
  return { ok: false, error: msg };
}

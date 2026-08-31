// Shared AI provider resolver.
// Admin memilih provider di tab "AI Key" (tabel public.ai_providers).
// Kalau provider terpilih gagal dan auto_fallback aktif -> otomatis pakai Lovable AI.

const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

export type AiProvider = {
  label: string;
  provider_type: string;
  base_url: string;
  api_key: string | null;
  model: string;
  auto_fallback: boolean;
};

export const lovableProvider = (model = "google/gemini-2.5-flash"): AiProvider => ({
  label: "Lovable AI",
  provider_type: "lovable",
  base_url: LOVABLE_BASE,
  api_key: Deno.env.get("LOVABLE_API_KEY") ?? null,
  model,
  auto_fallback: true,
});

/** Ambil provider aktif dari database (butuh supabase client service role). */
export async function getAiProvider(sb: any, fallbackModel = "google/gemini-2.5-flash"): Promise<AiProvider> {
  try {
    const { data } = await sb
      .from("ai_providers")
      .select("label,provider_type,base_url,api_key,model,auto_fallback,is_active")
      .eq("is_selected", true)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return lovableProvider(fallbackModel);
    const isLovable = data.provider_type === "lovable" || !data.api_key;
    return {
      label: data.label,
      provider_type: isLovable ? "lovable" : "custom",
      base_url: (isLovable ? LOVABLE_BASE : data.base_url || LOVABLE_BASE).replace(/\/$/, ""),
      api_key: isLovable ? Deno.env.get("LOVABLE_API_KEY") ?? null : data.api_key,
      model: data.model || fallbackModel,
      auto_fallback: data.auto_fallback !== false,
    };
  } catch {
    return lovableProvider(fallbackModel);
  }
}

async function callChat(p: AiProvider, body: Record<string, unknown>) {
  return await fetch(`${p.base_url}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, model: (body.model as string) || p.model }),
  });
}

/**
 * Panggil chat completions memakai provider admin, otomatis beralih ke Lovable
 * jika gagal (dan auto_fallback aktif). Mengembalikan Response mentah + provider dipakai.
 */
export async function aiChatCompletion(
  sb: any,
  body: Record<string, unknown>,
  opts: { fallbackModel?: string } = {},
): Promise<{ resp: Response; provider: AiProvider; usedFallback: boolean }> {
  const fallbackModel = opts.fallbackModel || "google/gemini-2.5-flash";
  const primary = await getAiProvider(sb, fallbackModel);

  let resp: Response | null = null;
  try {
    resp = await callChat(primary, body);
  } catch (_) {
    resp = null;
  }

  const failed = !resp || (!resp.ok && resp.status !== 429 && resp.status !== 402);
  if (failed && primary.provider_type !== "lovable" && primary.auto_fallback) {
    const fb = lovableProvider(fallbackModel);
    if (fb.api_key) {
      try {
        const r2 = await callChat(fb, { ...body, model: fallbackModel });
        return { resp: r2, provider: fb, usedFallback: true };
      } catch (_) { /* ignore */ }
    }
  }

  if (!resp) {
    return {
      resp: new Response(JSON.stringify({ error: "AI provider unreachable" }), { status: 502 }),
      provider: primary,
      usedFallback: false,
    };
  }
  return { resp, provider: primary, usedFallback: false };
}

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
  if (!p.api_key) {
    return new Response(JSON.stringify({
      error: { message: `${p.label} belum memiliki API key` },
    }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const authHeaders = p.provider_type === "lovable"
    ? { "Lovable-API-Key": p.api_key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" }
    : { Authorization: `Bearer ${p.api_key}` };

  return await fetch(`${p.base_url}/chat/completions`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    // Selalu gunakan model milik provider aktif. Model dari pemanggil adalah
    // kandidat Lovable/fallback dan biasanya tidak dikenal router custom.
    body: JSON.stringify({ ...body, stream: false, model: p.model }),
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

  // Untuk provider custom (router admin), 429/402 juga dianggap gagal supaya
  // otomatis dialihkan ke Lovable AI. Hanya provider Lovable yang meneruskan
  // 429/402 apa adanya (tidak ada tujuan fallback lain).
  const failed = !resp || (!resp.ok && (primary.provider_type !== "lovable" || (resp.status !== 429 && resp.status !== 402)));
  if (failed && primary.provider_type !== "lovable" && primary.auto_fallback) {
    const fb = lovableProvider(fallbackModel);
    if (fb.api_key) {
      try {
        const r2 = await callChat(fb, { ...body, model: fallbackModel });
        return { resp: await normalizeAiResponse(r2), provider: fb, usedFallback: true };
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
  return { resp: await normalizeAiResponse(resp), provider: primary, usedFallback: false };
}


/** Sebagian router (mis. Marketku) selalu membalas SSE. Ubah jadi JSON chat completion biasa. */
export async function normalizeAiResponse(resp: Response): Promise<Response> {
  const ct = resp.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream")) return resp;
  const raw = await resp.text();
  let content = "";
  const tools: Record<number, { id?: string; name?: string; args: string }> = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload);
      const d = j?.choices?.[0]?.delta || j?.choices?.[0]?.message;
      if (typeof d?.content === "string") content += d.content;
      for (const tc of d?.tool_calls || []) {
        const i = tc.index ?? 0;
        tools[i] ||= { args: "" };
        if (tc.id) tools[i].id = tc.id;
        if (tc.function?.name) tools[i].name = tc.function.name;
        if (tc.function?.arguments) tools[i].args += tc.function.arguments;
      }
    } catch { /* ignore */ }
  }
  const tool_calls = Object.values(tools).map((t, i) => ({
    id: t.id || `call_${i}`,
    type: "function",
    function: { name: t.name || "", arguments: t.args },
  }));
  return new Response(JSON.stringify({
    choices: [{ index: 0, message: { role: "assistant", content, ...(tool_calls.length ? { tool_calls } : {}) }, finish_reason: "stop" }],
  }), { status: resp.status, headers: { "Content-Type": "application/json" } });
}

/**
 * Drop-in pengganti `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", init)`.
 * Otomatis memakai provider/router yang dipilih admin di tab "AI Key",
 * dengan fallback ke Lovable AI bila router gagal.
 */
export async function aiFetch(_url: string, init: { body: string; headers?: unknown; method?: string }): Promise<Response> {
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(init.body); } catch { /* ignore */ }
  const model = typeof body.model === "string" ? body.model : "";

  // Model khusus (image / modalities) tetap lewat Lovable AI.
  if (model.includes("image") || body.modalities) {
    const p = lovableProvider(model || "google/gemini-2.5-flash");
    return await normalizeAiResponse(await callChat(p, body));
  }

  let sb: any = null;
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      sb = createClient(url, key);
    }
  } catch { /* ignore */ }

  const { model: _drop, ...rest } = body;
  const { resp } = await aiChatCompletion(sb, rest, { fallbackModel: model || "google/gemini-2.5-flash" });
  return await normalizeAiResponse(resp);
}

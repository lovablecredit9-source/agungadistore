const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const providerType = body.provider_type === "lovable" ? "lovable" : "custom";
    const baseUrl = String(
      providerType === "lovable" ? LOVABLE_BASE : (body.base_url || LOVABLE_BASE),
    ).replace(/\/+$/, "");
    const apiKey = providerType === "lovable"
      ? Deno.env.get("LOVABLE_API_KEY")
      : String(body.api_key || "");
    const model = String(body.model || "").trim();
    const listOnly = body.list_only === true;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "API key belum diisi" },
        { status: 200, headers: corsHeaders },
      );
    }

    const auth = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

    // 1) Ambil daftar model otomatis dari router
    let models: string[] = [];
    let modelsError: string | null = null;
    try {
      const mr = await fetch(`${baseUrl}/models`, { headers: auth });
      if (mr.ok) {
        const mj = await mr.json();
        const arr = Array.isArray(mj?.data) ? mj.data : Array.isArray(mj?.models) ? mj.models : [];
        models = arr
          .map((m: any) => (typeof m === "string" ? m : m?.id || m?.name))
          .filter((x: any) => typeof x === "string");
      } else {
        modelsError = `Daftar model gagal (HTTP ${mr.status})`;
      }
    } catch (e) {
      modelsError = `Daftar model gagal: ${e instanceof Error ? e.message : "error"}`;
    }

    if (listOnly) {
      return Response.json({ ok: models.length > 0, models, error: modelsError }, { headers: corsHeaders });
    }

    // 2) Ping chat completions
    const pingModel = model || models[0] || "google/gemini-2.5-flash";
    const started = Date.now();
    let ok = false;
    let status = 0;
    let reply = "";
    let error: string | null = null;
    try {
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          model: pingModel,
          messages: [{ role: "user", content: "Balas satu kata: OK" }],
          max_tokens: 16,
        }),
      });
      status = r.status;
      const txt = await r.text();
      if (r.ok) {
        ok = true;
        try {
          reply = JSON.parse(txt)?.choices?.[0]?.message?.content ?? "";
        } catch { reply = txt.slice(0, 120); }
      } else {
        error = `HTTP ${r.status}: ${txt.slice(0, 200)}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Koneksi gagal";
    }

    return Response.json(
      { ok, status, latency_ms: Date.now() - started, model: pingModel, reply, models, models_error: modelsError, error },
      { headers: corsHeaders },
    );
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500, headers: corsHeaders },
    );
  }
});

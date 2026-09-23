const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

/** fetch dengan batas waktu supaya test tidak menggantung lama. */
async function fetchTimeout(url: string, init: RequestInit, ms: number) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Ambil isi pesan dari balasan JSON maupun SSE (router seperti Marketku). */
function extractReply(txt: string): string {
  try {
    const j = JSON.parse(txt);
    const c = j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.delta?.content;
    if (typeof c === "string" && c.trim()) return c.trim();
    if (Array.isArray(c)) {
      const joined = c.map((p: any) => (typeof p === "string" ? p : p?.text || "")).join("");
      if (joined.trim()) return joined.trim();
    }
  } catch { /* bukan JSON: coba SSE */ }

  let content = "";
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload);
      const d = j?.choices?.[0]?.delta ?? j?.choices?.[0]?.message;
      if (typeof d?.content === "string") content += d.content;
    } catch { /* ignore */ }
  }
  return content.trim();
}

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

    // 1) Ambil daftar model otomatis dari router (maks 10 detik)
    let models: string[] = [];
    let modelsError: string | null = null;
    try {
      const mr = await fetchTimeout(`${baseUrl}/models`, { headers: auth }, 10_000);
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
      modelsError = e instanceof Error && e.name === "AbortError"
        ? "Daftar model timeout (10 detik)"
        : `Daftar model gagal: ${e instanceof Error ? e.message : "error"}`;
    }

    if (listOnly) {
      return Response.json({ ok: models.length > 0, models, error: modelsError }, { headers: corsHeaders });
    }

    // 2) Ping chat completions (maks 25 detik, non-stream)
    const pingModel = model || models[0] || "google/gemini-2.5-flash";
    const started = Date.now();
    let ok = false;
    let status = 0;
    let reply = "";
    let error: string | null = null;
    try {
      const r = await fetchTimeout(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          model: pingModel,
          messages: [{ role: "user", content: "Balas satu kata: OK" }],
          stream: false,
        }),
      }, 25_000);
      status = r.status;
      const txt = await r.text();
      if (r.ok) {
        ok = true;
        reply = extractReply(txt) || "(balasan kosong)";
      } else {
        let detail = txt.slice(0, 200);
        try {
          const j = JSON.parse(txt);
          detail = j?.error?.message || j?.message || detail;
        } catch { /* ignore */ }
        error = `HTTP ${r.status}: ${detail}`;
      }
    } catch (e) {
      error = e instanceof Error && e.name === "AbortError"
        ? "Timeout 25 detik — router tidak membalas"
        : (e instanceof Error ? e.message : "Koneksi gagal");
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

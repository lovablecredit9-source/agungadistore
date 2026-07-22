// Proxy Telegram profile photo for a linked visitor.
// GET ?vid=<visitor_id>  -> image bytes (or 404 if no photo)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const vid = url.searchParams.get("vid") || "";
    if (!vid) return new Response("missing vid", { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: link } = await admin
      .from("telegram_user_links")
      .select("telegram_chat_id")
      .eq("visitor_id", vid)
      .maybeSingle();
    if (!link?.telegram_chat_id) return new Response("no link", { status: 404, headers: corsHeaders });

    const { data: cfg } = await admin.from("telegram_bot_config").select("bot_token").limit(1).maybeSingle();
    if (!cfg?.bot_token) return new Response("no bot", { status: 404, headers: corsHeaders });

    const photosResp = await fetch(
      `https://api.telegram.org/bot${cfg.bot_token}/getUserProfilePhotos?user_id=${link.telegram_chat_id}&limit=1`,
    );
    const photosJson = await photosResp.json();
    const sizes = photosJson?.result?.photos?.[0];
    if (!sizes || !sizes.length) return new Response("no photo", { status: 404, headers: corsHeaders });
    // Pick medium size (index 1) if available, else largest
    const pick = sizes[Math.min(1, sizes.length - 1)];
    const fileId = pick?.file_id;
    if (!fileId) return new Response("no photo", { status: 404, headers: corsHeaders });

    const fileResp = await fetch(`https://api.telegram.org/bot${cfg.bot_token}/getFile?file_id=${fileId}`);
    const fileJson = await fileResp.json();
    const filePath = fileJson?.result?.file_path;
    if (!filePath) return new Response("no path", { status: 404, headers: corsHeaders });

    const bin = await fetch(`https://api.telegram.org/file/bot${cfg.bot_token}/${filePath}`);
    if (!bin.ok) return new Response("fetch fail", { status: 502, headers: corsHeaders });
    const buf = await bin.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": bin.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response(String(e instanceof Error ? e.message : e), { status: 500, headers: corsHeaders });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Validate API key from header
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: keyData, error: keyErr } = await supabase
    .from("api_keys")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .maybeSingle();

  if (keyErr || !keyData) {
    return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update last_used_at
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "";

  try {
    let result: any = null;

    switch (endpoint) {
      case "products": {
        const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "sponsors": {
        const { data } = await supabase.from("sponsors").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "balances": {
        const { data } = await supabase.from("user_balances").select("*");
        result = data;
        break;
      }
      case "songs": {
        const { data } = await supabase.from("playlist_songs").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "deposits": {
        const { data } = await supabase.from("deposits").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "notifications": {
        if (req.method === "POST") {
          const body = await req.json();
          const { visitor_id, title, message, type } = body;
          if (!visitor_id || !title) {
            return new Response(JSON.stringify({ error: "visitor_id and title required" }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { data, error } = await supabase.from("notifications").insert({
            visitor_id, title, message: message || "", type: type || "info",
          }).select().single();
          if (error) throw error;
          result = data;
        } else {
          const vid = url.searchParams.get("visitor_id");
          let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
          if (vid) q = q.eq("visitor_id", vid);
          const { data } = await q;
          result = data;
        }
        break;
      }
      case "tokens": {
        const { data } = await supabase.from("tokens").select("*, products(title)").order("created_at", { ascending: false });
        result = data;
        break;
      }
      default:
        return new Response(JSON.stringify({
          error: "Unknown endpoint",
          available: ["products", "sponsors", "balances", "songs", "deposits", "notifications", "tokens"],
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

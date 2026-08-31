import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion } from "../_shared/ai-provider.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, songs, history, mood } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!Array.isArray(songs) || songs.length === 0) {
      return new Response(JSON.stringify({ error: "songs required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit untuk hemat token
    const songCatalog = songs.slice(0, 80).map((s: any) => `${s.id}|${s.title} - ${s.artist}`).join("\n");
    const recentHistory = Array.isArray(history) ? history.slice(0, 10).map((h: any) => `${h.title} - ${h.artist}`).join("; ") : "";

    let systemPrompt = "";
    let userPrompt = "";
    if (mode === "mood_radio") {
      systemPrompt = `Kamu kurator musik AI. Pilih 8-12 lagu dari katalog yang COCOK dengan mood "${mood}". Output JSON via tool.`;
      userPrompt = `Mood: ${mood}\n\nKatalog (id|judul - artis):\n${songCatalog}\n\nPilih lagu paling cocok mood "${mood}". Beri alasan singkat (max 1 kalimat).`;
    } else if (mode === "recommend") {
      systemPrompt = `Kamu kurator musik AI personal. Berdasarkan history dengar user, rekomendasikan 6-10 lagu lain dari katalog yang mirip atau pelengkap. Output JSON via tool.`;
      userPrompt = `History dengar: ${recentHistory || "(belum ada)"}\n\nKatalog:\n${songCatalog}\n\nRekomendasi lagu personal. Beri alasan singkat.`;
    } else {
      return new Response(JSON.stringify({ error: "mode invalid" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { resp: aiResp } = await aiChatCompletion(sb, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "curate_songs",
            description: "Return curated song list",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Judul radio/rekomendasi (singkat menarik)" },
                description: { type: "string", description: "Deskripsi 1 kalimat" },
                song_ids: { type: "array", items: { type: "string" }, description: "ID lagu dari katalog (urutan main)" },
              },
              required: ["title", "description", "song_ids"],
              additionalProperties: false,
            },
          },
        }],
      tool_choice: { type: "function", function: { name: "curate_songs" } },
    }, { fallbackModel: "google/gemini-2.5-flash" });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Terlalu banyak request, coba lagi sebentar" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Kuota AI habis, hubungi admin" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    let result: any;
    try { result = JSON.parse(tc.function.arguments); } catch {
      result = { title: "Mix", description: "Gagal parse AI", song_ids: [] };
    }
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

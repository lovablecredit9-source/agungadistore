import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { aiFetch } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { song_id, title, artist } = await req.json();
    if (!song_id || !title) {
      return new Response(JSON.stringify({ error: "song_id and title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // AI check for copyright
    const aiResponse = await aiFetch("chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Kamu adalah sistem pengecekan hak cipta musik. Analisis judul dan artis lagu, lalu tentukan apakah lagu tersebut kemungkinan dilindungi hak cipta atau bebas hak cipta. Jawab dalam format JSON:
{"is_copyrighted": true/false, "confidence": "high"/"medium"/"low", "reason": "penjelasan singkat", "recommendation": "approve"/"review"/"reject"}
- Jika lagu dikenal sebagai lagu populer dari artis terkenal = copyrighted, recommendation: reject
- Jika tidak dikenal atau original = kemungkinan bebas, recommendation: approve
- Jika ragu = recommendation: review (perlu review manual admin)`
          },
          {
            role: "user",
            content: `Cek hak cipta lagu:\nJudul: ${title}\nArtis: ${artist || "Tidak diketahui"}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "copyright_check",
            description: "Return copyright check result",
            parameters: {
              type: "object",
              properties: {
                is_copyrighted: { type: "boolean" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                reason: { type: "string" },
                recommendation: { type: "string", enum: ["approve", "review", "reject"] }
              },
              required: ["is_copyrighted", "confidence", "reason", "recommendation"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "copyright_check" } }
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      // Fallback: mark as review needed
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);
      await sb.from("public_songs").update({
        ai_check_result: JSON.stringify({ is_copyrighted: false, confidence: "low", reason: "AI tidak tersedia, perlu review manual", recommendation: "review" }),
        status: "pending"
      }).eq("id", song_id);

      return new Response(JSON.stringify({ recommendation: "review", reason: "AI tidak tersedia" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let result;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      result = JSON.parse(toolCall.function.arguments);
    } catch {
      result = { is_copyrighted: false, confidence: "low", reason: "Gagal parse AI response", recommendation: "review" };
    }

    // Update song with AI check result
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    let newStatus = "pending"; // default: perlu review admin
    if (result.recommendation === "reject" && result.confidence === "high") {
      newStatus = "rejected";
    }

    await sb.from("public_songs").update({
      ai_check_result: JSON.stringify(result),
      status: newStatus,
      admin_note: result.recommendation === "reject" ? `AI: ${result.reason}` : null
    }).eq("id", song_id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

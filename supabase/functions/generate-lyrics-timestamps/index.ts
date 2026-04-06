import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lyrics_text, song_duration, song_title, song_artist } = await req.json();

    if (!lyrics_text || typeof lyrics_text !== "string" || lyrics_text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "lyrics_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const durationInfo = song_duration ? `The song duration is approximately ${song_duration} seconds.` : "";
    const songInfo = [song_title, song_artist].filter(Boolean).join(" by ");

    const systemPrompt = `You are a lyrics timestamp generator. Given plain lyrics text, generate timestamps in LRC format.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Distribute timestamps evenly across the song duration
- Account for intro/outro instrumental sections
- Keep the original lyrics text exactly as provided
- Each line should have a unique timestamp
- Start timestamps slightly after 00:00 to account for intro
- ${durationInfo}`;

    const userPrompt = `Generate LRC timestamps for this song${songInfo ? ` "${songInfo}"` : ""}:

${lyrics_text}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, coba lagi nanti." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credit habis, silakan top up." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract only LRC lines from the response
    const lrcLines = content
      .split("\n")
      .filter((line: string) => line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/))
      .join("\n");

    return new Response(JSON.stringify({ lrc: lrcLines || content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lyrics-timestamps error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
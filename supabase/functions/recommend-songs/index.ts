import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitor_id } = await req.json();
    if (!visitor_id) throw new Error("visitor_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch all songs
    const { data: allSongs } = await sb.from("playlist_songs").select("id, title, artist, cover_url, duration, file_size, release_date, created_at, file_url");
    if (!allSongs || allSongs.length === 0) {
      return new Response(JSON.stringify({ recommended_ids: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch user's liked songs
    const { data: likedRows } = await sb.from("liked_songs").select("song_id").eq("visitor_id", visitor_id);
    const likedIds = new Set((likedRows || []).map((r: any) => r.song_id));

    // Build context for AI
    const likedSongs = allSongs.filter((s: any) => likedIds.has(s.id));
    const unlikedSongs = allSongs.filter((s: any) => !likedIds.has(s.id));

    if (unlikedSongs.length === 0) {
      // All songs are liked, just return random
      const shuffled = allSongs.sort(() => Math.random() - 0.5).slice(0, 6);
      return new Response(JSON.stringify({ recommended_ids: shuffled.map((s: any) => s.id) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback: random recommendations
      const shuffled = unlikedSongs.sort(() => Math.random() - 0.5).slice(0, 6);
      return new Response(JSON.stringify({ recommended_ids: shuffled.map((s: any) => s.id) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const likedInfo = likedSongs.map((s: any) => `"${s.title}" by ${s.artist}`).join(", ");
    const catalogInfo = unlikedSongs.map((s: any) => `ID:${s.id} - "${s.title}" by ${s.artist}`).join("\n");

    const prompt = likedSongs.length > 0
      ? `User likes these songs: ${likedInfo}\n\nFrom this catalog of songs they haven't liked yet, recommend up to 6 songs they would most likely enjoy. Consider genre similarity, artist style, and mood.\n\nCatalog:\n${catalogInfo}\n\nReturn ONLY the IDs of recommended songs, separated by commas. Nothing else.`
      : `From this music catalog, pick 6 diverse and popular-sounding songs to recommend to a new user:\n\n${catalogInfo}\n\nReturn ONLY the IDs of recommended songs, separated by commas. Nothing else.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a music recommendation engine. Return only comma-separated song IDs. No explanation." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      // Fallback on AI error
      const shuffled = unlikedSongs.sort(() => Math.random() - 0.5).slice(0, 6);
      return new Response(JSON.stringify({ recommended_ids: shuffled.map((s: any) => s.id) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Extract UUIDs from response
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const extractedIds = content.match(uuidPattern) || [];
    
    // Filter to only valid song IDs
    const validSongIds = new Set(allSongs.map((s: any) => s.id));
    let recommendedIds = extractedIds.filter((id: string) => validSongIds.has(id));
    
    // If AI didn't return enough, pad with random unliked songs
    if (recommendedIds.length < 4) {
      const remaining = unlikedSongs.filter((s: any) => !recommendedIds.includes(s.id)).sort(() => Math.random() - 0.5);
      for (const s of remaining) {
        if (recommendedIds.length >= 6) break;
        recommendedIds.push(s.id);
      }
    }

    return new Response(JSON.stringify({ recommended_ids: recommendedIds.slice(0, 6) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-songs error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

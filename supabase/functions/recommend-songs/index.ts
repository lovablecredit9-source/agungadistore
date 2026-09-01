import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { aiFetch } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  visitor_id: z.string().min(1).max(255),
});

type SongRow = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  duration: number | null;
  file_size: number | null;
  release_date: string | null;
  created_at: string;
  file_url: string;
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildFallbackRecommendations(allSongs: SongRow[], likedIds: Set<string>) {
  const unlikedSongs = allSongs.filter((song) => !likedIds.has(song.id));
  const source = unlikedSongs.length > 0 ? unlikedSongs : allSongs;
  return shuffle(source).slice(0, 6).map((song) => song.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { visitor_id } = parsed.data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Backend credentials are missing");
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: allSongs, error: songsError }, { data: likedRows, error: likesError }] = await Promise.all([
      sb.from("playlist_songs").select("id, title, artist, cover_url, duration, file_size, release_date, created_at, file_url").order("created_at", { ascending: false }),
      sb.from("liked_songs").select("song_id").eq("visitor_id", visitor_id),
    ]);

    if (songsError) throw songsError;
    if (likesError) throw likesError;

    const songs = (allSongs || []) as SongRow[];
    const likedIds = new Set((likedRows || []).map((row: { song_id: string }) => row.song_id));

    if (songs.length === 0) {
      return new Response(JSON.stringify({ recommended_ids: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fallbackIds = buildFallbackRecommendations(songs, likedIds);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ recommended_ids: fallbackIds, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const likedSongs = songs.filter((song) => likedIds.has(song.id));
    const candidateSongs = songs.filter((song) => !likedIds.has(song.id));
    const catalog = (candidateSongs.length > 0 ? candidateSongs : songs)
      .map((song) => `ID=${song.id} | title=${song.title} | artist=${song.artist}`)
      .join("\n");

    const userTaste = likedSongs.length > 0
      ? likedSongs.map((song) => `- ${song.title} — ${song.artist}`).join("\n")
      : "Belum ada lagu yang disukai. Pilih lagu yang cocok untuk pengguna baru dari katalog yang ada.";

    const aiResponse = await aiFetch("chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Kamu adalah mesin rekomendasi musik. Pilih maksimal 6 lagu dari katalog. Balas HANYA daftar ID dipisahkan koma, tanpa penjelasan.",
          },
          {
            role: "user",
            content: `Preferensi pengguna:\n${userTaste}\n\nKatalog lagu:\n${catalog}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("recommend-songs AI error:", aiResponse.status, errorText);
      return new Response(JSON.stringify({ recommended_ids: fallbackIds, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? "";
    const validSongIds = new Set(songs.map((song) => song.id));
    const extractedIds = Array.from(content.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)).map((match) => match[0]);
    const uniqueIds = [...new Set(extractedIds)].filter((id) => validSongIds.has(id));
    const recommendedIds = uniqueIds.length > 0 ? uniqueIds.slice(0, 6) : fallbackIds;

    return new Response(JSON.stringify({ recommended_ids: recommendedIds, source: uniqueIds.length > 0 ? "ai" : "fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("recommend-songs error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

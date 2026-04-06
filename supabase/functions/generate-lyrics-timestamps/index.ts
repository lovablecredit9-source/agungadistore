import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lyrics_text, song_duration, song_title, song_artist, file_url } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const durationInfo = song_duration ? `The song duration is approximately ${song_duration} seconds.` : "";
    const songInfo = [song_title, song_artist].filter(Boolean).join(" by ");
    const hasLyrics = lyrics_text && typeof lyrics_text === "string" && lyrics_text.trim().length > 0;

    // If we have a file_url and no manual lyrics, try to transcribe from audio
    if (!hasLyrics && file_url) {
      console.log("Downloading audio from:", file_url);
      
      // Download the audio file
      const audioResp = await fetch(file_url);
      if (!audioResp.ok) throw new Error("Failed to download audio file");
      
      const audioBytes = new Uint8Array(await audioResp.arrayBuffer());
      const base64Audio = btoa(String.fromCharCode(...audioBytes));
      
      // Determine mime type from URL
      let mimeType = "audio/mpeg";
      if (file_url.includes(".wav")) mimeType = "audio/wav";
      else if (file_url.includes(".ogg")) mimeType = "audio/ogg";
      else if (file_url.includes(".m4a")) mimeType = "audio/mp4";
      else if (file_url.includes(".flac")) mimeType = "audio/flac";

      const systemPrompt = `You are a precise lyrics transcriber. Listen to the audio carefully and transcribe the exact lyrics with LRC timestamps.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Transcribe the EXACT words sung in the audio - do not guess or make up lyrics
- Match timestamps precisely to when each line is actually sung
- Each line should have a unique timestamp
- If the song is in a non-English language, transcribe in the original language
- Do NOT add section labels like [Verse], [Chorus] etc
- ${durationInfo}`;

      const userPrompt = `Transcribe the exact lyrics from this audio${songInfo ? ` (song: "${songInfo}")` : ""} with precise LRC timestamps.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64Audio,
                    format: mimeType === "audio/mpeg" ? "mp3" : mimeType === "audio/wav" ? "wav" : "mp3",
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, coba lagi nanti." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Credit habis, silakan top up." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI audio error:", response.status, t);
        // Fallback to text-based generation
        console.log("Falling back to text-based generation...");
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const lrcLines = content
          .split("\n")
          .filter((line: string) => line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/))
          .join("\n");

        if (lrcLines) {
          return new Response(JSON.stringify({ lrc: lrcLines }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Text-based generation (with or without existing lyrics)
    let systemPrompt: string;
    let userPrompt: string;

    if (hasLyrics) {
      systemPrompt = `You are a lyrics timestamp generator. Given plain lyrics text, generate timestamps in LRC format.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Distribute timestamps evenly across the song duration
- Account for intro/outro instrumental sections
- Keep the original lyrics text exactly as provided
- Each line should have a unique timestamp
- Start timestamps slightly after 00:00 to account for intro
- ${durationInfo}`;

      userPrompt = `Generate LRC timestamps for this song${songInfo ? ` "${songInfo}"` : ""}:\n\n${lyrics_text}`;
    } else {
      if (!song_title) {
        return new Response(JSON.stringify({ error: "song_title is required when no lyrics_text is provided" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      systemPrompt = `You are a song lyrics generator. Given a song title and artist, generate the complete lyrics with LRC timestamps.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Try to recall the actual lyrics of the song if it's a known song
- If you don't know the exact lyrics, generate plausible lyrics matching the artist's style
- Distribute timestamps evenly across the song duration
- Account for intro/outro instrumental sections
- Each line should have a unique timestamp
- Start timestamps slightly after 00:00 to account for intro
- ${durationInfo}`;

      userPrompt = `Generate complete LRC lyrics for the song "${songInfo || song_title}".${durationInfo ? ` ${durationInfo}` : ""}`;
    }

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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credit habis, silakan top up." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
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

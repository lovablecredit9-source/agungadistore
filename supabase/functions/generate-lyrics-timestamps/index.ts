import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function uint8ToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function extractLrc(content: string) {
  return content
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => /^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/.test(line))
    .join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lyrics_text, song_duration, song_title, song_artist, file_url } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const durationInfo = song_duration ? `The song duration is approximately ${song_duration} seconds.` : "";
    const songInfo = [song_title, song_artist].filter(Boolean).join(" by ");
    const hasLyrics = typeof lyrics_text === "string" && lyrics_text.trim().length > 0;

    if (hasLyrics) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `You are a lyrics timestamp generator. Given plain lyrics text, generate timestamps in LRC format.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Distribute timestamps evenly across the song duration
- Account for intro/outro instrumental sections
- Keep the original lyrics text exactly as provided
- Each line should have a unique timestamp
- Start timestamps slightly after 00:00 to account for intro
- Do not rewrite, paraphrase, translate, summarize, or censor the lyrics
- ${durationInfo}`,
            },
            {
              role: "user",
              content: `Generate LRC timestamps for this song${songInfo ? ` \"${songInfo}\"` : ""}:\n\n${lyrics_text}`,
            },
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
        console.error("AI timestamp error:", response.status, t);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const lrc = extractLrc(content);

      return new Response(JSON.stringify({ lrc: lrc || content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!file_url) {
      return new Response(JSON.stringify({ error: "File audio wajib ada jika lirik belum diisi." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioResp = await fetch(file_url);
    if (!audioResp.ok) throw new Error("Failed to download audio file");

    const audioBytes = new Uint8Array(await audioResp.arrayBuffer());
    const base64Audio = uint8ToBase64(audioBytes);

    let format = "mp3";
    const lowerUrl = String(file_url).toLowerCase();
    if (lowerUrl.includes(".wav")) format = "wav";
    else if (lowerUrl.includes(".m4a")) format = "wav";
    else if (lowerUrl.includes(".ogg")) format = "wav";
    else if (lowerUrl.includes(".flac")) format = "wav";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a precise lyrics transcriber.

Rules:
- Output ONLY the LRC formatted lyrics, nothing else
- Format each line as [mm:ss.xx]lyrics text
- Transcribe only the exact sung words from the provided audio
- Never invent, guess, continue, or autocomplete missing lyrics
- If a line is unclear, omit it rather than guessing
- Do not add section labels like [Verse], [Chorus], [Bridge], or [Outro]
- Keep the original language used in the song
- Match timestamps to the actual vocal timing in the audio
- ${durationInfo}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Transcribe the vocals from this audio into precise LRC timestamps${songInfo ? ` for \"${songInfo}\"` : ""}.`,
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format,
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
      console.error("AI audio error:", response.status, t);
      throw new Error("Transkripsi audio AI gagal diproses.");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const lrc = extractLrc(content);

    if (!lrc) {
      return new Response(JSON.stringify({ error: "AI tidak berhasil membaca lirik dari file audio ini." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ lrc }), {
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

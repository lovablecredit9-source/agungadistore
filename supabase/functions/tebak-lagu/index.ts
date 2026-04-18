import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface SongQuestion {
  lyric_snippet: string;
  correct_title: string;
  correct_artist: string;
  options: string[]; // 4 pilihan judul lagu (1 benar + 3 salah)
  hint: string;
}

async function generateQuestion(): Promise<SongQuestion> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY belum diatur");

  const prompt = `Buat 1 soal kuis "Tebak Lagu" dari potongan lirik LAGU POP INDONESIA yang pernah VIRAL/HITS di era 1990 sampai 2026.

ATURAN KETAT:
- HANYA lagu berbahasa Indonesia (TIDAK BOLEH bahasa Inggris, Korea, Jepang, Mandarin, atau bahasa asing lain).
- HANYA genre pop Indonesia (boleh pop-rock, pop-melayu, pop-indie, pop-dangdut, asalkan mainstream/viral).
- Penyanyi/band HARUS dari Indonesia (contoh: Sheila on 7, Peterpan/NOAH, Dewa 19, Nidji, Ungu, Letto, Anggun, Krisdayanti, Agnes Monica, Raisa, Tulus, Isyana, Afgan, Rizky Febian, Mahalini, Lyodra, Tiara Andini, Pamungkas, Hindia, Fiersa Besari, Ardhito Pramono, Juicy Luicy, Yura Yunita, Andmesh, Virgoun, Armada, Wali, ST12, Kotak, Geisha, dll).
- Lagu HARUS pernah viral/hits/populer (sering diputar di radio, TV, TikTok, Spotify Top, atau jadi OST sinetron/film terkenal).
- Lirik snippet HARUS lirik asli berbahasa Indonesia, 1-2 baris yang ikonik/mudah dikenali.
- Acak era: jangan selalu lagu 2020-an, variasikan 1990-an, 2000-an, 2010-an, dan 2020-an.
- Jangan ulang lagu yang itu-itu saja.

Format JSON ketat:
{
  "lyric_snippet": "1-2 baris lirik asli berbahasa Indonesia",
  "correct_title": "Judul lagu (bahasa Indonesia)",
  "correct_artist": "Nama penyanyi/band Indonesia",
  "options": ["Judul Benar", "Judul Salah 1", "Judul Salah 2", "Judul Salah 3"],
  "hint": "Petunjuk singkat (era/tema/genre, tanpa menyebut judul atau penyanyi)"
}
Semua options HARUS judul lagu pop Indonesia juga (bukan lagu asing). Pastikan options[0] adalah judul yang benar (akan diacak di sisi klien). Jangan tambahkan teks lain di luar JSON.`;

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Kamu adalah pembuat soal kuis musik. Selalu balas dengan JSON valid saja, tanpa markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (res.status === 429) throw new Error("Limit AI tercapai, coba lagi sebentar");
  if (res.status === 402) throw new Error("Kredit AI habis, hubungi admin");
  if (!res.ok) throw new Error(`AI error: ${res.status}`);

  const data = await res.json();
  let content: string = data?.choices?.[0]?.message?.content ?? "";
  content = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

  const parsed = JSON.parse(content) as SongQuestion;
  if (!parsed.lyric_snippet || !parsed.correct_title || !Array.isArray(parsed.options) || parsed.options.length < 4) {
    throw new Error("Format AI tidak valid");
  }

  // Acak urutan opsi
  const correct = parsed.options[0];
  const shuffled = [...parsed.options].sort(() => Math.random() - 0.5);
  return { ...parsed, correct_title: correct, options: shuffled };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "question";
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
      if (body?.action) action = body.action;
    }

    if (action === "question") {
      const q = await generateQuestion();
      return Response.json(q, { headers: corsHeaders });
    }

    if (action === "submit_score") {
      const { visitorId, score, totalQuestions, correctAnswers } = body;
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Update game_stats (tanpa kredit/saldo, hanya skor & leaderboard)
      const { data: existing } = await admin
        .from("game_stats")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("game_type", "tebak_lagu")
        .maybeSingle();

      const newPoints = (existing?.points || 0) + (score || 0);
      const newWins = (existing?.wins || 0) + (correctAnswers || 0);
      const newQuestions = (existing?.total_questions || 0) + (totalQuestions || 0);

      if (existing) {
        await admin.from("game_stats").update({
          points: newPoints,
          wins: newWins,
          total_questions: newQuestions,
        }).eq("id", existing.id);
      } else {
        await admin.from("game_stats").insert({
          visitor_id: visitorId,
          game_type: "tebak_lagu",
          points: newPoints,
          wins: newWins,
          total_questions: newQuestions,
        });
      }

      return Response.json({ success: true, total_points: newPoints }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});

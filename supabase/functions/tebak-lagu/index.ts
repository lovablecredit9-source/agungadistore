import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { aiFetch } from "../_shared/ai-provider.ts";

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

// Pool era untuk variasi
const ERA_POOL = ["1990-an", "2000-an awal (2000-2005)", "2000-an akhir (2006-2010)", "2010-an awal (2011-2015)", "2010-an akhir (2016-2020)", "2020-an (2021-2026)"];
const SEED_ARTISTS = [
  "Sheila on 7", "NOAH/Peterpan", "Dewa 19", "Nidji", "Ungu", "Letto", "Padi", "Gigi", "Slank", "Jamrud",
  "Anggun", "Krisdayanti", "Rossa", "Agnes Monica", "BCL", "Raisa", "Tulus", "Isyana Sarasvati", "Afgan", "Rizky Febian",
  "Mahalini", "Lyodra", "Tiara Andini", "Ziva Magnolya", "Pamungkas", "Hindia", "Fiersa Besari", "Ardhito Pramono", "Juicy Luicy", "Yura Yunita",
  "Andmesh Kamaleng", "Virgoun", "Armada", "Wali", "ST12", "Kotak", "Geisha", "D'Masiv", "Last Child", "Kerispatih",
  "Naff", "Samsons", "Vierra/Vierratale", "Drive", "Ada Band", "Maliq & D'Essentials", "RAN", "HiVi!", "Payung Teduh", "Nadin Amizah",
  "Bunga Citra Lestari", "Melly Goeslaw", "Glenn Fredly", "Dewa Budjana", "Sammy Simorangkir", "Cakra Khan", "Judika", "Marcell", "Tompi", "Reza Artamevia"
];

type Difficulty = "mudah" | "sedang" | "sulit";

async function generateQuestion(difficulty: Difficulty = "sedang"): Promise<SongQuestion> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY belum diatur");

  // Acak era + seed artis untuk variasi setiap request
  const randomEra = ERA_POOL[Math.floor(Math.random() * ERA_POOL.length)];
  const shuffledArtists = [...SEED_ARTISTS].sort(() => Math.random() - 0.5).slice(0, 8);
  const randomSeed = Math.random().toString(36).substring(2, 10);

  // Aturan kesulitan
  const difficultyRules: Record<Difficulty, string> = {
    mudah: `TINGKAT KESULITAN: MUDAH
- Gunakan lagu SUPER POPULER yang hampir semua orang Indonesia tahu (mega hits sepanjang masa).
- Lirik yang dipilih HARUS bagian REFF/CHORUS yang paling ikonik dan sering didengar.
- 3 opsi salah dari lagu yang BERBEDA GENRE/ERA jauh, supaya mudah dibedakan.`,
    sedang: `TINGKAT KESULITAN: SEDANG
- Gunakan lagu hits/populer yang cukup dikenal (bukan lagu obscure, tapi tidak harus mega-hit).
- Lirik boleh dari reff atau verse yang cukup ikonik.
- 3 opsi salah dari lagu segenre/seera, cukup menantang tapi masih bisa dibedakan.`,
    sulit: `TINGKAT KESULITAN: SULIT
- Gunakan lagu pop Indonesia hits namun pilih BAGIAN VERSE/BRIDGE (bukan reff utama) yang lebih jarang diingat.
- Boleh juga lagu deep cut dari artis populer (album tracks, B-sides yang tetap dirilis resmi).
- 3 opsi salah HARUS sangat mirip: dari artis yang sama atau era + genre + tema yang sangat dekat, supaya membingungkan.
- TETAP wajib lirik & artis 100% akurat — jangan mengarang.`,
  };

  const prompt = `Buat 1 soal kuis "Tebak Lagu" dari potongan lirik LAGU POP INDONESIA yang pernah VIRAL/HITS.

${difficultyRules[difficulty]}

FOKUS ERA KALI INI: ${randomEra}
INSPIRASI ARTIS (pilih SALAH SATU dari daftar ini, atau artis pop Indonesia lain yang segenre/seera): ${shuffledArtists.join(", ")}
Seed variasi: ${randomSeed} (gunakan untuk memastikan soal berbeda dari sebelumnya)

ATURAN AKURASI LIRIK–ARTIS (PALING PENTING — JANGAN SALAH):
- "lyric_snippet" HARUS lirik ASLI yang BENAR-BENAR ADA di lagu "correct_title" milik "correct_artist".
- Pasangan lirik ↔ judul ↔ artis WAJIB 100% akurat. Jangan menebak. Jika ragu, pilih lagu lain yang kamu yakin.
- Contoh BENAR: lirik "terjadi lagi kisah lama yang terulang kembali" → judul "Kisah Cintaku" → artis "Peterpan/NOAH" (Ariel).
- Contoh SALAH (DILARANG): lirik Noah dipasangkan dengan artis lain seperti Ungu, Dewa, dll. JANGAN PERNAH lakukan ini.
- Jika kamu tidak yakin lirik itu milik siapa, JANGAN gunakan lirik tersebut. Pilih lagu yang kamu yakin penuh.

ATURAN UMUM:
- HANYA lagu berbahasa Indonesia (TIDAK BOLEH bahasa Inggris, Korea, Jepang, Mandarin).
- HANYA genre pop Indonesia (boleh pop-rock, pop-melayu, pop-indie, pop-dangdut mainstream).
- Penyanyi/band HARUS dari Indonesia.
- Lagu HARUS pernah viral/hits (radio, TV, TikTok, Spotify Top, OST sinetron/film).
- Lirik 1-2 baris yang ikonik/mudah dikenali.
- VARIASIKAN soal — JANGAN ulang lagu populer yang sama (hindari "Kisah Cintaku", "Cinta Sejati", "Sephia", "Laskar Pelangi" jika sudah sering muncul). Cari lagu hits LAIN dari era yang diminta.

ATURAN OPTIONS:
- Format setiap opsi: "Judul Lagu — Nama Artis" (em-dash " — ").
- Opsi BENAR (options[0]): judul + artis asli yang akurat.
- 3 opsi SALAH: pilih lagu pop Indonesia LAIN yang BENAR-BENAR ADA (judul + artis asli yang benar, jangan dikarang, jangan dicampur). Pilih segenre/seera supaya menantang.
- SEMUA pasangan judul–artis di options HARUS pasangan asli yang benar (tidak boleh ada judul lagu yang dipasangkan dengan artis salah).

Format JSON ketat (TANPA markdown, TANPA teks lain):
{
  "lyric_snippet": "1-2 baris lirik asli berbahasa Indonesia",
  "correct_title": "Judul lagu",
  "correct_artist": "Nama penyanyi/band Indonesia",
  "options": ["Judul Benar — Artis Benar", "Judul Lain 1 — Artis Lain 1", "Judul Lain 2 — Artis Lain 2", "Judul Lain 3 — Artis Lain 3"],
  "hint": "Petunjuk singkat (era/tema/genre, tanpa menyebut judul atau penyanyi)"
}`;

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      temperature: 1.1,
      messages: [
        { role: "system", content: "Kamu adalah pakar musik pop Indonesia 1990-2026 dengan pengetahuan akurat tentang katalog lagu, judul, penyanyi, dan lirik asli. ATURAN MUTLAK: (1) Lirik yang kamu kutip HARUS benar-benar berasal dari lagu yang kamu sebut — jangan pernah salah memasangkan lirik dengan artis. Contoh: lirik 'terjadi lagi kisah lama yang terulang kembali' adalah lagu 'Kisah Cintaku' milik Peterpan/NOAH (Ariel), BUKAN artis lain. (2) Jika kamu tidak 100% yakin lirik itu milik artis siapa, GANTI ke lagu lain yang kamu yakin penuh. (3) Variasikan soal — JANGAN ulang lagu yang sama. (4) Selalu balas JSON valid saja, tanpa markdown, tanpa teks tambahan." },
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
      const difficulty = (url.searchParams.get("difficulty") || body?.difficulty || "sedang") as Difficulty;
      const safeDiff: Difficulty = difficulty === "mudah" || difficulty === "sulit" ? difficulty : "sedang";
      const q = await generateQuestion(safeDiff);
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

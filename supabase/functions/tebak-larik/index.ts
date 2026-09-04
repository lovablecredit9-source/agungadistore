import { aiFetch } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIFFICULTY_PROMPTS: Record<string, string> = {
  mudah: "Tingkat MUDAH: bahasa sederhana, rima jelas, pengecoh mudah dibedakan.",
  sedang: "Tingkat SEDANG: diksi puitis wajar, pengecoh cukup mirip.",
  sulit: "Tingkat SULIT: diksi puitis padat, pengecoh sangat mirip rima & maknanya.",
  pro: "Tingkat PRO: majas kompleks, pengecoh nyaris benar (beda nuansa halus).",
  sangat_pro: "Tingkat SANGAT PRO: karya sastra tingkat tinggi, pengecoh menipu, hanya benar satu secara makna & irama.",
};

const GENRES: Record<string, string> = {
  puisi: "puisi modern Indonesia (4-6 larik)",
  pantun: "pantun Indonesia (4 larik, sampiran-isi, rima a-b-a-b)",
  lirik: "lirik lagu pop Indonesia (4-6 larik satu bait)",
  syair: "syair klasik Melayu (4 larik, rima a-a-a-a)",
  peribahasa: "bait berisi peribahasa/pepatah Indonesia (4 larik)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const body = await req.json().catch(() => ({}));
    const difficulty = body.difficulty || "sedang";
    const requestedGenre = body.genre && body.genre !== "acak" ? body.genre : null;
    const previousLines: string[] = Array.isArray(body.previousLines) ? body.previousLines : [];

    const genreKeys = Object.keys(GENRES);
    const genre = requestedGenre && GENRES[requestedGenre]
      ? requestedGenre
      : genreKeys[Math.floor(Math.random() * genreKeys.length)];

    const diffPrompt = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.sedang;
    const avoid = previousLines.length
      ? `\nJANGAN gunakan/menyerupai larik berikut yang sudah pernah muncul: ${previousLines.slice(-40).join(" | ")}.`
      : "";
    const seed = Math.random().toString(36).slice(2, 8);

    const response = await aiFetch("chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Kamu sastrawan Indonesia pembuat kuis "Tebak Larik". Kamu membuat satu bait ${GENRES[genre]} lalu MENGHILANGKAN satu larik di dalamnya (ditandai "____"). Pemain harus menebak larik yang hilang dari 4 pilihan. ${diffPrompt} Bait harus segar, orisinal, dan tidak klise (hindari tema bulan-purnama-rindu yang basi). Variasi seed: ${seed}.${avoid} Balas HANYA lewat function call.`,
          },
          {
            role: "user",
            content: `Buat satu bait ${GENRES[genre]} dengan satu larik yang dihilangkan, 4 pilihan larik (1 benar, 3 pengecoh mirip rima/panjang), indeks jawaban benar, penjelasan singkat kenapa larik itu paling tepat (rima, makna, irama), dan judul bait.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_larik",
              description: "Kuis melengkapi larik",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Judul bait" },
                  genre: { type: "string", description: "Genre bait" },
                  lines: {
                    type: "array",
                    items: { type: "string" },
                    description: "Semua larik bait, larik yang hilang ditulis persis '____'",
                  },
                  missingIndex: { type: "number", description: "Index larik yang hilang di array lines" },
                  options: { type: "array", items: { type: "string" }, description: "4 pilihan larik" },
                  correctIndex: { type: "number", description: "Index jawaban benar (0-3)" },
                  explanation: { type: "string", description: "Penjelasan singkat" },
                },
                required: ["title", "lines", "missingIndex", "options", "correctIndex", "explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_larik" } },
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      return Response.json(
        { error: response.status === 402 ? "Kredit AI habis, hubungi admin" : (txt || "Gagal memuat soal") },
        { status: response.status, headers: corsHeaders },
      );
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = null;
    if (toolCall?.function?.arguments) {
      parsed = JSON.parse(toolCall.function.arguments);
    } else {
      const content = data?.choices?.[0]?.message?.content || "";
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    if (!parsed) return Response.json({ error: "Gagal menghasilkan bait" }, { status: 500, headers: corsHeaders });

    parsed.genre = parsed.genre || genre;
    return Response.json(parsed, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500, headers: corsHeaders });
  }
});

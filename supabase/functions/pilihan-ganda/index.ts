import { aiFetch } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIFFICULTY_CONFIG: Record<string, { prompt: string }> = {
  mudah: { prompt: "pengetahuan umum dasar yang mudah dipahami semua orang" },
  sedang: { prompt: "pengetahuan umum yang butuh sedikit pemikiran" },
  sulit: { prompt: "pengetahuan yang cukup mendalam tentang sains, sejarah, atau geografi" },
  pro: { prompt: "pengetahuan spesifik yang hanya diketahui orang berwawasan luas" },
  sangat_pro: { prompt: "pengetahuan sangat spesifik dan jarang diketahui, level ahli" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return Response.json({ error: "AI belum dikonfigurasi" }, { status: 500, headers: corsHeaders });
    }

    const { difficulty = "sedang", previousQuestions = [] } = await req.json();
    const diff = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.sedang;

    const avoidList = previousQuestions.length > 0
      ? `\n\nJANGAN buat soal tentang topik berikut (sudah pernah ditanyakan): ${previousQuestions.join(", ")}`
      : "";

    const response = await aiFetch("chat", {
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
            content: `Kamu adalah pembuat soal kuis pilihan ganda. Buat soal tentang ${diff.prompt}. Soal harus menarik, mendidik, dan bervariasi topiknya. Berikan 4 pilihan jawaban (A, B, C, D) dengan HANYA SATU jawaban benar. Sertakan penjelasan singkat mengapa jawaban tersebut benar.${avoidList}`,
          },
          {
            role: "user",
            content: "Buat satu soal pilihan ganda baru yang unik dan berbeda dari sebelumnya.",
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_question",
              description: "Provide a multiple choice question",
              parameters: {
                type: "object",
                properties: {
                  question: { type: "string", description: "Pertanyaan" },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    description: "4 pilihan jawaban (tanpa prefix A/B/C/D)",
                  },
                  correctIndex: { type: "number", description: "Index jawaban benar (0-3)" },
                  explanation: { type: "string", description: "Penjelasan singkat jawaban benar" },
                  category: { type: "string", description: "Kategori soal (misal: Sains, Sejarah, Geografi)" },
                },
                required: ["question", "options", "correctIndex", "explanation", "category"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_question" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429, headers: corsHeaders });
      if (response.status === 402) return Response.json({ error: "Kredit AI habis" }, { status: 402, headers: corsHeaders });
      return Response.json({ error: "Gagal generate soal" }, { status: 500, headers: corsHeaders });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return Response.json({
        question: parsed.question,
        options: parsed.options,
        correctIndex: parsed.correctIndex,
        explanation: parsed.explanation,
        category: parsed.category || "",
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Gagal memproses respons AI" }, { status: 500, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});

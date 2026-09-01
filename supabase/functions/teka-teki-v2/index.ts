import { aiFetch } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIFFICULTY_PROMPTS: Record<string, string> = {
  mudah: "Buat teka-teki logika MUDAH. Jawaban harus satu kata pendek (3-6 huruf).",
  sedang: "Buat teka-teki logika SEDANG. Jawaban harus satu kata (4-7 huruf).",
  sulit: "Buat teka-teki logika SULIT. Jawaban harus satu kata (4-8 huruf).",
  pro: "Buat teka-teki logika PRO yang menantang. Jawaban harus satu kata (5-8 huruf).",
  sangat_pro: "Buat teka-teki logika SANGAT PRO paling sulit. Jawaban satu kata (5-10 huruf).",
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

     const { difficulty = "sedang", previousAnswers = [] } = await req.json();
    const diffPrompt = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.sedang;
     const avoidText = previousAnswers.length > 0
       ? `\n\nPENTING: JANGAN gunakan jawaban berikut karena sudah pernah muncul: ${previousAnswers.join(", ")}. Pilih teka-teki dengan jawaban yang BENAR-BENAR BERBEDA. Jangan tentang bayangan, cermin, atau topik klise lainnya.`
       : "\n\nBuat teka-teki dengan jawaban yang unik dan bervariasi. Hindari jawaban klise seperti BAYANGAN, CERMIN, dll.";

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
            content: `Kamu pembuat teka-teki logika dalam bahasa Indonesia. ${diffPrompt} Jawaban HARUS satu kata saja. Berikan juga huruf-huruf acak tambahan sebagai pengecoh. Jawab HANYA dalam format JSON tanpa markdown.${avoidText}`,
          },
          {
            role: "user",
            content: "Buat satu teka-teki logika. Berikan pertanyaan, jawaban (1 kata), 3 petunjuk, penjelasan, dan huruf-huruf acak (termasuk huruf jawaban) yang diacak untuk ditampilkan sebagai kotak pilihan huruf.",
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_puzzle",
              description: "Provide a puzzle with scrambled letter tiles",
              parameters: {
                type: "object",
                properties: {
                  riddle: { type: "string", description: "Pertanyaan teka-teki" },
                  answer: { type: "string", description: "Jawaban (1 kata)" },
                  scrambledLetters: {
                    type: "array",
                    items: { type: "string" },
                    description: "Huruf-huruf acak termasuk semua huruf jawaban, total 12-16 huruf, diacak",
                  },
                  hints: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 petunjuk",
                  },
                  explanation: { type: "string", description: "Penjelasan singkat" },
                },
                required: ["riddle", "answer", "scrambledLetters", "hints", "explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_puzzle" } },
      }),
    });

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return Response.json(parsed, { headers: corsHeaders });
    }

    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return Response.json(JSON.parse(jsonMatch[0]), { headers: corsHeaders });
    }

    return Response.json({ error: "Gagal menghasilkan teka-teki" }, { status: 500, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});

import { aiFetch } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIFFICULTY_PROMPTS: Record<string, string> = {
  mudah: "Buat pertanyaan kuis MUDAH tentang pengetahuan umum sehari-hari. Faktanya harus jelas dan tidak ambigu.",
  sedang: "Buat pertanyaan kuis SEDANG tentang sains, sejarah, atau geografi. Butuh sedikit pengetahuan.",
  sulit: "Buat pertanyaan kuis SULIT tentang fakta yang tidak umum diketahui.",
  pro: "Buat pertanyaan kuis PRO yang menantang, tentang fakta yang jarang diketahui orang.",
  sangat_pro: "Buat pertanyaan kuis SANGAT PRO, sangat sulit dan menjebak.",
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

     const { difficulty = "sedang", previousTopics = [] } = await req.json();
    const diffPrompt = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.sedang;
     const avoidText = previousTopics.length > 0
       ? `\n\nPENTING: JANGAN buat pertanyaan tentang topik berikut karena sudah pernah ditanyakan: ${previousTopics.join(", ")}. Pilih topik yang BENAR-BENAR BERBEDA dan BERVARIASI. Jangan tentang Everest, Tembok China, atau bayangan kecuali diminta.`
       : "\n\nBuat pertanyaan dengan topik yang unik dan bervariasi. Hindari topik klise seperti Gunung Everest, Tembok China, bayangan, dll.";

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
            content: `Kamu pembuat kuis Ya atau Tidak dalam bahasa Indonesia. ${diffPrompt} Pertanyaan harus bisa dijawab dengan YA atau TIDAK saja. Jawab HANYA dalam format JSON tanpa markdown.${avoidText}`,
          },
          {
            role: "user",
            content: "Buat satu pertanyaan kuis Ya/Tidak beserta jawabannya (ya/tidak), dan penjelasan singkat kenapa.",
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_quiz",
              description: "Provide a yes/no quiz question",
              parameters: {
                type: "object",
                properties: {
                  question: { type: "string", description: "Pertanyaan kuis" },
                  answer: { type: "string", enum: ["ya", "tidak"], description: "Jawaban: ya atau tidak" },
                  explanation: { type: "string", description: "Penjelasan singkat" },
                  funFact: { type: "string", description: "Fakta menarik terkait" },
                },
                required: ["question", "answer", "explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_quiz" } },
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

    return Response.json({ error: "Gagal menghasilkan kuis" }, { status: 500, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});

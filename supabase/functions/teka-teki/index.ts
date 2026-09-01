import { aiFetch } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIFFICULTY_PROMPTS: Record<string, string> = {
  mudah: "Buat teka-teki logika yang MUDAH dan sederhana, cocok untuk anak-anak. Jawabannya harus benda atau hal umum sehari-hari.",
  sedang: "Buat teka-teki logika tingkat SEDANG. Butuh sedikit berpikir tapi tidak terlalu sulit.",
  sulit: "Buat teka-teki logika yang SULIT. Butuh berpikir kritis dan logika yang baik.",
  pro: "Buat teka-teki logika tingkat PRO yang sangat menantang. Butuh pemikiran mendalam.",
  sangat_pro: "Buat teka-teki logika tingkat SANGAT PRO, paling sulit. Hanya orang dengan logika luar biasa yang bisa jawab.",
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

    const { difficulty = "sedang" } = await req.json();
    const diffPrompt = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.sedang;

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
            content: `Kamu adalah pembuat teka-teki logika dalam bahasa Indonesia. ${diffPrompt} Jawaban HARUS satu kata atau maksimal 2 kata pendek. Jawab HANYA dalam format JSON tanpa markdown.`,
          },
          {
            role: "user",
            content: "Buat satu teka-teki logika baru beserta jawabannya, 3 petunjuk, dan penjelasan singkat.",
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_riddle",
              description: "Provide a riddle with answer, hints and explanation",
              parameters: {
                type: "object",
                properties: {
                  riddle: { type: "string", description: "Pertanyaan teka-teki" },
                  answer: { type: "string", description: "Jawaban teka-teki (1-2 kata)" },
                  hints: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 petunjuk dari mudah ke sulit",
                  },
                  explanation: { type: "string", description: "Penjelasan singkat kenapa jawabannya itu" },
                },
                required: ["riddle", "answer", "hints", "explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_riddle" } },
      }),
    });

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return Response.json(parsed, { headers: corsHeaders });
    }

    // Fallback: try to parse from content
    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Response.json(parsed, { headers: corsHeaders });
    }

    return Response.json({ error: "Gagal menghasilkan teka-teki" }, { status: 500, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});

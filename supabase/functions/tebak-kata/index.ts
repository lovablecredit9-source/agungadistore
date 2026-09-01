import { aiFetch } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIFFICULTY_CONFIG: Record<string, { minLetters: number; maxLetters: number; hintCount: number; prompt: string }> = {
  mudah: { minLetters: 4, maxLetters: 6, hintCount: 8, prompt: "kata yang sangat umum dan mudah (4-6 huruf), berikan 8 petunjuk dari sulit ke mudah" },
  sedang: { minLetters: 4, maxLetters: 7, hintCount: 6, prompt: "kata benda umum (4-7 huruf), berikan 6 petunjuk dari sulit ke mudah" },
  sulit: { minLetters: 5, maxLetters: 8, hintCount: 5, prompt: "kata yang agak sulit (5-8 huruf), berikan 5 petunjuk dari sulit ke mudah" },
  pro: { minLetters: 6, maxLetters: 10, hintCount: 4, prompt: "kata yang sulit dan jarang digunakan (6-10 huruf), berikan 4 petunjuk yang samar dari sulit ke mudah" },
  sangat_pro: { minLetters: 7, maxLetters: 12, hintCount: 3, prompt: "kata yang sangat sulit, langka, atau teknis (7-12 huruf), berikan 3 petunjuk yang sangat samar" },
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

    const { action, guess, word, difficulty } = await req.json();

    if (action === "new_word") {
      const diff = DIFFICULTY_CONFIG[difficulty || "sedang"] || DIFFICULTY_CONFIG.sedang;
      
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
              content: `Kamu adalah game master untuk permainan tebak kata bahasa Indonesia. Berikan ${diff.prompt}. Jawab HANYA dalam format JSON tanpa markdown: {"word":"KATA","hints":["petunjuk1","petunjuk2",...]}`
            },
            { role: "user", content: `Berikan satu kata baru untuk ditebak beserta ${diff.hintCount} petunjuknya. Kata harus ${diff.minLetters}-${diff.maxLetters} huruf.` }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "provide_word",
                description: "Provide a word and its hints for the guessing game",
                parameters: {
                  type: "object",
                  properties: {
                    word: { type: "string", description: "Kata yang harus ditebak (huruf besar)" },
                    hints: {
                      type: "array",
                      items: { type: "string" },
                      description: `${diff.hintCount} petunjuk dari sulit ke mudah`
                    }
                  },
                  required: ["word", "hints"],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "provide_word" } }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return Response.json({ error: "Terlalu banyak permintaan, coba lagi nanti" }, { status: 429, headers: corsHeaders });
        }
        if (response.status === 402) {
          return Response.json({ error: "Kredit AI habis" }, { status: 402, headers: corsHeaders });
        }
        return Response.json({ error: "Gagal generate kata" }, { status: 500, headers: corsHeaders });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return Response.json({
          word: parsed.word.toUpperCase(),
          hints: parsed.hints,
          hint_count: parsed.hints.length,
        }, { headers: corsHeaders });
      }

      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return Response.json({
          word: parsed.word.toUpperCase(),
          hints: parsed.hints,
          hint_count: parsed.hints.length,
        }, { headers: corsHeaders });
      }

      return Response.json({ error: "Gagal memproses respons AI" }, { status: 500, headers: corsHeaders });

    } else if (action === "check_guess") {
      if (!guess || !word) {
        return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
      }
      const isCorrect = guess.toUpperCase() === word.toUpperCase();
      return Response.json({ correct: isCorrect }, { headers: corsHeaders });
    }

    return Response.json({ error: "Aksi tidak valid" }, { status: 400, headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});

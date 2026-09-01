import { aiFetch } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIFFICULTY_CONFIG: Record<string, { range: string; hintCount: number; prompt: string }> = {
  mudah: { range: "1-50", hintCount: 4, prompt: "angka antara 1-50. Berikan 4 petunjuk matematika/logika sederhana" },
  sedang: { range: "1-100", hintCount: 4, prompt: "angka antara 1-100. Berikan 4 petunjuk matematika dari sulit ke mudah" },
  sulit: { range: "1-500", hintCount: 3, prompt: "angka antara 1-500. Berikan 3 petunjuk matematika yang menantang" },
  pro: { range: "1-1000", hintCount: 3, prompt: "angka antara 1-1000. Berikan 3 petunjuk matematika yang sulit" },
  sangat_pro: { range: "1-5000", hintCount: 2, prompt: "angka antara 1-5000. Berikan 2 petunjuk matematika yang sangat sulit dan samar" },
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
    const diff = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.sedang;

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
            content: `Kamu adalah game master tebak angka. Pilih ${diff.prompt}. Petunjuk harus kreatif dan unik setiap kali (misal: faktor, kelipatan, operasi matematika, digit, hubungan angka). JANGAN beri petunjuk yang langsung menyebutkan angkanya. Jawab HANYA dalam format JSON tanpa markdown.`,
          },
          {
            role: "user",
            content: `Buat satu soal tebak angka baru (range ${diff.range}). Berikan angka dan ${diff.hintCount} petunjuk kreatif dari sulit ke mudah. Pastikan soal ini UNIK dan berbeda dari soal sebelumnya.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_number",
              description: "Provide a number and its hints for the guessing game",
              parameters: {
                type: "object",
                properties: {
                  number: { type: "number", description: "Angka yang harus ditebak" },
                  hints: {
                    type: "array",
                    items: { type: "string" },
                    description: `${diff.hintCount} petunjuk dari sulit ke mudah`,
                  },
                },
                required: ["number", "hints"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_number" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429, headers: corsHeaders });
      if (response.status === 402) return Response.json({ error: "Kredit AI habis" }, { status: 402, headers: corsHeaders });
      return Response.json({ error: "Gagal generate angka" }, { status: 500, headers: corsHeaders });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return Response.json({
        number: parsed.number,
        hints: parsed.hints,
        range: diff.range,
      }, { headers: corsHeaders });
    }

    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Response.json({
        number: parsed.number,
        hints: parsed.hints,
        range: diff.range,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Gagal memproses respons AI" }, { status: 500, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});

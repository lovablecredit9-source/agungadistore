import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { difficulty = "sedang", language = "id" } = await req.json();

    const difficultyMap: Record<string, string> = {
      mudah: "Buat teka-teki logika yang MUDAH dan sederhana, cocok untuk anak-anak. Jawabannya harus benda atau hal umum sehari-hari.",
      sedang: "Buat teka-teki logika tingkat SEDANG. Butuh sedikit berpikir tapi tidak terlalu sulit.",
      sulit: "Buat teka-teki logika yang SULIT. Butuh berpikir kritis dan logika yang baik.",
      pro: "Buat teka-teki logika tingkat PRO yang sangat menantang. Butuh pemikiran mendalam.",
      sangat_pro: "Buat teka-teki logika tingkat SANGAT PRO, paling sulit. Hanya orang dengan logika luar biasa yang bisa jawab.",
    };

    const prompt = `${difficultyMap[difficulty] || difficultyMap.sedang}

Aturan PENTING:
- Teka-teki harus dalam bahasa Indonesia
- Jawaban HARUS satu kata atau maksimal 2 kata pendek
- Berikan juga 3 petunjuk tambahan (dari mudah ke sulit) yang bisa membantu menjawab
- Format jawaban HARUS dalam JSON seperti ini:
{
  "riddle": "pertanyaan teka-teki di sini",
  "answer": "jawaban",
  "hints": ["petunjuk 1 (paling mudah)", "petunjuk 2", "petunjuk 3 (paling sulit)"],
  "explanation": "penjelasan singkat kenapa jawabannya itu"
}

Jangan tambahkan teks lain selain JSON. Pastikan JSON valid.`;

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 1024 },
        }),
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

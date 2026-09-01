import { aiFetch } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIFFICULTY_CONFIG: Record<string, { hintCount: number; prompt: string }> = {
  mudah: { hintCount: 4, prompt: "benda sehari-hari yang sangat umum (misal: sendok, buku, lampu). Berikan 4 deskripsi sensorik dari sulit ke mudah" },
  sedang: { hintCount: 4, prompt: "benda umum tapi butuh pikir sedikit (misal: kompas, teropong, catur). Berikan 4 deskripsi dari sulit ke mudah" },
  sulit: { hintCount: 3, prompt: "benda yang kurang umum atau teknis (misal: astrolabe, sextant, metronom). Berikan 3 deskripsi samar dari sulit ke mudah" },
  pro: { hintCount: 3, prompt: "benda langka atau spesifik (misal: kaleidoskop, barometer, gyroscope). Berikan 3 deskripsi sangat samar" },
  sangat_pro: { hintCount: 2, prompt: "benda sangat langka atau antik (misal: astrolabe, sextant, abakus). Berikan 2 deskripsi yang sangat abstrak" },
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
            content: `Kamu adalah game master tebak barang. Pilih ${diff.prompt}. Deskripsi harus kreatif: bentuk, tekstur, kegunaan, bahan, sejarah, dll. JANGAN sebut nama barangnya langsung. Pastikan setiap soal UNIK dan berbeda. Jawab HANYA dalam format JSON tanpa markdown.`,
          },
          {
            role: "user",
            content: `Buat satu soal tebak barang baru. Berikan nama barang dan ${diff.hintCount} deskripsi/petunjuk dari sulit ke mudah. Pastikan BERBEDA dari soal sebelumnya.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_item",
              description: "Provide an item and its descriptions for the guessing game",
              parameters: {
                type: "object",
                properties: {
                  item: { type: "string", description: "Nama barang yang harus ditebak (huruf besar)" },
                  hints: {
                    type: "array",
                    items: { type: "string" },
                    description: `${diff.hintCount} deskripsi/petunjuk dari sulit ke mudah`,
                  },
                  category: { type: "string", description: "Kategori barang (misal: alat, elektronik, dapur)" },
                },
                required: ["item", "hints", "category"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_item" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429, headers: corsHeaders });
      if (response.status === 402) return Response.json({ error: "Kredit AI habis" }, { status: 402, headers: corsHeaders });
      return Response.json({ error: "Gagal generate barang" }, { status: 500, headers: corsHeaders });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return Response.json({
        item: (parsed.item || "").toUpperCase(),
        hints: parsed.hints,
        category: parsed.category || "",
      }, { headers: corsHeaders });
    }

    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Response.json({
        item: (parsed.item || "").toUpperCase(),
        hints: parsed.hints,
        category: parsed.category || "",
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Gagal memproses respons AI" }, { status: 500, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});

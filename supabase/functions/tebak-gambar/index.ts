import { aiFetch } from "../_shared/ai-provider.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CATEGORIES: Record<string, { objects: string[]; style: string }> = {
  mudah: {
    objects: [
      "kucing", "anjing", "rumah", "mobil", "pohon", "bunga", "matahari", "bulan",
      "bintang", "ikan", "burung", "apel", "pisang", "bola", "payung", "sepeda",
      "kursi", "meja", "jam", "topi", "kunci", "gitar", "piano", "lilin",
      "sendok", "garpu", "piring", "gelas", "buku", "pensil"
    ],
    style: "clean colorful illustration of a single object, isolated on a plain light background"
  },
  sedang: {
    objects: [
      "helikopter", "kapal selam", "kastil", "mercusuar", "kincir angin", "teleskop",
      "mikroskop", "robot", "dinosaurus", "penguin", "lumba-lumba", "jerapah",
      "kaktus", "jamur", "pelangi", "gunung berapi", "air terjun", "kompas",
      "globe", "biola", "terompet", "drum", "stetoskop", "magnet"
    ],
    style: "detailed clear illustration of a single object, isolated on a plain light background"
  },
  sulit: {
    objects: [
      "akordeon", "katapel", "gramofon", "periskop", "abakus", "pendulum",
      "prisma", "pagoda", "obelisk", "totem", "kompas", "teropong",
      "jangkar", "mahkota", "timbangan", "ceret", "lentera", "lonceng"
    ],
    style: "sharp semi-realistic illustration of a single object, isolated on a plain light background"
  },
};

const FALLBACK_ROUNDS: Record<string, { answer: string; emoji: string; hints: string[] }[]> = {
  mudah: [
    { answer: "kucing", emoji: "🐈", hints: ["Hewan rumahan yang lincah", "Suka mengejar tikus", "Bersuara mengeong"] },
    { answer: "mobil", emoji: "🚗", hints: ["Bergerak di jalan raya", "Memiliki empat roda", "Kendaraan pribadi"] },
    { answer: "payung", emoji: "☂️", hints: ["Dibawa saat cuaca berubah", "Melindungi bagian atas tubuh", "Dipakai ketika hujan"] },
    { answer: "gitar", emoji: "🎸", hints: ["Menghasilkan nada", "Memiliki banyak senar", "Alat musik yang dipetik"] },
    { answer: "apel", emoji: "🍎", hints: ["Tumbuh di pohon", "Buah berbentuk bulat", "Sering berwarna merah"] },
  ],
  sedang: [
    { answer: "helikopter", emoji: "🚁", hints: ["Dapat melayang di udara", "Baling-baling berada di atas", "Kendaraan udara"] },
    { answer: "dinosaurus", emoji: "🦖", hints: ["Hidup pada zaman purba", "Kini sudah punah", "Reptil berukuran besar"] },
    { answer: "penguin", emoji: "🐧", hints: ["Burung yang tidak terbang", "Pandai berenang", "Hidup di wilayah dingin"] },
    { answer: "pelangi", emoji: "🌈", hints: ["Muncul setelah hujan", "Memiliki banyak warna", "Melengkung di langit"] },
    { answer: "teleskop", emoji: "🔭", hints: ["Dipakai oleh astronom", "Melihat benda sangat jauh", "Untuk mengamati langit"] },
  ],
  sulit: [
    { answer: "akordeon", emoji: "🪗", hints: ["Dimainkan dengan kedua tangan", "Bunyinya berasal dari udara", "Alat musik berbentuk lipatan"] },
    { answer: "abakus", emoji: "🧮", hints: ["Sudah digunakan sejak dahulu", "Memiliki manik-manik geser", "Alat bantu berhitung"] },
    { answer: "jangkar", emoji: "⚓", hints: ["Terbuat dari logam berat", "Diturunkan ke dasar air", "Menahan kapal agar diam"] },
    { answer: "mahkota", emoji: "👑", hints: ["Simbol kekuasaan", "Dikenakan di kepala", "Milik raja atau ratu"] },
    { answer: "lentera", emoji: "🏮", hints: ["Dapat dibawa atau digantung", "Menerangi tempat gelap", "Lampu dengan pelindung"] },
  ],
};

function fallbackRound(difficulty: string) {
  const rounds = FALLBACK_ROUNDS[difficulty] || FALLBACK_ROUNDS.mudah;
  const round = rounds[Math.floor(Math.random() * rounds.length)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768"><rect width="768" height="768" rx="48" fill="#f8fafc"/><circle cx="384" cy="384" r="270" fill="#e2e8f0"/><text x="384" y="440" text-anchor="middle" font-size="280" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${round.emoji}</text></svg>`;
  return {
    image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    answer: round.answer.toUpperCase(),
    hints: round.hints,
    letterCount: round.answer.length,
    source: "fallback",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, guess, answer, difficulty } = await req.json();

    if (action === "new_image") {
      const diff = difficulty || "mudah";
      const cat = CATEGORIES[diff] || CATEGORIES.mudah;
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return Response.json(fallbackRound(diff), { status: 200, headers: corsHeaders });
      }
      const randomObj = cat.objects[Math.floor(Math.random() * cat.objects.length)];

      const imagePrompt = `Create one very clear image of a single object: "${randomObj}". Style: ${cat.style}. Requirements: object only, centered, large, fully visible, high contrast, easy to recognize for a guessing game, simple silhouette, strong edges, plain light background, no scene clutter, no hands, no people, no extra objects, no text, no letters, no watermark.`;

      const [response, hintResponse] = await Promise.all([
        aiFetch("chat", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              {
                role: "user",
                content: imagePrompt,
              },
            ],
            modalities: ["image", "text"],
          }),
        }),
        aiFetch("chat", {
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
                content: "Kamu membantu game tebak gambar. Berikan petunjuk singkat untuk objek yang diberikan.",
              },
              {
                role: "user",
                content: `Berikan 3 petunjuk singkat (masing-masing max 8 kata) untuk menebak objek "${randomObj}", dari yang paling sulit ke paling mudah.`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "provide_hints",
                  description: "Provide hints for the guessing game",
                  parameters: {
                    type: "object",
                    properties: {
                      hints: {
                        type: "array",
                        items: { type: "string" },
                        description: "3 petunjuk dari sulit ke mudah",
                      },
                    },
                    required: ["hints"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "provide_hints" } },
          }),
        }),
      ]);

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI error:", response.status, errText);
        return Response.json(fallbackRound(diff), { status: 200, headers: corsHeaders });
      }

      const data = await response.json();
      
      const message = data.choices?.[0]?.message;
      let imageBase64 = "";

      // Check for images array (Lovable AI Gateway format)
      if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
        imageBase64 = message.images[0]?.image_url?.url || "";
      }
      
      // Fallback: check content parts
      if (!imageBase64 && Array.isArray(message?.content)) {
        for (const part of message.content) {
          if (part.type === "image_url" && part.image_url?.url) {
            imageBase64 = part.image_url.url;
            break;
          }
        }
      }

      if (!imageBase64) {
        console.error("No image in response, content:", JSON.stringify(data.choices?.[0]?.message).substring(0, 500));
        return Response.json(fallbackRound(diff), { status: 200, headers: corsHeaders });
      }

      let hints: string[] = [];
      if (hintResponse.ok) {
        const hintData = await hintResponse.json();
        const toolCall = hintData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          hints = parsed.hints || [];
        }
      }
      
      if (hints.length === 0) {
        hints = ["Perhatikan bentuknya", "Perhatikan detailnya", `Huruf pertama: ${randomObj[0].toUpperCase()}`];
      }

      return Response.json({
        image: imageBase64,
        answer: randomObj.toUpperCase(),
        hints,
        letterCount: randomObj.length,
      }, { headers: corsHeaders });

    } else if (action === "check_guess") {
      if (!guess || !answer) {
        return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
      }
      const normalize = (s: string) => s.toUpperCase().trim().replace(/\s+/g, " ");
      const isCorrect = normalize(guess) === normalize(answer);
      return Response.json({ correct: isCorrect }, { headers: corsHeaders });
    }

    return Response.json({ error: "Aksi tidak valid" }, { status: 400, headers: corsHeaders });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    console.error("tebak-gambar error:", error);
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});

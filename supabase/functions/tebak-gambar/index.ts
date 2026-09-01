import { aiFetch } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return Response.json({ error: "AI belum dikonfigurasi" }, { status: 500, headers: corsHeaders });
    }

    const { action, guess, answer, difficulty } = await req.json();

    if (action === "new_image") {
      const diff = difficulty || "mudah";
      const cat = CATEGORIES[diff] || CATEGORIES.mudah;
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
        if (response.status === 429) {
          return Response.json({ error: "Terlalu banyak permintaan, coba lagi nanti" }, { status: 429, headers: corsHeaders });
        }
        if (response.status === 402) {
          return Response.json({ error: "Kredit AI habis" }, { status: 402, headers: corsHeaders });
        }
        const errText = await response.text();
        console.error("AI error:", response.status, errText);
        return Response.json({ error: "Gagal generate gambar" }, { status: 500, headers: corsHeaders });
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
        // Fallback: try to get image from different response formats
        console.error("No image in response, content:", JSON.stringify(data.choices?.[0]?.message).substring(0, 500));
        return Response.json({ error: "Gagal mendapatkan gambar dari AI" }, { status: 500, headers: corsHeaders });
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

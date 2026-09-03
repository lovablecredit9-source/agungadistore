import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  image?: string | null; // data URL (only valid on the latest user message)
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");


    const body = await req.json();
    const mood = String(body.mood || "butuh teman").slice(0, 40);
    const aiMode = ["biasa", "pro", "super_pro"].includes(String(body.aiMode))
      ? String(body.aiMode)
      : "biasa";
    const deepThink = Boolean(body.deepThink);
    const messages = Array.isArray(body.messages) ? body.messages : [];

    // ===== Deteksi permintaan buat gambar =====
    const lastUser = [...messages].reverse().find((m: ChatMessage) => m.role === "user");
    const lastText = String(lastUser?.content || "").toLowerCase();
    const wantsImage = /\b(buat(?:kan|in)?|bikin(?:in)?|gambarin|lukis(?:kan|in)?|generate|render|desain(?:kan|in)?)\b[\s\w]*\b(gambar|foto|ilustrasi|lukisan|wallpaper|art|gambaran)\b/.test(lastText)
      || /\b(gambar|ilustrasi|lukisan|wallpaper)\b[\s\w]*\b(galau|merenung|sedih|sendiri|sunyi|hujan|senja)\b/.test(lastText);

    if (wantsImage && LOVABLE_API_KEY) {
      const imgPrompt = `Ilustrasi digital art bernuansa melankolis dan estetik untuk teman curhat galau.
Permintaan user: "${String(lastUser?.content || "").slice(0, 400)}".
Gaya: sinematik, lembut, warna moody (biru gelap, ungu, oranye senja), atmosfer merenung & tenang, pencahayaan dramatis halus, kualitas tinggi, tanpa teks/tulisan, tasteful dan tidak vulgar.`;
      try {
        const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "Lovable-API-Key": LOVABLE_API_KEY,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: imgPrompt }],
            modalities: ["image", "text"],
          }),
        });
        if (imgResp.ok) {
          const imgData = await imgResp.json();
          const b64 = imgData?.data?.[0]?.b64_json;
          if (b64) {
            return Response.json({
              reply: "Ini aku buatin gambarnya ya, semoga ngewakilin perasaan kamu 💕 Kalau mau aku ubah suasananya, bilang aja.",
              image: `data:image/png;base64,${b64}`,
            }, { headers: corsHeaders });
          }
        } else {
          const status = imgResp.status;
          // Gagal membuat gambar tidak boleh mematikan sesi chat. Lanjutkan ke
          // balasan teks melalui provider/router admin di bawah.
          console.error("bot-galau-ai image error", status, await imgResp.text());
        }
      } catch (e) {
        console.error("bot-galau-ai image exception", e);
      }
      // kalau gagal, lanjut balas teks biasa di bawah
    }

    const safeMessages: ChatMessage[] = messages
      .filter((m: ChatMessage) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-30)
      .map((m: ChatMessage, idx: number, arr: ChatMessage[]) => ({
        role: m.role,
        content: m.content.slice(0, 2000),
        // only allow image on the very last message (current turn)
        image: idx === arr.length - 1 && m.role === "user" && typeof m.image === "string" && m.image.startsWith("data:image/")
          ? m.image.slice(0, 8_000_000)
          : null,
      }));

    const modeStyle: Record<string, { tone: string; length: string }> = {
      biasa: {
        tone: "Santai, sederhana, mudah dipahami. Bahasa anak muda biasa, tidak terlalu dalam.",
        length: "Jawaban singkat 2-3 kalimat saja.",
      },
      pro: {
        tone: "Lebih reflektif dan empatik, mulai bantu user mengenali pola perasaan & sebabnya. Bahasa hangat tapi tetap natural.",
        length: "Jawaban 3-5 kalimat, boleh sertakan 1 saran kecil yang konkret.",
      },
      super_pro: {
        tone: "Mode konselor mendalam: validasi perasaan, refleksi mendalam, kerangka CBT/journaling ringan, bantu user reframe pikiran tanpa menggurui.",
        length: "Jawaban 4-7 kalimat, boleh pakai bullet pendek bila perlu, beri 1-2 langkah praktis yang bisa dilakukan sekarang.",
      },
    };
    const style = modeStyle[aiMode];

    // Pick model: deep think upgrades reasoning quality
    const modelByMode: Record<string, string> = {
      biasa: "google/gemini-2.5-flash-lite",
      pro: "google/gemini-3-flash-preview",
      super_pro: "google/gemini-2.5-pro",
    };
    const model = deepThink ? "google/gemini-2.5-pro" : modelByMode[aiMode];

    const systemPrompt = `Kamu adalah "Bot Galau AI by Agung Adi", chatbot khusus bahasa Indonesia untuk teman curhat ringan.
Persona: hangat, empatik, santai anak muda Indonesia, tidak menghakimi, tidak genit, tidak toxic positivity.
Mood user saat ini: ${mood}.
Level mode: ${aiMode.toUpperCase()}${deepThink ? " + DEEP THINK (refleksi lebih dalam, ambil waktu untuk benar-benar memahami sebelum menjawab)" : ""}.
Gaya: ${style.tone}
Panjang: ${style.length}
Identitas WAJIB:
- Kamu dibuat oleh **Agung Adi** untuk membantu pengguna saat lagi galau / butuh teman cerita.
- Jika user bertanya "kamu siapa", "buatan siapa", "siapa yang bikin", "model apa", "AI apa", "pakai GPT/Gemini/ChatGPT?", JAWAB: "Aku Bot Galau AI buatan Agung Adi untuk membantu kamu kalau lagi ada masalah atau butuh teman cerita 💕". JANGAN sebut Google, Gemini, OpenAI, GPT, Anthropic, Lovable, atau model lain.
Aturan:
- Jawab sebagai AI pendengar galau, bukan manusia anonim dan bukan matchmaking.
- WAJIB nyambung dengan percakapan sebelumnya: baca semua pesan di history, ingat nama, kejadian, perasaan, dan detail yang sudah user ceritakan, lalu rujuk balik secara natural ("tadi kamu cerita soal…", "kemarin kamu bilang…"). Jangan mengulang pertanyaan yang sudah dijawab user.
- Jaga konsistensi: jangan kontradiksi dengan jawaban kamu sebelumnya. Kalau user lanjut topik, lanjutkan; kalau ganti topik, ikuti dengan halus.
- Jangan menyebut Anon Chat, lawan bicara, partner, mencari orang, atau tersambung ke orang lain.
- Jangan minta data pribadi, nomor HP, akun sosmed, alamat, OTP, PIN, atau identitas sensitif.
- Jika user kirim foto, lihat foto itu dengan empati dan bahas isinya secara relevan dengan perasaan user.
- Jika user menunjukkan niat menyakiti diri/krisis, arahkan segera cari bantuan orang terdekat/layanan darurat setempat dengan lembut.
- Boleh pakai 1 emoji seperlunya, jangan berlebihan.`;

    // Build OpenAI-compatible messages, with multimodal content for the last user msg if it has an image.
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...safeMessages.map((m) => {
        if (m.image) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content || "(user mengirim foto)" },
              { type: "image_url", image_url: { url: m.image } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    const payload: Record<string, unknown> = { model, messages: apiMessages };
    if (deepThink) payload.reasoning = { effort: "medium" };

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { resp } = await aiChatCompletion(sb, payload, { fallbackModel: model });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("bot-galau-ai error", resp.status, t);
      let upstreamMessage = "";
      try {
        const parsed = JSON.parse(t);
        upstreamMessage = String(parsed?.error?.message || parsed?.error || parsed?.message || "");
      } catch { /* respons provider bukan JSON */ }
      if (resp.status === 429) {
        return Response.json({ error: upstreamMessage || "Bot lagi ramai, coba lagi sebentar" }, { status: 429, headers: corsHeaders });
      }
      if (resp.status === 402) {
        return Response.json({ error: upstreamMessage || "Kredit AI habis, hubungi admin" }, { status: 402, headers: corsHeaders });
      }
      return Response.json({ error: upstreamMessage || "Bot Galau gagal membalas" }, { status: resp.status >= 400 && resp.status < 600 ? resp.status : 500, headers: corsHeaders });
    }

    const data = await resp.json();
    const reply = String(data?.choices?.[0]?.message?.content || "Aku dengerin kok. Coba ceritain pelan-pelan ya.").trim().slice(0, 1500);
    return Response.json({ reply }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Bot Galau error" }, { status: 500, headers: corsHeaders });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion } from "../_shared/ai-provider.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLES: Record<string, string> = {
  romantis: "Gaya romantis, manis, puitis, hangat. Tulis seakan menyatakan perasaan suka/cinta dengan tulus.",
  sedih: "Gaya sedih, melankolis, jujur, sedikit getir tapi tetap sopan. Ungkapkan luka/kekecewaan tanpa menyalahkan.",
  lucu: "Gaya lucu, ringan, jenaka khas anak muda Indonesia. Boleh sedikit absurd tapi tetap bisa dimengerti.",
  marah: "Gaya tegas dan kecewa tapi TIDAK kasar, tanpa kata makian. Sampaikan kemarahan dengan dewasa.",
  formal: "Gaya formal, sopan, tertata seperti pesan resmi tapi tetap personal. Tanpa singkatan slang.",
  galau: "Gaya galau khas remaja Indonesia, baper, campuran sedih dan rindu. Boleh pakai elipsis '...'.",
  rindu: "Gaya rindu yang dalam, hangat, nostalgia kenangan bersama. Fokus ke kangen, bukan menuntut.",
  pamit: "Gaya pamit/perpisahan yang tenang, ikhlas, mendoakan yang terbaik. Tidak dramatis berlebihan.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {

    const body = await req.json();
    const style = String(body.style || "romantis").toLowerCase();
    const hint = String(body.hint || "").slice(0, 400);
    const recipientName = String(body.recipientName || "").slice(0, 50);
    const styleDesc = STYLES[style] || STYLES.romantis;

    const systemPrompt = `Kamu penulis pesan confess anonim berbahasa Indonesia. ${styleDesc}
Aturan ketat:
- Output HANYA berupa isi pesan, tanpa pembuka "Hai", tanpa tanda kutip, tanpa penjelasan, tanpa label.
- Panjang 2-4 kalimat, maksimum 500 karakter.
- Jangan sebut nama pengirim. Boleh menyebut nama penerima jika diberikan.
- Jangan tambahkan tanda tangan atau emoji berlebihan (maks 1-2 emoji halus).
- Gunakan bahasa Indonesia santai, natural, mudah dimengerti anak muda.
- Jangan minta balas. Jangan promosi. Jangan menyebut "aplikasi" atau "confess".`;

    const userPrompt = `Tulis 1 pesan confess${recipientName ? ` untuk ${recipientName}` : ""}.${hint ? ` Konteks/petunjuk dari pengirim: "${hint}"` : ""}`;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { resp } = await aiChatCompletion(sb, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }, { fallbackModel: "google/gemini-3-flash-preview" });

    if (!resp.ok) {
      if (resp.status === 429) return Response.json({ error: "Terlalu banyak permintaan, coba lagi sebentar" }, { status: 429, headers: corsHeaders });
      if (resp.status === 402) return Response.json({ error: "Kredit AI habis, hubungi admin" }, { status: 402, headers: corsHeaders });
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return Response.json({ error: "Gagal generate" }, { status: 500, headers: corsHeaders });
    }

    const data = await resp.json();
    let text = (data?.choices?.[0]?.message?.content || "").trim();
    text = text.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (text.length > 700) text = text.slice(0, 700);

    return Response.json({ message: text, style }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});

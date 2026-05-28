import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLES: Record<string, string> = {
  romantis: "Romantis, manis, puitis, tulus dari hati. Pakai metafora lembut tentang cinta, hati, bintang, atau hujan.",
  sedih: "Sedih, melankolis, jujur tentang luka. Bahasa puitis tapi pilu, tidak lebay.",
  lucu: "Lucu, santai, receh tapi tetap manis. Boleh self-roast, gunakan kata gaul Indonesia.",
  marah: "Tegas, kecewa, to-the-point. Tidak kasar, tanpa kata-kata kotor, tapi terasa berat.",
  formal: "Formal, sopan, terstruktur. Cocok untuk minta maaf atau ucapan terima kasih serius.",
  galau: "Galau, overthinking, penuh tanda tanya pada diri sendiri. Lirih dan reflektif.",
  flirty: "Flirty, berani, sedikit menggoda tapi tetap elegan. Boleh selipkan pujian fisik halus.",
  puitis: "Sangat puitis, gaya sajak, kaya majas. Bisa berima ringan.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { style = "romantis", hint = "", senderName = "", targetHint = "" } = await req.json();
    const styleKey = String(style).toLowerCase();
    const styleDesc = STYLES[styleKey] || STYLES.romantis;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const system = `Kamu adalah penulis pesan "confess" anonim berbahasa Indonesia.
GAYA: ${styleDesc}
ATURAN:
- Tulis 1 pesan utuh (3-6 kalimat, total 60-180 kata).
- Bahasa Indonesia natural, BUKAN terjemahan kaku.
- JANGAN pakai pembuka "Hai/Halo/Hey/Yth".
- JANGAN sebut "anonim", "confess", atau "AI".
- JANGAN tanda tangan / nama pengirim di akhir.
- Boleh 1-2 emoji halus (opsional), bukan deretan.
- Output HANYA isi pesannya, tanpa quote, tanpa markdown, tanpa penjelasan.`;

    const user = `Tulis pesan confess dengan gaya "${styleKey}".
${hint ? `Inti yang ingin disampaikan: ${hint}` : "Bebas, tapi terasa personal."}
${senderName ? `Pengirim memperkenalkan diri sebagai: ${senderName}` : ""}
${targetHint ? `Sedikit konteks penerima: ${targetHint}` : ""}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.95,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 429) throw new Error("AI sedang sibuk, coba lagi sebentar");
      if (r.status === 402) throw new Error("Kuota AI habis, hubungi admin");
      throw new Error(`AI error: ${t.slice(0, 120)}`);
    }
    const data = await r.json();
    let text = data?.choices?.[0]?.message?.content?.trim() || "";
    text = text.replace(/^["'`]+|["'`]+$/g, "").replace(/\*\*/g, "").trim();
    if (text.length > 800) text = text.slice(0, 800);

    return new Response(JSON.stringify({ message: text, style: styleKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Gagal generate" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

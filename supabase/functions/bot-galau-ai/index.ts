const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMessage = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return Response.json({ error: "AI belum aktif, coba lagi nanti" }, { status: 500, headers: corsHeaders });
    }

    const body = await req.json();
    const mood = String(body.mood || "butuh teman").slice(0, 40);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const safeMessages: ChatMessage[] = messages
      .filter((m: ChatMessage) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 1200) }));

    const systemPrompt = `Kamu adalah Bot Galau AI khusus bahasa Indonesia untuk teman curhat ringan.
Persona: hangat, empatik, santai anak muda Indonesia, tidak menghakimi, tidak genit, tidak toxic positivity.
Konteks mood user saat ini: ${mood}.
Aturan:
- Jawab sebagai AI pendengar galau, bukan manusia anonim dan bukan matchmaking.
- Jangan menyebut Anon Chat, lawan bicara, partner, mencari orang, atau tersambung ke orang lain.
- Jangan minta data pribadi, nomor HP, akun sosmed, alamat, OTP, PIN, atau identitas sensitif.
- Jika user menunjukkan niat menyakiti diri/krisis, arahkan segera cari bantuan orang terdekat/layanan darurat setempat dengan lembut.
- Jawaban 2-5 kalimat, natural, boleh pakai 1 emoji seperlunya.
- Fokus menenangkan, memvalidasi perasaan, dan beri 1 langkah kecil yang bisa dilakukan sekarang.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages,
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return Response.json({ error: "Bot lagi ramai, coba lagi sebentar" }, { status: 429, headers: corsHeaders });
      if (resp.status === 402) return Response.json({ error: "Kredit AI habis, hubungi admin" }, { status: 402, headers: corsHeaders });
      const t = await resp.text();
      console.error("bot-galau-ai error", resp.status, t);
      return Response.json({ error: "Bot Galau gagal membalas" }, { status: 500, headers: corsHeaders });
    }

    const data = await resp.json();
    const reply = String(data?.choices?.[0]?.message?.content || "Aku dengerin kok. Coba ceritain pelan-pelan ya.").trim().slice(0, 1200);
    return Response.json({ reply }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Bot Galau error" }, { status: 500, headers: corsHeaders });
  }
});

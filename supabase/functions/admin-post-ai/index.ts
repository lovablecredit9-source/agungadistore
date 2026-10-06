// AI helper for Admin Posts: title options, short description, and context-aware artwork.
// Admin-only (checked server-side via is_admin_user). API keys never leave the server.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { aiFetch } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: corsHeaders });

const STYLES: Record<string, string> = {
  premium3d: "premium 3D modern app promotional artwork, glossy materials, soft studio reflections",
  neon: "neon cyberpunk mood, deep navy background, cyan and magenta rim lights",
  luxury: "luxury black and gold palette, elegant metallic materials, diamond sparkle highlights",
  gaming: "high-energy gaming key art, dynamic angle, fiery orange and electric blue glow",
  modernapp: "clean modern app showcase, floating smartphone with glossy UI cards, soft gradient",
  finance: "modern fintech visual, secure wallet, payment cards, shield lock, emerald and navy palette",
  music: "premium music visual, headphones, vinyl and album art, equalizer waves, violet glow",
  marketplace: "e-commerce marketplace visual, shopping bags, product boxes, price tags, warm gradient",
  ai: "AI technology visual, holographic interface, neural light lines, chat bubbles, blue glow",
  event: "festive event promo visual, confetti, gift boxes, spotlight, celebratory gradient",
};

const CATEGORY_HINTS: Record<string, string> = {
  pengumuman: "megaphone, official announcement panel",
  update: "app update rocket, sparkling new UI panels",
  streak: "realistic glowing flame, streak calendar, reward chest, premium items",
  shop: "shopping bag, product cards, cart, premium storefront",
  musik: "music player, headphones, album artwork, equalizer",
  game: "game controller, arcade elements, trophies, coins",
  saldo: "digital wallet, QRIS payment, shield security, coins",
  telegram: "messaging app chat bubbles, friendly bot assistant, paper plane, store/account/payment cards on a smartphone",
  promo: "discount tag, voucher ticket, gift box",
  event: "event stage, confetti, trophy, countdown",
};

function buildImagePrompt(title: string, content: string, category: string, style: string, keywords: string[]) {
  return [
    `Create a single wide 16:9 promotional artwork for an in-app announcement card of a digital store & entertainment app (Agung Adi Store).`,
    `Announcement title (for meaning only, do NOT render it as text): "${title}".`,
    content ? `Announcement details (for meaning only): "${content.slice(0, 500)}".` : "",
    `Main visual subjects: ${CATEGORY_HINTS[category] || "modern app interface"}${keywords.length ? `, plus objects that symbolize ${keywords.map((k) => CATEGORY_HINTS[k.toLowerCase()] || k.toLowerCase()).join("; ")}` : ""}. Wide cinematic landscape framing.`,
    `Style: ${STYLES[style] || STYLES.premium3d}. Realistic 3D, cinematic lighting, high detail, depth of field, premium gradient background, subtle glow, professional centered composition with the key subject in the middle third so it survives cropping on mobile cards.`,
    `ABSOLUTELY NO TEXT anywhere: no words, no letters, no labels on icons or buttons, no numbers, no logos, no watermark. UI panels must be blank shapes/icons only. No distorted UI, no people faces, no unrelated objects.`,
  ].filter(Boolean).join(" ");
}

async function chatText(system: string, user: string): Promise<string> {
  const r = await aiFetch("chat", {
    method: "POST",
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(r.status === 429 ? "AI sedang sibuk, coba lagi sebentar" : r.status === 402 ? "Kredit AI habis" : `AI error ${r.status}`);
  const d = await r.json();
  return String(d.choices?.[0]?.message?.content || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin } = await userClient.rpc("is_admin_user");
    if (!isAdmin) return json({ error: "Khusus admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const title = String(body.title || "").slice(0, 200);
    const content = String(body.content || "").slice(0, 3000);
    const category = String(body.category || "pengumuman");
    const style = String(body.style || "premium3d");
    const keywords = Array.isArray(body.keywords) ? body.keywords.map(String).slice(0, 6) : [];

    if (action === "titles") {
      if (!content && !title) return json({ error: "Isi postingan dulu" }, 400);
      const txt = await chatText(
        "Kamu copywriter aplikasi Agung Adi Store. Buat judul pengumuman Bahasa Indonesia, singkat (maks 45 karakter), menarik, diawali 1 emoji relevan. Balas HANYA JSON array berisi 3 string.",
        `Kategori: ${category}\nJudul draft: ${title || "-"}\nIsi: ${content}`,
      );
      const m = txt.match(/\[[\s\S]*\]/);
      let titles: string[] = [];
      try { titles = JSON.parse(m ? m[0] : txt); } catch { titles = txt.split("\n").map((s) => s.replace(/^[\d.\-*\s"]+|"$/g, "").trim()).filter(Boolean); }
      return json({ titles: titles.slice(0, 3) });
    }

    if (action === "description") {
      if (!content && !title) return json({ error: "Isi judul atau poin fitur dulu" }, 400);
      const txt = await chatText(
        "Kamu copywriter aplikasi Agung Adi Store. Tulis deskripsi pengumuman Bahasa Indonesia yang mudah dibaca, 2–4 kalimat pendek (maks 320 karakter), jelaskan manfaat untuk pengguna, tidak berlebihan, boleh 1–2 emoji. Balas teks deskripsinya saja.",
        `Kategori: ${category}\nJudul: ${title}\nPoin/isi dari admin: ${content}`,
      );
      return json({ description: txt.replace(/^"|"$/g, "") });
    }

    if (action === "image") {
      if (!title) return json({ error: "Judul wajib untuk generate gambar" }, 400);
      const prompt = buildImagePrompt(title, content, category, style, keywords);
      const r = await aiFetch("chat", {
        method: "POST",
        body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }),
      });
      if (!r.ok) return json({ error: r.status === 429 ? "AI sedang sibuk, coba lagi" : r.status === 402 ? "Kredit AI habis — upload gambar manual dulu" : "Generate gambar gagal — upload manual tetap bisa" }, 200);
      const d = await r.json();
      const msg = d.choices?.[0]?.message;
      let dataUrl: string = msg?.images?.[0]?.image_url?.url || "";
      if (!dataUrl && Array.isArray(msg?.content)) for (const p of msg.content) if (p.type === "image_url") { dataUrl = p.image_url?.url; break; }
      const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return json({ error: "AI tidak mengembalikan gambar, coba Regenerate" }, 200);
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      const ext = m[1].split("/")[1] || "png";
      const path = `posts/ai-${Date.now()}.${ext}`;
      const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { error: upErr } = await admin.storage.from("product-images").upload(path, bytes, { contentType: m[1] });
      if (upErr) return json({ error: "Gagal menyimpan gambar: " + upErr.message }, 200);
      const { data: pub } = admin.storage.from("product-images").getPublicUrl(path);
      return json({ imageUrl: pub.publicUrl });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});

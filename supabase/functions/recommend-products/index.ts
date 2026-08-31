import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { aiChatCompletion } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const safe = <T,>(p: PromiseLike<T>): Promise<T | null> =>
  Promise.resolve(p).then((v) => v).catch(() => null as any);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId } = await req.json().catch(() => ({}));

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Katalog produk. Utamakan yang ada stok, tapi fallback ke semua bila kosong.
    const { data: productsRaw } = await sb
      .from("products")
      .select("id,title,price,stock,category,sold_count,description")
      .order("sold_count", { ascending: false })
      .limit(60);
    let products = (productsRaw as any[]) || [];
    const inStock = products.filter((p) => (p.stock || 0) > 0);
    if (inStock.length > 0) products = inStock;

    if (products.length === 0) {
      return Response.json({ recommendations: [] }, { headers: corsHeaders });
    }

    // Sinyal personalisasi (best-effort)
    let likedTitles: string[] = [];
    let boughtTitles: string[] = [];
    let likedCats: string[] = [];

    if (visitorId) {
      const [likedRes, boughtRes] = await Promise.all([
        safe(sb.from("liked_products").select("product_id").eq("visitor_id", visitorId).limit(30)),
        safe(sb.from("balance_transactions").select("description").eq("visitor_id", visitorId).eq("type", "purchase").order("created_at", { ascending: false }).limit(30)),
      ]);
      const likedIds = ((likedRes?.data as any[]) || []).map((r) => r.product_id);
      const likedProducts = products.filter((p) => likedIds.includes(p.id));
      likedTitles = likedProducts.map((p) => p.title);
      likedCats = [...new Set(likedProducts.map((p) => p.category).filter(Boolean))];
      boughtTitles = ((boughtRes?.data as any[]) || []).map((r) => r.description).filter(Boolean).slice(0, 15);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Fallback heuristik jika AI tidak tersedia: prioritaskan kategori yang disukai lalu terlaris.
    const heuristic = () => {
      const scored = products.map((p) => {
        let s = (p.sold_count || 0) * 0.1;
        if (likedCats.includes(p.category)) s += 100;
        return { p, s };
      });
      scored.sort((a, b) => b.s - a.s);
      return scored.slice(0, 6).map(({ p }) => ({
        id: p.id,
        reason: likedCats.includes(p.category) ? "Sesuai kategori favoritmu" : "Produk terlaris pilihan toko",
      }));
    };

    if (!LOVABLE_API_KEY) {
      return Response.json({ recommendations: mapOut(heuristic(), products) }, { headers: corsHeaders });
    }

    const catalog = products.map((p) =>
      `- id:${p.id} | ${p.title} | Rp${Number(p.price || 0).toLocaleString("id-ID")} | kategori:${p.category || "Lainnya"} | terjual:${p.sold_count || 0}`,
    ).join("\n");

    const profile = [
      likedTitles.length ? `Produk yang disukai user: ${likedTitles.join(", ")}` : "",
      likedCats.length ? `Kategori favorit: ${likedCats.join(", ")}` : "",
      boughtTitles.length ? `Riwayat beli: ${boughtTitles.join(", ")}` : "",
    ].filter(Boolean).join("\n") || "User baru, belum ada riwayat.";

    const sys = `Kamu asisten rekomendasi produk untuk toko digital "Agung Adi Store". Pilih 6 produk paling relevan untuk user dari KATALOG. Balas HANYA JSON valid berbentuk {"recommendations":[{"id":"<id produk>","reason":"<alasan singkat maks 6 kata, bahasa Indonesia santai>"}]}. Gunakan id persis dari katalog. Utamakan relevansi dengan minat user; jika user baru, pilih yang terlaris & beragam.`;

    let recs: { id: string; reason: string }[] = [];
    try {
      const { resp: aiResp } = await aiChatCompletion(sb, {
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `PROFIL USER:\n${profile}\n\nKATALOG:\n${catalog}` },
        ],
        temperature: 0.6,
      }, { fallbackModel: "google/gemini-2.5-flash" });
      if (aiResp.ok) {
        const j = await aiResp.json();
        let content = j?.choices?.[0]?.message?.content || "";
        content = content.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(content);
        recs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
      }
    } catch (_) {
      recs = [];
    }

    // Validasi id benar-benar ada di katalog
    const validIds = new Set(products.map((p) => p.id));
    recs = recs.filter((r) => r && validIds.has(r.id)).slice(0, 6);
    if (recs.length === 0) recs = heuristic();

    return Response.json({ recommendations: mapOut(recs, products) }, { headers: corsHeaders });
  } catch (e: any) {
    return Response.json({ error: e?.message || "internal", recommendations: [] }, { status: 200, headers: corsHeaders });
  }
});

function mapOut(recs: { id: string; reason: string }[], products: any[]) {
  const byId = new Map(products.map((p) => [p.id, p]));
  return recs
    .map((r) => {
      const p = byId.get(r.id);
      if (!p) return null;
      return {
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category,
        sold_count: p.sold_count,
        reason: r.reason || "Rekomendasi untukmu",
      };
    })
    .filter(Boolean);
}

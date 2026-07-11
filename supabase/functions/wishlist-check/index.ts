import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const formatPrice = (n: number) => "Rp " + Number(n).toLocaleString("id-ID");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ambil semua item wishlist beserta produk terkait
    const { data: items, error } = await supabase
      .from("product_wishlist")
      .select("id, visitor_id, product_id, target_price, last_price, last_stock, notify_price_drop, notify_restock");

    if (error) throw error;

    let priceDropCount = 0;
    let restockCount = 0;

    for (const item of items ?? []) {
      const { data: product } = await supabase
        .from("products")
        .select("id, title, price, stock")
        .eq("id", item.product_id)
        .maybeSingle();

      if (!product) continue;

      const curPrice = Number(product.price) || 0;
      const curStock = Number(product.stock) || 0;
      const updates: Record<string, unknown> = {};

      // Notifikasi turun harga
      if (
        item.notify_price_drop &&
        item.last_price > 0 &&
        curPrice < item.last_price &&
        (!item.target_price || curPrice <= item.target_price)
      ) {
        const diff = item.last_price - curPrice;
        await supabase.rpc("create_notification", {
          p_visitor_id: item.visitor_id,
          p_title: "💸 Harga Turun!",
          p_message: `${product.title} kini ${formatPrice(curPrice)} (turun ${formatPrice(diff)} dari sebelumnya). Buruan sebelum naik lagi!`,
          p_type: "success",
          p_related_id: product.id,
        });
        priceDropCount++;
      }

      // Notifikasi stok tersedia kembali
      if (item.notify_restock && item.last_stock <= 0 && curStock > 0) {
        await supabase.rpc("create_notification", {
          p_visitor_id: item.visitor_id,
          p_title: "📦 Stok Tersedia!",
          p_message: `${product.title} sudah tersedia lagi (stok: ${curStock}). Yuk checkout sebelum kehabisan!`,
          p_type: "info",
          p_related_id: product.id,
        });
        restockCount++;
      }

      // Selalu simpan harga & stok terkini untuk perbandingan berikutnya
      if (curPrice !== item.last_price) updates.last_price = curPrice;
      if (curStock !== item.last_stock) updates.last_stock = curStock;
      if (Object.keys(updates).length > 0) {
        await supabase.from("product_wishlist").update(updates).eq("id", item.id);
      }
    }

    return new Response(
      JSON.stringify({ checked: items?.length ?? 0, priceDropCount, restockCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

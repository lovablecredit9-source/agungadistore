import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const AUTO_CONFIRM_HOURS = 5;

async function hashPin(pin: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 100) : "";

    // Lepas dana otomatis yang sudah lewat 5 jam (dipanggil saat daftar pesanan dibuka)
    await admin.rpc("seller_auto_release");
    if (action === "sweep") return json({ ok: true });

    const chatMsg = async (o: any, text: string, kind = "order", sender = "seller") => {
      if (!o.thread_id) return;
      await admin.from("seller_chat_messages").insert({
        thread_id: o.thread_id, sender, visitor_id: sender === "seller" ? o.seller_visitor_id : o.buyer_visitor_id,
        message: text, kind, payload: { order_number: o.order_number, title: o.product_title, total: o.total, qty: o.qty, status: o.status },
      });
      await admin.from("seller_chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", o.thread_id);
    };
    const notify = (vid: string, title: string, message: string) =>
      admin.from("notifications").insert({ visitor_id: vid, title, message, type: "seller" });

    if (action === "resolve") {
      const auth = req.headers.get("Authorization") || "";
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: isAdmin } = await userClient.rpc("is_admin_user");
      if (!isAdmin) return json({ error: "Khusus admin" }, 403);
      const { disputeId, decision, note } = body;
      if (!["refund", "release"].includes(decision)) return json({ error: "Keputusan tidak valid" }, 400);
      const { data: d } = await admin.from("seller_disputes").select("*").eq("id", disputeId).maybeSingle();
      if (!d || d.status !== "open") return json({ error: "Laporan tidak ditemukan / sudah selesai" }, 400);
      const { data: ok, error } = await admin.rpc(decision === "refund" ? "seller_refund_order" : "seller_release_order", { p_order_id: d.order_id });
      if (error) return json({ error: error.message }, 400);
      if (!ok) return json({ error: "Dana pesanan sudah tidak ditahan" }, 400);
      const status = decision === "refund" ? "refunded" : "released";
      await admin.from("seller_disputes").update({ status, admin_note: String(note || "").slice(0, 500) || null, resolved_at: new Date().toISOString() }).eq("id", d.id);
      const msg = decision === "refund" ? "Admin mengembalikan saldo ke pembeli." : "Admin meneruskan dana ke penjual.";
      await admin.from("seller_dispute_messages").insert({ dispute_id: d.id, sender: "admin", message: `✅ Keputusan: ${msg}${note ? " Catatan: " + note : ""}` });
      await notify(d.buyer_visitor_id, "Laporan pesanan diputuskan", msg);
      await notify(d.seller_visitor_id, "Laporan pesanan diputuskan", msg);
      return json({ ok: true });
    }

    if (!visitorId) return json({ error: "Akun tidak dikenali" }, 400);

    if (action === "checkout") {
      const pin = String(body.pin || "");
      if (!/^\d{6}$/.test(pin)) return json({ error: "Masukkan PIN 6 digit" }, 400);
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (!pinRow) return json({ error: "PIN belum dibuat" }, 400);
      if ((await hashPin(pin)) !== pinRow.pin_hash) {
        await admin.from("pin_attempts").insert({ visitor_id: visitorId, action: "verify", succeeded: false });
        return json({ error: "PIN salah" }, 400);
      }

      const { data: cart } = await admin.from("seller_cart_items").select("*").eq("visitor_id", visitorId);
      if (!cart?.length) return json({ error: "Keranjang kosong" }, 400);
      const ids = cart.map((c: any) => c.product_id);
      const { data: products } = await admin.from("seller_products").select("*").in("id", ids);
      const { data: stores } = await admin.from("seller_stores").select("*").in("id", [...new Set((products || []).map((p: any) => p.store_id))]);
      const pMap = new Map((products || []).map((p: any) => [p.id, p]));
      const sMap = new Map((stores || []).map((s: any) => [s.id, s]));

      let total = 0;
      for (const c of cart) {
        const p: any = pMap.get(c.product_id);
        const s: any = p && sMap.get(p.store_id);
        if (!p || p.status !== "approved" || !p.is_active) return json({ error: "Ada produk yang sudah tidak tersedia" }, 400);
        if (!s || !s.is_active || s.is_open === false) return json({ error: `Toko ${s?.store_name || ""} sedang tutup` }, 400);
        if (s.visitor_id === visitorId) return json({ error: "Tidak bisa membeli produk toko sendiri" }, 400);
        if (c.qty < 1 || c.qty > p.stock) return json({ error: `Stok ${p.title} tinggal ${p.stock}` }, 400);
        const form = p.order_form;
        if (form?.fields?.length) {
          for (const f of form.fields) {
            if (!String(c.order_fields?.[f] || "").trim()) return json({ error: `Isi "${f}" untuk ${p.title}` }, 400);
          }
        }
        total += Number(p.price) * c.qty;
      }

      const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
      if (!ubId) return json({ error: "Akun saldo belum terdaftar" }, 400);
      const { data: ub } = await admin.from("user_balances").select("id, balance, username").eq("id", ubId).maybeSingle();
      if (!ub || Number(ub.balance) < total) return json({ error: `Saldo utama tidak cukup (butuh Rp ${total.toLocaleString("id-ID")})` }, 400);

      // Kurangi stok secara kondisional dulu
      const reserved: { id: string; qty: number }[] = [];
      for (const c of cart) {
        const p: any = pMap.get(c.product_id);
        const { data: upd } = await admin.from("seller_products")
          .update({ stock: p.stock - c.qty, sold_count: (p.sold_count || 0) + c.qty })
          .eq("id", p.id).eq("stock", p.stock).select("id");
        if (!upd?.length) {
          for (const r of reserved) {
            const rp: any = pMap.get(r.id);
            await admin.from("seller_products").update({ stock: rp.stock, sold_count: rp.sold_count || 0 }).eq("id", r.id);
          }
          return json({ error: `Stok ${p.title} baru saja berubah, coba lagi` }, 409);
        }
        reserved.push({ id: p.id, qty: c.qty });
      }

      const { error: payErr } = await admin.rpc("consume_main_balance_only", { p_balance_id: ub.id, p_amount: total });
      if (payErr) {
        for (const r of reserved) {
          const rp: any = pMap.get(r.id);
          await admin.from("seller_products").update({ stock: rp.stock, sold_count: rp.sold_count || 0 }).eq("id", r.id);
        }
        return json({ error: "Saldo utama tidak cukup" }, 400);
      }
      await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "seller_purchase", amount: -total, description: `Belanja toko (${cart.length} produk)` });

      const buyerName = ub.username || "Pembeli";
      const created: any[] = [];
      for (const c of cart) {
        const p: any = pMap.get(c.product_id);
        const s: any = sMap.get(p.store_id);
        // cari / buat thread chat per toko+produk+pembeli
        let { data: th } = await admin.from("seller_chat_threads").select("id").eq("store_id", s.id).eq("product_id", p.id).eq("buyer_visitor_id", visitorId).maybeSingle();
        if (!th) {
          const ins = await admin.from("seller_chat_threads").insert({ store_id: s.id, product_id: p.id, buyer_visitor_id: visitorId, seller_visitor_id: s.visitor_id, product_title: p.title, buyer_name: buyerName }).select("id").single();
          th = ins.data;
        } else await admin.from("seller_chat_threads").update({ buyer_name: buyerName }).eq("id", th.id);
        const { data: o, error: oe } = await admin.from("seller_orders").insert({
          store_id: s.id, product_id: p.id, seller_visitor_id: s.visitor_id, buyer_visitor_id: visitorId,
          product_title: p.title, qty: c.qty, price: p.price, total: Number(p.price) * c.qty,
          buyer_name: buyerName, buyer_phone: "-", order_fields: { category: p.order_form?.category || null, ...(c.order_fields || {}) },
          status: "dibayar", escrow_status: "held", paid_at: new Date().toISOString(), thread_id: th?.id || null,
        }).select("*").single();
        if (oe) throw oe;
        created.push(o);
        await chatMsg(o, `🛒 Produk sudah dipesan: ${p.title} ×${c.qty}`, "order", "buyer");
        await notify(s.visitor_id, "📦 Pesanan baru", `#${o.order_number} ${p.title} ×${c.qty} sudah dibayar. Segera kirim.`);
      }
      await admin.from("seller_cart_items").delete().eq("visitor_id", visitorId);
      return json({ ok: true, orders: created.map((o) => ({ id: o.id, order_number: o.order_number })), total });
    }

    const orderId = String(body.orderId || "");
    const { data: o } = await admin.from("seller_orders").select("*").eq("id", orderId).maybeSingle();
    if (!o) return json({ error: "Pesanan tidak ditemukan" }, 404);

    if (action === "ship") {
      if (o.seller_visitor_id !== visitorId) return json({ error: "Bukan pesanan tokomu" }, 403);
      if (!["dibayar", "proses"].includes(o.status)) return json({ error: "Pesanan tidak bisa dikirim" }, 400);
      const data = String(body.deliveryData || "").trim().slice(0, 2000);
      if (!data) return json({ error: "Isi data pesanan yang dikirim" }, 400);
      const at = new Date(Date.now() + AUTO_CONFIRM_HOURS * 3600_000).toISOString();
      await admin.from("seller_orders").update({ status: "dikirim", delivery_data: data, shipped_at: new Date().toISOString(), auto_confirm_at: at, updated_at: new Date().toISOString() }).eq("id", o.id);
      await chatMsg({ ...o, status: "dikirim" }, `🚚 Pesanan #${o.order_number} sudah dikirim. Cek tab Pesanan lalu konfirmasi dalam ${AUTO_CONFIRM_HOURS} jam.`);
      await notify(o.buyer_visitor_id, "🚚 Pesanan dikirim", `#${o.order_number} ${o.product_title}. Konfirmasi dalam ${AUTO_CONFIRM_HOURS} jam atau ajukan kendala.`);
      return json({ ok: true });
    }

    if (action === "process") {
      if (o.seller_visitor_id !== visitorId) return json({ error: "Bukan pesanan tokomu" }, 403);
      if (o.status !== "dibayar") return json({ error: "Status tidak valid" }, 400);
      await admin.from("seller_orders").update({ status: "proses", updated_at: new Date().toISOString() }).eq("id", o.id);
      return json({ ok: true });
    }

    if (action === "confirm") {
      if (o.buyer_visitor_id !== visitorId) return json({ error: "Bukan pesananmu" }, 403);
      if (o.status !== "dikirim" || o.escrow_status !== "held") return json({ error: "Pesanan belum bisa dikonfirmasi" }, 400);
      await admin.rpc("seller_release_order", { p_order_id: o.id });
      await chatMsg({ ...o, status: "selesai" }, `✅ Pesanan #${o.order_number} dikonfirmasi diterima.`, "order", "buyer");
      await notify(o.seller_visitor_id, "✅ Pesanan selesai", `#${o.order_number} dikonfirmasi. Dana masuk ke saldo toko.`);
      return json({ ok: true });
    }

    if (action === "cancel") {
      if (o.seller_visitor_id !== visitorId) return json({ error: "Bukan pesanan tokomu" }, 403);
      if (!["dibayar", "proses"].includes(o.status)) return json({ error: "Pesanan sudah dikirim, tidak bisa dibatalkan" }, 400);
      const { error } = await admin.rpc("seller_refund_order", { p_order_id: o.id });
      if (error) return json({ error: error.message }, 400);
      await chatMsg({ ...o, status: "batal" }, `❌ Pesanan #${o.order_number} dibatalkan penjual. Saldo dikembalikan.`);
      await notify(o.buyer_visitor_id, "Pesanan dibatalkan", `#${o.order_number} dibatalkan. Saldo Rp ${Number(o.total).toLocaleString("id-ID")} dikembalikan.`);
      return json({ ok: true });
    }

    if (action === "dispute") {
      if (o.buyer_visitor_id !== visitorId) return json({ error: "Bukan pesananmu" }, 403);
      if (o.escrow_status !== "held") return json({ error: "Dana sudah dilepas, hubungi admin lewat tiket" }, 400);
      const reason = String(body.reason || "").trim().slice(0, 500);
      if (reason.length < 5) return json({ error: "Ceritakan kendalanya (min 5 huruf)" }, 400);
      const { data: exist } = await admin.from("seller_disputes").select("id").eq("order_id", o.id).eq("status", "open").maybeSingle();
      if (exist) return json({ ok: true, disputeId: exist.id });
      const { data: d } = await admin.from("seller_disputes").insert({ order_id: o.id, store_id: o.store_id, buyer_visitor_id: o.buyer_visitor_id, seller_visitor_id: o.seller_visitor_id, reason }).select("id").single();
      await admin.from("seller_dispute_messages").insert({ dispute_id: d!.id, sender: "buyer", visitor_id: visitorId, message: reason });
      await admin.from("seller_orders").update({ status: "kendala", escrow_status: "frozen", updated_at: new Date().toISOString() }).eq("id", o.id);
      await notify(o.seller_visitor_id, "🚩 Pesanan dilaporkan", `#${o.order_number} dilaporkan pembeli. Admin akan meninjau di chat laporan.`);
      return json({ ok: true, disputeId: d!.id });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Terjadi kesalahan" }, 500);
  }
});

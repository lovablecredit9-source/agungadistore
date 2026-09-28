import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const AUTO_CONFIRM_HOURS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 100) : "";
    const isAdminUser = async () => {
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
      const { data } = await userClient.rpc("is_admin_user");
      return data === true;
    };

    // Lepas dana otomatis yang sudah lewat 5 jam (dipanggil saat daftar pesanan dibuka)
    await admin.rpc("seller_auto_release");
    await admin.rpc("seller_dispute_sweep");
    if (action === "sweep") return json({ ok: true });

    // Lampiran chat toko (bucket privat, hanya peserta percakapan)
    if (action === "chat_upload" || action === "chat_file_url") {
      const threadId = String(body.threadId || "");
      const { data: role } = await admin.rpc("sc_role", { p_visitor_id: visitorId, p_thread_id: threadId });
      if (!role) return json({ error: "ACCESS DENIED" }, 403);
      if (action === "chat_file_url") {
        const path = String(body.path || "");
        if (!path.startsWith(threadId + "/")) return json({ error: "ACCESS DENIED" }, 403);
        const { data: msg } = await admin.from("seller_chat_messages").select("id").eq("thread_id", threadId).eq("attachment_path", path).is("deleted_at", null).maybeSingle();
        if (!msg) return json({ error: "File tidak ditemukan" }, 404);
        const { data, error } = await admin.storage.from("seller-chat-files").createSignedUrl(path, 300);
        if (error) throw error;
        return json({ url: data.signedUrl });
      }
      const allowed: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "text/plain": "txt" };
      const mime = String(body.mime || "");
      const ext = allowed[mime];
      if (!ext) return json({ error: "Jenis file tidak diizinkan (PDF, JPG, PNG, WEBP, TXT)" }, 400);
      const bytes = Uint8Array.from(atob(String(body.base64 || "")), (c) => c.charCodeAt(0));
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) return json({ error: "Ukuran file maksimal 5 MB" }, 400);
      const sig = Array.from(bytes.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const okSig = ext === "pdf" ? sig === "25504446" : ext === "png" ? sig === "89504e47" : ext === "jpg" ? sig.startsWith("ffd8") : ext === "webp" ? sig === "52494646" : true;
      if (!okSig) return json({ error: "Isi file tidak sesuai jenisnya" }, 400);
      const path = `${threadId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await admin.storage.from("seller-chat-files").upload(path, bytes, { contentType: mime });
      if (error) throw error;
      return json({ path });
    }

    const chatMsg = async (o: any, text: string, kind = "order", sender = "seller") => {
      if (!o.thread_id) return;
      await admin.from("seller_chat_messages").insert({
        thread_id: o.thread_id, sender, visitor_id: sender === "seller" ? o.seller_visitor_id : o.buyer_visitor_id,
        message: text, kind, payload: { order_number: o.order_number, order_code: o.order_code, title: o.product_title, total: o.total, qty: o.qty, status: o.status },
      });
      await admin.from("seller_chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", o.thread_id);
    };
    const notify = (vid: string, title: string, message: string) =>
      admin.from("notifications").insert({ visitor_id: vid, title, message, type: "seller" });

    if (action === "store_reviews") {
      const { data, error } = await admin.from("seller_reviews").select("id,buyer_name,buyer_visitor_id,product_id,product_rating,store_rating,comment,created_at,seller_reply,photo_url,edited_at,edit_count").eq("store_id", String(body.storeId || "")).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ reviews: data || [] });
    }
    if (action === "dispute_case" || action === "dispute_message" || action === "admin_disputes") {
      const isAdmin = await isAdminUser();
      if (action === "admin_disputes") {
        if (!isAdmin) return json({ error: "Khusus admin" }, 403);
        const { data: disputes } = await admin.from("seller_disputes").select("*").order("created_at", { ascending: false }).limit(60);
        const ids = (disputes || []).map((d) => d.order_id);
        const { data: orders } = ids.length ? await admin.from("seller_orders").select("id,order_code,product_title,product_image_url,store_name,buyer_name,buyer_note,delivery_data,price,qty,total,payment_method,paid_at,created_at,status,thread_id").in("id", ids) : { data: [] };
        return json({ disputes: (disputes || []).map((d) => ({ ...d, order: (orders || []).find((o) => o.id === d.order_id) })) });
      }
      if (!visitorId && !isAdmin) return json({ error: "Akun tidak dikenali" }, 403);
      const filter = action === "dispute_case" ? { key: "order_id", id: String(body.orderId || "") } : { key: "id", id: String(body.disputeId || "") };
      const { data: d } = await admin.from("seller_disputes").select("*").eq(filter.key, filter.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!d) return json({ case: null, messages: [] });
      if (!isAdmin && d.buyer_visitor_id !== visitorId && d.seller_visitor_id !== visitorId) return json({ error: "ACCESS DENIED" }, 403);
      if (action === "dispute_message") {
        const message = String(body.message || "").trim();
        if (!["open", "fixing"].includes(d.status) || !message || message.length > 1000) return json({ error: "Pesan tidak valid" }, 400);
        const sender = isAdmin ? "admin" : d.seller_visitor_id === visitorId ? "seller" : "buyer";
        const { error } = await admin.from("seller_dispute_messages").insert({ dispute_id: d.id, sender, visitor_id: isAdmin ? null : visitorId, message });
        if (error) throw error;
        const patch: Record<string, unknown> = {};
        if (sender === "seller") { if (!d.seller_responded_at) patch.seller_responded_at = new Date().toISOString(); if (d.awaiting === "seller") { patch.awaiting = null; patch.seller_respond_by = null; } }
        if (sender === "buyer" && d.awaiting === "buyer") { patch.awaiting = null; patch.buyer_respond_by = null; }
        if (Object.keys(patch).length) await admin.from("seller_disputes").update(patch).eq("id", d.id);
        Object.assign(d, patch);
      }
      const [{ data: messages }, { data: ord }, { data: buyerAcct }, { data: store }] = await Promise.all([
        admin.from("seller_dispute_messages").select("id,sender,message,image_url,created_at").eq("dispute_id", d.id).order("created_at"),
        admin.from("seller_orders").select("id,order_code,order_number,status,escrow_status,product_title,store_name,buyer_name").eq("id", d.order_id).maybeSingle(),
        admin.from("user_balances").select("username").eq("visitor_id", d.buyer_visitor_id).maybeSingle(),
        admin.from("seller_stores").select("store_name,is_verified").eq("id", d.store_id).maybeSingle(),
      ]);
      const buyerName = buyerAcct?.username || ord?.buyer_name || "Pembeli";
      const storeName = store?.store_name || ord?.store_name || "Toko";
      const names: Record<string, string> = { buyer: buyerName, seller: storeName, admin: "Admin", system: "Sistem" };
      return json({
        case: { ...d, buyer_name: buyerName, store_name: storeName, store_verified: !!store?.is_verified, order_code: ord?.order_code, order_number: ord?.order_number, order_status: ord?.status, escrow_status: ord?.escrow_status, product_title: ord?.product_title, viewer: isAdmin ? "admin" : d.seller_visitor_id === visitorId ? "seller" : "buyer" },
        messages: (messages || []).map((m) => ({ ...m, sender_name: names[m.sender] || m.sender })),
      });
    }

    if (action === "admin_renames" || action === "rename_decide") {
      if (!(await isAdminUser())) return json({ error: "Khusus admin" }, 403);
      if (action === "admin_renames") {
        const { data } = await admin.from("seller_store_rename_requests").select("*").order("created_at", { ascending: false }).limit(100);
        return json({ requests: data || [] });
      }
      const { data: r } = await admin.from("seller_store_rename_requests").select("*").eq("id", String(body.requestId || "")).maybeSingle();
      if (!r || r.status !== "pending") return json({ error: "Permintaan tidak ditemukan / sudah diputuskan" }, 400);
      const approve = body.approve === true;
      const note = String(body.note || "").slice(0, 300) || null;
      await admin.from("seller_store_rename_requests").update({ status: approve ? "approved" : "rejected", admin_note: note, decided_at: new Date().toISOString() }).eq("id", r.id);
      if (approve) {
        await admin.from("seller_stores").update({ store_name: r.new_name, free_rename_used: true, updated_at: new Date().toISOString() }).eq("id", r.store_id);
        await admin.from("seller_orders").update({ store_name: r.new_name }).eq("store_id", r.store_id);
      }
      await notify(r.visitor_id, approve ? "Nama toko disetujui" : "Ganti nama toko ditolak", approve ? `Nama toko kini "${r.new_name}".` : `Alasan: ${note || "-"}`);
      return json({ ok: true });
    }

    if (action === "resolve") {
      if (!(await isAdminUser())) return json({ error: "Khusus admin" }, 403);
      const { disputeId, decision, note } = body;
      if (!["refund", "release", "fix", "ask_buyer", "ask_seller", "close", "reject", "warn", "suspend"].includes(decision)) return json({ error: "Keputusan tidak valid" }, 400);
      const { data: d } = await admin.from("seller_disputes").select("*").eq("id", disputeId).maybeSingle();
      if (!d || !["open", "fixing"].includes(d.status)) return json({ error: "Laporan tidak ditemukan / sudah selesai" }, 400);
      const cleanNote = String(note || "").slice(0, 500);
      const day = new Date(Date.now() + 24 * 3600_000).toISOString();
      if (decision === "warn" || decision === "suspend") {
        const target = body.target === "seller" ? "seller" : body.target === "buyer" ? "buyer" : null;
        if (!target) return json({ error: "Pilih pembeli atau seller" }, 400);
        const targetVid = target === "seller" ? d.seller_visitor_id : d.buyer_visitor_id;
        const who = target === "seller" ? "seller" : "pembeli";
        let text = `⚠️ Admin memberikan peringatan kepada ${who}.`;
        if (decision === "suspend") {
          const days = Math.min(30, Math.max(1, Number(body.days || 3)));
          const { data: acct } = await admin.from("user_balances").select("id").eq("visitor_id", targetVid).maybeSingle();
          const { error: banErr } = await admin.from("account_bans").insert({ visitor_id: targetVid, user_balance_id: acct?.id || null, reason: `Sengketa pesanan: ${cleanNote || "melanggar aturan marketplace"}`, is_permanent: false, banned_until: new Date(Date.now() + days * 86400_000).toISOString(), is_active: true, banned_by: "admin" });
          if (banErr) return json({ error: banErr.message }, 400);
          text = `⛔ Admin menangguhkan akun ${who} selama ${days} hari.`;
        }
        await admin.from("seller_dispute_messages").insert({ dispute_id: d.id, sender: "admin", message: text + (cleanNote ? " Catatan: " + cleanNote : "") });
        await notify(targetVid, decision === "warn" ? "Peringatan dari admin" : "Akun ditangguhkan", text + (cleanNote ? " " + cleanNote : ""));
        await admin.from("seller_disputes").update({ admin_note: cleanNote || d.admin_note }).eq("id", d.id);
        return json({ ok: true });
      }
      if (decision === "reject") {
        const { data: ord } = await admin.from("seller_orders").select("status,delivery_sent_at").eq("id", d.order_id).maybeSingle();
        await admin.from("seller_disputes").update({ status: "rejected", decision: "reject", awaiting: null, resolved_at: new Date().toISOString(), admin_note: cleanNote || null }).eq("id", d.id);
        if (ord?.status === "kendala") await admin.from("seller_orders").update({ status: ord.delivery_sent_at ? "dikirim" : "proses", escrow_status: "held", auto_confirm_at: new Date(Date.now() + AUTO_CONFIRM_HOURS * 3600_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", d.order_id);
        const text = "🚫 Admin menolak laporan. Pesanan kembali ke alur normal dan dana diteruskan ke seller saat pesanan selesai.";
        await admin.from("seller_dispute_messages").insert({ dispute_id: d.id, sender: "admin", message: text + (cleanNote ? " Catatan: " + cleanNote : "") });
        await notify(d.buyer_visitor_id, "Laporan ditolak admin", text);
        await notify(d.seller_visitor_id, "Laporan ditolak admin", text);
        return json({ ok: true });
      }
      if (decision !== "refund" && decision !== "release") {
        const texts: Record<string, string> = {
          fix: "🛠️ Admin: pesanan harus diperbaiki penjual. Dana tetap ditahan. Penjual wajib merespons/mengirim ulang dalam 1 hari.",
          ask_buyer: "⏳ Admin: pembeli diminta konfirmasi dalam 1 hari. Jika tidak ada respons, dana diteruskan ke penjual.",
          ask_seller: "⏳ Admin: penjual diminta merespons dalam 1 hari. Jika tidak ada respons, pesanan dibatalkan dan dana dikembalikan.",
          close: "🔒 Admin menutup kasus. Pesanan kembali ke alur normal.",
        };
        if (decision === "fix") {
          await admin.from("seller_disputes").update({ status: "fixing", decision: "fix", awaiting: "seller", seller_respond_by: day, admin_note: cleanNote || null }).eq("id", d.id);
          await admin.from("seller_orders").update({ status: "proses", escrow_status: "held", updated_at: new Date().toISOString() }).eq("id", d.order_id);
        } else if (decision === "ask_buyer") {
          await admin.from("seller_disputes").update({ awaiting: "buyer", buyer_respond_by: day }).eq("id", d.id);
        } else if (decision === "ask_seller") {
          await admin.from("seller_disputes").update({ awaiting: "seller", seller_respond_by: day }).eq("id", d.id);
        } else {
          const { data: ord } = await admin.from("seller_orders").select("status,delivery_sent_at").eq("id", d.order_id).maybeSingle();
          await admin.from("seller_disputes").update({ status: "closed", decision: "close", awaiting: null, resolved_at: new Date().toISOString(), admin_note: cleanNote || null }).eq("id", d.id);
          if (ord?.status === "kendala") await admin.from("seller_orders").update({ status: ord.delivery_sent_at ? "dikirim" : "proses", escrow_status: "held", auto_confirm_at: new Date(Date.now() + AUTO_CONFIRM_HOURS * 3600_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", d.order_id);
        }
        await admin.from("seller_dispute_messages").insert({ dispute_id: d.id, sender: "admin", message: texts[decision] + (cleanNote ? " Catatan: " + cleanNote : "") });
        await notify(d.buyer_visitor_id, "Update laporan pesanan", texts[decision]);
        await notify(d.seller_visitor_id, "Update laporan pesanan", texts[decision]);
        return json({ ok: true });
      }
      const { data: ok, error } = await admin.rpc(decision === "refund" ? "seller_refund_order" : "seller_release_order", { p_order_id: d.order_id });
      if (error) return json({ error: error.message }, 400);
      if (!ok) return json({ error: "Dana pesanan sudah tidak ditahan" }, 400);
      const status = decision === "refund" ? "refunded" : "released";
      await admin.from("seller_disputes").update({ status, decision, awaiting: null, admin_note: cleanNote || null, resolved_at: new Date().toISOString() }).eq("id", d.id);
      const msg = decision === "refund" ? "Admin mengembalikan saldo ke pembeli." : "Admin meneruskan dana ke penjual.";
      await admin.from("seller_dispute_messages").insert({ dispute_id: d.id, sender: "admin", message: `✅ Keputusan: ${msg}${note ? " Catatan: " + note : ""}` });
      await notify(d.buyer_visitor_id, "Laporan pesanan diputuskan", msg);
      await notify(d.seller_visitor_id, "Laporan pesanan diputuskan", msg);
      return json({ ok: true });
    }

    if (!visitorId) return json({ error: "Akun tidak dikenali" }, 400);

    if (action === "seller_reminder_get") {
      const { data, error } = await admin
        .from("seller_reminder_preferences")
        .select("dismissed")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ dismissed: data?.dismissed === true });
    }
    if (action === "seller_reminder_set") {
      const dismissed = body.dismissed === true;
      const { error } = await admin
        .from("seller_reminder_preferences")
        .upsert({ visitor_id: visitorId, dismissed }, { onConflict: "visitor_id" });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, dismissed });
    }

    // Semua data pribadi buyer masuk melalui Edge Function. Tabel penyimpanan tidak dibuka ke browser.
    if (action === "buyer_catalog") {
      const productId = body.productId ? String(body.productId) : null;
      const storeId = body.storeId ? String(body.storeId) : null;
      const [{ data: extras, error }, productsQ, storesQ, flashQ] = await Promise.all([
        admin.rpc("buyer_catalog", { p_visitor_id: visitorId, p_product_id: productId, p_store_id: storeId }),
        admin.from("seller_products").select("*").eq("status", "approved").eq("is_active", true).is("archived_at", null).order("created_at", { ascending: false }).limit(200),
        admin.from("seller_stores").select("*").eq("is_active", true),
        admin.from("seller_flash_sales").select("*").eq("is_active", true).gt("ends_at", new Date().toISOString()),
      ]);
      if (error) return json({ error: error.message }, 400);
      const storeRows = storesQ.data || [];
      const ownerIds = [...new Set(storeRows.map((store) => store.visitor_id).filter(Boolean))];
      const { data: presence } = ownerIds.length
        ? await admin.from("user_balances").select("visitor_id,last_seen_at").in("visitor_id", ownerIds)
        : { data: [] };
      const seenByOwner = new Map((presence || []).map((row) => [row.visitor_id, row.last_seen_at]));
      const onlineAfter = Date.now() - 5 * 60 * 1000;
      const publicStores = storeRows.map((store) => {
        const lastSeen = seenByOwner.get(store.visitor_id) || null;
        return { ...store, owner_last_seen_at: lastSeen, owner_online: !!lastSeen && new Date(lastSeen).getTime() >= onlineAfter };
      });
      if (productId && extras) {
        const { data: reviews } = await admin.from("seller_reviews").select("id,buyer_visitor_id,buyer_name,product_rating,store_rating,comment,created_at,seller_reply,photo_url,edited_at,edit_count").eq("product_id", productId).order("created_at", { ascending: false }).limit(200);
        extras.reviews = reviews || [];
      }
      return json({ products: productsQ.data || [], stores: publicStores, flashes: flashQ.data || [], extras });
    }
    if (action === "buyer_data") {
      const [{ data: cart }, { data: orders }, { data: ub }, { data: pinRow }] = await Promise.all([
        admin.from("seller_cart_items").select("*").eq("visitor_id", visitorId).order("created_at"),
        admin.from("seller_orders").select("*").eq("buyer_visitor_id", visitorId).order("created_at", { ascending: false }).limit(100),
        admin.from("user_balances_public").select("balance,username").eq("visitor_id", visitorId).maybeSingle(),
        admin.from("user_pins").select("visitor_id").eq("visitor_id", visitorId).maybeSingle(),
      ]);
      const ids = (orders || []).map((o) => o.id);
      const [{ data: reviews }, { data: disputes }] = ids.length ? await Promise.all([
        admin.from("seller_reviews").select("id,order_id,product_rating,comment,photo_url,created_at,edit_count,edited_at").in("order_id", ids),
        admin.from("seller_disputes").select("id,order_id,status,awaiting,seller_respond_by,buyer_respond_by,decision").in("order_id", ids),
      ]) : [{ data: [] }, { data: [] }];
      const enriched = (orders || []).map((o) => ({ ...o, review: (reviews || []).find((r) => r.order_id === o.id) || null, dispute: (disputes || []).find((x) => x.order_id === o.id) || null }));
      return json({ cart: cart || [], orders: enriched, balance: Number(ub?.balance || 0), username: ub?.username || "Pembeli", hasPin: !!pinRow, serverNow: new Date().toISOString() });
    }
    if (action === "buyer_cart" || action === "checkout") {
      // Wajib login akun saldo: tanpa akun terdaftar tidak ada keranjang/pesanan
      const { data: acct } = await admin.from("user_balances").select("visitor_id").eq("visitor_id", visitorId).maybeSingle();
      if (!acct) return json({ error: "LOGIN_REQUIRED: Silakan login ke akun Anda untuk menggunakan saldo dan melakukan pembelian." }, 401);
    }
    if (action === "buyer_cart") {
      const { error } = await admin.rpc("buyer_cart_update", { p_visitor_id: visitorId, p_product_id: String(body.productId || ""), p_qty: Number(body.qty || 0) });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "buyer_saved") {
      const { data, error } = await admin.rpc("buyer_toggle_saved", { p_visitor_id: visitorId, p_kind: String(body.kind || ""), p_id: String(body.id || "") });
      if (error) return json({ error: error.message }, 400);
      return json({ active: data });
    }
    if (action === "buyer_report_product") {
      const { data, error } = await admin.rpc("buyer_report_product", { p_visitor_id: visitorId, p_product_id: String(body.productId || ""), p_reason: String(body.reason || ""), p_detail: String(body.detail || "") });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, reportNumber: data });
    }
    if (action === "buyer_review") {
      const photo = String(body.photo || "");
      if (photo && (!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(photo) || photo.length > 1_400_000)) return json({ error: "Foto ulasan tidak valid atau terlalu besar" }, 400);
      const { data, error } = await admin.rpc("buyer_review_order_v2", { p_visitor_id: visitorId, p_order_id: String(body.orderId || ""), p_rating: Number(body.rating), p_comment: String(body.comment || ""), p_photo: photo || null });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, reviewId: data });
    }
    if (action === "rename_request") {
      const { data: st } = await admin.from("seller_stores").select("id,store_name,free_rename_used").eq("visitor_id", visitorId).maybeSingle();
      if (!st) return json({ error: "Toko tidak ditemukan" }, 404);
      if (st.free_rename_used) return json({ error: "Kesempatan ganti nama gratis sudah digunakan" }, 400);
      const newName = String(body.newName || "").trim().slice(0, 60);
      if (newName.length < 3 || newName === st.store_name) return json({ error: "Nama baru tidak valid" }, 400);
      const { data: pending } = await admin.from("seller_store_rename_requests").select("id").eq("store_id", st.id).eq("status", "pending").maybeSingle();
      if (pending) return json({ error: "Masih ada permintaan yang menunggu admin" }, 400);
      await admin.from("seller_store_rename_requests").insert({ store_id: st.id, visitor_id: visitorId, old_name: st.store_name, new_name: newName, reason: String(body.reason || "").slice(0, 300) || null });
      return json({ ok: true });
    }
    if (action === "rename_status") {
      const { data } = await admin.from("seller_store_rename_requests").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(5);
      const { data: st } = await admin.from("seller_stores").select("free_rename_used").eq("visitor_id", visitorId).maybeSingle();
      return json({ requests: data || [], free_rename_used: !!st?.free_rename_used });
    }
    if (action === "buyer_cancel") {
      const { data: ord } = await admin.from("seller_orders").select("*").eq("id", String(body.orderId || "")).maybeSingle();
      const { error } = await admin.rpc("buyer_cancel_order", { p_visitor_id: visitorId, p_order_id: String(body.orderId || "") });
      if (error) return json({ error: error.message }, 400);
      if (ord) { await chatMsg({ ...ord, status: "batal" }, `❌ Pesanan #${ord.order_code} dibatalkan pembeli. Dana dikembalikan ke pembeli.`, "order", "buyer"); await notify(ord.seller_visitor_id, "Pesanan dibatalkan pembeli", `#${ord.order_code} dibatalkan. Dana tidak diteruskan.`); }
      return json({ ok: true });
    }

    if (action === "checkout") {
      const pin = String(body.pin || "");
      if (!/^\d{4,6}$/.test(pin)) return json({ error: "Masukkan PIN transaksi" }, 400);
      const storeId = String(body.storeId || "");
      const cartIds = Array.isArray(body.cartIds) ? body.cartIds.map(String).slice(0, 100) : [];
      const { data, error } = await admin.rpc("buyer_checkout", {
        p_visitor_id: visitorId, p_pin: pin, p_store_id: storeId, p_cart_ids: cartIds,
        p_voucher_code: String(body.voucherCode || "").trim() || null,
        p_buyer_note: String(body.buyerNote || "").slice(0, 500) || null,
        p_checkout_ref: String(body.checkoutRef || crypto.randomUUID()),
      });
      if (error) return json({ error: error.message }, error.message.includes("berubah") ? 409 : 400);
      return json(data);
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
      await admin.from("seller_orders").update({ status: "dikirim", delivery_data: data, delivery_sent_at: new Date().toISOString(), shipped_at: new Date().toISOString(), auto_confirm_at: at, updated_at: new Date().toISOString() }).eq("id", o.id);
      await chatMsg({ ...o, status: "dikirim" }, `🚚 Pesanan #${o.order_code} sudah dikirim. Cek tab Pesanan lalu konfirmasi dalam ${AUTO_CONFIRM_HOURS} jam.`);
      await notify(o.buyer_visitor_id, "🚚 Pesanan dikirim", `#${o.order_code} ${o.product_title}. Konfirmasi dalam ${AUTO_CONFIRM_HOURS} jam atau ajukan kendala.`);
      return json({ ok: true });
    }

    if (action === "process") {
      if (o.seller_visitor_id !== visitorId) return json({ error: "Bukan pesanan tokomu" }, 403);
      if (o.status !== "dibayar") return json({ error: "Status tidak valid" }, 400);
      await admin.from("seller_orders").update({ status: "proses", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", o.id);
      return json({ ok: true });
    }

    if (action === "confirm") {
      if (o.buyer_visitor_id !== visitorId) return json({ error: "Bukan pesananmu" }, 403);
      if (o.status !== "dikirim" || o.escrow_status !== "held") return json({ error: "Pesanan belum bisa dikonfirmasi" }, 400);
      await admin.rpc("seller_release_order", { p_order_id: o.id });
      await admin.from("seller_disputes").update({ status: "released", decision: "fixed_confirmed", awaiting: null, resolved_at: new Date().toISOString() }).eq("order_id", o.id).eq("status", "fixing");
      await chatMsg({ ...o, status: "selesai" }, `✅ Pesanan #${o.order_code} dikonfirmasi diterima.`, "order", "buyer");
      await notify(o.seller_visitor_id, "✅ Pesanan selesai", `#${o.order_code} dikonfirmasi. Dana masuk ke saldo toko.`);
      return json({ ok: true });
    }

    if (action === "cancel") {
      if (o.seller_visitor_id !== visitorId) return json({ error: "Bukan pesanan tokomu" }, 403);
      if (!["dibayar", "proses"].includes(o.status)) return json({ error: "Pesanan sudah dikirim, tidak bisa dibatalkan" }, 400);
      const { error } = await admin.rpc("seller_refund_order", { p_order_id: o.id });
      if (error) return json({ error: error.message }, 400);
      await chatMsg({ ...o, status: "batal" }, `❌ Pesanan #${o.order_code} dibatalkan penjual. Saldo dikembalikan.`);
      await notify(o.buyer_visitor_id, "Pesanan dibatalkan", `#${o.order_code} dibatalkan. Saldo Rp ${Number(o.total).toLocaleString("id-ID")} dikembalikan.`);
      return json({ ok: true });
    }

    if (action === "dispute") {
      if (o.buyer_visitor_id !== visitorId) return json({ error: "Bukan pesananmu" }, 403);
      if (o.escrow_status !== "held") return json({ error: "Dana sudah dilepas, hubungi admin lewat tiket" }, 400);
      const reason = String(body.reason || "").trim().slice(0, 500);
      if (reason.length < 5) return json({ error: "Ceritakan kendalanya (min 5 huruf)" }, 400);
      const evidence = String(body.evidence || "");
      if (evidence && (!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(evidence) || evidence.length > 1_400_000)) return json({ error: "Bukti foto tidak valid atau terlalu besar" }, 400);
      const { data: exist } = await admin.from("seller_disputes").select("id").eq("order_id", o.id).limit(1).maybeSingle();
      if (exist || o.dispute_used) return json({ error: "Laporan kendala untuk pesanan ini sudah pernah dibuat" }, 400);
      const { data: claimed } = await admin.from("seller_orders").update({ dispute_used: true }).eq("id", o.id).eq("dispute_used", false).select("id").maybeSingle();
      if (!claimed) return json({ error: "Laporan kendala untuk pesanan ini sudah pernah dibuat" }, 400);
      const { data: d } = await admin.from("seller_disputes").insert({ order_id: o.id, store_id: o.store_id, buyer_visitor_id: o.buyer_visitor_id, seller_visitor_id: o.seller_visitor_id, reason, awaiting: "seller", seller_respond_by: new Date(Date.now() + 24 * 3600_000).toISOString() }).select("id").single();
      await admin.from("seller_dispute_messages").insert({ dispute_id: d!.id, sender: "buyer", visitor_id: visitorId, message: reason, image_url: evidence || null });
      await admin.from("seller_orders").update({ status: "kendala", escrow_status: "frozen", updated_at: new Date().toISOString() }).eq("id", o.id);
      await notify(o.seller_visitor_id, "🚩 Pesanan dilaporkan", `#${o.order_code} dilaporkan pembeli. Balas di grup kendala maksimal 1 hari atau pesanan dibatalkan otomatis.`);
      return json({ ok: true, disputeId: d!.id });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Terjadi kesalahan" }, 500);
  }
});

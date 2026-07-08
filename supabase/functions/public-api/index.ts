import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function phoneVariants(value: string) {
  const cleaned = String(value || "").replace(/\D/g, "");
  const variants = new Set<string>();
  if (!cleaned) return [];
  variants.add(cleaned);
  variants.add(`+${cleaned}`);
  if (cleaned.startsWith("62")) variants.add(`0${cleaned.slice(2)}`);
  if (cleaned.startsWith("0")) {
    variants.add(`62${cleaned.slice(1)}`);
    variants.add(`+62${cleaned.slice(1)}`);
  }
  if (cleaned.startsWith("8")) {
    variants.add(`62${cleaned}`);
    variants.add(`+62${cleaned}`);
    variants.add(`0${cleaned}`);
  }
  return [...variants];
}

function cleanWaPeerJid(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return "";
  const [userPart, domainPart] = raw.split("@");
  const user = String(userPart || "").split(":")[0].replace(/[^0-9a-z._-]/g, "");
  const domain = String(domainPart || "").replace(/[^0-9a-z._-]/g, "");
  return user && domain ? `${user}@${domain}` : "";
}

function collectWaPeerJids(value: unknown, out = new Set<string>()) {
  if (!value) return out;
  if (typeof value === "string") {
    const jid = cleanWaPeerJid(value);
    if (jid) out.add(jid);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectWaPeerJids(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectWaPeerJids(item, out);
  }
  return out;
}

function peerJidsFromBody(body: any) {
  const out = new Set<string>();
  collectWaPeerJids(body?.from_jid, out);
  collectWaPeerJids(body?.remote_jid, out);
  collectWaPeerJids(body?.sender_jid, out);
  collectWaPeerJids(body?.chat_jid, out);
  collectWaPeerJids(body?.peer_jids, out);
  collectWaPeerJids(body?.wa_peer_jids, out);
  return [...out];
}

async function saveWaPeerMappings(supabase: any, peerJids: string[], phoneValue: unknown, source = "confess") {
  const phone = String(phoneValue || "").replace(/\D/g, "");
  const uniqueJids = [...new Set((peerJids || []).map(cleanWaPeerJid).filter(Boolean))];
  if (!phone || phone.length < 9 || phone.length > 16 || uniqueJids.length === 0) return;
  const rows = uniqueJids.map((peer_jid) => ({
    peer_jid,
    phone,
    source,
    last_seen_at: new Date().toISOString(),
  }));
  await supabase.from("wa_peer_phone_mappings").upsert(rows, { onConflict: "peer_jid" });
}

async function resolveMappedPhone(supabase: any, body: any) {
  const peerJids = peerJidsFromBody(body);
  if (!peerJids.length) return "";
  const { data } = await supabase
    .from("wa_peer_phone_mappings")
    .select("phone")
    .in("peer_jid", peerJids)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return String(data?.phone || "").replace(/\D/g, "");
}

function gen6DigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}

// Token login WA acak alfanumerik (huruf besar + angka), panjang 22
function genWaLoginToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(22));
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "";
  const isConfessEndpoint = endpoint.startsWith("confess_");

  const apiKey = req.headers.get("x-api-key");
  if (!isConfessEndpoint) {
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: keyData, error: keyErr } = await supabase
      .from("api_keys")
      .select("*")
      .eq("api_key", apiKey)
      .eq("is_active", true)
      .maybeSingle();

    if (keyErr || !keyData) {
      return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);
  }


  try {
    let result: any = null;

    switch (endpoint) {
      case "products": {
        const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "sponsors": {
        const { data } = await supabase.from("sponsors").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "balances": {
        const { data } = await supabase.from("user_balances").select("id, visitor_id, username, phone, email, balance, created_at");
        result = data;
        break;
      }
      case "songs": {
        const { data } = await supabase.from("playlist_songs").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "deposits": {
        const { data } = await supabase.from("deposits").select("*").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "notifications": {
        if (req.method === "POST") {
          const body = await req.json();
          const { visitor_id, title, message, type } = body;
          if (!visitor_id || !title) {
            return new Response(JSON.stringify({ error: "visitor_id and title required" }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const { data, error } = await supabase.from("notifications").insert({
            visitor_id, title, message: message || "", type: type || "info",
          }).select().single();
          if (error) throw error;
          result = data;
        } else {
          const vid = url.searchParams.get("visitor_id");
          let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
          if (vid) q = q.eq("visitor_id", vid);
          const { data } = await q;
          result = data;
        }
        break;
      }
      case "tokens": {
        const { data } = await supabase.from("tokens").select("*, products(title)").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "transactions": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("balance_transactions").select("*").order("created_at", { ascending: false }).limit(50);
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "streaks": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("daily_streaks").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "wa_notif_slots": {
        const vid = url.searchParams.get("visitor_id");
        if (!vid) { result = []; break; }
        const { data } = await supabase
          .from("user_wa_notif_numbers")
          .select("wa_number, label, slot_index, is_paid, paid_until, notify_purchase, notify_login, notify_deposit")
          .eq("visitor_id", vid)
          .order("slot_index", { ascending: true });
        result = data || [];
        break;
      }

      case "game_credits": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("user_game_credits").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "game_stats": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("game_stats").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "game_profiles": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("game_profiles").select("id, visitor_id, display_name, description, avatar_url, is_guest, created_at");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "tickets": {
        const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(50);
        result = data;
        break;
      }
      case "playlists": {
        const { data } = await supabase.from("playlists").select("*, playlist_items(song_id)").order("created_at", { ascending: false });
        result = data;
        break;
      }
      case "artists": {
        const { data } = await supabase.from("artists").select("*").order("name");
        result = data;
        break;
      }
      case "public_songs": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("public_songs").select("*").order("created_at", { ascending: false }).limit(50);
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      case "storage": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("user_music_storage").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      // ── Vouchers ──
      case "vouchers": {
        const vtype = url.searchParams.get("type") || "all";
        const results: any = {};
        if (vtype === "all" || vtype === "discount") {
          const { data } = await supabase.from("discount_vouchers").select("*").order("created_at", { ascending: false });
          results.discount = data;
        }
        if (vtype === "all" || vtype === "game") {
          const { data } = await supabase.from("game_discount_vouchers").select("*").order("created_at", { ascending: false });
          results.game = data;
        }
        if (vtype === "all" || vtype === "streak") {
          const { data } = await supabase.from("streak_discount_vouchers").select("*").order("created_at", { ascending: false });
          results.streak = data;
        }
        if (vtype === "all" || vtype === "music") {
          const { data } = await supabase.from("music_discount_vouchers").select("*").order("created_at", { ascending: false });
          results.music = data;
        }
        if (vtype === "all" || vtype === "storage") {
          const { data } = await supabase.from("music_storage_vouchers").select("*").order("created_at", { ascending: false });
          results.storage = data;
        }
        result = results;
        break;
      }
      // ── Packages ──
      case "packages": {
        const ptype = url.searchParams.get("type") || "all";
        const results: any = {};
        if (ptype === "all" || ptype === "credit") {
          const { data } = await supabase.from("credit_packages").select("*").eq("is_active", true).order("sort_order");
          results.credit = data;
        }
        if (ptype === "all" || ptype === "streak") {
          const { data } = await supabase.from("streak_packages").select("*").eq("is_active", true).order("sort_order");
          results.streak = data;
        }
        if (ptype === "all" || ptype === "storage") {
          const { data } = await supabase.from("storage_packages").select("*").eq("is_active", true).order("sort_order");
          results.storage = data;
        }
        if (ptype === "all" || ptype === "bundle") {
          const { data } = await supabase.from("bundle_packages").select("*").eq("is_active", true).order("sort_order");
          results.bundle = data;
        }
        result = results;
        break;
      }
      // ── Likes count ──
      case "likes": {
        const [{ count: prodLikes }, { count: songLikes }, { count: sponsorLikes }] = await Promise.all([
          supabase.from("liked_products").select("*", { count: "exact", head: true }),
          supabase.from("liked_songs").select("*", { count: "exact", head: true }),
          supabase.from("liked_sponsors").select("*", { count: "exact", head: true }),
        ]);
        result = { products: prodLikes || 0, songs: songLikes || 0, sponsors: sponsorLikes || 0 };
        break;
      }
      // ── Product chats ──
      case "chats": {
        const { data } = await supabase.from("product_chats").select("*, product_chat_messages(id, message, sender_type, created_at)").order("created_at", { ascending: false }).limit(30);
        result = data;
        break;
      }
      // ── Streak subscriptions ──
      case "streak_subs": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("streak_subscriptions").select("*").order("created_at", { ascending: false });
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      // ── Music profiles ──
      case "music_profiles": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("music_profiles").select("*");
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      // ── Login history ──
      case "login_history": {
        const vid = url.searchParams.get("visitor_id");
        let q = supabase.from("balance_login_history").select("*").order("logged_in_at", { ascending: false }).limit(30);
        if (vid) q = q.eq("visitor_id", vid);
        const { data } = await q;
        result = data;
        break;
      }
      // ── Dashboard stats ──
      case "dashboard": {
        const [
          { count: totalProducts }, { count: totalUsers }, { count: totalSongs },
          { count: totalSponsors }, { count: totalDeposits }, { count: totalTickets },
          { count: totalArtists }, { count: totalPublicSongs },
        ] = await Promise.all([
          supabase.from("products").select("*", { count: "exact", head: true }),
          supabase.from("user_balances").select("*", { count: "exact", head: true }),
          supabase.from("playlist_songs").select("*", { count: "exact", head: true }),
          supabase.from("sponsors").select("*", { count: "exact", head: true }),
          supabase.from("deposits").select("*", { count: "exact", head: true }),
          supabase.from("support_tickets").select("*", { count: "exact", head: true }),
          supabase.from("artists").select("*", { count: "exact", head: true }),
          supabase.from("public_songs").select("*", { count: "exact", head: true }),
        ]);
        const { data: balances } = await supabase.from("user_balances").select("balance");
        const totalBalance = balances ? balances.reduce((s: number, b: any) => s + Number(b.balance), 0) : 0;
        result = {
          products: totalProducts || 0, users: totalUsers || 0, songs: totalSongs || 0,
          sponsors: totalSponsors || 0, deposits: totalDeposits || 0, tickets: totalTickets || 0,
          artists: totalArtists || 0, public_songs: totalPublicSongs || 0, total_balance: totalBalance,
        };
        break;
      }
      // ═══ POST ENDPOINTS ═══
      case "add_balance": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const body = await req.json();
        const { visitor_id, amount, description } = body;
        if (!visitor_id || !amount) {
          return new Response(JSON.stringify({ error: "visitor_id and amount required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: user } = await supabase.from("user_balances").select("id, balance").eq("visitor_id", visitor_id).maybeSingle();
        if (!user) {
          return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const newBalance = user.balance + Number(amount);
        await supabase.from("user_balances").update({ balance: newBalance }).eq("id", user.id);
        await supabase.from("balance_transactions").insert({
          visitor_id, type: Number(amount) >= 0 ? "topup" : "debit", amount: Math.abs(Number(amount)),
          description: description || (Number(amount) >= 0 ? "Top up via API" : "Debit via API"),
        });
        // Bonus 15% Saldo IN saat admin top-up (amount positif & >= 10.000)
        let adminBonus = 0;
        if (Number(amount) >= 10000) {
          adminBonus = Math.floor(Number(amount) * 0.15);
          await supabase.rpc("add_topup_bonus_to_saldo_in", { p_visitor_id: visitor_id, p_amount: adminBonus });
          await supabase.from("balance_transactions").insert({ visitor_id, type: "topup_bonus", amount: adminBonus, description: `🎁 Bonus 15% top-up admin → Saldo IN` });
        }
        result = { visitor_id, new_balance: newBalance, bonus_saldo_in: adminBonus };
        break;
      }
      case "deduct_balance": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const body = await req.json();
        const { visitor_id, amount, description } = body;
        if (!visitor_id || !amount || Number(amount) <= 0) {
          return new Response(JSON.stringify({ error: "visitor_id and positive amount required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: user } = await supabase.from("user_balances").select("id, balance").eq("visitor_id", visitor_id).maybeSingle();
        if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (user.balance < Number(amount)) return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const newBal = user.balance - Number(amount);
        await supabase.from("user_balances").update({ balance: newBal }).eq("id", user.id);
        await supabase.from("balance_transactions").insert({ visitor_id, type: "debit", amount: Number(amount), description: description || "Debit via API" });
        result = { visitor_id, new_balance: newBal };
        break;
      }
      case "reset_balance": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: user } = await supabase.from("user_balances").select("id, balance").eq("visitor_id", visitor_id).maybeSingle();
        if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const oldBal = user.balance;
        await supabase.from("user_balances").update({ balance: 0 }).eq("id", user.id);
        if (oldBal > 0) await supabase.from("balance_transactions").insert({ visitor_id, type: "debit", amount: oldBal, description: "Reset saldo via API" });
        await supabase.from("notifications").insert({ visitor_id, title: "Saldo Direset", message: `Saldo Anda telah direset dari Rp ${oldBal.toLocaleString()} ke Rp 0`, type: "warning" });
        result = { visitor_id, old_balance: oldBal, new_balance: 0 };
        break;
      }
      case "reset_credits": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("user_game_credits").update({ credits: 0, unlimited_until: null }).eq("visitor_id", visitor_id);
        await supabase.from("notifications").insert({ visitor_id, title: "Kredit Direset", message: "Kredit game Anda telah direset ke 0", type: "warning" });
        result = { visitor_id, credits: 0 };
        break;
      }
      case "set_credits": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, credits } = body;
        if (!visitor_id || credits === undefined) return new Response(JSON.stringify({ error: "visitor_id and credits required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("user_game_credits").update({ credits: Number(credits) }).eq("visitor_id", visitor_id);
        await supabase.from("notifications").insert({ visitor_id, title: "Kredit Diubah", message: `Kredit game Anda diubah menjadi ${credits}`, type: "info" });
        result = { visitor_id, credits: Number(credits) };
        break;
      }
      case "reset_streak": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("daily_streaks").delete().eq("visitor_id", visitor_id);
        await supabase.from("streak_subscriptions").update({ is_active: false }).eq("visitor_id", visitor_id).eq("is_active", true);
        await supabase.from("notifications").insert({ visitor_id, title: "Streak Direset", message: "Data streak harian Anda telah direset", type: "warning" });
        result = { visitor_id, streak: 0 };
        break;
      }
      case "reset_storage": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("user_music_storage").delete().eq("visitor_id", visitor_id);
        await supabase.from("notifications").insert({ visitor_id, title: "Storage Direset", message: "Storage musik Anda telah direset", type: "warning" });
        result = { visitor_id, storage: 0 };
        break;
      }
      case "update_stock": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { product_id, stock } = body;
        if (!product_id || stock === undefined) return new Response(JSON.stringify({ error: "product_id and stock required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await supabase.from("products").update({ stock: Number(stock) }).eq("id", product_id);
        if (error) throw error;
        result = { product_id, stock: Number(stock) };
        break;
      }
      case "broadcast": {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const body = await req.json();
        const { title, message, type } = body;
        if (!title) {
          return new Response(JSON.stringify({ error: "title required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: users } = await supabase.from("user_balances").select("visitor_id");
        if (users && users.length > 0) {
          const notifs = users.map((u: any) => ({
            visitor_id: u.visitor_id, title, message: message || "", type: type || "info",
          }));
          await supabase.from("notifications").insert(notifs);
        }
        result = { sent_to: users?.length || 0 };
        break;
      }
      case "delete_notifications": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { count } = await supabase.from("notifications").delete({ count: "exact" }).eq("visitor_id", visitor_id);
        result = { visitor_id, deleted: count || 0 };
        break;
      }
      case "set_deposit_status": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { deposit_id, status } = body;
        if (!deposit_id || !status) return new Response(JSON.stringify({ error: "deposit_id and status required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await supabase.from("deposits").update({ status }).eq("id", deposit_id);
        if (error) throw error;
        result = { deposit_id, status };
        break;
      }
      case "set_ticket_status": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { ticket_id, status } = body;
        if (!ticket_id || !status) return new Response(JSON.stringify({ error: "ticket_id and status required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticket_id);
        if (error) throw error;
        result = { ticket_id, status };
        break;
      }
      // ── Set balance directly ──
      case "set_balance": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, balance } = body;
        if (!visitor_id || balance === undefined) return new Response(JSON.stringify({ error: "visitor_id and balance required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: user } = await supabase.from("user_balances").select("id, balance").eq("visitor_id", visitor_id).maybeSingle();
        if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("user_balances").update({ balance: Number(balance) }).eq("id", user.id);
        await supabase.from("balance_transactions").insert({ visitor_id, type: Number(balance) > user.balance ? "topup" : "debit", amount: Math.abs(Number(balance) - user.balance), description: `Saldo diset ke ${balance} via API` });
        result = { visitor_id, old_balance: user.balance, new_balance: Number(balance) };
        break;
      }
      // ── Reset game stats ──
      case "reset_game_stats": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("game_stats").delete().eq("visitor_id", visitor_id);
        await supabase.from("notifications").insert({ visitor_id, title: "Game Stats Direset", message: "Semua statistik game Anda telah direset", type: "warning" });
        result = { visitor_id, reset: true };
        break;
      }
      // ── Set streak ──
      case "set_streak": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, current_streak } = body;
        if (!visitor_id || current_streak === undefined) return new Response(JSON.stringify({ error: "visitor_id and current_streak required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: existing } = await supabase.from("daily_streaks").select("id").eq("visitor_id", visitor_id).maybeSingle();
        if (existing) {
          await supabase.from("daily_streaks").update({ current_streak: Number(current_streak) }).eq("id", existing.id);
        } else {
          await supabase.from("daily_streaks").insert({ visitor_id, current_streak: Number(current_streak) });
        }
        result = { visitor_id, current_streak: Number(current_streak) };
        break;
      }
      // ── Update sponsor stock ──
      case "update_sponsor_stock": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { sponsor_id, stock } = body;
        if (!sponsor_id || stock === undefined) return new Response(JSON.stringify({ error: "sponsor_id and stock required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { error } = await supabase.from("sponsors").update({ stock: Number(stock) }).eq("id", sponsor_id);
        if (error) throw error;
        result = { sponsor_id, stock: Number(stock) };
        break;
      }
      // ── Follows ──
      case "follows": {
        const { data } = await supabase.from("user_follows").select("*").order("created_at", { ascending: false }).limit(100);
        result = data;
        break;
      }
      case "game_follows": {
        const { data } = await supabase.from("game_follows").select("*").order("created_at", { ascending: false }).limit(100);
        result = data;
        break;
      }
      // ── Login (verify credentials) ──
      case "login": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { identifier, password } = body;
        if (!identifier || !password) return new Response(JSON.stringify({ error: "identifier and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        // Normalize phone
        const normalizePhone = (v: string) => {
          let n = v.replace(/[\s\-\(\)]/g, "");
          if (n.startsWith("+62")) n = "0" + n.slice(3);
          else if (n.startsWith("62") && n.length > 5) n = "0" + n.slice(2);
          return n;
        };
        const isPhone = /^[\d\+]/.test(identifier);
        const isEmail = identifier.includes("@");

        let q = supabase.from("user_balances").select("id, visitor_id, username, phone, email, balance, password_hash");
        if (isEmail) {
          q = q.eq("email", identifier.toLowerCase());
        } else if (isPhone) {
          q = q.eq("phone", normalizePhone(identifier));
        } else {
          q = q.eq("username", identifier);
        }
        const { data: user } = await q.maybeSingle();
        if (!user || !user.password_hash) return new Response(JSON.stringify({ error: "Akun tidak ditemukan atau belum punya password" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        // Verify password (SHA-256)
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        if (hashHex !== user.password_hash) return new Response(JSON.stringify({ error: "Password salah" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        result = { id: user.id, visitor_id: user.visitor_id, username: user.username, phone: user.phone, email: user.email, balance: user.balance };
        break;
      }
      case "wa_login_token_create": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        // Token dibuat bebas dari WA mana pun, tanpa !login di WA.
        // Akun saldo baru ditentukan saat token diverifikasi dari web yang sudah login.
        const requester = String(body.wa_jid || body.from_phone || body.sender || "anonymous").trim().slice(0, 120);
        const cooldownKey = `wa_login_pending:${requester || "anonymous"}`;
        const { data: recent } = await supabase
          .from("balance_wa_reset_codes")
          .select("created_at")
          .eq("visitor_id", cooldownKey)
          .eq("purpose", "wa_login")
          .eq("is_used", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recent?.created_at) {
          const ageSec = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
          if (ageSec < 60) {
            const wait = Math.ceil(60 - ageSec);
            return new Response(JSON.stringify({ error: "Token sebelumnya masih aktif. Tunggu " + wait + " detik lagi untuk minta token baru." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
        await supabase.from("balance_wa_reset_codes").update({ is_used: true }).eq("visitor_id", cooldownKey).eq("purpose", "wa_login").eq("is_used", false);
        const code = genWaLoginToken();
        await supabase.from("balance_wa_reset_codes").insert({
          user_balance_id: null,
          visitor_id: cooldownKey,
          purpose: "wa_login",
          code,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          max_attempts: 3,
        });
        result = { success: true, code, expires_minutes: 5 };
        break;
      }
      case "wa_login_token_status": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const code = String(body.code || "").trim().toUpperCase();
        if (!/^[A-Z0-9]{6,32}$/.test(code)) return new Response(JSON.stringify({ error: "Token login tidak valid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: row } = await supabase
          .from("balance_wa_reset_codes")
          .select("*, user_balances:user_balance_id(id, visitor_id, username, phone, email, balance)")
          .eq("purpose", "wa_login")
          .eq("code", code)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Token tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const user: any = (row as any).user_balances;
        if ((row as any).is_used && user?.id) {
          result = { confirmed: true, user: { id: user.id, visitor_id: user.visitor_id, username: user.username, phone: user.phone, email: user.email, balance: user.balance } };
          break;
        }
        if (new Date((row as any).expires_at) < new Date()) {
          await supabase.from("balance_wa_reset_codes").update({ is_used: true }).eq("id", (row as any).id);
          result = { confirmed: false, expired: true };
          break;
        }
        result = { confirmed: false, expired: false };
        break;
      }
      case "wa_login_token_verify": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const code = String(body.code || "").trim().toUpperCase();
        const visitor_id = String(body.visitor_id || "").trim() || null;
        if (!/^[A-Z0-9]{6,32}$/.test(code)) return new Response(JSON.stringify({ error: "Token login tidak valid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: row } = await supabase
          .from("balance_wa_reset_codes")
          .select("*, user_balances:user_balance_id(id, visitor_id, username, phone, email, balance)")
          .eq("purpose", "wa_login")
          .eq("code", code)
          .eq("is_used", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Token tidak ditemukan / sudah dipakai" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (new Date((row as any).expires_at) < new Date()) {
          await supabase.from("balance_wa_reset_codes").update({ is_used: true }).eq("id", (row as any).id);
          return new Response(JSON.stringify({ error: "Token sudah kedaluwarsa. Minta .logintoken lagi di WA." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (((row as any).attempts || 0) >= ((row as any).max_attempts || 3)) {
          await supabase.from("balance_wa_reset_codes").update({ is_used: true }).eq("id", (row as any).id);
          return new Response(JSON.stringify({ error: "Percobaan token habis. Minta token baru." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Token .logintoken boleh dari nomor WA mana pun.
        // Akun tujuan selalu akun saldo yang sedang login di web saat verifikasi.
        const accountVisitorId = String(body.accountVisitorId || body.account_visitor_id || "").trim();
        if (!accountVisitorId) return new Response(JSON.stringify({ error: "Token WA harus dikonfirmasi dari akun saldo yang sudah login di web." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: approvingUser } = await supabase
          .from("user_balances")
          .select("id, visitor_id, username, phone, email, balance")
          .eq("visitor_id", accountVisitorId)
          .maybeSingle();
        if (!approvingUser?.id) return new Response(JSON.stringify({ error: "Akun saldo web tidak ditemukan." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const user: any = approvingUser;
        if (visitor_id) {
          await supabase.from("balance_login_history").insert({
            user_balance_id: user.id,
            visitor_id,
            device_info: "Login Token WhatsApp",
            browser: String(body.browser || "Web").slice(0, 100),
            ip_address: (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "").split(",")[0].trim() || null,
          });
        }
        await supabase.from("balance_wa_reset_codes").update({ user_balance_id: user.id, visitor_id: user.visitor_id, is_used: true }).eq("id", (row as any).id);
        result = { success: true, user: { id: user.id, visitor_id: user.visitor_id, username: user.username, phone: user.phone, email: user.email, balance: user.balance } };
        break;
      }
      // ── Resolve username to visitor_id ──
      case "resolve_user": {
        const uname = url.searchParams.get("username");
        if (!uname) return new Response(JSON.stringify({ error: "username param required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: found } = await supabase.from("user_balances").select("id, visitor_id, username, phone, email, balance").ilike("username", `%${uname}%`).limit(5);
        result = found;
        break;
      }
      // ── User transactions by username ──
      case "user_transactions": {
        const uname = url.searchParams.get("username");
        if (!uname) return new Response(JSON.stringify({ error: "username param required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: u } = await supabase.from("user_balances").select("visitor_id").eq("username", uname).maybeSingle();
        if (!u) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: txns } = await supabase.from("balance_transactions").select("*").eq("visitor_id", u.visitor_id).order("created_at", { ascending: false }).limit(20);
        result = txns;
        break;
      }
      // ── Song download URL ──
      case "song_url": {
        const songQuery = url.searchParams.get("q");
        if (!songQuery) return new Response(JSON.stringify({ error: "q param required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: songs } = await supabase.from("playlist_songs").select("id, title, artist, file_url, cover_url, duration").ilike("title", `%${songQuery}%`).limit(5);
        result = songs;
        break;
      }
      // ── Purchase product (calls purchase-with-balance internally) ──
      case "purchase_product": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, product_name, quantity, pin, discount_code } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        // Find product by name
        let productId = body.product_id;
        if (!productId && product_name) {
          const { data: prods } = await supabase.from("products").select("id, title").ilike("title", `%${product_name}%`).limit(1);
          if (!prods?.length) return new Response(JSON.stringify({ error: `Produk '${product_name}' tidak ditemukan` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          productId = prods[0].id;
        }
        if (!productId) return new Response(JSON.stringify({ error: "product_id or product_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const purchaseRes = await fetch(`${supabaseUrl}/functions/v1/purchase-with-balance`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ visitorId: visitor_id, productId, quantity: quantity || 1, pin: pin || undefined, discountCode: discount_code || undefined }),
        });
        const purchaseData = await purchaseRes.json();
        if (!purchaseRes.ok || purchaseData.error) {
          return new Response(JSON.stringify({ error: purchaseData.error || "Gagal membeli produk", needPin: purchaseData.needPin }), { status: purchaseRes.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        result = purchaseData;
        break;
      }
      // ── Purchase streak plan ──
      case "purchase_streak": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, package_name, pin, voucher_code } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        let packageId = body.package_id;
        if (!packageId && package_name) {
          const { data: pkgs } = await supabase.from("streak_packages").select("id, name").eq("is_active", true).ilike("name", `%${package_name}%`).limit(1);
          if (!pkgs?.length) return new Response(JSON.stringify({ error: `Paket streak '${package_name}' tidak ditemukan` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          packageId = pkgs[0].id;
        }
        if (!packageId) return new Response(JSON.stringify({ error: "package_id or package_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const res2 = await fetch(`${supabaseUrl}/functions/v1/purchase-streak-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "purchase", visitorId: visitor_id, packageId, pin: pin || undefined, voucherCode: voucher_code || undefined }),
        });
        const data2 = await res2.json();
        if (!res2.ok || data2.error) {
          return new Response(JSON.stringify({ error: data2.error || "Gagal membeli paket streak", needPin: data2.needPin }), { status: res2.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        result = data2;
        break;
      }
      // ── Purchase game credits ──
      case "purchase_credits": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, package_name, pin, voucher_code } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        let packageId = body.package_id;
        if (!packageId && package_name) {
          const { data: pkgs } = await supabase.from("credit_packages").select("id, label").eq("is_active", true).ilike("label", `%${package_name}%`).limit(1);
          if (!pkgs?.length) return new Response(JSON.stringify({ error: `Paket kredit '${package_name}' tidak ditemukan` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          packageId = pkgs[0].id;
        }
        if (!packageId) return new Response(JSON.stringify({ error: "package_id or package_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const res3 = await fetch(`${supabaseUrl}/functions/v1/purchase-game-credits`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "purchase", visitorId: visitor_id, packageId, pin: pin || undefined, voucherCode: voucher_code || undefined }),
        });
        const data3 = await res3.json();
        if (!res3.ok || data3.error) {
          return new Response(JSON.stringify({ error: data3.error || "Gagal membeli kredit", needPin: data3.needPin }), { status: res3.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        result = data3;
        break;
      }
      // ── Purchase storage ──
      case "purchase_storage": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, package_name, pin, voucher_code } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        let packageId = body.package_id;
        if (!packageId && package_name) {
          const { data: pkgs } = await supabase.from("storage_packages").select("id, name").eq("is_active", true).ilike("name", `%${package_name}%`).limit(1);
          if (!pkgs?.length) return new Response(JSON.stringify({ error: `Paket storage '${package_name}' tidak ditemukan` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          packageId = pkgs[0].id;
        }
        if (!packageId) return new Response(JSON.stringify({ error: "package_id or package_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const res4 = await fetch(`${supabaseUrl}/functions/v1/upgrade-storage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ visitorId: visitor_id, packageId, pin: pin || undefined, voucherCode: voucher_code || undefined }),
        });
        const data4 = await res4.json();
        if (!res4.ok || data4.error) {
          return new Response(JSON.stringify({ error: data4.error || "Gagal membeli storage", needPin: data4.needPin }), { status: res4.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        result = data4;
        break;
      }
      // ── Purchase bundle ──
      case "purchase_bundle": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, package_name, pin, voucher_code } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        let packageId = body.package_id;
        if (!packageId && package_name) {
          const { data: pkgs } = await supabase.from("bundle_packages").select("id, name").eq("is_active", true).ilike("name", `%${package_name}%`).limit(1);
          if (!pkgs?.length) return new Response(JSON.stringify({ error: `Paket bundle '${package_name}' tidak ditemukan` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          packageId = pkgs[0].id;
        }
        if (!packageId) return new Response(JSON.stringify({ error: "package_id or package_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const res5 = await fetch(`${supabaseUrl}/functions/v1/purchase-bundle`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ visitorId: visitor_id, packageId, pin: pin || undefined, voucherCode: voucher_code || undefined }),
        });
        const data5 = await res5.json();
        if (!res5.ok || data5.error) {
          return new Response(JSON.stringify({ error: data5.error || "Gagal membeli bundle", needPin: data5.needPin }), { status: res5.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        result = data5;
        break;
      }
      // ── Transaction detail by trx_id ──
      case "transaction_detail": {
        const trxId = url.searchParams.get("trx_id");
        if (!trxId) return new Response(JSON.stringify({ error: "trx_id param required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: txn } = await supabase.from("balance_transactions").select("*, products(title, price, category)").eq("trx_id", trxId).maybeSingle();
        if (!txn) {
          // Try searching by partial trx_id
          const { data: txns } = await supabase.from("balance_transactions").select("*, products(title, price, category)").ilike("trx_id", `%${trxId}%`).limit(1);
          result = txns?.[0] || null;
        } else {
          result = txn;
        }
        if (!result) return new Response(JSON.stringify({ error: "Transaksi tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        break;
      }
      // ── Wholesale prices for a product ──
      case "wholesale": {
        const pid = url.searchParams.get("product_id");
        if (!pid) return new Response(JSON.stringify({ error: "product_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data } = await supabase.from("wholesale_prices").select("*").eq("entity_type", "product").eq("entity_id", pid).order("min_quantity");
        result = data;
        break;
      }
      // ── Admin settings (flash sale etc) ──
      case "admin_settings": {
        const { data } = await supabase.from("admin_settings").select("setting_key, setting_value");
        result = data;
        break;
      }
      // ── Admin posts ──
      case "admin_posts": {
        const { data } = await supabase.from("admin_posts").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(20);
        result = data;
        break;
      }
      // ── Claim voucher (calls claim-voucher edge function) ──
      case "claim_voucher": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { codes, visitor_id, device_info, browser: browserInfo } = body;
        if (!visitor_id || !codes?.length) return new Response(JSON.stringify({ error: "visitor_id and codes required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const claimRes = await fetch(`${supabaseUrl}/functions/v1/claim-voucher`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ codes, visitorId: visitor_id, deviceInfo: device_info || "WhatsApp Bot", browser: browserInfo || "Bot" }),
        });
        const claimData = await claimRes.json();
        result = claimData;
        break;
      }
      // ── Create support ticket ──
      case "create_ticket": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { name, phone, category, description } = body;
        if (!name || !phone || !description) return new Response(JSON.stringify({ error: "name, phone, description required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: ticket, error: ticketErr } = await supabase.from("support_tickets").insert({
          name, phone, category: category || "Umum", description,
        }).select().single();
        if (ticketErr) throw ticketErr;
        result = ticket;
        break;
      }
      // ── User tickets by phone ──
      case "user_tickets": {
        const phone = url.searchParams.get("phone");
        const name = url.searchParams.get("name");
        if (!phone && !name) return new Response(JSON.stringify({ error: "phone or name param required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        let q = supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(20);
        if (phone) q = q.eq("phone", phone);
        else if (name) q = q.ilike("name", `%${name}%`);
        const { data } = await q;
        result = data;
        break;
      }
      // ── Ticket messages ──
      case "ticket_messages": {
        const ticketId = url.searchParams.get("ticket_id");
        if (!ticketId) return new Response(JSON.stringify({ error: "ticket_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at");
        result = data;
        break;
      }
      // ── Reply to ticket ──
      case "reply_ticket": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { ticket_id, message: ticketMsg, sender_type } = body;
        if (!ticket_id || !ticketMsg) return new Response(JSON.stringify({ error: "ticket_id and message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: msgData, error: msgErr } = await supabase.from("ticket_messages").insert({
          ticket_id, message: ticketMsg, sender_type: sender_type || "user",
        }).select().single();
        if (msgErr) throw msgErr;
        result = msgData;
        break;
      }
      // ── Like / Unlike product ──
      case "like_product": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, product_id } = body;
        if (!visitor_id || !product_id) return new Response(JSON.stringify({ error: "visitor_id and product_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: existing } = await supabase.from("liked_products").select("id").eq("visitor_id", visitor_id).eq("product_id", product_id).maybeSingle();
        if (existing) {
          await supabase.from("liked_products").delete().eq("id", existing.id);
          result = { action: "unliked", product_id };
        } else {
          await supabase.from("liked_products").insert({ visitor_id, product_id });
          result = { action: "liked", product_id };
        }
        break;
      }
      // ── Like / Unlike song ──
      case "like_song": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, song_id } = body;
        if (!visitor_id || !song_id) return new Response(JSON.stringify({ error: "visitor_id and song_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: existing } = await supabase.from("liked_songs").select("id").eq("visitor_id", visitor_id).eq("song_id", song_id).maybeSingle();
        if (existing) {
          await supabase.from("liked_songs").delete().eq("id", existing.id);
          result = { action: "unliked", song_id };
        } else {
          await supabase.from("liked_songs").insert({ visitor_id, song_id });
          result = { action: "liked", song_id };
        }
        break;
      }
      // ── Like / Unlike sponsor ──
      case "like_sponsor": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, sponsor_id: spId } = body;
        if (!visitor_id || !spId) return new Response(JSON.stringify({ error: "visitor_id and sponsor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: existing } = await supabase.from("liked_sponsors").select("id").eq("visitor_id", visitor_id).eq("sponsor_id", spId).maybeSingle();
        if (existing) {
          await supabase.from("liked_sponsors").delete().eq("id", existing.id);
          result = { action: "unliked", sponsor_id: spId };
        } else {
          await supabase.from("liked_sponsors").insert({ visitor_id, sponsor_id: spId });
          result = { action: "liked", sponsor_id: spId };
        }
        break;
      }
      // ── User likes ──
      case "user_likes": {
        const vid = url.searchParams.get("visitor_id");
        if (!vid) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const [{ data: prods }, { data: songs }, { data: sponsors }] = await Promise.all([
          supabase.from("liked_products").select("product_id, products(title, price)").eq("visitor_id", vid),
          supabase.from("liked_songs").select("song_id, playlist_songs(title, artist)").eq("visitor_id", vid),
          supabase.from("liked_sponsors").select("sponsor_id, sponsors(title, price, seller_name)").eq("visitor_id", vid),
        ]);
        result = { products: prods || [], songs: songs || [], sponsors: sponsors || [] };
        break;
      }
      // ── Claim daily streak ──
      case "claim_streak": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const claimRes2 = await fetch(`${supabaseUrl}/functions/v1/auto-claim-streak`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ visitorId: visitor_id }),
        });
        const claimData2 = await claimRes2.json();
        result = claimData2;
        break;
      }
      // ── Product images ──
      case "product_images": {
        const pid = url.searchParams.get("product_id");
        if (!pid) return new Response(JSON.stringify({ error: "product_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data } = await supabase.from("product_images").select("*").eq("product_id", pid).order("image_order");
        result = data;
        break;
      }
      // ── Sponsor images ──
      case "sponsor_images": {
        const spId = url.searchParams.get("sponsor_id");
        if (!spId) return new Response(JSON.stringify({ error: "sponsor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data } = await supabase.from("sponsor_images").select("*").eq("sponsor_id", spId).order("image_order");
        result = data;
        break;
      }
      // ── Play AI game ──
      case "play_game": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { game_type, difficulty } = body;
        if (!game_type) return new Response(JSON.stringify({ error: "game_type required (teka-teki, tebak-kata, tebak-angka, tebak-gambar, tebak-barang, pilihan-ganda, kuis-yatidak, teka-teki-v2)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const gameConfig: Record<string, { fnName: string; payload: Record<string, unknown>; normalize?: (payload: any) => any }> = {
          "teka-teki": { fnName: "teka-teki", payload: { difficulty: difficulty || "sedang" } },
          "tebak-kata": {
            fnName: "tebak-kata",
            payload: { action: "new_word", difficulty: difficulty || "sedang" },
            normalize: (payload) => ({
              question: "Tebak kata berdasarkan petunjuk berikut.",
              answer: String(payload.word || "").toUpperCase(),
              hints: payload.hints || [],
              letterCount: String(payload.word || "").length,
            }),
          },
          "tebak-angka": {
            fnName: "tebak-angka",
            payload: { difficulty: difficulty || "sedang" },
            normalize: (payload) => ({
              question: `Tebak angka rahasia dalam rentang ${payload.range || "yang ditentukan"}.`,
              answer: String(payload.number ?? ""),
              hints: payload.hints || [],
              range: payload.range || null,
            }),
          },
          "tebak-gambar": {
            fnName: "tebak-gambar",
            payload: { action: "new_image", difficulty: difficulty || "sedang" },
          },
          "tebak-barang": {
            fnName: "tebak-barang",
            payload: { difficulty: difficulty || "sedang" },
            normalize: (payload) => ({
              question: "Tebak nama barang dari petunjuk berikut.",
              answer: String(payload.item || "").toUpperCase(),
              hints: payload.hints || [],
              category: payload.category || "",
            }),
          },
          "pilihan-ganda": {
            fnName: "pilihan-ganda",
            payload: { difficulty: difficulty || "sedang" },
            normalize: (payload) => {
              const correctIndex = Number(payload.correctIndex ?? -1);
              const correctOption = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : "";
              const optionText = Array.isArray(payload.options) && correctIndex >= 0 ? String(payload.options[correctIndex] || "") : "";
              return {
                ...payload,
                answer: optionText,
                acceptedAnswers: [correctOption, optionText].filter(Boolean),
              };
            },
          },
          "kuis-yatidak": { fnName: "kuis-yatidak", payload: { difficulty: difficulty || "sedang" } },
          "teka-teki-v2": { fnName: "teka-teki-v2", payload: { difficulty: difficulty || "sedang" } },
        };
        const selectedGame = gameConfig[game_type];
        if (!selectedGame) {
          return new Response(JSON.stringify({ error: "Jenis game tidak valid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { fnName, payload, normalize } = selectedGame;
        const gameRes = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify(payload),
        });
        const gameData = await gameRes.json();
        if (!gameRes.ok || gameData.error) return new Response(JSON.stringify({ error: gameData.error || "Game error" }), { status: gameRes.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        result = normalize ? normalize(gameData) : gameData;
        break;
      }
      // ── Leaderboard game ──
      case "game_leaderboard": {
        const { data: stats } = await supabase.from("game_stats").select("visitor_id, game_type, wins, losses, points, total_questions").order("points", { ascending: false }).limit(50);
        const { data: users } = await supabase.from("user_balances").select("visitor_id, username");
        const userMap: Record<string, string> = {};
        (users || []).forEach((u: any) => { userMap[u.visitor_id] = u.username; });
        // Also check game_profiles
        const { data: gProfiles } = await supabase.from("game_profiles").select("visitor_id, display_name");
        (gProfiles || []).forEach((p: any) => { if (!userMap[p.visitor_id]) userMap[p.visitor_id] = p.display_name; });
        result = (stats || []).map((s: any) => ({ ...s, username: userMap[s.visitor_id] || s.visitor_id.slice(0, 8) }));
        break;
      }
      // ── Sponsor detail with social media ──
      case "sponsor_detail": {
        const spNo = url.searchParams.get("sponsor_number");
        const spId2 = url.searchParams.get("sponsor_id");
        let q2 = supabase.from("sponsors").select("*");
        if (spNo) q2 = q2.eq("sponsor_number", Number(spNo));
        else if (spId2) q2 = q2.eq("id", spId2);
        else return new Response(JSON.stringify({ error: "sponsor_number or sponsor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: sp } = await q2.maybeSingle();
        if (!sp) return new Response(JSON.stringify({ error: "Sponsor tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        // Get images
        const { data: spImgs } = await supabase.from("sponsor_images").select("image_url, image_order").eq("sponsor_id", sp.id).order("image_order");
        result = { ...sp, images: spImgs || [] };
        break;
      }
      // ── Deduct game credit ──
      case "deduct_credit": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, amount: creditAmt } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const deductAmount = Number(creditAmt) || 1;
        const { data: gc } = await supabase.from("user_game_credits").select("id, credits, unlimited_until").eq("visitor_id", visitor_id).maybeSingle();
        if (!gc) return new Response(JSON.stringify({ error: "No credits found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const isUnlimited = gc.unlimited_until && new Date(gc.unlimited_until) > new Date();
        if (!isUnlimited) {
          if (gc.credits < deductAmount) return new Response(JSON.stringify({ error: "Kredit tidak cukup" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          await supabase.from("user_game_credits").update({ credits: gc.credits - deductAmount }).eq("id", gc.id);
        }
        result = { visitor_id, deducted: deductAmount, remaining: isUnlimited ? gc.credits : gc.credits - deductAmount };
        break;
      }
      // ── Manage PIN via API ──
      case "check_pin": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const pinRes = await fetch(`${supabaseUrl}/functions/v1/manage-pin`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "check", visitorId: visitor_id }),
        });
        result = await pinRes.json();
        break;
      }
      case "create_pin": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, pin } = body;
        if (!visitor_id || !pin) return new Response(JSON.stringify({ error: "visitor_id and pin required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const createPinRes = await fetch(`${supabaseUrl}/functions/v1/manage-pin`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "create", visitorId: visitor_id, pin }),
        });
        result = await createPinRes.json();
        break;
      }
      case "verify_pin": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, pin } = body;
        if (!visitor_id || !pin) return new Response(JSON.stringify({ error: "visitor_id and pin required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const verifyPinRes = await fetch(`${supabaseUrl}/functions/v1/manage-pin`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "verify", visitorId: visitor_id, pin }),
        });
        result = await verifyPinRes.json();
        break;
      }
      case "reset_pin": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, reset_token, new_pin, old_pin } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (old_pin && new_pin) {
          const vrr = await fetch(`${supabaseUrl}/functions/v1/manage-pin`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` }, body: JSON.stringify({ action: "verify", visitorId: visitor_id, pin: old_pin }) });
          const vrd = await vrr.json();
          if (!vrd.valid) return new Response(JSON.stringify({ error: "PIN lama salah" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          const enc = new TextEncoder();
          const hb = await crypto.subtle.digest("SHA-256", enc.encode(new_pin));
          const hh = Array.from(new Uint8Array(hb)).map(b => b.toString(16).padStart(2, "0")).join("");
          await supabase.from("user_pins").update({ pin_hash: hh, updated_at: new Date().toISOString() }).eq("visitor_id", visitor_id);
          result = { success: true, message: "PIN berhasil diubah" };
        } else if (reset_token && new_pin) {
          const rr = await fetch(`${supabaseUrl}/functions/v1/manage-pin`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` }, body: JSON.stringify({ action: "reset", visitorId: visitor_id, resetToken: reset_token, newPin: new_pin }) });
          result = await rr.json();
        } else {
          return new Response(JSON.stringify({ error: "old_pin+new_pin atau reset_token+new_pin diperlukan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        break;
      }
      case "request_wa_reset_code": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const purpose = String(body.purpose || "").trim();
        const visitorId = String(body.visitor_id || body.visitorId || "").trim();
        const loginId = body.login_id || body.loginId || undefined;
        if (!purpose || !visitorId) return new Response(JSON.stringify({ error: "purpose & visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const rr = await fetch(`${supabaseUrl}/functions/v1/balance-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "request_reset_code", purpose, visitorId, loginId }),
        });
        const rd = await rr.json();
        if (!rr.ok || rd.error) return new Response(JSON.stringify({ error: rd.error || "Gagal kirim kode" }), { status: rr.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        result = rd;
        break;
      }
      case "apply_wa_reset_code": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const purpose = String(body.purpose || "").trim();
        const visitorId = String(body.visitor_id || body.visitorId || "").trim();
        const code = String(body.code || "").trim();
        const newValue = String(body.new_value || body.newValue || "").trim();
        const loginId = body.login_id || body.loginId || undefined;
        if (!purpose || !visitorId || !code || !newValue) return new Response(JSON.stringify({ error: "purpose, visitor_id, code & new_value required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const rr = await fetch(`${supabaseUrl}/functions/v1/balance-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ action: "apply_reset_code", purpose, visitorId, code, newValue, loginId }),
        });
        const rd = await rr.json();
        if (!rr.ok || rd.error) return new Response(JSON.stringify({ error: rd.error || "Gagal verifikasi kode" }), { status: rr.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        result = rd;
        break;
      }
      case "reset_password": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, old_password, new_password, reset_token } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const enc2 = new TextEncoder();
        if (old_password && new_password) {
          const { data: u } = await supabase.from("user_balances").select("id, password_hash").eq("visitor_id", visitor_id).maybeSingle();
          if (!u) return new Response(JSON.stringify({ error: "User tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          const oh = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc2.encode(old_password)))).map(b => b.toString(16).padStart(2, "0")).join("");
          if (oh !== u.password_hash) return new Response(JSON.stringify({ error: "Password lama salah" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          const nh = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc2.encode(new_password)))).map(b => b.toString(16).padStart(2, "0")).join("");
          await supabase.from("user_balances").update({ password_hash: nh }).eq("id", u.id);
          result = { success: true, message: "Password berhasil diubah" };
        } else if (reset_token && new_password) {
          const rr = await fetch(`${supabaseUrl}/functions/v1/balance-auth`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` }, body: JSON.stringify({ action: "reset_password", visitorId: visitor_id, resetToken: reset_token, newPassword: new_password }) });
          result = await rr.json();
        } else {
          return new Response(JSON.stringify({ error: "old_password+new_password atau reset_token+new_password diperlukan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        break;
      }
      case "update_profile": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, username, phone, email } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const ups: any = {};
        if (username) ups.username = username;
        if (phone) ups.phone = phone;
        if (email) ups.email = email;
        if (Object.keys(ups).length === 0) return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (username) { const { data: ex } = await supabase.from("user_balances").select("id").eq("username", username).neq("visitor_id", visitor_id).maybeSingle(); if (ex) return new Response(JSON.stringify({ error: "Username sudah digunakan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
        await supabase.from("user_balances").update(ups).eq("visitor_id", visitor_id);
        result = { success: true, updated: ups };
        break;
      }
      case "invalidate_tokens": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, type } = body;
        if (!visitor_id || !type) return new Response(JSON.stringify({ error: "visitor_id and type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const normalizedType = String(type).toLowerCase();
        const tokenTable = normalizedType === "pin" ? "pin_reset_tokens" : normalizedType === "sandi" || normalizedType === "password" ? "password_reset_tokens" : "";
        if (!tokenTable) return new Response(JSON.stringify({ error: "type harus pin atau sandi" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from(tokenTable).update({ is_used: true }).eq("visitor_id", visitor_id).eq("is_used", false);
        result = { success: true, type: normalizedType };
        break;
      }
      case "create_reset_token": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, token, type } = body;
        if (!visitor_id || !token || !type) return new Response(JSON.stringify({ error: "visitor_id, token, type required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const normalizedType = String(type).toLowerCase();
        const tokenTable = normalizedType === "pin" ? "pin_reset_tokens" : normalizedType === "sandi" || normalizedType === "password" ? "password_reset_tokens" : "";
        if (!tokenTable) return new Response(JSON.stringify({ error: "type harus pin atau sandi" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const cleanToken = String(token).replace(/#/g, "").trim();
        if (!/^\d{5}$/.test(cleanToken)) return new Response(JSON.stringify({ error: "token harus 5 digit angka" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data: createdToken, error: createTokenError } = await supabase.from(tokenTable).insert({
          visitor_id,
          token: cleanToken,
          expires_at: expiresAt,
          is_used: false,
        }).select().single();
        if (createTokenError) throw createTokenError;
        result = createdToken;
        break;
      }
      case "register": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { username, phone, email, password, visitor_id } = body;
        if (!username || !password) return new Response(JSON.stringify({ error: "username and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const rr2 = await fetch(`${supabaseUrl}/functions/v1/balance-auth`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` }, body: JSON.stringify({ action: "register", username, phone: phone || "", email: email || "", password, visitorId: visitor_id || crypto.randomUUID() }) });
        const rd2 = await rr2.json();
        if (!rr2.ok || rd2.error) return new Response(JSON.stringify({ error: rd2.error || "Gagal mendaftar" }), { status: rr2.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        result = rd2;
        break;
      }
      case "confirm_deposit": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { trx_id, action: depAct } = body;
        if (!trx_id) return new Response(JSON.stringify({ error: "trx_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        let dep2: any = null;
        const { data: d1 } = await supabase.from("deposits").select("*").eq("trx_id", trx_id).maybeSingle();
        if (d1) { dep2 = d1; } else {
          const { data: d2 } = await supabase.from("deposits").select("*").ilike("trx_id", `%${trx_id}%`).limit(1);
          if (d2?.length) dep2 = d2[0];
        }
        if (!dep2) return new Response(JSON.stringify({ error: "Deposit tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const ns = depAct === "tolak" || depAct === "reject" ? "rejected" : "approved";
        await supabase.from("deposits").update({ status: ns }).eq("id", dep2.id);
        if (ns === "approved") {
          const { data: bl } = await supabase.from("user_balances").select("id, balance").eq("visitor_id", dep2.visitor_id).maybeSingle();
          // QRIS = 15%, e-wallet = 12%
          const isEwallet = String(dep2.payment_method || "").toUpperCase() !== "QRIS";
          const bonusPct = isEwallet ? 12 : 15;
          const bonus = dep2.amount >= 10000 ? Math.floor(dep2.amount * (bonusPct / 100)) : 0;
          if (bl) {
            await supabase.from("user_balances").update({ balance: bl.balance + dep2.amount }).eq("id", bl.id);
            await supabase.from("balance_transactions").insert({ visitor_id: dep2.visitor_id, type: "topup", amount: dep2.amount, description: `Deposit ${dep2.payment_method} dikonfirmasi` });
            if (bonus > 0) {
              await supabase.rpc("add_topup_bonus_to_saldo_in", { p_visitor_id: dep2.visitor_id, p_amount: bonus });
              await supabase.from("balance_transactions").insert({ visitor_id: dep2.visitor_id, type: "topup_bonus", amount: bonus, description: `🎁 Bonus ${bonusPct}% deposit → Saldo IN (TRX: ${dep2.trx_id})` });
            }
          }
          await supabase.from("notifications").insert({ visitor_id: dep2.visitor_id, title: "Deposit Dikonfirmasi", message: bonus > 0 ? `Deposit ${dep2.trx_id} Rp ${dep2.amount.toLocaleString()} masuk + Saldo IN +Rp ${bonus.toLocaleString()} (bonus ${bonusPct}%, khusus pembelian internal)` : `Deposit ${dep2.trx_id} sebesar Rp ${dep2.amount.toLocaleString()} telah dikonfirmasi`, type: "success" });
        } else {
          await supabase.from("notifications").insert({ visitor_id: dep2.visitor_id, title: "Deposit Ditolak", message: `Deposit ${dep2.trx_id} ditolak`, type: "warning" });
        }
        result = { deposit: dep2, new_status: ns };
        break;
      }
      case "create_deposit": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, amount, payment_method, username } = body;
        if (!visitor_id || !amount || !payment_method) return new Response(JSON.stringify({ error: "visitor_id, amount, payment_method required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const dti = "DEP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
        const { data: nd, error: de } = await supabase.from("deposits").insert({ visitor_id, amount: Number(amount), payment_method, username: username || "", trx_id: dti }).select().single();
        if (de) throw de;
        result = nd;
        break;
      }
      case "cancel_deposit": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { visitor_id, trx_id } = body;
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        let depQuery = supabase.from("deposits").select("*").eq("visitor_id", visitor_id).eq("status", "pending").order("created_at", { ascending: false });
        if (trx_id) depQuery = depQuery.ilike("trx_id", `%${trx_id}%`);
        const { data: pendingDeposits } = await depQuery.limit(1);
        const deposit = pendingDeposits?.[0];

        if (!deposit) {
          return new Response(JSON.stringify({ error: trx_id ? "Deposit pending tidak ditemukan" : "Tidak ada deposit pending" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { error: cancelError } = await supabase.from("deposits").update({ status: "cancelled" }).eq("id", deposit.id).eq("status", "pending");
        if (cancelError) throw cancelError;

        await supabase.from("notifications").insert({
          visitor_id,
          title: "Deposit Dibatalkan",
          message: `Deposit ${deposit.trx_id} berhasil dibatalkan.`,
          type: "deposit_cancelled",
        });

        result = { deposit: { ...deposit, status: "cancelled" }, new_status: "cancelled" };
        break;
      }
      case "confess_prices": {
        const { data: st } = await supabase.from("admin_settings").select("setting_key, setting_value")
          .in("setting_key", ["confess_price_1", "confess_price_2", "confess_price_3"]);
        const m = new Map<string, string>((st || []).map((r: any) => [r.setting_key, r.setting_value]));
        result = {
          price1: parseInt(m.get("confess_price_1") || "2000", 10) || 2000,
          price2: parseInt(m.get("confess_price_2") || "4000", 10) || 4000,
          price3: parseInt(m.get("confess_price_3") || "5000", 10) || 5000,
        };
        break;
      }
      case "confess_send": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const visitorId = String(body.visitor_id || body.visitorId || "").trim();
        const senderName = String(body.sender_name || body.senderName || "").trim().slice(0, 40);
        const message = String(body.message || "").trim().slice(0, 800);
        const rawPhones = body.phones || body.phone;
        const phones: string[] = Array.isArray(rawPhones) ? rawPhones : String(rawPhones || "").split(/[\s,]+/).filter(Boolean);
        const pin = String(body.pin || "");
        if (!visitorId) { result = { error: "Visitor tidak dikenal" }; break; }
        if (!phones.length) { result = { error: "Nomor tujuan wajib diisi" }; break; }
        if (message.length < 3) { result = { error: "Pesan terlalu pendek (min 3 karakter)" }; break; }
        const fwd = await fetch(`${supabaseUrl}/functions/v1/send-confession`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
          body: JSON.stringify({ visitorId, senderName, message, phones, pin, moodTag: body.mood_tag || null }),
        });
        result = await fwd.json();
        break;
      }
      case "confess_outbox": {
        // GET: list pending confession targets, joined with confession
        const { data: pendingData } = await supabase
          .from("confession_targets")
          .select("id, phone, status, confession_id, confessions:confession_id(id, trx_id, sender_name, message, sender_visitor_id, media_url, media_type, media_name, media_mime, media_size)")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(20);
        let targets = pendingData || [];
        if (targets.length < 20) {
          const retrySince = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
          const { data: retryData } = await supabase
            .from("confession_targets")
            .select("id, phone, status, confession_id, confessions:confession_id(id, trx_id, sender_name, message, sender_visitor_id, media_url, media_type, media_name, media_mime, media_size)")
            .eq("status", "failed")
            .ilike("error", "%Connection Closed%")
            .gte("created_at", retrySince)
            .order("sent_at", { ascending: true, nullsFirst: true })
            .limit(20 - targets.length);
          targets = [...targets, ...(retryData || [])];
        }
        for (const t of targets) {
          const conf = (t as any).confessions || {};
          if (conf.media_url) {
            (t as any).media_url = conf.media_url;
            (t as any).media_type = conf.media_type;
            (t as any).media_name = conf.media_name;
            (t as any).media_mime = conf.media_mime;
            (t as any).media_size = conf.media_size;
          }
        }
        // Attach media (photo/video/audio/file) from the matching thread message
        const targetIds = targets.map((t: any) => t.id);
        if (targetIds.length > 0) {
          const { data: msgs } = await supabase
            .from("confess_thread_messages")
            .select("target_id, media_url, media_type, media_name, media_mime, media_size")
            .in("target_id", targetIds)
            .eq("direction", "out");
          const mediaByTarget = new Map<string, any>();
          for (const m of (msgs || [])) {
            if (m.target_id && m.media_url && !mediaByTarget.has(m.target_id)) mediaByTarget.set(m.target_id, m);
          }
          for (const t of targets) {
            const md = mediaByTarget.get(t.id);
            if (md) {
              (t as any).media_url = md.media_url;
              (t as any).media_type = md.media_type;
              (t as any).media_name = md.media_name;
              (t as any).media_mime = md.media_mime;
              (t as any).media_size = md.media_size;
            }
          }
        }
        result = targets;
        break;
      }

      case "confess_mark_sent": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { target_id, success, error: errMsg, wa_message_id } = body;
        if (!target_id) return new Response(JSON.stringify({ error: "target_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase
          .from("confession_targets")
          .update({ status: success ? "sent" : "failed", sent_at: new Date().toISOString(), error: errMsg || null })
          .eq("id", target_id);
        const messagePatch: any = { status: success ? "sent" : "failed", sent_at: success ? new Date().toISOString() : null, error: success ? null : (errMsg || "Gagal dikirim") };
        if (wa_message_id) messagePatch.wa_message_id = String(wa_message_id);
        await supabase
          .from("confess_thread_messages")
          .update(messagePatch)
          .eq("target_id", target_id)
          .eq("direction", "out");
        // update parent status
        const { data: tgt } = await supabase.from("confession_targets").select("confession_id, phone").eq("id", target_id).maybeSingle();
        if (success) await saveWaPeerMappings(supabase, peerJidsFromBody(body), body.target_phone || tgt?.phone, "confess_mark_sent");
        if (tgt?.confession_id) {
          const { data: siblings } = await supabase.from("confession_targets").select("status").eq("confession_id", tgt.confession_id);
          const allDone = (siblings || []).every((s: any) => s.status !== "pending");
          if (allDone) {
            const anyOk = (siblings || []).some((s: any) => s.status === "sent");
            await supabase.from("confessions").update({ status: anyOk ? "sent" : "failed" }).eq("id", tgt.confession_id);
            // notify sender
            const { data: conf } = await supabase.from("confessions").select("sender_visitor_id, trx_id").eq("id", tgt.confession_id).maybeSingle();
            if (conf?.sender_visitor_id) {
              await supabase.from("notifications").insert({
                visitor_id: conf.sender_visitor_id,
                title: anyOk ? "✉️ Confess Terkirim" : "❌ Confess Gagal",
                message: `Confess ${conf.trx_id} ${anyOk ? "berhasil dikirim ke tujuan." : "gagal dikirim."}`,
                type: anyOk ? "success" : "error",
              });
            }
          }
        }
        result = { ok: true };
        break;
      }
      case "confess_thread_active": {
        const phone = url.searchParams.get("phone") || "";
        const normDigits = String(phone).replace(/\D/g, "");
        if (!normDigits) { result = { active: false }; break; }
        const { data: thread } = await supabase
          .from("confess_threads")
          .select("id")
          .eq("target_phone", normDigits)
          .gt("free_until", new Date().toISOString())
          .limit(1)
          .maybeSingle();
        result = { active: !!thread };
        break;
      }
      case "confess_avatar_pending": {
        // Daftar nomor target pada thread aktif yang foto profilnya belum diambil
        // atau sudah lebih dari 24 jam (untuk refresh).
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("confess_threads")
          .select("target_phone, target_avatar_updated_at")
          .gt("free_until", new Date().toISOString())
          .order("last_message_at", { ascending: false })
          .limit(50);
        const seen = new Set<string>();
        const list: string[] = [];
        for (const t of (data || [])) {
          const p = (t as any).target_phone;
          if (!p || seen.has(p)) continue;
          const ts = (t as any).target_avatar_updated_at;
          if (!ts || new Date(ts).toISOString() < cutoff) {
            seen.add(p);
            list.push(p);
          }
        }
        result = { phones: list };
        break;
      }
      case "confess_avatar_save": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const phone = String(body.phone || "").replace(/\D/g, "");
        const avatar = body.avatar_url ? String(body.avatar_url).slice(0, 1000) : null;
        if (!phone) return new Response(JSON.stringify({ error: "phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase
          .from("confess_threads")
          .update({ target_avatar_url: avatar, target_avatar_updated_at: new Date().toISOString() })
          .eq("target_phone", phone);
        result = { ok: true };
        break;
      }
      case "confess_stop": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        let fromPhone = String(body.from_phone || "").replace(/\D/g, "");
        if (!fromPhone) fromPhone = await resolveMappedPhone(supabase, body);
        const quotedWaId = body.quoted_wa_message_id ? String(body.quoted_wa_message_id) : null;
        const nowIso = new Date().toISOString();
        let threads: any[] | null = null;
        if (fromPhone) {
          const variants = phoneVariants(fromPhone);
          const { data } = await supabase
            .from("confess_threads")
            .select("id, visitor_id")
            .in("target_phone", variants.length ? variants : [fromPhone]);
          threads = data;
        }
        // Fallback: nomor tidak terbaca (LID) → pakai pesan yang di-quote.
        if ((!threads || threads.length === 0) && quotedWaId) {
          const { data: qmsg } = await supabase
            .from("confess_thread_messages")
            .select("thread_id")
            .eq("wa_message_id", quotedWaId)
            .limit(1)
            .maybeSingle();
          if (qmsg?.thread_id) {
            const { data } = await supabase
              .from("confess_threads")
              .select("id, visitor_id, target_phone")
              .eq("id", qmsg.thread_id);
            threads = data;
            if (data?.[0]?.target_phone) fromPhone = String(data[0].target_phone).replace(/\D/g, "");
          }
        }
        if (!fromPhone && (!threads || threads.length === 0)) { result = { stopped: 0 }; break; }
        const list = threads || [];
        if (list.length === 0) { result = { stopped: 0 }; break; }
        await supabase
          .from("confess_threads")
          .update({ chat_stopped: true, free_until: nowIso, last_message_preview: "🛑 Penerima menghentikan chat Confess", last_message_at: nowIso })
          .in("id", list.map((t: any) => t.id));
        for (const t of list) {
          await supabase.from("confess_thread_messages").insert({
            thread_id: t.id,
            direction: "in",
            text: "🛑 Penerima menghentikan chat Confess (.stopconfess). Window gratis 24 jam ditutup.",
            status: "delivered",
            is_free: true,
          });
          if (t.visitor_id) {
            await supabase.from("notifications").insert({
              visitor_id: t.visitor_id,
              title: "🛑 Confess Dihentikan",
              message: `Nomor +${fromPhone} menghentikan chat Confess. Window 24 jam ditutup.`,
              type: "warning",
            });
          }
        }
        result = { stopped: list.length };
        break;
      }
      case "confess_media_upload": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { base64, mime, ext, from_phone } = body;
        if (!base64 || !mime) return new Response(JSON.stringify({ error: "base64 & mime required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        try {
          const bin = Uint8Array.from(atob(String(base64).replace(/^data:.*;base64,/, "")), (c) => c.charCodeAt(0));
          const safeExt = String(ext || mime.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
          const safePhone = String(from_phone || "anon").replace(/\D/g, "").slice(0, 20) || "anon";
          const path = `incoming/${safePhone}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
          const { error: upErr } = await supabase.storage.from("confess-media").upload(path, bin, { contentType: mime, upsert: false });
          if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          const { data: pub } = supabase.storage.from("confess-media").getPublicUrl(path);
          result = { url: pub.publicUrl };
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "upload error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        break;
      }
      case "confess_reply": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { from_phone, reply_text, media_url, media_type, media_name, media_mime, media_size, wa_message_id, quoted_wa_message_id, wa_profile_pic_url, wa_display_name } = body;
        const hasMedia = !!media_url;
        if (!reply_text && !hasMedia) return new Response(JSON.stringify({ error: "reply_text (or media) required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        let normDigits = String(from_phone || "").replace(/\D/g, "");
        if (!normDigits) normDigits = await resolveMappedPhone(supabase, body);
        let phoneLookup = phoneVariants(normDigits);
        // Balasan masuk selalu diarahkan ke thread terakhir milik nomor ini
        // (tidak dibatasi jendela gratis, agar pesan seperti "halo" tetap masuk web).
        let thread: any = null;
        if (normDigits) {
          const { data: t } = await supabase
            .from("confess_threads")
            .select("id, visitor_id, target_phone, unread_count, free_until, sender_name, chat_stopped")
            .in("target_phone", phoneLookup.length ? phoneLookup : [normDigits])
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          thread = t;
        }
        // Fallback: nomor tidak terbaca (LID). Cocokkan lewat pesan yang di-quote.
        if (!thread && quoted_wa_message_id) {
          const { data: qmsg } = await supabase
            .from("confess_thread_messages")
            .select("thread_id")
            .eq("wa_message_id", String(quoted_wa_message_id))
            .limit(1)
            .maybeSingle();
          if (qmsg?.thread_id) {
            const { data: t } = await supabase
              .from("confess_threads")
              .select("id, visitor_id, target_phone, unread_count, free_until, sender_name, chat_stopped")
              .eq("id", qmsg.thread_id)
              .maybeSingle();
            if (t) {
              thread = t;
              normDigits = String(t.target_phone || "").replace(/\D/g, "");
              phoneLookup = phoneVariants(normDigits);
            }
          }
        }
        if (!thread) {
          result = { matched: false };
          break;
        }
        if (thread.chat_stopped) {
          // Penerima sudah menghentikan chat → balasan tidak diteruskan
          result = { matched: false, stopped: true };
          break;
        }
        const { data: tgt } = await supabase
          .from("confession_targets")
          .select("id, confession_id, confessions:confession_id(sender_visitor_id, trx_id, sender_name)")
          .in("phone", phoneLookup.length ? phoneLookup : [normDigits])
          .eq("status", "sent")
          .gte("sent_at", thread.free_until ? new Date(new Date(thread.free_until).getTime() - 24 * 60 * 60 * 1000).toISOString() : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (tgt?.confession_id) {
          await supabase.from("confession_replies").insert({
            confession_id: tgt.confession_id,
            target_id: tgt.id || null,
            from_phone: normDigits,
            reply_text: String(reply_text || (media_type === "image" ? "[Foto]" : media_type === "video" ? "[Video]" : media_type === "audio" ? "[Audio]" : "[File]")).slice(0, 1000),
          });
        }
        const conf: any = tgt?.confessions || { sender_visitor_id: thread.visitor_id, sender_name: thread.sender_name };

        // Tulis juga ke confess_threads (chat thread baru)
        if (thread?.visitor_id) {
          const textClean = String(reply_text || "").slice(0, 1000);
          await supabase.from("confess_thread_messages").insert({
            thread_id: thread.id,
            direction: "in",
            text: textClean,
            status: "delivered",
            is_free: true,
            media_url: media_url || null,
            media_type: media_type || null,
            media_name: media_name || null,
            media_mime: media_mime || null,
            media_size: media_size || null,
            wa_profile_pic_url: wa_profile_pic_url || null,
            wa_display_name: wa_display_name || null,
            wa_message_id: wa_message_id || null,
          });
          const previewBase = textClean || (media_type === "image" ? "📷 Foto" : media_type === "video" ? "🎥 Video" : media_type === "audio" ? "🎵 Audio" : "📎 File");
          const threadUpd: any = {
            last_message_at: new Date().toISOString(),
            last_message_preview: previewBase.slice(0, 80),
            unread_count: (thread.unread_count || 0) + 1,
          };
          if (wa_profile_pic_url) threadUpd.wa_profile_pic_url = wa_profile_pic_url;
          if (wa_display_name) threadUpd.wa_display_name = wa_display_name;
          await supabase.from("confess_threads").update(threadUpd).eq("id", thread.id);


          await supabase.from("notifications").insert({
            visitor_id: thread.visitor_id,
            title: "💬 Balasan Confess",
            message: `Nomor +${normDigits} membalas: "${(textClean || previewBase).slice(0, 100)}"`,
            type: "info",
          });
        }
        result = { matched: true, sender_name: conf?.sender_name || null, trx_id: conf?.trx_id };
        break;
      }
      case "confessions_by_visitor": {
        const visitor_id = url.searchParams.get("visitor_id");
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data } = await supabase
          .from("confessions")
          .select("id, trx_id, sender_name, message, num_targets, total_price, status, created_at, confession_targets(id, phone, status, sent_at), confession_replies(id, from_phone, reply_text, created_at)")
          .eq("sender_visitor_id", visitor_id)
          .order("created_at", { ascending: false })
          .limit(50);
        result = data || [];
        break;
      }
      case "confess_trial_status": {
        const visitor_id = url.searchParams.get("visitor_id");
        const fp = url.searchParams.get("fp") || "";
        const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "").split(",")[0].trim();
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: hist } = await supabase.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitor_id).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        const ubId = hist?.user_balance_id;
        const orFilters: string[] = [`visitor_id.eq.${visitor_id}`];
        if (ubId) orFilters.push(`user_balance_id.eq.${ubId}`);
        if (fp) orFilters.push(`device_fingerprint.eq.${fp}`);
        if (ip) orFilters.push(`ip_address.eq.${ip}`);
        const { data: row } = await supabase.from("confess_free_trial").select("id, user_balance_id, visitor_id").or(orFilters.join(",")).limit(1).maybeSingle();
        if (!row) {
          result = { eligible: true, reason: "available" };
        } else if (ubId && row.user_balance_id === ubId) {
          result = { eligible: false, reason: "used" };
        } else {
          result = { eligible: false, reason: "device_used" };
        }
        break;
      }

      case "confess_threads": {
        const visitor_id = url.searchParams.get("visitor_id");
        if (!visitor_id) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: hist } = await supabase
          .from("balance_login_history")
          .select("user_balance_id")
          .eq("visitor_id", visitor_id)
          .order("logged_in_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const balanceId = hist?.user_balance_id;
        let q = supabase
          .from("confess_threads")
          .select("id, target_phone, target_avatar_url, sender_name, last_paid_at, free_until, last_message_at, last_message_preview, unread_count, created_at, wa_profile_pic_url, wa_display_name, wa_last_seen_at, wa_presence")
          .order("last_message_at", { ascending: false })
          .limit(100);
        q = balanceId ? q.eq("user_balance_id", balanceId) : q.eq("visitor_id", visitor_id);
        const { data } = await q;
        result = data || [];
        break;
      }
      case "confess_thread_messages": {
        const thread_id = url.searchParams.get("thread_id");
        const visitor_id = url.searchParams.get("visitor_id");
        if (!thread_id || !visitor_id) return new Response(JSON.stringify({ error: "thread_id & visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: th } = await supabase.from("confess_threads").select("visitor_id, user_balance_id").eq("id", thread_id).maybeSingle();
        const { data: hist } = await supabase.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitor_id).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        if (!th || (th.visitor_id !== visitor_id && th.user_balance_id !== hist?.user_balance_id)) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data } = await supabase
          .from("confess_thread_messages")
          .select("id, direction, text, status, is_free, sent_at, created_at, error, media_url, media_type, media_name, media_mime, media_size, wa_message_id, deleted_at, deleted_by, reaction, reaction_by, wa_reaction, edited_at")
          .eq("thread_id", thread_id)
          .order("created_at", { ascending: true })
          .limit(300);
        result = data || [];
        break;
      }
      case "confess_thread_mark_read": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { thread_id, visitor_id } = body;
        if (!thread_id || !visitor_id) return new Response(JSON.stringify({ error: "thread_id & visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("confess_threads").update({ unread_count: 0 }).eq("id", thread_id).eq("visitor_id", visitor_id);
        result = { ok: true };
        break;
      }
      case "confess_chat_outbox": {
        const { data: pendingData } = await supabase
          .from("confess_thread_messages")
          .select("id, text, thread_id, media_url, media_type, media_name, media_mime, media_size, confess_threads:thread_id(target_phone, sender_name, visitor_id)")
          .eq("status", "pending")
          .eq("direction", "out")
          .eq("is_free", true)
          .order("created_at", { ascending: true })
          .limit(20);
        let rows = pendingData || [];
        if (rows.length < 20) {
          const retrySince = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
          const { data: retryData } = await supabase
            .from("confess_thread_messages")
            .select("id, text, thread_id, media_url, media_type, media_name, media_mime, media_size, confess_threads:thread_id(target_phone, sender_name, visitor_id)")
            .eq("status", "failed")
            .eq("direction", "out")
            .eq("is_free", true)
            .ilike("error", "%Connection Closed%")
            .gte("created_at", retrySince)
            .order("sent_at", { ascending: true, nullsFirst: true })
            .limit(20 - rows.length);
          rows = [...rows, ...(retryData || [])];
        }
        result = rows;
        break;
      }
      case "confess_chat_mark_sent": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { message_id, success, error: errMsg, wa_message_id } = body;
        if (!message_id) return new Response(JSON.stringify({ error: "message_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const patch: any = { status: success ? "sent" : "failed", sent_at: new Date().toISOString(), error: errMsg || null };
        if (wa_message_id) patch.wa_message_id = String(wa_message_id);
        await supabase.from("confess_thread_messages").update(patch).eq("id", message_id);
        if (success) {
          const peerJids = peerJidsFromBody(body);
          if (peerJids.length) {
            let phone = String(body.target_phone || "").replace(/\D/g, "");
            if (!phone) {
              const { data: row } = await supabase
                .from("confess_thread_messages")
                .select("confess_threads:thread_id(target_phone)")
                .eq("id", message_id)
                .maybeSingle();
              phone = String((row as any)?.confess_threads?.target_phone || "").replace(/\D/g, "");
            }
            await saveWaPeerMappings(supabase, peerJids, phone, "confess_chat_mark_sent");
          }
        }
        result = { ok: true };
        break;
      }
      case "confess_presence_save": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const phone = String(body.phone || "").replace(/\D/g, "");
        if (!phone) return new Response(JSON.stringify({ error: "phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const patch: any = { updated_at: new Date().toISOString() };
        if (body.display_name !== undefined) patch.wa_display_name = body.display_name ? String(body.display_name).slice(0, 120) : null;
        if (body.last_seen_at !== undefined) patch.wa_last_seen_at = body.last_seen_at;
        if (body.presence !== undefined) patch.wa_presence = body.presence ? String(body.presence).slice(0, 24) : null;
        if (body.profile_pic_url !== undefined) patch.wa_profile_pic_url = body.profile_pic_url ? String(body.profile_pic_url).slice(0, 500) : null;
        await supabase.from("confess_threads").update(patch).eq("target_phone", phone);
        await saveWaPeerMappings(supabase, peerJidsFromBody(body), phone, "confess_presence_save");
        result = { ok: true };
        break;
      }
      case "confess_revoke_message": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const waId = body.wa_message_id ? String(body.wa_message_id) : null;
        const msgId = body.message_id ? String(body.message_id) : null;
        const by = body.deleted_by === "web" ? "web" : "wa";
        if (!waId && !msgId) return new Response(JSON.stringify({ error: "wa_message_id or message_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const patch: any = {
          deleted_at: new Date().toISOString(),
          deleted_by: by,
          text: "🚫 Pesan ini dihapus",
        };
        if (by === "wa") patch.wa_revoked_at = new Date().toISOString();
        const q = supabase.from("confess_thread_messages").update(patch);
        const res = waId ? await q.eq("wa_message_id", waId).select("id, thread_id") : await q.eq("id", msgId).select("id, thread_id");
        const rows = (res as any).data || [];
        if (rows.length > 0 && rows[0].thread_id) {
          await supabase.from("confess_threads").update({ last_message_preview: "🚫 Pesan dihapus", last_message_at: new Date().toISOString() }).eq("id", rows[0].thread_id);
        }
        result = { ok: true, affected: rows.length };
        break;
      }
      case "confess_pending_revokes": {
        const { data } = await supabase
          .from("confess_thread_messages")
          .select("id, wa_message_id, thread_id, confess_threads:thread_id(target_phone)")
          .eq("deleted_by", "web")
          .is("wa_revoked_at", null)
          .not("wa_message_id", "is", null)
          .order("deleted_at", { ascending: true })
          .limit(20);
        result = data || [];
        break;
      }
      case "confess_mark_revoked": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const ids: string[] = Array.isArray(body.ids) ? body.ids.map((x: any) => String(x)) : [];
        if (!ids.length) return new Response(JSON.stringify({ error: "ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("confess_thread_messages").update({ wa_revoked_at: new Date().toISOString() }).in("id", ids);
        result = { ok: true, count: ids.length };
        break;
      }

      // ===== REAKSI PESAN (seperti WhatsApp) =====
      case "confess_set_reaction": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const message_id = body.message_id ? String(body.message_id) : null;
        const visitor_id = body.visitor_id ? String(body.visitor_id) : null;
        const emoji = body.emoji ? String(body.emoji).slice(0, 8) : null; // null = hapus reaksi
        if (!message_id || !visitor_id) return new Response(JSON.stringify({ error: "message_id & visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        // verifikasi kepemilikan thread
        const { data: m } = await supabase.from("confess_thread_messages").select("id, thread_id, confess_threads:thread_id(visitor_id, user_balance_id)").eq("id", message_id).maybeSingle();
        const th = (m as any)?.confess_threads;
        const { data: hist } = await supabase.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitor_id).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        if (!m || !th || (th.visitor_id !== visitor_id && th.user_balance_id !== hist?.user_balance_id)) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("confess_thread_messages").update({
          reaction: emoji,
          reaction_by: "web",
          reaction_updated_at: new Date().toISOString(),
          reaction_wa_sent_at: null, // antri dikirim ke WA
        }).eq("id", message_id);
        result = { ok: true };
        break;
      }
      case "confess_edit_message": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const message_id = body.message_id ? String(body.message_id) : null;
        const visitor_id = body.visitor_id ? String(body.visitor_id) : null;
        const text = body.text != null ? String(body.text).slice(0, 10000) : "";
        if (!message_id || !visitor_id || !text.trim()) return new Response(JSON.stringify({ error: "message_id, visitor_id & text required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: m } = await supabase.from("confess_thread_messages").select("id, direction, deleted_at, thread_id, confess_threads:thread_id(visitor_id, user_balance_id)").eq("id", message_id).maybeSingle();
        const th = (m as any)?.confess_threads;
        const { data: hist } = await supabase.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitor_id).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        if (!m || !th || (th.visitor_id !== visitor_id && th.user_balance_id !== hist?.user_balance_id)) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if ((m as any).direction !== "out") return new Response(JSON.stringify({ error: "Hanya pesan kamu yang bisa diedit" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if ((m as any).deleted_at) return new Response(JSON.stringify({ error: "Pesan sudah dihapus" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("confess_thread_messages").update({
          text: text.trim(),
          edited_at: new Date().toISOString(),
          wa_edit_sent_at: null, // antri dikirim ke WA
        }).eq("id", message_id);
        await supabase.from("confess_threads").update({ last_message_preview: text.trim().slice(0, 80), last_message_at: new Date().toISOString() }).eq("id", (m as any).thread_id);
        result = { ok: true };
        break;
      }
      case "confess_pending_reactions": {
        const { data } = await supabase
          .from("confess_thread_messages")
          .select("id, reaction, wa_message_id, thread_id, confess_threads:thread_id(target_phone)")
          .eq("reaction_by", "web")
          .is("reaction_wa_sent_at", null)
          .not("wa_message_id", "is", null)
          .order("reaction_updated_at", { ascending: true })
          .limit(20);
        result = data || [];
        break;
      }
      case "confess_mark_reaction_sent": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const ids: string[] = Array.isArray(body.ids) ? body.ids.map((x: any) => String(x)) : (body.id ? [String(body.id)] : []);
        if (!ids.length) return new Response(JSON.stringify({ error: "ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("confess_thread_messages").update({ reaction_wa_sent_at: new Date().toISOString() }).in("id", ids);
        result = { ok: true, count: ids.length };
        break;
      }
      case "confess_pending_edits": {
        const { data } = await supabase
          .from("confess_thread_messages")
          .select("id, text, wa_message_id, thread_id, confess_threads:thread_id(target_phone)")
          .not("edited_at", "is", null)
          .is("wa_edit_sent_at", null)
          .not("wa_message_id", "is", null)
          .eq("direction", "out")
          .order("edited_at", { ascending: true })
          .limit(20);
        result = data || [];
        break;
      }
      case "confess_mark_edit_sent": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const ids: string[] = Array.isArray(body.ids) ? body.ids.map((x: any) => String(x)) : (body.id ? [String(body.id)] : []);
        if (!ids.length) return new Response(JSON.stringify({ error: "ids required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        await supabase.from("confess_thread_messages").update({ wa_edit_sent_at: new Date().toISOString() }).in("id", ids);
        result = { ok: true, count: ids.length };
        break;
      }
      case "confess_save_wa_reaction": {
        // bot WA mengirim reaksi yang diterima dari penerima
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const waId = body.wa_message_id ? String(body.wa_message_id) : null;
        const emoji = body.emoji ? String(body.emoji).slice(0, 8) : null;
        if (!waId) return new Response(JSON.stringify({ error: "wa_message_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: rows } = await supabase.from("confess_thread_messages").update({ wa_reaction: emoji }).eq("wa_message_id", waId).select("thread_id");
        if (rows && rows.length && (rows[0] as any).thread_id) {
          await supabase.from("confess_threads").update({ last_message_at: new Date().toISOString() }).eq("id", (rows[0] as any).thread_id);
        }
        result = { ok: true };
        break;
      }

      case "confess_wall_list": {
        const sort = url.searchParams.get("sort") || "new";
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "30"), 100);
        const visitor = url.searchParams.get("visitor_id") || "";
        let q = supabase.from("confess_public_wall").select("id, sender_name, masked_phone, message, mood_tag, reaction_counts, total_reactions, created_at, visitor_id").eq("is_hidden", false);
        if (sort === "hot") q = q.order("total_reactions", { ascending: false }).order("created_at", { ascending: false });
        else q = q.order("created_at", { ascending: false });
        const { data } = await q.limit(limit);
        if (visitor && data && data.length > 0) {
          const ids = data.map((d: any) => d.id);
          const { data: myReacts } = await supabase.from("confess_wall_reactions").select("wall_id, emoji").eq("visitor_id", visitor).in("wall_id", ids);
          const reactMap = new Map((myReacts || []).map((r: any) => [r.wall_id, r.emoji]));
          (data as any[]).forEach((d) => { d.my_reaction = reactMap.get(d.id) || null; d.is_mine = d.visitor_id === visitor; delete d.visitor_id; });
        } else if (data) {
          (data as any[]).forEach((d) => { d.my_reaction = null; d.is_mine = false; delete d.visitor_id; });
        }
        result = data || [];
        break;
      }

      case "confess_wall_leaderboard": {
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { data } = await supabase
          .from("confess_public_wall")
          .select("id, sender_name, masked_phone, message, mood_tag, reaction_counts, total_reactions, created_at")
          .eq("is_hidden", false)
          .gte("created_at", weekAgo)
          .order("total_reactions", { ascending: false })
          .limit(10);
        result = data || [];
        break;
      }

      case "confess_wall_react": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { wall_id, visitor_id, emoji } = body;
        const validEmojis = ["heart", "fire", "laugh", "cry"];
        if (!wall_id || !visitor_id || !validEmojis.includes(emoji)) {
          return new Response(JSON.stringify({ error: "wall_id, visitor_id, emoji required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: wall } = await supabase.from("confess_public_wall").select("id, reaction_counts, total_reactions, visitor_id").eq("id", wall_id).maybeSingle();
        if (!wall) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: existing } = await supabase.from("confess_wall_reactions").select("id, emoji").eq("wall_id", wall_id).eq("visitor_id", visitor_id).maybeSingle();
        const counts: any = wall.reaction_counts || { heart: 0, fire: 0, laugh: 0, cry: 0 };
        let total = wall.total_reactions || 0;
        let action: "added" | "removed" | "changed" = "added";

        if (existing) {
          if (existing.emoji === emoji) {
            await supabase.from("confess_wall_reactions").delete().eq("id", existing.id);
            counts[emoji] = Math.max(0, (counts[emoji] || 0) - 1);
            total = Math.max(0, total - 1);
            action = "removed";
          } else {
            await supabase.from("confess_wall_reactions").update({ emoji }).eq("id", existing.id);
            counts[existing.emoji] = Math.max(0, (counts[existing.emoji] || 0) - 1);
            counts[emoji] = (counts[emoji] || 0) + 1;
            action = "changed";
          }
        } else {
          await supabase.from("confess_wall_reactions").insert({ wall_id, visitor_id, emoji });
          counts[emoji] = (counts[emoji] || 0) + 1;
          total += 1;
          if (wall.visitor_id && wall.visitor_id !== visitor_id) {
            await supabase.from("notifications").insert({
              visitor_id: wall.visitor_id,
              title: "💖 Confess kamu dapat reaksi!",
              message: `Seseorang memberi reaksi ${emoji === "heart" ? "❤️" : emoji === "fire" ? "🔥" : emoji === "laugh" ? "😂" : "😢"} di Wall.`,
              type: "info", related_id: wall_id,
            });
          }
        }
        await supabase.from("confess_public_wall").update({ reaction_counts: counts, total_reactions: total }).eq("id", wall_id);
        result = { ok: true, action, reaction_counts: counts, total_reactions: total };
        break;
      }

      // ========================= SCHEDULED =========================
      case "confess_scheduled_list": {
        const visitor = url.searchParams.get("visitor_id");
        if (!visitor) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data } = await supabase
          .from("confess_scheduled")
          .select("id, sender_name, target_phones, message, mood_tag, share_to_wall, scheduled_at, status, price_charged, trx_id, created_at, executed_at, error_message")
          .eq("visitor_id", visitor)
          .order("scheduled_at", { ascending: false })
          .limit(50);
        result = data || [];
        break;
      }

      case "confess_scheduled_cancel": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { id, visitor_id } = body;
        if (!id || !visitor_id) return new Response(JSON.stringify({ error: "id, visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: row } = await supabase.from("confess_scheduled").select("*").eq("id", id).eq("visitor_id", visitor_id).maybeSingle();
        if (!row) return new Response(JSON.stringify({ error: "Tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (row.status !== "pending") return new Response(JSON.stringify({ error: "Hanya pesan pending yang bisa dibatalkan" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: ub } = await supabase.from("user_balances").select("balance").eq("id", row.user_balance_id).maybeSingle();
        if (ub) await supabase.from("user_balances").update({ balance: (ub.balance || 0) + row.price_charged }).eq("id", row.user_balance_id);
        await supabase.from("confess_scheduled").update({ status: "cancelled", executed_at: new Date().toISOString() }).eq("id", id);
        await supabase.from("balance_transactions").insert({
          visitor_id, type: "refund", amount: row.price_charged,
          description: `Refund Confess Terjadwal (dibatalkan)`, trx_id: row.trx_id || null,
        });
        // Notif WA ke admin
        try {
          const { data: settRows } = await supabase.from("admin_settings").select("setting_key, setting_value")
            .in("setting_key", ["confess_admin_wa","confess_notify_cancel"]);
          const sm = new Map<string, string>((settRows || []).map((r: any) => [r.setting_key, r.setting_value]));
          const adminWa = (sm.get("confess_admin_wa") || "").replace(/\D/g, "");
          if ((sm.get("confess_notify_cancel") || "on") === "on" && adminWa.length >= 9) {
            const notifText = `❌ *Confess Dibatalkan*\nTRX: ${row.trx_id || "-"}\nPengguna: ${visitor_id.slice(0,8)}\nRefund: Rp${(row.price_charged || 0).toLocaleString("id-ID")}\nJadwal asal: ${row.scheduled_at ? new Date(row.scheduled_at).toLocaleString("id-ID") : "-"}`;
            const visitorKey = "system_admin_notif";
            const { data: existing } = await supabase.from("confess_threads")
              .select("id").eq("visitor_id", visitorKey).eq("target_phone", adminWa).maybeSingle();
            let threadId = existing?.id;
            if (!threadId) {
              const { data: ins } = await supabase.from("confess_threads").insert({
                visitor_id: visitorKey, target_phone: adminWa, sender_name: "Sistem Confess",
                last_message_preview: notifText.slice(0, 80),
              }).select("id").single();
              threadId = ins?.id;
            }
            if (threadId) {
              await supabase.from("confess_thread_messages").insert({
                thread_id: threadId, direction: "out", text: notifText, status: "pending", is_free: true,
              });
              await supabase.from("confess_threads").update({
                last_message_at: new Date().toISOString(), last_message_preview: notifText.slice(0, 80),
              }).eq("id", threadId);
            }
          }
        } catch (_) { /* ignore */ }
        result = { ok: true, refunded: row.price_charged };
        break;
      }

      // ========================= REVEAL IDENTITAS =========================
      case "confess_reveal_request": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { thread_id, requester_visitor_id, pin } = body;
        if (!thread_id || !requester_visitor_id) return new Response(JSON.stringify({ error: "thread_id, requester_visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const REVEAL_PRICE = 5000;

        const { data: thread } = await supabase.from("confess_threads").select("id, visitor_id, user_balance_id, target_phone, sender_name").eq("id", thread_id).maybeSingle();
        if (!thread) return new Response(JSON.stringify({ error: "Thread tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (thread.visitor_id === requester_visitor_id) return new Response(JSON.stringify({ error: "Tidak bisa reveal diri sendiri" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: pending } = await supabase.from("confess_reveal_requests").select("id").eq("thread_id", thread_id).eq("requester_visitor_id", requester_visitor_id).eq("status", "pending").maybeSingle();
        if (pending) return new Response(JSON.stringify({ error: "Sudah ada permintaan pending untuk thread ini" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: hist } = await supabase.from("balance_login_history").select("user_balance_id").eq("visitor_id", requester_visitor_id).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        if (!hist?.user_balance_id) return new Response(JSON.stringify({ error: "Akun saldo tidak ditemukan", needLogin: true }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: bal } = await supabase.from("user_balances").select("id, balance").eq("id", hist.user_balance_id).maybeSingle();
        if (!bal || bal.balance < REVEAL_PRICE) return new Response(JSON.stringify({ error: `Saldo kurang. Butuh Rp${REVEAL_PRICE.toLocaleString("id-ID")}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        if (!pin || !/^\d{6}$/.test(String(pin))) return new Response(JSON.stringify({ error: "PIN 6 digit wajib", needPin: true }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const { data: pinRow } = await supabase.from("user_pins").select("pin_hash").eq("visitor_id", requester_visitor_id).maybeSingle();
        if (!pinRow) return new Response(JSON.stringify({ error: "PIN belum dibuat", needPin: true }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const sha = async (s: string) => { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""); };
        if ((await sha(String(pin))) !== pinRow.pin_hash) return new Response(JSON.stringify({ error: "PIN salah", needPin: true }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        await supabase.from("user_balances").update({ balance: bal.balance - REVEAL_PRICE }).eq("id", bal.id);

        const { data: rev } = await supabase.from("confess_reveal_requests").insert({
          thread_id, requester_phone: thread.target_phone,
          requester_visitor_id, requester_user_balance_id: hist.user_balance_id,
          sender_visitor_id: thread.visitor_id, sender_user_balance_id: thread.user_balance_id,
          amount: REVEAL_PRICE,
        }).select("id").single();

        await supabase.from("notifications").insert({
          visitor_id: thread.visitor_id,
          title: "🔓 Permintaan Reveal Identitas",
          message: `Target +${thread.target_phone} ingin tahu identitasmu. Setuju = dapat Rp${REVEAL_PRICE.toLocaleString("id-ID")}, tolak = saldo target dikembalikan.`,
          type: "info", related_id: rev?.id || null,
        });

        result = { ok: true, request_id: rev?.id };
        break;
      }

      case "confess_reveal_respond": {
        if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const body = await req.json();
        const { request_id, sender_visitor_id, approve, reveal_name } = body;
        if (!request_id || !sender_visitor_id || typeof approve !== "boolean") return new Response(JSON.stringify({ error: "request_id, sender_visitor_id, approve required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: rev } = await supabase.from("confess_reveal_requests").select("*").eq("id", request_id).maybeSingle();
        if (!rev) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (rev.sender_visitor_id !== sender_visitor_id) return new Response(JSON.stringify({ error: "Bukan pemilik" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (rev.status !== "pending") return new Response(JSON.stringify({ error: "Sudah direspons" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        if (approve) {
          if (rev.sender_user_balance_id) {
            const { data: sb } = await supabase.from("user_balances").select("balance").eq("id", rev.sender_user_balance_id).maybeSingle();
            if (sb) await supabase.from("user_balances").update({ balance: (sb.balance || 0) + rev.amount }).eq("id", rev.sender_user_balance_id);
            await supabase.from("balance_transactions").insert({
              visitor_id: sender_visitor_id, type: "reward", amount: rev.amount,
              description: `Hadiah reveal identitas dari +${rev.requester_phone}`,
            });
          }
          let nm = String(reveal_name || "").trim().slice(0, 60);
          if (!nm && rev.sender_user_balance_id) {
            const { data: ub } = await supabase.from("user_balances").select("username").eq("id", rev.sender_user_balance_id).maybeSingle();
            nm = ub?.username || "";
          }
          if (!nm) nm = "Pengirim Anonim";

          await supabase.from("confess_reveal_requests").update({
            status: "approved", revealed_name: nm, revealed_visitor_id: sender_visitor_id,
            responded_at: new Date().toISOString(),
          }).eq("id", request_id);

          if (rev.requester_visitor_id) {
            await supabase.from("notifications").insert({
              visitor_id: rev.requester_visitor_id,
              title: "✅ Identitas Pengirim Terungkap!",
              message: `Pengirim confess kamu adalah: ${nm}`,
              type: "success", related_id: request_id,
            });
          }
        } else {
          if (rev.requester_user_balance_id) {
            const { data: rb } = await supabase.from("user_balances").select("balance").eq("id", rev.requester_user_balance_id).maybeSingle();
            if (rb) await supabase.from("user_balances").update({ balance: (rb.balance || 0) + rev.amount }).eq("id", rev.requester_user_balance_id);
            if (rev.requester_visitor_id) {
              await supabase.from("balance_transactions").insert({
                visitor_id: rev.requester_visitor_id, type: "refund", amount: rev.amount,
                description: `Refund: pengirim menolak reveal identitas`,
              });
            }
          }
          await supabase.from("confess_reveal_requests").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", request_id);
          if (rev.requester_visitor_id) {
            await supabase.from("notifications").insert({
              visitor_id: rev.requester_visitor_id,
              title: "❌ Permintaan Reveal Ditolak",
              message: `Pengirim menolak. Saldo Rp${rev.amount.toLocaleString("id-ID")} dikembalikan.`,
              type: "warning", related_id: request_id,
            });
          }
        }
        result = { ok: true };
        break;
      }

      case "confess_reveal_status": {
        const visitor = url.searchParams.get("visitor_id");
        const threadId = url.searchParams.get("thread_id");
        if (!visitor) return new Response(JSON.stringify({ error: "visitor_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        let sQ = supabase.from("confess_reveal_requests").select("id, thread_id, requester_phone, amount, status, revealed_name, created_at, responded_at").eq("sender_visitor_id", visitor);
        let rQ = supabase.from("confess_reveal_requests").select("id, thread_id, requester_phone, amount, status, revealed_name, created_at, responded_at").eq("requester_visitor_id", visitor);
        if (threadId) { sQ = sQ.eq("thread_id", threadId); rQ = rQ.eq("thread_id", threadId); }
        const [asSender, asRequester] = await Promise.all([sQ.order("created_at", { ascending: false }).limit(30), rQ.order("created_at", { ascending: false }).limit(30)]);
        result = { as_sender: asSender.data || [], as_requester: asRequester.data || [] };
        break;
      }



      default:
        return new Response(JSON.stringify({
          error: "Unknown endpoint",
          available_get: [
            "products", "sponsors", "balances", "songs", "deposits",
            "notifications", "tokens", "transactions", "streaks",
            "game_credits", "game_stats", "game_profiles", "tickets",
            "playlists", "artists", "public_songs", "storage",
            "vouchers", "packages", "likes", "chats", "streak_subs",
            "music_profiles", "login_history", "dashboard",
            "follows", "game_follows", "resolve_user", "user_transactions", "song_url",
            "transaction_detail", "wholesale", "admin_settings", "admin_posts",
            "user_likes", "user_tickets", "ticket_messages", "product_images", "sponsor_images",
            "game_leaderboard", "sponsor_detail",
            "check_pin",
          ],
          available_post: [
            "notifications", "add_balance", "deduct_balance", "reset_balance", "set_balance",
            "reset_credits", "set_credits", "reset_streak", "set_streak", "reset_storage",
            "reset_game_stats", "update_stock", "update_sponsor_stock",
            "broadcast", "delete_notifications",
            "set_deposit_status", "set_ticket_status", "login",
            "purchase_product", "purchase_streak", "purchase_credits",
            "purchase_storage", "purchase_bundle",
            "claim_voucher", "create_ticket", "reply_ticket",
            "like_product", "like_song", "like_sponsor", "claim_streak",
            "play_game",
            "deduct_credit", "check_pin", "create_pin", "verify_pin", "reset_pin",
            "reset_password", "update_profile", "register",
            "invalidate_tokens", "create_reset_token",
            "confirm_deposit", "create_deposit", "cancel_deposit",
          ],
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (result && typeof result === "object" && !Array.isArray(result)) {
      return new Response(JSON.stringify({ success: true, ...result, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

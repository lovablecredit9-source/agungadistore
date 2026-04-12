import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const apiKey = req.headers.get("x-api-key");
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

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") || "";

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
        result = { visitor_id, new_balance: newBalance };
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
          body: JSON.stringify({ visitorId: visitor_id, packageId, pin: pin || undefined, voucherCode: voucher_code || undefined }),
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
            "transaction_detail", "wholesale", "admin_settings",
          ],
          available_post: [
            "notifications", "add_balance", "deduct_balance", "reset_balance", "set_balance",
            "reset_credits", "set_credits", "reset_streak", "set_streak", "reset_storage",
            "reset_game_stats", "update_stock", "update_sponsor_stock",
            "broadcast", "delete_notifications",
            "set_deposit_status", "set_ticket_status", "login",
            "purchase_product", "purchase_streak", "purchase_credits",
            "purchase_storage", "purchase_bundle",
          ],
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

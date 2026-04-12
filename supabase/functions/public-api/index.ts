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
          ],
          available_post: [
            "notifications", "add_balance", "deduct_balance", "reset_balance",
            "reset_credits", "set_credits", "reset_streak", "reset_storage",
            "update_stock", "broadcast", "delete_notifications",
            "set_deposit_status", "set_ticket_status",
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

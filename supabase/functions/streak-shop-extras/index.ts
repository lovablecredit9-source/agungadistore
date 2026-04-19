import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function todayWIB() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}
function monthWIB() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}`;
}
function genCode(prefix = "REF") {
  return `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function pickWeighted(pool: any[]) {
  const total = pool.reduce((s, p) => s + (p.weight || 1), 0);
  let r = Math.random() * total;
  for (const p of pool) {
    r -= (p.weight || 1);
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

async function getStreak(admin: any, visitorId: string) {
  let { data } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (!data) {
    const { data: ins } = await admin.from("daily_streaks").insert({ visitor_id: visitorId }).select().single();
    data = ins;
  }
  return data;
}
async function getProfile(admin: any, visitorId: string) {
  let { data } = await admin.from("game_profiles").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (!data) {
    const { data: ins } = await admin.from("game_profiles").insert({ visitor_id: visitorId, display_name: "Anonim" }).select().single();
    data = ins;
  }
  return data;
}
async function getBalance(admin: any, visitorId: string) {
  const { data: hist } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
  if (!hist) return null;
  const { data: bal } = await admin.from("user_balances").select("*").eq("id", hist.user_balance_id).maybeSingle();
  return bal;
}

async function deductCost(admin: any, visitorId: string, method: string, amount: number, desc: string) {
  if (amount <= 0) return null;
  if (method === "coin") {
    const s = await getStreak(admin, visitorId);
    if ((s?.streak_coins || 0) < amount) return `Coins kurang. Butuh ${amount}, punya ${s?.streak_coins || 0}`;
    await admin.from("daily_streaks").update({ streak_coins: s.streak_coins - amount }).eq("visitor_id", visitorId);
    return null;
  }
  if (method === "gem") {
    // Cek saldo gem dari akun (bukan visitor langsung)
    const { data: totalGems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
    const have = Number(totalGems) || 0;
    if (have < amount) return `Gems kurang. Butuh ${amount} 💎, punya ${have} 💎`;
    const { error: rpcErr } = await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -amount });
    if (rpcErr) return `Gems kurang atau gagal memotong`;
    await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: -amount, type: "shop", description: desc });
    return null;
  }
  if (method === "balance") {
    const bal = await getBalance(admin, visitorId);
    if (!bal) return "Belum login akun saldo";
    if ((bal.balance || 0) < amount) return `Saldo kurang. Butuh Rp${amount}`;
    await admin.from("user_balances").update({ balance: bal.balance - amount }).eq("id", bal.id);
    await admin.from("balance_transactions").insert({ visitor_id: visitorId, amount: -amount, type: "purchase", description: desc });
    return null;
  }
  if (method === "free") return null;
  return "Metode pembayaran tidak valid";
}

async function refundCost(admin: any, visitorId: string, method: string, amount: number) {
  if (amount <= 0) return;
  if (method === "coin") {
    const s = await getStreak(admin, visitorId);
    await admin.from("daily_streaks").update({ streak_coins: (s?.streak_coins || 0) + amount }).eq("visitor_id", visitorId);
  } else if (method === "gem") {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: amount });
    await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount, type: "refund", description: "Auction refund" });
  } else if (method === "balance") {
    const bal = await getBalance(admin, visitorId);
    if (bal) await admin.from("user_balances").update({ balance: (bal.balance || 0) + amount }).eq("id", bal.id);
  }
}

async function applyReward(admin: any, visitorId: string, type: string, value: number, label: string) {
  if (type === "streak_coins") {
    const s = await getStreak(admin, visitorId);
    await admin.from("daily_streaks").update({ streak_coins: (s?.streak_coins || 0) + value }).eq("visitor_id", visitorId);
  } else if (type === "gems") {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: value });
    await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: value, type: "reward", description: label });
  } else if (type === "freeze") {
    const s = await getStreak(admin, visitorId);
    await admin.from("daily_streaks").update({ freeze_count: (s?.freeze_count || 0) + value }).eq("visitor_id", visitorId);
  } else if (type === "balance") {
    const bal = await getBalance(admin, visitorId);
    if (bal) {
      await admin.from("user_balances").update({ balance: (bal.balance || 0) + value }).eq("id", bal.id);
      await admin.from("balance_transactions").insert({ visitor_id: visitorId, amount: value, type: "reward", description: label });
    }
  }
}

async function recomputeLoyaltyTier(admin: any, visitorId: string, addCoins: number) {
  let { data: prog } = await admin.from("streak_loyalty_progress").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (!prog) {
    const { data: ins } = await admin.from("streak_loyalty_progress").insert({ visitor_id: visitorId, lifetime_spent_coins: addCoins }).select().single();
    prog = ins;
  } else if (addCoins > 0) {
    const { data: upd } = await admin.from("streak_loyalty_progress").update({ lifetime_spent_coins: prog.lifetime_spent_coins + addCoins }).eq("visitor_id", visitorId).select().single();
    prog = upd;
  }
  const { data: tiers } = await admin.from("streak_loyalty_tiers").select("*").order("tier_order", { ascending: false });
  const matched = (tiers || []).find((t: any) => prog.lifetime_spent_coins >= t.required_lifetime_spent);
  if (matched && matched.tier_key !== prog.current_tier_key) {
    await admin.from("streak_loyalty_progress").update({ current_tier_key: matched.tier_key }).eq("visitor_id", visitorId);
    return { ...prog, current_tier_key: matched.tier_key };
  }
  return prog;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { action, visitorId } = body;

    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ====== LIST ======
    if (action === "list") {
      const today = todayWIB();
      const [boxesRes, openingsRes, auctionsRes, tiersRes, progRes, refRes, refUsesRes, profileRes, streakRes, gemsRes] = await Promise.all([
        admin.from("streak_mystery_boxes").select("*").eq("is_active", true).order("sort_order"),
        admin.from("streak_mystery_openings").select("box_id").eq("visitor_id", visitorId).eq("opened_date", today),
        admin.from("streak_auctions").select("*").eq("is_active", true).gte("ends_at", new Date().toISOString()).order("ends_at"),
        admin.from("streak_loyalty_tiers").select("*").order("tier_order"),
        admin.from("streak_loyalty_progress").select("*").eq("visitor_id", visitorId).maybeSingle(),
        admin.from("streak_referral_codes").select("*").eq("visitor_id", visitorId).maybeSingle(),
        admin.from("streak_referral_codes").select("display_name,total_referred,total_coins_earned,total_gems_earned").order("total_referred", { ascending: false }).limit(10),
        admin.from("game_profiles").select("display_name").eq("visitor_id", visitorId).maybeSingle(),
        admin.from("daily_streaks").select("streak_coins,freeze_count").eq("visitor_id", visitorId).maybeSingle(),
        admin.rpc("get_account_gems", { p_visitor_id: visitorId }),
      ]);
      const accountGems = Number(gemsRes?.data) || 0;

      // count openings per box
      const usage: Record<string, number> = {};
      (openingsRes.data || []).forEach((o: any) => { usage[o.box_id] = (usage[o.box_id] || 0) + 1; });

      // attach top bid info
      const auctionIds = (auctionsRes.data || []).map((a: any) => a.id);
      let myBids: Record<string, number> = {};
      if (auctionIds.length) {
        const { data: mb } = await admin.from("streak_auction_bids").select("auction_id,bid_amount").eq("visitor_id", visitorId).in("auction_id", auctionIds);
        (mb || []).forEach((b: any) => { myBids[b.auction_id] = Math.max(myBids[b.auction_id] || 0, b.bid_amount); });
      }

      // ensure progress exists
      let progress = progRes.data;
      if (!progress) progress = await recomputeLoyaltyTier(admin, visitorId, 0);

      // ensure referral code exists
      let myRef = refRes.data;
      if (!myRef) {
        let code = genCode();
        for (let i = 0; i < 5; i++) {
          const { data: exists } = await admin.from("streak_referral_codes").select("id").eq("referral_code", code).maybeSingle();
          if (!exists) break;
          code = genCode();
        }
        const { data: ins } = await admin.from("streak_referral_codes").insert({
          visitor_id: visitorId,
          referral_code: code,
          display_name: profileRes.data?.display_name || "Anonim",
        }).select().single();
        myRef = ins;
      }

      return new Response(JSON.stringify({
        mystery_boxes: boxesRes.data || [],
        mystery_usage_today: usage,
        auctions: (auctionsRes.data || []).map((a: any) => ({ ...a, my_top_bid: myBids[a.id] || 0 })),
        loyalty_tiers: tiersRes.data || [],
        loyalty_progress: progress,
        my_referral: myRef,
        referral_leaderboard: refUsesRes.data || [],
        user_gems: accountGems,
        user_coins: streakRes.data?.streak_coins || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== OPEN MYSTERY BOX ======
    if (action === "open_box") {
      const { boxId, paymentMethod } = body;
      const { data: box } = await admin.from("streak_mystery_boxes").select("*").eq("id", boxId).eq("is_active", true).maybeSingle();
      if (!box) return new Response(JSON.stringify({ error: "Box tidak ditemukan" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const today = todayWIB();
      const { count } = await admin.from("streak_mystery_openings").select("*", { count: "exact", head: true })
        .eq("visitor_id", visitorId).eq("box_id", boxId).eq("opened_date", today);
      if ((count || 0) >= box.daily_limit) {
        return new Response(JSON.stringify({ error: `Limit harian tercapai (${box.daily_limit}/hari)` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cost = paymentMethod === "coin" ? box.cost_coins : paymentMethod === "gem" ? box.cost_gems : paymentMethod === "balance" ? box.cost_balance : 0;
      if (paymentMethod === "free" && (box.cost_coins > 0 || box.cost_gems > 0 || box.cost_balance > 0)) {
        return new Response(JSON.stringify({ error: "Box ini tidak gratis" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const err = await deductCost(admin, visitorId, paymentMethod, cost, `Mystery Box: ${box.name}`);
      if (err) return new Response(JSON.stringify({ error: err }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const pool = Array.isArray(box.reward_pool) ? box.reward_pool : [];
      if (!pool.length) return new Response(JSON.stringify({ error: "Reward pool kosong" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const winning = pickWeighted(pool);

      await applyReward(admin, visitorId, winning.type, winning.value, winning.label);
      await admin.from("streak_mystery_openings").insert({
        visitor_id: visitorId,
        box_id: boxId,
        opened_date: today,
        payment_method: paymentMethod,
        cost_paid: cost,
        reward_type: winning.type,
        reward_value: winning.value,
        reward_label: winning.label,
        rarity: winning.rarity || "common",
      });

      if (paymentMethod === "coin" && cost > 0) await recomputeLoyaltyTier(admin, visitorId, cost);

      return new Response(JSON.stringify({ success: true, reward: winning, message: `🎉 Kamu dapat ${winning.label}!` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== PLACE BID ======
    if (action === "place_bid") {
      const { auctionId, bidAmount } = body;
      const { data: auction } = await admin.from("streak_auctions").select("*").eq("id", auctionId).maybeSingle();
      if (!auction) return new Response(JSON.stringify({ error: "Lelang tidak ditemukan" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (new Date(auction.ends_at).getTime() < Date.now()) return new Response(JSON.stringify({ error: "Lelang sudah berakhir" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (auction.current_winner_visitor_id === visitorId) return new Response(JSON.stringify({ error: "Kamu sudah menjadi bidder tertinggi" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const minBid = Math.max(auction.starting_bid, auction.current_bid + auction.min_increment);
      if (bidAmount < minBid) return new Response(JSON.stringify({ error: `Bid minimal ${minBid}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const err = await deductCost(admin, visitorId, auction.bid_currency, bidAmount, `Bid: ${auction.name}`);
      if (err) return new Response(JSON.stringify({ error: err }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Refund previous winner
      if (auction.current_winner_visitor_id && auction.current_bid > 0) {
        await refundCost(admin, auction.current_winner_visitor_id, auction.bid_currency, auction.current_bid);
        await admin.from("streak_auction_bids").update({ refunded: true }).eq("auction_id", auctionId).eq("visitor_id", auction.current_winner_visitor_id).eq("refunded", false);
      }

      const profile = await getProfile(admin, visitorId);
      await admin.from("streak_auction_bids").insert({
        auction_id: auctionId,
        visitor_id: visitorId,
        display_name: profile?.display_name || "Anonim",
        bid_amount: bidAmount,
        currency: auction.bid_currency,
      });
      await admin.from("streak_auctions").update({
        current_bid: bidAmount,
        current_winner_visitor_id: visitorId,
        current_winner_name: profile?.display_name || "Anonim",
        total_bids: auction.total_bids + 1,
      }).eq("id", auctionId);

      return new Response(JSON.stringify({ success: true, message: `🔨 Bid ${bidAmount} berhasil!` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== CLAIM AUCTION (called by winner after end) ======
    if (action === "claim_auction") {
      const { auctionId } = body;
      const { data: auction } = await admin.from("streak_auctions").select("*").eq("id", auctionId).maybeSingle();
      if (!auction) return new Response(JSON.stringify({ error: "Lelang tidak ditemukan" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (new Date(auction.ends_at).getTime() > Date.now()) return new Response(JSON.stringify({ error: "Lelang masih berjalan" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (auction.current_winner_visitor_id !== visitorId) return new Response(JSON.stringify({ error: "Kamu bukan pemenang" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (auction.status === "claimed") return new Response(JSON.stringify({ error: "Sudah diklaim" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await applyReward(admin, visitorId, auction.reward_type, auction.reward_value, auction.reward_label);
      await admin.from("streak_auctions").update({ status: "claimed", is_active: false }).eq("id", auctionId);
      await admin.from("streak_auction_bids").update({ is_winner: true }).eq("auction_id", auctionId).eq("visitor_id", visitorId).eq("refunded", false);

      return new Response(JSON.stringify({ success: true, message: `🏆 Hadiah ${auction.reward_label} berhasil diklaim!` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== CLAIM MONTHLY LOYALTY ======
    if (action === "claim_loyalty") {
      const prog = await recomputeLoyaltyTier(admin, visitorId, 0);
      const month = monthWIB();
      if (prog.last_monthly_claim_month === month) {
        return new Response(JSON.stringify({ error: "Sudah klaim bulan ini" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: tier } = await admin.from("streak_loyalty_tiers").select("*").eq("tier_key", prog.current_tier_key).maybeSingle();
      if (!tier) return new Response(JSON.stringify({ error: "Tier tidak valid" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (tier.monthly_coins_reward) await applyReward(admin, visitorId, "streak_coins", tier.monthly_coins_reward, `Loyalty ${tier.tier_name}`);
      if (tier.monthly_gems_reward) await applyReward(admin, visitorId, "gems", tier.monthly_gems_reward, `Loyalty ${tier.tier_name}`);
      if (tier.monthly_freeze_reward) await applyReward(admin, visitorId, "freeze", tier.monthly_freeze_reward, `Loyalty ${tier.tier_name}`);

      await admin.from("streak_loyalty_progress").update({
        last_monthly_claim_month: month,
        total_monthly_claims: prog.total_monthly_claims + 1,
      }).eq("visitor_id", visitorId);

      return new Response(JSON.stringify({
        success: true,
        message: `🎁 Reward ${tier.tier_name}: ${tier.monthly_coins_reward} coins, ${tier.monthly_gems_reward} gems, ${tier.monthly_freeze_reward} freeze`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ====== USE REFERRAL CODE ======
    if (action === "use_referral") {
      const { code } = body;
      const cleanCode = String(code || "").trim().toUpperCase();
      if (!cleanCode) return new Response(JSON.stringify({ error: "Kode kosong" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: existing } = await admin.from("streak_referral_uses").select("id").eq("referred_visitor_id", visitorId).maybeSingle();
      if (existing) return new Response(JSON.stringify({ error: "Kamu sudah pakai kode referral" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: ref } = await admin.from("streak_referral_codes").select("*").eq("referral_code", cleanCode).maybeSingle();
      if (!ref) return new Response(JSON.stringify({ error: "Kode tidak ditemukan" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (ref.visitor_id === visitorId) return new Response(JSON.stringify({ error: "Tidak bisa pakai kode sendiri" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const REFERRER_COINS = 500;
      const REFERRER_GEMS = 10;
      const REFERRED_COINS = 200;
      const REFERRED_GEMS = 5;

      await applyReward(admin, ref.visitor_id, "streak_coins", REFERRER_COINS, "Referral Bonus");
      await applyReward(admin, ref.visitor_id, "gems", REFERRER_GEMS, "Referral Bonus");
      await applyReward(admin, visitorId, "streak_coins", REFERRED_COINS, "Welcome Bonus");
      await applyReward(admin, visitorId, "gems", REFERRED_GEMS, "Welcome Bonus");

      await admin.from("streak_referral_uses").insert({
        referrer_visitor_id: ref.visitor_id,
        referred_visitor_id: visitorId,
        referral_code: cleanCode,
        reward_coins_to_referrer: REFERRER_COINS,
        reward_gems_to_referrer: REFERRER_GEMS,
        reward_coins_to_referred: REFERRED_COINS,
        reward_gems_to_referred: REFERRED_GEMS,
      });

      await admin.from("streak_referral_codes").update({
        total_referred: ref.total_referred + 1,
        total_coins_earned: ref.total_coins_earned + REFERRER_COINS,
        total_gems_earned: ref.total_gems_earned + REFERRER_GEMS,
      }).eq("id", ref.id);

      return new Response(JSON.stringify({
        success: true,
        message: `🎉 Bonus diterima: ${REFERRED_COINS} coins + ${REFERRED_GEMS} gems!`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Action tidak valid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("streak-shop-extras error", e);
    return new Response(JSON.stringify({ error: e.message || "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

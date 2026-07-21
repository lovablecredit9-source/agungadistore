import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, code } = await req.json();
    if (!visitorId || !code) {
      return Response.json({ error: "visitorId & code wajib diisi" }, { status: 200, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cleanCode = String(code).trim().toUpperCase();

    // Ambil voucher
    const { data: voucher } = await admin
      .from("streak_vouchers")
      .select("*")
      .eq("code", cleanCode)
      .maybeSingle();

    if (!voucher) {
      return Response.json({ error: "Kode voucher tidak ditemukan" }, { status: 200, headers: corsHeaders });
    }
    if (!voucher.is_active) {
      return Response.json({ error: "Voucher tidak aktif" }, { status: 200, headers: corsHeaders });
    }
    const now = new Date();
    if (new Date(voucher.starts_at) > now) {
      return Response.json({ error: "Voucher belum mulai berlaku" }, { status: 200, headers: corsHeaders });
    }
    if (new Date(voucher.expires_at) < now) {
      return Response.json({ error: "Voucher sudah kedaluwarsa" }, { status: 200, headers: corsHeaders });
    }
    if (voucher.current_claims >= voucher.max_claims) {
      return Response.json({ error: "Kuota voucher sudah habis" }, { status: 200, headers: corsHeaders });
    }

    // Cek target khusus (jika diisi admin)
    const targetVisitors: string[] = Array.isArray(voucher.target_visitor_ids) ? voucher.target_visitor_ids : [];
    const targetUbs: string[] = Array.isArray(voucher.target_user_balance_ids) ? voucher.target_user_balance_ids : [];
    const hasTarget = targetVisitors.length > 0 || targetUbs.length > 0;

    // Get user_balance_id (akun saldo aktif)
    const { data: blh } = await admin
      .from("balance_login_history")
      .select("user_balance_id")
      .eq("visitor_id", visitorId)
      .order("logged_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ubId = blh?.user_balance_id ?? null;

    // Validasi target khusus
    if (hasTarget) {
      const visitorOk = targetVisitors.includes(visitorId);
      const ubOk = ubId && targetUbs.includes(ubId);
      if (!visitorOk && !ubOk) {
        return Response.json({ error: "Voucher ini khusus untuk akun tertentu, kamu tidak dalam daftar penerima" }, { status: 200, headers: corsHeaders });
      }
    }

    // Reward 'saldo' (Saldo IN / game_balance) wajib login akun
    if (voucher.reward_type === "saldo" && !ubId) {
      return Response.json({ error: "Voucher Saldo IN memerlukan login akun saldo terlebih dahulu" }, { status: 200, headers: corsHeaders });
    }

    // Cek sudah pernah klaim? (per visitor_id ATAU per akun saldo)
    // Ini mencegah user logout-login akun lain di device sama untuk klaim ulang
    let alreadyClaimed = false;
    const { data: byVisitor } = await admin
      .from("streak_voucher_claims")
      .select("id")
      .eq("voucher_id", voucher.id)
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (byVisitor) alreadyClaimed = true;

    if (!alreadyClaimed && ubId) {
      const { data: byAccount } = await admin
        .from("streak_voucher_claims")
        .select("id")
        .eq("voucher_id", voucher.id)
        .eq("user_balance_id", ubId)
        .maybeSingle();
      if (byAccount) alreadyClaimed = true;
    }

    if (alreadyClaimed) {
      return Response.json({ error: "Akun ini sudah pernah klaim voucher tersebut (1 akun = 1 kali klaim)" }, { status: 200, headers: corsHeaders });
    }

    // Insert claim (race-safe via UNIQUE constraint)
    const { error: claimErr } = await admin.from("streak_voucher_claims").insert({
      voucher_id: voucher.id,
      voucher_code: voucher.code,
      visitor_id: visitorId,
      user_balance_id: ubId,
      reward_type: voucher.reward_type,
      reward_amount: voucher.reward_amount,
    });
    if (claimErr) {
      if (claimErr.code === "23505") {
        return Response.json({ error: "Akun ini sudah pernah klaim voucher tersebut" }, { status: 200, headers: corsHeaders });
      }
      return Response.json({ error: "Gagal mencatat klaim" }, { status: 200, headers: corsHeaders });
    }

    // Atomic increment claims; rollback if quota exceeded
    const { data: updatedVoucher, error: incErr } = await admin
      .from("streak_vouchers")
      .update({ current_claims: voucher.current_claims + 1 })
      .eq("id", voucher.id)
      .lt("current_claims", voucher.max_claims)
      .select("current_claims, max_claims")
      .maybeSingle();

    if (incErr || !updatedVoucher) {
      await admin.from("streak_voucher_claims").delete().eq("voucher_id", voucher.id).eq("visitor_id", visitorId);
      return Response.json({ error: "Kuota voucher sudah habis" }, { status: 200, headers: corsHeaders });
    }

    // Apply reward berdasarkan tipe
    const amount = voucher.reward_amount;
    let rewardLabel = "";
    try {
      switch (voucher.reward_type) {
        case "gems": {
          await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: amount });
          rewardLabel = `+${amount} 💎 Gem`;
          await admin.from("gem_transactions").insert({
            visitor_id: visitorId,
            amount,
            type: "voucher",
            description: `Klaim voucher ${voucher.code}: +${amount} 💎`,
            reference_id: voucher.id,
          });
          break;
        }
        case "credits": {
          await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: amount });
          rewardLabel = `+${amount} Kredit Game`;
          break;
        }
        case "streak_coins": {
          const { data: streak } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
          if (streak) {
            await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + amount }).eq("id", streak.id);
          } else {
            const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
            await admin.from("daily_streaks").insert({
              visitor_id: visitorId,
              last_claim_date: today,
              current_streak: 0,
              longest_streak: 0,
              total_claims: 0,
              streak_coins: amount,
            });
          }
          rewardLabel = `+${amount} 🪙 Koin Streak`;
          break;
        }
        case "streak_freeze": {
          const { data: streak } = await admin.from("daily_streaks").select("id, freeze_count").eq("visitor_id", visitorId).maybeSingle();
          if (streak) {
            await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + amount }).eq("id", streak.id);
          } else {
            const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
            await admin.from("daily_streaks").insert({
              visitor_id: visitorId,
              last_claim_date: today,
              current_streak: 0,
              longest_streak: 0,
              total_claims: 0,
              freeze_count: amount,
            });
          }
          rewardLabel = `+${amount} 🧊 Streak Freeze`;
          break;
        }
        case "hints": {
          const { data: pu } = await admin.from("user_power_ups").select("id, auto_hint").eq("visitor_id", visitorId).maybeSingle();
          if (pu) {
            await admin.from("user_power_ups").update({ auto_hint: (pu.auto_hint || 0) + amount }).eq("id", pu.id);
          } else {
            await admin.from("user_power_ups").insert({ visitor_id: visitorId, auto_hint: amount });
          }
          rewardLabel = `+${amount} 💡 Hint`;
          break;
        }
        case "time_freeze": {
          const { data: pu } = await admin.from("user_power_ups").select("id, time_freeze").eq("visitor_id", visitorId).maybeSingle();
          if (pu) {
            await admin.from("user_power_ups").update({ time_freeze: (pu.time_freeze || 0) + amount }).eq("id", pu.id);
          } else {
            await admin.from("user_power_ups").insert({ visitor_id: visitorId, time_freeze: amount });
          }
          rewardLabel = `+${amount} ⏱️ Time Freeze`;
          break;
        }
        case "saldo": {
          // Tambah Saldo IN (game_balance) — bukan saldo utama
          const { data: gb } = await admin.from("game_balance").select("id, amount").eq("visitor_id", visitorId).maybeSingle();
          if (gb) {
            await admin.from("game_balance").update({ amount: (gb.amount || 0) + amount }).eq("id", gb.id);
          } else {
            await admin.from("game_balance").insert({ visitor_id: visitorId, amount });
          }
          await admin.from("game_balance_transactions").insert({
            visitor_id: visitorId,
            type: "voucher_claim",
            amount,
            description: `Klaim voucher ${voucher.code}: +Rp ${amount.toLocaleString("id-ID")} Saldo IN`,
          });
          rewardLabel = `+Rp ${amount.toLocaleString("id-ID")} 💰 Saldo IN`;
          break;
        }
        case "extra_life": {
          const { data: pu } = await admin.from("user_power_ups").select("id, extra_life").eq("visitor_id", visitorId).maybeSingle();
          if (pu) {
            await admin.from("user_power_ups").update({ extra_life: (pu.extra_life || 0) + amount }).eq("id", pu.id);
          } else {
            await admin.from("user_power_ups").insert({ visitor_id: visitorId, extra_life: amount });
          }
          rewardLabel = `+${amount} ❤️ Extra Life`;
          break;
        }
      }
    } catch (rewardErr) {
      // Rollback claim & counter
      await admin.from("streak_voucher_claims").delete().eq("voucher_id", voucher.id).eq("visitor_id", visitorId);
      await admin.from("streak_vouchers").update({ current_claims: voucher.current_claims }).eq("id", voucher.id);
      return Response.json({ error: "Gagal memberikan hadiah voucher" }, { status: 200, headers: corsHeaders });
    }

    await admin.rpc("create_notification", {
      p_visitor_id: visitorId,
      p_title: "🎁 Voucher Berhasil Diklaim!",
      p_message: `${voucher.name}: ${rewardLabel}`,
      p_type: "success",
      p_related_id: voucher.code,
    });

    return Response.json({
      success: true,
      voucher_name: voucher.name,
      reward_type: voucher.reward_type,
      reward_amount: amount,
      reward_label: rewardLabel,
      remaining_quota: updatedVoucher.max_claims - updatedVoucher.current_claims,
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 200, headers: corsHeaders });
  }
});

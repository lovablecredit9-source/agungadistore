import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "ban") {
      const visitor_id = String(body.visitor_id || "").trim();
      const reason = String(body.reason || "Pelanggaran aturan").trim();
      const is_permanent = !!body.is_permanent;
      const days = Number(body.days || 0);

      if (!visitor_id) {
        return new Response(JSON.stringify({ error: "visitor_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve linked balance account
      const { data: hist } = await supabase
        .from("balance_login_history")
        .select("user_balance_id")
        .eq("visitor_id", visitor_id)
        .order("logged_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const banned_until = is_permanent
        ? null
        : new Date(Date.now() + Math.max(1, days) * 86400000).toISOString();

      // Deactivate previous active bans for this visitor/account
      await supabase
        .from("account_bans")
        .update({ is_active: false, unbanned_at: new Date().toISOString(), unban_reason: "Replaced by new ban" })
        .or(
          `visitor_id.eq.${visitor_id}${hist?.user_balance_id ? `,user_balance_id.eq.${hist.user_balance_id}` : ""}`
        )
        .eq("is_active", true);

      const { data: ban, error } = await supabase
        .from("account_bans")
        .insert({
          visitor_id,
          user_balance_id: hist?.user_balance_id ?? null,
          reason,
          is_permanent,
          banned_until,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification
      await supabase.rpc("create_notification", {
        p_visitor_id: visitor_id,
        p_title: "🚫 Akun Anda Dibanned",
        p_message: is_permanent
          ? `Akun dibanned permanen. Alasan: ${reason}`
          : `Akun dibanned ${days} hari (sampai ${new Date(banned_until!).toLocaleString("id-ID")}). Alasan: ${reason}`,
        p_type: "warning",
      });

      return new Response(JSON.stringify({ ok: true, ban }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unban") {
      const ban_id = String(body.ban_id || "");
      const visitor_id = String(body.visitor_id || "");
      const unban_reason = String(body.unban_reason || "Diunban admin");

      let query = supabase
        .from("account_bans")
        .update({ is_active: false, unbanned_at: new Date().toISOString(), unban_reason })
        .eq("is_active", true);

      if (ban_id) query = query.eq("id", ban_id);
      else if (visitor_id) query = query.eq("visitor_id", visitor_id);
      else {
        return new Response(JSON.stringify({ error: "ban_id or visitor_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await query;
      if (error) throw error;

      if (visitor_id) {
        await supabase.rpc("create_notification", {
          p_visitor_id: visitor_id,
          p_title: "✅ Banned Dicabut",
          p_message: `Akun Anda telah diunban. ${unban_reason}`,
          p_type: "success",
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("account_bans")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, bans: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search_user") {
      const q = String(body.query || "").trim();
      if (!q) return new Response(JSON.stringify({ ok: true, users: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: users } = await supabase
        .from("user_balances")
        .select("id, username, phone, email")
        .or(`username.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(50);

      return new Response(JSON.stringify({ ok: true, users: users ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

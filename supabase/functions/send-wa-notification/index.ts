import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normPhone(p: string): string | null {
  const d = String(p || "").replace(/\D/g, "");
  if (!d) return null;
  let n = d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d.startsWith("8") ? "62" + d : d;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  let out = String(tpl || "");
  // decode %0A -> newline for storage display
  out = out.replace(/%0A/gi, "\n");
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.split(`{${k}}`).join(String(v ?? "-"));
  }
  // strip any leftover {placeholder}
  out = out.replace(/\{[a-zA-Z0-9_]+\}/g, "-");
  return out;
}

async function pushToBot(admin: any, waNumber: string, text: string) {
  if (!waNumber || waNumber.length < 9) return false;
  const visitorKey = "system_admin_notif";
  let threadId: string | null = null;
  const { data: existing } = await admin
    .from("confess_threads")
    .select("id")
    .eq("visitor_id", visitorKey)
    .eq("target_phone", waNumber)
    .maybeSingle();
  if (existing?.id) threadId = existing.id;
  else {
    const { data: ins } = await admin
      .from("confess_threads")
      .insert({
        visitor_id: visitorKey,
        target_phone: waNumber,
        sender_name: "Sistem Notifikasi",
        last_message_preview: text.slice(0, 80),
      })
      .select("id")
      .single();
    threadId = ins?.id || null;
  }
  if (!threadId) return false;
  await admin.from("confess_thread_messages").insert({
    thread_id: threadId,
    direction: "out",
    text,
    status: "pending",
    is_free: true,
  });
  await admin
    .from("confess_threads")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 80),
    })
    .eq("id", threadId);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const eventType = String(body.event_type || body.eventType || "").trim();
    const vars = (body.vars && typeof body.vars === "object") ? body.vars : {};
    const overrideText = body.text ? String(body.text) : null;
    const overrideNumber = body.wa_number ? String(body.wa_number) : null;
    const notifyVisitorId = body.notify_visitor_id ? String(body.notify_visitor_id) : null;
    const isTest = !!body.test;

    if (!eventType && !overrideText) {
      return Response.json({ error: "event_type wajib" }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let cfg: any = null;
    if (eventType) {
      const { data } = await admin
        .from("wa_notification_configs")
        .select("event_type, wa_number, enabled, template")
        .eq("event_type", eventType)
        .maybeSingle();
      cfg = data;
    }

    const adminDisabled = !isTest && cfg && cfg.enabled === false;

    // Auto-vars
    const finalVars: Record<string, string | number> = {
      waktu: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      ...vars,
    };

    const text = overrideText || renderTemplate(cfg?.template || "", finalVars);
    if (!text || text.trim().length < 2) {
      return Response.json({ error: "Pesan kosong" }, { status: 400, headers: corsHeaders });
    }

    const results: any = { admin: null, user: [] };

    // 1) Kirim ke admin (jika enabled)
    if (!adminDisabled) {
      const waAdmin = normPhone(overrideNumber || cfg?.wa_number || "");
      if (waAdmin) {
        results.admin = { sent_to: waAdmin, ok: await pushToBot(admin, waAdmin, text) };
      }
    }

    // 2) Kirim ke SEMUA nomor user yang aktif (multi-number support)
    if (notifyVisitorId && eventType) {
      const rawKey = eventType.replace("notify_", "");
      // Map event tambahan ke channel notif user yang tersedia (purchase / login / deposit).
      const CHANNEL_MAP: Record<string, "purchase" | "login" | "deposit"> = {
        confess_purchase: "purchase",
        gem_purchase: "purchase",
        email_change: "login",
        password_change: "login",
        enable_2fa: "login",
        pin_reset: "login",
      };
      const eventKey = CHANNEL_MAP[rawKey] || rawKey;

      const { data: numbers } = await admin
        .from("user_wa_notif_numbers")
        .select("wa_number, notify_purchase, notify_login, notify_deposit, is_paid, paid_until")
        .eq("visitor_id", notifyVisitorId)
        .order("slot_index", { ascending: true });

      // Also check legacy single-number prefs for backwards compatibility
      const { data: legacyPref } = await admin
        .from("user_wa_notif_prefs")
        .select("wa_number, notify_purchase, notify_login, notify_deposit")
        .eq("visitor_id", notifyVisitorId)
        .maybeSingle();

      const allNumbers: { wa_number: string; enabled: boolean; isPaidSlot: boolean }[] = [];

      if (numbers && numbers.length > 0) {
        for (const n of numbers) {
          const enabledMap: Record<string, boolean> = {
            purchase: !!n.notify_purchase,
            login: !!n.notify_login,
            deposit: !!n.notify_deposit,
          };
          const isPaidExpired = n.is_paid && n.paid_until && new Date(n.paid_until) < new Date();
          allNumbers.push({
            wa_number: n.wa_number,
            enabled: enabledMap[eventKey] || false,
            isPaidSlot: n.is_paid && !isPaidExpired,
          });
        }
      }

      // Backwards compat: legacy pref
      if (legacyPref?.wa_number) {
        const enabledMap: Record<string, boolean> = {
          purchase: !!legacyPref.notify_purchase,
          login: !!legacyPref.notify_login,
          deposit: !!legacyPref.notify_deposit,
        };
        // Only add if not already in multi-number list
        if (!allNumbers.some((x) => x.wa_number === legacyPref.wa_number)) {
          allNumbers.push({
            wa_number: legacyPref.wa_number,
            enabled: enabledMap[eventKey] || false,
            isPaidSlot: false,
          });
        }
      }

      for (const entry of allNumbers) {
        if (!entry.enabled) continue;
        const waUser = normPhone(entry.wa_number);
        if (!waUser) continue;
        const ok = await pushToBot(admin, waUser, text);
        results.user.push({ sent_to: waUser, ok });
      }
    }

    return Response.json({ success: true, ...results }, { headers: corsHeaders });
  } catch (e: any) {
    return Response.json({ error: e?.message || "internal" }, { status: 500, headers: corsHeaders });
  }
});

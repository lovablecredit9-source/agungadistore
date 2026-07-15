// Auto-post transaksi ke channel testimoni via Telegram Bot
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function maskUsername(name: string | null | undefined): string {
  const v = (name ?? "").trim();
  if (!v) return "?????";
  if (v.length <= 2) return v[0] + "***";
  if (v.length <= 4) return v[0] + "***" + v[v.length - 1];
  return v.slice(0, 3) + "***" + v.slice(-2);
}

function maskPhone(p: string | null | undefined): string {
  const s = (p ?? "").replace(/\D/g, "");
  if (!s) return "";
  if (s.length <= 5) return s[0] + "****";
  return s.slice(0, 4) + "****" + s.slice(-3);
}

function fmtRp(n: number): string {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function wibNow(): string {
  const now = new Date();
  const tanggal = now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  return `${tanggal}, ${jam} WIB`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const kind: string = body.kind || "";
    const visitorId: string | null = body.visitor_id || null;
    const amount = Number(body.amount || 0);
    const product: string = body.product || "";
    const extra: string = body.extra || "";
    if (!kind) return Response.json({ error: "kind required" }, { headers: cors });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Ambil config
    const { data: cfgRows } = await admin.from("admin_settings").select("setting_key, setting_value").in("setting_key", ["telegram_testimoni_channel_id", "telegram_admin_visitor_ids"]);
    const cfg: Record<string, string> = {};
    (cfgRows || []).forEach((r: any) => { cfg[r.setting_key] = r.setting_value; });
    const channelId = (cfg["telegram_testimoni_channel_id"] || "").trim();
    if (!channelId) return Response.json({ ok: false, reason: "channel not configured" }, { headers: cors });

    let adminIds: string[] = [];
    try { adminIds = JSON.parse(cfg["telegram_admin_visitor_ids"] || "[]"); } catch { adminIds = []; }
    if (visitorId && adminIds.includes(visitorId)) {
      return Response.json({ ok: false, reason: "admin skipped" }, { headers: cors });
    }

    // Ambil identitas user
    let username = "?????", phone = "";
    if (visitorId) {
      const { data: u } = await admin.from("user_balances").select("username, phone").eq("visitor_id", visitorId).maybeSingle();
      if (u) { username = u.username || username; phone = u.phone || ""; }
    }

    const iconMap: Record<string, string> = {
      purchase: "🛒", deposit: "💰", gem: "💎", membership: "👑",
      streak_shop: "🏪", voucher: "🎫",
    };
    const titleMap: Record<string, string> = {
      purchase: "Transaksi Produk",
      deposit: "Deposit Saldo",
      gem: "Pembelian Gem",
      membership: "Membership Premium",
      streak_shop: "Streak Shop",
      voucher: "Klaim Voucher",
    };
    const icon = iconMap[kind] || "🎉";
    const title = titleMap[kind] || "Transaksi Baru";

    const lines: string[] = [`${icon} <b>${title}</b>`];
    lines.push(`👤 User: <b>${maskUsername(username)}</b>${phone ? ` (${maskPhone(phone)})` : ""}`);
    if (product) lines.push(`📦 ${product}`);
    if (extra) lines.push(`📝 ${extra}`);
    if (amount > 0) lines.push(`💵 Jumlah: <b>${fmtRp(amount)}</b>`);
    lines.push(`🕒 ${wibNow()}`);
    lines.push(`\n<i>Terima kasih sudah percaya di Agung Adi Store 🙏</i>`);
    const text = lines.join("\n");

    // Kirim ke channel via Telegram Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
      return Response.json({ ok: false, reason: "telegram not configured" }, { headers: cors });
    }
    const resp = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: channelId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("testimoni send failed", resp.status, errBody);
      return Response.json({ ok: false, status: resp.status, details: errBody }, { headers: cors });
    }
    return Response.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.error("telegram-testimoni error", e);
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: cors });
  }
});

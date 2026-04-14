import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resvg, initWasm } from "https://esm.sh/@aspect-dev/resvg-wasm@1.0.5";
import resvgWasm from "https://esm.sh/@aspect-dev/resvg-wasm@1.0.5/resvg.wasm?module";

let wasmInitialized = false;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReceiptData {
  type: string; // purchase, streak, credit, storage, bundle
  username: string;
  trx_id?: string;
  product_title?: string;
  product_id_short?: string;
  quantity?: number;
  total_price: number;
  balance_remaining: number;
  discount_amount?: number;
  plan_name?: string;
  expires_at?: string;
  tokens?: Array<{ token_code: string; fields?: Array<{ field_name: string; field_value: string }> }>;
  storage_mb?: number;
  credits?: number;
  streak_days?: number;
  auto_claimed?: boolean;
}

function generateReceiptSVG(data: ReceiptData): string {
  const now = new Date();
  const dateStr = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const receiptId = data.trx_id || ("RCP-" + now.getTime().toString(36).toUpperCase());

  const fmtRp = (n: number) => "Rp" + (n || 0).toLocaleString("id-ID");

  // Build receipt lines
  const lines: Array<{ text: string; bold?: boolean; color?: string; size?: number; icon?: string }> = [];

  // Header
  lines.push({ text: "AGUNG ADI STORE", bold: true, size: 28, color: "#FFFFFF" });
  lines.push({ text: "Bukti Transaksi Digital", size: 14, color: "#94A3B8" });
  lines.push({ text: "", size: 10 }); // spacer

  // Receipt ID & Date
  lines.push({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 12, color: "#334155" });
  lines.push({ text: "🧾  " + receiptId, size: 13, color: "#E2E8F0" });
  lines.push({ text: "📅  " + dateStr, size: 13, color: "#E2E8F0" });
  lines.push({ text: "👤  " + data.username, size: 13, color: "#E2E8F0" });
  lines.push({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 12, color: "#334155" });
  lines.push({ text: "", size: 8 });

  // Type-specific content
  const typeLabels: Record<string, string> = {
    purchase: "🛒  PEMBELIAN PRODUK",
    streak: "🔥  PAKET STREAK",
    credit: "💎  PAKET KREDIT GAME",
    storage: "💾  PAKET STORAGE MUSIK",
    bundle: "🎁  PAKET BUNDLE",
  };

  lines.push({ text: typeLabels[data.type] || "📦  TRANSAKSI", bold: true, size: 18, color: "#38BDF8" });
  lines.push({ text: "", size: 6 });

  if (data.type === "purchase") {
    lines.push({ text: "📦  Produk: " + (data.product_title || "-"), size: 14, color: "#E2E8F0" });
    if (data.product_id_short) lines.push({ text: "🆔  ID: " + data.product_id_short, size: 13, color: "#CBD5E1" });
    if (data.quantity && data.quantity > 1) lines.push({ text: "🔢  Jumlah: " + data.quantity, size: 13, color: "#CBD5E1" });
  } else {
    lines.push({ text: "📋  Paket: " + (data.plan_name || "-"), size: 14, color: "#E2E8F0" });
  }

  if (data.type === "streak" && data.expires_at) {
    const expDate = new Date(data.expires_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    lines.push({ text: "📅  Aktif sampai: " + expDate, size: 13, color: "#CBD5E1" });
  }

  if (data.type === "credit" && data.credits) {
    lines.push({ text: "💎  Kredit: " + data.credits, size: 13, color: "#CBD5E1" });
  }

  if (data.type === "storage" && data.storage_mb) {
    lines.push({ text: "💾  Storage: " + data.storage_mb + " MB", size: 13, color: "#CBD5E1" });
  }

  if (data.type === "bundle") {
    if (data.credits) lines.push({ text: "💎  Kredit: " + data.credits, size: 13, color: "#CBD5E1" });
    if (data.streak_days) lines.push({ text: "🔥  Streak: " + data.streak_days + " hari", size: 13, color: "#CBD5E1" });
    if (data.storage_mb) lines.push({ text: "💾  Storage: " + data.storage_mb + " MB", size: 13, color: "#CBD5E1" });
  }

  lines.push({ text: "", size: 8 });
  lines.push({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 12, color: "#334155" });
  lines.push({ text: "", size: 6 });

  // Financial
  lines.push({ text: "💰  Total Bayar: " + fmtRp(data.total_price), bold: true, size: 16, color: "#FBBF24" });
  if (data.discount_amount && data.discount_amount > 0) {
    lines.push({ text: "🏷️  Diskon: -" + fmtRp(data.discount_amount), size: 14, color: "#4ADE80" });
  }
  lines.push({ text: "💳  Sisa Saldo: " + fmtRp(data.balance_remaining), size: 14, color: "#E2E8F0" });

  // Tokens/Vouchers
  if (data.tokens?.length) {
    lines.push({ text: "", size: 8 });
    lines.push({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 12, color: "#334155" });
    lines.push({ text: "🎫  VOUCHER / AKUN", bold: true, size: 15, color: "#38BDF8" });
    data.tokens.forEach((t, i) => {
      lines.push({ text: (i + 1) + ". " + t.token_code, size: 13, color: "#FDE68A" });
      if (t.fields?.length) {
        t.fields.forEach((f) => {
          lines.push({ text: "    " + f.field_name + ": " + f.field_value, size: 12, color: "#CBD5E1" });
        });
      }
    });
  }

  if (data.auto_claimed) {
    lines.push({ text: "", size: 6 });
    lines.push({ text: "✅  Streak hari ini otomatis diklaim!", size: 13, color: "#4ADE80" });
  }

  lines.push({ text: "", size: 8 });
  lines.push({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 12, color: "#334155" });
  lines.push({ text: "", size: 4 });
  lines.push({ text: "✅ TRANSAKSI BERHASIL", bold: true, size: 16, color: "#4ADE80" });
  lines.push({ text: "", size: 6 });
  lines.push({ text: "📱 Agung Adi Store", size: 12, color: "#64748B" });
  lines.push({ text: "📞 WA: 085769302532", size: 12, color: "#64748B" });
  lines.push({ text: "🌐 produkklaimtransaksiagungadistore.lovable.app", size: 11, color: "#64748B" });

  // Calculate SVG height
  let totalHeight = 60; // top padding
  for (const line of lines) {
    totalHeight += (line.size || 14) + 8;
  }
  totalHeight += 40; // bottom padding

  const width = 480;

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">`;

  // Background with gradient
  svg += `<defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0F172A"/>
      <stop offset="100%" style="stop-color:#1E293B"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#3B82F6"/>
      <stop offset="100%" style="stop-color:#8B5CF6"/>
    </linearGradient>
  </defs>`;

  // Background rect with rounded corners
  svg += `<rect width="${width}" height="${totalHeight}" rx="16" fill="url(#bg)"/>`;

  // Top accent bar
  svg += `<rect x="0" y="0" width="${width}" height="4" rx="2" fill="url(#accent)"/>`;

  // Side accent
  svg += `<rect x="0" y="0" width="4" height="${totalHeight}" fill="url(#accent)" opacity="0.3"/>`;

  let y = 45;
  for (const line of lines) {
    const fontSize = line.size || 14;
    const color = line.color || "#E2E8F0";
    const fontWeight = line.bold ? "bold" : "normal";

    if (line.text) {
      // Escape XML entities
      const escaped = line.text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      const x = line.bold && fontSize >= 18 ? width / 2 : 32;
      const anchor = line.bold && fontSize >= 18 ? "middle" : "start";

      svg += `<text x="${x}" y="${y}" font-family="'Segoe UI', Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="${anchor}">${escaped}</text>`;
    }

    y += fontSize + 8;
  }

  svg += `</svg>`;
  return svg;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json() as ReceiptData;

    if (!body.type || !body.username) {
      return Response.json({ error: "Data receipt tidak lengkap" }, { status: 400, headers: corsHeaders });
    }

    const svg = generateReceiptSVG(body);

    // Try to render SVG to PNG using resvg-wasm
    try {
      if (!wasmInitialized) {
        await initWasm(resvgWasm);
        wasmInitialized = true;
      }
      const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 480 } });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      const base64 = btoa(String.fromCharCode(...pngBuffer));

      return Response.json(
        { success: true, image_base64: base64, mime: "image/png" },
        { headers: corsHeaders },
      );
    } catch (renderErr) {
      // Fallback: return SVG as base64
      console.log("PNG render fallback to SVG:", renderErr);
      const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
      return Response.json(
        { success: true, image_base64: svgBase64, mime: "image/svg+xml" },
        { headers: corsHeaders },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});

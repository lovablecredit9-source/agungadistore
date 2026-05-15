import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "";
const ADMIN_WA = "085769302532";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // === Gather context ===
    const [productsRes, sponsorsRes] = await Promise.all([
      sb.from("products").select("id,title,price,stock,category,sold_count,image_url,description").order("sold_count", { ascending: false }).limit(40),
      sb.from("sponsors").select("title,description,price,wa_number,instagram,custom_note,expires_at,is_active").eq("is_active", true).limit(20),
    ]);
    const products = (productsRes.data || []).map((p: any) =>
      `- [${p.title}](/produk?id=${p.id}) | Rp${Number(p.price).toLocaleString("id-ID")} | stok:${p.stock} | terjual:${p.sold_count} | kategori:${p.category || "-"} | img:${p.image_url || "-"} | desc:${(p.description || "").slice(0, 80)}`
    ).join("\n");
    const sponsors = (sponsorsRes.data || []).map((s: any) =>
      `- ${s.title} | Rp${Number(s.price).toLocaleString("id-ID")} | WA:${s.wa_number || "-"} | IG:${s.instagram || "-"}`
    ).join("\n");

    let userCtx = "Pengunjung anonim (belum login).";
    if (visitorId) {
      const [trxRes, gpRes, dsRes, xpRes, ubRes, banRes] = await Promise.all([
        sb.from("balance_transactions").select("type,amount,description,created_at,trx_id").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(8),
        sb.from("game_profiles").select("display_name,gems,is_guest,user_balance_id").eq("visitor_id", visitorId).maybeSingle(),
        sb.from("daily_streaks").select("current_streak,longest_streak,total_claims,streak_coins,last_claim_date").eq("visitor_id", visitorId).maybeSingle(),
        sb.from("music_listener_xp").select("level,total_seconds").eq("visitor_id", visitorId).maybeSingle(),
        sb.rpc("get_active_user_balance_id", { p_visitor_id: visitorId }),
        sb.rpc("get_account_ban_info", { p_visitor_id: visitorId }),
      ]);

      const trxList = (trxRes.data || []).map((t: any) =>
        `  • #${t.trx_id || t.id?.slice?.(0, 6) || "-"} ${t.type} Rp${Number(t.amount).toLocaleString("id-ID")} — ${t.description || ""} (${new Date(t.created_at).toLocaleString("id-ID")})`
      ).join("\n");
      const totalSpent = (trxRes.data || []).filter((t: any) => t.type !== "topup").reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);

      let balanceLine = "";
      if (ubRes.data) {
        const { data: ub } = await sb.from("user_balances").select("username,balance,bonus_balance,phone").eq("id", ubRes.data).maybeSingle();
        if (ub) balanceLine = `Akun saldo: ${ub.username} | Saldo: Rp${Number(ub.balance).toLocaleString("id-ID")} | Bonus: Rp${Number(ub.bonus_balance || 0).toLocaleString("id-ID")} | HP: ${ub.phone || "-"}`;
      }
      const ban = banRes.data?.[0];
      userCtx = [
        balanceLine || "Akun saldo: belum login",
        gpRes.data ? `Profil game: ${gpRes.data.display_name} | Gem: ${gpRes.data.gems} | ${gpRes.data.is_guest ? "Guest" : "Bound"}` : "Profil game: belum dibuat",
        dsRes.data ? `Streak: aktif ${dsRes.data.current_streak} hari (terpanjang ${dsRes.data.longest_streak}, total klaim ${dsRes.data.total_claims}, koin streak ${dsRes.data.streak_coins}, terakhir klaim ${dsRes.data.last_claim_date})` : "Streak: belum aktif",
        xpRes.data ? `Music XP: level ${xpRes.data.level} | total dengar: ${Math.round((xpRes.data.total_seconds || 0) / 60)} menit` : "Music XP: belum ada",
        ban ? `⚠️ AKUN DIBANNED: ${ban.reason} (${ban.is_permanent ? "permanen" : "sampai " + ban.banned_until})` : "Status: tidak dibanned",
        `Total transaksi: ${trxRes.data?.length || 0} (8 terbaru)\nTotal pengeluaran terlihat: Rp${totalSpent.toLocaleString("id-ID")}`,
        trxList ? `Riwayat:\n${trxList}` : "",
      ].filter(Boolean).join("\n");
    }

    const systemPrompt = `Kamu adalah "Store AI" — asisten resmi Agung Adi Store. Bahasa: Indonesia santai & ramah. Format: markdown.

ATURAN KETAT (WAJIB DIPATUHI):
1. Hanya jawab pertanyaan tentang website ini: produk, musik, game, anon chat, kendala/laporan, sponsor, streak, saldo, history transaksi, total dimainkan, level game, nama akun, bot WA Z. JANGAN jawab topik di luar itu (politik, gosip, PR, kode umum, dll). Tolak halus: "Maaf, aku cuma bisa bantu seputar Agung Adi Store ya 🙏".
2. JANGAN PERNAH bagikan kontak pribadi siapapun (no HP, email user lain). Hanya boleh sebut WA admin resmi: ${ADMIN_WA}.
3. Jika user tanya link produk → kirim **judul + harga + stok + link** dari daftar produk di bawah. Jangan karang link.
4. Jika user tanya sponsor → tampilkan dari daftar sponsor di bawah (judul, harga, WA/IG sponsor).
5. PERINGATAN: kalau user mau promosi produk sendiri TANPA jadi sponsor resmi → tegaskan akan **dibanned**. Arahkan untuk daftar sponsor lewat WA admin ${ADMIN_WA}.
6. Untuk **kendala/laporan** → arahkan buka tab Tiket atau hubungi WA admin ${ADMIN_WA}.
7. Pertanyaan tentang admin: pemilik & admin toko adalah **Agung Adi**. Pembuat bot WA "Z Bot" juga **Agung Adi**.
8. Bot WA Z: ada **versi gratis** (fitur dasar) dan **versi berbayar/premium** (fitur lengkap). Hubungi admin untuk upgrade.
9. Jangan sungkan menjawab selama masih sesuai ruang lingkup web. Jangan balas dengan "Saya tidak tahu" untuk hal yang ada di context.
10. Jika user tanya data pribadinya (transaksi/streak/level/gem/saldo/nama akun) → ambil dari "DATA USER" di bawah. Kalau belum login, minta login dulu.
11. **FORMAT PRODUK (WAJIB)**: Saat menyebut produk, gunakan format markdown agar bisa di-klik & menampilkan gambar:
    \`\`\`
    ![nama](URL_IMG)
    **[Judul Produk](/produk?id=ID)** — Rp harga
    Stok: X • Terjual: Y • Kategori: Z
    Deskripsi singkat.
    \`\`\`
    Pakai path relatif \`/produk?id=...\` (jangan pakai domain). Kalau img \`-\` skip baris gambar.`}

=== DAFTAR PRODUK (top 40) ===
${products || "(kosong)"}

=== SPONSOR AKTIF ===
${sponsors || "(tidak ada sponsor aktif)"}

=== DATA USER ===
${userCtx}
`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-12)],
      }),
    });

    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan, coba sebentar lagi." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Kuota AI habis, hubungi admin." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await aiResp.json();
    const reply = data.choices?.[0]?.message?.content || "(tidak ada balasan)";
    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

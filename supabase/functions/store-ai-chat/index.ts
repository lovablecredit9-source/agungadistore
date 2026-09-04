import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_WA = "085769302532";

const fmtRp = (n: any) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const safe = <T,>(p: PromiseLike<T>): Promise<T | null> => Promise.resolve(p).then((v) => v).catch(() => null as any);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ============ KONTEKS PUBLIK (semua user lihat sama) ============
    const [
      productsRes, sponsorsRes, postsRes, flashRes, waPackRes,
      premiumPackRes, gemPackRes, creditPackRes, artistsRes,
      streakShopRes, mysteryRes, voucherRes,
      settingsRes, aiProvRes, seasonRes,
    ] = await Promise.all([
      safe(sb.from("products").select("id,title,price,stock,category,sold_count,image_url,description,is_warranty").order("sold_count", { ascending: false }).limit(40)),
      safe(sb.from("sponsors").select("id,title,description,price,wa_number,instagram,custom_note,expires_at,is_active").eq("is_active", true).limit(20)),
      safe(sb.from("admin_posts").select("title,content,created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(5)),
      safe(sb.from("auto_flash_sales").select("title,discount_percent,start_at,end_at,quota,sold_count").eq("is_active", true).limit(10)),
      safe(sb.from("wa_bot_packages").select("name,price,duration_days,description,features").eq("is_active", true).order("price")),
      safe(sb.from("store_premium_packages" as any).select("name,price,duration_days,daily_voucher_amount,description").eq("is_active", true).order("price")),
      safe(sb.from("gem_packages").select("name,gems,price,bonus_gems").eq("is_active", true).order("price")),
      safe(sb.from("credit_packages").select("name,credits,price,bonus_credits,is_premium,is_unlimited").eq("is_active", true).order("price")),
      safe(sb.from("artists").select("name,bio").limit(20)),
      safe(sb.from("streak_shop_items").select("name,price_coins,description").eq("is_active", true).limit(15)),
      safe(sb.from("mystery_boxes").select("name,price,description").eq("is_active", true).limit(10)),
      safe(sb.from("discount_vouchers").select("code,discount_percent,category,min_purchase,expires_at").eq("is_active", true).limit(10)),
      safe(sb.from("admin_settings").select("setting_key,setting_value").in("setting_key", ["bot_enabled", "bot_offline_message", "admin_last_active", "seller_open_date", "seller_registration_mode", "ewallets", "qris_url"])),
      safe(sb.from("ai_providers").select("label,model,provider_type").eq("is_selected", true).eq("is_active", true).maybeSingle()),
      safe(sb.from("fire_pass_seasons").select("name,season_number,starts_at,ends_at,is_active").eq("is_active", true).maybeSingle()),
    ]);

    const settings: Record<string, string> = {};
    for (const r of (settingsRes?.data || []) as any[]) settings[r.setting_key] = r.setting_value;
    const botOnline = settings.bot_enabled !== "false" && settings.bot_enabled !== "0";
    const adminLastActive = settings.admin_last_active
      ? new Date(settings.admin_last_active).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" })
      : "belum tercatat";
    const aiModelLine = aiProvRes?.data
      ? `${(aiProvRes.data as any).label} — model ${(aiProvRes.data as any).model}`
      : "Lovable AI — google/gemini-2.5-flash";
    const sellerMode = settings.seller_registration_mode || "auto";
    const sellerOpenIso = settings.seller_open_date || "2026-09-14T17:00:00Z";
    const sellerOpenLabel = new Date(sellerOpenIso).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" }) + " WIB";
    const sellerStatus = sellerMode === "open"
      ? "SUDAH DIBUKA (daftar sekarang di tab Jualan)"
      : sellerMode === "closed"
        ? "DITUTUP sementara oleh admin"
        : (new Date(sellerOpenIso).getTime() <= Date.now()
          ? `SUDAH DIBUKA sejak ${sellerOpenLabel}`
          : `BELUM DIBUKA — jadwal buka ${sellerOpenLabel}`);
    const season = seasonRes?.data as any;
    const ewalletList = (() => {
      try { return (JSON.parse(settings.ewallets || "[]") as any[]).map((e) => `${e.name} ${e.number} a.n. ${e.holder}`).join(" | "); }
      catch { return "-"; }
    })();

    const products = (productsRes?.data || []).map((p: any) =>
      `- [${p.title}](/produk?id=${p.id}) | ${fmtRp(p.price)} | stok:${p.stock} | terjual:${p.sold_count} | kategori:${p.category || "-"} | garansi:${p.is_warranty ? "ya" : "tidak"} | img:${p.image_url || "-"} | ${(p.description || "").slice(0, 100)}`
    ).join("\n");
    const sponsors = (sponsorsRes?.data || []).map((s: any) =>
      `- ${s.title} | ${fmtRp(s.price)} | WA:${s.wa_number || "-"} | IG:${s.instagram || "-"} | ${(s.description || "").slice(0, 80)}`
    ).join("\n");
    const posts = (postsRes?.data || []).map((p: any) => `- "${p.title}" (${new Date(p.created_at).toLocaleDateString("id-ID")})`).join("\n");
    const flashSales = (flashRes?.data || []).map((f: any) => `- ${f.title} | diskon ${f.discount_percent}% | sisa kuota:${(f.quota || 0) - (f.sold_count || 0)} | berakhir:${new Date(f.end_at).toLocaleString("id-ID")}`).join("\n");
    const waPacks = (waPackRes?.data || []).map((w: any) => `- ${w.name}: ${fmtRp(w.price)} / ${w.duration_days}hari — ${w.description || ""}`).join("\n");
    const premiumPacks = (premiumPackRes?.data || []).map((p: any) => `- ${p.name}: ${fmtRp(p.price)} / ${p.duration_days}hari — voucher harian ${fmtRp(p.daily_voucher_amount)}`).join("\n");
    const gemPacks = (gemPackRes?.data || []).map((g: any) => `- ${g.name}: ${g.gems}+${g.bonus_gems || 0} gem = ${fmtRp(g.price)}`).join("\n");
    const creditPacks = (creditPackRes?.data || []).map((c: any) => `- ${c.name}: ${c.credits}+${c.bonus_credits || 0} kredit = ${fmtRp(c.price)}${c.is_unlimited ? " (UNLIMITED)" : c.is_premium ? " (PREMIUM)" : ""}`).join("\n");
    const artists = (artistsRes?.data || []).map((a: any) => `- ${a.name}`).join(", ");
    const streakShop = (streakShopRes?.data || []).map((i: any) => `- ${i.name}: ${i.price_coins} koin streak`).join("\n");
    const mysteries = (mysteryRes?.data || []).map((m: any) => `- ${m.name}: ${fmtRp(m.price)}`).join("\n");
    const vouchers = (voucherRes?.data || []).map((v: any) => `- ${v.code}: ${v.discount_percent}% (min ${fmtRp(v.min_purchase)}, kategori:${v.category || "all"})`).join("\n");

    // ============ DATA USER ============
    let userCtx = "Pengunjung anonim (belum login akun saldo).";
    if (visitorId) {
      const [trxRes, gpRes, dsRes, xpRes, ubIdRes, banRes, ticketRes, likeProdRes, likeSongRes, followRes, gemBalRes, gameStatsRes, creditsRes, premiumRes, streakProfRes, anonProfRes] = await Promise.all([
        safe(sb.from("balance_transactions").select("type,amount,description,created_at,trx_id").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(10)),
        safe(sb.from("game_profiles").select("display_name,gems,is_guest,total_score,level").eq("visitor_id", visitorId).maybeSingle()),
        safe(sb.from("daily_streaks").select("current_streak,longest_streak,total_claims,streak_coins,last_claim_date").eq("visitor_id", visitorId).maybeSingle()),
        safe(sb.from("music_listener_xp").select("level,total_seconds,xp").eq("visitor_id", visitorId).maybeSingle()),
        safe(sb.rpc("get_active_user_balance_id", { p_visitor_id: visitorId })),
        safe(sb.rpc("get_account_ban_info", { p_visitor_id: visitorId })),
        safe(sb.from("support_tickets").select("id,subject,status,created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(5)),
        safe(sb.from("liked_products").select("product_id", { count: "exact", head: true }).eq("visitor_id", visitorId)),
        safe(sb.from("liked_songs").select("song_id", { count: "exact", head: true }).eq("visitor_id", visitorId)),
        safe(sb.from("user_follows").select("followed_visitor_id", { count: "exact", head: true }).eq("follower_visitor_id", visitorId)),
        safe(sb.from("game_balance").select("gems,coins,amount").eq("visitor_id", visitorId).maybeSingle()),
        safe(sb.from("game_stats").select("game_name,total_played,best_score,highest_level").eq("visitor_id", visitorId).order("total_played", { ascending: false }).limit(10)),
        safe(sb.from("user_game_credits").select("credits,is_premium,is_unlimited,expires_at").eq("visitor_id", visitorId).maybeSingle()),
        safe(sb.rpc("get_store_premium_info", { p_visitor_id: visitorId })),
        safe(sb.from("streak_profiles").select("total_xp,level,streak_coins").eq("visitor_id", visitorId).maybeSingle()),
        safe(sb.from("anon_chat_profiles").select("display_name,total_matches").eq("visitor_id", visitorId).maybeSingle()),
      ]);

      const [fpRes, depoRes, banHistRes, violRes, sellerAppRes, notifRes, pinRes] = await Promise.all([
        safe(sb.from("fire_pass_progress").select("current_tier,total_xp,is_premium,season_id").eq("visitor_id", visitorId).maybeSingle()),
        safe(sb.from("deposits").select("amount,status,created_at,trx_id").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(5)),
        safe(sb.from("account_bans").select("reason,is_permanent,banned_until,created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(10)),
        safe(sb.from("chat_violations").select("reason,created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(10)),
        safe(sb.from("seller_applications").select("store_name,status,created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(3)),
        safe(sb.from("notifications").select("title,type,created_at,is_read").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(8)),
        safe(sb.from("user_pins").select("visitor_id").eq("visitor_id", visitorId).maybeSingle()),
      ]);
      const fp = fpRes?.data as any;
      const depoList = (depoRes?.data || []).map((d: any) => `  • #${d.trx_id || "-"} ${fmtRp(d.amount)} status:${d.status} (${new Date(d.created_at).toLocaleString("id-ID")})`).join("\n");
      const banHist = (banHistRes?.data || []).map((b: any) => `  • ${b.reason} — ${b.is_permanent ? "permanen" : "s/d " + b.banned_until} (${new Date(b.created_at).toLocaleDateString("id-ID")})`).join("\n");
      const violList = (violRes?.data || []).map((v: any) => `  • ${v.reason} (${new Date(v.created_at).toLocaleDateString("id-ID")})`).join("\n");
      const sellerApps = (sellerAppRes?.data || []).map((s: any) => `  • ${s.store_name} — status:${s.status} (${new Date(s.created_at).toLocaleDateString("id-ID")})`).join("\n");
      const notifList = (notifRes?.data || []).map((n: any) => `  • [${n.type || "info"}] ${n.title}${n.is_read ? "" : " (belum dibaca)"}`).join("\n");

      const trxList = (trxRes?.data || []).map((t: any) =>
        `  • #${t.trx_id || "-"} ${t.type} ${fmtRp(t.amount)} — ${t.description || ""} (${new Date(t.created_at).toLocaleString("id-ID")})`
      ).join("\n");
      const totalSpent = (trxRes?.data || []).filter((t: any) => t.type !== "topup").reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);

      let balanceLine = "Akun saldo: belum login";
      if (ubIdRes?.data) {
        const { data: ub } = await sb.from("user_balances").select("username,balance,bonus_balance,phone,created_at").eq("id", ubIdRes.data).maybeSingle();
        if (ub) balanceLine = `Akun saldo: ${ub.username} | Saldo: ${fmtRp(ub.balance)} | Bonus: ${fmtRp(ub.bonus_balance)} | HP: ${ub.phone || "-"} | Bergabung: ${new Date(ub.created_at).toLocaleDateString("id-ID")}`;
      }
      const ban = banRes?.data?.[0];
      const prem = Array.isArray(premiumRes?.data) ? premiumRes!.data[0] : premiumRes?.data;
      const tickets = (ticketRes?.data || []).map((t: any) => `  • Tiket "${t.subject}" status:${t.status} (${new Date(t.created_at).toLocaleDateString("id-ID")})`).join("\n");
      const gameStats = (gameStatsRes?.data || []).map((g: any) => `  • ${g.game_name}: dimainkan ${g.total_played}x, best:${g.best_score || 0}, level:${g.highest_level || 0}`).join("\n");

      userCtx = [
        balanceLine,
        gpRes?.data ? `Profil game: ${gpRes.data.display_name} | Gem profil:${gpRes.data.gems} | Total skor:${gpRes.data.total_score || 0} | Level:${gpRes.data.level || 1} | ${gpRes.data.is_guest ? "Guest" : "Bound"}` : "Profil game: belum dibuat",
        gemBalRes?.data ? `Saldo game: ${gemBalRes.data.gems} gem, ${gemBalRes.data.coins} koin | SALDO IN: ${fmtRp((gemBalRes.data as any).amount)} (hanya untuk fitur game/streak, TIDAK bisa dipakai beli produk admin)` : "Saldo IN: Rp0",
        creditsRes?.data ? `Kredit game: ${creditsRes.data.credits}${creditsRes.data.is_unlimited ? " UNLIMITED" : creditsRes.data.is_premium ? " PREMIUM" : ""}${creditsRes.data.expires_at ? ` (s/d ${new Date(creditsRes.data.expires_at).toLocaleDateString("id-ID")})` : ""}` : "",
        dsRes?.data ? `Streak: aktif ${dsRes.data.current_streak} hari | terpanjang ${dsRes.data.longest_streak} | total klaim ${dsRes.data.total_claims} | koin streak ${dsRes.data.streak_coins} | terakhir klaim ${dsRes.data.last_claim_date}` : "Streak: belum aktif",
        streakProfRes?.data ? `Streak XP: ${streakProfRes.data.total_xp} (level ${streakProfRes.data.level})` : "",
        xpRes?.data ? `Music XP: level ${xpRes.data.level} | XP:${xpRes.data.xp || 0} | total dengar: ${Math.round((xpRes.data.total_seconds || 0) / 60)} menit` : "Music XP: belum ada",
        anonProfRes?.data ? `Anon Chat: ${anonProfRes.data.display_name} | total match:${anonProfRes.data.total_matches || 0}` : "Anon Chat: belum dipakai",
        prem?.is_premium ? `🌟 PREMIUM TOKO aktif: ${prem.plan_name} | sisa ${prem.days_left} hari` : "Premium toko: tidak aktif",
        `Like produk: ${likeProdRes?.count || 0} | Like lagu: ${likeSongRes?.count || 0} | Following: ${followRes?.count || 0}`,
        ban ? `⚠️ AKUN DIBANNED: ${ban.reason} (${ban.is_permanent ? "permanen" : "sampai " + ban.banned_until})` : "Status ban: bersih",
        `Total transaksi tampil: ${trxRes?.data?.length || 0} | Total pengeluaran terlihat: ${fmtRp(totalSpent)}`,
        trxList ? `Riwayat transaksi terbaru:\n${trxList}` : "",
        gameStats ? `Statistik game:\n${gameStats}` : "Statistik game: belum main",
        tickets ? `Tiket support:\n${tickets}` : "Tiket support: tidak ada",
        pinRes?.data ? "PIN 6-digit: sudah dibuat ✅" : "PIN 6-digit: BELUM dibuat (wajib dibuat sebelum transaksi)",
        fp ? `Fire Pass: tier ${fp.current_tier} | XP ${fp.total_xp} | jalur ${fp.is_premium ? "PREMIUM ⭐" : "FREE"}` : "Fire Pass: belum ikut season ini",
        depoList ? `Riwayat deposit:\n${depoList}` : "Deposit: belum pernah",
        banHist ? `Riwayat banned (${(banHistRes?.data || []).length}x):\n${banHist}` : "Riwayat banned: tidak pernah",
        violList ? `Riwayat pelanggaran chat:\n${violList}` : "Pelanggaran chat: tidak ada",
        sellerApps ? `Pendaftaran seller:\n${sellerApps}` : "Pendaftaran seller: belum mendaftar",
        notifList ? `Notifikasi terbaru:\n${notifList}` : "Notifikasi: kosong",
      ].filter(Boolean).join("\n");
    }

    const systemPrompt = `Kamu adalah "Store AI" — asisten resmi **Agung Adi Store**. Bahasa: Indonesia santai, ramah, gaul-sopan, sering pakai emoji 🚀✨. Format jawaban: **markdown rapi** (bold, list, link, gambar).

═══════════════════════════════════════
🛡️ ATURAN KETAT (WAJIB DIPATUHI 100%):
═══════════════════════════════════════
1. **HANYA jawab pertanyaan seputar Agung Adi Store**: produk, musik, game, anon chat, sponsor, streak, saldo, kredit, gem, koin, voucher, mystery box, premium toko, bot WA Z, kendala/tiket, akun, transaksi, follow/like, level/XP, leaderboard, lucky wheel, scratch off, daily streak, dll. **TOLAK** topik luar (politik, agama sensitif, PR sekolah, kode generik, gosip artis): "Maaf, aku cuma bisa bantu seputar Agung Adi Store ya 🙏"
2. **JANGAN PERNAH** bagikan kontak pribadi user lain (no HP/email). Hanya boleh sebut WA admin resmi: **${ADMIN_WA}**.
3. Kalau user tanya **link produk** → kirim format produk (gambar + judul clickable + harga + stok + deskripsi singkat) dari "DAFTAR PRODUK".
4. Kalau user tanya **sponsor** → tampilkan dari "SPONSOR AKTIF" (judul, harga, WA/IG sponsor). Ingatkan: pembelian sponsor wajib lewat **Rekber WA admin ${ADMIN_WA}** demi keamanan.
5. ⚠️ **PERINGATAN BANNED**: Kalau user mau promosi produk/jualan sendiri TANPA jadi sponsor resmi → tegaskan akan **dibanned permanen**. Arahkan daftar sponsor lewat WA admin ${ADMIN_WA}.
6. **Kendala/laporan/komplain** → arahkan ke tab **Tiket Support** atau WA admin ${ADMIN_WA}.
7. **Tentang admin & toko**: Pemilik & admin tunggal = **Agung Adi**. Pembuat bot WA "Z Bot" juga **Agung Adi**. Tagline toko: "Murah & Terpercaya".
8. **Bot WA Z**: punya **paket gratis** (fitur dasar: cek harga, daftar produk) & **paket berbayar/premium** (lihat "PAKET BOT WA" — fitur lengkap: deposit otomatis, claim voucher, dll). Upgrade hubungi admin.
9. **Data pribadi user** (saldo, transaksi, streak, level, gem, kredit, akun, ban, tiket) → ambil dari "DATA USER". Kalau belum login, arahkan login dulu di tab **Plus** atau **Saldo**.
10. Jangan sungkan, jawab tuntas dan **selengkap mungkin** selama dalam scope. Jangan bilang "aku tidak tahu" kalau datanya ada di context.
11. Setiap transaksi pakai **PIN 6-digit** wajib. Kalau lupa PIN → arahkan reset via WA admin (token reset 5 digit).
12. **Format produk WAJIB** (clickable + gambar):
    \`\`\`
    ![nama](URL_IMG)
    **[Judul Produk](/produk?id=ID)** — Rp harga
    📦 Stok: X • 🛒 Terjual: Y • 🏷️ Kategori: Z
    Deskripsi singkat.
    \`\`\`
    Pakai path relatif \`/produk?id=...\`. Skip baris gambar kalau img \`-\`.
13. **SPONSOR HABIS**: kalau "SPONSOR AKTIF" kosong → jawab: "Yah, slot sponsor lagi kosong / belum ada yang daftar 😥. Kalau kamu mau pasang sponsor, harganya murah & bisa diperpanjang — hubungi admin WA **${ADMIN_WA}** atau buka [Tiket Support](/?tab=tiket) sekarang." JANGAN mengarang sponsor.
14. **SALDO IN vs SALDO BIASA**: Saldo IN (dari game/streak) **TIDAK BISA** dipakai membeli produk admin. Produk admin **hanya** bisa dibayar pakai **saldo biasa** (top up / deposit). Saldo IN hanya untuk fitur game/streak. Jelaskan ini kalau ditanya.
15. **ANTI KELUAR-TRANSAKSI**: kalau user minta lanjut transaksi di luar web (WA pribadi, Anon Chat, Confess, DM) → tegas: "⚠️ Mengarahkan pembeli keluar dari transaksi resmi = **BANNED**. Semua transaksi wajib lewat web/bot resmi." Berlaku juga untuk share nomor via Anon Chat/Confess.
16. **TOMBOL NAVIGASI**: selalu selipkan link internal yang relevan sebagai tombol markdown, contoh: [🤖 Bot Galau](/?tab=galau) · [💌 Confess](/?tab=confess) · [💰 Plus/Top Up](/?tab=plus) · [🎮 Game](/?tab=game) · [🎰 Lucky Royale](/?tab=luck) · [🔥 Fire Pass](/?tab=firepass) · [🎫 Tiket](/?tab=tiket) · [🏪 Jualan](/?tab=jualan) · [🕵️ Anon Chat](/?tab=anon) · [📢 Update](/?tab=update).
17. **LAPOR PENIPU**: kalau user mau lapor penipuan → beri tombol [🎫 Buat Tiket Laporan](/?tab=tiket) dan WA admin ${ADMIN_WA}, lalu minta format lengkap: nama/ID pelaku, tanggal & jam kejadian, nominal, bukti chat/transfer (screenshot), kronologi singkat.
18. **BELUM PUNYA AKUN**: kalau DATA USER menunjukkan belum login → jangan mengarang angka. Bilang "Aku belum bisa lihat datamu karena kamu belum login/daftar akun 🙏" + tombol [🔐 Login / Daftar](/?tab=plus).
19. **STREAK**: streak diklaim **otomatis** saat user membuka web (auto-claim), reset tiap 00:00 WIB. Sebutkan streak aktif + masa aktif dari DATA USER.
20. **MODEL AI**: kalau ditanya "pakai AI apa" → jawab jujur: **${aiModelLine}**.
21. **STATUS BOT WA**: saat ini bot **${botOnline ? "ONLINE 🟢" : "OFFLINE 🔴"}**. ${botOnline ? "Notifikasi WA aktif, silakan sambungkan nomor lewat menu Notifikasi WA supaya notif masuk." : "Bot sedang offline — pesan yang dikirim bisa gagal dan **uang otomatis dikembalikan**. Coba lagi nanti."}
22. **DEPOSIT**: metode **manual dikonfirmasi admin**. Alur: buka [💰 Deposit](/?tab=plus) → pilih nominal → bayar ke QRIS/e-wallet resmi (${ewalletList || "-"}) → upload bukti asli → admin konfirmasi. ⚠️ Pastikan tujuan benar (QRIS/nomor admin resmi). Bukti palsu terdeteksi = transaksi gagal + peringatan penipuan. Kalau nomor admin belum masuk, minta user cek ulang sebelum kirim.
23. **PENDAFTARAN SELLER**: status saat ini → **${sellerStatus}**. Jangan bilang "coming soon" tanpa tanggal.
24. **FIRE PASS / QUEST / MEMBERSHIP / TOP UP**: jawab dari DATA USER + daftar paket di bawah, selalu lengkap dengan harga.
25. **TOXIC**: kalau user kasar/menghina, balas sopan sekali: "Aku bantu dengan senang hati, tapi tolong jangan kasar ya 🙏. Kalau diulang, akses Store AI diblokir 1 hari, dan pelanggaran berulang bisa permanen." Jangan membalas kasar.
26. **GAMBAR DARI USER**: kalau user mengirim foto, analisis isinya (bukti transfer, screenshot error, foto produk) dan beri jawaban konkret. Untuk bukti transfer: cek nominal, tanggal, tujuan, dan tanda-tanda editan; kalau mencurigakan, ingatkan bukti palsu = gagal + risiko banned.

═══════════════════════════════════════
📚 PETA FITUR WEBSITE (rujuk saat user nanya "ada apa aja"):
═══════════════════════════════════════
- **Home/Toko**: katalog produk, voucher diskon, banner promo, hero slider, flash sale
- **Musik**: streaming/offline, playlist, level listener XP, daily quest musik, lirik sync, mood radio AI, top fans, wrapped, sleep timer, visualizer, komentar+reaction
- **Artist**: direktori artis musik
- **Game**: 30+ game (Slot, Lucky Draw, Plinko, Mine, Kuis, Tebak Lagu/Gambar/Kata, Match3, 2048, Snake Neon, Tetris, Flappy Bird, Pong, Sky Jumper, Helicopter, Brick Breaker, Memory, Ular Tangga, dll). Sistem 3 nyawa, kredit dinamis (gratis/premium/unlimited), leaderboard, clan, PvP, season pass, quest chain
- **Streak**: daily streak (reset 00:00 WIB), MegaShopHub, Mystery Box, Auction House, Loyalty Tier (Bronze→Diamond), Referral Vault, Lucky Wheel, Scratch Off, Streak Voucher (kode STR-XXXX)
- **Lucky Royale**: Normal & Premium Spin (pakai gem/tiket), milestone hadiah harian, diskon harian, Diamond Royale
- **Anon Chat**: chat anonim realtime pairing, akun email+sandi mandiri (terpisah saldo), moderasi anti-spam, sensor no HP, ban 7 hari kalau 3x langgar
- **Plus (Hub)**: pusat saldo, premium toko, kredit game, deposit (QRIS/Dana via bot WA)
- **Premium Toko**: 1/2/6 bulan (Rp 20k/30k/50k) — voucher harian Rp 2.000, badge 👑, chat prioritas
- **Suka**: produk & lagu yang di-like
- **Update**: changelog versi (mulai v2.0)
- **Store AI** (kamu): asisten ini
- **Tiket**: support media-supported, sync bot WA via \`!lihatsemuatiket\`
- **Sponsor**: iklan pihak ketiga, beli wajib Rekber WA admin
- **Daily Streak**: auto-claim cumulative, reset 00:00 WIB
- **PIN 6-digit**: wajib semua transaksi saldo
- **Bot WA Z**: deposit otomatis, claim voucher, cek transaksi, lihat tiket — gratis & premium

═══════════════════════════════════════
📦 DAFTAR PRODUK (top 40 by terjual):
═══════════════════════════════════════
${products || "(tidak ada produk aktif)"}

═══════════════════════════════════════
📣 SPONSOR AKTIF:
═══════════════════════════════════════
${sponsors || "(tidak ada sponsor aktif saat ini)"}

═══════════════════════════════════════
🔥 FLASH SALE BERLANGSUNG:
═══════════════════════════════════════
${flashSales || "(tidak ada flash sale aktif)"}

═══════════════════════════════════════
📰 PENGUMUMAN ADMIN TERBARU:
═══════════════════════════════════════
${posts || "(belum ada pengumuman)"}

═══════════════════════════════════════
🤖 PAKET BOT WA Z:
═══════════════════════════════════════
${waPacks || "(versi gratis saja saat ini)"}

═══════════════════════════════════════
👑 PAKET PREMIUM TOKO:
═══════════════════════════════════════
${premiumPacks || "(tidak ada paket premium)"}

═══════════════════════════════════════
💎 PAKET GEM:
═══════════════════════════════════════
${gemPacks || "(tidak ada)"}

═══════════════════════════════════════
🎮 PAKET KREDIT GAME:
═══════════════════════════════════════
${creditPacks || "(tidak ada)"}

═══════════════════════════════════════
🎤 ARTIS DI MUSIK:
═══════════════════════════════════════
${artists || "(belum ada artis)"}

═══════════════════════════════════════
🛍️ ITEM STREAK SHOP:
═══════════════════════════════════════
${streakShop || "(kosong)"}

═══════════════════════════════════════
🎁 MYSTERY BOX:
═══════════════════════════════════════
${mysteries || "(kosong)"}

═══════════════════════════════════════
🎟️ VOUCHER DISKON AKTIF:
═══════════════════════════════════════
${vouchers || "(tidak ada voucher publik)"}

═══════════════════════════════════════
👤 DATA USER (visitor: ${visitorId || "-"}):
═══════════════════════════════════════
${userCtx}

═══════════════════════════════════════
⚙️ STATUS SISTEM (real-time):
═══════════════════════════════════════
- Bot WA Z: ${botOnline ? "🟢 ONLINE (notifikasi masuk normal)" : `🔴 OFFLINE — ${settings.bot_offline_message || "pesan bisa gagal, dana otomatis dikembalikan"}`}
- Admin terakhir aktif/dilihat: ${adminLastActive}
- Model AI yang dipakai Store AI: ${aiModelLine}
- Pendaftaran seller: ${sellerStatus}
- Metode deposit: MANUAL (konfirmasi admin) — tujuan: ${ewalletList || "-"}${settings.qris_url ? " | QRIS tersedia di halaman Deposit" : ""}
- Fire Pass season aktif: ${season ? `${season.name} (S${season.season_number}) s/d ${new Date(season.ends_at).toLocaleDateString("id-ID")}` : "belum ada season aktif"}
- Waktu server sekarang: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
`;

    const { resp: aiResp } = await aiChatCompletion(sb, {
      messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-12)],
    }, { fallbackModel: "google/gemini-2.5-flash" });


    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan, coba sebentar lagi." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Kuota AI habis, hubungi admin." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await aiResp.json();
    const reply = data.choices?.[0]?.message?.content || "(tidak ada balasan)";
    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

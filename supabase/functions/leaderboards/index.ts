import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIT = 20;
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 menit dianggap masih aktif

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Peta visitor_id -> { username, phone } dari akun saldo
    const { data: users } = await admin
      .from("user_balances")
      .select("visitor_id, username, phone, balance, bonus_balance, updated_at, last_seen_at, created_at");
    const userMap = new Map<string, { username: string; phone: string }>();
    (users || []).forEach((u: any) => {
      userMap.set(u.visitor_id, { username: u.username || "Pengguna", phone: u.phone || "" });
    });
    const ident = (vid: string) =>
      userMap.get(vid) || { username: "Pengguna", phone: "" };

    // 1) Top Deposit (status approved)
    const { data: deposits } = await admin
      .from("deposits")
      .select("visitor_id, username, amount, status")
      .eq("status", "approved");
    const depAgg = new Map<string, { username: string; value: number }>();
    (deposits || []).forEach((d: any) => {
      const cur = depAgg.get(d.visitor_id) || { username: d.username || ident(d.visitor_id).username, value: 0 };
      cur.value += Number(d.amount) || 0;
      depAgg.set(d.visitor_id, cur);
    });
    const topDeposit = [...depAgg.entries()]
      .map(([vid, v]) => ({ visitor_id: vid, username: ident(vid).username || v.username, phone: ident(vid).phone, value: v.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, LIMIT);

    // 2) Top Order User (jumlah pembelian)
    const { data: purchases } = await admin
      .from("balance_transactions")
      .select("visitor_id, product_id, type")
      .eq("type", "purchase");
    const ordAgg = new Map<string, number>();
    (purchases || []).forEach((p: any) => {
      ordAgg.set(p.visitor_id, (ordAgg.get(p.visitor_id) || 0) + 1);
    });
    const topOrderUser = [...ordAgg.entries()]
      .map(([vid, count]) => ({ visitor_id: vid, username: ident(vid).username, phone: ident(vid).phone, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, LIMIT);

    // 3) Top Order Produk (produk terlaris)
    const { data: products } = await admin
      .from("products")
      .select("id, title, sold_count, image_url")
      .order("sold_count", { ascending: false })
      .limit(LIMIT);
    const topOrderProduk = (products || []).map((p: any) => ({
      title: p.title || "Produk",
      image_url: p.image_url || null,
      value: Number(p.sold_count) || 0,
    }));

    // 4) Top Saldo Tersedia
    const topSaldo = (users || [])
      .map((u: any) => ({
        visitor_id: u.visitor_id,
        username: u.username || "Pengguna",
        phone: u.phone || "",
        value: (Number(u.balance) || 0) + (Number(u.bonus_balance) || 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, LIMIT);

    // 5) Top Kredit
    const { data: credits } = await admin
      .from("user_game_credits")
      .select("visitor_id, credits")
      .order("credits", { ascending: false })
      .limit(LIMIT);
    const topKredit = (credits || []).map((c: any) => ({
      visitor_id: c.visitor_id,
      username: ident(c.visitor_id).username,
      phone: ident(c.visitor_id).phone,
      value: Number(c.credits) || 0,
    }));

    // 6) Top Saldo IN (game balance)
    const { data: gbal } = await admin
      .from("game_balance")
      .select("visitor_id, amount")
      .order("amount", { ascending: false })
      .limit(LIMIT);
    const topSaldoIn = (gbal || []).map((g: any) => ({
      visitor_id: g.visitor_id,
      username: ident(g.visitor_id).username,
      phone: ident(g.visitor_id).phone,
      value: Number(g.amount) || 0,
    }));

    // 7) Top Gem
    const { data: gems } = await admin
      .from("game_profiles")
      .select("visitor_id, gems")
      .order("gems", { ascending: false })
      .limit(LIMIT);
    const topGem = (gems || []).map((g: any) => ({
      visitor_id: g.visitor_id,
      username: ident(g.visitor_id).username,
      phone: ident(g.visitor_id).phone,
      value: Number(g.gems) || 0,
    }));

    // 8) Top Aktif (paling baru aktif / online) — pakai last_seen_at (presence
    // real saat aplikasi terbuka), fallback ke updated_at bila belum ada.
    const now = Date.now();
    const presenceIso = (u: any) => u.last_seen_at || u.updated_at || null;
    const topAktif = (users || [])
      .filter((u: any) => presenceIso(u))
      .map((u: any) => {
        const ts = new Date(presenceIso(u)).getTime();
        return {
          visitor_id: u.visitor_id,
          username: u.username || "Pengguna",
          phone: u.phone || "",
          value: ts,
          online: now - ts <= ONLINE_WINDOW_MS,
          last_active: presenceIso(u),
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, LIMIT);

    // 9) Top Streak
    const { data: streaks } = await admin
      .from("daily_streaks")
      .select("visitor_id, current_streak, longest_streak")
      .order("current_streak", { ascending: false })
      .limit(LIMIT);
    const topStreak = (streaks || []).map((s: any) => ({
      visitor_id: s.visitor_id,
      username: ident(s.visitor_id).username,
      phone: ident(s.visitor_id).phone,
      value: Number(s.current_streak) || 0,
      longest: Number(s.longest_streak) || 0,
    }));

    // 10) Top Mendengarkan Musik
    const { data: music } = await admin
      .from("music_listener_xp")
      .select("visitor_id, total_seconds, level")
      .order("total_seconds", { ascending: false })
      .limit(LIMIT);
    const topMusik = (music || []).map((m: any) => ({
      visitor_id: m.visitor_id,
      username: ident(m.visitor_id).username,
      phone: ident(m.visitor_id).phone,
      value: Number(m.total_seconds) || 0,
      level: m.level || "",
    }));

    // 11) Top Level Game
    const { data: levels } = await admin
      .from("game_levels")
      .select("visitor_id, level, total_points")
      .order("level", { ascending: false })
      .order("total_points", { ascending: false })
      .limit(LIMIT);
    const topLevelGame = (levels || []).map((g: any) => ({
      visitor_id: g.visitor_id,
      username: ident(g.visitor_id).username,
      phone: ident(g.visitor_id).phone,
      value: Number(g.level) || 1,
      longest: Number(g.total_points) || 0,
    }));

    const totalUsers = (users || []).length;

    // 12) Semua Pengguna (online/offline) — daftar lengkap urut online dulu lalu aktivitas terbaru
    const joinedMap = new Map<string, string | null>();
    (users || []).forEach((u: any) => joinedMap.set(u.visitor_id, u.created_at || null));
    const allUsers = (users || [])
      .map((u: any) => {
        const iso = presenceIso(u);
        const ts = iso ? new Date(iso).getTime() : 0;
        return {
          visitor_id: u.visitor_id,
          username: u.username || "Pengguna",
          phone: u.phone || "",
          value: ts,
          online: ts > 0 && now - ts <= ONLINE_WINDOW_MS,
          last_active: iso,
          joined_at: u.created_at || null,
        };
      })
      .sort((a, b) => (Number(b.online) - Number(a.online)) || (b.value - a.value));
    const onlineCount = allUsers.filter((u) => u.online).length;
    const offlineCount = totalUsers - onlineCount;

    // 12b) Top Premium — member premium toko aktif (urut exp terlama)
    const nowIso = new Date().toISOString();
    const { data: premiumSubs } = await admin
      .from("store_premium_subscriptions")
      .select("visitor_id, plan_name, price_paid, starts_at, expires_at, is_active, created_at")
      .eq("is_active", true)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false });
    const premiumSeen = new Set<string>();
    const topPremium = (premiumSubs || [])
      .filter((p: any) => {
        if (!p.visitor_id || premiumSeen.has(p.visitor_id)) return false;
        premiumSeen.add(p.visitor_id);
        return true;
      })
      .map((p: any) => {
        const id = ident(p.visitor_id);
        return {
          visitor_id: p.visitor_id,
          username: id.username,
          phone: id.phone,
          value: new Date(p.expires_at).getTime(),
          plan_name: p.plan_name || "Premium",
          starts_at: p.starts_at || p.created_at,
          expires_at: p.expires_at,
        };
      });

    // 13) Status Akun — tampilkan akun banned dan tidak banned + riwayat pelanggaran
    const maskName = (n: string) => {
      const s = (n || "").trim();
      if (!s) return "•••";
      if (s.length <= 2) return s[0] + "•••";
      return s.slice(0, 2) + "•••" + s.slice(-1);
    };
    const maskPhone = (p: string) => {
      const s = (p || "").trim();
      if (!s) return "-";
      if (s.length <= 4) return "••••";
      return s.slice(0, 3) + "••••" + s.slice(-2);
    };

    const { data: bans } = await admin
      .from("account_bans")
      .select("visitor_id, reason, is_permanent, banned_until, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    const activeBanMap = new Map<string, any>();
    (bans || []).forEach((b: any) => {
      if (!activeBanMap.has(b.visitor_id)) activeBanMap.set(b.visitor_id, b);
    });

    const { data: banHistory } = await admin
      .from("account_bans")
      .select("visitor_id, reason, created_at")
      .order("created_at", { ascending: false });
    const banHistoryMap = new Map<string, { count: number; last_reason: string; last_at: string | null }>();
    (banHistory || []).forEach((b: any) => {
      const cur = banHistoryMap.get(b.visitor_id) || { count: 0, last_reason: "", last_at: null };
      cur.count += 1;
      if (!cur.last_reason) cur.last_reason = b.reason || "";
      if (!cur.last_at) cur.last_at = b.created_at || null;
      banHistoryMap.set(b.visitor_id, cur);
    });

    // Riwayat pelanggaran per visitor (jumlah)
    const { data: viols } = await admin
      .from("chat_violations")
      .select("visitor_id, kind, detail, created_at")
      .order("created_at", { ascending: false });
    const violMap = new Map<string, { count: number; last_kind: string; last_detail: string; last_at: string | null }>();
    (viols || []).forEach((v: any) => {
      const cur = violMap.get(v.visitor_id) || { count: 0, last_kind: "", last_detail: "", last_at: null };
      cur.count += 1;
      if (!cur.last_kind) cur.last_kind = v.kind || "";
      if (!cur.last_detail) cur.last_detail = v.detail || "";
      if (!cur.last_at) cur.last_at = v.created_at || null;
      violMap.set(v.visitor_id, cur);
    });

    const { data: commentRestrictions } = await admin
      .from("comment_restrictions")
      .select("visitor_id, violation_count, last_reason, updated_at")
      .gt("violation_count", 0)
      .order("updated_at", { ascending: false });
    (commentRestrictions || []).forEach((v: any) => {
      const cur = violMap.get(v.visitor_id) || { count: 0, last_kind: "", last_detail: "", last_at: null };
      cur.count += Number(v.violation_count) || 0;
      if (!cur.last_kind) cur.last_kind = "comment";
      if (!cur.last_detail) cur.last_detail = v.last_reason || "Pembatasan komentar";
      if (!cur.last_at) cur.last_at = v.updated_at || null;
      violMap.set(v.visitor_id, cur);
    });

    const bannedUsers = allUsers
      .map((u: any) => {
        const b = activeBanMap.get(u.visitor_id);
        const id = ident(u.visitor_id);
        const vc = violMap.get(u.visitor_id);
        const bh = banHistoryMap.get(u.visitor_id);
        const total = vc?.count || bh?.count || 1;
        const order = total <= 1 ? "pertama" : total === 2 ? "kedua" : total === 3 ? "ketiga" : `ke-${total}`;
        const hasHistory = (vc?.count || 0) > 0 || (bh?.count || 0) > 0;
        return {
          visitor_id: u.visitor_id,
          username: maskName(id.username),
          phone: maskPhone(id.phone),
          value: b ? 2 : hasHistory ? 1 : 0,
          is_banned: !!b,
          was_banned: !!bh,
          ban_count: bh?.count || 0,
          is_permanent: !!b?.is_permanent,
          banned_until: b?.banned_until || null,
          reason: b?.reason || bh?.last_reason || "",
          violation_count: vc?.count || 0,
          violation_order: vc ? order : "",
          violation_kind: vc?.last_kind || "",
          violation_detail: vc?.last_detail || "",
          last_violation_at: vc?.last_at || bh?.last_at || null,
          created_at: b?.created_at || vc?.last_at || bh?.last_at || u.last_active,
        };
      })
      .sort((a: any, b: any) => b.value - a.value || (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));

    // Hanya tampilkan entri yang benar-benar terdaftar di semua papan
    const onlyRegistered = <T extends { visitor_id?: string }>(arr: T[]) =>
      arr.filter((r) => r.visitor_id && userMap.has(r.visitor_id));


    return Response.json(
      {
        totalUsers,
        onlineCount,
        offlineCount,
        topDeposit: onlyRegistered(topDeposit),
        topOrderUser: onlyRegistered(topOrderUser),
        topOrderProduk,
        topSaldo: onlyRegistered(topSaldo),
        topKredit: onlyRegistered(topKredit),
        topSaldoIn: onlyRegistered(topSaldoIn),
        topGem: onlyRegistered(topGem),
        topAktif: onlyRegistered(topAktif),
        topStreak: onlyRegistered(topStreak),
        topMusik: onlyRegistered(topMusik),
        topLevelGame: onlyRegistered(topLevelGame),
        allUsers,
        topPremium: onlyRegistered(topPremium),
        bannedUsers,
        generated_at: new Date().toISOString(),
      },
      { headers: corsHeaders },
    );


  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders });
  }
});

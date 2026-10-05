// WhatsApp user gateway — fitur website existing yang belum ada di Bot WA.
// Semua op memakai visitor_id sesi login bot (dari server bot), bukan ID dari teks user.
// Hanya memanggil function/tabel yang sudah dipakai komponen website (tanpa sistem baru).

type Sb = any;
const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const clip = (s: string, n: number) => (s || "").length > n ? s.slice(0, n - 1) + "…" : (s || "");
const errText = (d: any, fb = "❌ Terjadi kesalahan. Coba lagi.") => "❌ " + clip(String(d?.error || d?.message || fb).replace(/^❌\s*/, ""), 200);

async function callFn(name: string, body: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !j?.error, status: r.status, data: j };
}

const LOCKS = new Map<string, number>();
const lock = (k: string, ms = 10000) => { const n = Date.now(); const t = LOCKS.get(k); if (t && n - t < ms) return false; LOCKS.set(k, n); return true; };
const reward = (q: any) => [q.reward_saldo_in ? `${rp(q.reward_saldo_in)} saldo IN` : "", q.reward_gems ? `${q.reward_gems} gem` : "", q.reward_coins ? `${q.reward_coins} koin` : "", q.reward ? rp(q.reward) : ""].filter(Boolean).join(" + ") || "-";
const short = (id: string) => String(id || "").slice(0, 8);

async function findOrder(sb: Sb, vid: string, code: string) {
  const c = String(code || "").replace(/^#/, "").trim();
  if (!c) return null;
  const { data } = await sb.from("seller_orders").select("*").eq("buyer_visitor_id", vid).order("created_at", { ascending: false }).limit(200);
  const up = c.toUpperCase();
  return (data || []).find((o: any) => String(o.order_code || "").toUpperCase() === up || String(o.order_number || "") === c || String(o.id).startsWith(c.toLowerCase())) || null;
}

function questList(title: string, quests: any[], progress: any[], claimCmd: string) {
  if (!quests.length) return `${title}\nBelum ada quest aktif.`;
  const rows = quests.slice(0, 10).map((q: any) => {
    const p = q.progress && typeof q.progress === "object" ? q.progress : (progress || []).find((x: any) => x.quest_id === q.id || x.challenge_id === q.id) || {};
    const cur = Number(p.current_value ?? q.current_value ?? 0), tgt = Number(q.target_value || 1);
    const claimed = !!(p.claimed_at || p.is_claimed || q.is_claimed), done = !!(p.is_completed || q.is_completed || cur >= tgt);
    const st = claimed ? "✅ Diklaim" : done ? `🎁 Siap klaim → ${claimCmd} ${short(q.id)}` : `⏳ ${Math.min(cur, tgt)}/${tgt}`;
    return `• ${clip(q.title || "-", 50)}\n   🎁 ${reward(q)} • ${st}`;
  });
  return `${title}\n${rows.join("\n")}`;
}

async function questData(sb: Sb, vid: string, kind: string) {
  if (kind === "harian") {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    const [{ data: qs }, { data: pr }] = await Promise.all([
      sb.from("daily_challenges").select("*").eq("is_active", true).order("sort_order"),
      sb.from("daily_challenge_progress").select("*").eq("visitor_id", vid).eq("challenge_date", today),
    ]);
    return { quests: qs || [], progress: pr || [] };
  }
  const fn = kind === "mingguan" ? "weekly-quest" : kind === "bulanan" ? "monthly-quest" : "premium-quest";
  const r = await callFn(fn, { action: "status", visitorId: vid });
  return { quests: r.data?.quests || [], progress: r.data?.progress || [], extra: r.data };
}
async function claimQuest(kind: string, vid: string, id: string) {
  if (kind === "harian") return callFn("check-daily-challenge", { visitorId: vid, claimChallengeId: id });
  const fn = kind === "mingguan" ? "weekly-quest" : kind === "bulanan" ? "monthly-quest" : "premium-quest";
  return callFn(fn, { action: "claim", visitorId: vid, questId: id });
}
const KINDS = ["harian", "mingguan", "bulanan", "premium"];

export async function handleWaUserExtra(sb: Sb, op: string, body: any, vid: string): Promise<any | null> {
  const need = () => ({ text: "🔒 Login dulu: !login [user/email/hp] [password]" });
  const args: string[] = Array.isArray(body.args) ? body.args.map((a: any) => String(a).slice(0, 300)).slice(0, 20) : [];
  const sub = (args[0] || "").toLowerCase();

  // ───── Referral (store-referral, sama dengan ReferralCard) ─────
  if (op === "referral") {
    if (!vid) return need();
    if (sub === "redeem" || sub === "tukar" || sub === "pakai") {
      if (!args[1]) return { text: "⚠️ Format: !referral redeem KODE" };
      if (!lock("ref:" + vid)) return { text: "⏳ Sedang diproses, tunggu sebentar." };
      const r = await callFn("store-referral", { action: "redeem", visitorId: vid, code: args[1].toUpperCase() });
      return { text: r.data?.success ? `🎉 Berhasil! Saldo IN ${rp(r.data.reward)} masuk ke akunmu.` : errText(r.data) };
    }
    const r = await callFn("store-referral", { action: "get", visitorId: vid });
    const d = r.data;
    if (!d?.code) return { text: errText(d, "Referral belum tersedia.") };
    const share = `Yuk belanja di Agung Adi Store! Pakai kode referral aku "${d.code}" biar kita berdua dapat saldo IN ${rp(d.reward)} 💰`;
    return { text: [`👥 *REFERRAL*`, ``, `Kode: *${d.code}*`, `Teman diajak: *${d.uses_count || 0}*`, `Total reward: *${rp(d.total_reward)}*`, `Reward per referral: *${rp(d.reward)}*`, `Status: ${d.already_redeemed ? "Sudah pernah pakai kode teman" : "Belum pakai kode teman → !referral redeem KODE"}`, ``, `📋 Teks ajakan (salin & bagikan):`, share].join("\n") };
  }

  // ───── Wishlist (tabel product_wishlist, sama dengan Wishlist.tsx) ─────
  if (op === "wishlist") {
    if (!vid) return need();
    if (sub === "add" || sub === "tambah" || sub === "remove" || sub === "hapus") {
      const q = (args[1] || "").toLowerCase();
      if (!q) return { text: `⚠️ Format: !wishlist ${sub} ID_PRODUK` };
      const { data: prods } = await sb.from("products").select("id,title,price,stock").limit(1000);
      const p = (prods || []).find((x: any) => String(x.id).toLowerCase().startsWith(q));
      if (!p) return { text: "❌ Produk tidak ditemukan. Lihat ID di !produk / !detailproduk." };
      if (sub === "add" || sub === "tambah") {
        const { data: ex } = await sb.from("product_wishlist").select("id").eq("visitor_id", vid).eq("product_id", p.id).maybeSingle();
        if (ex) return { text: "ℹ️ Produk sudah ada di wishlist." };
        const { error } = await sb.from("product_wishlist").insert({ visitor_id: vid, product_id: p.id, last_price: p.price, last_stock: p.stock });
        return { text: error ? "❌ Gagal menambah wishlist." : `❤️ *${clip(p.title, 50)}* ditambahkan. Kamu dikabari saat harga turun / restock.` };
      }
      await sb.from("product_wishlist").delete().eq("visitor_id", vid).eq("product_id", p.id);
      return { text: `🗑️ *${clip(p.title, 50)}* dihapus dari wishlist.` };
    }
    const { data: rows } = await sb.from("product_wishlist").select("product_id,last_price,notify_price_drop,notify_restock").eq("visitor_id", vid).order("created_at", { ascending: false }).limit(20);
    if (!rows?.length) return { text: "❤️ *WISHLIST*\nBelum ada produk. Tambah: !wishlist add ID_PRODUK" };
    const { data: prods } = await sb.from("products").select("id,title,price,stock").in("id", rows.map((r: any) => r.product_id));
    const list = rows.map((r: any, i: number) => {
      const p = (prods || []).find((x: any) => x.id === r.product_id);
      if (!p) return `${i + 1}. (produk sudah dihapus)`;
      const drop = r.last_price && p.price < r.last_price ? ` 📉 turun dari ${rp(r.last_price)}` : "";
      return `${i + 1}. ${clip(p.title, 50)}\n   💰 ${rp(p.price)}${drop} • 📦 Stok ${p.stock}\n   🆔 ${short(p.id)} • 🔔 ${r.notify_price_drop !== false ? "harga" : ""}${r.notify_restock !== false ? " restock" : ""}`;
    });
    return { text: `❤️ *WISHLIST*\n\n${list.join("\n\n")}\n\n!wishlist remove ID • !beli ID` };
  }

  // ───── Roda Diskon (discount-spin, sama dengan DiscountWheelTab) ─────
  if (op === "rodadiskon") {
    if (!vid) return need();
    if (sub === "spin") {
      if (!lock("wheel:" + vid, 5000)) return { text: "⏳ Tunggu sebentar." };
      const r = await callFn("discount-spin", { action: "spin", visitorId: vid });
      if (!r.ok) return { text: errText(r.data) };
      return { text: `🎡 Roda berhenti di *diskon ${r.data.currentDiscount}%*!\nGem tersisa: ${r.data.gems}\nLihat hadiah: !rodadiskon hadiah (pembelian hadiah di website)` };
    }
    if (sub === "klaim") {
      if (!args[1]) return { text: "⚠️ Format: !rodadiskon klaim [jumlah beli milestone] (lihat !rodadiskon)" };
      if (!lock("wheelc:" + vid)) return { text: "⏳ Tunggu sebentar." };
      const r = await callFn("discount-spin", { action: "claim_milestone", visitorId: vid, milestoneCount: Number(args[1]) });
      return { text: r.ok ? "🎁 Hadiah milestone berhasil diklaim!" : errText(r.data) };
    }
    const r = await callFn("discount-spin", { action: "state", visitorId: vid });
    const d = r.data;
    if (!r.ok) return { text: errText(d) };
    if (sub === "hadiah") {
      const items = (d.items || []).slice(0, 8).map((it: any, i: number) => `${i + 1}. ${clip(it.name || it.title || "-", 40)} — ${rp(it.price ?? it.final_price)}`);
      return { text: `🎁 *HADIAH DISKON ${d.currentDiscount || 0}%*\n${items.join("\n") || "Spin dulu untuk membuka hadiah."}\n\nPembelian hadiah dilakukan di website (butuh konfirmasi).` };
    }
    const ms = (d.milestones || []).map((m: any) => `• Beli ${m.count}: ${(d.claimedMilestones || []).includes(m.count) ? "✅" : (d.totalBought || 0) >= m.count ? "🎁 !rodadiskon klaim " + m.count : "🔒"}`).join("\n");
    return { text: [`🎡 *RODA DISKON*`, ``, `Status: ${d.wheelActive === false ? "⛔ " + (d.wheelNote || "Tidak aktif") : "🟢 Aktif"}`, `Gem: *${d.gems}* • Biaya spin: ${d.nextSpinCost} gem`, `Diskon aktif: *${d.currentDiscount || 0}%*`, `Sisa diskon: ${(d.remainingDiscounts || []).join("%, ")}%`, `Total pembelian: ${d.totalBought || 0} • Hemat ${rp(d.totalSaved)}`, `Reset: setiap hari 00.00 WIB`, ``, `🏆 Milestone:`, ms || "-", ``, `!rodadiskon spin • !rodadiskon hadiah`].join("\n") };
  }

  // ───── Quest Mission (daily_challenges, weekly/monthly/premium-quest) ─────
  if (op === "quest") {
    if (!vid) return need();
    if (sub === "klaim" || sub === "klaimsemua") {
      const all = sub === "klaimsemua";
      if (!all && !args[1]) return { text: "⚠️ Format: !quest klaim ID (lihat !quest)" };
      if (!lock("quest:" + vid, 8000)) return { text: "⏳ Sedang diproses." };
      const out: string[] = [];
      for (const k of KINDS) {
        const { quests, progress } = await questData(sb, vid, k);
        for (const q of quests) {
          if (!all && !String(q.id).startsWith(args[1].toLowerCase())) continue;
          const p = (progress || []).find((x: any) => x.quest_id === q.id || x.challenge_id === q.id) || q.progress || {};
          if (all && (!(p.is_completed || q.is_completed) || p.claimed_at || p.is_claimed || q.is_claimed)) continue;
          const r = await claimQuest(k, vid, q.id);
          out.push(r.ok ? `✅ ${clip(q.title, 40)} — ${reward(q)}` : `❌ ${clip(q.title, 40)}: ${clip(String(r.data?.error || "gagal"), 80)}`);
          if (!all) return { text: out.join("\n") };
        }
      }
      return { text: out.length ? `🎯 *KLAIM QUEST*\n${out.join("\n")}` : all ? "ℹ️ Tidak ada quest siap klaim." : "❌ Quest tidak ditemukan." };
    }
    const kinds = KINDS.includes(sub) ? [sub] : KINDS;
    const parts: string[] = [];
    for (const k of kinds) {
      const { quests, progress } = await questData(sb, vid, k);
      parts.push(questList(`*${k.toUpperCase()}*`, quests, progress, "!quest klaim"));
    }
    return { text: `🎯 *QUEST MISSION*\n\n${parts.join("\n\n")}\n\n!quest harian|mingguan|bulanan|premium • !quest klaimsemua` };
  }

  // ───── Laga Quest ─────
  if (op === "lagaquest") {
    if (!vid) return need();
    if (sub === "klaim") {
      if (!lock("laga:" + vid)) return { text: "⏳ Sedang diproses." };
      const st = await callFn("laga-quest", { action: "status", visitorId: vid });
      const qs = (st.data?.quests || []).filter((q: any) => !args[1] || String(q.id).startsWith(args[1].toLowerCase()));
      const out: string[] = [];
      for (const q of qs) {
        const p = (st.data?.progress || []).find((x: any) => x.quest_id === q.id);
        if (!p?.is_completed || p.is_claimed) continue;
        const r = await callFn("laga-quest", { action: "claim", visitorId: vid, questId: q.id });
        out.push(r.ok ? `✅ ${clip(q.title, 40)} — ${reward(q)}` : `❌ ${clip(q.title, 40)}: ${clip(String(r.data?.error || ""), 80)}`);
      }
      return { text: out.join("\n") || "ℹ️ Belum ada Laga Quest yang siap diklaim." };
    }
    const r = await callFn("laga-quest", { action: "status", visitorId: vid });
    const qs = r.data?.quests || [];
    if (!qs.length) return { text: "⚔️ *LAGA QUEST*\nBelum ada quest Laga aktif minggu ini." };
    const rows = qs.map((q: any) => {
      const p = (r.data.progress || []).find((x: any) => x.quest_id === q.id) || {};
      const end = new Date(q.active_date).getTime() + q.duration_hours * 3600000;
      const left = Math.max(0, Math.round((end - Date.now()) / 3600000));
      const st = p.is_claimed ? "✅ Diklaim" : p.is_completed ? "🎁 Siap klaim" : `⏳ ${p.current_value || 0}/${q.target_value}`;
      return `• ${clip(q.title, 50)}\n   🎁 ${reward(q)} • ${st} • ⌛ ${left} jam lagi`;
    });
    return { text: `⚔️ *LAGA QUEST*\n\n${rows.join("\n")}\n\n!lagaquest klaim` };
  }

  // ───── Store Premium (tabel yang dibaca StorePremiumTab) ─────
  if (op === "premium") {
    if (!vid) return need();
    const now = new Date().toISOString();
    const [{ data: plans }, { data: subs }] = await Promise.all([
      sb.from("store_premium_plans").select("name,duration_days,price,description").eq("is_active", true).order("sort_order"),
      sb.from("store_premium_subscriptions").select("plan_name,starts_at,expires_at,is_active,price_paid").eq("visitor_id", vid).order("created_at", { ascending: false }).limit(5),
    ]);
    const act = (subs || []).find((s: any) => s.is_active && s.expires_at > now);
    const pl = (plans || []).map((p: any) => `• *${p.name}* — ${rp(p.price)} / ${p.duration_days} hari${p.description ? `\n   ${clip(p.description, 120)}` : ""}`).join("\n");
    const hist = (subs || []).map((s: any) => `• ${s.plan_name} (${rp(s.price_paid)}) s/d ${new Date(s.expires_at).toLocaleDateString("id-ID")}`).join("\n");
    return { text: [`⭐ *STORE PREMIUM*`, ``, `Status: ${act ? `*AKTIF* (${act.plan_name}) s/d ${new Date(act.expires_at).toLocaleString("id-ID")}` : "Tidak aktif"}`, ``, `📦 Paket:`, pl || "-", ``, `🧾 Riwayat:`, hist || "-", ``, `Pembelian paket dilakukan di website (menu Premium) dengan PIN.`].join("\n") };
  }

  // ───── RuangKu (ruangku-hub) ─────
  if (op === "ruangku") {
    if (!vid) return need();
    if (sub === "klaim") {
      if (!args[1]) return { text: "⚠️ Format: !ruangku klaim KODE_MISI" };
      if (!lock("rk:" + vid)) return { text: "⏳ Sedang diproses." };
      const r = await callFn("ruangku-hub", { action: "claim_mission", visitorId: vid, missionKey: args[1] });
      return { text: r.ok ? "🎁 Misi RuangKu berhasil diklaim!" : errText(r.data) };
    }
    if (sub === "box" || sub === "kotak") {
      if (!lock("rkb:" + vid)) return { text: "⏳ Sedang diproses." };
      const r = await callFn("ruangku-hub", { action: "open_box", visitorId: vid, kind: args[1] === "bonus" ? "weekly_bonus" : "daily" });
      return { text: r.ok ? `🎁 Kotak dibuka! Hadiah: ${r.data?.reward_value ? rp(r.data.reward_value) : JSON.stringify(r.data?.reward || "-")}` : errText(r.data) };
    }
    const r = await callFn("ruangku-hub", { action: "status", visitorId: vid });
    if (!r.ok) return { text: errText(r.data) };
    const ms = (r.data.missions || []).map((m: any) => `• ${m.title} (${m.current}/${m.target}) — ${rp(m.reward)} ${m.claimed ? "✅" : m.completed ? `🎁 !ruangku klaim ${m.key}` : "⏳"}`).join("\n");
    return { text: `🏠 *RUANGKU*\n\n${ms || "-"}\n\n🎁 Kotak harian: ${r.data.dailyBoxAvailable === false ? "sudah dibuka" : "!ruangku box"}\n🎁 Bonus mingguan: !ruangku box bonus` };
  }

  // ───── Anonymous Premium (anon-premium) ─────
  if (op === "anonpremium") {
    if (!vid) return need();
    if (sub === "voucher") {
      if (!args[1]) return { text: "⚠️ Format: !anonpremium voucher KODE" };
      if (!lock("ap:" + vid)) return { text: "⏳ Sedang diproses." };
      const r = await callFn("anon-premium", { action: "redeem_voucher", visitorId: vid, billingVisitorId: vid, code: args[1] });
      return { text: r.ok ? "👑 Voucher Anon Premium berhasil ditukar!" : errText(r.data) };
    }
    const r = await callFn("anon-premium", { action: "status", visitorId: vid, billingVisitorId: vid });
    if (!r.ok) return { text: errText(r.data) };
    const d = r.data;
    const plans = (d.plans || []).map((p: any) => `• ${p.name || p.label || p.id} — ${rp(p.price)}${p.days ? ` / ${p.days} hari` : ""}`).join("\n");
    return { text: [`👑 *ANON PREMIUM*`, ``, `Status: ${d.is_premium ? `*AKTIF* (${d.plan_name}) s/d ${new Date(d.expires_at).toLocaleString("id-ID")}` : "Tidak aktif"}`, `Saldo: ${rp(d.balance)} • Gem: ${d.gems}`, ``, `Paket:`, plans || "-", ``, `!anonpremium voucher KODE`, `Pembelian & hadiah (gift) premium dilakukan di website dengan PIN.`].join("\n") };
  }

  // ───── Keranjang marketplace (seller-shop buyer_cart / buyer_data) ─────
  if (op === "cart") {
    if (!vid) return need();
    if (sub === "tambah" || sub === "hapus") {
      const q = (args[1] || "").toLowerCase();
      if (!q) return { text: `⚠️ Format: !keranjang ${sub} ID_PRODUK${sub === "tambah" ? " [qty]" : ""}` };
      const { data: prods } = await sb.from("seller_products").select("id,title,product_number").eq("status", "approved").eq("is_active", true).is("archived_at", null).limit(1000);
      const p = (prods || []).find((x: any) => String(x.id).startsWith(q) || String(x.product_number || "").toLowerCase() === q);
      if (!p) return { text: "❌ Produk marketplace tidak ditemukan." };
      const qty = sub === "hapus" ? 0 : Math.max(1, Math.min(99, Number(args[2]) || 1));
      const r = await callFn("seller-shop", { action: "buyer_cart", visitorId: vid, productId: p.id, qty });
      return { text: r.ok ? (qty ? `🛒 ${clip(p.title, 50)} ×${qty} masuk keranjang.` : `🗑️ ${clip(p.title, 50)} dihapus dari keranjang.`) : errText(r.data) };
    }
    const r = await callFn("seller-shop", { action: "buyer_data", visitorId: vid });
    if (!r.ok) return { text: errText(r.data) };
    const cart = r.data.cart || [];
    if (sub === "kosong") {
      for (const c of cart) await callFn("seller-shop", { action: "buyer_cart", visitorId: vid, productId: c.product_id, qty: 0 });
      return { text: "🧹 Keranjang dikosongkan." };
    }
    if (!cart.length) return { text: "🛒 *KERANJANG*\nMasih kosong. Tambah: !keranjang tambah ID_PRODUK" };
    const { data: prods } = await sb.from("seller_products").select("id,title,price,promo_price,stock,store_id").in("id", cart.map((c: any) => c.product_id));
    let total = 0;
    const rows = cart.map((c: any, i: number) => {
      const p = (prods || []).find((x: any) => x.id === c.product_id);
      const price = Number(p?.promo_price || p?.price || 0); const sub2 = price * c.qty; total += sub2;
      return `${i + 1}. ${clip(p?.title || "-", 45)} ×${c.qty}\n   ${rp(price)} = ${rp(sub2)} • 🆔 ${short(c.product_id)}`;
    });
    return { text: `🛒 *KERANJANG*\n\n${rows.join("\n")}\n\n💰 Total: *${rp(total)}* (belum termasuk biaya layanan)\n\n!keranjang hapus ID • !keranjang kosong\nCheckout dilakukan di website (1 toko per checkout, dengan PIN).` };
  }

  // ───── Pesanan: aksi pembeli (seller-shop confirm / buyer_cancel) ─────
  if (op === "order_action") {
    if (!vid) return need();
    const o = await findOrder(sb, vid, args[1]);
    if (!o) return { text: "❌ Pesanan tidak ditemukan (hanya pesanan milikmu)." };
    if (sub === "detail") {
      const { data: d } = await sb.from("seller_disputes").select("status").eq("order_id", o.id).maybeSingle();
      return { text: [`📦 *#${o.order_code || o.order_number}*`, `🛍️ ${o.product_title} ×${o.qty}`, `🏪 ${o.store_name || "-"}`, `💰 ${rp(o.grand_total ?? o.total)}`, `📌 ${o.status} • escrow ${o.escrow_status || "-"}`, `🕒 ${new Date(o.created_at).toLocaleString("id-ID")}`, o.tracking_number ? `🚚 ${o.courier || "Kurir"} • Resi ${o.tracking_number}` : "", o.shipping_note ? `📝 ${clip(o.shipping_note, 200)}` : "", d ? `⚠️ Kendala: ${d.status}` : "", ``, `!pesanan terima KODE • !pesanan batal KODE • !dispute KODE • !review KODE 5 komentar • !orderchat KODE`].filter(Boolean).join("\n") };
    }
    if (!lock("ord:" + o.id)) return { text: "⏳ Sedang diproses." };
    const action = sub === "terima" ? "confirm" : "buyer_cancel";
    const r = await callFn("seller-shop", { action, visitorId: vid, orderId: o.id });
    return { text: r.ok ? (action === "confirm" ? "✅ Pesanan dikonfirmasi selesai." : "❌ Pesanan dibatalkan, dana dikembalikan ke saldo.") : errText(r.data) };
  }

  // ───── Review (seller-shop buyer_review) ─────
  if (op === "review") {
    if (!vid) return need();
    const o = await findOrder(sb, vid, args[0]);
    if (!o) return { text: "⚠️ Format: !review KODE_PESANAN [1-5] [komentar]" };
    const { data: rev } = await sb.from("seller_reviews").select("product_rating,comment").eq("order_id", o.id).maybeSingle();
    const rating = Number(args[1]);
    if (!rating) return { text: rev ? `⭐ Ulasanmu: ${rev.product_rating}/5\n${rev.comment || ""}` : o.status === "selesai" ? "📝 Pesanan bisa diulas: !review KODE 5 komentarmu" : "ℹ️ Ulasan bisa diberikan setelah pesanan selesai." };
    if (!lock("rev:" + o.id)) return { text: "⏳ Sedang diproses." };
    const r = await callFn("seller-shop", { action: "buyer_review", visitorId: vid, orderId: o.id, rating, comment: args.slice(2).join(" ").slice(0, 500) });
    return { text: r.ok ? "⭐ Terima kasih! Ulasan tersimpan." : errText(r.data) };
  }

  // ───── Dispute (seller-shop dispute / dispute_case / dispute_message) ─────
  if (op === "dispute") {
    if (!vid) return need();
    const o = await findOrder(sb, vid, args[0]);
    if (!o) return { text: "⚠️ Format: !dispute KODE • !dispute KODE buat alasan • !dispute KODE pesan isi" };
    const mode = (args[1] || "").toLowerCase(), text = args.slice(2).join(" ").trim();
    if (mode === "buat") {
      if (text.length < 5) return { text: "⚠️ Tulis alasan minimal 5 huruf." };
      if (!lock("disp:" + o.id)) return { text: "⏳ Sedang diproses." };
      const r = await callFn("seller-shop", { action: "dispute", visitorId: vid, orderId: o.id, reason: text.slice(0, 500), evidence: typeof body.evidence === "string" ? body.evidence : "" });
      return { text: r.ok ? "🚩 Laporan kendala terkirim, dana ditahan." : errText(r.data) };
    }
    const c = await callFn("seller-shop", { action: "dispute_case", visitorId: vid, orderId: o.id });
    if (!c.ok) return { text: errText(c.data) };
    const d = c.data.case;
    if (mode === "pesan") {
      if (!d) return { text: "ℹ️ Belum ada kasus. Buat: !dispute KODE buat alasan" };
      const r = await callFn("seller-shop", { action: "dispute_message", visitorId: vid, disputeId: d.id, message: text.slice(0, 1000) });
      return { text: r.ok ? "💬 Pesan terkirim ke kasus." : errText(r.data) };
    }
    if (!d) return { text: `ℹ️ Tidak ada kasus untuk #${o.order_code}. ${o.dispute_used ? "Laporan sudah pernah dipakai." : "Buat: !dispute KODE buat alasan"}` };
    const msgs = (c.data.messages || []).slice(-6).map((m: any) => `[${m.sender}] ${clip(m.message || "", 150)}`).join("\n");
    return { text: [`🚩 *KASUS #${o.order_code}*`, `Status: ${d.status}${d.awaiting ? ` • menunggu ${d.awaiting}` : ""}`, `Alasan: ${clip(d.reason || "-", 200)}`, d.decision ? `Keputusan: ${d.decision}` : "", ``, msgs || "Belum ada pesan.", ``, `!dispute KODE pesan isi`].filter(Boolean).join("\n") };
  }

  // ───── Order chat (sc_* RPC dipakai SellerOrderChat) ─────
  if (op === "orderchat") {
    if (!vid) return need();
    const o = await findOrder(sb, vid, args[0]);
    if (!o) return { text: "⚠️ Format: !orderchat KODE [pesan]" };
    if (!o.thread_id) return { text: "ℹ️ Pesanan ini belum punya chat dengan penjual." };
    const text = args.slice(1).join(" ").trim();
    if (text) {
      const { error } = await sb.rpc("sc_send", { p_visitor_id: vid, p_thread_id: o.thread_id, p_message: text.slice(0, 1000), p_kind: "text", p_payload: {}, p_image_url: null, p_reply_to: null, p_order_ref: o.id, p_attachment_path: null, p_attachment_name: null, p_attachment_mime: null });
      if (error) return { text: "❌ Pesan gagal dikirim." };
      return { text: "💬 Pesan terkirim ke penjual." };
    }
    const { data: msgs } = await sb.from("seller_chat_messages").select("visitor_id,sender,message,image_url,attachment_path").eq("thread_id", o.thread_id).is("deleted_at", null).order("created_at", { ascending: false }).limit(8);
    const rows = (msgs || []).reverse().map((m: any) => `${m.visitor_id === vid ? "🙋 Kamu" : m.sender === "system" ? "🤖 Sistem" : "🏪 Toko"}: ${clip(m.message || (m.image_url || m.attachment_path ? "[lampiran]" : ""), 150)}`);
    return { text: `💬 *CHAT #${o.order_code}* — ${o.store_name}\n📌 ${o.status}\n\n${rows.join("\n") || "Belum ada pesan."}\n\nBalas: !orderchat ${o.order_code} pesanmu` };
  }

  // ───── Profil toko publik ─────
  if (op === "toko") {
    const q = (args[0] || "").toLowerCase();
    if (!q) return { text: "⚠️ Format: !toko ID_TOKO / nomor toko / nama" };
    const { data: stores } = await sb.from("seller_stores").select("id,store_number,store_name,description,is_verified,is_active,is_open,rating,rating_count,total_sales,closed_note").eq("is_active", true).limit(1000);
    const s = (stores || []).find((x: any) => String(x.id).startsWith(q) || String(x.store_number || "") === q) || (stores || []).find((x: any) => String(x.store_name || "").toLowerCase().includes(q));
    if (!s) return { text: "❌ Toko tidak ditemukan." };
    const { data: prods } = await sb.from("seller_products").select("id,title,price,promo_price,stock").eq("store_id", s.id).eq("status", "approved").eq("is_active", true).is("archived_at", null).order("sold_count", { ascending: false }).limit(8);
    const { data: revs } = await sb.from("seller_reviews").select("buyer_name,product_rating,comment").eq("store_id", s.id).order("created_at", { ascending: false }).limit(3);
    return { text: [`🏪 *${s.store_name}*${s.is_verified ? " ✔️ Terverifikasi" : ""}`, `${s.is_open === false ? "🔴 Tutup" + (s.closed_note ? ` — ${clip(s.closed_note, 80)}` : "") : "🟢 Buka"}`, s.description ? clip(s.description, 200) : "", `⭐ ${Number(s.rating || 0).toFixed(1)} (${s.rating_count || 0} ulasan) • 🛍️ ${s.total_sales || 0} terjual`, ``, `📦 Produk:`, ...(prods || []).map((p: any) => `• ${clip(p.title, 45)} — ${rp(p.promo_price || p.price)} • stok ${p.stock} • 🆔 ${short(p.id)}`), ``, `💬 Ulasan terbaru:`, ...((revs || []).map((r: any) => `• ${"⭐".repeat(r.product_rating || 0)} ${clip(r.comment || "", 80)}`)), ``, `Tambah ke keranjang: !keranjang tambah ID`].filter((x) => x !== "").join("\n") };
  }

  return null;
}

// Confess social features: feed filters, wall posts, polls, replies, reports,
// special reactions, views/insight, missions and Secret Crush.
// All tables are service-role only; responses never include visitor_id / phone.
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type DB = ReturnType<typeof createClient>;
type Row = Record<string, any>;

export const SUPPORT_GEM_COST = 5;
const WALL_POSTS_PER_DAY = 5;
const MAX_CRUSH = 3;
const EMOTIONAL_MOODS = ["sedih", "rindu", "marah", "galau", "maaf", "harapan"];
const MOOD_ALIASES: Record<string, string[]> = {
  cinta: ["cinta", "crush"],
  sedih: ["sedih"],
  berani: ["berani"],
  lucu: ["lucu"],
  marah: ["marah"],
  rahasia: ["rahasia"],
  harapan: ["harapan", "terima kasih"],
  rindu: ["rindu"],
};

function wibNow() { return new Date(Date.now() + 7 * 3600 * 1000); }
export function todayKey() { return wibNow().toISOString().slice(0, 10); }
function weekKey() {
  const d = wibNow();
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return "W" + d.toISOString().slice(0, 10);
}
function dayStartIso() { return new Date(Date.parse(todayKey() + "T00:00:00+07:00")).toISOString(); }
function weekStartIso() { return new Date(Date.parse(weekKey().slice(1) + "T00:00:00+07:00")).toISOString(); }

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function notify(db: DB, visitor: string, title: string, message: string, type = "confess") {
  return db.rpc("create_notification", { p_visitor_id: visitor, p_title: title, p_message: message, p_type: type }).then(() => {}, () => {});
}

const ok = (b: unknown, headers: HeadersInit) => Response.json(b, { headers });
const bad = (msg: string, status: number, headers: HeadersInit, extra: Row = {}) => Response.json({ error: msg, ...extra }, { status, headers });

/* ---------------- Feed ---------------- */
async function buildFeed(db: DB, visitorId: string, filter: string, mood: string) {
  let q = db.from("confess_public_wall")
    .select("id, visitor_id, sender_name, masked_phone, message, mood_tag, reaction_counts, total_reactions, reply_count, support_count, view_count, is_mystery, created_at")
    .eq("is_hidden", false);
  if (filter === "mystery") q = q.eq("is_mystery", true);
  if (filter === "trending") q = q.gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString());
  const { data } = await q.order("created_at", { ascending: false }).limit(200);
  let rows = (data || []) as Row[];

  if (mood && MOOD_ALIASES[mood]) {
    const al = MOOD_ALIASES[mood];
    rows = rows.filter((r) => al.includes(String(r.mood_tag || "").toLowerCase()));
  }
  if (filter === "emotional") rows = rows.filter((r) => EMOTIONAL_MOODS.includes(String(r.mood_tag || "").toLowerCase()));

  const eng = (r: Row) => (r.total_reactions || 0) + 2 * (r.reply_count || 0) + 2 * (r.support_count || 0);
  const hours = (r: Row) => (Date.now() - Date.parse(r.created_at)) / 3600000;
  if (filter === "trending") rows.sort((a, b) => eng(b) / Math.pow(hours(b) + 2, 1.5) - eng(a) / Math.pow(hours(a) + 2, 1.5));
  else if (filter === "popular" || filter === "emotional") rows.sort((a, b) => eng(b) - eng(a) || Date.parse(b.created_at) - Date.parse(a.created_at));
  if (filter === "trending") rows = rows.filter((r) => eng(r) > 0);
  rows = rows.slice(0, 50);

  const ids = rows.map((r) => r.id);
  const [reacts, sups, polls] = ids.length ? await Promise.all([
    db.from("confess_wall_reactions").select("wall_id, emoji").eq("visitor_id", visitorId).in("wall_id", ids),
    db.from("confess_special_reactions").select("wall_id").eq("visitor_id", visitorId).in("wall_id", ids),
    db.from("confess_polls").select("id, wall_id, options").eq("is_hidden", false).in("wall_id", ids),
  ]) : [{ data: [] }, { data: [] }, { data: [] }] as any;
  const myReact = new Map((reacts.data || []).map((r: Row) => [r.wall_id, r.emoji]));
  const mySup = new Set((sups.data || []).map((r: Row) => r.wall_id));
  const pollMap = new Map<string, Row>();
  for (const p of (polls.data || []) as Row[]) pollMap.set(p.wall_id, p);
  const pollIds = [...pollMap.values()].map((p) => p.id);
  const votes: Row[] = pollIds.length ? ((await db.from("confess_poll_votes").select("poll_id, visitor_id, option_index").in("poll_id", pollIds)).data || []) : [];

  return rows.map((r) => {
    const mine = r.visitor_id === visitorId;
    const p = pollMap.get(r.id);
    let poll: Row | null = null;
    if (p) {
      const pv = votes.filter((v) => v.poll_id === p.id);
      const my = pv.find((v) => v.visitor_id === visitorId);
      const opts = (p.options as string[]) || [];
      const showResults = !!my || mine;
      poll = {
        id: p.id, options: opts, total: pv.length, my_vote: my ? my.option_index : null,
        counts: showResults ? opts.map((_, i) => pv.filter((v) => v.option_index === i).length) : null,
      };
    }
    return {
      id: r.id,
      sender_name: r.is_mystery ? null : r.sender_name,
      masked_phone: r.is_mystery ? null : r.masked_phone,
      message: r.message, mood_tag: r.mood_tag, reaction_counts: r.reaction_counts,
      total_reactions: r.total_reactions || 0, reply_count: r.reply_count || 0, support_count: r.support_count || 0,
      is_mystery: !!r.is_mystery, created_at: r.created_at,
      is_mine: mine, my_reaction: myReact.get(r.id) || null, my_support: mySup.has(r.id), poll,
      insight: mine ? { views: r.view_count || 0 } : null,
    };
  });
}

/* ---------------- Missions ---------------- */
const DAILY = [
  { key: "d_send1", label: "Kirim 1 Confess", emoji: "💌", target: 1, gems: 10, metric: "send" },
  { key: "d_react3", label: "Dapatkan 3 Reaction", emoji: "💗", target: 3, gems: 10, metric: "recv" },
  { key: "d_reply1", label: "Balas 1 Confess", emoji: "💬", target: 1, gems: 10, metric: "reply" },
  { key: "d_roulette", label: "Main Roulette", emoji: "🎲", target: 1, gems: 5, metric: "roulette" },
];
const WEEKLY = [
  { key: "w_react20", label: "Dapatkan 20 Reaction", emoji: "🔥", target: 20, gems: 30, metric: "recv" },
  { key: "w_send5", label: "Kirim 5 Confess", emoji: "💌", target: 5, gems: 30, metric: "send" },
  { key: "w_mission3", label: "Selesaikan 3 Mission", emoji: "🎯", target: 3, gems: 20, metric: "claims" },
];

async function metrics(db: DB, v: string, since: string, period: "d" | "w") {
  const cnt = async (p: PromiseLike<{ count: number | null }>) => (await p).count || 0;
  const { data: myWalls } = await db.from("confess_public_wall").select("id").eq("visitor_id", v).limit(500);
  const wallIds = (myWalls || []).map((w: Row) => w.id);
  const [sendA, sendB, recvA, recvB, reply, roulA, roulB, claims] = await Promise.all([
    cnt(db.from("confessions").select("id", { count: "exact", head: true }).eq("sender_visitor_id", v).gte("created_at", since)),
    cnt(db.from("confess_public_wall").select("id", { count: "exact", head: true }).eq("visitor_id", v).is("confession_id", null).gte("created_at", since)),
    wallIds.length ? cnt(db.from("confess_wall_reactions").select("id", { count: "exact", head: true }).in("wall_id", wallIds).neq("visitor_id", v).gte("created_at", since)) : 0,
    wallIds.length ? cnt(db.from("confess_special_reactions").select("id", { count: "exact", head: true }).in("wall_id", wallIds).gte("created_at", since)) : 0,
    cnt(db.from("confess_wall_replies").select("id", { count: "exact", head: true }).eq("visitor_id", v).gte("created_at", since)),
    cnt(db.from("confess_roulette_seen").select("id", { count: "exact", head: true }).eq("viewer_visitor_id", v).gte("created_at", since)),
    cnt(db.from("confess_roulette_posts").select("id", { count: "exact", head: true }).eq("visitor_id", v).gte("created_at", since)),
    period === "w" ? cnt(db.from("confess_mission_claims").select("id", { count: "exact", head: true }).eq("visitor_id", v).like("mission_key", "d_%").gte("created_at", since)) : 0,
  ]);
  return { send: sendA + sendB, recv: recvA + recvB, reply, roulette: roulA + roulB, claims } as Record<string, number>;
}

async function missionState(db: DB, v: string) {
  const dk = todayKey(), wk = weekKey();
  const [dm, wm, { data: claimed }] = await Promise.all([
    metrics(db, v, dayStartIso(), "d"),
    metrics(db, v, weekStartIso(), "w"),
    db.from("confess_mission_claims").select("mission_key, period_key").eq("visitor_id", v).in("period_key", [dk, wk]),
  ]);
  const isClaimed = (k: string, p: string) => (claimed || []).some((c: Row) => c.mission_key === k && c.period_key === p);
  const map = (list: typeof DAILY, m: Record<string, number>, p: string) => list.map((x) => ({
    key: x.key, label: x.label, emoji: x.emoji, target: x.target, gems: x.gems,
    progress: Math.min(x.target, m[x.metric] || 0), claimed: isClaimed(x.key, p),
  }));
  return { daily: map(DAILY, dm, dk), weekly: map(WEEKLY, wm, wk) };
}

/* ---------------- Router ---------------- */
export async function handleSocial(db: DB, action: string, body: Row, visitorId: string, headers: HeadersInit): Promise<Response | null> {
  switch (action) {
    case "feed": {
      const filter = String(body.filter || "all");
      const mood = String(body.mood || "").toLowerCase();
      return ok({ items: await buildFeed(db, visitorId, filter, mood), support_cost: SUPPORT_GEM_COST }, headers);
    }

    case "wall_post": {
      const message = String(body.message || "").trim().slice(0, 500);
      if (message.length < 3) return bad("Pesan terlalu pendek", 400, headers);
      const mood = body.mood_tag ? String(body.mood_tag).slice(0, 24) : null;
      const isMystery = !!body.is_mystery;
      const senderName = !isMystery && body.sender_name ? String(body.sender_name).slice(0, 40) : null;
      const options = Array.isArray(body.poll_options)
        ? body.poll_options.map((o: unknown) => String(o || "").trim().slice(0, 40)).filter(Boolean).slice(0, 4) : [];
      if (Array.isArray(body.poll_options) && body.poll_options.length && options.length < 2) return bad("Polling butuh minimal 2 pilihan", 400, headers);
      const { count } = await db.from("confess_public_wall").select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId).is("confession_id", null).gte("created_at", dayStartIso());
      if ((count || 0) >= WALL_POSTS_PER_DAY) return bad(`Batas ${WALL_POSTS_PER_DAY} post Wall per hari tercapai`, 429, headers);
      const { data: w, error } = await db.from("confess_public_wall").insert({
        visitor_id: visitorId, sender_name: senderName, masked_phone: "Wall", message, mood_tag: mood, is_mystery: isMystery,
      }).select("id").single();
      if (error || !w) return bad("Gagal posting", 500, headers);
      if (options.length >= 2) await db.from("confess_polls").insert({ wall_id: w.id, options });
      return ok({ ok: true, id: w.id }, headers);
    }

    case "poll_vote": {
      const pollId = String(body.poll_id || "");
      const idx = Number(body.option_index);
      const { data: p } = await db.from("confess_polls").select("id, options").eq("id", pollId).eq("is_hidden", false).maybeSingle();
      if (!p || !Number.isInteger(idx) || idx < 0 || idx >= (p.options as string[]).length) return bad("Pilihan tidak valid", 400, headers);
      const { error } = await db.from("confess_poll_votes").insert({ poll_id: pollId, visitor_id: visitorId, option_index: idx });
      const already = !!error && String(error.code) === "23505";
      if (error && !already) return bad("Gagal vote", 500, headers);
      const { data: vs } = await db.from("confess_poll_votes").select("option_index, visitor_id").eq("poll_id", pollId);
      const opts = p.options as string[];
      const my = (vs || []).find((v: Row) => v.visitor_id === visitorId);
      return ok({
        ok: !already, already, my_vote: my?.option_index ?? idx, total: (vs || []).length,
        counts: opts.map((_, i) => (vs || []).filter((v: Row) => v.option_index === i).length),
      }, headers);
    }

    case "replies_list": {
      const wallId = String(body.wall_id || "");
      const { data: w } = await db.from("confess_public_wall").select("visitor_id").eq("id", wallId).eq("is_hidden", false).maybeSingle();
      if (!w) return bad("Confess tidak ditemukan", 404, headers);
      const { data } = await db.from("confess_wall_replies").select("id, visitor_id, anon_no, message, reaction_count, created_at")
        .eq("wall_id", wallId).eq("is_hidden", false).order("created_at", { ascending: true }).limit(200);
      const ids = (data || []).map((r: Row) => r.id);
      const { data: mine } = ids.length ? await db.from("confess_reply_reactions").select("reply_id").eq("visitor_id", visitorId).in("reply_id", ids) : { data: [] };
      const mineSet = new Set((mine || []).map((r: Row) => r.reply_id));
      return ok({
        items: (data || []).map((r: Row) => ({
          id: r.id, anon_no: r.anon_no, message: r.message, reaction_count: r.reaction_count, created_at: r.created_at,
          is_author: r.visitor_id === w.visitor_id, is_mine: r.visitor_id === visitorId, my_reacted: mineSet.has(r.id),
        })),
      }, headers);
    }

    case "reply_create": {
      const wallId = String(body.wall_id || "");
      const message = String(body.message || "").trim().slice(0, 300);
      if (message.length < 1) return bad("Balasan kosong", 400, headers);
      const { data: w } = await db.from("confess_public_wall").select("id, visitor_id, reply_count").eq("id", wallId).eq("is_hidden", false).maybeSingle();
      if (!w) return bad("Confess tidak ditemukan", 404, headers);
      const { count: recent } = await db.from("confess_wall_replies").select("id", { count: "exact", head: true })
        .eq("visitor_id", visitorId).gte("created_at", new Date(Date.now() - 60000).toISOString());
      if ((recent || 0) >= 5) return bad("Terlalu cepat, tunggu sebentar", 429, headers);
      const { data: prev } = await db.from("confess_wall_replies").select("visitor_id, anon_no").eq("wall_id", wallId);
      const same = (prev || []).find((r: Row) => r.visitor_id === visitorId);
      const anonNo = same ? same.anon_no : ((prev || []).reduce((m: number, r: Row) => Math.max(m, r.anon_no), 0) + 1);
      const { error } = await db.from("confess_wall_replies").insert({ wall_id: wallId, visitor_id: visitorId, anon_no: anonNo, message });
      if (error) return bad("Gagal membalas", 500, headers);
      await db.from("confess_public_wall").update({ reply_count: (w.reply_count || 0) + 1 }).eq("id", wallId);
      if (w.visitor_id !== visitorId) await notify(db, w.visitor_id, "💬 Confess kamu dibalas!", `Anonim: "${message.slice(0, 50)}"`);
      return ok({ ok: true }, headers);
    }

    case "reply_react": {
      const replyId = String(body.reply_id || "");
      const { data: r } = await db.from("confess_wall_replies").select("id, reaction_count").eq("id", replyId).eq("is_hidden", false).maybeSingle();
      if (!r) return bad("Balasan tidak ditemukan", 404, headers);
      const { data: ex } = await db.from("confess_reply_reactions").select("id").eq("reply_id", replyId).eq("visitor_id", visitorId).maybeSingle();
      if (ex) {
        await db.from("confess_reply_reactions").delete().eq("id", ex.id);
        await db.from("confess_wall_replies").update({ reaction_count: Math.max(0, (r.reaction_count || 0) - 1) }).eq("id", replyId);
        return ok({ reacted: false }, headers);
      }
      const { error } = await db.from("confess_reply_reactions").insert({ reply_id: replyId, visitor_id: visitorId });
      if (!error) await db.from("confess_wall_replies").update({ reaction_count: (r.reaction_count || 0) + 1 }).eq("id", replyId);
      return ok({ reacted: true }, headers);
    }

    case "report": {
      const type = String(body.target_type || "");
      const id = String(body.target_id || "");
      const reason = String(body.reason || "lainnya").slice(0, 40);
      if (!["wall", "reply", "poll"].includes(type) || !id) return bad("Parameter tidak valid", 400, headers);
      const { error } = await db.from("confess_reports").insert({ target_type: type, target_id: id, reporter_visitor_id: visitorId, reason });
      if (error) return ok({ ok: true, already: true }, headers);
      if (type === "reply") {
        const { data: r } = await db.from("confess_wall_replies").select("report_count").eq("id", id).maybeSingle();
        const n = (r?.report_count || 0) + 1;
        await db.from("confess_wall_replies").update({ report_count: n, ...(n >= 5 ? { is_hidden: true } : {}) }).eq("id", id);
      } else if (type === "wall") {
        const { data: w } = await db.from("confess_public_wall").select("report_count").eq("id", id).maybeSingle();
        await db.from("confess_public_wall").update({ report_count: (w?.report_count || 0) + 1 }).eq("id", id);
      }
      return ok({ ok: true }, headers);
    }

    case "react_special": {
      const wallId = String(body.wall_id || "");
      const { data, error } = await db.rpc("confess_react_special", { p_visitor: visitorId, p_wall: wallId, p_cost: SUPPORT_GEM_COST });
      if (error) {
        const m = String(error.message || "");
        if (m.includes("insufficient_gems")) return bad(`Gem kurang. Butuh ${SUPPORT_GEM_COST} gem.`, 402, headers);
        if (m.includes("own_post")) return bad("Tidak bisa Support confess sendiri", 400, headers);
        if (m.includes("duplicate") || String(error.code) === "23505") return ok({ ok: true, already: true }, headers);
        return bad("Gagal memberi Support", 500, headers);
      }
      return ok({ ok: true, gems: data }, headers);
    }

    case "view": {
      const ids = (Array.isArray(body.wall_ids) ? body.wall_ids : []).map(String).slice(0, 50);
      for (const id of ids) {
        const h = await sha(visitorId + ":" + id);
        const { error } = await db.from("confess_wall_views").insert({ wall_id: id, viewer_hash: h });
        if (!error) {
          const { data: w } = await db.from("confess_public_wall").select("view_count, visitor_id").eq("id", id).maybeSingle();
          if (w && w.visitor_id !== visitorId) await db.from("confess_public_wall").update({ view_count: (w.view_count || 0) + 1 }).eq("id", id);
        }
      }
      return ok({ ok: true }, headers);
    }

    case "missions":
      return ok(await missionState(db, visitorId), headers);

    case "mission_claim": {
      const key = String(body.mission_key || "");
      const st = await missionState(db, visitorId);
      const all = [...st.daily.map((m) => ({ ...m, period: todayKey() })), ...st.weekly.map((m) => ({ ...m, period: weekKey() }))];
      const m = all.find((x) => x.key === key);
      if (!m) return bad("Misi tidak ditemukan", 404, headers);
      if (m.claimed) return bad("Hadiah misi ini sudah diklaim", 409, headers);
      if (m.progress < m.target) return bad("Misi belum selesai", 400, headers);
      const { data, error } = await db.rpc("confess_claim_mission", { p_visitor: visitorId, p_key: key, p_period: m.period, p_gems: m.gems, p_label: m.label });
      if (error) {
        if (String(error.code) === "23505" || String(error.message).includes("duplicate")) return bad("Hadiah misi ini sudah diklaim", 409, headers);
        return bad("Gagal klaim", 500, headers);
      }
      return ok({ ok: true, gems_awarded: m.gems, gems: data }, headers);
    }

    case "crush_status": {
      const { data } = await db.from("confess_crush_picks").select("id, target_visitor_id, matched_at, created_at").eq("picker_visitor_id", visitorId).order("created_at", { ascending: false });
      const tids = (data || []).map((r: Row) => r.target_visitor_id);
      const { data: profs } = tids.length ? await db.from("anon_chat_profiles").select("visitor_id, nickname, avatar_url").in("visitor_id", tids) : { data: [] };
      const pm = new Map((profs || []).map((p: Row) => [p.visitor_id, p]));
      const { data: me } = await db.from("anon_chat_profiles").select("nickname").eq("visitor_id", visitorId).maybeSingle();
      return ok({
        my_nickname: me?.nickname || null, max: MAX_CRUSH,
        picks: (data || []).map((r: Row) => ({
          id: r.id, nickname: pm.get(r.target_visitor_id)?.nickname || "Pengguna",
          avatar_url: pm.get(r.target_visitor_id)?.avatar_url || null, matched: !!r.matched_at, created_at: r.created_at,
        })),
      }, headers);
    }

    case "crush_pick": {
      const nick = String(body.nickname || "").trim().slice(0, 40);
      if (nick.length < 2) return bad("Isi nickname Anon Chat target", 400, headers);
      const { data: me } = await db.from("anon_chat_profiles").select("nickname").eq("visitor_id", visitorId).maybeSingle();
      if (!me?.nickname) return bad("Buat profil Anon Chat dulu supaya bisa dipilih balik", 400, headers, { need_profile: true });
      const { data: cands } = await db.from("anon_chat_profiles").select("visitor_id").ilike("nickname", nick.replace(/[%_]/g, "")).limit(2);
      // Same generic message for not found / ambiguous so nicknames can't be probed.
      if (!cands || cands.length !== 1) return bad("Nickname tidak ditemukan atau tidak unik", 404, headers);
      const target = cands[0].visitor_id as string;
      if (target === visitorId) return bad("Tidak bisa memilih diri sendiri", 400, headers);
      const { count } = await db.from("confess_crush_picks").select("id", { count: "exact", head: true }).eq("picker_visitor_id", visitorId);
      if ((count || 0) >= MAX_CRUSH) return bad(`Maksimal ${MAX_CRUSH} Secret Crush`, 400, headers);
      const { error } = await db.from("confess_crush_picks").insert({ picker_visitor_id: visitorId, target_visitor_id: target });
      if (error) return bad("Kamu sudah memilih dia", 409, headers);
      const { data: rev } = await db.from("confess_crush_picks").select("id").eq("picker_visitor_id", target).eq("target_visitor_id", visitorId).maybeSingle();
      if (rev) {
        const now = new Date().toISOString();
        await db.from("confess_crush_picks").update({ matched_at: now })
          .or(`and(picker_visitor_id.eq.${visitorId},target_visitor_id.eq.${target}),and(picker_visitor_id.eq.${target},target_visitor_id.eq.${visitorId})`);
        const { data: tp } = await db.from("anon_chat_profiles").select("nickname").eq("visitor_id", target).maybeSingle();
        for (const [a, b, bn] of [[visitorId, target, tp?.nickname], [target, visitorId, me.nickname]] as [string, string, string][]) {
          const { data: f } = await db.from("anon_chat_friends").select("id").eq("visitor_id", a).eq("friend_visitor", b).maybeSingle();
          if (!f) await db.from("anon_chat_friends").insert({ visitor_id: a, friend_visitor: b, friend_nickname: bn || "Crush" });
          await notify(db, a, "💘 SECRET CRUSH MATCH!", `🎉 Kalian saling memilih! Kamu & ${bn || "crush-mu"} sekarang bisa chat di Anon Chat.`, "reward");
        }
        return ok({ ok: true, matched: true }, headers);
      }
      return ok({ ok: true, matched: false }, headers);
    }

    case "crush_cancel": {
      const id = String(body.pick_id || "");
      const { data: r } = await db.from("confess_crush_picks").select("id, matched_at").eq("id", id).eq("picker_visitor_id", visitorId).maybeSingle();
      if (!r) return bad("Tidak ditemukan", 404, headers);
      if (r.matched_at) return bad("Sudah match, tidak bisa dibatalkan", 400, headers);
      await db.from("confess_crush_picks").delete().eq("id", id).eq("picker_visitor_id", visitorId);
      return ok({ ok: true }, headers);
    }
  }
  return null;
}

/* ---------------- Admin moderation ---------------- */
export async function handleAdmin(db: DB, action: string, body: Row, req: Request, headers: HeadersInit): Promise<Response> {
  const token = (req.headers.get("x-admin-token") || "").trim();
  const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } } as any;
  const uid = u?.user?.id;
  if (!uid) return bad("Unauthorized", 401, headers);
  const [{ data: a1 }, { data: a2 }] = await Promise.all([
    db.rpc("has_role", { _user_id: uid, _role: "admin" }),
    db.rpc("has_role", { _user_id: uid, _role: "super_admin" }),
  ]);
  if (!a1 && !a2) return bad("Forbidden", 403, headers);

  if (action === "admin_reports") {
    const { data: reps } = await db.from("confess_reports").select("id, target_type, target_id, reason, status, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(100);
    const byT = (t: string) => (reps || []).filter((r: Row) => r.target_type === t).map((r: Row) => r.target_id);
    const [walls, replies, polls] = await Promise.all([
      byT("wall").length ? db.from("confess_public_wall").select("id, message, is_hidden").in("id", byT("wall")) : { data: [] },
      byT("reply").length ? db.from("confess_wall_replies").select("id, message, is_hidden").in("id", byT("reply")) : { data: [] },
      byT("poll").length ? db.from("confess_polls").select("id, options, is_hidden").in("id", byT("poll")) : { data: [] },
    ]);
    const m = new Map<string, Row>();
    for (const x of [...(walls.data || []), ...(replies.data || [])] as Row[]) m.set(x.id, x);
    for (const x of (polls.data || []) as Row[]) m.set(x.id, { ...x, message: (x.options as string[]).join(" / ") });
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [{ data: sup }, { data: cl }] = await Promise.all([
      db.from("confess_special_reactions").select("visitor_id").gte("created_at", weekAgo).limit(2000),
      db.from("confess_mission_claims").select("visitor_id").gte("created_at", weekAgo).limit(2000),
    ]);
    const top = (rows: Row[] | null) => {
      const c = new Map<string, number>();
      for (const r of rows || []) c.set(r.visitor_id, (c.get(r.visitor_id) || 0) + 1);
      return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([v, n]) => ({ account: v.slice(0, 8) + "…", count: n }));
    };
    return ok({
      reports: (reps || []).map((r: Row) => ({ ...r, text: m.get(r.target_id)?.message || "(sudah dihapus)", hidden: !!m.get(r.target_id)?.is_hidden })),
      abuse: { support_top: top(sup), mission_top: top(cl) },
    }, headers);
  }
  if (action === "admin_hide") {
    const t = String(body.target_type), id = String(body.target_id), hidden = !!body.hidden;
    const table = t === "wall" ? "confess_public_wall" : t === "reply" ? "confess_wall_replies" : t === "poll" ? "confess_polls" : "";
    if (!table) return bad("Tipe tidak valid", 400, headers);
    await db.from(table).update({ is_hidden: hidden }).eq("id", id);
    await db.from("confess_reports").update({ status: "resolved" }).eq("target_type", t).eq("target_id", id);
    return ok({ ok: true }, headers);
  }
  if (action === "admin_resolve") {
    await db.from("confess_reports").update({ status: "dismissed" }).eq("id", String(body.report_id));
    return ok({ ok: true }, headers);
  }
  return bad("Aksi tidak dikenal", 400, headers);
}

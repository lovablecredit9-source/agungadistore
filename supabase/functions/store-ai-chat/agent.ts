// Store AI agent capabilities (modular add-on for store-ai-chat).
// Intent detection, catalog search, comparison, account summary, action cards,
// follow-up suggestions and feedback. Database is the source of truth for all numbers.
import { aiChatCompletion } from "../_shared/ai-provider.ts";

export type Intent =
  | "chat" | "product_search" | "product_compare" | "image_product_search"
  | "account_summary" | "voucher" | "balance";

export interface SearchFilters {
  q?: string | null;
  keywords?: string[];
  category?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  min_stock?: number | null;
  store?: string | null;
  sort?: "relevance" | "newest" | "popular" | "cheapest" | "expensive" | "rating" | "stock" | null;
}

export interface ContextRef { n: number; id: string; source: "admin" | "seller"; title: string }

export interface ProductCard {
  kind: "product";
  n: number;
  source: "admin" | "seller";
  id: string;
  title: string;
  price: number;
  promo_price: number | null;
  stock: number | null;
  image: string | null;
  category: string | null;
  seller: { name: string; verified: boolean } | null;
  rating: { avg: number; count: number } | null;
  sold: number | null;
  created_at: string | null;
  description: string | null;
  url: string;
}

const safe = <T,>(p: PromiseLike<T>): Promise<T | null> => Promise.resolve(p).catch(() => null as any);
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() && isFinite(Number(v)) ? Number(v) : null);
const clean = (s: string) => s.replace(/[,()%*\\"'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p: any) => (p?.type === "text" ? p.text : p?.type === "image_url" ? "[foto]" : "")).join(" ");
  return "";
}

function parseJson(raw: string): any | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// ---------- Intent detection ----------
function heuristicIntent(last: string): { intent: Intent; filters: SearchFilters; refs: number[]; compare: string[] } {
  const t = last.toLowerCase();
  const refs = [...t.matchAll(/(?:nomor|no\.?|#|yang ke-?)\s*(\d{1,2})/g)].map((m) => Number(m[1]));
  if (/banding|compare|vs\b/.test(t)) return { intent: "product_compare", filters: {}, refs, compare: t.split(/\bdan\b|\bvs\b|,/).map((s) => s.replace(/bandingkan|produk/g, "").trim()).filter(Boolean) };
  if (/apa yang bisa|ringkasan akun|status akun|akun (aku|saya)/.test(t)) return { intent: "account_summary", filters: {}, refs, compare: [] };
  if (/voucher|kode promo/.test(t)) return { intent: "voucher", filters: {}, refs, compare: [] };
  if (/saldo/.test(t)) return { intent: "balance", filters: {}, refs, compare: [] };
  if (/\b(cari|carikan|produk|harga|stok|termurah|terlaris|di bawah|dibawah)\b/.test(t)) {
    const f: SearchFilters = {};
    const under = t.match(/(?:di ?bawah|maks(?:imal)?|<)\s*(?:rp\.?\s*)?(\d+)\s*(rb|ribu|k)?/);
    if (under) f.max_price = Number(under[1]) * (under[2] ? 1000 : 1);
    const ribuan = t.match(/(\d+)\s*(?:rb|ribu)an/);
    if (ribuan) { const v = Number(ribuan[1]) * 1000; f.min_price = v; f.max_price = v + 9999; }
    if (/terlaris|populer/.test(t)) f.sort = "popular";
    if (/termurah/.test(t)) f.sort = "cheapest";
    if (/terbaru/.test(t)) f.sort = "newest";
    if (/stok.*(banyak|masih)/.test(t)) { f.sort = "stock"; f.min_stock = 1; }
    f.keywords = t.replace(/cari(kan)?|produk|yang|di ?bawah.*|harga|stok.*|terlaris|termurah|terbaru|\d+\s*(rb|ribu)(an)?/g, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
    return { intent: "product_search", filters: f, refs, compare: [] };
  }
  return { intent: "chat", filters: {}, refs, compare: [] };
}

export interface DetectedIntent { intent: Intent; filters: SearchFilters; refs: number[]; compare: string[] }
export async function detectIntent(sb: any, messages: any[], refs: ContextRef[]): Promise<DetectedIntent> {
  const recent = messages.slice(-6).map((m) => `${m.role === "user" ? "USER" : "AI"}: ${textOf(m.content).slice(0, 400)}`).join("\n");
  const last = textOf(messages[messages.length - 1]?.content || "");
  const refList = refs.length ? refs.map((r) => `${r.n}. ${r.title} (id:${r.id}, ${r.source})`).join("\n") : "(tidak ada)";
  const prompt = `Kamu router intent untuk Store AI toko digital. Balas HANYA JSON valid tanpa teks lain.
Skema: {"intent":"chat|product_search|product_compare|account_summary|voucher|balance","filters":{"keywords":[string],"category":string|null,"min_price":number|null,"max_price":number|null,"min_stock":number|null,"store":string|null,"sort":"relevance|newest|popular|cheapest|expensive|rating|stock"|null},"refs":[number],"compare":[string]}
Aturan:
- product_search: user mencari/menanyakan produk, harga, stok, kategori. "20 ribuan" = min 20000 max 29999. "di bawah 30 ribu" = max 30000. "stok masih banyak" = sort stock, min_stock 1.
- Follow-up seperti "kalau yang B?", "yang lebih murah?" → gabungkan dengan filter pencarian sebelumnya dari percakapan.
- refs: nomor hasil sebelumnya yang dirujuk user ("yang nomor 2" → [2]). Kalau user menanyakan detail satu hasil sebelumnya, intent product_search dengan refs.
- product_compare: user minta membandingkan. Isi refs jika merujuk nomor, atau compare berisi nama produk.
- account_summary: "apa yang bisa saya lakukan", ringkasan/status akun.
- voucher: tanya voucher/kode promo. balance: tanya saldo.
- selain itu chat. keywords berupa kata benda produk (mis. "diamond","netflix"), bukan kata umum.
HASIL SEBELUMNYA (bernomor):
${refList}
PERCAKAPAN:
${recent}`;
  try {
    const { resp } = await aiChatCompletion(sb, { messages: [{ role: "user", content: prompt }] }, { fallbackModel: "google/gemini-3.1-flash-lite" });
    if (resp.ok) {
      const d = await resp.json();
      const j = parseJson(d?.choices?.[0]?.message?.content || "");
      const allowed: Intent[] = ["chat", "product_search", "product_compare", "account_summary", "voucher", "balance"];
      if (j && allowed.includes(j.intent)) {
        return {
          intent: j.intent as Intent,
          filters: (j.filters || {}) as SearchFilters,
          refs: Array.isArray(j.refs) ? j.refs.map(Number).filter((n: number) => n > 0 && n < 50) : [],
          compare: Array.isArray(j.compare) ? j.compare.map(String).slice(0, 3) : [],
        };
      }
    }
  } catch { /* fall back */ }
  return heuristicIntent(last);
}

// ---------- Vision → search attributes ----------
export async function imageToFilters(sb: any, imageUrl: string, note: string): Promise<{ filters: SearchFilters; description: string } | null> {
  const prompt = `Analisis gambar ini untuk mencari produk serupa di toko digital (akun premium, voucher game, diamond, top up, aplikasi, dll). ${note ? `Catatan user: ${note}` : ""}
Balas HANYA JSON: {"description":"deskripsi singkat isi gambar","keywords":["2-4 kata kunci produk paling penting, mis. nama game/aplikasi/brand"],"category":string|null}`;
  try {
    const { resp } = await aiChatCompletion(sb, {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl } }] }],
    }, { fallbackModel: "google/gemini-3.1-flash-lite" });
    if (!resp.ok) return null;
    const d = await resp.json();
    const j = parseJson(d?.choices?.[0]?.message?.content || "");
    if (!j) return null;
    // Split phrases into distinct words so "86 Diamonds" still matches "Diamond ... 86".
    const words = (Array.isArray(j.keywords) ? j.keywords : []).flatMap((k: any) => clean(String(k)).toLowerCase().split(" "))
      .map((w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
      .filter((w: string) => w.length >= 3);
    const keywords = [...new Set<string>(words)].slice(0, 4);
    // Category from vision is a guess; matching on keywords only avoids excluding real matches.
    return { filters: { keywords, category: null, sort: "relevance" }, description: String(j.description || "").slice(0, 300) };
  } catch { return null; }
}

// ---------- Catalog search ----------
function orClause(words: string[], cols: string[]) {
  const parts: string[] = [];
  for (const w of words) for (const c of cols) parts.push(`${c}.ilike.%${w}%`);
  return parts.join(",");
}

async function loadStores(sb: any, ids: string[]) {
  const map = new Map<string, any>();
  if (!ids.length) return map;
  const r = await safe(sb.from("seller_stores").select("id,store_name,is_verified").in("id", ids));
  for (const s of ((r as any)?.data || [])) map.set(s.id, s);
  return map;
}

function adminCard(p: any): Omit<ProductCard, "n"> {
  return {
    kind: "product", source: "admin", id: p.id, title: p.title, price: Number(p.price || 0), promo_price: null,
    stock: p.stock ?? null, image: p.image_url || null, category: p.category || null,
    seller: { name: "Agung Adi Store (resmi)", verified: true }, rating: null,
    sold: p.sold_count ?? null, created_at: p.created_at || null, description: (p.description || "").slice(0, 160) || null,
    url: `/produk?id=${p.id}`,
  };
}
function sellerCard(p: any, store: any): Omit<ProductCard, "n"> {
  return {
    kind: "product", source: "seller", id: p.id, title: p.title, price: Number(p.price || 0),
    promo_price: p.promo_price && Number(p.promo_price) > 0 && Number(p.promo_price) < Number(p.price) ? Number(p.promo_price) : null,
    stock: p.stock ?? null, image: p.image_url || (Array.isArray(p.images) ? p.images[0] : null) || null, category: p.category || null,
    seller: store ? { name: store.store_name, verified: !!store.is_verified } : null,
    rating: Number(p.rating_count || 0) > 0 ? { avg: Number(p.rating_avg || 0), count: Number(p.rating_count) } : null,
    sold: p.sold_count ?? null, created_at: p.created_at || null, description: (p.description || "").slice(0, 160) || null,
    url: `/seller?product=${p.id}`,
  };
}

export async function searchProducts(sb: any, f: SearchFilters, limit = 6): Promise<ProductCard[]> {
  const words = [...(f.keywords || []), ...(f.q ? [f.q] : [])].map(clean).filter((w) => w.length >= 2).slice(0, 4);
  const minP = num(f.min_price), maxP = num(f.max_price), minS = num(f.min_stock);
  const cat = f.category ? clean(f.category) : null;

  let a = sb.from("products").select("id,title,description,price,stock,image_url,category,sold_count,created_at");
  let s = sb.from("seller_products").select("id,title,description,price,promo_price,stock,image_url,images,category,sold_count,rating_avg,rating_count,created_at,store_id")
    .eq("status", "approved").eq("is_active", true).is("archived_at", null);
  if (words.length) { a = a.or(orClause(words, ["title", "description", "category"])); s = s.or(orClause(words, ["title", "description", "category"])); }
  if (cat) { a = a.ilike("category", `%${cat}%`); s = s.ilike("category", `%${cat}%`); }
  if (minP != null) { a = a.gte("price", minP); s = s.gte("price", minP); }
  if (maxP != null) { a = a.lte("price", maxP); s = s.lte("price", maxP); }
  if (minS != null) { a = a.gte("stock", minS); s = s.gte("stock", minS); }

  let storeIds: string[] | null = null;
  if (f.store) {
    const st = await safe(sb.from("seller_stores").select("id").eq("is_active", true).ilike("store_name", `%${clean(f.store)}%`).limit(10));
    storeIds = (((st as any)?.data) || []).map((x: any) => x.id);
    if (!storeIds!.length) return [];
    s = s.in("store_id", storeIds);
  }
  const sortCol: Record<string, [string, boolean]> = {
    newest: ["created_at", false], popular: ["sold_count", false], cheapest: ["price", true],
    expensive: ["price", false], stock: ["stock", false], rating: ["sold_count", false], relevance: ["sold_count", false],
  };
  const [col, asc] = sortCol[f.sort || "relevance"] || sortCol.relevance;
  a = a.order(col, { ascending: asc, nullsFirst: false }).limit(limit);
  s = s.order(f.sort === "rating" ? "rating_avg" : col, { ascending: asc, nullsFirst: false }).limit(limit);

  const [ar, sr] = await Promise.all([storeIds ? Promise.resolve({ data: [] }) : a, s]);
  if ((ar as any)?.error && (sr as any)?.error) throw new Error("search_failed");
  const sellerRows = ((sr as any)?.data || []) as any[];
  const stores = await loadStores(sb, [...new Set(sellerRows.map((p) => p.store_id))]);
  let cards = [
    ...(((ar as any)?.data || []) as any[]).map(adminCard),
    ...sellerRows.map((p) => sellerCard(p, stores.get(p.store_id))),
  ];
  const key = (c: any): number => {
    switch (f.sort) {
      case "cheapest": return c.price;
      case "expensive": return -c.price;
      case "newest": return -new Date(c.created_at || 0).getTime();
      case "stock": return -(c.stock || 0);
      case "rating": return -(c.rating?.avg || 0);
      default: return -(c.sold || 0);
    }
  };
  cards = cards.sort((x, y) => key(x) - key(y)).slice(0, limit);
  return cards.map((c, i) => ({ ...c, n: i + 1 }));
}

export async function productsByRefs(sb: any, refs: ContextRef[]): Promise<ProductCard[]> {
  const adminIds = refs.filter((r) => r.source === "admin").map((r) => r.id);
  const sellerIds = refs.filter((r) => r.source === "seller").map((r) => r.id);
  const [ar, sr] = await Promise.all([
    adminIds.length ? safe(sb.from("products").select("id,title,description,price,stock,image_url,category,sold_count,created_at").in("id", adminIds)) : null,
    sellerIds.length ? safe(sb.from("seller_products").select("id,title,description,price,promo_price,stock,image_url,images,category,sold_count,rating_avg,rating_count,created_at,store_id,status,is_active").in("id", sellerIds).eq("status", "approved").eq("is_active", true)) : null,
  ]);
  const sRows = (((sr as any)?.data) || []) as any[];
  const stores = await loadStores(sb, [...new Set(sRows.map((p) => p.store_id))]);
  const byId = new Map<string, Omit<ProductCard, "n">>();
  for (const p of (((ar as any)?.data) || [])) byId.set(p.id, adminCard(p));
  for (const p of sRows) byId.set(p.id, sellerCard(p, stores.get(p.store_id)));
  return refs.map((r) => byId.get(r.id)).filter(Boolean).map((c, i) => ({ ...(c as any), n: i + 1 }));
}

// ---------- Account (only for the requesting visitor) ----------
export async function accountSummary(sb: any, visitorId: string | null) {
  if (!visitorId) return { loggedIn: false } as const;
  const ubId = await safe(sb.rpc("get_active_user_balance_id", { p_visitor_id: visitorId }));
  const ub = (ubId as any)?.data ? await safe(sb.from("user_balances").select("username,balance,bonus_balance").eq("id", (ubId as any).data).maybeSingle()) : null;
  const [gb, ds, prem, orders, tickets, vouchers] = await Promise.all([
    safe(sb.from("game_balance").select("gems,coins,amount").eq("visitor_id", visitorId).maybeSingle()),
    safe(sb.from("daily_streaks").select("current_streak,longest_streak").eq("visitor_id", visitorId).maybeSingle()),
    safe(sb.rpc("get_store_premium_info", { p_visitor_id: visitorId })),
    safe(sb.from("seller_orders").select("id,status,product_title,order_code,created_at", { count: "exact" }).eq("buyer_visitor_id", visitorId).not("status", "in", "(completed,cancelled,refunded)").order("created_at", { ascending: false }).limit(3)),
    safe(sb.from("support_tickets").select("id,status", { count: "exact" }).eq("visitor_id", visitorId).not("status", "in", "(closed,resolved,selesai)").limit(1)),
    activeVouchers(sb, visitorId),
  ]);
  const u = (ub as any)?.data;
  const p = Array.isArray((prem as any)?.data) ? (prem as any).data[0] : (prem as any)?.data;
  return {
    loggedIn: !!u,
    username: u?.username ?? null,
    balance: u ? Number(u.balance || 0) : null,
    bonus_balance: u ? Number(u.bonus_balance || 0) : null,
    saldo_in: (gb as any)?.data ? Number((gb as any).data.amount || 0) : null,
    gems: (gb as any)?.data ? Number((gb as any).data.gems || 0) : null,
    streak: (ds as any)?.data ? Number((ds as any).data.current_streak || 0) : null,
    premium: p?.is_premium ? { plan: p.plan_name, days_left: p.days_left } : null,
    active_orders: (orders as any)?.error ? null : ((orders as any)?.count ?? 0),
    recent_orders: (((orders as any)?.data) || []).map((o: any) => ({ code: o.order_code, title: o.product_title, status: o.status })),
    open_tickets: (tickets as any)?.error ? null : ((tickets as any)?.count ?? 0),
    vouchers: vouchers.length,
  };
}

export async function activeVouchers(sb: any, visitorId: string | null) {
  const now = new Date().toISOString();
  let q = sb.from("discount_vouchers").select("id,code,discount_amount,min_purchase,expires_at,max_uses,used_count,visitor_id,source")
    .eq("is_active", true).or(`expires_at.is.null,expires_at.gt.${now}`);
  q = visitorId ? q.or(`visitor_id.is.null,visitor_id.eq.${visitorId.replace(/[^a-zA-Z0-9-]/g, "")}`) : q.is("visitor_id", null);
  const r = await safe(q.order("created_at", { ascending: false }).limit(6));
  return ((((r as any)?.data) || []) as any[])
    .filter((v) => v.max_uses == null || Number(v.used_count || 0) < Number(v.max_uses))
    .map((v) => ({
      kind: "voucher" as const, id: v.id, code: v.code, discount: Number(v.discount_amount || 0),
      min_purchase: Number(v.min_purchase || 0), expires_at: v.expires_at, personal: !!v.visitor_id,
      remaining: v.max_uses == null ? null : Number(v.max_uses) - Number(v.used_count || 0),
    }));
}

// ---------- Suggestions ----------
export function extractSuggestions(reply: string): { reply: string; suggestions: string[] } {
  const m = reply.match(/\[\[\s*SUGGEST\s*:([\s\S]*?)\]\]/i);
  if (!m) return { reply: reply.trim(), suggestions: [] };
  const suggestions = m[1].split("|").map((s) => s.trim()).filter((s) => s && s.length <= 60).slice(0, 4);
  return { reply: reply.replace(m[0], "").trim(), suggestions };
}

export function fallbackSuggestions(intent: Intent, resultCount: number): string[] {
  switch (intent) {
    case "product_search": case "image_product_search":
      return resultCount >= 2 ? ["⚖️ Bandingkan nomor 1 dan 2", "💸 Yang lebih murah", "📦 Yang stoknya paling banyak"]
        : resultCount === 1 ? ["🔎 Detail nomor 1", "💸 Yang lebih murah", "🎟️ Ada voucher?"]
        : ["🔥 Produk terlaris", "🎟️ Ada voucher?", "🛒 Produk terbaru"];
    case "product_compare": return ["🛒 Cari produk serupa", "🎟️ Ada voucher?", "💰 Cek saldo"];
    case "voucher": return ["🛒 Cari produk", "💰 Cek saldo", "🔥 Produk terlaris"];
    case "balance": return ["💳 Cara deposit", "🧾 Transaksi terakhir", "🛒 Produk di bawah saldo aku"];
    case "account_summary": return ["🎟️ Tampilkan voucher", "🛒 Rekomendasi produk", "🎫 Status tiket support"];
    default: return ["🛒 Cari produk", "🎟️ Ada voucher?", "💰 Cek saldo"];
  }
}

// ---------- Feedback ----------
const REASONS = ["salah", "tidak_lengkap", "data_tidak_sesuai", "tidak_paham", "lainnya"];
export async function saveFeedback(sb: any, visitorId: string, body: any) {
  const messageId = typeof body.messageId === "string" ? body.messageId.slice(0, 80) : "";
  const feedback = body.feedback === "up" || body.feedback === "down" ? body.feedback : null;
  const reason = feedback === "down" && REASONS.includes(body.reason) ? body.reason : null;
  if (!visitorId || !messageId || !feedback) return { ok: false, status: 400 };
  const { error } = await sb.from("ai_message_feedback").upsert({
    visitor_id: visitorId.slice(0, 100),
    conversation_id: typeof body.conversationId === "string" ? body.conversationId.slice(0, 80) : null,
    message_id: messageId, feedback, reason, updated_at: new Date().toISOString(),
  }, { onConflict: "visitor_id,message_id" });
  return { ok: !error, status: error ? 500 : 200 };
}

// Shared presentation rules for the existing admin_posts system (admin form + user feed).
export const POST_CATEGORIES = [
  { id: "pengumuman", label: "📢 Pengumuman" },
  { id: "update", label: "✨ Update" },
  { id: "streak", label: "🔥 Streak" },
  { id: "shop", label: "🛍️ Shop" },
  { id: "musik", label: "🎵 Musik" },
  { id: "game", label: "🎮 Game" },
  { id: "saldo", label: "💰 Saldo" },
  { id: "telegram", label: "🤖 Telegram" },
  { id: "promo", label: "🎟️ Promo" },
  { id: "event", label: "🎉 Event" },
] as const;

/** CTA targets map to existing app tabs only (no new routes). */
export const POST_ACTIONS = [
  { tab: "", label: "Tanpa aksi" },
  { tab: "streak", label: "🔥 Buka Streak" },
  { tab: "streakshop", label: "🔥 Buka Streak Shop" },
  { tab: "produk", label: "🛍️ Lihat Shop" },
  { tab: "musik", label: "🎵 Dengarkan Sekarang" },
  { tab: "telegramconnect", label: "🤖 Gunakan Telegram" },
  { tab: "game", label: "🎮 Main Sekarang" },
  { tab: "voucher", label: "🎁 Ambil Promo" },
  { tab: "saldo", label: "💰 Buka Saldo" },
  { tab: "seller", label: "🏪 Buka Toko" },
  { tab: "confess", label: "💌 Buka Confess" },
  { tab: "firepass", label: "🔥 Buka Fire Pass" },
  { tab: "tiket", label: "💬 Hubungi CS" },
] as const;

const CATEGORY_DEFAULT_TAB: Record<string, string> = {
  streak: "streak", shop: "produk", musik: "musik", game: "game", saldo: "saldo", telegram: "telegramconnect", promo: "voucher",
};

export const POST_STYLES = [
  { id: "premium3d", label: "🎨 Premium 3D" }, { id: "neon", label: "🌌 Neon Cyber" }, { id: "luxury", label: "💎 Luxury" },
  { id: "gaming", label: "🔥 Gaming" }, { id: "modernapp", label: "📱 Modern App" }, { id: "finance", label: "💰 Finance" },
  { id: "music", label: "🎵 Music" }, { id: "marketplace", label: "🛍️ Marketplace" }, { id: "ai", label: "🤖 AI / Technology" },
  { id: "event", label: "🎉 Event / Promo" },
] as const;

const KEYWORDS: [RegExp, string, string][] = [
  [/streak|api|flame/i, "🔥", "Streak"], [/shop|toko|belanja|produk|beli/i, "🛍️", "Shop"], [/reward|hadiah|bonus/i, "🎁", "Reward"],
  [/musik|music|lagu|playlist/i, "🎵", "Musik"], [/game|main|royale|spin/i, "🎮", "Game"], [/saldo|deposit|qris|bayar|wallet/i, "💰", "Saldo"],
  [/telegram|bot/i, "🤖", "Telegram"], [/promo|diskon|voucher|flash/i, "🎟️", "Promo"], [/event|lomba|turnamen/i, "🎉", "Event"],
  [/aman|keamanan|pin|security/i, "🛡️", "Keamanan"], [/premium|plus|vip|member/i, "👑", "Premium"], [/chat|cs|tiket/i, "💬", "Support"],
];

export function suggestKeywords(text: string): { emoji: string; label: string }[] {
  return KEYWORDS.filter(([re]) => re.test(text)).map(([, emoji, label]) => ({ emoji, label })).slice(0, 4);
}

export function guessCategory(text: string): string {
  const k = suggestKeywords(text)[0]?.label.toLowerCase();
  const map: Record<string, string> = { streak: "streak", shop: "shop", musik: "musik", game: "game", saldo: "saldo", telegram: "telegram", promo: "promo", event: "event" };
  return (k && map[k]) || "pengumuman";
}

export function categoryLabel(id?: string | null) {
  return POST_CATEGORIES.find((c) => c.id === id)?.label || "📢 Pengumuman";
}

/** Effective CTA tab + label for a post. */
export function postCta(post: { action_tab?: string | null; cta_label?: string | null; category?: string | null; link_url?: string | null }) {
  const tab = post.action_tab || CATEGORY_DEFAULT_TAB[post.category || ""] || "";
  const preset = POST_ACTIONS.find((a) => a.tab === tab && a.tab);
  const label = post.cta_label?.trim() || preset?.label || (post.link_url ? "↗ Buka Tautan" : "");
  return { tab, label };
}

/** A post is "new" if created within the last 3 days. */
export function isNewPost(createdAt?: string | null, now = Date.now()) {
  if (!createdAt) return false;
  return now - new Date(createdAt).getTime() < 3 * 86400000;
}

export function socialLinks(post: Record<string, any>) {
  const h = (v: string, base: string) => (v.startsWith("http") ? v : base + v.replace(/^@/, ""));
  return [
    post.whatsapp && { key: "wa", label: "WhatsApp", href: post.whatsapp.startsWith("http") ? post.whatsapp : `https://wa.me/62${String(post.whatsapp).replace(/\D/g, "").replace(/^(62|0)/, "")}` },
    post.instagram && { key: "ig", label: "Instagram", href: h(post.instagram, "https://instagram.com/") },
    post.tiktok && { key: "tt", label: "TikTok", href: h(post.tiktok, "https://tiktok.com/@") },
    post.youtube && { key: "yt", label: "YouTube", href: h(post.youtube, "https://youtube.com/@") },
    post.twitter && { key: "x", label: "X", href: h(post.twitter, "https://x.com/") },
    post.facebook && { key: "fb", label: "Facebook", href: h(post.facebook, "https://facebook.com/") },
  ].filter(Boolean) as { key: string; label: string; href: string }[];
}

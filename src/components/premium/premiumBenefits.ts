/**
 * Aturan benefit Premium Toko (murni, tanpa I/O).
 * Konfigurasi asli disimpan admin lewat `admin_set_store_premium_benefits`
 * dan selalu divalidasi ulang di server (purchase-with-balance, purchase-game-credits,
 * claim_daily_premium_voucher, claim_store_premium_reward, trigger tiket & flash sale).
 */
export interface PremiumBenefitConfig {
  voucher_enabled: boolean;
  voucher_amount: number;
  chat_priority: boolean;
  member_discount_enabled: boolean;
  member_discount_pct: number;
  flash_early_enabled: boolean;
  flash_early_minutes: number;
  game_credit_discount_enabled: boolean;
  game_credit_discount_pct: number;
  weekly_game_enabled: boolean;
  weekly_game_credits: number;
  monthly_reward_enabled: boolean;
  monthly_reward_credits: number;
  monthly_reward_gems: number;
  priority_notif_enabled: boolean;
}

export const DEFAULT_PREMIUM_CONFIG: PremiumBenefitConfig = {
  voucher_enabled: true, voucher_amount: 2000,
  chat_priority: true,
  member_discount_enabled: false, member_discount_pct: 5,
  flash_early_enabled: true, flash_early_minutes: 30,
  game_credit_discount_enabled: false, game_credit_discount_pct: 10,
  weekly_game_enabled: false, weekly_game_credits: 5,
  monthly_reward_enabled: false, monthly_reward_credits: 20, monthly_reward_gems: 50,
  priority_notif_enabled: true,
};

export type BenefitStatus = "active" | "locked" | "membership" | "soon";

export interface BenefitItem {
  key: string;
  icon: string;
  name: string;
  desc: string;
  status: BenefitStatus;
}

export const STATUS_LABEL: Record<BenefitStatus, string> = {
  active: "🟢 Aktif",
  locked: "🔒 Dikunci admin",
  membership: "🔒 Membership diperlukan",
  soon: "🟡 Segera tersedia",
};

const rp = (n: number) => "Rp " + Math.max(0, Math.round(n)).toLocaleString("id-ID");

/** Daftar benefit + status jujur: benefit yang dimatikan admin tidak pernah tampil "Aktif". */
export function buildBenefits(cfg: PremiumBenefitConfig, isPremium: boolean, isLocked = false): BenefitItem[] {
  const st = (enabled: boolean): BenefitStatus => (!enabled ? "soon" : isLocked ? "locked" : isPremium ? "active" : "membership");
  return [
    { key: "voucher", icon: "🎁", name: `Voucher ${rp(cfg.voucher_amount)}/hari`, desc: "1 voucher belanja setiap hari (reset 00:00 WIB, berlaku 24 jam).", status: st(cfg.voucher_enabled && cfg.voucher_amount > 0) },
    { key: "chat", icon: "💬", name: "Chat Prioritas", desc: "Tiket kamu diberi label 👑 PREMIUM PRIORITY dan naik ke antrean atas admin.", status: st(cfg.chat_priority) },
    { key: "look", icon: "✨", name: "Tampilan Premium", desc: "Kartu, glow, dan indikator premium di akun kamu.", status: st(true) },
    { key: "badge", icon: "👑", name: "Badge Premium", desc: "Badge 👑 PREMIUM di profil dan toko.", status: st(true) },
    { key: "discount", icon: "💰", name: `Member Price -${cfg.member_discount_pct}%`, desc: "Harga khusus member untuk produk toko admin (tidak digabung dengan Flash Sale).", status: st(cfg.member_discount_enabled && cfg.member_discount_pct > 0) },
    { key: "flash", icon: "⚡", name: `Flash Sale Early Access`, desc: `Akses Flash Sale tertentu ${cfg.flash_early_minutes} menit lebih awal + promo khusus Premium.`, status: st(cfg.flash_early_enabled) },
    { key: "notif", icon: "🔔", name: "Notifikasi Prioritas", desc: "Kabar Flash Sale khusus/early Premium langsung masuk notifikasi kamu.", status: st(cfg.priority_notif_enabled) },
    { key: "game", icon: "🎮", name: `Bonus Game ${cfg.weekly_game_credits} Kredit/minggu`, desc: "Klaim Kredit Game gratis setiap minggu.", status: st(cfg.weekly_game_enabled && cfg.weekly_game_credits > 0) },
    { key: "gameshop", icon: "🛒", name: `Diskon Kredit Game -${cfg.game_credit_discount_pct}%`, desc: "Harga member saat membeli paket Kredit Game.", status: st(cfg.game_credit_discount_enabled && cfg.game_credit_discount_pct > 0) },
    { key: "monthly", icon: "🎁", name: "Hadiah Bulanan", desc: [cfg.monthly_reward_credits > 0 && `${cfg.monthly_reward_credits} Kredit Game`, cfg.monthly_reward_gems > 0 && `${cfg.monthly_reward_gems} Gems`].filter(Boolean).join(" + ") + " setiap bulan.", status: st(cfg.monthly_reward_enabled && (cfg.monthly_reward_credits > 0 || cfg.monthly_reward_gems > 0)) },
  ];
}

/** Harga member untuk tampilan (server menghitung ulang dengan rumus sama). */
export function memberPrice(price: number, cfg: PremiumBenefitConfig, isPremium: boolean, hasFlash = false): number {
  if (!isPremium || hasFlash || !cfg.member_discount_enabled) return price;
  const pct = Math.max(0, Math.min(90, cfg.member_discount_pct || 0));
  return price - Math.floor((price * pct) / 100);
}

/** AKTIF / AKAN BERAKHIR (≤ 3 hari). */
export function premiumPhase(isPremium: boolean, expiresAt: string | null, now = Date.now()): "active" | "ending" | "none" {
  if (!isPremium || !expiresAt) return "none";
  return new Date(expiresAt).getTime() - now <= 3 * 86400000 ? "ending" : "active";
}

/** Akses Flash Sale sesuai mode (sama dengan aturan server). */
export function flashAccessible(mode: string | null | undefined, startsAt: string, isPremium: boolean, earlyMinutes: number, now = Date.now()): boolean {
  const start = new Date(startsAt).getTime();
  const m = mode || "all";
  if (m === "premium_only") return isPremium && start <= now;
  if (m === "premium_early") return start <= now || (isPremium && start - earlyMinutes * 60000 <= now);
  return start <= now;
}

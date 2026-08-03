import { supabase } from "@/integrations/supabase/client";

/* ============================================================
   BATCH 2 — SOSIAL: minat, favorit/teman, status, catatan profil
   ============================================================ */

export const INTERESTS = [
  "Game", "Musik", "Film", "Belajar", "Teknologi", "Olahraga", "Anime",
  "Traveling", "Kuliner", "Fotografi", "Otomotif", "Bisnis", "Buku",
  "Kesehatan", "Fashion", "Meme", "Coding", "Curhat",
] as const;

export type ActivityStatus = "online" | "sibuk" | "jauh" | "tidak_terlihat";

export const ACTIVITY_STATUS_META: Record<ActivityStatus, { label: string; dot: string; desc: string }> = {
  online: { label: "Online", dot: "bg-emerald-400", desc: "Terlihat aktif oleh pengguna lain" },
  sibuk: { label: "Sibuk", dot: "bg-rose-400", desc: "Sedang fokus, notifikasi dibatasi" },
  jauh: { label: "Jauh", dot: "bg-amber-400", desc: "Sedang tidak di depan layar" },
  tidak_terlihat: { label: "Tidak terlihat", dot: "bg-slate-500", desc: "Status disembunyikan" },
};

export type PrivacyDiscover = "everyone" | "friends" | "nobody";

export const PRIVACY_META: Record<PrivacyDiscover, { label: string; desc: string }> = {
  everyone: { label: "Semua orang", desc: "Siapa pun dapat menemukan akunmu" },
  friends: { label: "Hanya teman", desc: "Hanya teman/favorit yang dapat menemukanmu" },
  nobody: { label: "Tidak ada", desc: "Akunmu tersembunyi dari pencarian" },
};

export interface SocialRow {
  visitor_id: string;
  interests: string[];
  note: string | null;
  note_expires_at: string | null;
  activity_status: ActivityStatus;
  dnd: boolean;
  privacy_discover: PrivacyDiscover;
}

export interface FavoriteRow {
  id: string;
  visitor_id: string;
  target_visitor_id: string;
  display_name: string | null;
  note: string | null;
  is_favorite: boolean;
  created_at: string;
}

const table = (name: string) => (supabase as any).from(name);

export async function fetchSocial(visitorId: string): Promise<SocialRow> {
  const { data } = await table("profile_social").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (data) return data as SocialRow;
  const { data: created } = await table("profile_social").insert({ visitor_id: visitorId }).select("*").single();
  return (created as SocialRow) ?? {
    visitor_id: visitorId, interests: [], note: null, note_expires_at: null,
    activity_status: "online", dnd: false, privacy_discover: "everyone",
  };
}

export async function saveSocial(visitorId: string, patch: Partial<SocialRow>) {
  await table("profile_social").upsert({ visitor_id: visitorId, ...patch }, { onConflict: "visitor_id" });
}

export function noteIsActive(row: Pick<SocialRow, "note" | "note_expires_at">) {
  if (!row.note) return false;
  if (!row.note_expires_at) return true;
  return new Date(row.note_expires_at).getTime() > Date.now();
}

export async function fetchFavorites(visitorId: string): Promise<FavoriteRow[]> {
  const { data } = await table("profile_favorites")
    .select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false });
  return (data as FavoriteRow[]) || [];
}

export async function addFavorite(visitorId: string, targetVisitorId: string, displayName: string) {
  const { error } = await table("profile_favorites").upsert(
    { visitor_id: visitorId, target_visitor_id: targetVisitorId, display_name: displayName || null },
    { onConflict: "visitor_id,target_visitor_id" },
  );
  if (error) throw new Error(error.message);
}

export async function toggleFavorite(id: string, isFavorite: boolean) {
  await table("profile_favorites").update({ is_favorite: isFavorite }).eq("id", id);
}

export async function removeFavorite(id: string) {
  await table("profile_favorites").delete().eq("id", id);
}

/** Riwayat pengguna yang pernah terhubung (dari Anon Chat). */
export async function fetchConnectHistory(visitorId: string) {
  const { data } = await (supabase as any)
    .from("anon_chat_match_history")
    .select("id, partner_visitor, partner_nickname, created_at")
    .eq("visitor_id", visitorId)
    .order("created_at", { ascending: false })
    .limit(40);
  return (data as Array<{ id: string; partner_visitor: string; partner_nickname: string | null; created_at: string }>) || [];
}

/** Rekomendasi partner dengan minat mirip. */
export async function fetchInterestMatches(visitorId: string, interests: string[]) {
  if (!interests.length) return [];
  const { data } = await table("profile_social")
    .select("visitor_id, interests, activity_status, privacy_discover")
    .neq("visitor_id", visitorId)
    .overlaps("interests", interests)
    .limit(50);
  const rows = (data as SocialRow[]) || [];
  return rows
    .filter((r) => r.privacy_discover !== "nobody")
    .map((r) => ({
      visitorId: r.visitor_id,
      status: r.activity_status,
      shared: (r.interests || []).filter((i) => interests.includes(i)),
    }))
    .sort((a, b) => b.shared.length - a.shared.length)
    .slice(0, 12);
}

/* ============================================================
   BATCH 3 — AKUN: notifikasi, keamanan, perangkat, personalisasi, statistik
   ============================================================ */

export interface SettingsRow {
  visitor_id: string;
  notif_friend_online: boolean;
  notif_daily_reward: boolean;
  notif_level_up: boolean;
  sound_enabled: boolean;
  animation_enabled: boolean;
  accent_color: string;
  theme_mode: string;
}

export const ACCENT_COLORS: { key: string; label: string; class: string }[] = [
  { key: "violet", label: "Ungu", class: "from-violet-500 to-fuchsia-500" },
  { key: "sky", label: "Biru", class: "from-sky-500 to-cyan-400" },
  { key: "emerald", label: "Hijau", class: "from-emerald-500 to-teal-400" },
  { key: "amber", label: "Kuning", class: "from-amber-400 to-orange-500" },
  { key: "rose", label: "Merah", class: "from-rose-500 to-pink-500" },
];

export async function fetchSettings(visitorId: string): Promise<SettingsRow> {
  const { data } = await table("profile_settings").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (data) return data as SettingsRow;
  const { data: created } = await table("profile_settings").insert({ visitor_id: visitorId }).select("*").single();
  return (created as SettingsRow) ?? {
    visitor_id: visitorId, notif_friend_online: true, notif_daily_reward: true, notif_level_up: true,
    sound_enabled: true, animation_enabled: true, accent_color: "violet", theme_mode: "dark",
  };
}

export async function saveSettings(visitorId: string, patch: Partial<SettingsRow>) {
  await table("profile_settings").upsert({ visitor_id: visitorId, ...patch }, { onConflict: "visitor_id" });
}

export interface DeviceRow {
  id: string;
  device_key: string;
  label: string | null;
  platform: string | null;
  user_agent: string | null;
  last_active_at: string;
}

function currentDeviceKey() {
  const k = "profile_device_key";
  let v = localStorage.getItem(k);
  if (!v) { v = crypto.randomUUID(); localStorage.setItem(k, v); }
  return v;
}

export function thisDeviceKey() { return currentDeviceKey(); }

function guessLabel() {
  const ua = navigator.userAgent;
  const platform = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Perangkat";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Browser";
  return { platform, label: `${platform} • ${browser}` };
}

export async function touchDevice(visitorId: string) {
  const { platform, label } = guessLabel();
  await table("profile_devices").upsert(
    {
      visitor_id: visitorId, device_key: currentDeviceKey(), label, platform,
      user_agent: navigator.userAgent.slice(0, 300), last_active_at: new Date().toISOString(),
    },
    { onConflict: "visitor_id,device_key" },
  );
}

export async function fetchDevices(visitorId: string): Promise<DeviceRow[]> {
  const { data } = await table("profile_devices")
    .select("id, device_key, label, platform, user_agent, last_active_at")
    .eq("visitor_id", visitorId).order("last_active_at", { ascending: false });
  return (data as DeviceRow[]) || [];
}

export async function removeDevice(id: string) {
  await table("profile_devices").delete().eq("id", id);
}

export interface ActivityRow { id: string; action: string; detail: string | null; created_at: string }

export async function logActivity(visitorId: string, action: string, detail?: string) {
  await table("profile_activity_log").insert({ visitor_id: visitorId, action, detail: detail ?? null });
}

export async function fetchActivity(visitorId: string): Promise<ActivityRow[]> {
  const { data } = await table("profile_activity_log")
    .select("id, action, detail, created_at").eq("visitor_id", visitorId)
    .order("created_at", { ascending: false }).limit(50);
  return (data as ActivityRow[]) || [];
}

export interface AccountStats {
  partners: number;
  calls: number;
  messages: number;
  favorites: number;
  usageMinutes: number;
}

export async function fetchStats(visitorId: string): Promise<AccountStats> {
  const cnt = async (t: string, filter: (q: any) => any) => {
    const { count } = await filter(table(t).select("id", { count: "exact", head: true }));
    return count || 0;
  };
  const [partners, calls, messages, favorites] = await Promise.all([
    cnt("anon_chat_match_history", (q) => q.eq("visitor_id", visitorId)),
    cnt("anon_chat_call_logs", (q) => q.eq("visitor_id", visitorId)),
    cnt("anon_chat_messages", (q) => q.eq("sender_visitor_id", visitorId)),
    cnt("profile_favorites", (q) => q.eq("visitor_id", visitorId)),
  ]);
  const usageMinutes = Math.round(Number(localStorage.getItem(`usage_ms_${visitorId}`) || 0) / 60000);
  return { partners, calls, messages, favorites, usageMinutes };
}

/** Tambah akumulasi waktu penggunaan (dipanggil berkala oleh UI). */
export function bumpUsage(visitorId: string, ms: number) {
  const k = `usage_ms_${visitorId}`;
  localStorage.setItem(k, String(Number(localStorage.getItem(k) || 0) + ms));
}

import { supabase } from "@/integrations/supabase/client";
import { readFunctionError } from "@/lib/pin";

export type Plan = { code: string; name: string; duration_label: string; duration_seconds: number; price: number; popular: boolean };
export type BotRow = {
  id: string; name: string; telegram_username: string | null; owner_telegram_id: string | null; status: string; runtime: string;
  current_version: number | null; total_users: number | null; total_messages: number | null; total_commands: number | null;
  last_activity_at: string | null; started_at: string | null; created_at: string; has_token: boolean; webhook_set?: boolean; last_error?: string | null;
};
export type Rental = { id: string; status: string; slots: number; started_at: string; expires_at: string; last_transaction_id: string | null; bot_rental_plans?: { duration_label: string } | null };
export type BotTx = {
  transaction_id: string; kind: string; duration_label: string | null; slots_added: number; base_amount: number; discount: number; amount: number;
  previous_expires_at: string | null; new_expires_at: string | null; balance_before: number | null; balance_after: number | null; status: string; created_at: string;
};

export async function botApi<T = any>(body: Record<string, unknown>): Promise<T & { error?: string; code?: string }> {
  const { data, error } = await supabase.functions.invoke("bot-rental", { body });
  if (error) {
    const msg = (await readFunctionError(error)) || "Gagal menghubungi server";
    let code: string | undefined;
    try { code = (await (error as any)?.context?.clone?.().json())?.code; } catch { /* ignore */ }
    return { error: msg, code } as any;
  }
  return data as any;
}

export const rupiah = (n: number | null | undefined) => "Rp" + Number(n ?? 0).toLocaleString("id-ID");
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
export function timeLeft(expires: string, now = Date.now()) {
  let s = Math.max(0, Math.floor((new Date(expires).getTime() - now) / 1000));
  if (s === 0) return "Habis";
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  return d > 0 ? `${d} hari ${h} jam` : h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
}
export const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "🟢 AKTIF", tone: "text-emerald-400" },
  STOPPED: { label: "🔴 STOPPED", tone: "text-muted-foreground" },
  FROZEN: { label: "🟠 EXPIRED — MASA SEWA HABIS", tone: "text-destructive" },
  EXPIRED: { label: "MASA SEWA HABIS", tone: "text-destructive" },
  DEPLOYING: { label: "🟡 STARTING", tone: "text-primary" },
  FAILED: { label: "⚠️ ERROR", tone: "text-destructive" },
  PENDING: { label: "MENUNGGU", tone: "text-muted-foreground" },
};
export const newRequestId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

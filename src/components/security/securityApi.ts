import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import type { LoginHistoryRow } from "./loginHistoryFormat";

export type SecuritySummary = {
  pinActive: boolean;
  twoFaEnabled: boolean;
  emailVerified: boolean | null;
  linkedLogin: boolean;
  devices30d: number;
  lastLoginAt: string | null;
  globalSignOutSupported: boolean;
};

export type ApiError = { message: string; code?: string };

async function call<T>(body: Record<string, unknown>): Promise<{ data?: T; error?: ApiError }> {
  const { data, error } = await supabase.functions.invoke("balance-auth", { body: { ...body, deviceVisitorId: getVisitorId() } });
  if (data?.error) return { error: { message: String(data.error), code: data.code } };
  if (error) {
    const ctx = (error as { context?: Response }).context;
    try {
      const j = ctx && typeof ctx.json === "function" ? await ctx.clone().json() : null;
      if (j?.error) return { error: { message: String(j.error), code: j.code } };
    } catch { /* ignore */ }
    return { error: { message: "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi." } };
  }
  return { data: data as T };
}

export function fetchSecuritySummary(visitorId: string) {
  return call<SecuritySummary & { success: boolean }>({ action: "security_summary", visitorId });
}

export function fetchLoginHistory(visitorId: string, opts: { days: 7 | 30 | 90; scope: "all" | "this" | "other"; before?: string | null; limit?: number }) {
  return call<{ history: LoginHistoryRow[]; hasMore: boolean; nextBefore: string | null }>({
    action: "login_history", visitorId, days: opts.days, scope: opts.scope, before: opts.before ?? null, limit: opts.limit ?? 10,
  });
}

import { supabase } from "@/integrations/supabase/client";

export const SLOT_PLANS: Record<string, { price: number; days: number | null; label: string }> = {
  "1m": { price: 10000, days: 30, label: "1 Bulan" },
  "2m": { price: 20000, days: 60, label: "2 Bulan" },
  "1y": { price: 30000, days: 365, label: "1 Tahun" },
  perm: { price: 50000, days: null, label: "Permanen" },
};

export type SlotHistory = { plan: string; label: string; price: number; created_at: string; expires_at: string | null };
export type SlotResult = {
  ok: boolean;
  error?: string;
  active: boolean;
  permanent: boolean;
  max_accounts: number;
  expires_at: string | null;
  history?: SlotHistory[];
};

const FALLBACK: SlotResult = { ok: false, active: false, permanent: false, max_accounts: 5, expires_at: null, history: [] };

async function call(body: Record<string, unknown>): Promise<SlotResult> {
  const { data, error } = await supabase.functions.invoke("account-slots", { body });
  if (error) return { ...FALLBACK, error: error.message || "Gagal menghubungi server" };
  return data as SlotResult;
}

export const getAccountSlotStatus = ({ data }: { data: { visitorId: string } }) =>
  call({ action: "status", visitorId: data.visitorId });

export const buyAccountSlots = ({ data }: { data: { visitorId: string; plan: "1m" | "2m" | "1y" | "perm"; pin: string } }) =>
  call({ action: "buy", ...data });

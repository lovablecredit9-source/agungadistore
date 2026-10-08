export const CONFESS_MESSAGE_MAX = 800;
export const rupiahC = (n: number | null | undefined) => "Rp" + Number(n || 0).toLocaleString("id-ID");

export type ConfessRecipient = { phone: string; name: string };

/** Hasil `action: "quote"` dari send-confession (dihitung server, frontend hanya menampilkan). */
export type ConfessQuote = {
  quote?: boolean;
  scheduled?: boolean;
  recipients?: number;
  paid_count?: number;
  free_count?: number;
  free_until?: Record<string, string>;
  price_normal?: number;
  trial_discount?: number;
  trial_blocked?: boolean;
  voucher_code?: string | null;
  voucher_percent?: number | null;
  voucher_discount?: number;
  voucher_error?: string | null;
  free_send_used?: boolean;
  free_sends_available?: number;
  total?: number;
  balance?: number;
  balance_after?: number;
  max_numbers?: number;
  subscription_until?: string | null;
  need_pin?: boolean;
  error?: string;
  code?: string;
  needSubscription?: boolean;
};

/** Panggil edge function dan selalu kembalikan JSON server (termasuk pesan error non-2xx). */
export async function callConfessFn<T = Record<string, unknown>>(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ error: `Server mengembalikan status ${res.status}` }));
    return { ok: res.ok && !data?.error, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Koneksi terputus. Periksa internet lalu coba lagi." } as T & { error?: string } };
  }
}

export function normalizeConfessPhone(raw: string): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  const n = d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d.startsWith("8") ? "62" + d : d;
  if (n.length < 9 || n.length > 16) return null;
  return n;
}

export function displayLocalPhone(p: string): string {
  const d = String(p || "").replace(/\D/g, "");
  return d.startsWith("62") ? "0" + d.slice(2) : d;
}

export function maskConfessPhone(p: string): string {
  const local = displayLocalPhone(p);
  if (local.length < 7) return local;
  return local.slice(0, 4) + "****" + local.slice(-3);
}

export function formatWibDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB";
}

export type ConfessSendResult = {
  trx_id: string; charged: number; recipients: ConfessRecipient[]; scheduled?: boolean; scheduledLabel?: string | null;
  duplicate?: boolean; free_send_used?: boolean; free_sends_granted?: number; free_until?: string | null; free_count?: number;
};

export type SubStatus = { active?: boolean; balance?: number | null; price?: number; days?: number; expires_at?: string | null };

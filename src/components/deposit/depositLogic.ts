// Aturan tampilan deposit (murni). Nilai final tetap ditentukan server (create-deposit & admin_approve_deposit).
export const QUICK_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000, 1000000] as const;
export const DEPOSIT_MIN = 1000;
export const DEPOSIT_MAX = 10_000_000;

export function formatRupiah(n: number) {
  return `Rp${Math.max(0, Math.floor(n)).toLocaleString("id-ID")}`;
}

/** Ambil digit saja dari input; huruf/tanda minus diabaikan. */
export function digitsOnly(raw: string) {
  return raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9);
}

export function validateDepositAmount(raw: string): { amount: number; error: string | null } {
  const clean = digitsOnly(raw);
  if (!clean) return { amount: 0, error: "Masukkan nominal deposit" };
  const amount = Number(clean);
  if (!Number.isSafeInteger(amount) || amount <= 0) return { amount: 0, error: "Nominal tidak valid" };
  if (amount < DEPOSIT_MIN) return { amount, error: `Minimal deposit ${formatRupiah(DEPOSIT_MIN)}` };
  if (amount > DEPOSIT_MAX) return { amount, error: `Maksimal deposit ${formatRupiah(DEPOSIT_MAX)}` };
  return { amount, error: null };
}

export type DepositStatus = "pending" | "approved" | "rejected" | "cancelled" | string;

export function depositStatusMeta(status: DepositStatus) {
  switch (status) {
    case "approved": return { dot: "🟢", label: "Approved", labelId: "Disetujui", tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" };
    case "rejected": return { dot: "🔴", label: "Rejected", labelId: "Ditolak", tone: "text-destructive bg-destructive/10 border-destructive/30" };
    case "cancelled": return { dot: "⚪", label: "Cancelled", labelId: "Dibatalkan", tone: "text-muted-foreground bg-muted border-border" };
    default: return { dot: "🟡", label: "Pending", labelId: "Menunggu Verifikasi", tone: "text-amber-500 bg-amber-500/10 border-amber-500/30" };
  }
}

/** Salinan aturan server `deposit_bonus_amount` — hanya untuk riwayat lama; preview modal memakai RPC server. */
export function bonusForApprovedDeposit(amount: number) {
  return amount >= 10000 ? Math.floor(amount * 0.1) : 0;
}

export const DEPOSIT_STEPS = ["Pilih Metode", "Masukkan Nominal", "Bayar", "Verifikasi", "Saldo Masuk"] as const;

/** Batas sama dengan bucket `deposit-proofs` & edge function `deposit-proof` (server cek ulang isi file). */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES: Record<string, string[]> = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] };

export function validateProofFile(f: { name: string; type: string; size: number }): string | null {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = PROOF_TYPES[f.type];
  if (!allowed || !allowed.includes(ext)) return "Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.";
  if (f.size <= 0) return "File kosong.";
  if (f.size > PROOF_MAX_BYTES) return "Ukuran file terlalu besar. Maksimal 5 MB.";
  return null;
}

/** Posisi stepper dari status server; tidak pernah dari timer. */
export function depositStepIndex(status: string | undefined, hasMethod: boolean, amountValid: boolean) {
  if (status === "approved") return 5; // semua selesai
  if (status) return 3; // pending/rejected/cancelled → tahap verifikasi
  return !hasMethod ? 0 : !amountValid ? 1 : 2;
}

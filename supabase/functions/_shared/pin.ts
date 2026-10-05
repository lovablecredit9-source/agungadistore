// Pengecekan PIN terpusat. PIN milik akun saldo, bukan milik perangkat:
// visitor_id perangkat lama yang pernah login ke akun yang sama ikut dikenali.

/** null = PIN benar, selain itu pesan error untuk ditampilkan. */
export async function verifyAccountPin(admin: any, visitorId: string, pin: unknown): Promise<string | null> {
  const { data, error } = await admin.rpc("verify_account_pin", {
    p_visitor_id: String(visitorId || ""),
    p_pin: String(pin ?? "").trim(),
  });
  if (error) {
    console.error("verify_account_pin error", error);
    return "Gagal memeriksa PIN, coba lagi";
  }
  return (data as string | null) ?? null;
}

/** visitor_id akun saldo tempat PIN disimpan. */
export async function accountPinVisitorId(admin: any, visitorId: string): Promise<string> {
  const { data } = await admin.rpc("pin_account_visitor_id", { p_visitor_id: visitorId });
  return (data as string) || visitorId;
}

/** Semua visitor_id yang terhubung ke akun yang sama. */
export async function linkedPinVisitorIds(admin: any, visitorId: string): Promise<string[]> {
  const { data } = await admin.rpc("pin_linked_visitor_ids", { p_visitor_id: visitorId });
  const ids = Array.isArray(data) ? (data as string[]) : [];
  return ids.length ? ids : [visitorId];
}

/** Akun ini sudah punya PIN (di akun atau perangkat terhubung)? */
export async function accountHasPin(admin: any, visitorId: string): Promise<boolean> {
  const ids = await linkedPinVisitorIds(admin, visitorId);
  const { data } = await admin.from("user_pins").select("id").in("visitor_id", ids).limit(1);
  return !!(data && data.length);
}

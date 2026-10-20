/** Formats the real provider response of "Cek Nomor XL/Axis" and "Cek Nomor Tri" into a readable card. */
export type SimRow = { icon: string; label: string; value: string };
export type SimPackage = { name: string; expiry: string | null; quotas: { name: string; remaining: string; total: string; percent: number | null }[] };
export type SimCard = { title: string; rows: SimRow[]; packages: SimPackage[] };

export const SIM_FEATURES = new Set(["tools.cekaxis", "tools.cekkartutri"]);

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function push(rows: SimRow[], icon: string, label: string, value: string | null) { if (value) rows.push({ icon, label, value }); }

export function parseSimCard(featureId: string, raw: string | null | undefined): SimCard | null {
  if (!SIM_FEATURES.has(featureId) || !raw) return null;
  let root: Record<string, unknown> | null;
  try { root = obj(JSON.parse(raw)); } catch { return null; }
  if (!root || root.status === false) return null;

  if (featureId === "tools.cekaxis") {
    const d = obj(root.data) ?? root;
    const nomor = str(d.msisdn);
    if (!nomor) return null;
    const rows: SimRow[] = [];
    push(rows, "📞", "Nomor", nomor);
    push(rows, "📡", "Operator", str(d.operator));
    push(rows, "📅", "Masa Aktif", str(d.active_period));
    push(rows, "⏳", "Masa Tenggang", str(d.grace_period));
    push(rows, "📦", "Sisa Kuota", str(d.quota_remaining));
    push(rows, "📊", "Total Kuota", str(d.quota_total));
    const volte = str(d.volte_status);
    if (volte) push(rows, "📶", "VoLTE", /^active$/i.test(volte) ? "✅ Aktif" : "❌ Tidak Aktif");
    push(rows, "🎁", "Paket", str(d.package_name));
    push(rows, "🌐", "Jaringan", str(d.net_type));
    push(rows, "🪪", "Registrasi", str(d.id_verified));
    push(rows, "⌛", "Umur Kartu", str(d.tenure));
    const packages: SimPackage[] = (Array.isArray(d.packages) ? d.packages : []).map(obj).filter(Boolean).map((p) => ({
      name: str(p!.name) ?? "Paket",
      expiry: str(p!.expiry),
      quotas: (Array.isArray(p!.quotas) ? p!.quotas : []).map(obj).filter(Boolean).map((q) => ({
        name: str(q!.name) ?? "Kuota", remaining: str(q!.remaining) ?? "-", total: str(q!.total) ?? "-",
        percent: typeof q!.percent === "number" && Number.isFinite(q!.percent) ? Math.max(0, Math.min(100, q!.percent)) : null,
      })),
    }));
    return { title: "INFO KARTU AXIS / XL", rows, packages };
  }

  const nomor = str(root.msisdn);
  if (!nomor) return null;
  const rows: SimRow[] = [];
  push(rows, "📞", "Nomor", nomor);
  push(rows, "📶", "Status Kartu", str(root.status_kartu));
  push(rows, "🪪", "Registrasi", str(root.status_registrasi));
  const end = str(root.tanggal_berakhir); const left = str(root.sisa_hari_aktif);
  push(rows, "📅", "Masa Aktif", end ? (left ? `${end} (${left} hari lagi)` : end) : null);
  push(rows, "🗓️", "Tanggal Aktivasi", str(root.tanggal_aktivasi));
  push(rows, "🎁", "Produk", str(root.produk));
  push(rows, "🌐", "Distribusi", str(root.distribusi));
  return { title: "INFO KARTU TRI (3)", rows, packages: [] };
}

/** Same text layout the WhatsApp bot uses, for the copy button. */
export function simCardText(c: SimCard, requestBy?: string | null): string {
  const lines = [`📱 *${c.title}*`, "", ...c.rows.map((r) => `${r.icon} *${r.label}:* ${r.value}`)];
  if (requestBy) lines.push("", `✅ *Request by:* ${requestBy}`);
  return lines.join("\n");
}

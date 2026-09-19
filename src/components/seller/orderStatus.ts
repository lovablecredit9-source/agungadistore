export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "⏳ Menunggu konfirmasi", cls: "text-yellow-300 border-yellow-500/30 bg-yellow-500/10" },
  proses: { label: "📦 Diproses", cls: "text-sky-300 border-sky-500/30 bg-sky-500/10" },
  dikirim: { label: "🚚 Dikirim", cls: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10" },
  selesai: { label: "✅ Selesai", cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
  batal: { label: "❌ Dibatalkan", cls: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
};

export const rp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId as getBillingVisitorId } from "@/lib/visitor-id";
import { toast } from "sonner";
import { Gift, Search, Loader2, X, Ticket, Crown, FileText, FileDown, Check } from "lucide-react";
import type { AnonPremiumPlan } from "./AnonPremiumDialog";

interface FoundUser {
  visitor_id: string;
  name: string;
  is_premium: boolean;
  plan_name: string | null;
  started_at: string | null;
  expires_at: string | null;
  days_left: number;
}

interface Invoice {
  trx_id: string;
  target_name: string;
  plan_name: string;
  days: number;
  expires_at: string;
  price: number;
  method: string;
  at: string;
}

const FALLBACK_PLANS: AnonPremiumPlan[] = [
  { code: "day", name: "1 Hari", days: 1, price: 5000, gems: 50 },
  { code: "week", name: "1 Minggu", days: 7, price: 20000, gems: 200 },
  { code: "month", name: "1 Bulan", days: 30, price: 30000, gems: 500 },
  { code: "year", name: "1 Tahun", days: 365, price: 50000, gems: 900 },
];

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-");

function invoiceText(inv: Invoice) {
  return [
    "==============================",
    "   INVOICE GIFT ANON PREMIUM",
    "      Agung Adi Store",
    "==============================",
    `No. Invoice : ${inv.trx_id}`,
    `Tanggal     : ${fmt(inv.at)}`,
    `Penerima    : ${inv.target_name}`,
    `Paket       : ${inv.plan_name} (${inv.days} hari)`,
    `Aktif s/d   : ${fmt(inv.expires_at)}`,
    `Pembayaran  : ${inv.method === "gem" ? `${inv.price} Gem` : rupiah(inv.price)}`,
    "------------------------------",
    "Status      : LUNAS",
    "Terima kasih telah menggunakan",
    "layanan Agung Adi Store.",
    "==============================",
  ].join("\n");
}

function downloadTxt(inv: Invoice) {
  const blob = new Blob([invoiceText(inv)], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `invoice-${inv.trx_id}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadPdf(inv: Invoice) {
  const w = window.open("", "_blank", "width=640,height=800");
  if (!w) return toast.error("Popup diblokir browser");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${inv.trx_id}</title>
  <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}
  h1{font-size:20px;margin:0 0 4px}.sub{color:#666;font-size:12px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;font-size:14px}td{padding:8px 0;border-bottom:1px solid #eee}
  td:first-child{color:#666;width:40%}.tot{margin-top:20px;font-size:18px;font-weight:700}
  .badge{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:99px;background:#dcfce7;color:#166534;font-size:12px;font-weight:700}</style>
  </head><body>
  <h1>Invoice Gift Anon Premium</h1><div class="sub">Agung Adi Store &middot; ${inv.trx_id}</div>
  <table>
    <tr><td>Tanggal</td><td>${fmt(inv.at)}</td></tr>
    <tr><td>Penerima</td><td>${inv.target_name}</td></tr>
    <tr><td>Paket</td><td>${inv.plan_name} (${inv.days} hari)</td></tr>
    <tr><td>Aktif sampai</td><td>${fmt(inv.expires_at)}</td></tr>
    <tr><td>Pembayaran</td><td>${inv.method === "gem" ? `${inv.price} Gem` : rupiah(inv.price)}</td></tr>
  </table>
  <div class="tot">Total: ${inv.method === "gem" ? `${inv.price} Gem` : rupiah(inv.price)}</div>
  <div class="badge">LUNAS</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 350);
}

export function AnonGiftDialog({
  open, onClose, visitorId, plans, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  visitorId: string;
  plans?: AnonPremiumPlan[];
  onSuccess?: () => void;
}) {
  const list = plans?.length ? plans : FALLBACK_PLANS;
  const [tab, setTab] = useState<"gift" | "voucher">("gift");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundUser[]>([]);
  const [target, setTarget] = useState<FoundUser | null>(null);
  const [planCode, setPlanCode] = useState("week");
  const [method, setMethod] = useState<"saldo" | "gem">("saldo");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [code, setCode] = useState("");

  if (!open) return null;
  const plan = list.find((p) => p.code === planCode) || list[0];

  async function call(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("anon-premium", {
      body: { visitorId, billingVisitorId: getBillingVisitorId(), ...body },
    });
    if (error) {
      let msg = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) msg = (await ctx.json())?.error || msg;
      } catch { /* abaikan */ }
      throw new Error(msg);
    }
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as Record<string, unknown>;
  }

  async function doSearch() {
    if (query.trim().length < 2) return toast.error("Masukkan minimal 2 karakter");
    setBusy(true);
    try {
      const d = await call({ action: "lookup", query: query.trim() });
      setResults((d.results as FoundUser[]) || []);
      setSearched(true);
      if (!((d.results as FoundUser[]) || []).length) toast.error("Akun tidak ditemukan atau sudah dihapus");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function doGift() {
    if (!target) return toast.error("Pilih penerima dulu");
    if (method === "saldo" && !/^\d{6}$/.test(pin)) return toast.error("Masukkan PIN 6 digit");
    setBusy(true);
    try {
      const d = await call({ action: "gift", targetVisitorId: target.visitor_id, plan: planCode, method, pin });
      setInvoice({
        trx_id: String(d.trx_id), target_name: String(d.target_name), plan_name: String(d.plan_name),
        days: Number(d.days), expires_at: String(d.expires_at), price: Number(d.price),
        method: String(d.method), at: new Date().toISOString(),
      });
      setPin("");
      toast.success(`🎁 Gift terkirim ke ${d.target_name}`);
      onSuccess?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function doRedeem() {
    if (!code.trim()) return toast.error("Masukkan kode voucher");
    setBusy(true);
    try {
      const d = await call({ action: "redeem_voucher", code: code.trim() });
      toast.success(`✅ Aktivasi berhasil! Premium +${d.days} hari`);
      setCode("");
      onSuccess?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-[#0d0a1f] border border-amber-400/25 rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-gradient-to-r from-amber-500/20 via-fuchsia-500/15 to-purple-600/20 backdrop-blur px-4 py-3 flex items-center gap-2 border-b border-white/10">
          <Gift className="w-5 h-5 text-amber-300" />
          <div className="flex-1">
            <h3 className="font-extrabold text-amber-100 text-[15px] leading-tight">Gift & Voucher Premium</h3>
            <p className="text-[11px] text-amber-200/70">Kirim premium ke teman atau tukar kode</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
            {([["gift", "🎁 Gift Premium"], ["voucher", "🎟️ Kode Voucher"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`py-2 rounded-xl text-[12px] font-bold transition ${tab === k ? "bg-amber-500/25 text-amber-100 border border-amber-400/40" : "text-slate-300"}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "voucher" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 p-3">
                <p className="text-[11px] text-purple-100/80 flex items-start gap-2">
                  <Ticket className="w-4 h-4 shrink-0 text-purple-300" />
                  Punya kode voucher premium Anon Chat dari event atau admin? Tukar di sini untuk aktivasi instan.
                </p>
              </div>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MASUKKAN KODE"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-3 text-sm text-white tracking-widest font-bold placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-normal outline-none focus:border-amber-400/60" />
              <button onClick={doRedeem} disabled={busy}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-fuchsia-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aktivasi Sekarang
              </button>
            </div>
          ) : invoice ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
                <div className="text-3xl mb-1">🎉</div>
                <p className="font-extrabold text-emerald-200 text-sm">Gift Berhasil Dikirim</p>
                <p className="text-[11px] text-emerald-100/70 mt-0.5">{invoice.target_name} kini premium sampai {fmt(invoice.expires_at)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1.5 text-[12px]">
                {[["No. Invoice", invoice.trx_id], ["Paket", `${invoice.plan_name} (${invoice.days} hari)`],
                  ["Pembayaran", invoice.method === "gem" ? `${invoice.price} Gem` : rupiah(invoice.price)],
                  ["Aktif s/d", fmt(invoice.expires_at)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="text-slate-400">{k}</span>
                    <span className="text-slate-100 font-semibold text-right break-all">{v}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => downloadPdf(invoice)} className="py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-[12px] font-bold flex items-center justify-center gap-1.5">
                  <FileDown className="w-4 h-4" /> Invoice PDF
                </button>
                <button onClick={() => downloadTxt(invoice)} className="py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-[12px] font-bold flex items-center justify-center gap-1.5">
                  <FileText className="w-4 h-4" /> Invoice TXT
                </button>
              </div>
              <button onClick={() => { setInvoice(null); setTarget(null); setResults([]); setQuery(""); setSearched(false); }}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-100 text-[12px] font-bold">
                Kirim Gift Lagi
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder="Username / email penerima"
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400/60" />
                <button onClick={doSearch} disabled={busy} className="px-4 rounded-xl bg-amber-500/25 border border-amber-400/40 text-amber-100 disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>

              {searched && !results.length && (
                <p className="text-center text-[12px] text-rose-300/80 py-3">Akun tidak ditemukan atau sudah dihapus.</p>
              )}

              {results.map((u) => (
                <button key={u.visitor_id} onClick={() => setTarget(u)}
                  className={`w-full text-left rounded-2xl border p-3 transition ${target?.visitor_id === u.visitor_id ? "border-amber-400/60 bg-amber-500/15" : "border-white/10 bg-white/5"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm truncate ${u.is_premium ? "text-amber-300" : "text-slate-100"}`}>{u.name}</span>
                    {u.is_premium && <span className="text-amber-400 text-xs">✅</span>}
                  </div>
                  {u.is_premium ? (
                    <p className="text-[10.5px] text-amber-100/70 mt-1 leading-relaxed">
                      Premium aktif ({u.plan_name}) · sisa {u.days_left} hari<br />
                      Mulai {fmt(u.started_at)} — Berakhir {fmt(u.expires_at)}
                    </p>
                  ) : (
                    <p className="text-[10.5px] text-slate-400 mt-1">Belum premium</p>
                  )}
                </button>
              ))}

              {target && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {list.map((p) => (
                      <button key={p.code} onClick={() => setPlanCode(p.code)}
                        className={`rounded-2xl border p-2.5 text-left transition ${planCode === p.code ? "border-amber-400/60 bg-amber-500/15" : "border-white/10 bg-white/5"}`}>
                        <div className="flex items-center gap-1 text-[12px] font-bold text-slate-100"><Crown className="w-3 h-3 text-amber-300" /> {p.name}</div>
                        <div className="text-[11px] text-emerald-300 font-semibold mt-0.5">{rupiah(p.price)}</div>
                        {p.gems != null && <div className="text-[10px] text-cyan-300">atau {p.gems} 💎</div>}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(["saldo", "gem"] as const).map((m) => (
                      <button key={m} onClick={() => setMethod(m)} disabled={m === "gem" && plan.gems == null}
                        className={`py-2.5 rounded-xl text-[12px] font-bold border transition disabled:opacity-40 ${method === m ? "border-amber-400/60 bg-amber-500/20 text-amber-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
                        {m === "saldo" ? "💰 Saldo" : "💎 Gem"}
                      </button>
                    ))}
                  </div>

                  {method === "saldo" && (
                    <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric" placeholder="PIN 6 digit"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white tracking-[0.4em] outline-none focus:border-amber-400/60" />
                  )}

                  <button onClick={doGift} disabled={busy}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-fuchsia-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                    Kirim Gift ke {target.name}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, RefreshCw, Copy, QrCode, Check, Download } from "lucide-react";

// Card shown on the balance page for the logged-in user: displays a permanent
// login code (e.g. XPJD8HS) + QR barcode so another device can log in instantly.
export default function DeviceLoginCode({ visitorId }: { visitorId: string }) {
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildQr = useCallback(async (value: string, sig: string) => {
    try {
      // Sertakan tanda tangan (sig) agar barcode hanya sah dari website resmi
      const url = await QRCode.toDataURL(`AAS-LOGIN:${value}:${sig}`, {
        margin: 1,
        width: 240,
        color: { dark: "#be185d", light: "#ffffff" },
      });
      setQr(url);
    } catch {
      setQr(null);
    }
  }, []);

  const load = useCallback(async (regenerate = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("balance-auth", {
        body: {
          action: regenerate ? "regenerate_login_code" : "get_login_code",
          visitorId,
        },
      });
      if (error || data?.error) {
        toast({ title: "Gagal", description: data?.error || error?.message || "Coba lagi", variant: "destructive" });
        return;
      }
      setCode(data.code);
      await buildQr(data.code, data.sig || "");
      if (regenerate) toast({ title: "Kode diperbarui", description: "Kode & barcode lama tidak berlaku lagi." });
    } finally {
      setLoading(false);
    }
  }, [toast, buildQr, visitorId]);

  useEffect(() => { load(false); }, [load]);

  function copyCode() {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: "Kode disalin", description: code });
  }

  return (
    <div className="rounded-2xl border border-pink-200/60 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white">
          <QrCode className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Login Cepat Perangkat Lain</p>
          <p className="text-[11px] text-muted-foreground">Tanpa email & sandi — cukup kode/barcode</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-xl bg-white p-2 shadow-sm">
          {qr ? (
            <img src={qr} alt="Barcode login" className="h-28 w-28" />
          ) : (
            <div className="h-28 w-28 animate-pulse rounded bg-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[11px] text-muted-foreground">Kode Login</p>
            <p className="font-mono text-2xl font-extrabold tracking-[0.2em] text-pink-600 dark:text-pink-400 break-all">
              {code || "•••••••"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={copyCode} disabled={!code}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Salin
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => load(true)} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Ganti
            </Button>
          </div>
        </div>
      </div>
      <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
        <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />
        Di perangkat lain, buka halaman Saldo → Login via Kode/Barcode, lalu masukkan kode ini atau scan barcode-nya.
      </p>
    </div>
  );
}

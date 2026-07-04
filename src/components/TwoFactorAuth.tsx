import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Download, Copy, Check, KeyRound, RefreshCw, Eye, EyeOff } from "lucide-react";

// Pilihan variasi warna barcode 2FA
const COLOR_VARIANTS: { name: string; dark: string; light: string }[] = [
  { name: "Pink", dark: "#be185d", light: "#ffffff" },
  { name: "Ungu", dark: "#7c3aed", light: "#ffffff" },
  { name: "Biru", dark: "#2563eb", light: "#ffffff" },
  { name: "Hijau", dark: "#059669", light: "#ffffff" },
  { name: "Hitam", dark: "#111827", light: "#ffffff" },
  { name: "Oranye", dark: "#ea580c", light: "#fff7ed" },
];

interface Props {
  stage: "setup" | "verify";
  otpauth?: string;
  secret?: string;
  backupCodes?: string[];
  loading?: boolean;
  onSubmitCode: (code: string) => void;
  onCancel: () => void;
}

export default function TwoFactorAuth({ stage, otpauth, secret, backupCodes, loading, onSubmitCode, onCancel }: Props) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [variant, setVariant] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [backupVisible, setBackupVisible] = useState(false);

  const buildQr = useCallback(async () => {
    if (!otpauth) return;
    try {
      const v = COLOR_VARIANTS[variant];
      const url = await QRCode.toDataURL(otpauth, { margin: 1, width: 256, color: { dark: v.dark, light: v.light } });
      setQr(url);
    } catch {
      setQr(null);
    }
  }, [otpauth, variant]);

  useEffect(() => { if (stage === "setup") buildQr(); }, [stage, buildQr]);

  function downloadQr() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `2fa-barcode-${COLOR_VARIANTS[variant].name.toLowerCase()}.png`;
    a.click();
    toast({ title: "Barcode diunduh" });
  }

  function copySecret() {
    if (!secret) return;
    navigator.clipboard?.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copyBackup() {
    if (!backupCodes?.length) return;
    navigator.clipboard?.writeText(backupCodes.join("\n"));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 1500);
  }

  function downloadBackup() {
    if (!backupCodes?.length) return;
    const blob = new Blob(
      ["Kode Cadangan 2FA — Agung Adi Store\n(Simpan aman, tiap kode hanya bisa dipakai sekali)\n\n" + backupCodes.join("\n")],
      { type: "text/plain" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "2fa-kode-cadangan.txt";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-pink-200/60 bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">
              {stage === "setup" ? "Aktifkan Verifikasi 2 Langkah" : "Verifikasi 2 Langkah"}
            </p>
            <p className="text-[11px] text-muted-foreground">Google Authenticator / Authy</p>
          </div>
        </div>

        {stage === "setup" ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Scan barcode ini di aplikasi <b>Google Authenticator</b>, lalu masukkan 6 digit kode yang muncul.
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                {qr ? <img src={qr} alt="Barcode 2FA" className="h-44 w-44" /> : <div className="h-44 w-44 animate-pulse rounded bg-muted" />}
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {COLOR_VARIANTS.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => setVariant(i)}
                    className={`h-7 w-7 rounded-full border-2 transition ${variant === i ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ background: c.dark }}
                    title={c.name}
                    aria-label={`Warna ${c.name}`}
                  />
                ))}
              </div>
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={downloadQr}>
                <Download className="h-3.5 w-3.5" /> Download Barcode
              </Button>
            </div>

            {secret && (
              <div className="rounded-lg bg-secondary/60 p-2.5">
                <p className="text-[11px] text-muted-foreground">Atau masukkan kunci manual:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-xs font-bold text-pink-600 dark:text-pink-400">{secret}</code>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={copySecret}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            {backupCodes && backupCodes.length > 0 && (
              <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/20">
                <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <KeyRound className="h-3.5 w-3.5" /> 8 Kode Cadangan (6 digit)
                </p>
                <Button size="sm" variant="outline" className="mb-2 h-7 w-full gap-1 text-xs" onClick={() => setBackupVisible((v) => !v)}>
                  {backupVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {backupVisible ? "Sembunyikan kode" : "Tampilkan kode"}
                </Button>
                {backupVisible && (
                  <div className="grid grid-cols-2 gap-1 font-mono text-sm font-semibold text-foreground">
                    {backupCodes.map((c) => <div key={c} className="rounded bg-background/70 px-2 py-1 text-center tracking-wider">{c}</div>)}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={copyBackup}>
                    {copiedBackup ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Salin
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={downloadBackup}>
                    <Download className="h-3.5 w-3.5" /> Unduh
                  </Button>
                </div>
                <label className="mt-2 flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                  <input type="checkbox" checked={savedConfirmed} onChange={(e) => setSavedConfirmed(e.target.checked)} className="mt-0.5" />
                  Saya sudah menyimpan kode cadangan ini di tempat aman.
                </label>
              </div>
            )}

            <div>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="Masukkan 6 digit dari authenticator"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-lg font-bold tracking-[0.3em]"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Batal</Button>
              <Button
                className="flex-1"
                onClick={() => onSubmitCode(code)}
                disabled={loading || code.length !== 6 || (!!backupCodes?.length && !savedConfirmed)}
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Aktifkan & Masuk"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Masukkan 6 digit kode dari <b>Google Authenticator</b>, atau salah satu <b>kode cadangan</b> kamu.
            </p>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digit kode"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-lg font-bold tracking-[0.3em]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Batal</Button>
              <Button className="flex-1" onClick={() => onSubmitCode(code)} disabled={loading || code.length !== 6}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Verifikasi & Masuk"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

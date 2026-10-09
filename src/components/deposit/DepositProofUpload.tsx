import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImageUp, Loader2, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateProofFile, PROOF_MAX_BYTES } from "./depositLogic";

interface Props {
  depositId: string;
  visitorId: string;
  status: string;
  onUploaded?: () => void;
}

const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Upload bukti bayar ke server. Upload ≠ pembayaran terverifikasi; status tetap dari admin. */
export default function DepositProofUpload({ depositId, visitorId, status, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const editable = status === "pending";

  useEffect(() => {
    let alive = true;
    supabase.functions.invoke("deposit-proof", { body: { action: "my_url", depositId, visitorId } }).then(({ data }) => {
      if (!alive || !data) return;
      setServerUrl((data as { url?: string }).url ?? null);
      setUploadedAt((data as { proof_uploaded_at?: string }).proof_uploaded_at ?? null);
    });
    return () => { alive = false; };
  }, [depositId, visitorId]);

  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);

  function pick(f: File | undefined) {
    setErr(null);
    if (!f) return;
    const v = validateProofFile(f);
    if (v) { setErr(v); return; }
    if (localUrl) URL.revokeObjectURL(localUrl);
    setFile(f); setLocalUrl(URL.createObjectURL(f));
  }

  async function upload() {
    if (!file || progress !== null) return;
    setErr(null); setProgress(0);
    const { data: { session } } = await supabase.auth.getSession();
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const fd = new FormData();
    fd.append("depositId", depositId); fd.append("visitorId", visitorId); fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deposit-proof`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("Authorization", `Bearer ${session?.access_token ?? key}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => { setProgress(null); setErr(navigator.onLine ? "Upload gagal karena gangguan jaringan. Coba lagi." : "Tidak ada koneksi internet."); };
    xhr.onload = () => {
      setProgress(null);
      let body: { error?: string; url?: string; proof_uploaded_at?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* noop */ }
      if (xhr.status >= 200 && xhr.status < 300 && !body.error) {
        setServerUrl(body.url ?? localUrl); setUploadedAt(body.proof_uploaded_at ?? new Date().toISOString());
        setFile(null); onUploaded?.();
      } else setErr(body.error || `Upload gagal (kode ${xhr.status}).`);
    };
    xhr.send(fd);
  }

  const shown = localUrl || serverUrl;
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">Bukti Pembayaran</p>
      {!shown ? (
        editable ? (
          <button type="button" onClick={() => inputRef.current?.click()} className="dep-dropzone w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 text-center transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ImageUp className="dep-float mx-auto w-8 h-8 text-primary" />
            <p className="mt-2 text-sm font-bold text-foreground">Upload Bukti Pembayaran</p>
            <p className="text-[10.5px] text-muted-foreground">JPG / PNG / WEBP · maks {PROOF_MAX_BYTES / 1024 / 1024} MB</p>
            <span className="mt-3 inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground">Pilih File</span>
          </button>
        ) : <p className="text-[11px] text-muted-foreground rounded-xl bg-muted/40 px-3 py-2">Tidak ada bukti yang diupload.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-muted/30 p-2.5 space-y-2">
          <div className="rounded-xl bg-background overflow-hidden flex items-center justify-center max-h-64">
            <img src={shown} alt="Pratinjau bukti pembayaran" className="max-h-64 w-auto object-contain" />
          </div>
          {file ? (
            <p className="text-[11px] text-foreground truncate"><span className="font-semibold">{file.name}</span> · {fmtSize(file.size)}</p>
          ) : uploadedAt && (
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Bukti tersimpan — menunggu pengecekan admin</p>
          )}
          {progress !== null && (
            <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="dep-progress h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          {editable && (
            <div className="grid grid-cols-2 gap-2">
              {file ? (
                <>
                  <button type="button" disabled={progress !== null} onClick={() => { setFile(null); setLocalUrl(null); }} className="h-10 rounded-xl border border-border text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                  <button type="button" disabled={progress !== null} onClick={upload} className="h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-70">
                    {progress !== null ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress}%</> : <><ImageUp className="w-3.5 h-3.5" /> Kirim ke Admin</>}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => inputRef.current?.click()} className="col-span-2 h-10 rounded-xl border border-border text-xs font-bold inline-flex items-center justify-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Ganti Bukti</button>
              )}
            </div>
          )}
        </div>
      )}
      {err && <p className="text-[11px] text-destructive flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {err}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

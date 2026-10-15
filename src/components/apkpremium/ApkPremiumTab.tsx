import { useEffect, useMemo, useState } from "react";
import { Search, PlayCircle, Music2, Film, Loader2, AlertCircle, Sparkles, ChevronLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FeatureRunner from "./FeatureRunner";
import { apkApi, CAT_ORDER, type ApkCatalog, type ApkFeaturePublic, type NormItem } from "./api";

type YtMode = "search" | "mp3" | "mp4";
const YT_IDS: Record<YtMode, string> = { search: "search.youtube", mp3: "downloader.ytmp3", mp4: "downloader.ytmp4" };

function TierBadge({ f }: { f: ApkFeaturePublic }) {
  if (!f.tier) return null;
  return <span title="Endpoint ini butuh API key paket Premium/Enterprise dari provider" className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">{f.tier === "enterprise" ? "Enterprise" : "Premium"}</span>;
}

function StatusBadge({ f }: { f: ApkFeaturePublic }) {
  return f.available
    ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Aktif</span>
    : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Belum aktif</span>;
}

export default function ApkPremiumTab() {
  const [cat, setCat] = useState<ApkCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string>("youtube");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ApkFeaturePublic | null>(null);
  const [yt, setYt] = useState<YtMode>("search");
  const [ytPrefill, setYtPrefill] = useState<{ url: string; key: number } | null>(null);

  const load = async () => {
    setLoading(true); setLoadErr(null);
    const r = await apkApi<ApkCatalog>({ action: "catalog" });
    if (r.error || !r.features) setLoadErr(r.error || "Gagal memuat fitur");
    else setCat(r);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const byId = useMemo(() => new Map((cat?.features ?? []).map((f) => [f.id, f])), [cat]);
  const cats = useMemo(() => {
    const present = new Set((cat?.features ?? []).map((f) => f.cat));
    return [...CAT_ORDER.filter((c) => present.has(c)), ...[...present].filter((c) => !CAT_ORDER.includes(c))];
  }, [cat]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (cat?.features ?? []).filter((f) => (q ? `${f.label} ${f.id} ${f.help} ${f.desc ?? ""}`.toLowerCase().includes(q) : f.cat === activeCat));
  }, [cat, activeCat, query]);

  const ytFeature = byId.get(YT_IDS[yt]);
  const ytInitial = useMemo(() => (yt !== "search" && ytPrefill ? { url: ytPrefill.url } : undefined), [yt, ytPrefill]);
  const ytActions = (it: NormItem) => it.url && /youtu\.?be/.test(it.url) ? (
    <>
      <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1" onClick={() => { setYt("mp3"); setYtPrefill({ url: it.url!, key: Date.now() }); }}><Music2 className="h-3 w-3" />MP3</Button>
      <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1" onClick={() => { setYt("mp4"); setYtPrefill({ url: it.url!, key: Date.now() }); }}><Film className="h-3 w-3" />MP4</Button>
    </>
  ) : null;

  return (
    <section className="mx-auto w-full max-w-5xl px-3 pb-28 pt-3 sm:px-4 space-y-4" aria-labelledby="apk-premium-title">
      <header className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 id="apk-premium-title" className="text-lg sm:text-xl font-extrabold text-foreground">APK PREMIUM</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Downloader, AI, pencarian & tools berbasis web. Hasil diambil langsung dari provider, bukan contoh.</p>
            {cat?.docs_total ? <p className="mt-1 text-[11px] text-muted-foreground">{cat.features.length} fitur tersedia dari {cat.docs_total} endpoint dokumentasi provider{cat.excluded_total ? ` • ${cat.excluded_total} tidak disediakan karena alasan keamanan/khusus WhatsApp` : ""}.</p> : null}
          </div>
        </div>
        {cat && !cat.provider.configured && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"><AlertCircle className="h-4 w-4 shrink-0" />Provider belum dikonfigurasi admin. Fitur akan aktif setelah admin mengisi API key.</p>
        )}
        {cat && cat.provider.configured && !cat.provider.enabled && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"><AlertCircle className="h-4 w-4 shrink-0" />Provider sedang dinonaktifkan admin.</p>
        )}
      </header>

      {loading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Memuat fitur…</div>}
      {loadErr && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-center justify-between gap-2">
          <span>{loadErr}</span><Button size="sm" variant="outline" onClick={() => void load()} className="gap-1"><RefreshCw className="h-3.5 w-3.5" />Coba lagi</Button>
        </div>
      )}

      {cat && !open && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Cari fitur" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Cari di ${cat.features.length} fitur…`} className="pl-9" />
          </div>
          <nav aria-label="Kategori APK PREMIUM" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {["youtube", ...cats].map((c) => (
              <button
                key={c} type="button" onClick={() => { setActiveCat(c); setQuery(""); }}
                aria-current={activeCat === c && !query ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activeCat === c && !query ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}
              >
                {c === "youtube" ? "YouTube" : cat.categories[c] ?? c}
              </button>
            ))}
          </nav>

          {activeCat === "youtube" && !query ? (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-destructive" /><h2 className="font-bold text-foreground">YouTube</h2></div>
              <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {(["search", "mp3", "mp4"] as YtMode[]).map((m) => (
                  <button key={m} role="tab" aria-selected={yt === m} type="button" onClick={() => setYt(m)}
                    className={`rounded-lg py-1.5 text-xs font-semibold ${yt === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                    {m === "search" ? "Search" : m.toUpperCase()}
                  </button>
                ))}
              </div>
              {ytFeature ? (
                <FeatureRunner
                  key={ytFeature.id}
                  feature={ytFeature}
                  submitLabel={yt === "search" ? "Cari" : `Konversi ${yt.toUpperCase()}`}
                  initial={ytInitial}
                  autoRunKey={yt !== "search" ? ytPrefill?.key : undefined}
                  itemActions={yt === "search" ? ytActions : undefined}
                />
              ) : <p className="text-sm text-muted-foreground">Fitur ini disembunyikan admin.</p>}
              <p className="text-[11px] text-muted-foreground">Hanya unduh konten yang kamu miliki haknya atau diizinkan pemiliknya.</p>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => setOpen(f)} className="w-full text-left rounded-xl border border-border bg-card p-3 hover:bg-muted/60 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">{f.label}</span><span className="flex shrink-0 gap-1"><TierBadge f={f} /><StatusBadge f={f} /></span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{cat.categories[f.cat] ?? f.cat} • {f.desc || f.help || f.id}</p>
                  </button>
                </li>
              ))}
              {!list.length && <li className="col-span-full py-8 text-center text-sm text-muted-foreground">Tidak ada fitur yang cocok.</li>}
            </ul>
          )}
        </>
      )}

      {open && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <button type="button" onClick={() => setOpen(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" />Kembali</button>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-foreground">{open.label}</h2><span className="flex shrink-0 gap-1"><TierBadge f={open} /><StatusBadge f={open} /></span>
          </div>
          {open.desc && <p className="text-sm text-foreground/90">{open.desc}</p>}
          <p className="text-xs text-muted-foreground">{cat?.categories[open.cat] ?? open.cat}{open.help ? ` • contoh perintah asal: ${open.help}` : ""}</p>
          {open.tier && <p className="text-[11px] text-muted-foreground">Menurut dokumentasi provider, fitur ini hanya untuk API key paket {open.tier === "enterprise" ? "Enterprise" : "Premium"}. Dengan key gratis, provider bisa menolak permintaan.</p>}
          <FeatureRunner key={open.id} feature={open} />
        </div>
      )}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Search, PlayCircle, Music2, Film, Loader2, AlertCircle, Sparkles, ChevronLeft, RefreshCw, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import FeatureRunner from "./FeatureRunner";
import YoutubeHistory from "./YoutubeHistory";
import { addHistory, clearHistory, loadHistory, removeHistory, type YtHistoryItem } from "./youtubeHistory";
import { apkApi, CAT_ORDER, type ApkCatalog, type ApkFeaturePublic, type NormItem, type RunResult } from "./api";

type YtMode = "search" | "mp3" | "mp4";
const YT_IDS: Record<YtMode, string> = { search: "search.youtube", mp3: "downloader.ytmp3", mp4: "downloader.ytmp4" };
const YT_TAB: Record<YtMode, { label: string; icon: typeof Search }> = { search: { label: "Search YouTube", icon: Search }, mp3: { label: "Download MP3", icon: Music2 }, mp4: { label: "Download MP4", icon: Film } };

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
  const [ytView, setYtView] = useState<"tools" | "history">("tools");
  const [ytPrefill, setYtPrefill] = useState<{ mode: YtMode; values: Record<string, string>; key: number } | null>(null);
  const [hist, setHist] = useState<YtHistoryItem[]>(() => loadHistory());

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

  const searchKey = byId.get(YT_IDS.search)?.params[0]?.key ?? "q";
  const go = (mode: YtMode, values: Record<string, string>) => { setYtView("tools"); setYt(mode); setYtPrefill({ mode, values, key: Date.now() }); };
  const ytActions = (it: NormItem) => it.url && /youtu\.?be/.test(it.url) ? (
    <>
      <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1" onClick={() => { setHist(addHistory({ type: "select", title: it.title || it.url!, url: it.url, thumbnail: it.image })); go("mp3", { url: it.url! }); }}><Music2 className="h-3 w-3" />MP3</Button>
      <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1" onClick={() => { setHist(addHistory({ type: "select", title: it.title || it.url!, url: it.url, thumbnail: it.image })); go("mp4", { url: it.url! }); }}><Film className="h-3 w-3" />MP4</Button>
    </>
  ) : null;
  /** Saves every finished search/conversion automatically with its real outcome. */
  const onYtResult = (mode: YtMode) => (vals: Record<string, string>, r: RunResult) => {
    const n = r.normalized;
    if (mode === "search") {
      const q = (vals[searchKey] ?? "").trim();
      if (!q) return;
      setHist(addHistory({ type: "search", title: q, thumbnail: n?.items.find((i) => i.image)?.image, status: r.ok ? "ok" : "fail", error: r.ok ? undefined : r.error }));
    } else {
      const url = (vals.url ?? "").trim();
      if (!url) return;
      const known = hist.find((h) => h.url === url && h.title !== url);
      setHist(addHistory({
        type: mode, url, title: n?.title || known?.title || url, thumbnail: n?.items[0]?.image || n?.media.find((m) => m.kind === "image")?.url || known?.thumbnail,
        quality: mode === "mp4" ? (vals.quality || byId.get(YT_IDS.mp4)?.params.find((p) => p.key === "quality")?.default) : undefined,
        status: r.ok ? "ok" : "fail", error: r.ok ? undefined : r.error,
      }));
    }
    toast.success("Tersimpan di riwayat", { duration: 1500 });
  };
  const openHist = (h: YtHistoryItem) => {
    if (h.type === "search") go("search", { [searchKey]: h.title });
    else if (h.url) go(h.type === "mp4" ? "mp4" : h.type === "mp3" ? "mp3" : "mp3", h.quality ? { url: h.url, quality: h.quality } : { url: h.url });
  };

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
            {cat?.docs_total ? <p className="mt-1 text-[11px] text-muted-foreground">Dokumentasi provider: {cat.docs_total} endpoint • {cat.docs_features ?? cat.features.length} tersedia di sini{cat.excluded_total ? ` • ${cat.excluded_total} tidak disediakan (keamanan/khusus WhatsApp/internal provider)` : ""}.</p> : null}
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
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
              <div className="bg-gradient-to-br from-destructive/25 via-primary/10 to-transparent p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive text-destructive-foreground shadow-md"><PlayCircle className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <h2 className="font-extrabold text-foreground">YouTube Downloader Pro</h2>
                      <p className="truncate text-[11px] text-muted-foreground">Cari video, lalu ubah ke MP3 atau MP4</p>
                    </div>
                  </div>
                  <Button size="sm" variant={ytView === "history" ? "default" : "outline"} className="h-9 shrink-0 gap-1.5" onClick={() => setYtView((v) => (v === "history" ? "tools" : "history"))} aria-pressed={ytView === "history"}>
                    {ytView === "history" ? <><ChevronLeft className="h-4 w-4" />Kembali</> : <><History className="h-4 w-4" />Riwayat{hist.length ? ` (${hist.length})` : ""}</>}
                  </Button>
                </div>
              </div>
              <div className="space-y-3 p-4 sm:p-5">
                {ytView === "history" ? (
                  <YoutubeHistory
                    items={hist}
                    onOpen={openHist}
                    onConvert={(h, m) => go(m, { url: h.url! })}
                    onRemove={(id) => { setHist(removeHistory(id)); toast.success("Item riwayat dihapus"); }}
                    onClear={() => { setHist(clearHistory()); toast.success("Semua riwayat dihapus"); }}
                  />
                ) : (
                  <>
                    <div role="tablist" aria-label="Mode YouTube" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                      {(["search", "mp3", "mp4"] as YtMode[]).map((m) => {
                        const T = YT_TAB[m];
                        return (
                          <button key={m} role="tab" aria-selected={yt === m} type="button" onClick={() => setYt(m)}
                            className={`flex min-h-10 items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold transition-all sm:text-xs ${yt === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                            <T.icon className={`h-3.5 w-3.5 shrink-0 ${yt === m ? "text-destructive" : ""}`} /><span className="truncate sm:hidden">{m === "search" ? "Search" : m.toUpperCase()}</span><span className="hidden truncate sm:inline">{T.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {(["search", "mp3", "mp4"] as YtMode[]).map((m) => {
                      const f = byId.get(YT_IDS[m]);
                      return (
                        <div key={m} role="tabpanel" hidden={yt !== m}>
                          {f ? (
                            <FeatureRunner
                              feature={f}
                              submitLabel={m === "search" ? "Cari" : `Konversi ${m.toUpperCase()}`}
                              initial={ytPrefill?.mode === m ? ytPrefill.values : undefined}
                              autoRunKey={ytPrefill?.mode === m ? ytPrefill.key : undefined}
                              itemActions={m === "search" ? ytActions : undefined}
                              onResult={onYtResult(m)}
                            />
                          ) : <p className="text-sm text-muted-foreground">Fitur ini sedang dinonaktifkan admin.</p>}
                        </div>
                      );
                    })}
                  </>
                )}
                <p className="text-[11px] text-muted-foreground">Hanya unduh konten yang kamu miliki haknya atau diizinkan pemiliknya. Riwayat disimpan otomatis di perangkat ini, tanpa data rahasia.</p>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((f) => (
                <li key={f.id} className="min-w-0">
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
          {cat.excluded?.length ? (
            <details className="rounded-xl border border-border bg-card p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-foreground">Endpoint yang tidak disediakan ({cat.excluded.length}, termasuk dari source bot) — lihat alasannya</summary>
              <p className="mt-2 text-muted-foreground">Endpoint ini ada di dokumentasi provider, tetapi tidak dibuka di toko karena spam, pemalsuan/penipuan, bypass keamanan, butuh akun/password pihak ketiga, atau khusus sistem internal provider.</p>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
                {cat.excluded.map((e) => (
                  <li key={e.path} className="flex flex-wrap justify-between gap-x-2 border-b border-border/50 py-1 last:border-0">
                    <code className="break-all text-foreground">{e.path}</code><span className="text-muted-foreground">{e.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
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

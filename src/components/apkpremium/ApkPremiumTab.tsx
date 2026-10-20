import { useEffect, useMemo, useState } from "react";
import { Search, PlayCircle, Music2, Film, Loader2, AlertCircle, Sparkles, ChevronLeft, RefreshCw, History, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import FeatureRunner from "./FeatureRunner";
import YoutubeHistory from "./YoutubeHistory";
import YtMediaPlayer from "./YtMediaPlayer";
import ApkBalanceCard from "./ApkBalanceCard";
import { useYtHistory, type NewEntry, type YtEntry } from "./useYtHistory";
import { setApkVisitor, apkApi, CAT_ORDER, type ApkCatalog, type ApkFeaturePublic, type NormItem, type RunResult } from "./api";

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

const firstHttps = (u?: string | null) => (u && /^https:\/\//i.test(u) ? u : undefined);
const metaDuration = (n?: RunResult["normalized"]) => n?.items.flatMap((i) => i.meta).find((m) => /durasi|duration/i.test(m.k))?.v;

export default function ApkPremiumTab({ visitorId, onTopUp, onNeedLogin }: { visitorId: string; onTopUp: () => void; onNeedLogin: () => void }) {
  setApkVisitor(visitorId);
  useEffect(() => () => setApkVisitor(null), []);
  const [cat, setCat] = useState<ApkCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string>("youtube");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ApkFeaturePublic | null>(null);
  const [yt, setYt] = useState<YtMode>("search");
  const [ytView, setYtView] = useState<"tools" | "history" | "media">("tools");
  const [ytPrefill, setYtPrefill] = useState<{ mode: YtMode; values: Record<string, string>; key: number } | null>(null);
  const [playing, setPlaying] = useState<YtEntry | null>(null);
  const h = useYtHistory(visitorId);
  const hist = h.items;

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
  const stats = useMemo(() => {
    const media = hist.filter((i) => (i.type === "mp3" || i.type === "mp4") && i.status === "ok");
    return { search: hist.filter((i) => i.type === "search").length, mp3: media.filter((i) => i.type === "mp3").length, mp4: media.filter((i) => i.type === "mp4").length, media: media.filter((i) => i.media_url).length };
  }, [hist]);

  const save = async (e: NewEntry, quiet = false) => {
    const err = await h.add(e);
    if (err) { toast.error(`Riwayat gagal disimpan: ${err}`); return; }
    if (!quiet) toast.success("Tersimpan di riwayat", { duration: 1500 });
  };
  const searchKey = byId.get(YT_IDS.search)?.params[0]?.key ?? "q";
  const go = (mode: YtMode, values: Record<string, string>) => { setYtView("tools"); setYt(mode); setYtPrefill({ mode, values, key: Date.now() }); };
  const pick = (it: NormItem, mode: "mp3" | "mp4") => { void save({ type: "select", title: it.title || it.url!, url: it.url, thumbnail: firstHttps(it.image) ?? null }, true); go(mode, { url: it.url! }); };
  const ytActions = (it: NormItem) => it.url && /youtu\.?be/.test(it.url) ? (
    <>
      <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1" onClick={() => pick(it, "mp3")}><Music2 className="h-3 w-3" />MP3</Button>
      <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1" onClick={() => pick(it, "mp4")}><Film className="h-3 w-3" />MP4</Button>
    </>
  ) : null;
  /** Saves every finished search/conversion automatically with its real outcome; failures never get a media link. */
  const onYtResult = (mode: YtMode) => (vals: Record<string, string>, r: RunResult) => {
    if (r.code === "LOGIN_REQUIRED" || r.code === "auth_required") { onNeedLogin(); return; }
    const n = r.normalized;
    if (mode === "search") {
      const q = (vals[searchKey] ?? "").trim();
      if (!q) return;
      void save({ type: "search", title: q, thumbnail: firstHttps(n?.items.find((i) => i.image)?.image) ?? null, status: r.ok ? "ok" : "fail", error: r.ok ? null : r.error ?? null });
    } else {
      const url = (vals.url ?? "").trim();
      if (!url) return;
      const known = hist.find((x) => x.url === url && x.title !== url);
      const m = r.ok ? n?.media.find((x) => (mode === "mp3" ? x.kind === "audio" : x.kind === "video") && /^https:\/\//i.test(x.url)) : undefined;
      void save({
        type: mode, url, title: n?.title || known?.title || url,
        thumbnail: firstHttps(n?.items[0]?.image) ?? firstHttps(n?.media.find((x) => x.kind === "image")?.url) ?? known?.thumbnail ?? null,
        quality: mode === "mp4" ? (vals.quality || byId.get(YT_IDS.mp4)?.params.find((p) => p.key === "quality")?.default) ?? null : null,
        duration: metaDuration(n) ?? null, media_url: m?.url ?? null, media_kind: m ? (mode === "mp4" ? "video" : "audio") : null,
        status: r.ok ? "ok" : "fail", error: r.ok ? null : r.error ?? null,
      });
      if (r.ok && !m) toast.message("Hasil berhasil, tetapi penyedia tidak memberi link yang bisa diputar langsung di sini.");
    }
  };
  const openHist = (x: YtEntry) => {
    if (x.type === "search") go("search", { [searchKey]: x.title });
    else if (x.url) go(x.type === "mp4" ? "mp4" : "mp3", x.quality ? { url: x.url, quality: x.quality } : { url: x.url });
  };
  const removeItem = async (id: string) => { const e = await h.remove(id); e ? toast.error(e) : toast.success("Item riwayat dihapus"); if (playing?.id === id) setPlaying(null); };
  const clearAll = async () => { const e = await h.clear(); e ? toast.error(e) : toast.success("Semua riwayat dihapus"); setPlaying(null); };

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
              <div className="bg-gradient-to-br from-destructive/25 via-primary/10 to-transparent p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive text-destructive-foreground shadow-[0_0_18px_hsl(var(--destructive)/0.45)]"><PlayCircle className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <h2 className="font-extrabold text-foreground">YouTube Downloader Pro</h2>
                    <p className="truncate text-[11px] text-muted-foreground">Cari video, ubah ke MP3/MP4, putar lagi kapan saja</p>
                  </div>
                </div>
                <dl className="grid grid-cols-4 gap-1.5 text-center">
                  {([["Pencarian", stats.search], ["MP3", stats.mp3], ["MP4", stats.mp4], ["Media", stats.media]] as const).map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-card/80 px-1 py-2 shadow-sm"><dd className="text-base font-extrabold text-foreground">{h.loading ? "…" : v}</dd><dt className="text-[10px] text-muted-foreground">{k}</dt></div>
                  ))}
                </dl>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-card/70 p-1" role="group" aria-label="Tampilan YouTube">
                  {([["tools", "Downloader", PlayCircle], ["history", `Riwayat${hist.length ? ` (${hist.length})` : ""}`, History], ["media", "Media Saya", Headphones]] as const).map(([k, l, I]) => (
                    <button key={k} type="button" aria-pressed={ytView === k} onClick={() => setYtView(k)}
                      className={`flex min-h-9 items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold transition-all active:scale-95 ${ytView === k ? "bg-destructive text-destructive-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
                      <I className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{l}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 p-4 sm:p-5">
                {playing && (
                  <YtMediaPlayer key={playing.id} item={playing} onClose={() => setPlaying(null)}
                    onReprocess={(x) => { setPlaying(null); go(x.media_kind === "video" ? "mp4" : "mp3", x.quality ? { url: x.url!, quality: x.quality } : { url: x.url! }); }}
                    onPlayed={(x) => void save({ type: "play", title: x.title, url: x.url, thumbnail: x.thumbnail, quality: x.quality, duration: x.duration, status: "ok" }, true)} />
                )}
                {ytView !== "tools" ? (
                  <YoutubeHistory
                    key={ytView}
                    items={hist} loading={h.loading} media={ytView === "media"}
                    onOpen={openHist}
                    onPlay={(x) => { setPlaying(x); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    onConvert={(x, m) => go(m, { url: x.url! })}
                    onRemove={(id) => void removeItem(id)}
                    onClear={() => void clearAll()}
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

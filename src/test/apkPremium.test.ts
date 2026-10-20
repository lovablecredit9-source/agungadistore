import { describe, it, expect } from "vitest";
import { validateBaseUrl, validateParams, normalizeResponse, redactSecret, checkUpload, isPrivateIp } from "../../supabase/functions/_shared/apk-premium-core";
import { APK_FEATURES, APK_EXCLUDED } from "../../supabase/functions/_shared/apk-premium-catalog";

const byId = (id: string) => APK_FEATURES.find((f) => f.id === id)!;

describe("APK PREMIUM catalog", () => {
  it("contains the YouTube, AI chat, Instagram and TikTok endpoints read from plugin source", () => {
    expect(byId("search.youtube").params.map((p) => p.key)).toEqual(["q"]);
    expect(byId("downloader.ytmp3").params.map((p) => p.key)).toEqual(["url"]);
    expect(byId("downloader.ytmp4").params.map((p) => p.key)).toEqual(["url", "quality"]);
    expect(byId("ai.aichat").params.find((p) => p.key === "prompt")?.required).toBe(true);
    expect(byId("downloader.instagram").method).toBe("POST");
    expect(byId("downloader.tiktok").method).toBe("GET");
  });
  it("never exposes WhatsApp/owner/spam/bypass features", () => {
    const ids = APK_FEATURES.map((f) => f.id).join(" ");
    for (const bad of ["owner", "group", "spam", "cfturnstile", "bypass", "am.send", "fakewa", "fakedana", "faceswap"]) expect(ids).not.toContain(bad);
    expect(APK_EXCLUDED.length).toBeGreaterThan(0);
    expect(APK_FEATURES.every((f) => !f.params.some((p) => p.key === "apikey"))).toBe(true);
  });
});

describe("validateBaseUrl (SSRF guard)", () => {
  it("accepts the default provider", () => expect(validateBaseUrl("https://api.jerexd.my.id/")).toEqual({ ok: true, url: "https://api.jerexd.my.id" }));
  it.each(["http://api.jerexd.my.id", "https://localhost", "https://127.0.0.1", "https://10.0.0.5", "https://192.168.1.1", "https://169.254.169.254", "https://u:p@x.com", "https://x.internal", "https://x.com?a=1", "notaurl"])("rejects %s", (u) => {
    expect(validateBaseUrl(u).ok).toBe(false);
  });
  it("detects private IPs", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
});

describe("validateParams", () => {
  it("requires fields and enforces YouTube domain", () => {
    const f = byId("downloader.ytmp3");
    expect(validateParams(f, {}).ok).toBe(false);
    expect(validateParams(f, { url: "https://vimeo.com/1" }).ok).toBe(false);
    expect(validateParams(f, { url: "https://youtu.be/abc" })).toEqual({ ok: true, values: { url: "https://youtu.be/abc" } });
  });
  it("drops unknown keys (incl. apikey) and applies source defaults", () => {
    const r = validateParams(byId("ai.chatcompletion"), { query: "hai", apikey: "steal" });
    expect(r).toEqual({ ok: true, values: { role: "user", query: "hai", model: "gpt-4o" } });
  });
});

describe("normalizeResponse", () => {
  it("reads ytmp3 shape used by the plugin", () => {
    const n = normalizeResponse({ status: true, title: "Lagu", downloadUrl: "https://cdn.x/a.mp3", thumbnail: "https://i.ytimg.com/vi/x/hq.jpg" });
    expect(n.ok).toBe(true);
    expect(n.title).toBe("Lagu");
    expect(n.media.find((m) => m.kind === "audio")?.url).toBe("https://cdn.x/a.mp3");
  });
  it("turns search results into items", () => {
    const n = normalizeResponse({ status: true, result: [{ title: "A", url: "https://youtu.be/1", thumbnail: "https://i.ytimg.com/1.jpg", duration: "3:10", channel: "C" }] });
    expect(n.items).toHaveLength(1);
    expect(n.items[0]).toMatchObject({ title: "A", url: "https://youtu.be/1", image: "https://i.ytimg.com/1.jpg" });
    expect(n.items[0].meta).toEqual(expect.arrayContaining([{ k: "duration", v: "3:10" }, { k: "channel", v: "C" }]));
    expect(n.media).toHaveLength(0);
  });
  it("reads AI answers", () => {
    expect(normalizeResponse({ status: true, result: { answer: "Halo!" } }).texts).toEqual(["Halo!"]);
  });
  it("reports provider errors and empty results instead of success", () => {
    expect(normalizeResponse({ status: false, error: "Invalid apikey" })).toMatchObject({ ok: false, error: "Invalid apikey" });
    expect(normalizeResponse({ status: true, result: {} }).ok).toBe(false);
    expect(normalizeResponse(null).ok).toBe(false);
  });
  it("keeps task ids for async endpoints", () => {
    expect(normalizeResponse({ status: true, task_id: "t1" }).taskId).toBe("t1");
  });
});

describe("secrets and uploads", () => {
  it("redacts the API key everywhere", () => {
    const out = redactSecret('{"u":"https://a.com/x?apikey=SECRET123&b=1","e":"bad key SECRET123"}', "SECRET123");
    expect(out).not.toContain("SECRET123");
    expect(out).toContain("apikey=***");
  });
  it("checks uploads", () => {
    expect(checkUpload(null, "file").ok).toBe(false);
    expect(checkUpload({ type: "image/png", size: 6 * 1024 * 1024 }, "file").ok).toBe(false);
    expect(checkUpload({ type: "application/x-sh", size: 10 }, "file").ok).toBe(false);
    expect(checkUpload({ type: "image/jpeg", size: 1000 }, "file").ok).toBe(true);
  });
});

describe("APK PREMIUM source-literal defaults & options", () => {
  it("AI Chat sends the plugin's default model so the provider does not answer 'model wajib'", async () => {
    const { APK_FEATURES } = await import("../../supabase/functions/_shared/apk-premium-catalog");
    const { validateParams } = await import("../../supabase/functions/_shared/apk-premium-core");
    const f = APK_FEATURES.find((x) => x.id === "ai.aichat")!;
    const r = validateParams(f, { prompt: "halo" });
    expect(r.ok && r.values.model).toBe("openai/gpt-4o");
  });
  it("YouTube MP4 quality is limited to documented choices", async () => {
    const { APK_FEATURES } = await import("../../supabase/functions/_shared/apk-premium-catalog");
    const { validateParams } = await import("../../supabase/functions/_shared/apk-premium-core");
    const f = APK_FEATURES.find((x) => x.id === "downloader.ytmp4")!;
    const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
    expect(validateParams(f, { url, quality: "1080" }).ok).toBe(true);
    expect(validateParams(f, { url, quality: "9999" }).ok).toBe(false);
    const d = validateParams(f, { url });
    expect(d.ok && d.values.quality).toBe("720");
  });
});

describe("APK PREMIUM audit fixes", () => {
  it("shows flat provider text fields (primbon arti) instead of 'no result'", async () => {
    const { normalizeResponse } = await import("../../supabase/functions/_shared/apk-premium-core");
    const n = normalizeResponse({ status: true, data: { nama: "budi", arti: "Peduli sesama, dermawan, tidak mementingkan diri sendiri." } });
    expect(n.ok).toBe(true);
    expect(n.texts[0]).toMatch(/arti: Peduli/);
  });
  it("shows nested short values like the jadwal sholat times", async () => {
    const { normalizeResponse } = await import("../../supabase/functions/_shared/apk-premium-core");
    const n = normalizeResponse({ status: true, result: { lokasi: "KOTA JAKARTA", jadwal: { subuh: "04:16", maghrib: "17:52" } } });
    expect(n.ok).toBe(true);
    expect(n.texts[0]).toContain("jadwal subuh: 04:16");
    expect(n.texts[0]).toContain("lokasi: KOTA JAKARTA");
  });
  it("keeps a genuinely empty provider result as an honest failure", async () => {
    const { normalizeResponse } = await import("../../supabase/functions/_shared/apk-premium-core");
    expect(normalizeResponse({ status: true, result: { summary: "", results: [] } }).ok).toBe(false);
  });
  it("Hurawatch detail requires type movie/tv and placeholder defaults are not invented", async () => {
    const { APK_FEATURES } = await import("../../supabase/functions/_shared/apk-premium-catalog");
    const { validateParams } = await import("../../supabase/functions/_shared/apk-premium-core");
    const h = APK_FEATURES.find((x) => x.id === "movie.hurawatch_detail")!;
    expect(validateParams(h, { id: "550" }).ok).toBe(false);
    expect(validateParams(h, { id: "550", type: "movie" }).ok).toBe(true);
    const o = APK_FEATURES.find((x) => x.id === "anime.otakudesu-detail-download")!;
    expect(validateParams(o, {}).ok).toBe(false);
  });
});

describe("APK PREMIUM fixed values read from plugin source", () => {
  it("fills params the provider requires with the plugin's literal values", async () => {
    const { APK_FEATURES } = await import("../../supabase/functions/_shared/apk-premium-catalog");
    const { validateParams } = await import("../../supabase/functions/_shared/apk-premium-core");
    const get = (id: string) => APK_FEATURES.find((x) => x.id === id)!;
    const v = (id: string, p: Record<string, string>) => { const r = validateParams(get(id), p); return r.ok ? r.values : null; };
    expect(v("ai.chatx", { prompt: "hi" })?.model).toBe("gpt-4o");
    expect(v("ai.text2speech", { text: "halo" })?.voice).toBe("id-ID-ArdiNeural");
    expect(v("ai.unblur", { url: "https://example.com/a.jpg" })?.upscale).toBe("2");
    expect(v("komik.shinigami-list", {})?.type).toBe("latest");
    expect(v("downloader.cnvmp3", { url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" })?.quality).toBe("128");
  });
});

describe("apk premium: quiz answers list", () => {
  it("shows scalar answer arrays (Family 100) as one line", async () => {
    const core = await import("../../supabase/functions/_shared/apk-premium-core");
    const n = core.normalizeResponse({ status: true, result: { soal: "Pulau Besar", jawaban: ["jawa", "bali", "jawa"] } });
    expect(n.texts.join("\n")).toContain("jawaban: jawa, bali");
  });
});

describe("APK PREMIUM catalog vs provider documentation", () => {
  it("accounts for every documented endpoint as a feature or an excluded entry with a reason", async () => {
    const cat = await import("../../supabase/functions/_shared/apk-premium-catalog");
    const fs = await import("fs");
    const docs = JSON.parse(fs.readFileSync("scripts/apk-premium/jerexd-docs.json", "utf8")) as { items: { path: string }[] };
    const featurePaths = new Set(cat.APK_FEATURES.map((f) => f.path));
    const excl = new Map(cat.APK_EXCLUDED.map((e) => [e.path, e.reason]));
    const missing = docs.items.map((i) => i.path.split("?")[0]).filter((p) => !featurePaths.has(p) && !excl.get(p));
    expect(missing).toEqual([]);
    expect(cat.APK_DOCS_TOTAL).toBe(docs.items.length);
    expect(cat.APK_DOCS_FEATURES + cat.APK_DOCS_EXCLUDED).toBe(docs.items.length);
  });
  it("adds doc-only features with documented method, tier and file kind", async () => {
    expect(byId("search.chord").method).toBe("POST");
    expect(byId("ai.txt2video-v3").tier).toBe("premium");
    const pdf = byId("tools.compress-pdf");
    expect(pdf.form && pdf.fileField === "file" && pdf.accept === "pdf" && pdf.fileOptional).toBe(true);
    for (const bad of ["maker.fakedana", "tools.netflixtoken", "starindopay.login", "payment.create", "ai.voiceclone"]) expect(APK_FEATURES.some((f) => f.id === bad)).toBe(false);
  });
  it("offers the harmless documented endpoints that were wrongly excluded and keeps abuse endpoints out", () => {
    for (const id of ["ai.chatai", "ai.turnitin", "samp.listserver", "freefire.cekevo", "whatsapp.chinfo", "tools.webbuilder", "tools.web2apk_v2", "maker.qcwa"]) expect(byId(id)).toBeTruthy();
    expect(byId("tools.web2apk_v2").accept).toBe("image");
    expect(byId("tools.web2apk_v2").fileOptional).toBeFalsy();
    for (const bad of ["tools.spamotp", "tools.spamngl", "tools.cfwaf", "maker.fakewafat", "whatsapp.reactch", "whatsapp.checkban", "starindopay.order"]) expect(APK_FEATURES.some((f) => f.id === bad)).toBe(false);
  });
  it("checks uploads against the feature's file kind", () => {
    expect(checkUpload({ type: "application/pdf", size: 1000 }, "file", "pdf").ok).toBe(true);
    expect(checkUpload({ type: "image/png", size: 1000 }, "file", "pdf").ok).toBe(false);
    expect(checkUpload({ type: "application/pdf", size: 1000 }, "file").ok).toBe(false);
  });
});

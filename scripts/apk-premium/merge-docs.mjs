// Merges the provider's official endpoint list (api.jerexd.my.id/endpoint, saved in jerexd-docs.json)
// into the generated catalog. Run after gen-catalog.mjs: `node scripts/apk-premium/merge-docs.mjs`.
// Idempotent: entries it added before (origin "docs") are rebuilt each run; source-derived entries keep
// their tested method/params and only gain the doc description, tier and param hints.
import fs from 'fs';
const CAT_FILE = new URL('../../supabase/functions/_shared/apk-premium-catalog.ts', import.meta.url);
const docs = JSON.parse(fs.readFileSync(new URL('./jerexd-docs.json', import.meta.url), 'utf8'));
const src = fs.readFileSync(CAT_FILE, 'utf8');
const grab = (name) => JSON.parse(src.match(new RegExp(`export const ${name}[^=]*= (.*);\\n`))[1]);
const CAT_LABEL = { ...grab('APK_CATEGORY_LABEL'), novel: 'Novel', samp: 'SA-MP', am: 'Alight Motion', google: 'Google', whatsapp: 'WhatsApp (info publik)' };
let features = grab('APK_FEATURES').filter((f) => f.origin !== 'docs');
// Documented endpoints that were excluded earlier but are harmless on a store site (AI chat/detector,
// calculators, public listings, website builders, quote/lobby image makers). They become doc features.
const ALLOW = new Set([
  'ai.chatai', 'ai.turnitin', 'ai.notrack', 'ai.voice-clone-list', 'freefire.cekevo', 'samp.listserver',
  'tools.webbuilder', 'tools.web2apk', 'tools.web2apk_v2', 'tools.web2apk_download', 'whatsapp.chinfo', 'maker.qcwa', 'maker.fakeml',
]);
const OVERRIDE = {
  'ai.turnitin': { label: 'Deteksi Teks AI (Turnitin)' }, 'ai.chatai': { label: 'Chat AI (UnlimitedAI)' }, 'ai.notrack': { label: 'NoTrack AI' },
  'ai.voice-clone-list': { label: 'Daftar Model Suara AI' }, 'freefire.cekevo': { label: 'Kalkulator Evo Gun FF' }, 'tools.webbuilder': { label: 'Web Builder' },
  'tools.web2apk': { accept: 'image', fileOptional: false, label: 'Web to APK' }, 'tools.web2apk_v2': { accept: 'image', fileOptional: false, label: 'Web to APK v2' },
  'tools.web2apk_download': { label: 'Status / Unduh Web2APK' }, 'whatsapp.chinfo': { label: 'Info Saluran WhatsApp' }, 'maker.qcwa': { label: 'Quote Chat (QC)' }, 'maker.fakeml': { label: 'Kartu Lobby MLBB' },
};
const idOfPath = (p) => p.replace(/^\/api\//, '').replace(/\//g, '.');
let excluded = grab('APK_EXCLUDED').filter((e) => e.file !== 'docs' && !ALLOW.has(idOfPath(e.path)));

// Not offered on a public store site: abuse, impersonation/fraud, third-party account credentials,
// provider-internal billing, WhatsApp-only actions, or long-running builds.
const EXCL = {
  'ai.faceswap': 'Tukar wajah orang lain', 'ai.notrack': 'AI tanpa sensor / anti-deteksi', 'ai.turnitin': 'Pengelabuan deteksi plagiarisme',
  'ai.voice-clone': 'Kloning suara orang lain', 'ai.voice-clone-get': 'Kloning suara orang lain', 'ai.voice-clone-list': 'Kloning suara orang lain', 'ai.voiceclone': 'Kloning suara orang lain',
  'am.bulk': 'Pembuatan akun premium massal', 'am.bulk-v2': 'Pembuatan akun premium massal', 'am.bulk-custom': 'Pembuatan akun premium massal', 'am.bulk-custom-v2': 'Pembuatan akun premium massal',
  'am.send': 'Aktivasi premium akun pihak ketiga', 'am.verif': 'Aktivasi premium akun pihak ketiga', 'am.verif-custom': 'Aktivasi premium akun pihak ketiga',
  'freefire.cekevo': 'Butuh token akun game', 'freefire.guest': 'Pembuatan akun game massal via proxy', 'google.gemini-plus': 'Klaim langganan akun Google pihak ketiga',
  'maker.fakecallandro': 'Pemalsuan panggilan telepon', 'maker.fakecallios': 'Pemalsuan panggilan telepon', 'maker.fakedana': 'Pemalsuan bukti saldo (penipuan)',
  'maker.fakeigprofile': 'Pemalsuan profil Instagram orang lain', 'maker.fakeml': 'Pemalsuan akun game', 'maker.fakenotifwa': 'Pemalsuan notifikasi WhatsApp',
  'maker.faketele': 'Pemalsuan profil Telegram', 'maker.fakewa': 'Pemalsuan tampilan WhatsApp orang lain', 'maker.fakewafat': 'Pemalsuan pengumuman kematian',
  'maker.igpost': 'Pemalsuan postingan Instagram', 'maker.igstoryimg': 'Pemalsuan story Instagram', 'maker.iqc-pink': 'Pemalsuan chat WhatsApp', 'maker.qcwa': 'Pemalsuan chat WhatsApp',
  'movie.viuprem': 'Berbagi akun premium pihak ketiga', 'panel.create': 'Manajemen panel server', 'panel.vps-nat': 'Manajemen server via SSH',
  'payment.check': 'Pembayaran internal provider', 'payment.create': 'Pembayaran internal provider', 'payment.delete': 'Pembayaran internal provider',
  'random.jomok': 'Konten olok-olok yang tidak pantas untuk toko', 'sysinfo': 'Monitoring internal provider', 'traffic': 'Monitoring internal provider',
  'tools.alkiosku': 'Butuh email & password akun pihak ketiga', 'tools.bypas-sfl': 'Bypass shortlink', 'tools.bypasslink': 'Bypass shortlink', 'tools.bypassouo': 'Bypass shortlink',
  'tools.cekaxis': 'Lookup berdasarkan nomor telepon', 'tools.cekkartutri': 'Lookup berdasarkan nomor telepon',
  'tools.cf-session': 'Bypass proteksi Cloudflare', 'tools.cf-source': 'Bypass proteksi Cloudflare', 'tools.cf-stats': 'Bypass proteksi Cloudflare', 'tools.cf-turnstile-fast': 'Bypass captcha',
  'tools.cf-turnstile-full': 'Bypass captcha', 'tools.cfturnstile': 'Bypass captcha', 'tools.cfwaf': 'Bypass WAF', 'tools.sitekey': 'Bypass captcha',
  'tools.freetiktoklike': 'Manipulasi like TikTok', 'tools.netflixtoken': 'Akses akun Netflix pihak ketiga', 'tools.proxy': 'Proxy alamat bebas', 'tools.rusuhpanel': 'Serangan panel',
  'tools.spamapibottele': 'Spam bot Telegram', 'tools.spamngl': 'Spam NGL', 'tools.spamotp': 'Spam OTP',
  'tools.web2apk': 'Membuat build berbayar/berjalan lama', 'tools.web2apk_v2': 'Membuat build berbayar/berjalan lama', 'tools.web2apk_download': 'Membuat build berbayar/berjalan lama', 'tools.webbuilder': 'Membuat build berjalan lama',
  'upload-avatar': 'Akun internal provider', 'webhook.hook': 'Webhook internal provider',
  'whatsapp.checkban': 'Khusus WhatsApp', 'whatsapp.chinfo': 'Khusus WhatsApp', 'whatsapp.reactch': 'Khusus WhatsApp',
};
for (const id of ALLOW) delete EXCL[id];
const EXCL_CAT = { starindopay: 'Butuh cookie/login akun Starindopay pihak ketiga (transaksi uang)' };

const URLK = /^(url|urls|image_url|imgUrl|audio_url|pp|image|image1|image2|link|avatar|profilePhoto|mainPhoto|photo|fileUrl|source|target)$/;
const LONG = /^(prompt|text|question|isi|chat|txt|code|system|caption|mimpi|urls)$/;
const NUM = /^(limit|page|perPage|level|amount|page|duration|seq|starting_number|x|y|width|height|margin|blur|radius|hold_duration|border|tahun)$/;
const docAccept = (path, field) => /pdf|word|excel|powerpoint/.test(path) ? (/excel-to/.test(path) ? 'excel' : /word-to/.test(path) ? 'word' : /powerpoint-to/.test(path) ? 'powerpoint' : /jpg-to/.test(path) ? 'image' : 'pdf') : field === 'video' ? 'media' : /pixhost/.test(path) ? 'image' : 'media';

const idOf = (p) => p.replace(/^\/api\//, '').replace(/\//g, '.');
const byId = new Map(features.map((f) => [f.id, f]));
const excludedPaths = new Set(excluded.map((e) => e.path));
const isWajib = (t) => /wajib/i.test(t || '') && !/(wajib|opsional)\s+(jika|untuk|saat)|opsional|optional/i.test(t || '');
const label = (p) => p.split('/').pop().replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
let added = 0, enriched = 0, newlyExcluded = 0;

for (const it of docs.items) {
  const path = it.path.split('?')[0];
  const id = idOf(path);
  const tier = it.enterprise ? 'enterprise' : it.premium ? 'premium' : undefined;
  const meta = it.meta || {};
  const ex = byId.get(id);
  if (ex) {
    ex.desc = it.desc; if (tier) ex.tier = tier; else delete ex.tier;
    for (const p of ex.params) if (meta[p.key] && !p.hint) p.hint = String(meta[p.key]).slice(0, 200);
    enriched++; continue;
  }
  if (excludedPaths.has(path)) continue;
  const reason = EXCL[id] || EXCL_CAT[it.cat] || EXCL_CAT[path.split('/')[2]];
  if (reason) { excluded.push({ path, file: 'docs', reason }); excludedPaths.add(path); newlyExcluded++; continue; }
  const fileObj = it.paramsFile?.[0] ? Object.keys(it.paramsFile[0]) : [];
  const fileField = fileObj[0] || null;
  const qKeys = [...(it.path.split('?')[1] || '').matchAll(/(?:^|&)([A-Za-z0-9_]+)=/g)].map((m) => m[1]);
  const postKeys = it.paramsPost?.[0] && typeof it.paramsPost[0] === 'object' ? Object.keys(it.paramsPost[0]) : [];
  const metaKeys = Object.keys(meta).filter((k) => k !== 'file' && !fileObj.includes(k));
  const keys = [...new Set([...qKeys, ...postKeys, ...metaKeys])].filter((k) => k !== 'apikey' && !fileObj.includes(k) && k !== 'download' && k !== 'stream');
  const noMeta = !Object.keys(meta).length;
  const params = keys.map((k, i) => {
    const prm = { key: k, type: LONG.test(k) ? 'textarea' : URLK.test(k) ? 'url' : NUM.test(k) ? 'number' : 'text', required: noMeta ? i === 0 : isWajib(meta[k]) };
    if (meta[k]) prm.hint = String(meta[k]).slice(0, 200);
    if (k === 'urls') prm.type = 'textarea';
    return prm;
  });
  const fileOptional = !!fileField && params.some((p) => /^(url|urls|audio_url)$/.test(p.key));
  const f = {
    id, cat: path.split('/')[2].toLowerCase(), path, method: it.post ? 'POST' : 'GET', form: !!fileField, fileField, needsMedia: false,
    label: label(path), help: '', desc: it.desc, sources: ['docs:' + docs.source], params, origin: 'docs',
  };
  if (fileField) { f.accept = docAccept(path, fileField); if (fileOptional) f.fileOptional = true; }
  if (tier) f.tier = tier;
  if (it.maintenance) f.unsupported = 'Sedang maintenance di provider';
  features.push(f); byId.set(id, f); added++;
}
// Labels for doc-only categories/ids where the path name is unclear.
const LABEL = { 'tools.findpresetam': 'Cari Preset AM', 'tools.pixhost': 'Upload Pixhost', 'downloader.play': 'YouTube Play', 'search.gimage': 'Google Image', 'search.pinvideo': 'Pinterest Video', 'search.pinterest-video': 'Pinterest Video v2', 'am.export': 'Ekspor Preset Alight Motion', 'samp.listserver': 'Daftar Server SA-MP', 'mlbb.dmganda': 'Cek Diamond Ganda MLBB', 'novel.novelhub': 'Novelhub', 'ai.txt2video-v3': 'Text to Video v3', 'ai.ox-alpha': 'OX Alpha AI', 'ai.hdvideo': 'HD Video', 'ai.livephoto': 'Live Photo', 'maker.bratvid-v2': 'Brat Video v2', 'tools.text-to-speech': 'Text to Speech', 'random.animequotes': 'Quotes Anime' };
for (const [id, l] of Object.entries(LABEL)) { const f = byId.get(id); if (f) f.label = l; }
for (const [id, o] of Object.entries(OVERRIDE)) { const f = byId.get(id); if (f) { Object.assign(f, o); if (o.fileOptional === false) delete f.fileOptional; } }
for (const f of features) if (/-pdf$|^tools\.pdf-to/.test(f.id) && f.origin === 'docs') f.label = f.label.replace(/\bPdf\b/g, 'PDF');

features.sort((a, b) => a.cat.localeCompare(b.cat) || a.id.localeCompare(b.id));
const docPaths = new Set(docs.items.map((i) => i.path.split('?')[0]));
const head = src.slice(0, src.indexOf('export type ApkParam'));
const out = `${head}export type ApkParam = { key: string; type: "text" | "textarea" | "url" | "number"; required: boolean; default?: string; options?: string[]; hint?: string };
export type ApkFeature = { id: string; cat: string; path: string; method: "GET" | "POST"; form: boolean; fileField: string | null; needsMedia: boolean; label: string; help: string; sources: string[]; params: ApkParam[]; unsupported?: string; desc?: string; tier?: "premium" | "enterprise"; origin?: "docs"; accept?: "media" | "image" | "pdf" | "word" | "excel" | "powerpoint"; fileOptional?: boolean };
export const APK_CATEGORY_LABEL: Record<string, string> = ${JSON.stringify(CAT_LABEL)};
export const APK_FEATURES: ApkFeature[] = ${JSON.stringify(features)};
export const APK_EXCLUDED: { path: string; file: string; reason: string }[] = ${JSON.stringify(excluded)};
/** Provider documentation size at last merge (official list). */
export const APK_DOCS_TOTAL = ${docs.items.length};
/** Of those: offered as features / deliberately not offered (reason in APK_EXCLUDED). */
export const APK_DOCS_FEATURES = ${[...docPaths].filter((p) => byId.has(idOf(p))).length};
export const APK_DOCS_EXCLUDED = ${[...docPaths].filter((p) => !byId.has(idOf(p)) && excludedPaths.has(p)).length};
`;
fs.writeFileSync(CAT_FILE, out);
const covered = [...docPaths].filter((p) => byId.has(idOf(p)) || excludedPaths.has(p)).length;
console.log({ docs: docs.items.length, features: features.length, added, enriched, newlyExcluded, excluded: excluded.length, docsCovered: covered, sourceOnly: features.filter((f) => !docPaths.has(f.path)).length });

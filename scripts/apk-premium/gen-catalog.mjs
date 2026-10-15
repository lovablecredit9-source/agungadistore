import fs from 'fs'; import path from 'path';
const root=process.argv[2]||'/tmp/jere/jere-md-termux/plugins';
const EXCL_CAT={group:'Fitur grup WhatsApp',owner:'Perintah pemilik bot',events:'Event runtime WhatsApp',game:'Game chat WhatsApp',panel:'Manajemen panel server',sticker:'Stiker WhatsApp',samp:'Query server game (alamat bebas)',am:'Pengiriman massal / spam'};
const EXCL_FILE={
 'tools/spamapibottele.js':'Spam bot Telegram','tools/spamngl.js':'Spam NGL','tools/spamotp.js':'Spam OTP','tools/alkiosku.js':'Butuh email & password akun pihak ketiga',
 'tools/cekaxis.js':'Lookup berdasarkan nomor telepon','tools/cekkartutri.js':'Lookup berdasarkan nomor telepon','tools/cektri.js':'Lookup berdasarkan nomor telepon','primbon/nomorhoki.js':'Butuh nomor telepon',
 'tools/bycf_keys.js':'Bypass proteksi Cloudflare','tools/cf-session.js':'Bypass proteksi Cloudflare','tools/cf-source.js':'Bypass proteksi Cloudflare','tools/cf-stats.js':'Bypass proteksi Cloudflare','tools/cfturnstile.js':'Bypass captcha','tools/cfwaf.js':'Bypass WAF','tools/sitekey.js':'Bypass captcha',
 'tools/bypas-sfl.js':'Bypass shortlink','tools/bypasslink.js':'Bypass shortlink','tools/sfl.js':'Bypass shortlink','tools/freetiktoklike.js':'Manipulasi like TikTok','tools/rusuhpanel.js':'Serangan panel','tools/proxy.js':'Proxy alamat bebas','tools/get.js':'Fetch alamat bebas',
 'tools/pushch.js':'Khusus WhatsApp','tools/toall.js':'Khusus WhatsApp','tools/rvo.js':'Khusus WhatsApp','tools/ptv.js':'Khusus WhatsApp','tools/tempmail.js':'Membuat & membaca email sekali pakai',
 'maker/fakewa.js':'Pemalsuan tampilan WhatsApp orang lain','maker/qcwa.js':'Pemalsuan chat WhatsApp','maker/fakeigprofile.js':'Pemalsuan profil Instagram orang lain','maker/fakecallios.js':'Pemalsuan panggilan telepon','freefire/cekevo.js':'Butuh token akun game',
 'tools/web2apk.js':'Membuat build berbayar/berjalan lama','tools/web2apk_v2.js':'Membuat build berbayar/berjalan lama','tools/web2apk_download.js':'Membuat build berbayar/berjalan lama','tools/obflua.js':'Obfuscator kode','tools/webbuilder.js':'Membuat build berjalan lama',
 'ai/notrack.js':'Penghapus jejak / anti-deteksi','ai/turnitin.js':'Pengelabuan deteksi plagiarisme','ai/voiceclone.js':'Kloning suara orang lain','ai/faceswap.js':'Tukar wajah orang lain',
};
const CAT_LABEL={ai:'AI',downloader:'Downloader',search:'Pencarian',tools:'Tools',maker:'Maker Gambar',movie:'Film',primbon:'Primbon',mlbb:'MLBB',komik:'Komik',manga:'Komik',donghua:'Donghua',anime:'Anime',stalker:'Profil Publik',freefire:'Free Fire',news:'Berita',alkitab:'Alkitab',islami:'Islami',info:'Info',random:'Random'};
const URLK=new Set(['url','image_url','imgUrl','audio_url','pp','image1','image2','link']);
const LONG=new Set(['prompt','text','question','isi','chat','txt','text1','text2','teks1','teks2','code','mimpi']);
const NUM=new Set(['limit','page','level','points','tgl','bln','thn','tgl1','bln1','thn1','tgl2','bln2','thn2','tahun','pasal','ayat','surah']);
const OPT=new Set(['model','quality','format','lang','limit','page','style','theme','type','filter','session','session_id','mode','resolution','resolusi','upscale','output_type','stream','voice','instrument','character','fullPage','device','country','weekly','monthly','edition','currency']);
const map=new Map(); const excluded=[];
for (const cat of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root,cat)).sort()) {
  const rel=`${cat}/${f}`; const src=fs.readFileSync(path.join(root,cat,f),'utf8');
  const re=/\$\{global\.web\}(\/api\/[A-Za-z0-9_\/-]+)(\?)?/g; let m; const eps=new Map();
  while((m=re.exec(src))){ let q=''; { let i=m.index+m[0].length-(m[2]||'').length, depth=0; if(src[i]==='?'){ i++; for(;i<src.length;i++){ const c=src[i]; if(c==='$'&&src[i+1]==='{'){depth++;q+='${';i++;continue;} if(c==='}'&&depth>0){depth--;q+='}';continue;} if(depth===0&&(c==='`'||c==="'"||c==='"'))break; q+=c; } } } const keys=[...q.matchAll(/(?:^|&)([A-Za-z0-9_]+)=/g)].map(x=>x[1]).filter(k=>k!=='apikey'); const s=eps.get(m[1])||new Set(); keys.forEach(k=>s.add(k)); eps.set(m[1],s); }
  if(!eps.size) continue;
  const reason=EXCL_CAT[cat]||EXCL_FILE[rel];
  if(reason){ for(const p of eps.keys()) excluded.push({path:p,file:'plugins/'+rel,reason}); continue; }
  const form=/FormData/.test(src); const post=form||/axios\.post\(|method\s*:\s*['"]POST/i.test(src);
  const fileField=form?((src.match(/append\(\s*['"](file|video|image|audio)['"]/)||[])[1]||'file'):null;
  const formFields=form?[...src.matchAll(/append\(\s*['"]([A-Za-z0-9_]+)['"]/g)].map(x=>x[1]).filter(k=>k!==fileField):[];
  const bodyKeys=new Map();
  for (const mm of src.matchAll(/(?:JSON\.stringify\(|axios\.post\([^,]+,\s*)\{/g)) {
    let i=mm.index+mm[0].length, d=1, buf='';
    for(;i<src.length&&d>0;i++){ const c=src[i]; if(c==='{')d++; else if(c==='}')d--; if(d>0)buf+=c; }
    let depth=0, cur=''; const parts=[];
    for(const c of buf){ if('{[('.includes(c))depth++; if('}])'.includes(c))depth--; if(c===','&&depth===0){parts.push(cur);cur='';} else cur+=c; }
    parts.push(cur);
    for(const p of parts){ const t=p.trim(); if(!t)continue; const kv=t.match(/^['"]?([A-Za-z0-9_]+)['"]?\s*:\s*([\s\S]+)$/); const k=kv?kv[1]:(t.match(/^[A-Za-z0-9_]+$/)||[])[0]; if(!k||k==='apikey')continue; const v=kv?kv[2].trim():''; const lit=v.match(/^['"]([^'"]*)['"]$/)||v.match(/^(\d+)$/); bodyKeys.set(k, lit?lit[1]:null); }
  }
  const help=((src.match(/handler\.help\s*=\s*\[([^\]]*)\]/)||[])[1]||'').replace(/['"`]/g,'').split(',')[0].trim();
  const needsMedia=/m\.quoted|q\.download|\.download\(\)/.test(src);
  for(const [p,keys] of eps){
    if(p.endsWith('/'))continue;
    const id=p.replace(/^\/api\//,'').replace(/\//g,'.');
    const ks=[...new Set([...keys,...formFields,...(post&&!form?bodyKeys.keys():[])])].filter(k=>k!=='apikey');
    const ex=map.get(id);
    if(ex){ ks.forEach(k=>{ if(!ex.params.find(x=>x.key===k)) ex.params.push(mk(k)); }); ex.sources.push('plugins/'+rel); continue; }
    map.set(id,{id,cat:CAT_LABEL[cat]?cat:cat,path:p,method:post?'POST':'GET',form:!!form,fileField,needsMedia:needsMedia&&!form,label:label(p.split('/').pop()+'.js',help),help,sources:['plugins/'+rel],params:ks.map(k=>{const p=mk(k); const dv=bodyKeys.get(k); if(dv!=null&&dv!==''){p.default=dv;p.required=false;} return p;})});
  }
  // Source-literal defaults, e.g. `let model = 'openai/gpt-4o'` / `let quality = args[1] || "720"`: the plugin always sends these.
  for(const [p] of eps){ const e=map.get(p.replace(/^\/api\//,'').replace(/\//g,'.')); if(!e) continue;
    for(const prm of e.params){ if(prm.default!=null) continue; const lit=src.match(new RegExp(`(?:let|const|var)\\s+${prm.key}\\s*=\\s*(?:[^;\\n]*\\|\\|\\s*)?['"]([^'"]+)['"]`)); if(lit&&/[A-Za-z0-9]/.test(lit[1])&&prm.type!=='url'){ prm.default=lit[1]; prm.required=false; } } }
}
// Choices the plugin documents; the web form shows them as a select.
const OPTIONS={'downloader.ytmp4':{quality:['360','480','720','1080']},'movie.hurawatch_detail':{type:['movie','tv']}};
// Params the provider rejects when missing even though the plugin treats them as optional.
const REQUIRED={'movie.hurawatch_detail':['type']};
for(const [id,o] of Object.entries(OPTIONS)){ const e=map.get(id); if(e) for(const prm of e.params) if(o[prm.key]) prm.options=o[prm.key]; }
for(const [id,ks] of Object.entries(REQUIRED)){ const e=map.get(id); if(e) for(const prm of e.params) if(ks.includes(prm.key)) prm.required=true; }
function mk(k){ return {key:k,type:URLK.has(k)?'url':LONG.has(k)?'textarea':NUM.has(k)?'number':'text',required:!OPT.has(k)}; }
function label(f,help){ const b=f.replace(/\.js$/,''); return b.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }
const EXCL_ID={'maker.fakeigprofile':'Pemalsuan profil Instagram orang lain','maker.fakecallios':'Pemalsuan panggilan telepon','maker.igpost':'Pemalsuan postingan Instagram','maker.igstoryimg':'Pemalsuan story Instagram','maker.fakewafat':'Pemalsuan pengumuman kematian','maker.fakenotifwa':'Pemalsuan notifikasi WhatsApp'};
for(const [id,r] of Object.entries(EXCL_ID)){ const e=map.get(id); if(e){ excluded.push({path:e.path,file:e.sources[0],reason:r}); map.delete(id);} }
for(const e of map.values()){ if(e.needsMedia&&!e.form&&!e.params.some(p=>p.type==='url')){ e.unsupported='Butuh media dari balasan chat WhatsApp; source tidak memberi parameter URL yang bisa diisi dari web'; } }
const items=[...map.values()].sort((a,b)=>a.cat.localeCompare(b.cat)||a.id.localeCompare(b.id));
const out=`// GENERATED from Jere-MD plugin source (reference only). Regenerate instead of hand-editing large parts.\n// Each entry: endpoint path, method, params as read from the plugin request code. Response shapes are NOT verified\n// until tested against a live API key; the runtime normalizer handles the shapes the plugins read.\nexport type ApkParam = { key: string; type: "text" | "textarea" | "url" | "number"; required: boolean; default?: string; options?: string[] };\nexport type ApkFeature = { id: string; cat: string; path: string; method: "GET" | "POST"; form: boolean; fileField: string | null; needsMedia: boolean; label: string; help: string; sources: string[]; params: ApkParam[]; unsupported?: string };\nexport const APK_CATEGORY_LABEL: Record<string, string> = ${JSON.stringify(CAT_LABEL)};\nexport const APK_FEATURES: ApkFeature[] = ${JSON.stringify(items)};\nexport const APK_EXCLUDED: { path: string; file: string; reason: string }[] = ${JSON.stringify(excluded)};\n`;
fs.writeFileSync(new URL('../../supabase/functions/_shared/apk-premium-catalog.ts', import.meta.url),out);
console.log('features',items.length,'excluded',excluded.length, 'form',items.filter(i=>i.form).length,'needsMedia',items.filter(i=>i.needsMedia).length);
console.log([...new Set(items.map(i=>i.cat))].join(','));
console.log(JSON.stringify(items.filter(i=>/youtube|ytmp|aichat|instagram|tiktok$/.test(i.id)).map(i=>[i.id,i.method,i.params.map(p=>p.key+(p.required?'*':''))])));

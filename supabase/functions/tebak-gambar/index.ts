import { aiFetch } from "../_shared/ai-provider.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/* ================= UTIL ================= */
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]): T => a[rnd(a.length)];
const shuffle = <T,>(a: T[]): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const DIFFS = ["mudah", "sedang", "sulit", "super_sulit", "sangat_susah", "ekstrem"] as const;
type Diff = typeof DIFFS[number];
const normDiff = (d: string): Diff => (DIFFS.includes(d as Diff) ? (d as Diff) : "mudah");
const diffIndex = (d: Diff) => DIFFS.indexOf(d);

/* ================= TEMA: OBJEK (AI GAMBAR) ================= */
const CATEGORIES: Record<Diff, { objects: string[]; style: string }> = {
  mudah: {
    objects: [
      "kucing", "anjing", "rumah", "mobil", "pohon", "bunga", "matahari", "bulan",
      "bintang", "ikan", "burung", "apel", "pisang", "bola", "payung", "sepeda",
      "kursi", "meja", "jam", "topi", "kunci", "gitar", "piano", "lilin",
      "sendok", "garpu", "piring", "gelas", "buku", "pensil", "balon", "layang-layang",
      "kupu-kupu", "semangka", "nanas", "wortel", "jagung", "sepatu", "kaos kaki", "ember",
    ],
    style: "clean colorful illustration of a single object, isolated on a plain light background",
  },
  sedang: {
    objects: [
      "helikopter", "kapal selam", "kastil", "mercusuar", "kincir angin", "teleskop",
      "mikroskop", "robot", "dinosaurus", "penguin", "lumba-lumba", "jerapah",
      "kaktus", "jamur", "pelangi", "gunung berapi", "air terjun", "kompas",
      "globe", "biola", "terompet", "drum", "stetoskop", "magnet",
      "harmonika", "kereta api", "balon udara", "kincir air", "sarang lebah", "landak",
      "bunglon", "gurita", "kuda laut", "trenggiling", "armadillo", "flamingo",
    ],
    style: "detailed clear illustration of a single object, isolated on a plain light background",
  },
  sulit: {
    objects: [
      "akordeon", "katapel", "gramofon", "periskop", "abakus", "pendulum",
      "prisma", "pagoda", "obelisk", "totem", "teropong", "jangkar",
      "mahkota", "timbangan", "ceret", "lentera", "lonceng", "sabit",
      "sekop", "cangkul", "jala", "corong", "sungkup", "tempurung",
    ],
    style: "sharp semi-realistic illustration of a single object, isolated on a plain light background",
  },
  super_sulit: {
    objects: [
      "astrolabe", "sextant", "theodolit", "barometer", "higrometer", "seismograf",
      "kaleidoskop", "stalaktit", "stalagmit", "amfiteater", "akuaduk", "menhir",
      "sarkofagus", "gargoyle", "kanopi", "cerobong", "gerobak", "bajak",
      "alu", "lesung", "tampah", "caping", "keris", "gamelan",
    ],
    style: "moody semi-realistic illustration of a single object at an unusual angle, dim lighting, isolated on a textured background",
  },
  sangat_susah: {
    objects: [
      "trebuchet", "quipu", "orrery", "chronometer", "planetarium", "guillotine",
      "harpsichord", "didgeridoo", "balalaika", "sitar", "kalimba", "theremin",
      "zeppelin", "trebusa", "monokel", "gerabah", "tungku", "pelana",
      "bandul", "roda gigi", "katrol", "engkol", "sekrup", "poros",
    ],
    style: "high-detail cinematic close-up macro shot of a partial view of the object, dramatic shadows, extreme angle, dark background",
  },
  ekstrem: {
    objects: [
      "anemometer", "spektroskop", "osiloskop", "sentrifugal", "dinamo", "turbin",
      "kondensor", "kapasitor", "transduser", "girokompas", "hidrometer", "kalorimeter",
      "kolimator", "manometer", "mikrotom", "nefoskop", "oktan", "pirometer",
      "refraktometer", "tachometer", "vernier", "voltmeter", "wattmeter", "zoetrope",
    ],
    style: "abstract extreme macro fragment of the object, heavy shadow, silhouette-like, minimal cues, dark moody background",
  },
};

/* ================= TEMA: ANGKA (ALGORITMIK, TAK PERNAH SAMA) ================= */
function numberPuzzle(diff: Diff) {
  const lv = diffIndex(diff);
  const kinds = [
    () => { // aritmetika
      const a = 1 + rnd(9 + lv * 8), d = 1 + rnd(3 + lv * 4);
      const seq = [0, 1, 2, 3, 4].map(i => a + d * i);
      return { seq, ans: a + d * 5, hint: "Selisih antar angka tetap" };
    },
    () => { // geometri
      const a = 1 + rnd(3 + lv * 2), r = 2 + rnd(1 + lv);
      const seq = [0, 1, 2, 3].map(i => a * Math.pow(r, i));
      return { seq, ans: a * Math.pow(r, 4), hint: "Setiap angka dikalikan bilangan tetap" };
    },
    () => { // fibonacci-like
      let x = 1 + rnd(5 + lv * 3), y = 1 + rnd(7 + lv * 4);
      const seq = [x, y];
      for (let i = 0; i < 3; i++) { const z = x + y; seq.push(z); x = y; y = z; }
      return { seq, ans: x + y, hint: "Jumlah dua angka sebelumnya" };
    },
    () => { // kuadrat/pangkat + offset
      const o = rnd(5 + lv * 6), s = 1 + rnd(1 + lv);
      const seq = [1, 2, 3, 4, 5].map(i => s * i * i + o);
      return { seq, ans: s * 36 + o, hint: "Berkaitan dengan bilangan kuadrat" };
    },
    () => { // selang-seling dua pola
      const a = 2 + rnd(9 + lv * 5), b = 3 + rnd(9 + lv * 5), d1 = 1 + rnd(3 + lv * 3), d2 = 1 + rnd(4 + lv * 3);
      const seq = [a, b, a + d1, b + d2, a + 2 * d1, b + 2 * d2];
      return { seq, ans: a + 3 * d1, hint: "Ada dua pola yang berselang-seling" };
    },
    () => { // x2 + k
      const a = 1 + rnd(4 + lv * 3), k = 1 + rnd(4 + lv * 4);
      const seq = [a];
      for (let i = 0; i < 4; i++) seq.push(seq[seq.length - 1] * 2 + k);
      return { seq, ans: seq[seq.length - 1] * 2 + k, hint: "Dikali dua lalu ditambah angka tetap" };
    },
    () => { // selisih menaik
      const a = 1 + rnd(9 + lv * 6), d0 = 1 + rnd(3 + lv * 2), step = 1 + rnd(2 + lv * 2);
      const seq = [a]; let d = d0;
      for (let i = 0; i < 4; i++) { seq.push(seq[seq.length - 1] + d); d += step; }
      return { seq, ans: seq[seq.length - 1] + d, hint: "Selisihnya bertambah teratur" };
    },
    () => { // segitiga / kombinasi (lv tinggi)
      const s = 1 + rnd(2 + lv), o = rnd(6 + lv * 5);
      const seq = [1, 2, 3, 4, 5].map(i => s * (i * (i + 1)) / 2 + o);
      return { seq, ans: s * (6 * 7) / 2 + o, hint: "Pola bilangan segitiga" };
    },
    () => { // kuadrat - kelipatan (sulit)
      const p = 2 + rnd(3 + lv), q = 1 + rnd(5 + lv * 3);
      const seq = [1, 2, 3, 4, 5].map(i => i * i * p - i * q);
      return { seq, ans: 36 * p - 6 * q, hint: "Gabungan kuadrat dan kelipatan" };
    },
  ];
  const pool = lv <= 1 ? kinds.slice(0, 4) : lv <= 3 ? kinds.slice(0, 7) : kinds;
  const { seq, ans, hint } = pick(pool)();
  const display = seq.join("  ,  ") + "  ,  ?";
  const fs = display.length > 32 ? 46 : display.length > 24 ? 58 : 72;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
<rect width="768" height="768" rx="48" fill="url(#g)"/>
<text x="384" y="180" text-anchor="middle" font-size="42" font-family="system-ui,sans-serif" fill="#93c5fd" font-weight="700">TEKA-TEKI ANGKA</text>
<text x="384" y="400" text-anchor="middle" font-size="${fs}" font-family="ui-monospace,monospace" fill="#ffffff" font-weight="800">${display}</text>
<text x="384" y="600" text-anchor="middle" font-size="34" font-family="system-ui,sans-serif" fill="#cbd5e1">Berapa angka berikutnya?</text>
</svg>`;
  return {
    image: svgUrl(svg),
    answer: String(ans),
    hints: [hint, `Angka terakhir: ${seq[seq.length - 1]}`, `Jawaban berada di sekitar ${Math.max(0, ans - 2 - rnd(4))}–${ans + 2 + rnd(4)}`],
    letterCount: String(ans).length,
    theme: "angka",
  };
}

/* ================= TEMA: HITUNG POLA (ALGORITMIK) ================= */
function shapePuzzle(diff: Diff) {
  const lv = diffIndex(diff);
  const total = 6 + rnd(8 + lv * 9);
  const target = pick(["lingkaran", "kotak", "segitiga"]);
  const colors = ["#f97316", "#22d3ee", "#a78bfa", "#f43f5e", "#34d399", "#facc15"];
  let count = 0, body = "";
  for (let i = 0; i < total; i++) {
    const kind = pick(["lingkaran", "kotak", "segitiga"]);
    if (kind === target) count++;
    const x = 70 + rnd(600), y = 130 + rnd(520), s = 26 + rnd(26 + lv * 4);
    const c = pick(colors);
    const rot = rnd(360);
    if (kind === "lingkaran") body += `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${c}" opacity="0.9"/>`;
    else if (kind === "kotak") body += `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="4" fill="${c}" opacity="0.9" transform="rotate(${rot} ${x} ${y})"/>`;
    else body += `<polygon points="${x},${y - s / 2} ${x - s / 2},${y + s / 2} ${x + s / 2},${y + s / 2}" fill="${c}" opacity="0.9" transform="rotate(${rot} ${x} ${y})"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">
<rect width="768" height="768" rx="48" fill="#0b1220"/>
<text x="384" y="80" text-anchor="middle" font-size="40" font-family="system-ui,sans-serif" fill="#e2e8f0" font-weight="800">Berapa jumlah ${target.toUpperCase()}?</text>
${body}
</svg>`;
  return {
    image: svgUrl(svg),
    answer: String(count),
    hints: [
      `Total semua bentuk ada ${total}`,
      `Jumlahnya ${count % 2 === 0 ? "genap" : "ganjil"}`,
      `Antara ${Math.max(0, count - 1)} dan ${count + 1}`,
    ],
    letterCount: String(count).length,
    theme: "pola",
  };
}

/* ================= TEMA: EMOJI RIDDLE ================= */
const EMOJI_RIDDLES: Record<string, { e: string; a: string; h: string[] }[]> = {
  mudah: [
    { e: "🐝🍯", a: "MADU", h: ["Dihasilkan serangga", "Rasanya manis", "Diproduksi lebah"] },
    { e: "🌧️☂️", a: "HUJAN", h: ["Turun dari langit", "Membuat basah", "Butuh payung"] },
    { e: "🍚🍳", a: "NASI GORENG", h: ["Makanan Indonesia", "Dimasak di wajan", "Berbahan nasi"] },
    { e: "🚗💨", a: "BALAP", h: ["Butuh kecepatan", "Ada garis finis", "Adu cepat kendaraan"] },
    { e: "📚🏫", a: "SEKOLAH", h: ["Tempat belajar", "Ada guru", "Wajib bagi anak"] },
    { e: "⚽🥅", a: "SEPAK BOLA", h: ["Olahraga populer", "11 pemain", "Bola ditendang ke gawang"] },
    { e: "🐟🌊", a: "IKAN", h: ["Hidup di air", "Punya sirip", "Bisa dimakan"] },
    { e: "🎂🎉", a: "ULANG TAHUN", h: ["Ada kue", "Setahun sekali", "Tiup lilin"] },
  ],
  sedang: [
    { e: "🌋🔥", a: "GUNUNG BERAPI", h: ["Bisa meletus", "Mengeluarkan lava", "Ada di pegunungan"] },
    { e: "🕵️🔍", a: "DETEKTIF", h: ["Mencari petunjuk", "Memecahkan kasus", "Profesi penyelidik"] },
    { e: "🧊🐧", a: "KUTUB", h: ["Sangat dingin", "Penuh es", "Ujung bumi"] },
    { e: "💊🏥", a: "OBAT", h: ["Diminum saat sakit", "Dari apotek", "Menyembuhkan"] },
    { e: "🎭🎬", a: "AKTOR", h: ["Bermain peran", "Ada di film", "Profesi seni peran"] },
    { e: "🛰️🌍", a: "SATELIT", h: ["Mengorbit bumi", "Untuk komunikasi", "Ada di luar angkasa"] },
    { e: "🧭🗺️", a: "PETUALANGAN", h: ["Perjalanan seru", "Butuh peta", "Menjelajah"] },
    { e: "⚖️👨‍⚖️", a: "PENGADILAN", h: ["Ada hakim", "Tempat sidang", "Menegakkan hukum"] },
  ],
  sulit: [
    { e: "🧬🔬", a: "GENETIKA", h: ["Ilmu keturunan", "Berkaitan DNA", "Cabang biologi"] },
    { e: "🌀🌊", a: "TSUNAMI", h: ["Bencana laut", "Gelombang besar", "Akibat gempa"] },
    { e: "🕯️📜", a: "MANUSKRIP", h: ["Tulisan kuno", "Disimpan museum", "Naskah tangan"] },
    { e: "⚗️💥", a: "REAKSI KIMIA", h: ["Terjadi di lab", "Zat berubah", "Bidang kimia"] },
    { e: "🏛️🗳️", a: "DEMOKRASI", h: ["Sistem politik", "Ada pemilu", "Kedaulatan rakyat"] },
    { e: "🧠💭", a: "PSIKOLOGI", h: ["Ilmu jiwa", "Mempelajari perilaku", "Ada terapis"] },
  ],
  super_sulit: [
    { e: "♾️🧮", a: "KALKULUS", h: ["Cabang matematika", "Ada turunan", "Newton & Leibniz"] },
    { e: "🌌📡", a: "ASTRONOMI", h: ["Mempelajari langit", "Pakai teleskop", "Ilmu benda langit"] },
    { e: "🦠💉", a: "IMUNISASI", h: ["Melindungi tubuh", "Disuntikkan", "Membentuk kekebalan"] },
    { e: "🏺⛏️", a: "ARKEOLOGI", h: ["Menggali masa lalu", "Menemukan artefak", "Ilmu purbakala"] },
    { e: "🌐🔐", a: "KRIPTOGRAFI", h: ["Ilmu penyandian", "Melindungi data", "Ada kunci rahasia"] },
  ],
  sangat_susah: [
    { e: "🧫⚛️", a: "BIOTEKNOLOGI", h: ["Gabungan biologi & teknologi", "Rekayasa organisme", "Menghasilkan produk baru"] },
    { e: "🌡️🌍", a: "TERMODINAMIKA", h: ["Cabang fisika", "Tentang panas & energi", "Ada hukum kedua"] },
    { e: "🕰️🌀", a: "RELATIVITAS", h: ["Teori Einstein", "Ruang dan waktu", "E=mc²"] },
    { e: "📉📈", a: "MAKROEKONOMI", h: ["Skala nasional", "Tentang inflasi", "Cabang ilmu ekonomi"] },
  ],
  ekstrem: [
    { e: "🧿🌀", a: "FENOMENOLOGI", h: ["Cabang filsafat", "Tentang kesadaran", "Husserl"] },
    { e: "⚛️🐱", a: "SUPERPOSISI", h: ["Fisika kuantum", "Dua keadaan sekaligus", "Kucing Schrodinger"] },
    { e: "🗿🧾", a: "EPIGRAFI", h: ["Membaca prasasti", "Tulisan pada batu", "Ilmu bantu sejarah"] },
    { e: "🧭🧠", a: "METAKOGNISI", h: ["Berpikir tentang berpikir", "Kesadaran proses belajar", "Istilah psikologi"] },
  ],
};

function emojiPuzzle(diff: Diff, exclude: string[]) {
  const pool = EMOJI_RIDDLES[diff] || EMOJI_RIDDLES.mudah;
  const avail = pool.filter(p => !exclude.includes(p.a));
  const r = pick(avail.length ? avail : pool);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs>
<rect width="768" height="768" rx="48" fill="url(#g)"/>
<text x="384" y="150" text-anchor="middle" font-size="40" font-family="system-ui,sans-serif" fill="#c4b5fd" font-weight="700">TEBAK DARI EMOJI</text>
<text x="384" y="450" text-anchor="middle" font-size="150" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${r.e}</text>
<text x="384" y="620" text-anchor="middle" font-size="32" font-family="system-ui,sans-serif" fill="#ddd6fe">${r.a.replace(/[^\s]/g, "•")}</text>
</svg>`;
  return { image: svgUrl(svg), answer: r.a, hints: r.h, letterCount: r.a.replace(/\s/g, "").length, theme: "emoji" };
}

/* ================= FALLBACK OBJEK ================= */
const FALLBACK_ROUNDS: Record<string, { answer: string; emoji: string; hints: string[] }[]> = {
  mudah: [
    { answer: "kucing", emoji: "🐈", hints: ["Hewan rumahan yang lincah", "Suka mengejar tikus", "Bersuara mengeong"] },
    { answer: "mobil", emoji: "🚗", hints: ["Bergerak di jalan raya", "Memiliki empat roda", "Kendaraan pribadi"] },
    { answer: "payung", emoji: "☂️", hints: ["Dibawa saat cuaca berubah", "Melindungi bagian atas tubuh", "Dipakai ketika hujan"] },
    { answer: "gitar", emoji: "🎸", hints: ["Menghasilkan nada", "Memiliki banyak senar", "Alat musik yang dipetik"] },
    { answer: "apel", emoji: "🍎", hints: ["Tumbuh di pohon", "Buah berbentuk bulat", "Sering berwarna merah"] },
  ],
  sedang: [
    { answer: "helikopter", emoji: "🚁", hints: ["Dapat melayang di udara", "Baling-baling berada di atas", "Kendaraan udara"] },
    { answer: "dinosaurus", emoji: "🦖", hints: ["Hidup pada zaman purba", "Kini sudah punah", "Reptil berukuran besar"] },
    { answer: "penguin", emoji: "🐧", hints: ["Burung yang tidak terbang", "Pandai berenang", "Hidup di wilayah dingin"] },
    { answer: "pelangi", emoji: "🌈", hints: ["Muncul setelah hujan", "Memiliki banyak warna", "Melengkung di langit"] },
    { answer: "teleskop", emoji: "🔭", hints: ["Dipakai oleh astronom", "Melihat benda sangat jauh", "Untuk mengamati langit"] },
  ],
  sulit: [
    { answer: "akordeon", emoji: "🪗", hints: ["Dimainkan dengan kedua tangan", "Bunyinya berasal dari udara", "Alat musik berbentuk lipatan"] },
    { answer: "abakus", emoji: "🧮", hints: ["Sudah digunakan sejak dahulu", "Memiliki manik-manik geser", "Alat bantu berhitung"] },
    { answer: "jangkar", emoji: "⚓", hints: ["Terbuat dari logam berat", "Diturunkan ke dasar air", "Menahan kapal agar diam"] },
    { answer: "mahkota", emoji: "👑", hints: ["Simbol kekuasaan", "Dikenakan di kepala", "Milik raja atau ratu"] },
    { answer: "lentera", emoji: "🏮", hints: ["Dapat dibawa atau digantung", "Menerangi tempat gelap", "Lampu dengan pelindung"] },
  ],
};

function fallbackRound(difficulty: string) {
  const lv = diffIndex(normDiff(difficulty));
  // level tinggi tidak ada pool gambar fallback -> pakai teka-teki angka (selalu unik)
  if (lv >= 3) return numberPuzzle(normDiff(difficulty));
  const rounds = FALLBACK_ROUNDS[difficulty] || FALLBACK_ROUNDS.mudah;
  const round = pick(rounds);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768"><rect width="768" height="768" rx="48" fill="#f8fafc"/><circle cx="384" cy="384" r="270" fill="#e2e8f0"/><text x="384" y="440" text-anchor="middle" font-size="280" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${round.emoji}</text></svg>`;
  return {
    image: svgUrl(svg),
    answer: round.answer.toUpperCase(),
    hints: round.hints,
    letterCount: round.answer.length,
    source: "fallback",
    theme: "objek",
  };
}

/* ================= VARIASI PROMPT AGAR TIDAK MONOTON ================= */
const ANGLES = ["front view", "three-quarter view", "top-down view", "side profile", "low angle view", "isometric view"];
const LOOKS = ["flat vector art", "watercolor painting", "3d clay render", "pencil sketch shading", "papercut layered art", "neon outline art", "low-poly render", "pixel-art style"];
const PALETTES = ["pastel palette", "vivid saturated palette", "monochrome palette", "warm sunset palette", "cool blue palette", "high contrast duotone"];

/* ================= HANDLER ================= */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, guess, answer } = body;
    const diff = normDiff(body.difficulty || "mudah");
    const theme: string = body.theme || "objek";
    const exclude: string[] = Array.isArray(body.exclude) ? body.exclude.map((s: string) => String(s).toUpperCase()) : [];

    if (action === "new_image") {
      // Tema algoritmik: selalu unik, tanpa AI
      if (theme === "angka") return Response.json(numberPuzzle(diff), { headers: corsHeaders });
      if (theme === "pola") return Response.json(shapePuzzle(diff), { headers: corsHeaders });
      if (theme === "emoji") return Response.json(emojiPuzzle(diff, exclude), { headers: corsHeaders });
      if (theme === "acak") {
        const t = pick(["angka", "pola", "emoji", "objek"]);
        if (t === "angka") return Response.json(numberPuzzle(diff), { headers: corsHeaders });
        if (t === "pola") return Response.json(shapePuzzle(diff), { headers: corsHeaders });
        if (t === "emoji") return Response.json(emojiPuzzle(diff, exclude), { headers: corsHeaders });
      }

      const cat = CATEGORIES[diff] || CATEGORIES.mudah;
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return Response.json(fallbackRound(diff), { status: 200, headers: corsHeaders });

      // anti-pengulangan: buang objek yang sudah keluar
      const avail = cat.objects.filter(o => !exclude.includes(o.toUpperCase()));
      const objects = shuffle(avail.length ? avail : cat.objects);
      const randomObj = objects[0];

      const lv = diffIndex(diff);
      const angle = pick(ANGLES);
      const look = pick(LOOKS);
      const palette = pick(PALETTES);
      const hardBits = lv >= 3
        ? " Make it visually challenging: partial framing, dramatic shadows, unusual perspective, minimal recognizable cues."
        : "";

      const imagePrompt = `Create one image of a single object: "${randomObj}". Style: ${cat.style}. Rendering: ${look}, ${palette}, ${angle}.${hardBits} Requirements: object only, centered, fully visible within frame, no hands, no people, no extra objects, no text, no letters, no watermark. Variation seed ${Date.now()}-${rnd(99999)}.`;

      const [response, hintResponse] = await Promise.all([
        aiFetch("chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"],
          }),
        }),
        aiFetch("chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "Kamu membantu game tebak gambar. Berikan petunjuk singkat untuk objek yang diberikan." },
              { role: "user", content: `Berikan 3 petunjuk singkat (masing-masing max 8 kata) untuk menebak objek "${randomObj}", dari yang paling sulit ke paling mudah.${lv >= 3 ? " Buat petunjuk sangat samar dan menantang." : ""}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "provide_hints",
                description: "Provide hints for the guessing game",
                parameters: {
                  type: "object",
                  properties: { hints: { type: "array", items: { type: "string" }, description: "3 petunjuk dari sulit ke mudah" } },
                  required: ["hints"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "provide_hints" } },
          }),
        }),
      ]);

      if (!response.ok) {
        console.error("AI error:", response.status, await response.text());
        return Response.json(fallbackRound(diff), { status: 200, headers: corsHeaders });
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      let imageBase64 = "";
      if (message?.images && Array.isArray(message.images) && message.images.length > 0) {
        imageBase64 = message.images[0]?.image_url?.url || "";
      }
      if (!imageBase64 && Array.isArray(message?.content)) {
        for (const part of message.content) {
          if (part.type === "image_url" && part.image_url?.url) { imageBase64 = part.image_url.url; break; }
        }
      }
      if (!imageBase64) return Response.json(fallbackRound(diff), { status: 200, headers: corsHeaders });

      let hints: string[] = [];
      if (hintResponse.ok) {
        const hintData = await hintResponse.json();
        const toolCall = hintData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          try { hints = JSON.parse(toolCall.function.arguments).hints || []; } catch { /* ignore */ }
        }
      }
      if (hints.length === 0) {
        hints = ["Perhatikan bentuknya", "Perhatikan detailnya", `Huruf pertama: ${randomObj[0].toUpperCase()}`];
      }

      return Response.json({
        image: imageBase64,
        answer: randomObj.toUpperCase(),
        hints,
        letterCount: randomObj.length,
        theme: "objek",
      }, { headers: corsHeaders });
    }

    if (action === "check_guess") {
      if (!guess || !answer) return Response.json({ error: "Data tidak lengkap" }, { status: 400, headers: corsHeaders });
      const normalize = (s: string) => String(s).toUpperCase().trim().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ");
      return Response.json({ correct: normalize(guess) === normalize(answer) }, { headers: corsHeaders });
    }

    return Response.json({ error: "Aksi tidak valid" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    console.error("tebak-gambar error:", error);
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});

// Structured actions for Bot Galau AI. Each action only changes the task
// instruction; the persona, safety rules and conversation context stay shared.

export const GALAU_ACTIONS = [
  "chat",
  "analyze_chat",
  "draft_reply",
  "love_message",
  "roleplay",
  "roleplay_eval",
  "curhat_summary",
  "decision_support",
  "music_recommendation",
  "daily_checkin",
];

// Actions that may reuse the last screenshot from the session.
export const IMAGE_ACTIONS = ["analyze_chat", "draft_reply", "curhat_summary", "roleplay"];

export const STYLE_TEXT: Record<string, string> = {
  hangat: "hangat, lembut, penuh empati",
  santai: "santai, ringan, seperti ngobrol biasa",
  sahabat: "seperti sahabat dekat, akrab, boleh bercanda ringan kalau cocok",
  dewasa: "dewasa, tenang, jernih dan seimbang",
  sendu: "sendu, pelan, puitis secukupnya",
  singkat: "sangat singkat, maksimal 2 kalimat kecuali tugas butuh format khusus",
};

export const SAHABAT_TEXT = `MODE SAHABAT AKTIF: bicara seperti teman dekat, bahasa Indonesia natural dan tidak formal. Empatik, tidak menghakimi, tidak menceramahi. Kalau user cuma butuh cerita, cukup dengarkan dan tanggapi—jangan langsung kasih banyak solusi. Tawarkan saran hanya kalau diminta atau sangat relevan.`;

export const BREAKUP_TEXT = `MODE PATAH HATI AKTIF: user sedang melewati patah hati. Sangat hangat, sabar, tidak menghakimi, tidak menyalahkan siapa pun. Validasi perasaan dulu sebelum hal lain. Tidak ada diagnosis atau klaim medis.`;

export const CRISIS_TEXT = `PRIORITAS KESELAMATAN: pesan user mengandung tanda bahaya serius (menyakiti diri/ingin mati/bahaya). Tanggapi dengan tenang dan peduli, tanyakan apakah dia aman saat ini, dorong dia segera menghubungi orang terdekat yang dipercaya atau layanan darurat setempat (di Indonesia: 112, atau layanan kesehatan jiwa Kemenkes 119 ext 8). Jangan menjalankan tugas lain dulu, jangan menggantikan peran profesional.`;

const RISK_RE = /\b(bunuh diri|mau mati|pengen mati|ingin mati|akhiri hidup|mengakhiri hidup|nyakitin diri|menyakiti diri|self ?harm|sayat|gantung diri|loncat dari|gak mau hidup|nggak mau hidup|tidak mau hidup)\b/i;
export const riskyText = (t: string) => RISK_RE.test(t);

const RADAR_KEYS = ["sedih", "kecewa", "marah", "rindu", "cemas", "lega"];
const RADAR_INSTRUCTION = `Di baris PALING AKHIR jawabanmu, tulis perkiraan suasana percakapan (bukan diagnosis) persis dalam format: [[RADAR]]{"sedih":0-100,"kecewa":0-100,"marah":0-100,"rindu":0-100,"cemas":0-100,"lega":0-100}
Baris ini tidak dilihat user sebagai teks.`;

const s = (v: unknown, max = 80) => String(v ?? "").slice(0, max);

export function actionInstruction(action: string, extra: Record<string, unknown>): string {
  switch (action) {
    case "analyze_chat":
      return `ANALISIS CHAT. User meminta bantuan memahami percakapan (dari screenshot/teks yang ditempel). Abaikan batas panjang biasa. Susun dengan judul tebal:
**Topik utama**, **Nada percakapan**, **Bagian yang ambigu**, **Pertanyaan yang belum terjawab**, **Kemungkinan maksud yang terlihat dari teks**, **Pertanyaan klarifikasi yang bisa kamu ajukan**.
Pisahkan jelas FAKTA (yang benar-benar tertulis) dan INTERPRETASI (gunakan "kalimat ini bisa ditafsirkan beberapa cara"). Jangan pernah memastikan perasaan/niat orang lain. Kalau tidak ada chat yang bisa dibaca, minta user menempel isi chat atau kirim screenshot.
${RADAR_INSTRUCTION}`;
    case "draft_reply": {
      const styles = Array.isArray(extra.styles) ? extra.styles.map((x) => s(x, 20)).slice(0, 4) : [];
      return `BANTU BALAS CHAT. Buat draft balasan untuk chat yang user terima (dari screenshot/teks/penjelasan). Gaya yang diminta: ${styles.length ? styles.join(", ") : "Lembut, Santai, Dewasa"}.
Untuk SETIAP gaya: tulis satu baris pengantar singkat (mis. "❤️ **Lembut** — kalau kamu mau tetap membuka komunikasi:") lalu draft balasannya sebagai blockquote markdown (baris diawali "> "). Satu blockquote per draft, natural seperti chat WhatsApp, tidak lebay, tanpa data pribadi.
Ingatkan singkat di akhir bahwa user yang memutuskan mau mengirim atau tidak. Kalau konteks chat belum jelas, tanyakan dulu dengan singkat.`;
    }
    case "love_message":
      return `BUAT PESAN. Jenis pesan: ${s(extra.kind, 40) || "bebas"}. Tone: ${s(extra.tone, 30) || "Natural"}. Gunakan konteks sesi ini jika ada.
Buat 2 variasi draft, masing-masing sebagai blockquote markdown (baris diawali "> "), dengan label tebal singkat di atasnya. Natural, tidak berlebihan, siap disalin. Jangan klaim akan mengirimkannya.`;
    case "roleplay":
      return `LATIHAN PERCAKAPAN (roleplay). Skenario: "${s(extra.scenario, 80)}". Kamu berperan sebagai LAWAN BICARA user (orang yang dia ajak bicara), bukan sebagai Bot Galau.
${extra.start ? "Mulai percakapan dengan satu pesan pembuka yang realistis dari lawan bicara (boleh sedikit cuek/sibuk agar menantang)." : "Balas pesan terakhir user secara realistis sebagai lawan bicara, 1-3 kalimat seperti chat."}
Awali setiap jawaban dengan "🎭 " lalu isi chat lawan bicara. Jangan keluar dari peran, jangan menilai dulu. Tetap sopan; kalau user mengarah ke hal berbahaya/kasar, keluar dari peran dan ingatkan dengan lembut.`;
    case "roleplay_eval":
      return `EVALUASI LATIHAN. Keluar dari peran. Evaluasi cara user berkomunikasi selama latihan "${s(extra.scenario, 80)}" di sesi ini. Judul "📊 **Evaluasi percakapan**" lalu bagian tebal: **Kejelasan**, **Nada komunikasi**, **Terlalu memaksa atau tidak**, **Bagian yang bisa diperbaiki** (beri contoh kalimat alternatif). Jangan memberi skor siapa yang benar; fokus latihan komunikasi. Abaikan batas panjang biasa.`;
    case "curhat_summary":
      return `RINGKAS CURHAT. Ringkas isi sesi ini dengan bagian tebal: **Yang terjadi**, **Yang kamu rasakan**, **Hal yang membuat bingung**, **Hal yang belum terjawab**, **Pilihan yang bisa dipertimbangkan**. Poin singkat. Tanpa diagnosis. Kalau belum ada cerita, bilang dengan lembut bahwa belum ada yang bisa diringkas.`;
    case "decision_support":
      return `BANTU AKU MEMILIH. Jangan memutuskan untuk user. Berdasarkan cerita di sesi ini, tawarkan 3-4 pilihan (A, B, C, D) yang masuk akal. Untuk tiap pilihan tulis:
**A. Nama pilihan**
➕ kemungkinan manfaat
➖ kemungkinan risiko
💬 hal yang perlu dipertimbangkan
Tutup dengan kalimat bahwa semua pilihan kembali ke user dan boleh tidak memilih sekarang. Kalau cerita belum cukup, tanyakan dulu apa yang sedang dia timbang.`;
    case "daily_checkin":
      return `CHECK-IN HARIAN. User memilih perasaan hari ini: "${s(extra.feeling, 30)}". Beri respons singkat 1-2 kalimat yang hangat sesuai perasaan itu, lalu satu pertanyaan ringan mengajak cerita. Bukan penilaian kesehatan mental.
${RADAR_INSTRUCTION}`;
    default:
      return `Balas curhat user seperti biasa sesuai gaya dan level mode.
${RADAR_INSTRUCTION}`;
  }
}

export function extractRadar(raw: string): { text: string; radar: Record<string, number> | null } {
  const m = raw.match(/\[\[RADAR\]\]\s*(\{[\s\S]*?\})/);
  const text = raw.replace(/\n?\s*\[\[RADAR\]\][\s\S]*$/, "").trim();
  if (!m) return { text, radar: null };
  try {
    const j = JSON.parse(m[1]);
    const radar: Record<string, number> = {};
    for (const k of RADAR_KEYS) {
      const n = Number(j[k]);
      if (Number.isFinite(n)) radar[k] = Math.max(0, Math.min(100, Math.round(n)));
    }
    return { text, radar: Object.keys(radar).length ? radar : null };
  } catch {
    return { text, radar: null };
  }
}

type Song = { id: string; title: string; artist: string; file_url: string; cover_url: string | null };

const GROUPS = [
  { key: "sendu", label: "🥀 Lagi ingin lagu sendu?", words: ["sedih", "galau", "patah", "hati", "rindu", "kangen", "sendiri", "hujan", "luka", "pergi", "air mata", "sepi", "broken", "sad", "lost", "cry"] },
  { key: "tenang", label: "😌 Mau yang bikin lebih tenang?", words: ["tenang", "pelan", "damai", "malam", "senja", "rumah", "peluk", "langit", "calm", "sleep", "slow", "acoustic", "akustik"] },
  { key: "bangkit", label: "🔥 Mau lagu buat bangkit?", words: ["bangkit", "kuat", "semangat", "terbang", "bebas", "bahagia", "hebat", "juara", "rise", "strong", "happy", "fight", "free"] },
];

// Picks songs from the existing Music Hub catalogue (playlist_songs); never invents songs.
export async function recommendMusic(sb: any, _messages: unknown[], extra: Record<string, unknown>) {
  const { data, error } = await sb
    .from("playlist_songs")
    .select("id,title,artist,file_url,cover_url")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    console.error("bot-galau music error", error);
    return { reply: "Musiknya belum bisa diambil sekarang. Coba lagi ya.", songs: [], action: "music_recommendation", musicError: true };
  }
  const songs = (data || []) as Song[];
  if (!songs.length) {
    return { reply: "Music Hub belum punya lagu yang bisa diputar. Kamu tetap bisa buka halaman Musik untuk cari lagu favoritmu 🎵", songs: [], action: "music_recommendation" };
  }
  const radar = (extra.radar && typeof extra.radar === "object") ? extra.radar as Record<string, number> : {};
  const heavy = (radar.sedih || 0) + (radar.rindu || 0) + (radar.kecewa || 0);
  const order = heavy >= 120 ? ["sendu", "tenang", "bangkit"] : (radar.marah || 0) + (radar.cemas || 0) >= 80 ? ["tenang", "bangkit", "sendu"] : ["tenang", "sendu", "bangkit"];

  const used = new Set<string>();
  const pool = [...songs].sort(() => Math.random() - 0.5);
  const picks = order.map((key) => {
    const g = GROUPS.find((x) => x.key === key)!;
    const match = pool.find((song) => !used.has(song.id) && g.words.some((w) => `${song.title} ${song.artist}`.toLowerCase().includes(w)))
      || pool.find((song) => !used.has(song.id));
    if (match) used.add(match.id);
    return match ? { group: g.key, label: g.label, song: match } : null;
  }).filter(Boolean);

  return {
    reply: "Aku pilihin beberapa lagu dari Music Hub buat nemenin kamu sekarang 🎵",
    songs: picks,
    action: "music_recommendation",
  };
}

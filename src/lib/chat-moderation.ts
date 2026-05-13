// Client-side chat content moderation utilities.
// Designed to catch obfuscated banned words ("p e n i p u", "p.e.n.i.p.u", "pen1pu")
// and shared phone numbers, then sanitize them before sending.

const BANNED_WORDS = [
  "penipu",
  "penipuan",
  "tidakamanah",
  "ngakamanah",
  "nggaamanah",
  "nggakamanah",
  "gakamanah",
  "gaamanah",
  "takamanah",
  "agungadistore",
  "spam",
  "scam",
  "tipu",
  "bohong",
  "bangsat",
  "anjing",
  "kontol",
  "memek",
  "babi",
  "goblok",
  "tolol",
  "idiot",
  "ngentot",
  "pelacur",
  "bajingan",
  "bangke",
];

// Map common leet substitutions to letters for normalization.
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
};

function normalize(input: string): string {
  // Remove zero-width chars, collapse whitespace and punctuation between letters,
  // then leet-substitute and lowercase.
  const s = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/[\s._*|/\\,'"-]+/g, "");
  let out = "";
  for (const ch of s) out += LEET[ch] ?? ch;
  return out;
}

const OBFUSCATION_NOISE = [
  "pesan", "kata", "huruf", "lanjut", "baru", "nomor", "no", "urutan",
  "pertama", "kedua", "ketiga", "keempat", "kelima", "keenam", "ketujuh", "kedelapan", "kesembilan", "kesepuluh",
  "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh",
];

function normalizeDeep(input: string): string {
  let s = normalize(input).replace(/\d+/g, "");
  for (const word of OBFUSCATION_NOISE) {
    s = s.replace(new RegExp(word, "g"), "");
  }
  return s;
}

export interface ModerationResult {
  ok: boolean;
  cleaned: string;
  reasons: string[]; // human-readable
  hadContact: boolean;
  hadBannedWord: boolean;
}

// Sensor nomor HP / kontak: 8+ digit berturut, atau 10+ angka jika dipisahkan
// karakter non-digit yang ringan.
const PHONE_REGEX = /(?:(?:\+?\d[\s.-]?){8,16})/g;
const WA_REGEX = /\b(?:wa|whatsapp|telegram|tele|tg|line|ig|instagram)[\s:]*[@a-z0-9_.-]{3,}/gi;

export function moderateOutgoing(text: string): ModerationResult {
  const reasons: string[] = [];
  let cleaned = text;
  let hadContact = false;
  let hadBannedWord = false;

  // Sensor nomor HP / kontak
  cleaned = cleaned.replace(PHONE_REGEX, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 8) {
      hadContact = true;
      return "•••sensor•••";
    }
    return m;
  });
  cleaned = cleaned.replace(WA_REGEX, (m) => {
    hadContact = true;
    return "•••sensor•••";
  });
  if (hadContact) reasons.push("Berbagi nomor kontak/akun media sosial dilarang");

  // Deteksi kata terlarang pakai versi normalisasi
  const norm = normalize(cleaned);
  const deepNorm = normalizeDeep(cleaned);
  for (const w of BANNED_WORDS) {
    if (norm.includes(w) || deepNorm.includes(w)) {
      hadBannedWord = true;
      // Sensor di teks asli juga: ganti potongan substring yang menjadi kata itu
      const re = new RegExp(
        w.split("").map((c) => `${c}[\\s\\.\\-_*|/\\\\]*`).join(""),
        "gi",
      );
      cleaned = cleaned.replace(re, "***");
    }
  }
  if (hadBannedWord) reasons.push("Kata tidak pantas / tuduhan penipuan terdeteksi");

  return {
    ok: !hadContact && !hadBannedWord,
    cleaned: cleaned.trim(),
    reasons,
    hadContact,
    hadBannedWord,
  };
}

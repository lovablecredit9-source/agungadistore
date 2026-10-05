import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, Music2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Radar = Partial<
  Record<"sedih" | "kecewa" | "marah" | "rindu" | "cemas" | "lega", number>
>;
export type GalauSong = {
  id: string;
  title: string;
  artist: string;
  file_url: string;
  cover_url: string | null;
};
export type SongPick = { group: string; label: string; song: GalauSong };

export const RESPONSE_STYLES = [
  { key: "hangat", label: "💗 Hangat" },
  { key: "santai", label: "😎 Santai" },
  { key: "sahabat", label: "😂 Sahabat" },
  { key: "dewasa", label: "🧠 Dewasa" },
  { key: "sendu", label: "🥀 Sendu" },
  { key: "singkat", label: "✨ Singkat" },
] as const;

export const REPLY_STYLES = [
  "❤️ Lembut",
  "😎 Santai",
  "🥀 Sedih",
  "😂 Lucu",
  "🧊 Dingin",
  "🤝 Dewasa",
  "💘 Flirty",
];
export const LOVE_KINDS = [
  "Minta maaf",
  "Kangen",
  "Terima kasih",
  "Ulang tahun",
  "Anniversary",
  "Menyatakan perasaan",
  "Mengajak ngobrol",
  "Mengakhiri hubungan dengan baik",
  "Balikan",
  "Menanyakan hubungan",
];
export const LOVE_TONES = [
  "Singkat",
  "Manis",
  "Romantis",
  "Dewasa",
  "Lucu",
  "Natural",
  "Tidak lebay",
];
export const ROLEPLAY_SCENARIOS = [
  "Mau menyatakan perasaan",
  "Mau minta maaf",
  "Mau ngajak ketemu",
  "Mau balikan",
  "Mau mengakhiri hubungan",
  "Mau menanyakan perasaan seseorang",
  "Mau menghadapi chat yang dingin",
];
export const CHECKIN_FEELINGS = [
  "😊 Baik",
  "🙂 Lumayan",
  "😐 Biasa",
  "🥀 Lagi berat",
  "😡 Kesal",
  "💔 Patah hati",
];
export const BREAKUP_PROMPTS = [
  "Cerita dari awal",
  "Aku masih kangen",
  "Aku ingin move on",
  "Aku ingin balikan",
  "Aku bingung harus bagaimana",
  "Bantu aku menulis pesan",
];

const RADAR_LABEL: Record<string, string> = {
  sedih: "Sedih",
  kecewa: "Kecewa",
  marah: "Marah",
  rindu: "Rindu",
  cemas: "Cemas",
  lega: "Lega",
};

export function RadarCard({ radar }: { radar: Radar }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(radar).filter(([, v]) => typeof v === "number") as [
    string,
    number,
  ][];
  if (!entries.length) return null;
  const top = [...entries].sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="mt-2 rounded-xl border border-pink-500/30 bg-background/70">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold"
      >
        <span>
          💗 Suasana percakapan saat ini ·{" "}
          <span className="text-pink-600">{RADAR_LABEL[top[0]]}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-[11px]">
              <span className="w-12 text-muted-foreground">{RADAR_LABEL[k]}</span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-600"
                  style={{ width: `${v}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums">{v}%</span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground pt-1">
            Perkiraan perasaan yang terlihat dari ceritamu, hanya untuk menyesuaikan gaya jawaban.
            Bukan diagnosis dan tidak disimpan sebagai profil.
          </p>
        </div>
      )}
    </div>
  );
}

/** Blockquote in a bot reply = one draft message, with its own copy button. */
export function CopyableQuote({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLQuoteElement>(null);
  const copy = async () => {
    const t = ref.current?.innerText.trim() || "";
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Balasan disalin. Kamu yang putuskan mau kirim atau tidak.");
    } catch {
      toast.error("Gagal menyalin");
    }
  };
  return (
    <div className="my-1.5 rounded-xl border border-pink-500/30 bg-background/80 p-2 not-prose">
      <blockquote ref={ref} className="text-[13px] leading-relaxed whitespace-pre-wrap">
        {children}
      </blockquote>
      <button
        onClick={copy}
        className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-pink-500 px-2.5 py-1 text-[10px] font-semibold text-primary-foreground"
      >
        <Copy className="w-3 h-3" /> Copy Balasan
      </button>
    </div>
  );
}

export function SongCards({
  picks,
  onPlay,
  onOpenMusic,
}: {
  picks: SongPick[];
  onPlay?: (s: GalauSong) => void;
  onOpenMusic?: () => void;
}) {
  return (
    <div className="mt-2 space-y-1.5 not-prose">
      {picks.map((p) => (
        <div key={p.song.id} className="rounded-xl border border-border bg-background/80 p-2">
          <div className="text-[11px] font-semibold mb-1">{p.label}</div>
          <div className="flex items-center gap-2">
            {p.song.cover_url ? (
              <img
                src={p.song.cover_url}
                alt=""
                className="w-10 h-10 rounded-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <Music2 className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate">{p.song.title}</div>
              <div className="text-[10px] text-muted-foreground truncate">{p.song.artist}</div>
            </div>
            {onPlay && (
              <Button size="sm" className="h-8 px-2.5 text-[11px]" onClick={() => onPlay(p.song)}>
                <Play className="w-3 h-3 mr-1" /> Putar
              </Button>
            )}
          </div>
        </div>
      ))}
      {onOpenMusic && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[11px] w-full"
          onClick={onOpenMusic}
        >
          <Music2 className="w-3.5 h-3.5 mr-1" /> Buka Music Hub
        </Button>
      )}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active
          ? "border-transparent bg-gradient-to-br from-pink-500 to-rose-600 text-primary-foreground"
          : "border-border bg-background hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

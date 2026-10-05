// Social add-ons for the existing Confess Wall (filters, polls, replies,
// missions, Secret Crush, AI enhancer). All data goes through confess-extra.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  X,
  Sparkles,
  Flag,
  Heart,
  Send,
  Search,
  Target,
  HeartHandshake,
  Eye,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confess-extra`;
export async function confessApi<T = Record<string, unknown>>(
  payload: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string })?.error || "Gagal");
  return j as T;
}
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Error");

export const FEED_FILTERS = [
  { key: "all", label: "💌 Semua" },
  { key: "trending", label: "🔥 Trending" },
  { key: "popular", label: "💗 Populer" },
  { key: "new", label: "🆕 Terbaru" },
  { key: "emotional", label: "🥀 Emosional" },
  { key: "mystery", label: "🕵️ Mystery" },
];
export const CONFESS_MOODS = [
  { key: "cinta", tag: "Cinta", emoji: "❤️" },
  { key: "sedih", tag: "Sedih", emoji: "🥀" },
  { key: "berani", tag: "Berani", emoji: "🔥" },
  { key: "lucu", tag: "Lucu", emoji: "😂" },
  { key: "marah", tag: "Marah", emoji: "😡" },
  { key: "rahasia", tag: "Rahasia", emoji: "😶" },
  { key: "harapan", tag: "Harapan", emoji: "✨" },
  { key: "rindu", tag: "Rindu", emoji: "💭" },
];
export const moodEmoji = (tag?: string | null) =>
  CONFESS_MOODS.find((m) => m.tag.toLowerCase() === String(tag || "").toLowerCase())?.emoji || "💌";

export function Chips({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {items.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.key)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition ${value === c.key ? "bg-primary text-primary-foreground shadow" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-background w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-4 space-y-3 border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold">{title}</h3>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Poll ---------------- */
export interface PollData {
  id: string;
  options: string[];
  total: number;
  my_vote: number | null;
  counts: number[] | null;
}
export function PollBlock({ visitorId, poll }: { visitorId: string; poll: PollData }) {
  const [p, setP] = useState(poll);
  const [busy, setBusy] = useState(false);
  useEffect(() => setP(poll), [poll]);
  const vote = async (i: number) => {
    if (busy || p.my_vote !== null) return;
    setBusy(true);
    try {
      const r = await confessApi<{
        my_vote: number;
        counts: number[];
        total: number;
        already: boolean;
      }>({ action: "poll_vote", visitor_id: visitorId, poll_id: p.id, option_index: i });
      setP({ ...p, my_vote: r.my_vote, counts: r.counts, total: r.total });
      if (r.already) toast({ title: "Kamu sudah vote di polling ini" });
    } catch (e) {
      toast({ title: "Gagal vote", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1.5 rounded-xl border p-2 bg-muted/20">
      <div className="text-[10px] font-bold text-muted-foreground">🗳️ Polling · {p.total} vote</div>
      {p.options.map((o, i) => {
        const pct = p.counts && p.total ? Math.round((p.counts[i] / p.total) * 100) : 0;
        return p.counts ? (
          <div
            key={i}
            className={`relative rounded-lg overflow-hidden border text-[12px] ${p.my_vote === i ? "border-primary" : ""}`}
          >
            <div className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: `${pct}%` }} />
            <div className="relative flex justify-between px-2 py-1.5 font-semibold">
              <span>{o}</span>
              <span>{pct}%</span>
            </div>
          </div>
        ) : (
          <button
            key={i}
            type="button"
            disabled={busy}
            onClick={() => vote(i)}
            className="w-full text-left rounded-lg border px-2 py-1.5 text-[12px] font-semibold hover:bg-muted disabled:opacity-60"
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Replies ---------------- */
interface Reply {
  id: string;
  anon_no: number;
  message: string;
  reaction_count: number;
  created_at: string;
  is_author: boolean;
  is_mine: boolean;
  my_reacted: boolean;
}
export function RepliesSheet({
  visitorId,
  wallId,
  open,
  onClose,
  onChanged,
}: {
  visitorId: string;
  wallId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => {
    if (!wallId) return;
    setLoading(true);
    try {
      setItems(
        (
          await confessApi<{ items: Reply[] }>({
            action: "replies_list",
            visitor_id: visitorId,
            wall_id: wallId,
          })
        ).items,
      );
    } catch (e) {
      toast({ title: "Gagal memuat balasan", description: errMsg(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [visitorId, wallId]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await confessApi({
        action: "reply_create",
        visitor_id: visitorId,
        wall_id: wallId,
        message: text.trim(),
      });
      setText("");
      await load();
      onChanged();
    } catch (e) {
      toast({ title: "Gagal membalas", description: errMsg(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };
  const react = async (r: Reply) => {
    setItems((p) =>
      p.map((x) =>
        x.id === r.id
          ? {
              ...x,
              my_reacted: !x.my_reacted,
              reaction_count: x.reaction_count + (x.my_reacted ? -1 : 1),
            }
          : x,
      ),
    );
    try {
      await confessApi({ action: "reply_react", visitor_id: visitorId, reply_id: r.id });
    } catch {
      load();
    }
  };
  const report = async (r: Reply) => {
    if (!confirm("Laporkan balasan ini ke admin?")) return;
    try {
      await confessApi({
        action: "report",
        visitor_id: visitorId,
        target_type: "reply",
        target_id: r.id,
        reason: "abusive",
      });
      toast({ title: "Laporan terkirim", description: "Terima kasih, admin akan meninjau." });
    } catch (e) {
      toast({ title: "Gagal lapor", description: errMsg(e), variant: "destructive" });
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="💬 Balasan Anonim">
      {loading ? (
        <div className="py-6 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground text-center py-4">
          Belum ada balasan. Jadilah yang pertama.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="rounded-xl border p-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-bold">
                  {r.is_author ? "✍️ Pengirim" : `Anonim #${r.anon_no}`}
                  {r.is_mine ? " (kamu)" : ""}
                </span>
                <span>
                  {new Date(r.created_at).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="text-[13px] whitespace-pre-wrap">{r.message}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => react(r)}
                  className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${r.my_reacted ? "bg-primary/15 text-primary" : "hover:bg-muted text-muted-foreground"}`}
                >
                  <Heart className={`w-3 h-3 ${r.my_reacted ? "fill-current" : ""}`} />{" "}
                  {r.reaction_count}
                </button>
                {!r.is_mine && (
                  <button
                    type="button"
                    onClick={() => report(r)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <Flag className="w-3 h-3" /> Laporkan
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 sticky bottom-0 bg-background pt-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Tulis balasan anonim…"
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <Button
          type="button"
          size="icon"
          onClick={send}
          disabled={sending || !text.trim()}
          aria-label="Kirim balasan"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </Sheet>
  );
}

/* ---------------- Wall composer (free wall post with mood / mystery / poll) ---------------- */
export function WallComposer({
  visitorId,
  open,
  onClose,
  onPosted,
}: {
  visitorId: string;
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [mood, setMood] = useState("");
  const [mystery, setMystery] = useState(false);
  const [pollOn, setPollOn] = useState(false);
  const [opts, setOpts] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const poll_options = pollOn ? opts.map((o) => o.trim()).filter(Boolean) : undefined;
      if (pollOn && (poll_options?.length || 0) < 2)
        throw new Error("Isi minimal 2 pilihan polling");
      await confessApi({
        action: "wall_post",
        visitor_id: visitorId,
        message: msg,
        sender_name: name || null,
        mood_tag: mood || null,
        is_mystery: mystery,
        poll_options,
      });
      toast({ title: "✅ Confess tampil di Wall" });
      setMsg("");
      setName("");
      setMood("");
      setMystery(false);
      setPollOn(false);
      setOpts(["", "", ""]);
      onPosted();
      onClose();
    } catch (e) {
      toast({ title: "Gagal posting", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title="✍️ Post Anonim ke Wall">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold">Pesan</span>
        <EnhanceButton text={msg} onUse={setMsg} />
      </div>
      <Textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        rows={4}
        maxLength={500}
        placeholder="Tulis confess kamu… (gratis, tidak dikirim ke WhatsApp)"
      />
      {!mystery && (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Nama samaran (opsional)"
        />
      )}
      <div>
        <div className="text-[11px] font-semibold mb-1">Mood</div>
        <div className="flex flex-wrap gap-1">
          {CONFESS_MOODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMood(mood === m.tag ? "" : m.tag)}
              className={`px-2 py-1 rounded-full text-[11px] border ${mood === m.tag ? "bg-primary text-primary-foreground border-transparent" : "hover:bg-muted"}`}
            >
              {m.emoji} {m.tag}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center justify-between rounded-xl border p-2 text-[12px]">
        <span>
          🕵️ Mode Mystery{" "}
          <span className="text-muted-foreground text-[10px] block">
            Nama samaran & tujuan disembunyikan
          </span>
        </span>
        <Switch checked={mystery} onCheckedChange={setMystery} />
      </label>
      <label className="flex items-center justify-between rounded-xl border p-2 text-[12px]">
        <span>🗳️ Tambah Polling</span>
        <Switch checked={pollOn} onCheckedChange={setPollOn} />
      </label>
      {pollOn && (
        <div className="space-y-1.5">
          {opts.map((o, i) => (
            <Input
              key={i}
              value={o}
              maxLength={40}
              placeholder={["❤️ Balikan", "🧊 Jangan", "💬 Tanya dulu"][i] || `Pilihan ${i + 1}`}
              onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ))}
          {opts.length < 4 && (
            <button
              type="button"
              className="text-[11px] text-primary font-bold"
              onClick={() => setOpts([...opts, ""])}
            >
              + Pilihan
            </button>
          )}
        </div>
      )}
      <Button
        type="button"
        className="w-full"
        onClick={submit}
        disabled={busy || msg.trim().length < 3}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Posting ke Wall"}
      </Button>
    </Sheet>
  );
}

/* ---------------- AI Enhancer ---------------- */
const ENHANCE_OPTS = [
  { key: "romantis", label: "💗 Lebih romantis" },
  { key: "menyentuh", label: "🥀 Lebih menyentuh" },
  { key: "misterius", label: "🕵️ Lebih misterius" },
  { key: "lucu", label: "😂 Lebih lucu" },
  { key: "berani", label: "🔥 Lebih berani" },
  { key: "singkat", label: "✂️ Lebih singkat" },
  { key: "natural", label: "🌿 Lebih natural" },
];
export function EnhanceButton({ text, onUse }: { text: string; onUse: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState("natural");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const run = async (s = style) => {
    setStyle(s);
    setLoading(true);
    setResult("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confess-ai-generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ mode: "enhance", style: s, text }),
        },
      );
      const j = await res.json();
      if (!res.ok || !j?.message) throw new Error(j?.error || "Hasil kosong");
      setResult(j.message);
    } catch (e) {
      toast({ title: "Gagal merapikan", description: errMsg(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (text.trim().length < 3) {
            toast({ title: "Tulis pesan dulu", description: "AI akan merapikan tulisanmu." });
            return;
          }
          setResult("");
          setOpen(true);
        }}
        className="text-[11px] font-bold px-2.5 py-1 rounded-full border border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1"
      >
        <Sparkles className="w-3 h-3" /> Bantu Rapikan
      </button>
      <Sheet open={open} onClose={() => !loading && setOpen(false)} title="✨ Bantu Rapikan">
        <div className="grid grid-cols-2 gap-1.5">
          {ENHANCE_OPTS.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={loading}
              onClick={() => run(o.key)}
              className={`text-[12px] px-2 py-2 rounded-xl border font-semibold ${style === o.key && (result || loading) ? "bg-primary text-primary-foreground border-transparent" : "hover:bg-muted"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {loading && (
          <div className="py-4 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        )}
        {result && !loading && (
          <div className="space-y-2">
            <div className="rounded-xl border bg-muted/30 p-3 text-[13px] whitespace-pre-wrap">
              {result}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onUse(result);
                  setOpen(false);
                }}
              >
                Gunakan
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => run()}>
                Coba Lagi
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Batalkan
              </Button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground text-center">
          Tulisan aslimu tidak diganti sampai kamu tekan Gunakan.
        </p>
      </Sheet>
    </>
  );
}

/* ---------------- Missions ---------------- */
interface Mission {
  key: string;
  label: string;
  emoji: string;
  target: number;
  gems: number;
  progress: number;
  claimed: boolean;
}
export function MissionSheet({
  visitorId,
  open,
  onClose,
}: {
  visitorId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ daily: Mission[]; weekly: Mission[] } | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await confessApi({ action: "missions", visitor_id: visitorId }));
    } catch (e) {
      toast({ title: "Gagal memuat misi", description: errMsg(e), variant: "destructive" });
    }
  }, [visitorId]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);
  const claim = async (m: Mission) => {
    if (claiming) return;
    setClaiming(m.key);
    try {
      const r = await confessApi<{ gems_awarded: number }>({
        action: "mission_claim",
        visitor_id: visitorId,
        mission_key: m.key,
      });
      toast({ title: `🎁 +${r.gems_awarded} Gem`, description: m.label });
      await load();
    } catch (e) {
      toast({ title: "Gagal klaim", description: errMsg(e), variant: "destructive" });
      await load();
    } finally {
      setClaiming(null);
    }
  };
  const row = (m: Mission) => (
    <div key={m.key} className="rounded-xl border p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold">
          {m.emoji} {m.label}
        </span>
        <span className="text-[11px] font-bold text-primary whitespace-nowrap">+{m.gems} Gem</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${(m.progress / m.target) * 100}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {m.progress} / {m.target}
        </span>
        {m.claimed ? (
          <span className="text-[11px] font-bold text-muted-foreground">✅ Diklaim</span>
        ) : (
          <Button
            type="button"
            size="sm"
            className="h-7 text-[11px]"
            disabled={m.progress < m.target || !!claiming}
            onClick={() => claim(m)}
          >
            {claiming === m.key ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim"}
          </Button>
        )}
      </div>
    </div>
  );
  return (
    <Sheet open={open} onClose={onClose} title="🎯 Confess Mission">
      {!data ? (
        <div className="py-6 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : (
        <>
          <div className="text-[11px] font-extrabold text-muted-foreground">HARIAN</div>
          {data.daily.map(row)}
          <div className="text-[11px] font-extrabold text-muted-foreground pt-1">MINGGUAN</div>
          {data.weekly.map(row)}
          <p className="text-[10px] text-muted-foreground">
            Gem masuk ke saldo Gem akunmu. Tiap misi hanya bisa diklaim sekali per periode.
          </p>
        </>
      )}
    </Sheet>
  );
}

/* ---------------- Secret Crush ---------------- */
interface Pick {
  id: string;
  nickname: string;
  matched: boolean;
  created_at: string;
}
export function CrushSheet({
  visitorId,
  open,
  onClose,
}: {
  visitorId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [st, setSt] = useState<{ my_nickname: string | null; max: number; picks: Pick[] } | null>(
    null,
  );
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const load = useCallback(async () => {
    try {
      setSt(await confessApi({ action: "crush_status", visitor_id: visitorId }));
    } catch (e) {
      toast({ title: "Gagal memuat", description: errMsg(e), variant: "destructive" });
    }
  }, [visitorId]);
  useEffect(() => {
    if (open) {
      setCelebrate(false);
      load();
    }
  }, [open, load]);
  const pick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await confessApi<{ matched: boolean }>({
        action: "crush_pick",
        visitor_id: visitorId,
        nickname: nick.trim(),
      });
      setNick("");
      if (r.matched) {
        setCelebrate(true);
        toast({ title: "💘 SECRET CRUSH MATCH!", description: "🎉 Kalian saling memilih!" });
      } else
        toast({
          title: "💘 Tersimpan rahasia",
          description: "Dia tidak akan tahu, kecuali dia juga memilihmu.",
        });
      await load();
    } catch (e) {
      toast({ title: "Gagal", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (p: Pick) => {
    try {
      await confessApi({ action: "crush_cancel", visitor_id: visitorId, pick_id: p.id });
      await load();
    } catch (e) {
      toast({ title: "Gagal", description: errMsg(e), variant: "destructive" });
    }
  };
  const startChat = () => {
    window.location.href = "/anon-chat";
  };
  return (
    <Sheet open={open} onClose={onClose} title="💘 Secret Crush">
      {celebrate && (
        <div className="rounded-2xl bg-primary/10 border border-primary/40 p-4 text-center space-y-2">
          <div className="text-2xl">💘</div>
          <div className="font-black">SECRET CRUSH MATCH!</div>
          <div className="text-[12px]">🎉 Kalian saling memilih!</div>
          <Button type="button" size="sm" onClick={startChat}>
            <MessageCircle className="w-4 h-4 mr-1" /> Mulai Chat
          </Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Pilih seseorang lewat <b>nickname Anon Chat</b>-nya. Pilihanmu rahasia — dia tidak diberi
        tahu. Kalau dia juga memilihmu, kalian sama-sama dapat notifikasi match.
      </p>
      {!st ? (
        <div className="py-4 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : !st.my_nickname ? (
        <div className="rounded-xl border p-3 text-[12px] space-y-2">
          <p>Kamu perlu profil Anon Chat dulu supaya bisa dipilih balik.</p>
          <Button type="button" size="sm" onClick={startChat}>
            Buka Anon Chat
          </Button>
        </div>
      ) : (
        <>
          <div className="text-[11px]">
            Nickname kamu: <b>{st.my_nickname}</b>
          </div>
          <div className="flex gap-2">
            <Input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={40}
              placeholder="Nickname Anon Chat crush-mu"
              onKeyDown={(e) => e.key === "Enter" && pick()}
            />
            <Button
              type="button"
              onClick={pick}
              disabled={busy || nick.trim().length < 2 || st.picks.length >= st.max}
              aria-label="Pilih crush"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {st.picks.length} / {st.max} pilihan
          </div>
          {st.picks.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border p-2 text-[12px]"
            >
              <span className="font-semibold">
                {p.matched ? "💘" : "🤫"} {p.nickname}
              </span>
              {p.matched ? (
                <Button type="button" size="sm" className="h-7 text-[11px]" onClick={startChat}>
                  💬 Mulai Chat
                </Button>
              ) : (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                  onClick={() => cancel(p)}
                >
                  Batalkan
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}

/* ---------------- Mystery clue + insight ---------------- */
export function MysteryClue({
  mood,
  createdAt,
  reactions,
  replies,
}: {
  mood: string | null;
  createdAt: string;
  reactions: number;
  replies: number;
}) {
  const [open, setOpen] = useState(false);
  const h = Math.max(0, Math.round((Date.now() - Date.parse(createdAt)) / 3600000));
  const hour = new Date(createdAt).getHours();
  const part =
    hour < 5
      ? "dini hari"
      : hour < 11
        ? "pagi"
        : hour < 15
          ? "siang"
          : hour < 19
            ? "sore"
            : "malam";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-bold text-primary flex items-center gap-1"
      >
        <Search className="w-3 h-3" /> {open ? "Tutup Clue" : "Lihat Clue"}
      </button>
      {open && (
        <div className="rounded-xl bg-muted/40 p-2 text-[11px] grid grid-cols-2 gap-1">
          <span>
            {moodEmoji(mood)} {mood || "Tanpa mood"}
          </span>
          <span>
            🕐 {h < 1 ? "baru saja" : h < 24 ? `${h} jam lalu` : `${Math.round(h / 24)} hari lalu`}
          </span>
          <span>🌙 Ditulis {part}</span>
          <span>
            💗 {reactions} reaction · 💬 {replies} reply
          </span>
        </div>
      )}
    </>
  );
}

export function InsightRow({
  views,
  reactions,
  replies,
}: {
  views: number;
  reactions: number;
  replies: number;
}) {
  const eng = views > 0 ? Math.min(100, Math.round(((reactions + replies) / views) * 100)) : 0;
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl bg-primary/5 border border-primary/20 p-2 text-center text-[10px]">
      <div>
        <Eye className="w-3 h-3 mx-auto" />
        <b>{views}</b> views
      </div>
      <div>
        💗
        <br />
        <b>{reactions}</b>
      </div>
      <div>
        💬
        <br />
        <b>{replies}</b>
      </div>
      <div>
        🔥
        <br />
        <b>{eng}%</b>
      </div>
    </div>
  );
}

/** Records one anonymous view per visitor per post (hashed server-side). */
export function useRecordViews(visitorId: string, ids: string[]) {
  const sent = useRef(new Set<string>());
  useEffect(() => {
    const fresh = ids.filter((i) => !sent.current.has(i));
    if (!fresh.length) return;
    fresh.forEach((i) => sent.current.add(i));
    confessApi({ action: "view", visitor_id: visitorId, wall_ids: fresh }).catch(() => {});
  }, [visitorId, ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
}

export { Target, HeartHandshake };

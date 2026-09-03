import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ImagePlus, X, Trash2, Smile, Reply, Check, CheckCheck, Plus, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { moderateOutgoing } from "@/lib/chat-moderation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

export type ChatKind = "product" | "ticket";

export interface ChatMessage {
  id: string;
  sender_type: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
  is_read: boolean;
  read_at?: string | null;
  reply_to_id?: string | null;
  is_deleted?: boolean;
  deleted_for?: string[] | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  visitor_id: string;
  sender_type: string;
  emoji: string;
}

interface Props {
  kind: ChatKind;
  /** product chat_id OR support ticket_id */
  parentId: string;
  /** Current viewer identity */
  viewerType: "user" | "admin";
  viewerId: string; // visitor_id (or admin id)
  /** Disable send (e.g. ticket closed) */
  disabled?: boolean;
  disabledHint?: React.ReactNode;
  /** Optional header label shown on incoming side */
  incomingLabel?: string;
  /** Auto-render header info card above messages */
  headerSlot?: React.ReactNode;
  /** Constrain message scroll area */
  className?: string;
  scrollClassName?: string;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];

export default function WhatsAppChat({
  kind,
  parentId,
  viewerType,
  viewerId,
  disabled,
  disabledHint,
  incomingLabel,
  headerSlot,
  className,
  scrollClassName,
}: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<number | null>(null);

  const msgTable = kind === "product" ? "product_chat_messages" : "ticket_messages";
  const reactTable = kind === "product" ? "product_chat_reactions" : "ticket_message_reactions";
  const typingTable = kind === "product" ? "product_chat_typing" : "ticket_typing";
  const parentCol = kind === "product" ? "chat_id" : "ticket_id";
  const otherSenderType = viewerType === "user" ? "admin" : "user";

  const scrollBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }, 60);
  }, []);

  // Initial load + realtime
  useEffect(() => {
    if (!parentId) return;
    let active = true;

    (async () => {
      const { data: msgs } = await supabase
        .from(msgTable as any)
        .select("*")
        .eq(parentCol, parentId)
        .order("created_at");
      if (!active) return;
      const list = (msgs || []) as unknown as ChatMessage[];
      setMessages(list);
      scrollBottom();

      // Mark incoming as read
      const unread = list.filter((m) => m.sender_type !== viewerType && !m.is_read).map((m) => m.id);
      if (unread.length) {
        await supabase
          .from(msgTable as any)
          .update({ is_read: true, read_at: new Date().toISOString() } as any)
          .in("id", unread);
      }

      // Load reactions for these msgs
      if (list.length) {
        const { data: rx } = await supabase
          .from(reactTable as any)
          .select("*")
          .in("message_id", list.map((m) => m.id));
        if (active) setReactions((rx || []) as unknown as Reaction[]);
      }
    })();

    const channel = supabase
      .channel(`wa-${kind}-${parentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: msgTable, filter: `${parentCol}=eq.${parentId}` }, (p) => {
        const nm = p.new as unknown as ChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === nm.id) ? prev : [...prev, nm]));
        scrollBottom();
        if (nm.sender_type !== viewerType) {
          supabase.from(msgTable as any).update({ is_read: true, read_at: new Date().toISOString() } as any).eq("id", nm.id);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: msgTable, filter: `${parentCol}=eq.${parentId}` }, (p) => {
        const nm = p.new as any;
        setMessages((prev) => prev.map((m) => (m.id === nm.id ? { ...m, ...nm } : m)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: reactTable }, (p) => {
        const r = p.new as unknown as Reaction;
        setReactions((prev) => (prev.some((x) => x.id === r.id) ? prev : [...prev, r]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: reactTable }, (p) => {
        const r = p.old as any;
        setReactions((prev) => prev.filter((x) => x.id !== r.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: typingTable }, (p) => {
        const row = (p.new || p.old) as any;
        if (!row || row[parentCol] !== parentId) return;
        if (row.sender_type === otherSenderType) {
          const isTyping = !!(p.new as any)?.is_typing && p.eventType !== "DELETE";
          // Only show if updated within 6 seconds
          const updated = (p.new as any)?.updated_at ? new Date((p.new as any).updated_at).getTime() : 0;
          setOtherTyping(isTyping && Date.now() - updated < 6000);
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [parentId, kind, msgTable, reactTable, typingTable, parentCol, viewerType, otherSenderType, scrollBottom]);

  // Auto-clear stale typing
  useEffect(() => {
    if (!otherTyping) return;
    const t = window.setTimeout(() => setOtherTyping(false), 4500);
    return () => window.clearTimeout(t);
  }, [otherTyping]);

  // Push typing indicator
  const pushTyping = useCallback(
    async (typing: boolean) => {
      try {
        await supabase
          .from(typingTable as any)
          .upsert(
            {
              [parentCol]: parentId,
              sender_type: viewerType,
              is_typing: typing,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: `${parentCol},sender_type` } as any,
          );
      } catch {}
    },
    [typingTable, parentCol, parentId, viewerType],
  );

  function onChangeDraft(v: string) {
    setDraft(v);
    pushTyping(true);
    if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => pushTyping(false), 2500);
  }

  async function sendMessage() {
    const raw = draft.trim();
    if (!raw) return;

    let textToSend = raw;
    // Moderation hanya berlaku untuk sisi pengguna (bukan admin)
    if (viewerType === "user") {
      const mod = moderateOutgoing(raw);
      if (!mod.ok) {
        // Catat pelanggaran (auto-ban setelah 3x dalam 24 jam)
        try {
          const { data } = await supabase.rpc("report_chat_violation", {
            p_visitor_id: viewerId,
            p_kind: mod.hadContact ? "contact_share" : "banned_word",
            p_detail: raw.slice(0, 200),
          });
          const count = (data as number) ?? 0;
          const sisa = Math.max(0, 3 - count);
          toast({
            title: "Pesan ditahan & disensor",
            description:
              mod.reasons.join(". ") +
              (sisa > 0
                ? `. Peringatan ${count}/3 — ${sisa} lagi akun akan diblokir 7 hari.`
                : ". Akun Anda telah diblokir otomatis selama 7 hari."),
            variant: "destructive",
          });
        } catch {}
        if (!mod.cleaned) {
          // Tidak ada konten yang tersisa setelah sensor
          setDraft("");
          return;
        }
        textToSend = mod.cleaned;
      }
    }

    setDraft("");
    pushTyping(false);
    const payload: any = {
      [parentCol]: parentId,
      sender_type: viewerType,
      message: textToSend,
    };
    if (replyTo) payload.reply_to_id = replyTo.id;
    setReplyTo(null);
    const { error } = await supabase.from(msgTable as any).insert(payload);
    if (error) toast({ title: "Gagal kirim pesan", description: error.message, variant: "destructive" });
  }

  async function sendImage(file: File) {
    if (!file) return;
    const ext = file.name.split(".").pop();
    const folder = kind === "product" ? "chats" : "tickets";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-images").upload(path, file);
    if (error) {
      toast({ title: "Gagal upload gambar", variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(path);
    const payload: any = {
      [parentCol]: parentId,
      sender_type: viewerType,
      image_url: urlData.publicUrl,
    };
    if (replyTo) payload.reply_to_id = replyTo.id;
    setReplyTo(null);
    await supabase.from(msgTable as any).insert(payload);
  }

  // Hapus untuk semua orang (hanya pemilik pesan)
  async function deleteForEveryone(m: ChatMessage) {
    if (m.sender_type !== viewerType) return;
    const { error } = await supabase
      .from(msgTable as any)
      .update({ is_deleted: true, message: null, image_url: null, deleted_at: new Date().toISOString() } as any)
      .eq("id", m.id);
    if (error) toast({ title: "Gagal menghapus", variant: "destructive" });
  }

  // Hapus untuk saya saja: tambahkan viewerId ke deleted_for
  async function deleteForMe(m: ChatMessage) {
    const next = Array.from(new Set([...(m.deleted_for || []), viewerId]));
    // Optimistic update lokal
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_for: next } : x)));
    const { error } = await supabase
      .from(msgTable as any)
      .update({ deleted_for: next } as any)
      .eq("id", m.id);
    if (error) toast({ title: "Gagal menghapus", variant: "destructive" });
  }

  async function toggleReaction(m: ChatMessage, emoji: string) {
    setEmojiFor(null);
    const existing = reactions.find(
      (r) => r.message_id === m.id && r.visitor_id === viewerId && r.emoji === emoji,
    );
    if (existing) {
      await supabase.from(reactTable as any).delete().eq("id", existing.id);
    } else {
      await supabase
        .from(reactTable as any)
        .insert({
          message_id: m.id,
          visitor_id: viewerId,
          sender_type: viewerType,
          emoji,
        } as any);
    }
  }

  const reactionsByMsg = useMemo(() => {
    const map: Record<string, Record<string, { count: number; mine: boolean }>> = {};
    for (const r of reactions) {
      if (!map[r.message_id]) map[r.message_id] = {};
      const slot = map[r.message_id][r.emoji] || { count: 0, mine: false };
      slot.count += 1;
      if (r.visitor_id === viewerId) slot.mine = true;
      map[r.message_id][r.emoji] = slot;
    }
    return map;
  }, [reactions, viewerId]);

  const messagesById = useMemo(() => {
    const map: Record<string, ChatMessage> = {};
    for (const m of messages) map[m.id] = m;
    return map;
  }, [messages]);

  // Pesan terakhir milik kita yang sudah dibaca lawan bicara → tampilkan "Dilihat"
  const lastSeenMine = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender_type === viewerType && m.is_read && !m.is_deleted) return m;
    }
    return null;
  }, [messages, viewerType]);

  const seenLabel = (m: ChatMessage) => {
    const iso = m.read_at || m.created_at;
    const d = new Date(iso);
    const today = new Date();
    const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === today.toDateString()) return `Dilihat ${jam}`;
    return `Dilihat ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} ${jam}`;
  };

  // Group messages by date for separators
  const dateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Hari ini";
    if (d.toDateString() === yest.toDateString()) return "Kemarin";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-3 space-y-2 chat-wallpaper ${scrollClassName ?? ""}`}
      >
        {headerSlot}
        {messages.map((m, idx) => {
          // Hapus untuk saya: sembunyikan di sisi viewer ini saja
          if ((m.deleted_for || []).includes(viewerId)) return null;
          const mine = m.sender_type === viewerType;
          const replied = m.reply_to_id ? messagesById[m.reply_to_id] : null;
          const rx = reactionsByMsg[m.id];
          const prev = messages[idx - 1];
          const showDate = !prev || dateLabel(prev.created_at) !== dateLabel(m.created_at);
          const groupedWithPrev =
            prev && prev.sender_type === m.sender_type && !showDate &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000;
          return (
            <div key={m.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground">
                    {dateLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"} ${groupedWithPrev ? "mt-0.5" : "mt-1.5"} animate-fade-in`}>
                <div className="relative group max-w-[82%]">
                  <div
                    className={`relative px-3 py-2 border transition-colors ${
                      mine
                        ? `border-foreground bg-foreground text-background ${
                            groupedWithPrev ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"
                          }`
                        : `border-border bg-card ${
                            groupedWithPrev ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-sm"
                          }`
                    } ${m.is_deleted ? "italic opacity-70" : ""}`}
                    onDoubleClick={() => !m.is_deleted && setEmojiFor(emojiFor === m.id ? null : m.id)}
                  >
                  {!mine && incomingLabel && !m.is_deleted && (
                    <p className="text-[10px] font-bold mb-0.5 opacity-80">{incomingLabel}</p>
                  )}

                  {/* Quoted reply preview */}
                  {replied && !m.is_deleted && (
                    <div
                      className={`mb-1 border-l-2 pl-2 py-1 rounded text-[11px] ${
                        mine ? "border-background/40 bg-background/10" : "border-border bg-muted/60"
                      }`}
                    >
                      <p className="font-semibold opacity-80">
                        {replied.sender_type === viewerType ? "Kamu" : incomingLabel || "Pesan"}
                      </p>
                      <p className="truncate opacity-80">
                        {replied.is_deleted ? "Pesan dihapus" : replied.message || (replied.image_url ? "📷 Foto" : "")}
                      </p>
                    </div>
                  )}

                  {m.is_deleted ? (
                    <p className="text-sm flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Pesan ini dihapus
                    </p>
                  ) : (
                    <>
                      {m.message && <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>}
                      {m.image_url && <img src={m.image_url} className="max-w-full rounded-lg mt-1" alt="" />}
                    </>
                  )}

                  <div
                    className={`text-[9px] mt-1 flex items-center gap-0.5 ${
                      mine ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    {mine && !m.is_deleted && (
                      <span className="ml-0.5">
                        {m.is_read ? (
                          <CheckCheck className={`w-3 h-3 ${mine ? "text-cyan-200" : "text-primary"}`} />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {lastSeenMine?.id === m.id && (
                  <p className="mt-0.5 text-right text-[9px] font-medium text-muted-foreground">
                    {seenLabel(m)}
                  </p>
                )}

                {/* Reactions chips */}
                {rx && Object.keys(rx).length > 0 && !m.is_deleted && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                    {Object.entries(rx).map(([emo, { count, mine: isMine }]) => (
                      <button
                        key={emo}
                        onClick={() => toggleReaction(m, emo)}
                        className={`text-[11px] px-1.5 py-0.5 rounded-full border bg-card flex items-center gap-0.5 ${
                          isMine ? "border-foreground" : "border-border"
                        }`}
                      >
                        <span>{emo}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Action toolbar - visible on hover/tap */}
                {!m.is_deleted && (
                  <div
                    className={`absolute -top-3 ${mine ? "right-1" : "left-1"} flex gap-1 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity`}
                  >
                    <button
                      onClick={() => setEmojiFor(emojiFor === m.id ? null : m.id)}
                      className="w-6 h-6 rounded-full bg-background border border-border shadow flex items-center justify-center hover:bg-muted"
                      aria-label="React"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setReplyTo(m)}
                      className="w-6 h-6 rounded-full bg-background border border-border shadow flex items-center justify-center hover:bg-muted"
                      aria-label="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="w-6 h-6 rounded-full bg-background border border-border text-muted-foreground flex items-center justify-center hover:bg-muted"
                          aria-label="Opsi"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={mine ? "end" : "start"} className="w-44">
                        <DropdownMenuItem onClick={() => deleteForMe(m)}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Hapus untuk saya
                        </DropdownMenuItem>
                        {mine && (
                          <DropdownMenuItem onClick={() => deleteForEveryone(m)} className="text-destructive">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Hapus untuk semua
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {/* Emoji picker popover */}
                {emojiFor === m.id && (
                  <div
                    className={`absolute z-20 -top-10 ${mine ? "right-0" : "left-0"} bg-card border border-border rounded-full px-1.5 py-1 flex gap-0.5`}
                  >
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => toggleReaction(m, e)}
                        className="w-7 h-7 rounded-full hover:bg-muted text-base"
                      >
                        {e}
                      </button>
                    ))}
                    <button
                      onClick={() => setEmojiFor(null)}
                      className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                </div>
              </div>
            </div>
          );
        })}

        {otherTyping && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}
      </div>

      {disabled ? (
        <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          {disabledHint || "Chat ditutup"}
        </div>
      ) : (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-md p-2.5 space-y-2">
          {replyTo && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-2 text-[11px] animate-fade-in">
              <Reply className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">
                  Membalas {replyTo.sender_type === viewerType ? "diri sendiri" : incomingLabel || "pesan"}
                </p>
                <p className="truncate opacity-80">
                  {replyTo.message || (replyTo.image_url ? "📷 Foto" : "")}
                </p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-background rounded-full transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {showInputEmoji && (
            <div className="relative animate-fade-in">
              <Suspense fallback={<div className="text-xs text-muted-foreground p-3">Memuat emoji…</div>}>
                <EmojiPicker
                  onEmojiClick={(e: any) => {
                    setDraft((d) => d + (e?.emoji ?? ""));
                    inputRef.current?.focus();
                  }}
                  width="100%"
                  height={320}
                  searchPlaceHolder="Cari emoji…"
                  previewConfig={{ showPreview: false }}
                />
              </Suspense>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInputEmoji((v) => !v)}
              aria-label="Buka emoji"
              className={`w-10 h-10 rounded-xl border bg-card flex items-center justify-center shrink-0 transition-colors ${
                showInputEmoji ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Plus className={`w-[18px] h-[18px] transition-transform ${showInputEmoji ? "rotate-45" : ""}`} />
            </button>
            <label className="w-10 h-10 rounded-xl border border-border bg-card hover:bg-muted/50 flex items-center justify-center cursor-pointer shrink-0 transition-colors">
              <ImagePlus className="w-[18px] h-[18px] text-muted-foreground" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) sendImage(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                placeholder="Tulis pesan…"
                value={draft}
                onChange={(e) => onChangeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                onFocus={() => setShowInputEmoji(false)}
                onBlur={() => pushTyping(false)}
                className="h-10 rounded-xl border-border bg-card pl-4 pr-4 focus-visible:ring-ring"
              />
            </div>
            <Button
              size="icon"
              onClick={sendMessage}
              disabled={!draft.trim()}
              className="h-10 w-10 shrink-0 rounded-xl bg-foreground text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              <Send className="w-[18px] h-[18px]" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

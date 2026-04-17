import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ImagePlus, X, Trash2, Smile, Reply, Check, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type ChatKind = "product" | "ticket";

export interface ChatMessage {
  id: string;
  sender_type: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
  is_read: boolean;
  reply_to_id?: string | null;
  is_deleted?: boolean;
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
        await supabase.from(msgTable as any).update({ is_read: true } as any).in("id", unread);
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
          supabase.from(msgTable as any).update({ is_read: true } as any).eq("id", nm.id);
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
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    pushTyping(false);
    const payload: any = {
      [parentCol]: parentId,
      sender_type: viewerType,
      message: text,
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

  async function softDelete(m: ChatMessage) {
    if (m.sender_type !== viewerType) return;
    const { error } = await supabase
      .from(msgTable as any)
      .update({ is_deleted: true, message: null, image_url: null, deleted_at: new Date().toISOString() } as any)
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
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md border border-border/50 text-muted-foreground shadow-sm">
                    {dateLabel(m.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"} ${groupedWithPrev ? "mt-0.5" : "mt-1.5"} animate-fade-in`}>
                <div className="relative group max-w-[82%]">
                  <div
                    className={`relative px-3 py-2 shadow-md transition-all ${
                      mine
                        ? `bg-gradient-to-br from-primary to-primary/85 text-primary-foreground ${
                            groupedWithPrev ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"
                          }`
                        : `bg-card/95 backdrop-blur-sm border border-border/60 ${
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
                        mine ? "border-primary-foreground/60 bg-primary-foreground/10" : "border-primary bg-primary/10"
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
                          <CheckCheck className="w-3 h-3 text-sky-300" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reactions chips */}
                {rx && Object.keys(rx).length > 0 && !m.is_deleted && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                    {Object.entries(rx).map(([emo, { count, mine: isMine }]) => (
                      <button
                        key={emo}
                        onClick={() => toggleReaction(m, emo)}
                        className={`text-[11px] px-1.5 py-0.5 rounded-full border bg-background shadow-sm flex items-center gap-0.5 ${
                          isMine ? "border-primary" : "border-border"
                        }`}
                      >
                        <span>{emo}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Action toolbar — visible on hover/tap */}
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
                    {mine && (
                      <button
                        onClick={() => softDelete(m)}
                        className="w-6 h-6 rounded-full bg-background border border-destructive/40 text-destructive shadow flex items-center justify-center hover:bg-destructive/10"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Emoji picker popover */}
                {emojiFor === m.id && (
                  <div
                    className={`absolute z-20 -top-10 ${mine ? "right-0" : "left-0"} bg-background border border-border rounded-full shadow-lg px-1.5 py-1 flex gap-0.5`}
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
            <div className="bg-card/95 backdrop-blur-sm border border-border/60 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}
      </div>

      {disabled ? (
        <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          {disabledHint || "Chat ditutup"}
        </div>
      ) : (
        <div className="border-t border-border p-2 space-y-2">
          {replyTo && (
            <div className="flex items-start gap-2 bg-muted/60 border-l-2 border-primary rounded-md px-2 py-1.5 text-[11px]">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary">
                  Membalas {replyTo.sender_type === viewerType ? "diri sendiri" : incomingLabel || "pesan"}
                </p>
                <p className="truncate opacity-80">
                  {replyTo.message || (replyTo.image_url ? "📷 Foto" : "")}
                </p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-0.5 hover:bg-background rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 shrink-0">
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
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
            <Input
              placeholder="Tulis pesan…"
              value={draft}
              onChange={(e) => onChangeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onBlur={() => pushTyping(false)}
              className="flex-1"
            />
            <Button size="icon" onClick={sendMessage} disabled={!draft.trim()} className="shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

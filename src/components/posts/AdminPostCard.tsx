import { CalendarDays, Heart, Share2, ArrowRight, Star, Camera, PlayCircle, Users, MessageCircle, AtSign, Music2 } from "lucide-react";
import { categoryLabel, isNewPost, postCta, socialLinks } from "./adminPostMeta";

export interface PostLike {
  id: string; title: string; content?: string | null; image_url?: string | null; created_at?: string; category?: string | null;
  action_tab?: string | null; cta_label?: string | null; is_featured?: boolean; like_count?: number; image_position?: string | null; link_url?: string | null;
  [k: string]: any;
}

interface Props {
  post: PostLike;
  liked?: boolean;
  likeCount?: number;
  variant?: "feed" | "compact" | "detail";
  onOpen?: () => void;
  onCta?: () => void;
  onLike?: (e: React.MouseEvent) => void;
  onShare?: (e: React.MouseEvent) => void;
}

const SOCIAL_ICON: Record<string, any> = { wa: MessageCircle, ig: Camera, tt: Music2, yt: PlayCircle, x: AtSign, fb: Users };
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "Hari ini";

/** Official announcement card for the existing admin_posts feed (home preview, feed, detail, admin live preview). */
export default function AdminPostCard({ post, liked, likeCount, variant = "feed", onOpen, onCta, onLike, onShare }: Props) {
  const cta = postCta(post);
  const fresh = isNewPost(post.created_at);
  const count = likeCount ?? post.like_count ?? 0;
  const pos = post.image_position || "center";
  const featured = !!post.is_featured && variant !== "compact";
  const btn = "min-h-11 rounded-2xl text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (variant === "compact") {
    return (
      <article className="group overflow-hidden rounded-[20px] bg-card/80 backdrop-blur-xl border border-border shadow-sm">
        <button type="button" onClick={onOpen} className="w-full flex items-stretch text-left">
          <div className="relative w-28 shrink-0 aspect-square overflow-hidden bg-muted">
            {post.image_url ? <img src={post.image_url} alt={post.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-500" style={{ objectPosition: pos }} /> : <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20" />}
            {fresh && <span className="absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">✨ BARU</span>}
          </div>
          <div className="min-w-0 flex-1 p-3">
            <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Resmi</span>
              <span className="truncate">{categoryLabel(post.category)}</span>
            </div>
            <h4 className="mt-1 font-bold text-[14px] leading-snug line-clamp-2 text-foreground">{post.title}</h4>
            {post.content && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{post.content}</p>}
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(post.created_at)}</p>
          </div>
        </button>
        <div className="grid grid-cols-3 gap-1.5 px-2.5 pb-2.5">
          <button type="button" onClick={onLike} aria-label="Suka" className={`${btn} ${liked ? "bg-destructive/15 text-destructive" : "bg-muted text-foreground/80"}`}><Heart className="w-4 h-4" fill={liked ? "currentColor" : "none"} />{count}</button>
          <button type="button" onClick={onShare} className={`${btn} bg-muted text-foreground/80`}><Share2 className="w-4 h-4" />Bagikan</button>
          <button type="button" onClick={cta.label ? onCta : onOpen} className={`${btn} bg-primary text-primary-foreground shadow-[0_6px_18px_-6px_hsl(var(--primary)/0.7)]`}>Buka<ArrowRight className="w-4 h-4" /></button>
        </div>
      </article>
    );
  }

  const socials = variant === "detail" ? socialLinks(post) : [];

  return (
    <article className={`group relative overflow-hidden rounded-[24px] bg-card/85 backdrop-blur-xl border shadow-[0_18px_50px_-22px_hsl(var(--foreground)/0.35)] ${featured ? "border-primary/50 ring-1 ring-primary/30" : "border-border"}`}>
      <button type="button" onClick={onOpen} className="relative block w-full aspect-[16/9] overflow-hidden bg-muted text-left" disabled={!onOpen}>
        {post.image_url ? (
          <img src={post.image_url} alt={post.title} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover md:group-hover:scale-[1.04] transition-transform duration-700" style={{ objectPosition: pos }} />
        ) : <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/25 to-background" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-foreground/10 to-transparent opacity-40 pointer-events-none" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {featured && <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-primary text-primary-foreground"><Star className="w-3 h-3" fill="currentColor" />FEATURED</span>}
          {fresh && <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-background/70 backdrop-blur text-foreground">🔥 TERBARU</span>}
        </div>
      </button>
      <div className="relative -mt-8 px-4 pb-4 space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 backdrop-blur border border-border text-emerald-500"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_currentColor]" />RESMI</span>
          <span className="px-2 py-1 rounded-full bg-background/80 backdrop-blur border border-border text-foreground/80">{categoryLabel(post.category)}</span>
          <span className="px-2 py-1 rounded-full bg-background/80 backdrop-blur border border-border text-muted-foreground flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(post.created_at)}</span>
        </div>
        <h3 className={`font-black tracking-tight leading-tight text-foreground ${variant === "detail" ? "text-2xl" : featured ? "text-xl" : "text-[17px]"}`}>{post.title}</h3>
        {post.content && <p className={`text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line ${variant === "detail" ? "" : "line-clamp-3"}`}>{post.content}</p>}
        {cta.label && (
          <button type="button" onClick={onCta} className={`${btn} w-full bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.8)] hover:brightness-110`}>
            {variant === "detail" ? cta.label.replace(/^(\S+)\s.*$/, "$1 Coba Sekarang") : cta.label}<ArrowRight className="w-4 h-4" />
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onLike} aria-label="Suka" className={`${btn} border ${liked ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-muted text-foreground/85 border-border"}`}>
            <Heart className="w-4 h-4" fill={liked ? "currentColor" : "none"} />{liked ? "Disukai" : "Suka"} · {count}
          </button>
          <button type="button" onClick={onShare} className={`${btn} bg-muted text-foreground/85 border border-border`}><Share2 className="w-4 h-4" />Bagikan</button>
        </div>
        {variant === "feed" && onOpen && <button type="button" onClick={onOpen} className="w-full text-[11.5px] font-semibold text-muted-foreground hover:text-foreground min-h-9">Baca selengkapnya →</button>}
        {socials.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Hubungi via</p>
            <div className="flex flex-wrap gap-1.5">
              {socials.map((s) => { const I = SOCIAL_ICON[s.key]; return (
                <a key={s.key} href={s.href} target="_blank" rel="noopener noreferrer" className="min-h-10 inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 rounded-full bg-muted text-foreground/85 hover:bg-foreground hover:text-background transition active:scale-95"><I className="w-4 h-4" />{s.label}</a>
              ); })}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

import { Heart, Lightbulb, Timer, Shield, Gem, Coins, Sparkles, Ticket } from "lucide-react";

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface RarityStyle {
  /** Solid gradient (cards, badges) */
  gradient: string;
  ring: string;
  glow: string;
  label: string;
  /** Text accent */
  text: string;
  /** Subtle tinted background */
  soft: string;
  border: string;
  bar: string;
}

/** One rarity identity used everywhere on Luck Royale. Mythic = red; rainbow glow only via `royale-mythic-glow`. */
export const RARITY_STYLE: Record<string, RarityStyle> = {
  common: { gradient: "from-slate-500 to-slate-700", ring: "ring-slate-300/30", glow: "shadow-slate-400/20", label: "COMMON", text: "text-slate-200", soft: "bg-slate-300/[0.07]", border: "border-slate-300/20", bar: "bg-slate-300" },
  rare: { gradient: "from-cyan-500 to-blue-600", ring: "ring-cyan-300/40", glow: "shadow-cyan-500/30", label: "RARE", text: "text-cyan-200", soft: "bg-cyan-400/[0.08]", border: "border-cyan-300/30", bar: "bg-cyan-400" },
  epic: { gradient: "from-fuchsia-500 to-purple-700", ring: "ring-fuchsia-300/40", glow: "shadow-fuchsia-500/30", label: "EPIC", text: "text-fuchsia-200", soft: "bg-fuchsia-400/[0.08]", border: "border-fuchsia-300/30", bar: "bg-fuchsia-400" },
  legendary: { gradient: "from-amber-400 to-orange-600", ring: "ring-amber-300/50", glow: "shadow-amber-500/40", label: "LEGENDARY", text: "text-amber-200", soft: "bg-amber-400/[0.09]", border: "border-amber-300/35", bar: "bg-amber-400" },
  mythic: { gradient: "from-rose-500 via-red-600 to-amber-500", ring: "ring-rose-300/60", glow: "shadow-rose-500/50", label: "MYTHIC", text: "text-rose-200", soft: "bg-rose-500/[0.1]", border: "border-rose-300/40", bar: "bg-rose-400" },
};

export const RARITY_RANK: Record<string, number> = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 };

export const rarityStyle = (r?: string) => RARITY_STYLE[r || "common"] || RARITY_STYLE.common;

/** Strip leading emoji from server labels so the icon is not duplicated. */
export const cleanLabel = (label: string) => label.replace(/[👑💎🌈🎰❤️💡⏱️🛡️🪙🎁🎟️🔥✨]/gu, "").replace(/\s+/g, " ").trim();

export function getKindIcon(kind: string) {
  switch (kind) {
    case "extra_life": return <Heart className="w-full h-full" fill="currentColor" />;
    case "auto_hint": return <Lightbulb className="w-full h-full" fill="currentColor" />;
    case "time_freeze": return <Timer className="w-full h-full" />;
    case "streak_freeze": return <Shield className="w-full h-full" fill="currentColor" />;
    case "gems": return <Gem className="w-full h-full" fill="currentColor" />;
    case "spin_ticket_normal":
    case "spin_ticket_premium": return <Ticket className="w-full h-full" />;
    case "streak_coins":
    case "coins": return <Coins className="w-full h-full" fill="currentColor" />;
    default: return <Sparkles className="w-full h-full" />;
  }
}

export const fmtNum = (n: number) => Math.round(Number(n) || 0).toLocaleString("id-ID");

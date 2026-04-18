import {
  Gift, Sparkles, ShoppingBag, Trophy, Coins, Target, Zap, Rocket, Gamepad2, Flame,
  Crown, Star, Gem, Box, Calendar, Award, Medal, Save, Cloud, Snowflake, Joystick,
  Shield, Sprout, Swords, Bird, Moon, HeartHandshake, Sword, Wallet, Heart, PartyPopper,
  Clover, Wand2, Lightbulb, ThumbsUp,
} from "lucide-react";

export interface IconMatch {
  Icon: any;
  cls: string;
}

// Maps emoji characters → 3D Lucide icon + glow class
const MAP: Record<string, IconMatch> = {
  "🎮": { Icon: Gamepad2, cls: "icon-3d-zap" },
  "🕹️": { Icon: Joystick, cls: "icon-3d-zap" },
  "🏆": { Icon: Trophy, cls: "icon-3d-trophy" },
  "🥇": { Icon: Award, cls: "icon-3d-trophy" },
  "🏅": { Icon: Medal, cls: "icon-3d-trophy" },
  "🔥": { Icon: Flame, cls: "icon-3d-flame" },
  "⚡": { Icon: Zap, cls: "icon-3d-zap" },
  "🎁": { Icon: Gift, cls: "icon-3d-gift" },
  "💎": { Icon: Gem, cls: "icon-3d-trophy" },
  "👑": { Icon: Crown, cls: "icon-3d-trophy" },
  "⭐": { Icon: Star, cls: "icon-3d-sparkles" },
  "🌟": { Icon: Sparkles, cls: "icon-3d-sparkles" },
  "✨": { Icon: Sparkles, cls: "icon-3d-sparkles" },
  "💫": { Icon: Sparkles, cls: "icon-3d-sparkles" },
  "🎯": { Icon: Target, cls: "icon-3d-target" },
  "📦": { Icon: Box, cls: "icon-3d-gift" },
  "🚀": { Icon: Rocket, cls: "icon-3d-zap" },
  "📅": { Icon: Calendar, cls: "icon-3d-target" },
  "💰": { Icon: Coins, cls: "icon-3d-coin" },
  "🛍️": { Icon: ShoppingBag, cls: "icon-3d-gift" },
  "💾": { Icon: Save, cls: "icon-3d-target" },
  "☁️": { Icon: Cloud, cls: "icon-3d-sparkles" },
  "❄️": { Icon: Snowflake, cls: "icon-3d-sparkles" },
  "🛡️": { Icon: Shield, cls: "icon-3d-trophy" },
  "🌱": { Icon: Sprout, cls: "icon-3d-flame" },
  "⚔️": { Icon: Swords, cls: "icon-3d-zap" },
  "🐦": { Icon: Bird, cls: "icon-3d-sparkles" },
  "🦉": { Icon: Moon, cls: "icon-3d-sparkles" },
  "💯": { Icon: Trophy, cls: "icon-3d-trophy" },
  "💝": { Icon: Heart, cls: "icon-3d-flame" },
  "💪": { Icon: ThumbsUp, cls: "icon-3d-zap" },
  "🍀": { Icon: Clover, cls: "icon-3d-flame" },
  "🪄": { Icon: Wand2, cls: "icon-3d-sparkles" },
  "💡": { Icon: Lightbulb, cls: "icon-3d-sparkles" },
  "🤝": { Icon: HeartHandshake, cls: "icon-3d-flame" },
  "🎉": { Icon: PartyPopper, cls: "icon-3d-party" },
};

/** Match a leading emoji (or a standalone emoji) and return icon + remaining text */
export function parseEmojiIcon(input: string): { match: IconMatch | null; text: string } {
  if (!input) return { match: null, text: "" };
  const trimmed = input.trim();
  // Try direct mapping first (whole string is an emoji)
  if (MAP[trimmed]) return { match: MAP[trimmed], text: "" };
  // Try first 1-2 chars (some emoji are 2 codepoints)
  for (const key of Object.keys(MAP)) {
    if (trimmed.startsWith(key)) {
      return { match: MAP[key], text: trimmed.slice(key.length).trim() };
    }
  }
  // Fallback: strip any leading emoji-like char
  const stripped = trimmed.replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation})\uFE0F?\s*/u, "");
  return { match: null, text: stripped };
}

/** Render a 3D icon for the given emoji string. Returns null if no match. */
export function EmojiIcon({ emoji, className = "w-6 h-6" }: { emoji: string; className?: string }) {
  const { match } = parseEmojiIcon(emoji);
  if (!match) return <span className={className}>{emoji}</span>;
  const { Icon, cls } = match;
  return <Icon className={`${className} ${cls}`} strokeWidth={2.5} />;
}

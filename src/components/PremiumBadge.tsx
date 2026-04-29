import { Crown } from "lucide-react";

interface Props {
  size?: "xs" | "sm" | "md";
  className?: string;
  showText?: boolean;
}

export default function PremiumBadge({ size = "sm", className = "", showText = true }: Props) {
  const px = size === "xs" ? "px-1.5 py-0.5 text-[8px]" : size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[9px]";
  const ic = size === "xs" ? "w-2.5 h-2.5" : size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-black uppercase tracking-wide bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 border border-amber-600/40 shadow-[0_0_10px_rgba(251,191,36,0.5)] ${px} ${className}`}
      title="Member Premium Toko"
    >
      <Crown className={`${ic} fill-amber-700`} />
      {showText && <span>PREMIUM</span>}
    </span>
  );
}

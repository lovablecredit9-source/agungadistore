import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  withTooltip?: boolean;
}

const SIZES = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

/**
 * Centang biru "Produk Resmi Toko" — gradient cyan/biru ala verified mark.
 * Fill putih untuk centang, background gradient biru.
 */
export function VerifiedBadge({ size = "sm", className, withTooltip = true }: VerifiedBadgeProps) {
  return (
    <span
      title={withTooltip ? "Produk Resmi Agung Adi Store" : undefined}
      className={cn(
        "inline-flex items-center justify-center shrink-0 align-middle",
        "drop-shadow-[0_0_6px_rgba(56,189,248,0.55)]",
        className,
      )}
      aria-label="Produk terverifikasi"
    >
      <span className="relative inline-flex">
        {/* Glow pulse */}
        <span className="absolute inset-0 rounded-full bg-sky-400/40 blur-[3px] animate-pulse" />
        <BadgeCheck
          className={cn(
            SIZES[size],
            "relative text-sky-400 fill-sky-500/90 stroke-white",
          )}
          strokeWidth={2.5}
        />
      </span>
    </span>
  );
}

export default VerifiedBadge;

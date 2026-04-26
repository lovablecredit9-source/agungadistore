import { useAudioBands } from "@/lib/audio-visualizer";
import { cn } from "@/lib/utils";

interface MusicEqualizerProps {
  isPlaying: boolean;
  bars?: number;
  className?: string;
  barClassName?: string;
  /** max height in px */
  height?: number;
  /** color variant */
  variant?: "neon" | "white" | "primary" | "rainbow";
  /** bar width in px */
  barWidth?: number;
}

// Rainbow palette — repeats if more bars than colors
const RAINBOW = [
  "#ec4899", // pink
  "#f59e0b", // amber
  "#facc15", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#a855f7", // purple
];

const GLOW: Record<number, string> = {};
function glowFor(color: string) {
  return `0 0 6px ${color}cc, 0 0 12px ${color}66`;
}

/**
 * Real-time audio-reactive equalizer bars.
 * Falls back to a smooth synthetic animation if Web Audio isn't connected.
 */
export default function MusicEqualizer({
  isPlaying,
  bars = 5,
  className,
  barClassName,
  height = 16,
  variant = "neon",
  barWidth = 2,
}: MusicEqualizerProps) {
  const bands = useAudioBands(bars, isPlaying);

  const baseColorClass =
    variant === "white"
      ? "bg-white/90"
      : variant === "primary"
      ? "bg-primary"
      : variant === "neon"
      ? "bg-gradient-to-t from-pink-400 via-fuchsia-400 to-indigo-400"
      : ""; // rainbow uses inline color per bar

  return (
    <div
      className={cn("flex items-end justify-center gap-[2px]", className)}
      style={{ height }}
      aria-hidden="true"
    >
      {bands.map((v, i) => {
        const h = Math.max(2, Math.round(v * height));
        const color = variant === "rainbow" ? RAINBOW[i % RAINBOW.length] : null;
        return (
          <span
            key={i}
            className={cn(
              "rounded-full transition-[height] duration-75 ease-out",
              baseColorClass,
              variant === "neon" && isPlaying && "shadow-[0_0_6px_rgba(236,72,153,0.7)]",
              barClassName
            )}
            style={{
              height: `${h}px`,
              width: `${barWidth}px`,
              background: color
                ? `linear-gradient(to top, ${color}, ${RAINBOW[(i + 2) % RAINBOW.length]})`
                : undefined,
              boxShadow: color && isPlaying ? glowFor(color) : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

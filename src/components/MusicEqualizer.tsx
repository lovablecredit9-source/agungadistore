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
  variant?: "neon" | "white" | "primary";
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
}: MusicEqualizerProps) {
  const bands = useAudioBands(bars, isPlaying);

  const colorClass =
    variant === "white"
      ? "bg-white/90"
      : variant === "primary"
      ? "bg-primary"
      : "bg-gradient-to-t from-pink-400 via-fuchsia-400 to-indigo-400";

  return (
    <div
      className={cn("flex items-end justify-center gap-0.5", className)}
      style={{ height }}
      aria-hidden="true"
    >
      {bands.map((v, i) => {
        const h = Math.max(2, Math.round(v * height));
        return (
          <span
            key={i}
            className={cn(
              "w-0.5 rounded-full transition-[height] duration-75 ease-out",
              colorClass,
              variant === "neon" && isPlaying && "shadow-[0_0_6px_rgba(236,72,153,0.7)]",
              barClassName
            )}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

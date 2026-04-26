import { useRef } from "react";
import { useAudioBandsDOM } from "@/lib/audio-visualizer";
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

const RAINBOW = [
  "#ec4899",
  "#f59e0b",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#6366f1",
  "#a855f7",
];

function glowFor(color: string) {
  return `0 0 6px ${color}cc, 0 0 12px ${color}66`;
}

/**
 * Real-time audio-reactive equalizer bars.
 * Uses direct DOM mutation (no React re-renders during animation) for
 * smooth 20fps animation even when many instances are mounted.
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
  const containerRef = useRef<HTMLDivElement>(null);
  useAudioBandsDOM(containerRef, bars, isPlaying, height);

  const baseColorClass =
    variant === "white"
      ? "bg-white/90"
      : variant === "primary"
      ? "bg-primary"
      : variant === "neon"
      ? "bg-gradient-to-t from-pink-400 via-fuchsia-400 to-indigo-400"
      : "";

  const indices = Array.from({ length: bars }, (_, i) => i);

  return (
    <div
      ref={containerRef}
      className={cn("flex items-end justify-center gap-[2px]", className)}
      style={{ height }}
      aria-hidden="true"
    >
      {indices.map((i) => {
        const color = variant === "rainbow" ? RAINBOW[i % RAINBOW.length] : null;
        return (
          <span
            key={i}
            className={cn(
              "rounded-full",
              baseColorClass,
              variant === "neon" && isPlaying && "shadow-[0_0_6px_rgba(236,72,153,0.7)]",
              barClassName
            )}
            style={{
              height: `2px`,
              width: `${barWidth}px`,
              willChange: "height",
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

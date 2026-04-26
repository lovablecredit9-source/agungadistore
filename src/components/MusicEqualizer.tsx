import { useEffect, useRef, useState } from "react";
import { subscribeBands } from "@/lib/audio-visualizer";
import { cn } from "@/lib/utils";

interface MusicEqualizerProps {
  isPlaying: boolean;
  bars?: number;
  className?: string;
  barClassName?: string;
  /** max height in px */
  height?: number;
  /** color variant */
  variant?: "neon" | "white" | "primary" | "rainbow" | "pixel";
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

// Pixel palette — top (hot pink) → bottom (cyan), like classic LED EQ
// Index 0 = bottom cell, last = top cell
const PIXEL_PALETTE = [
  "#22d3ee", // cyan
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899", // pink (top)
];

function glowFor(color: string) {
  return `0 0 6px ${color}cc, 0 0 12px ${color}66`;
}

/**
 * Pixel/LED-style equalizer — each bar is a stack of small square cells
 * that light up from bottom based on the audio level. Inspired by classic
 * hardware equalizers.
 */
function PixelEqualizer({
  isPlaying,
  bars,
  height,
  cellSize,
  gap,
  className,
}: {
  isPlaying: boolean;
  bars: number;
  height: number;
  cellSize: number;
  gap: number;
  className?: string;
}) {
  const rows = Math.max(4, Math.floor(height / (cellSize + gap)));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) {
      const el = containerRef.current;
      if (!el) return;
      el.querySelectorAll<HTMLElement>("[data-cell]").forEach((cell) => {
        cell.style.opacity = "0.08";
      });
      return;
    }

    const apply = (band: Float32Array) => {
      const el = containerRef.current;
      if (!el) return;
      const cols = el.children;
      const n = Math.min(cols.length, band.length);
      for (let c = 0; c < n; c++) {
        const lit = Math.round(band[c] * rows);
        const cells = (cols[c] as HTMLElement).children;
        for (let r = 0; r < cells.length; r++) {
          // r = 0 is TOP cell visually (because column is column-reverse? No — we
          // render top-to-bottom, but treat lowest index as top). Easier: light
          // the BOTTOM `lit` cells. cells are top→bottom so bottom = last.
          const fromBottom = cells.length - 1 - r;
          (cells[r] as HTMLElement).style.opacity = fromBottom < lit ? "1" : "0.08";
        }
      }
    };

    const unsub = subscribeBands(bars, apply);
    return unsub;
  }, [isPlaying, bars, rows]);

  return (
    <div
      ref={containerRef}
      className={cn("flex items-end justify-center", className)}
      style={{ gap: `${gap}px`, height: rows * (cellSize + gap) }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, c) => (
        <div
          key={c}
          className="flex flex-col"
          style={{ gap: `${gap}px`, width: cellSize }}
        >
          {Array.from({ length: rows }).map((_, r) => {
            // r = 0 top, r = rows-1 bottom. Color by row index from bottom.
            const fromBottom = rows - 1 - r;
            const color =
              PIXEL_PALETTE[
                Math.min(
                  PIXEL_PALETTE.length - 1,
                  Math.floor((fromBottom / rows) * PIXEL_PALETTE.length)
                )
              ];
            return (
              <span
                key={r}
                data-cell
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: color,
                  opacity: 0.08,
                  borderRadius: 1,
                  boxShadow: `0 0 4px ${color}aa`,
                  transition: "opacity 80ms linear",
                  willChange: "opacity",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Real-time audio-reactive equalizer bars.
 * Uses direct DOM mutation (no React re-renders during animation).
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
  // Pixel variant uses its own renderer
  if (variant === "pixel") {
    // Choose cell size based on overall height for nice proportions
    const cellSize = height >= 48 ? 5 : height >= 24 ? 4 : 3;
    const gap = 1;
    return (
      <PixelEqualizer
        isPlaying={isPlaying}
        bars={bars}
        height={height}
        cellSize={cellSize}
        gap={gap}
        className={className}
      />
    );
  }

  // Smooth bar variants (existing) — single rAF DOM mutation
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) {
      const el = containerRef.current;
      if (el) {
        for (let i = 0; i < el.children.length; i++) {
          (el.children[i] as HTMLElement).style.height = `2px`;
        }
      }
      return;
    }
    const apply = (band: Float32Array) => {
      const el = containerRef.current;
      if (!el) return;
      const n = Math.min(el.children.length, band.length);
      for (let i = 0; i < n; i++) {
        const h = Math.max(2, Math.round(band[i] * height));
        (el.children[i] as HTMLElement).style.height = `${h}px`;
      }
    };
    const unsub = subscribeBands(bars, apply);
    return unsub;
  }, [isPlaying, bars, height]);

  const baseColorClass =
    variant === "white"
      ? "bg-white/90"
      : variant === "primary"
      ? "bg-primary"
      : variant === "neon"
      ? "bg-gradient-to-t from-pink-400 via-fuchsia-400 to-indigo-400"
      : "";

  return (
    <div
      ref={containerRef}
      className={cn("flex items-end justify-center gap-[2px]", className)}
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => {
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

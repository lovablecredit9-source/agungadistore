import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  emoji?: string;
  gradient?: string; // tailwind gradient classes e.g. "from-fuchsia-500 via-pink-500 to-orange-400"
  onClick?: () => void;
  ctaLabel?: string;
  height?: number; // px
  variant?: "shop" | "music";
}

/**
 * Playful 3D hero with parallax tilt, floating shapes, sparkles & glow.
 * Pure CSS + React, no heavy 3D libs.
 */
export default function PlayfulHero3D({
  title,
  subtitle,
  emoji = "✨",
  gradient = "from-fuchsia-500 via-pink-500 to-orange-400",
  onClick,
  ctaLabel,
  height = 180,
  variant = "shop",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  // Auto idle wobble for playfulness
  useEffect(() => {
    if (hover) return;
    let raf = 0;
    const start = performance.now();
    const loop = (t: number) => {
      const dt = (t - start) / 1000;
      setTilt({
        x: Math.sin(dt * 0.7) * 4,
        y: Math.cos(dt * 0.9) * 5,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hover]);

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 14, y: px * 18 });
  };

  // Floating shapes config per variant
  const shapes =
    variant === "music"
      ? [
          { emoji: "🎵", style: { top: "12%", left: "8%" }, dur: "5s", depth: 30 },
          { emoji: "🎧", style: { top: "60%", left: "14%" }, dur: "6s", depth: 50 },
          { emoji: "🎤", style: { top: "20%", right: "10%" }, dur: "4.5s", depth: 40 },
          { emoji: "💿", style: { bottom: "12%", right: "16%" }, dur: "7s", depth: 60 },
          { emoji: "✨", style: { top: "45%", right: "32%" }, dur: "3.8s", depth: 20 },
        ]
      : [
          { emoji: "🛍️", style: { top: "14%", left: "10%" }, dur: "5s", depth: 30 },
          { emoji: "💎", style: { top: "62%", left: "16%" }, dur: "6s", depth: 50 },
          { emoji: "🎁", style: { top: "18%", right: "12%" }, dur: "4.5s", depth: 40 },
          { emoji: "⚡", style: { bottom: "14%", right: "18%" }, dur: "7s", depth: 60 },
          { emoji: "✨", style: { top: "48%", right: "30%" }, dur: "3.8s", depth: 20 },
        ];

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => {
        setHover(false);
        setTilt({ x: 0, y: 0 });
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className="relative w-full select-none cursor-pointer overflow-hidden rounded-3xl"
      style={{
        height,
        perspective: 900,
      }}
    >
      {/* Outer glow */}
      <div
        className={`absolute -inset-2 rounded-[28px] blur-2xl opacity-70 bg-gradient-to-br ${gradient} animate-pulse`}
        style={{ animationDuration: "3.5s" }}
      />

      {/* 3D card */}
      <div
        className={`relative w-full h-full rounded-3xl bg-gradient-to-br ${gradient} shadow-2xl transition-transform duration-200 ease-out`}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) ${hover ? "scale(1.02)" : "scale(1)"}`,
          transformStyle: "preserve-3d",
          boxShadow:
            "0 20px 50px -10px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -8px 24px rgba(0,0,0,0.2)",
        }}
      >
        {/* Glossy sheen */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none opacity-60 mix-blend-overlay"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.25) 100%)",
          }}
        />

        {/* Grid dots backdrop */}
        <div
          className="absolute inset-0 rounded-3xl opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
            transform: "translateZ(10px)",
          }}
        />

        {/* Floating shapes */}
        {shapes.map((s, i) => (
          <div
            key={i}
            className="absolute text-2xl drop-shadow-lg pointer-events-none"
            style={{
              ...s.style,
              transform: `translateZ(${s.depth}px) translate(${tilt.y * 0.6}px, ${-tilt.x * 0.6}px)`,
              animation: `phero-float ${s.dur} ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))",
            }}
          >
            {s.emoji}
          </div>
        ))}

        {/* Sparkles */}
        {[...Array(6)].map((_, i) => (
          <span
            key={`sp-${i}`}
            className="absolute pointer-events-none text-white/90"
            style={{
              left: `${10 + i * 14}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `phero-sparkle 2.${i}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              transform: "translateZ(40px)",
            }}
          >
            <Sparkles className="w-3 h-3" />
          </span>
        ))}

        {/* Big floating emoji */}
        <div
          className="absolute right-4 bottom-3 text-[88px] leading-none pointer-events-none select-none"
          style={{
            transform: `translateZ(80px) translate(${tilt.y * 1.4}px, ${-tilt.x * 1.4}px) rotate(${tilt.y * 0.4}deg)`,
            filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.4))",
            animation: "phero-bob 3.2s ease-in-out infinite",
          }}
        >
          {emoji}
        </div>

        {/* Text content */}
        <div
          className="absolute inset-0 p-4 flex flex-col justify-center"
          style={{ transform: "translateZ(60px)" }}
        >
          <h2
            className="text-white font-extrabold text-[20px] leading-tight tracking-tight max-w-[70%]"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="text-white/95 text-[12px] mt-1 font-medium max-w-[70%]"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
            >
              {subtitle}
            </p>
          )}
          {ctaLabel && (
            <div className="mt-3">
              <span
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 text-foreground text-[11px] font-bold shadow-lg active:scale-95 transition-transform"
                style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.25)" }}
              >
                {ctaLabel} <span aria-hidden>→</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes phero-float {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -10px; }
        }
        @keyframes phero-bob {
          0%, 100% { translate: 0 0; rotate: 0deg; }
          50% { translate: 0 -8px; rotate: -4deg; }
        }
        @keyframes phero-sparkle {
          0%, 100% { opacity: 0; transform: translateZ(40px) scale(0.6); }
          50% { opacity: 1; transform: translateZ(40px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}

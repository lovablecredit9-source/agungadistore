import { memo, useId } from "react";
import type { StreakTier } from "./streakTiers";
import { getFlameShape } from "./flameShape";

/**
 * Procedural, layered live flame (outer → main → inner → core) drawn with SVG.
 * Each layer sways/stretches on its own CSS timing so the silhouette deforms
 * continuously instead of a single image pulsing. Shape grows with the tier.
 */
interface Props { tier: StreakTier; animated: boolean; gray?: boolean }

// Flame tongue path anchored at (cx, base). sharp=true gives crystalline tips.
function tongue(cx: number, base: number, w: number, h: number, lean: number, sharp = false) {
  const tipX = cx + lean, tipY = base - h;
  if (sharp) {
    return `M${cx - w},${base} L${cx - w * 0.75},${base - h * 0.45} L${cx - w * 0.25 + lean * 0.5},${base - h * 0.72} L${tipX},${tipY} L${cx + w * 0.3 + lean * 0.5},${base - h * 0.7} L${cx + w * 0.8},${base - h * 0.42} L${cx + w},${base} Q${cx},${base + w * 0.55} ${cx - w},${base} Z`;
  }
  return `M${cx - w},${base} C${cx - w * 1.05},${base - h * 0.42} ${cx - w * 0.35 + lean * 0.3},${base - h * 0.62} ${tipX},${tipY} C${cx + w * 0.35 + lean * 0.3},${base - h * 0.62} ${cx + w * 1.05},${base - h * 0.42} ${cx + w},${base} Q${cx},${base + w * 0.6} ${cx - w},${base} Z`;
}

function LiveFlameSvgBase({ tier, animated, gray }: Props) {
  const uid = useId().replace(/:/g, "");
  const s = getFlameShape(tier);
  const c = gray ? "#6b7280" : tier.color;
  const a = gray ? "#9ca3af" : tier.accent;
  const hot = gray ? "#d1d5db" : s.core;
  const B = 100; // flame base y in 0..120 viewBox
  const anim = (cls: string, dur: number, delay = 0) =>
    animated ? { className: `lf-layer ${cls}`, style: { animationDuration: `${dur * s.speed}s`, animationDelay: `${-delay}s` } } : { className: "lf-layer" };

  return (
    <svg viewBox="0 0 100 120" className="w-full h-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`o${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={c} stopOpacity="0.95" />
          <stop offset="0.7" stopColor={s.outerTop} stopOpacity="0.75" />
          <stop offset="1" stopColor={s.outerTop} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`m${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={a} />
          <stop offset="0.55" stopColor={c} />
          <stop offset="1" stopColor={c} stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`i${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={hot} />
          <stop offset="0.6" stopColor={a} />
          <stop offset="1" stopColor={a} stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id={`g${uid}`} cx="0.5" cy="0.8" r="0.6">
          <stop offset="0" stopColor={a} stopOpacity="0.45" />
          <stop offset="0.5" stopColor={c} stopOpacity="0.18" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
        <filter id={`b${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>

      {/* base glow */}
      <ellipse cx="50" cy={B - s.height * 0.38} rx={s.width * 1.25} ry={s.height * 0.5} fill={`url(#g${uid})`} {...anim("lf-glow", 3.1)} />

      {/* outer flame: soft blurred body + side tongues */}
      <g filter={`url(#b${uid})`} opacity="0.9">
        {s.outerLayers > 1 && <path d={tongue(50, B, s.width * 1.25, s.height * 1.05, -4, s.sharp)} fill={`url(#o${uid})`} opacity="0.55" {...anim("lf-sway-slow", 4.6, 1.3)} />}
        <path d={tongue(50, B, s.width, s.height, 2, s.sharp)} fill={`url(#o${uid})`} {...anim("lf-sway-slow", 3.6)} />
        {s.sideTongues.map((t, i) => (
          <path key={i} d={tongue(50 + t.dx, B - 2, t.w, t.h, t.lean, s.sharp)} fill={`url(#o${uid})`} {...anim(i % 2 ? "lf-lick-b" : "lf-lick-a", 1.7 + i * 0.37, i * 0.6)} />
        ))}
      </g>
      {s.sideTongues.map((t, i) => (
        <path key={`s${i}`} d={tongue(50 + t.dx * 0.8, B - 1, t.w * 0.7, t.h * 0.8, t.lean, s.sharp)} fill={`url(#m${uid})`} opacity="0.8" {...anim(i % 2 ? "lf-lick-a" : "lf-lick-b", 1.3 + i * 0.29, i * 0.45)} />
      ))}

      {/* crown energy (royal / supreme / immortal) */}
      {s.crown && (
        <g {...anim("lf-crown", 2.8)}>
          {[-14, 0, 14].map((dx, i) => (
            <path key={i} d={tongue(50 + dx, B - s.height * 0.5, 3, i === 1 ? 14 : 9, dx * 0.15, true)} fill={a} opacity="0.85" />
          ))}
        </g>
      )}

      {/* main flame */}
      <path d={tongue(50, B, s.width * 0.72, s.height * 0.82, -1.5, s.sharp)} fill={`url(#m${uid})`} {...anim("lf-sway-mid", 2.3, 0.4)} />
      {s.twin && <path d={tongue(50, B, s.width * 0.5, s.height * 0.7, 9, s.sharp)} fill={`url(#m${uid})`} opacity="0.7" {...anim("lf-sway-mid", 2.9, 1.1)} />}

      {/* inner flame */}
      <path d={tongue(50, B, s.width * 0.45, s.height * 0.58, 1, s.sharp)} fill={`url(#i${uid})`} {...anim("lf-sway-fast", 1.35, 0.2)} />

      {/* core: hot heart / crystal facets */}
      {s.facet ? (
        <g {...anim("lf-core", 1.9)}>
          <polygon points={`50,${B - s.height * 0.42} ${50 + s.width * 0.22},${B - s.height * 0.2} 50,${B - 3} ${50 - s.width * 0.22},${B - s.height * 0.2}`} fill={hot} opacity="0.92" />
          <polygon points={`50,${B - s.height * 0.42} ${50 + s.width * 0.22},${B - s.height * 0.2} 50,${B - s.height * 0.16}`} fill="#ffffff" opacity="0.65" />
          <line x1={50 - s.width * 0.22} y1={B - s.height * 0.2} x2={50 + s.width * 0.22} y2={B - s.height * 0.2} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.6" />
        </g>
      ) : (
        <ellipse cx="50" cy={B - s.height * 0.16} rx={s.width * 0.2} ry={s.height * 0.17} fill={hot} opacity="0.95" {...anim("lf-core", 1.6)} />
      )}
    </svg>
  );
}

export const LiveFlameSvg = memo(LiveFlameSvgBase);

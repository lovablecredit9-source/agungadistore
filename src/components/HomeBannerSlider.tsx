import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroBanner {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  cta: string;
  onClick: () => void;
}

interface Props {
  banners: HeroBanner[];
  autoPlayMs?: number;
}

export default function HomeBannerSlider({ banners, autoPlayMs = 4500 }: Props) {
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const next = useCallback(() => setCurrent(p => (p + 1) % banners.length), [banners.length]);
  const prev = useCallback(() => setCurrent(p => (p - 1 + banners.length) % banners.length), [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const iv = setInterval(next, autoPlayMs);
    return () => clearInterval(iv);
  }, [banners.length, next, autoPlayMs]);

  if (banners.length === 0) return null;

  const banner = banners[current];

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-xl group cursor-pointer"
      onClick={banner.onClick}
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
          diff > 0 ? next() : prev();
        }
        setTouchStart(null);
      }}
    >
      {/* Image */}
      <div className="relative h-44 sm:h-52">
        <img
          src={banner.image}
          alt={banner.title}
          className="w-full h-full object-cover transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
      </div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/70 mb-1">{banner.subtitle}</p>
        <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug drop-shadow-lg mb-2">{banner.title}</h3>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/30 transition-colors">
          {banner.cta} →
        </span>
      </div>

      {/* Nav arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="absolute top-3 right-3 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? "bg-white w-5" : "bg-white/40 w-1.5"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

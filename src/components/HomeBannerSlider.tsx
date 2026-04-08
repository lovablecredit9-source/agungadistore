import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Package, Megaphone } from "lucide-react";

interface BannerItem {
  id: string;
  title: string;
  image_url: string | null;
  price: number;
  type: "product" | "sponsor";
  subtitle?: string;
}

interface Props {
  items: BannerItem[];
  onItemClick: (item: BannerItem) => void;
  formatPrice: (n: number) => string;
  label: string;
  icon: "product" | "sponsor";
  autoPlayMs?: number;
}

export default function HomeBannerSlider({ items, onItemClick, formatPrice, label, icon, autoPlayMs = 4000 }: Props) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent(p => (p + 1) % items.length), [items.length]);
  const prev = useCallback(() => setCurrent(p => (p - 1 + items.length) % items.length), [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const iv = setInterval(next, autoPlayMs);
    return () => clearInterval(iv);
  }, [items.length, next, autoPlayMs]);

  if (items.length === 0) return null;

  const item = items[current];
  const Icon = icon === "product" ? Package : Megaphone;

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg group cursor-pointer" onClick={() => onItemClick(item)}>
      {/* Image */}
      <div className="relative h-40 bg-muted">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[9px] uppercase tracking-widest font-bold opacity-80 flex items-center gap-1">
            <Icon className="w-3 h-3" /> {label}
          </span>
        </div>
        <h4 className="text-sm font-extrabold leading-tight line-clamp-1 drop-shadow">{item.title}</h4>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-bold bg-primary/90 px-2 py-0.5 rounded-full">{formatPrice(item.price)}</span>
          {item.subtitle && <span className="text-[10px] opacity-80 truncate ml-2">{item.subtitle}</span>}
        </div>
      </div>

      {/* Nav arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Dots */}
      {items.length > 1 && (
        <div className="absolute top-2 right-2 flex gap-1">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? "bg-white w-4" : "bg-white/50"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

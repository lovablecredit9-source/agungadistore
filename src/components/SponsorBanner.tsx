import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Clock, User, Phone, ChevronLeft, ChevronRight, X, Search, Filter, ArrowUpDown } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SponsorImage {
  id: string;
  sponsor_id: string;
  image_url: string;
  image_order: number;
}

interface Sponsor {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  seller_name: string;
  seller_contact: string;
  duration_type: string;
  duration_value: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  custom_note: string | null;
  created_at: string;
  sponsor_number: number;
  wa_number: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  twitter: string;
  threads: string;
  category: string;
  stock: number;
}

type SortOrder = "newest" | "oldest";

function timeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "Tanpa batas";
  const now = new Date().getTime();
  const exp = new Date(expiresAt).getTime();
  const diff = exp - now;
  if (diff <= 0) return "Kedaluwarsa";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}h ${hours}j lagi`;
  if (hours > 0) return `${hours}j ${mins}m lagi`;
  return `${mins}m lagi`;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

const socialIcons: Record<string, { label: string; url: (v: string) => string; color: string }> = {
  wa_number: { label: "WhatsApp", url: v => `https://wa.me/${v.replace(/[^0-9+]/g, "")}`, color: "bg-green-600 hover:bg-green-700" },
  instagram: { label: "Instagram", url: v => `https://instagram.com/${v.replace("@", "")}`, color: "bg-pink-600 hover:bg-pink-700" },
  facebook: { label: "Facebook", url: v => v.startsWith("http") ? v : `https://facebook.com/${v}`, color: "bg-blue-600 hover:bg-blue-700" },
  tiktok: { label: "TikTok", url: v => `https://tiktok.com/@${v.replace("@", "")}`, color: "bg-gray-800 hover:bg-gray-900" },
  twitter: { label: "X", url: v => `https://x.com/${v.replace("@", "")}`, color: "bg-gray-700 hover:bg-gray-800" },
  threads: { label: "Threads", url: v => `https://threads.net/@${v.replace("@", "")}`, color: "bg-gray-600 hover:bg-gray-700" },
};

export default function SponsorBanner() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorImages, setSponsorImages] = useState<Record<string, SponsorImage[]>>({});
  const [current, setCurrent] = useState(0);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const categories = useMemo(() => {
    const cats = new Set(sponsors.map(s => s.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [sponsors]);
  useEffect(() => {
    fetchSponsors();
    const interval = setInterval(fetchSponsors, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % sponsors.length), 5000);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  async function fetchSponsors() {
    const { data } = await supabase
      .from("sponsors")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (data) {
      const now = new Date();
      const active = (data as unknown as Sponsor[]).filter(s => {
        if (!s.expires_at) return true;
        return new Date(s.expires_at) > now;
      });
      setSponsors(active);
      setCurrent(0);

      // Fetch images
      const { data: imgData } = await supabase.from("sponsor_images").select("*").order("image_order", { ascending: true });
      if (imgData) {
        const map: Record<string, SponsorImage[]> = {};
        (imgData as unknown as SponsorImage[]).forEach(img => {
          if (!map[img.sponsor_id]) map[img.sponsor_id] = [];
          map[img.sponsor_id].push(img);
        });
        setSponsorImages(map);
      }
    }
  }

  if (sponsors.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Megaphone className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-sm">Belum ada sponsor aktif</p>
    </div>
  );

  const q = search.toLowerCase().trim();
  const filtered = sponsors
    .filter(s => {
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      if (q) {
        return s.title.toLowerCase().includes(q) ||
          s.seller_name.toLowerCase().includes(q) ||
          String(s.sponsor_number).includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

  const sponsor = filtered.length > 0 ? filtered[current % filtered.length] : null;

  const currentImages = sponsor ? (sponsorImages[sponsor.id] || []) : [];
  const displayImage = currentImages.length > 0 ? currentImages[0]?.image_url : sponsor?.image_url;

  const socialLinks = sponsor ? Object.entries(socialIcons).filter(([key]) => {
    const val = (sponsor as any)[key];
    return val && val.trim();
  }) : [];

  return (
    <>
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Sponsor</span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setShowSearch(v => !v)} className="p-1 rounded-md hover:bg-muted transition-colors">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {filtered.length > 1 && (
              <span className="text-[10px] text-muted-foreground">{(current % filtered.length) + 1}/{filtered.length}</span>
            )}
          </div>
        </div>
        {/* Filter & Sort Bar - selalu tampil */}
        <div className="flex items-center gap-2 mb-2">
          <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setCurrent(0); }}>
            <SelectTrigger className="h-7 text-[11px] flex-1 min-w-0">
              <Filter className="w-3 h-3 mr-1 shrink-0" />
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setSortOrder(o => o === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1 h-7 px-2 rounded-md border bg-background text-[11px] hover:bg-muted transition-colors shrink-0"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === "newest" ? "Terbaru" : "Terlama"}
          </button>
        </div>
        {showSearch && (
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari sponsor (nama, penjual, ID)..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrent(0); }}
              className="w-full pl-7 pr-7 py-1.5 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button onClick={() => { setSearch(""); setCurrent(0); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
        {!sponsor && q && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Search className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">Tidak ditemukan sponsor "{search}"</p>
          </div>
        )}
        {sponsor && (
        <Card
          className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent cursor-pointer hover:shadow-lg transition-all"
          onClick={() => { setSelectedSponsor(sponsor); setImgIdx(0); }}
        >
          {displayImage && (
            <div className="relative">
              <img src={displayImage} alt={sponsor.title} className="w-full h-36 object-cover" />
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="text-[10px] font-mono font-bold shadow-md">#{sponsor.sponsor_number}</Badge>
              </div>
              <div className="absolute top-2 right-2">
                <Badge className="bg-primary/90 text-primary-foreground text-[10px] font-bold shadow-md">
                  <Clock className="w-3 h-3 mr-1" />{timeRemaining(sponsor.expires_at)}
                </Badge>
              </div>
              {sponsor.price > 0 && (
                <div className="absolute bottom-2 left-2">
                  <Badge className="bg-accent text-accent-foreground text-xs font-extrabold shadow-md">
                    {formatPrice(sponsor.price)}
                  </Badge>
                </div>
              )}
              {currentImages.length > 1 && (
                <div className="absolute bottom-2 right-2">
                  <Badge variant="secondary" className="text-[10px]">{currentImages.length} foto</Badge>
                </div>
              )}
            </div>
          )}
          <CardContent className="p-3 space-y-1.5">
            <h4 className="font-extrabold text-sm leading-tight">{sponsor.title}</h4>
            {sponsor.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{sponsor.description}</p>
            )}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{sponsor.seller_name}</span>
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{sponsor.seller_contact}</span>
            </div>
            {/* Social buttons preview */}
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {socialLinks.slice(0, 3).map(([key, config]) => (
                  <Badge key={key} variant="secondary" className="text-[9px] font-medium">{config.label}</Badge>
                ))}
                {socialLinks.length > 3 && <Badge variant="secondary" className="text-[9px]">+{socialLinks.length - 3}</Badge>}
              </div>
            )}
          </CardContent>
        </Card>
        )}
        {filtered.length > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {filtered.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === current % filtered.length ? "bg-primary w-4" : "bg-muted-foreground/30"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Sponsor Detail Modal */}
      {selectedSponsor && (
        <SponsorDetailModal
          sponsor={selectedSponsor}
          images={sponsorImages[selectedSponsor.id] || []}
          onClose={() => setSelectedSponsor(null)}
        />
      )}
    </>
  );
}

function SponsorDetailModal({ sponsor, images, onClose }: { sponsor: Sponsor; images: SponsorImage[]; onClose: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  const allImages = images.length > 0 ? images.map(i => i.image_url) : (sponsor.image_url ? [sponsor.image_url] : []);

  const socialLinks = Object.entries(socialIcons).filter(([key]) => {
    const val = (sponsor as any)[key];
    return val && val.trim();
  });

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Image gallery */}
        {allImages.length > 0 && (
          <div className="relative">
            <img src={allImages[imgIdx]} alt={sponsor.title} className="w-full h-48 object-cover" />
            {allImages.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setImgIdx(i => (i + 1) % allImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {allImages.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground">#{sponsor.sponsor_number}</p>
              <h3 className="font-extrabold text-lg">{sponsor.title}</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
          {sponsor.price > 0 && (
            <p className="text-xl font-extrabold text-primary">{formatPrice(sponsor.price)}</p>
          )}
          {sponsor.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sponsor.description}</p>
          )}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span className="font-medium">Penjual:</span>
              <span>{sponsor.seller_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <span className="font-medium">Kontak:</span>
              <a href={`https://wa.me/${sponsor.seller_contact.replace(/[^0-9+]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {sponsor.seller_contact}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-medium">Sisa waktu:</span>
              <span>{timeRemaining(sponsor.expires_at)}</span>
            </div>
          </div>

          {/* Social Media Buttons */}
          {socialLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sosial Media</p>
              <div className="grid grid-cols-2 gap-2">
                {socialLinks.map(([key, config]) => (
                  <a
                    key={key}
                    href={config.url((sponsor as any)[key])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${config.color} text-white text-xs font-bold rounded-lg py-2 px-3 text-center transition-colors`}
                  >
                    {config.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {sponsor.custom_note && (
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-muted-foreground">
              {sponsor.custom_note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Clock, User, Phone, ChevronLeft, ChevronRight, X } from "lucide-react";

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
}

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

export default function SponsorBanner() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

  useEffect(() => {
    fetchSponsors();
    const interval = setInterval(fetchSponsors, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-slide
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
    }
  }

  if (sponsors.length === 0) return null;

  const sponsor = sponsors[current];
  if (!sponsor) return null;

  return (
    <>
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">Sponsor</span>
          {sponsors.length > 1 && (
            <span className="text-[10px] text-muted-foreground ml-auto">{current + 1}/{sponsors.length}</span>
          )}
        </div>
        <Card
          className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setSelectedSponsor(sponsor)}
        >
          {sponsor.image_url && (
            <div className="relative">
              <img src={sponsor.image_url} alt={sponsor.title} className="w-full h-36 object-cover" />
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
            {!sponsor.image_url && sponsor.price > 0 && (
              <p className="text-sm font-extrabold text-primary">{formatPrice(sponsor.price)}</p>
            )}
          </CardContent>
        </Card>
        {sponsors.length > 1 && (
          <div className="flex justify-center gap-1 mt-2">
            {sponsors.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? "bg-primary w-4" : "bg-muted-foreground/30"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Sponsor Detail Modal */}
      {selectedSponsor && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedSponsor(null)}>
          <div className="bg-card w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {selectedSponsor.image_url && (
              <img src={selectedSponsor.image_url} alt={selectedSponsor.title} className="w-full h-48 object-cover" />
            )}
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-extrabold text-lg flex-1">{selectedSponsor.title}</h3>
                <button onClick={() => setSelectedSponsor(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {selectedSponsor.price > 0 && (
                <p className="text-xl font-extrabold text-primary">{formatPrice(selectedSponsor.price)}</p>
              )}
              {selectedSponsor.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedSponsor.description}</p>
              )}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium">Penjual:</span>
                  <span>{selectedSponsor.seller_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  <span className="font-medium">Kontak:</span>
                  <a href={`https://wa.me/${selectedSponsor.seller_contact.replace(/[^0-9+]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {selectedSponsor.seller_contact}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="font-medium">Sisa waktu:</span>
                  <span>{timeRemaining(selectedSponsor.expires_at)}</span>
                </div>
              </div>
              {selectedSponsor.custom_note && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-muted-foreground">
                  {selectedSponsor.custom_note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useRef, useEffect } from "react";
import { LANGUAGES, REGIONS, getLanguageByCode, type LanguageOption } from "@/lib/languages";
import { Search, X, Globe, ChevronDown } from "lucide-react";

interface LanguageSelectorProps {
  currentLang: string;
  onSelect: (code: string) => void;
}

export default function LanguageSelector({ currentLang, onSelect }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const current = getLanguageByCode(currentLang);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = LANGUAGES.filter(l => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q
      || l.name.toLowerCase().includes(q)
      || l.nameEn.toLowerCase().includes(q)
      || l.code.toLowerCase().includes(q)
      || l.region.toLowerCase().includes(q);
    const matchesRegion = !selectedRegion || l.region === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  const groupedByRegion: Record<string, LanguageOption[]> = {};
  filtered.forEach(l => {
    if (!groupedByRegion[l.region]) groupedByRegion[l.region] = [];
    groupedByRegion[l.region].push(l);
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-no-auto-translate
        className="w-9 h-9 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary-foreground/30 transition-colors gap-0.5"
        title={current?.name || "Language"}
      >
        <span className="text-sm leading-none">{current?.flag || "🌐"}</span>
      </button>

      {open && (
        <div data-no-auto-translate className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div ref={panelRef} className="bg-card w-full max-w-sm max-h-[85vh] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-base">Pilih Bahasa</h3>
              </div>
              <button onClick={() => { setOpen(false); setSearch(""); setSelectedRegion(null); }} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Cari bahasa..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/60 border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Region filter chips */}
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => setSelectedRegion(null)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${!selectedRegion ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                🌍 Semua
              </button>
              {REGIONS.map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRegion(selectedRegion === r ? null : r)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${selectedRegion === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {r === "Asia" && "🌏"} {r === "Europe" && "🌍"} {r === "Americas" && "🌎"} {r === "Africa" && "🌍"} {r === "Middle East" && "🕌"} {r === "Oceania" && "🏝️"} {r}
                </button>
              ))}
            </div>

            {/* Current selection */}
            {current && (
              <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2">
                <span className="text-lg">{current.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary truncate">{current.name}</p>
                  <p className="text-[10px] text-muted-foreground">{current.nameEn}</p>
                </div>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Aktif</span>
              </div>
            )}

            {/* Quick reset to Indonesian (default) */}
            {currentLang !== "id" && (
              <div className="mx-4 mb-2">
                <button
                  onClick={() => {
                    onSelect("id");
                    setOpen(false);
                    setSearch("");
                    setSelectedRegion(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-red-500/15 to-red-600/10 border border-red-500/30 hover:from-red-500/25 hover:to-red-600/20 transition-all"
                >
                  <span className="text-lg">🇮🇩</span>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold truncate">Bahasa Indonesia</p>
                    <p className="text-[10px] text-muted-foreground">Default • Indonesian</p>
                  </div>
                  <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">Reset</span>
                </button>
              </div>
            )}

            {/* Language list */}
            <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-3">
              {Object.entries(groupedByRegion).map(([region, langs]) => (
                <div key={region}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">{region} ({langs.length})</p>
                  <div className="grid grid-cols-1 gap-1">
                    {langs.map(l => (
                      <button
                        key={l.code}
                        onClick={() => {
                          onSelect(l.code);
                          setOpen(false);
                          setSearch("");
                          setSelectedRegion(null);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                          l.code === currentLang
                            ? "bg-primary/15 border border-primary/30"
                            : "hover:bg-muted/60 border border-transparent"
                        }`}
                      >
                        <span className="text-lg flex-shrink-0">{l.flag}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">{l.name}</p>
                          <p className="text-[10px] text-muted-foreground">{l.nameEn} • {l.code}</p>
                        </div>
                        {l.code === currentLang && (
                          <span className="text-primary text-xs">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Bahasa tidak ditemukan
                </div>
              )}
            </div>

            {/* Footer count */}
            <div className="border-t border-border px-4 py-2 text-center shrink-0">
              <p className="text-[10px] text-muted-foreground">{LANGUAGES.length} bahasa tersedia</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

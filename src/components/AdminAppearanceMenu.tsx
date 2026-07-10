import { useTheme, type Theme } from "@/lib/theme";
import { useLang } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/languages";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, Crown, Diamond, Gem, Sparkles, Palette, Smartphone, Globe, Check } from "lucide-react";

const THEMES: { key: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "light", label: "Terang", icon: Sun },
  { key: "dark", label: "Gelap", icon: Moon },
  { key: "gold", label: "Emas", icon: Crown },
  { key: "diamond", label: "Diamond", icon: Diamond },
  { key: "silver", label: "Silver", icon: Gem },
  { key: "platinum", label: "Platinum", icon: Sparkles },
  { key: "purple", label: "Ungu", icon: Palette },
  { key: "system", label: "Perangkat", icon: Smartphone },
];

const QUICK_LANGS = ["id", "en", "ar", "ja", "ko", "zh", "es", "fr"];

export default function AdminAppearanceMenu() {
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useLang();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors"
          title="Tampilan & Bahasa"
        >
          <Palette className="w-[18px] h-[18px] text-white" strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs"><Palette className="w-3.5 h-3.5" /> Tema Admin</DropdownMenuLabel>
        {THEMES.map((t) => (
          <DropdownMenuItem key={t.key} onClick={() => setTheme(t.key)} className="gap-2 cursor-pointer text-sm">
            <t.icon className="w-4 h-4" /> {t.label}
            {theme === t.key && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" /> Bahasa</DropdownMenuLabel>
        {QUICK_LANGS.map((code) => {
          const l = LANGUAGES.find((x) => x.code === code);
          if (!l) return null;
          return (
            <DropdownMenuItem key={code} onClick={() => setLang(code as any)} className="gap-2 cursor-pointer text-sm">
              <span className="text-base leading-none">{l.flag}</span> {l.name}
              {lang === code && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

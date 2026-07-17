import { useEffect, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

const STORAGE_KEY = "desktop_mode_enabled";
const VIEWPORT_MOBILE = "width=device-width, initial-scale=1, viewport-fit=cover";
const VIEWPORT_DESKTOP = "width=1280, initial-scale=1";

function apply(on: boolean) {
  const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (meta) meta.setAttribute("content", on ? VIEWPORT_DESKTOP : VIEWPORT_MOBILE);
  document.documentElement.classList.toggle("desktop-mode", on);
}

export default function DesktopModeToggle() {
  const [on, setOn] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    apply(on);
    try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch {}
  }, [on]);

  return (
    <button
      onClick={() => setOn(v => !v)}
      aria-label={on ? "Nonaktifkan mode desktop" : "Aktifkan mode desktop"}
      title={on ? "Mode Desktop: ON (klik untuk mode HP)" : "Mode Desktop: OFF (klik untuk lebar)"}
      className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-foreground"
    >
      {on ? (
        <Monitor className="w-[18px] h-[18px] text-primary" strokeWidth={1.9} />
      ) : (
        <Smartphone className="w-[18px] h-[18px]" strokeWidth={1.7} />
      )}
      {on && (
        <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[8px] font-bold px-1 rounded-full border border-background leading-tight">HD</span>
      )}
    </button>
  );
}

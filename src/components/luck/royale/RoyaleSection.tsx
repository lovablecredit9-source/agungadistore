import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  icon?: ReactNode;
  subtitle?: string;
  right?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Glass section shell. Collapsible sections only mount their content when open. */
export default function RoyaleSection({ title, icon, subtitle, right, collapsible, defaultOpen = true, id, className = "", children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = !collapsible || open;
  const header = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-amber-200">{icon}</span>}
        <div className="min-w-0 text-left">
          <h2 className="truncate text-[12px] font-black tracking-[0.18em] text-white">{title}</h2>
          {subtitle && <p className="truncate text-[10px] text-white/50">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        {collapsible && <ChevronDown className={`h-4 w-4 text-white/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />}
      </div>
    </>
  );
  return (
    <section id={id} className={`royale-glass rounded-2xl p-3 sm:p-4 scroll-mt-20 ${className}`}>
      {collapsible ? (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full min-h-[40px] items-center justify-between gap-2">
          {header}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">{header}</div>
      )}
      {isOpen && <div className="mt-3 animate-fade-in">{children}</div>}
    </section>
  );
}

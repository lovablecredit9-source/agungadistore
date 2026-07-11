import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Status = {
  status: "green" | "yellow" | "red";
  violations: number;
  ban_count?: number;
  ban_reason: string | null;
  previous_names: string[];
};

const CONFIG = {
  green: {
    Icon: ShieldCheck,
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    label: "Akun bersih",
    desc: "Belum pernah melanggar aturan.",
  },
  yellow: {
    Icon: ShieldAlert,
    color: "text-amber-400",
    dot: "bg-amber-400",
    label: "Pernah melanggar",
    desc: "Akun ini pernah melanggar aturan.",
  },
  red: {
    Icon: ShieldX,
    color: "text-red-400",
    dot: "bg-red-400",
    label: "Diblokir",
    desc: "Akun ini sedang diblokir.",
  },
} as const;

const REASON_LABEL: Record<string, string> = {
  violation: "Melanggar aturan",
  fraud: "Penipuan",
  suspicious: "Aktivitas mencurigakan",
};

// Simple in-memory cache to avoid refetching per render
const cache = new Map<string, Status>();

export default function AccountStatusBadge({ visitorId, size = 12 }: { visitorId?: string | null; size?: number }) {
  const [data, setData] = useState<Status | null>(visitorId ? cache.get(visitorId) ?? null : null);

  useEffect(() => {
    if (!visitorId) return;
    if (cache.has(visitorId)) { setData(cache.get(visitorId)!); return; }
    let active = true;
    supabase.rpc("get_account_status", { p_visitor_id: visitorId }).then(({ data: d }) => {
      if (!active || !d) return;
      const s = d as unknown as Status;
      cache.set(visitorId, s);
      setData(s);
    });
    return () => { active = false; };
  }, [visitorId]);

  if (!data) return null;
  const cfg = CONFIG[data.status];
  const { Icon } = cfg;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex shrink-0" aria-label={cfg.label}>
          <Icon className={cfg.color} style={{ width: size, height: size }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 text-xs" side="top" align="start">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`font-bold ${cfg.color}`}>{cfg.label}</span>
        </div>
        <p className="text-muted-foreground mb-2">{cfg.desc}</p>
        {(data.ban_count || 0) > 0 && (
          <p className="text-foreground/80 mb-1">Riwayat banned: <b>{data.ban_count}×</b></p>
        )}
        {data.violations > 0 && (
          <p className="text-foreground/80 mb-1">Jumlah pelanggaran: <b>{data.violations}</b></p>
        )}
        {data.ban_reason && (
          <p className="text-foreground/80 mb-1">
            Alasan: <b>{REASON_LABEL[data.ban_reason] ?? data.ban_reason}</b>
          </p>
        )}
        {data.previous_names?.length > 0 && (
          <div className="mt-1.5 border-t border-border pt-1.5">
            <p className="text-muted-foreground mb-0.5">Nama sebelumnya:</p>
            <div className="flex flex-wrap gap-1">
              {data.previous_names.map((n, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-muted/50 text-foreground/80">{n}</span>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

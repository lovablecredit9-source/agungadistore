import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_SELLER_OPEN_ISO = "2026-09-14T17:00:00Z";

export interface SellerSchedule {
  openIso: string;
  mode: "auto" | "open" | "closed";
  isOpen: boolean;
  label: string;      // tanggal & jam WIB
  countdown: string;  // "12 hari 3 jam 20 menit"
  badge: string;      // teks badge pengganti COMING SOON
}

function fmtWib(iso: string) {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }) + " WIB";
  } catch { return "-"; }
}

export function useSellerSchedule(): SellerSchedule {
  const [openIso, setOpenIso] = useState(DEFAULT_SELLER_OPEN_ISO);
  const [mode, setMode] = useState<"auto" | "open" | "closed">("auto");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["seller_open_date", "seller_registration_mode"]);
      if (!alive || !data) return;
      for (const r of data as any[]) {
        if (r.setting_key === "seller_open_date" && r.setting_value) setOpenIso(r.setting_value);
        if (r.setting_key === "seller_registration_mode" && r.setting_value) setMode(r.setting_value);
      }
    })();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const target = new Date(openIso).getTime();
  const diff = target - now;
  const autoOpen = diff <= 0;
  const isOpen = mode === "open" ? true : mode === "closed" ? false : autoOpen;

  let countdown = "";
  if (diff > 0) {
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    countdown = d > 0 ? `${d} hari ${h} jam ${m} menit` : `${h} jam ${m} menit ${s} detik`;
  }

  const label = fmtWib(openIso);
  const badge = mode === "closed"
    ? "DITUTUP SEMENTARA"
    : isOpen
      ? "DIBUKA SEKARANG"
      : `BUKA ${label}`;

  return { openIso, mode, isOpen, label, countdown, badge };
}

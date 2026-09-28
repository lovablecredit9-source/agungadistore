import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Listens to data-free "changed" pings sent by the database for marketplace tables.
 * Callers refetch through the authorized backend, so no private data travels over the channel.
 */
export function useMarketSignal(topics: (string | null | undefined)[], onChange: () => void, delay = 250) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = topics.filter(Boolean).join("|");
  useEffect(() => {
    if (!key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => { clearTimeout(timer); timer = setTimeout(() => cb.current(), delay); };
    const channels = key.split("|").map((t) =>
      supabase.channel(`market:${t}`).on("broadcast", { event: "changed" }, fire).subscribe(),
    );
    const onFocus = () => { if (document.visibilityState === "visible") fire(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onFocus);
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [key, delay]);
}

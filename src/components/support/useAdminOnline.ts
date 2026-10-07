import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC presence belum ada di tipe hasil generate
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export interface Presence { online: boolean | null; lastSeen: string | null }

/** Poll ringan (30 dtk, hanya saat tab terlihat) + segera saat tab kembali aktif. */
function usePolledPresence(load: () => Promise<Presence | null>, enabled = true): Presence {
  const [p, setP] = useState<Presence>({ online: null, lastSeen: null });
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const run = async () => { const r = await loadRef.current(); if (alive && r) setP(r); };
    void run();
    const t = setInterval(() => { if (!document.hidden) void run(); }, 30_000);
    const onVis = () => { if (!document.hidden) void run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [enabled]);
  return p;
}

/** Status admin dari heartbeat server (`admin_presence`). Online dihitung oleh server, bukan jam perangkat. */
export function useAdminPresence(): Presence {
  return usePolledPresence(async () => {
    const { data, error } = await rpc("support_admin_presence");
    if (error || !data) return null;
    return { online: !!data.online, lastSeen: data.last_seen_at || null };
  });
}

export function useAdminOnline() {
  return useAdminPresence().online;
}

/** Admin: status pengguna pemilik tiket (`ticket_presence`, hanya bisa dibaca admin). */
export function useTicketUserPresence(ticketId: string | null | undefined): Presence {
  const id = ticketId || "";
  const p = usePolledPresence(async () => {
    if (!id) return null;
    const { data, error } = await rpc("admin_ticket_user_presence", { p_ticket_id: id });
    if (error || !data || data.error) return null;
    return { online: !!data.online, lastSeen: data.last_seen_at || null };
  }, !!id);
  return p;
}

export const TICKET_ACTIVITY_EVENT = "ticket-user-activity";

/**
 * Pengguna: catat "terakhir dilihat" di server selama halaman tiket terbuka.
 * Beat saat dibuka, tiap 30 dtk (tab terlihat), saat tab aktif lagi, setelah kirim pesan, dan saat keluar.
 */
export function useTicketUserHeartbeat(ticketId: string | null | undefined, ownerId: string | null | undefined) {
  const last = useRef(0);
  const beat = useCallback((force = false) => {
    if (!ticketId || !ownerId) return;
    const now = Date.now();
    if (!force && now - last.current < 10_000) return; // cegah request berlebihan
    last.current = now;
    void rpc("ticket_user_heartbeat", { p_ticket_id: ticketId, p_owner_id: ownerId });
  }, [ticketId, ownerId]);

  useEffect(() => {
    if (!ticketId || !ownerId) return;
    beat(true);
    const t = setInterval(() => { if (!document.hidden) beat(); }, 30_000);
    const onVis = () => { if (document.hidden) beat(true); else beat(); };
    const onActivity = () => beat(true);
    const onHide = () => beat(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(TICKET_ACTIVITY_EVENT, onActivity);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(TICKET_ACTIVITY_EVENT, onActivity);
      window.removeEventListener("pagehide", onHide);
      beat(true); // last_seen terakhir saat meninggalkan halaman
    };
  }, [ticketId, ownerId, beat]);
}

/** Admin: heartbeat global selama dashboard admin terbuka (dipasang sekali di AdminShell). */
export function useAdminHeartbeat() {
  useEffect(() => {
    const beat = () => { void rpc("admin_heartbeat"); };
    const visibleBeat = () => { if (!document.hidden) beat(); };
    visibleBeat();
    const t = setInterval(visibleBeat, 60_000);
    document.addEventListener("visibilitychange", visibleBeat);
    window.addEventListener("pagehide", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", visibleBeat); window.removeEventListener("pagehide", beat); };
  }, []);
}

/**
 * Format Indonesia: "beberapa detik lalu", "5 menit lalu", "hari ini, 17.34", "kemarin, 21.15", "17 Apr 2026, 17.34".
 * Mengembalikan null bila belum ada timestamp sama sekali.
 */
export function formatLastSeen(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const min = Math.floor(Math.max(0, now.getTime() - d.getTime()) / 60_000);
  if (min < 1) return "beberapa detik lalu";
  if (min < 60) return `${min} menit lalu`;
  const hm = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".");
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86_400_000);
  if (days === 0) return `hari ini, ${hm}`;
  if (days === 1) return `kemarin, ${hm}`;
  return `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}, ${hm}`;
}

/** Teks presence lengkap. who = "Admin" / "User". */
export function presenceLabel(p: Presence, who: string): { dot: string; text: string } {
  if (p.online === null) return { dot: "⚪", text: `Memuat status ${who.toLowerCase()}…` };
  if (p.online) return { dot: "🟢", text: `${who} aktif sekarang` };
  const ls = formatLastSeen(p.lastSeen);
  return { dot: "⚫", text: ls ? `${who} terakhir dilihat ${ls}` : `${who} belum pernah aktif` };
}

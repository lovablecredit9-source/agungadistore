import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ResponseRate {
  rate: number;
  total: number;
  replied: number;
  loading: boolean;
}

/**
 * Hook untuk mengambil persentase respon admin secara real-time.
 * Menghitung rasio chat (produk + tiket) yang sudah dibalas admin.
 * Re-fetch otomatis ketika ada pesan baru di product_chat_messages atau ticket_messages.
 */
export const useResponseRate = (): ResponseRate => {
  const [data, setData] = useState<ResponseRate>({ rate: 100, total: 0, replied: 0, loading: true });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: rows, error } = await supabase.rpc("get_admin_response_rate" as any);
      if (!mounted) return;
      if (error || !rows || !Array.isArray(rows) || rows.length === 0) {
        setData((d) => ({ ...d, loading: false }));
        return;
      }
      const r: any = rows[0];
      setData({
        rate: Number(r.rate ?? 100),
        total: Number(r.total_chats ?? 0),
        replied: Number(r.replied_chats ?? 0),
        loading: false,
      });
    };

    load();

    let timer: any = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 1500);
    };

    const ch = supabase
      .channel("response-rate-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_chat_messages" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_chats" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, debounced)
      .subscribe();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, []);

  return data;
};

export const getResponseColor = (rate: number) => {
  if (rate >= 90) return "from-emerald-500 to-green-500";
  if (rate >= 70) return "from-lime-500 to-emerald-500";
  if (rate >= 50) return "from-amber-500 to-orange-500";
  if (rate >= 30) return "from-orange-500 to-red-500";
  return "from-red-500 to-rose-600";
};

export const getResponseTextColor = (rate: number) => {
  if (rate >= 90) return "text-emerald-500";
  if (rate >= 70) return "text-lime-500";
  if (rate >= 50) return "text-amber-500";
  if (rate >= 30) return "text-orange-500";
  return "text-red-500";
};

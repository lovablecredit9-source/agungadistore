import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const FILTERS: [string, string, (n: any) => boolean][] = [
  ["semua", "Semua", () => true],
  ["belum", "Belum dibaca", (n) => !n.is_read],
  ["pesanan", "Pesanan", (n) => /pesanan|order|bayar|batal/i.test(n.title + n.type)],
  ["stok", "Stok", (n) => n.type === "seller_stock"],
  ["chat", "Chat", (n) => n.type === "seller_chat"],
  ["ulasan", "Ulasan", (n) => n.type === "seller_review"],
  ["dana", "Dana", (n) => /dana|saldo|penarikan|withdraw/i.test(n.title + n.type)],
];

export default function SellerNotifications({ visitorId }: { visitorId: string }) {
  const [list, setList] = useState<any[] | null>(null);
  const [f, setF] = useState("semua");
  const load = async () => {
    const { data } = await supabase.rpc("get_my_notifications" as any, { p_visitor_id: visitorId, p_limit: 200 });
    setList((data as any[]) || []);
  };
  useEffect(() => { load(); }, [visitorId]);
  const mark = async (ids: string[] | null) => {
    await supabase.rpc("seller_mark_notifications" as any, { p_visitor_id: visitorId, p_ids: ids });
    setList((l) => (l || []).map((n) => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n)));
  };
  const fn = FILTERS.find((x) => x[0] === f)![2];
  const shown = (list || []).filter(fn);
  const unread = (list || []).filter((n) => !n.is_read).length;

  return <div className="space-y-2">
    <div className="flex gap-1 overflow-x-auto pb-1">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} className={"shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold " + (f === k ? "border-primary bg-primary/10 text-primary" : "border-border")}>{l}</button>)}</div>
    <Button size="sm" variant="outline" className="w-full h-8 text-[11px]" disabled={!unread} onClick={() => mark(null)}>Tandai semua dibaca ({unread})</Button>
    {list === null ? <Skeleton className="h-40" /> : !shown.length ? <p className="text-center py-8 text-xs text-muted-foreground">Tidak ada notifikasi.</p> :
      shown.map((n) => <Card key={n.id} className={n.is_read ? "opacity-70" : "border-primary/40"} onClick={() => !n.is_read && mark([n.id])}>
        <CardContent className="p-2.5">
          <div className="flex justify-between gap-2"><p className="text-xs font-bold">{n.title}</p>{!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}</div>
          <p className="text-[11px] text-muted-foreground whitespace-pre-line">{n.message}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString("id-ID")}</p>
        </CardContent></Card>)}
  </div>;
}

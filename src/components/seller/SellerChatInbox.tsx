import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle } from "lucide-react";
import SellerOrderChat from "./SellerOrderChat";

/** Riwayat percakapan tentang produk, terpisah dari daftar pesanan. */
export default function SellerChatInbox({ visitorId }: { visitorId: string }) {
  const [threads, setThreads] = useState<any[]>([]);
  const [store, setStore] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: buyer }, { data: seller }, { data: myStore }] = await Promise.all([
        supabase.from("seller_chat_threads").select("*").eq("buyer_visitor_id", visitorId),
        supabase.from("seller_chat_threads").select("*").eq("seller_visitor_id", visitorId),
        supabase.from("seller_stores").select("id,store_name,visitor_id").eq("visitor_id", visitorId).maybeSingle(),
      ]);
      if (!active) return;
      setStore(myStore);
      const unique = Array.from(new Map([...(buyer || []), ...(seller || [])].map((t) => [t.id, t])).values());
      setThreads(unique.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      setLoading(false);
    }
    load();
    const channel = supabase.channel(`seller-inbox-${visitorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seller_chat_threads" }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [visitorId]);

  if (loading) return <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;

  return <section className="space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4" /> Chat Toko</h3>
    {threads.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Belum ada percakapan produk.</p>}
    {threads.map((thread) => {
      const isSeller = thread.seller_visitor_id === visitorId && thread.store_id === store?.id;
      const role = isSeller ? "seller" : "buyer";
      const partnerVisitorId = isSeller ? thread.buyer_visitor_id : thread.seller_visitor_id;
      return <div key={thread.id} className="border-b border-border pb-3">
        <Button variant="ghost" className="h-auto w-full justify-between gap-2 px-1 py-2 text-left" onClick={() => setSelected(selected === thread.id ? null : thread.id)}>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold">{isSeller ? thread.buyer_name || "Pembeli" : "Penjual"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{thread.product_title}</span>
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(thread.updated_at).toLocaleDateString("id-ID")}</span>
        </Button>
        {selected === thread.id && <SellerOrderChat threadId={thread.id} visitorId={visitorId} role={role} partnerVisitorId={partnerVisitorId} partnerName={isSeller ? thread.buyer_name || "Pembeli" : "Penjual"} />}
      </div>;
    })}
  </section>;
}
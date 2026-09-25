import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { data, error } = await supabase.rpc("seller_escrow_action", {
      p_action: body.action,
      p_order_id: body.orderId,
      p_visitor_id: body.visitorId,
      p_delivery_data: body.deliveryData || null,
    });
    if (error) throw error;
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Escrow gagal" }), { status: 400, headers: { "content-type": "application/json" } });
  }
});
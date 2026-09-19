import { supabase } from "@/integrations/supabase/client";

/**
 * Tandai pesanan selesai + catat pendapatan penjual (sekali saja).
 * Fee toko dipotong otomatis, sisanya masuk ke saldo penjual.
 */
export async function settleOrder(order: any) {
  const { data: exist } = await supabase
    .from("seller_earnings" as any).select("id").eq("order_id", order.id).maybeSingle();

  await supabase.from("seller_orders" as any).update({
    status: "selesai",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any).eq("id", order.id);

  if (exist) return;

  const { data: store } = await supabase
    .from("seller_stores" as any).select("*").eq("id", order.store_id).maybeSingle();
  if (!store) return;

  const gross = Number(order.total) || 0;
  const fee = Math.round((gross * (Number((store as any).fee_percent) || 0)) / 100);
  const net = Math.max(0, gross - fee);

  await supabase.from("seller_earnings" as any).insert({
    store_id: order.store_id, order_id: order.id, gross, fee, net,
    note: `Pesanan #${order.order_number} · ${order.product_title}`,
  } as any);

  await supabase.from("seller_stores" as any).update({
    balance: (Number((store as any).balance) || 0) + net,
    total_sales: (Number((store as any).total_sales) || 0) + 1,
    updated_at: new Date().toISOString(),
  } as any).eq("id", order.store_id);
}

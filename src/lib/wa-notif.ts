import { supabase } from "@/integrations/supabase/client";

export type WaEventType = "purchase" | "product_edit" | "login" | "deposit";

export async function sendAdminWaNotif(
  event_type: WaEventType,
  vars: Record<string, string | number>,
  notify_visitor_id?: string | null,
): Promise<void> {
  try {
    await supabase.functions.invoke("send-wa-notification", {
      body: { event_type, vars, notify_visitor_id: notify_visitor_id || null },
    });
  } catch (e) {
    console.warn("[wa-notif] failed:", e);
  }
}

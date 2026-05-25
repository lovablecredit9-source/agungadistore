import { supabase } from "@/integrations/supabase/client";

export type WaEventType = "purchase" | "product_edit" | "login" | "deposit";

export async function sendAdminWaNotif(
  event_type: WaEventType,
  vars: Record<string, string | number>
): Promise<void> {
  try {
    await supabase.functions.invoke("send-wa-notification", {
      body: { event_type, vars },
    });
  } catch (e) {
    // silent — notification is non-critical
    console.warn("[wa-notif] failed:", e);
  }
}

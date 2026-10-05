import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, RefreshCw } from "lucide-react";

interface Report {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
  text: string;
  hidden: boolean;
}
interface Abuse {
  support_top: { account: string; count: number }[];
  mission_top: { account: string; count: number }[];
}

async function adminCall(action: string, extra: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confess-extra`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      "x-admin-token": data.session?.access_token || "",
    },
    body: JSON.stringify({ action, ...extra }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || "Gagal");
  return j;
}

const TYPE_LABEL: Record<string, string> = { wall: "Confess", reply: "Balasan", poll: "Polling" };

export default function AdminConfessModeration() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [abuse, setAbuse] = useState<Abuse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await adminCall("admin_reports");
      setReports(j.reports);
      setAbuse(j.abuse);
    } catch (e) {
      toast({
        title: "Gagal memuat moderasi",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (r: Report, kind: "hide" | "dismiss") => {
    setBusy(r.id);
    try {
      if (kind === "hide")
        await adminCall("admin_hide", {
          target_type: r.target_type,
          target_id: r.target_id,
          hidden: true,
        });
      else await adminCall("admin_resolve", { report_id: r.id });
      await load();
    } catch (e) {
      toast({
        title: "Gagal",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Moderasi Wall, Balasan & Polling
          </h3>
          <Button size="sm" variant="ghost" onClick={load} aria-label="Muat ulang">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        {loading ? (
          <div className="py-4 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {reports.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Tidak ada laporan terbuka.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="rounded-xl border p-2 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="font-bold">
                      {TYPE_LABEL[r.target_type] || r.target_type} · {r.reason}
                    </span>
                    <span>
                      {new Date(r.created_at).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-[12px] whitespace-pre-wrap">{r.text}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-[11px]"
                      disabled={busy === r.id || r.hidden}
                      onClick={() => act(r, "hide")}
                    >
                      {r.hidden ? "Sudah disembunyikan" : "Sembunyikan"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={busy === r.id}
                      onClick={() => act(r, "dismiss")}
                    >
                      Abaikan
                    </Button>
                  </div>
                </div>
              ))
            )}
            {abuse && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl border p-2">
                  <div className="font-bold mb-1">💎 Support terbanyak (7 hari)</div>
                  {abuse.support_top.length ? (
                    abuse.support_top.map((a) => (
                      <div key={a.account} className="flex justify-between">
                        <span>{a.account}</span>
                        <b>{a.count}</b>
                      </div>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="rounded-xl border p-2">
                  <div className="font-bold mb-1">🎯 Klaim misi terbanyak (7 hari)</div>
                  {abuse.mission_top.length ? (
                    abuse.mission_top.map((a) => (
                      <div key={a.account} className="flex justify-between">
                        <span>{a.account}</span>
                        <b>{a.count}</b>
                      </div>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

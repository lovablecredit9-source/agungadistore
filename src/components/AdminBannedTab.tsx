import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Ban, ShieldOff, Loader2 } from "lucide-react";

interface BanRow {
  id: string;
  visitor_id: string;
  reason: string;
  is_permanent: boolean;
  banned_until: string | null;
  created_at: string;
}

export default function AdminBannedTab() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [target, setTarget] = useState<{ visitor_id: string; label: string } | null>(null);
  const [reason, setReason] = useState("Pelanggaran aturan komunitas");
  const [days, setDays] = useState(7);
  const [permanent, setPermanent] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadBans = async () => {
    const { data } = await supabase.functions.invoke("admin-ban-account", { body: { action: "list" } });
    setBans(data?.bans ?? []);
  };

  useEffect(() => { loadBans(); }, []);

  const search = async () => {
    if (!query.trim()) return;
    const { data } = await supabase.functions.invoke("admin-ban-account", { body: { action: "search_user", query } });
    setUsers(data?.users ?? []);
  };

  const findVisitorIdForUser = async (user_balance_id: string): Promise<string | null> => {
    const { data } = await supabase.from("balance_login_history").select("visitor_id").eq("user_balance_id", user_balance_id).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
    return data?.visitor_id ?? null;
  };

  const doBan = async () => {
    if (!target) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-ban-account", {
      body: { action: "ban", visitor_id: target.visitor_id, reason, is_permanent: permanent, days },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Gagal", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Banned", description: `${target.label} berhasil dibanned` });
    setTarget(null);
    loadBans();
  };

  const doUnban = async (ban_id: string, visitor_id: string) => {
    const { error } = await supabase.functions.invoke("admin-ban-account", {
      body: { action: "unban", ban_id, visitor_id, unban_reason: "Diunban admin" },
    });
    if (error) return toast({ title: "Gagal", variant: "destructive" });
    toast({ title: "✅ Unbanned" });
    loadBans();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>Cari User (username / phone / email)</Label>
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Misal: agungadi" onKeyDown={(e) => e.key === "Enter" && search()} />
            <Button onClick={search}><Search className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <div>
                  <p className="font-semibold">{u.username}</p>
                  <p className="text-xs text-muted-foreground">{u.phone} · {u.email}</p>
                </div>
                <Button size="sm" variant="destructive" onClick={async () => {
                  const vid = await findVisitorIdForUser(u.id);
                  if (!vid) return toast({ title: "User belum login di perangkat manapun", variant: "destructive" });
                  setTarget({ visitor_id: vid, label: u.username });
                }}>
                  <Ban className="h-3 w-3 mr-1" /> Ban
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {target && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 space-y-3">
            <p className="font-bold">Ban: {target.label}</p>
            <Label>Alasan</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} /> Permanen
              </label>
              {!permanent && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Durasi (hari):</Label>
                  <Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={doBan} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4 mr-1" />} Konfirmasi Ban
              </Button>
              <Button variant="outline" onClick={() => setTarget(null)}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="font-bold mb-2">Daftar Banned Aktif ({bans.length})</h3>
        <div className="space-y-2">
          {bans.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-mono text-xs truncate max-w-[200px]">{b.visitor_id}</p>
                  <p className="text-xs">{b.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.is_permanent ? "🔒 Permanen" : `Sampai: ${b.banned_until ? new Date(b.banned_until).toLocaleString("id-ID") : "-"}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => doUnban(b.id, b.visitor_id)}>
                  <ShieldOff className="h-3 w-3 mr-1" /> Unban
                </Button>
              </CardContent>
            </Card>
          ))}
          {bans.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Tidak ada user banned</p>}
        </div>
      </div>
    </div>
  );
}

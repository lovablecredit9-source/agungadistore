import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, Loader2, Trash2, Copy } from "lucide-react";

export default function AdminPqVoucherTab() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [durationDays, setDurationDays] = useState(3);
  const [maxUses, setMaxUses] = useState(10);
  const [maxPerAccount, setMaxPerAccount] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await supabase.functions.invoke("premium-quest-voucher", { body: { action: "admin_list" } });
    setList((data as any)?.vouchers || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("premium-quest-voucher", {
        body: {
          action: "admin_create",
          code: code || null, duration_days: durationDays, max_uses: maxUses, max_per_account: maxPerAccount,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null, note,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "✅ Voucher dibuat", description: `Kode: ${(data as any).voucher.code}` });
      setCode(""); setNote("");
      load();
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const toggle = async (id: string, is_active: boolean) => {
    await supabase.functions.invoke("premium-quest-voucher", { body: { action: "admin_toggle", id, is_active } });
    load();
  };
  const del = async (id: string) => {
    if (!confirm("Hapus voucher?")) return;
    await supabase.functions.invoke("premium-quest-voucher", { body: { action: "admin_delete", id } });
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Buat Voucher Premium Quest</h3>
          </div>
          <div>
            <Label className="text-xs">Kode (kosongkan untuk random)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PQ-XXXXXX" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Durasi (hari)</Label>
              <Input type="number" value={durationDays} onChange={(e) => setDurationDays(+e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Kuota total</Label>
              <Input type="number" value={maxUses} onChange={(e) => setMaxUses(+e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Per akun</Label>
              <Input type="number" value={maxPerAccount} onChange={(e) => setMaxPerAccount(+e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Kadaluarsa voucher (opsional)</Label>
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Catatan</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Event Ramadan" />
          </div>
          <Button onClick={create} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Buat</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h4 className="font-bold text-sm">Daftar Voucher ({list.length})</h4>
        {list.map(v => (
          <Card key={v.id} className={!v.is_active ? "opacity-50" : ""}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <button onClick={() => { navigator.clipboard.writeText(v.code); toast({ title: "Kode disalin" }); }} className="font-mono font-bold text-primary text-sm flex items-center gap-1">
                  {v.code} <Copy className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-1">
                  <Switch checked={v.is_active} onCheckedChange={(c) => toggle(v.id, c)} />
                  <Button size="icon" variant="ghost" onClick={() => del(v.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground grid grid-cols-3 gap-1">
                <div>⏱ {v.duration_days} hari</div>
                <div>👥 {v.used_count}/{v.max_uses}</div>
                <div>🔑 max {v.max_per_account}/akun</div>
              </div>
              {v.expires_at && <div className="text-[10px] text-orange-600">Kadaluarsa: {new Date(v.expires_at).toLocaleString("id-ID")}</div>}
              {v.note && <div className="text-[10px] italic">{v.note}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

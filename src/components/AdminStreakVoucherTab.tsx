import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Ticket, Trash2, Copy, Plus, Pencil, RotateCcw, Eraser } from "lucide-react";
import AdminUserResetPanel from "./AdminUserResetPanel";

type RewardType = "gems" | "streak_coins" | "credits" | "hints" | "streak_freeze" | "time_freeze" | "extra_life";

const REWARD_LABELS: Record<RewardType, string> = {
  gems: "💎 Gem",
  streak_coins: "🪙 Koin Streak",
  credits: "🎮 Kredit Game",
  hints: "💡 Hint",
  streak_freeze: "🧊 Streak Freeze",
  time_freeze: "⏱️ Time Freeze",
  extra_life: "❤️ Extra Life",
};

interface Voucher {
  id: string;
  code: string;
  name: string;
  description: string | null;
  reward_type: RewardType;
  reward_amount: number;
  max_claims: number;
  current_claims: number;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `STR-${s}`;
}

export default function AdminStreakVoucherTab() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [form, setForm] = useState({
    code: genCode(),
    name: "",
    description: "",
    reward_type: "gems" as RewardType,
    reward_amount: 100,
    max_claims: 10,
    duration_hours: 24,
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("streak_vouchers").select("*").order("created_at", { ascending: false });
    setVouchers((data || []) as Voucher[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim() || !form.code.trim() || form.reward_amount < 1 || form.max_claims < 1 || form.duration_hours < 1) {
      toast({ title: "Lengkapi semua field", variant: "destructive" });
      return;
    }
    const expires = new Date(Date.now() + form.duration_hours * 3600 * 1000);
    const { error } = await supabase.from("streak_vouchers").insert({
      code: form.code.toUpperCase().trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      reward_type: form.reward_type,
      reward_amount: form.reward_amount,
      max_claims: form.max_claims,
      starts_at: new Date().toISOString(),
      expires_at: expires.toISOString(),
      is_active: form.is_active,
    });
    if (error) {
      toast({ title: "Gagal buat voucher", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Voucher dibuat", description: `Kode: ${form.code}` });
    setForm({ ...form, code: genCode(), name: "", description: "", reward_amount: 100, max_claims: 10 });
    load();
  };

  const toggleActive = async (v: Voucher) => {
    await supabase.from("streak_vouchers").update({ is_active: !v.is_active }).eq("id", v.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus voucher?")) return;
    await supabase.from("streak_vouchers").delete().eq("id", id);
    load();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Kode disalin", description: code });
  };

  const resetClaims = async (v: Voucher) => {
    if (!confirm(`Reset jumlah klaim "${v.name}" ke 0? Catatan klaim user TIDAK dihapus.`)) return;
    await supabase.from("streak_vouchers").update({ current_claims: 0 }).eq("id", v.id);
    toast({ title: "✅ Counter klaim direset" });
    load();
  };

  const clearHistory = async (v: Voucher) => {
    if (!confirm(`Hapus SEMUA history klaim user untuk "${v.name}"? User bisa klaim ulang & counter direset ke 0.`)) return;
    await supabase.from("streak_voucher_claims").delete().eq("voucher_id", v.id);
    await supabase.from("streak_vouchers").update({ current_claims: 0 }).eq("id", v.id);
    toast({ title: "🧹 History klaim dihapus" });
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim() || editing.reward_amount < 1 || editing.max_claims < 1) {
      toast({ title: "Lengkapi semua field", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("streak_vouchers").update({
      name: editing.name.trim(),
      description: editing.description ?? "",
      reward_type: editing.reward_type,
      reward_amount: editing.reward_amount,
      max_claims: editing.max_claims,
      expires_at: editing.expires_at,
      is_active: editing.is_active,
    }).eq("id", editing.id);
    if (error) {
      toast({ title: "Gagal simpan", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Voucher diperbarui" });
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-4">
      <AdminUserResetPanel />
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Buat Streak Voucher Baru</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nama Voucher</Label>
              <Input placeholder="Contoh: Bonus Akhir Pekan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Kode Voucher</Label>
              <div className="flex gap-2">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, code: genCode() })}>Acak</Button>
              </div>
            </div>
            <div className="col-span-2">
              <Label>Deskripsi (opsional)</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Jenis Hadiah</Label>
              <Select value={form.reward_type} onValueChange={(v) => setForm({ ...form, reward_type: v as RewardType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(REWARD_LABELS) as RewardType[]).map(k => (
                    <SelectItem key={k} value={k}>{REWARD_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jumlah Hadiah</Label>
              <Input type="number" min={1} value={form.reward_amount} onChange={(e) => setForm({ ...form, reward_amount: Math.max(1, Number(e.target.value) || 0) })} />
            </div>
            <div>
              <Label>Kuota User (max klaim)</Label>
              <Input type="number" min={1} value={form.max_claims} onChange={(e) => setForm({ ...form, max_claims: Math.max(1, Number(e.target.value) || 0) })} />
            </div>
            <div>
              <Label>Durasi (jam)</Label>
              <Input type="number" min={1} value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: Math.max(1, Number(e.target.value) || 0) })} />
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <Label>Aktifkan voucher</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <Button onClick={create} className="w-full"><Plus className="w-4 h-4 mr-1" />Buat Voucher</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h4 className="font-bold text-sm">Daftar Voucher ({vouchers.length})</h4>
        {loading && <p className="text-sm text-muted-foreground">Memuat…</p>}
        {!loading && vouchers.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Belum ada voucher</p>}
        {vouchers.map(v => {
          const expired = new Date(v.expires_at) < new Date();
          const full = v.current_claims >= v.max_claims;
          return (
            <Card key={v.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{v.name}</div>
                    <button onClick={() => copyCode(v.code)} className="text-xs font-mono text-primary inline-flex items-center gap-1">
                      {v.code} <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <Switch checked={v.is_active} onCheckedChange={() => toggleActive(v)} />
                  <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
                {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{REWARD_LABELS[v.reward_type]} ×{v.reward_amount}</span>
                  <span className="px-2 py-0.5 rounded bg-muted">Klaim: {v.current_claims}/{v.max_claims}</span>
                  <span className={`px-2 py-0.5 rounded ${expired ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>
                    {expired ? "Kedaluwarsa" : `Exp: ${new Date(v.expires_at).toLocaleString("id-ID")}`}
                  </span>
                  {full && <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive">Kuota habis</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(v)}>
                    <Pencil className="w-3 h-3 mr-1" />Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resetClaims(v)}>
                    <RotateCcw className="w-3 h-3 mr-1" />Reset Counter
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => clearHistory(v)}>
                    <Eraser className="w-3 h-3 mr-1" />Hapus History Klaim
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Voucher</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nama</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Deskripsi</Label>
                <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Jenis Hadiah</Label>
                  <Select value={editing.reward_type} onValueChange={(val) => setEditing({ ...editing, reward_type: val as RewardType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REWARD_LABELS) as RewardType[]).map(k => (
                        <SelectItem key={k} value={k}>{REWARD_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Jumlah</Label>
                  <Input type="number" min={1} value={editing.reward_amount} onChange={(e) => setEditing({ ...editing, reward_amount: Math.max(1, Number(e.target.value) || 0) })} />
                </div>
                <div>
                  <Label>Kuota Max</Label>
                  <Input type="number" min={1} value={editing.max_claims} onChange={(e) => setEditing({ ...editing, max_claims: Math.max(1, Number(e.target.value) || 0) })} />
                </div>
                <div>
                  <Label>Sudah Klaim</Label>
                  <Input type="number" value={editing.current_claims} disabled />
                </div>
              </div>
              <div>
                <Label>Berakhir pada</Label>
                <Input
                  type="datetime-local"
                  value={editing.expires_at ? new Date(new Date(editing.expires_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditing({ ...editing, expires_at: new Date(e.target.value).toISOString() })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktif</Label>
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            <Button onClick={saveEdit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

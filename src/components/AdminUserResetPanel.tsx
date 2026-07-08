import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Search, UserCog, Save } from "lucide-react";

interface AdminUser {
  id: string;
  visitor_id: string;
  username: string;
  phone: string | null;
  email: string | null;
  balance: number;
  game_balance: number;
  gems: number;
  credits: number;
  streak_coins: number;
  streak_freeze: number;
  current_streak: number;
  hints: number;
  time_freeze: number;
  extra_life: number;
}

const FIELDS: { key: keyof AdminUser; label: string; emoji: string }[] = [
  { key: "balance", label: "Saldo (Rp)", emoji: "💰" },
  { key: "game_balance", label: "Saldo IN (Rp)", emoji: "💵" },
  { key: "gems", label: "Gem", emoji: "💎" },
  { key: "credits", label: "Kredit", emoji: "🎮" },
  { key: "streak_coins", label: "Koin Streak", emoji: "🪙" },
  { key: "streak_freeze", label: "Streak Freeze", emoji: "🧊" },
  { key: "current_streak", label: "Hari Streak", emoji: "🔥" },
  { key: "hints", label: "Hint", emoji: "💡" },
  { key: "time_freeze", label: "Time Freeze", emoji: "⏱️" },
  { key: "extra_life", label: "Extra Life", emoji: "❤️" },
];

export default function AdminUserResetPanel() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<Record<string, number>>>>({});

  const search = async () => {
    if (!query.trim()) {
      toast({ title: "Masukkan kata kunci pencarian", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-user", {
        body: { action: "search_users", query: query.trim() },
      });
      if (error || (data as any)?.error) {
        toast({ title: "Gagal cari", description: (data as any)?.error || error?.message, variant: "destructive" });
        return;
      }
      setUsers((data as any).users || []);
      if (((data as any).users || []).length === 0) {
        toast({ title: "Tidak ada user ditemukan" });
      }
    } finally {
      setLoading(false);
    }
  };

  const setField = (visitorId: string, key: string, val: string) => {
    const num = val === "" ? undefined : Number(val);
    setEdits(prev => ({
      ...prev,
      [visitorId]: { ...(prev[visitorId] || {}), [key]: num },
    }));
  };

  const save = async (u: AdminUser) => {
    const values = edits[u.visitor_id] || {};
    const filtered: Record<string, number> = {};
    Object.entries(values).forEach(([k, v]) => {
      if (typeof v === "number" && !isNaN(v)) filtered[k] = v;
    });
    if (Object.keys(filtered).length === 0) {
      toast({ title: "Tidak ada perubahan" });
      return;
    }
    if (!confirm(`Atur ulang nilai untuk ${u.username}?`)) return;

    const { data, error } = await supabase.functions.invoke("admin-reset-user", {
      body: { action: "set_values", visitorId: u.visitor_id, values: filtered },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Gagal simpan", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "✅ Tersimpan", description: ((data as any).updated || []).join(", ") });
    setEdits(prev => ({ ...prev, [u.visitor_id]: {} }));
    search();
  };

  const resetToZero = (u: AdminUser) => {
    if (!confirm(`Reset SEMUA nilai ${u.username} ke 0? (saldo tidak ikut)`)) return;
    setEdits(prev => ({
      ...prev,
      [u.visitor_id]: {
        gems: 0, credits: 0, streak_coins: 0, streak_freeze: 0,
        current_streak: 0, hints: 0, time_freeze: 0, extra_life: 0,
      },
    }));
    toast({ title: "Nilai 0 disiapkan — klik Simpan untuk konfirmasi" });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-primary" />
          <h3 className="font-bold">Atur / Reset Data User</h3>
        </div>
        <p className="text-xs text-muted-foreground">Cari user lalu set ulang Saldo, Gem, Kredit, Koin Streak, Hint, Freeze, Extra Life.</p>

        <div className="flex gap-2">
          <Input
            placeholder="Cari username / phone / email / visitor_id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <Button onClick={search} disabled={loading}>
            <Search className="w-4 h-4 mr-1" />Cari
          </Button>
        </div>

        <div className="space-y-3">
          {users.map(u => (
            <Card key={u.visitor_id} className="border-primary/20">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{u.username}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{u.phone || u.email || u.visitor_id.slice(0, 16)}</div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resetToZero(u)}>Reset Semua=0</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {FIELDS.map(f => {
                    const current = (u as any)[f.key] as number;
                    const edited = (edits[u.visitor_id] || {})[f.key as string];
                    return (
                      <div key={f.key as string}>
                        <Label className="text-[10px]">{f.emoji} {f.label} <span className="text-muted-foreground">(now: {current.toLocaleString("id-ID")})</span></Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder={String(current)}
                          value={edited ?? ""}
                          onChange={(e) => setField(u.visitor_id, f.key as string, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>
                <Button size="sm" className="w-full" onClick={() => save(u)}>
                  <Save className="w-3 h-3 mr-1" />Simpan Perubahan
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

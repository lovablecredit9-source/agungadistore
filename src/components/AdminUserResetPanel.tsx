import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Search, UserCog, Save, Loader2 } from "lucide-react";

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
  const [searched, setSearched] = useState(false);
  const [openEdit, setOpenEdit] = useState<string | null>(null);
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
        setUsers([]);
        toast({ title: "Gagal cari", description: (data as any)?.error || error?.message, variant: "destructive" });
        return;
      }
      setUsers((data as any).users || []);
      if (((data as any).users || []).length === 0) {
        toast({ title: "User tidak ditemukan", description: `Tidak ada akun yang cocok dengan "${query.trim()}".` });
      }
    } finally {
      setSearched(true);
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

  const fmt = (k: keyof AdminUser, v: number) =>
    k === "balance" || k === "game_balance" ? `Rp${Number(v || 0).toLocaleString("id-ID")}` : Number(v || 0).toLocaleString("id-ID");
  const maskContact = (u: AdminUser) => {
    if (u.phone) return u.phone.replace(/^(\d{4})\d+(\d{3})$/, "$1•••$2");
    if (u.email) return u.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
    return `ID ${u.visitor_id.slice(0, 8)}…`;
  };

  return (
    <Card className="overflow-hidden border-primary/25">
      <div className="bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-primary"><UserCog className="h-5 w-5" /></span>
          <div>
            <h3 className="text-sm font-black tracking-[0.18em]">⚙️ USER CONTROL CENTER</h3>
            <p className="text-[11px] text-muted-foreground">Kelola saldo, gem, streak, hint, freeze, dan resource akun secara aman.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Username / phone / email / visitor ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="h-10 pl-9"
            />
          </div>
          <Button onClick={search} disabled={loading} className="h-10">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cari"}
          </Button>
        </div>
        {searched && !loading && (
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
            {users.length > 0 ? `${users.length} akun ditemukan` : "User tidak ditemukan"}
          </p>
        )}
      </div>

      <CardContent className="space-y-3 p-3">
        {users.map((u) => {
          const editing = openEdit === u.visitor_id;
          return (
            <div key={u.visitor_id} className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-base">👤</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black">{u.username || "Tanpa nama"}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{maskContact(u)}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {FIELDS.map((f) => {
                  const current = (u as any)[f.key] as number;
                  const edited = (edits[u.visitor_id] || {})[f.key as string];
                  return (
                    <div key={f.key as string} className="rounded-xl border border-border/60 bg-muted/30 p-2">
                      <div className="text-[10px] text-muted-foreground">{f.emoji} {f.label.replace(" (Rp)", "")}</div>
                      <div className="text-[13px] font-black tabular-nums">{fmt(f.key, current)}</div>
                      {editing && (
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          aria-label={`Nilai baru ${f.label}`}
                          placeholder="Nilai baru"
                          value={edited ?? ""}
                          onChange={(e) => setField(u.visitor_id, f.key as string, e.target.value)}
                          className="mt-1 h-8 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                {editing ? (
                  <Button size="sm" className="h-9 flex-1" onClick={() => save(u)}><Save className="mr-1 h-3.5 w-3.5" />Simpan</Button>
                ) : (
                  <Button size="sm" variant="secondary" className="h-9 flex-1" onClick={() => setOpenEdit(u.visitor_id)}>Edit</Button>
                )}
                <Button size="sm" variant="outline" className="h-9 flex-1" onClick={() => { setOpenEdit(u.visitor_id); resetToZero(u); }}>Reset</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Check, Loader2, Plus, Trash2, Save, Sparkles, Zap, ShieldCheck, RefreshCw, PlugZap } from "lucide-react";

interface Provider {
  id: string;
  label: string;
  provider_type: string;
  base_url: string;
  api_key: string | null;
  model: string;
  is_selected: boolean;
  is_active: boolean;
  auto_fallback: boolean;
  note: string | null;
}

const PRESETS = [
  { label: "Lovable AI (bawaan)", type: "lovable", base: "https://ai.gateway.lovable.dev/v1", model: "google/gemini-2.5-flash" },
  { label: "Marketku Router", type: "custom", base: "https://router.marketku.id/v1", model: "mk/auto" },
  { label: "Google Gemini API", type: "custom", base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  { label: "OpenRouter", type: "custom", base: "https://openrouter.ai/api/v1", model: "google/gemini-2.5-flash" },
];

export default function AdminAiProviderTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", base_url: "", api_key: "", model: "", type: "custom" });
  const [formModels, setFormModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [rowModels, setRowModels] = useState<Record<string, string[]>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; text: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("ai_providers" as any).select("*").order("created_at");
    if (error) toast({ title: "Gagal memuat", description: error.message, variant: "destructive" });
    setRows(((data as any) || []) as Provider[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const applyPreset = (i: number) => {
    const p = PRESETS[i];
    setForm({ label: p.label, base_url: p.base, api_key: "", model: p.model, type: p.type });
    setFormModels([]);
  };

  /** Ambil daftar model otomatis dari router (tanpa ketik manual). */
  const fetchModels = async (payload: { provider_type: string; base_url: string; api_key: string }, rowId?: string) => {
    if (rowId) setTestingId(rowId); else setLoadingModels(true);
    const { data, error } = await supabase.functions.invoke("ai-provider-test", {
      body: { ...payload, list_only: true },
    });
    if (rowId) setTestingId(null); else setLoadingModels(false);
    const list: string[] = (data as any)?.models || [];
    if (error || list.length === 0) {
      toast({
        title: "Model tidak terdeteksi",
        description: (data as any)?.error || error?.message || "Router tidak mengembalikan daftar model",
        variant: "destructive",
      });
      return;
    }
    if (rowId) setRowModels((m) => ({ ...m, [rowId]: list }));
    else setFormModels(list);
    toast({ title: `✅ ${list.length} model terdeteksi` });
  };

  const testConnection = async (r: Provider) => {
    setTestingId(r.id);
    setTestResult((t) => ({ ...t, [r.id]: { ok: false, text: "Menguji..." } }));
    const { data, error } = await supabase.functions.invoke("ai-provider-test", {
      body: { provider_type: r.provider_type, base_url: r.base_url, api_key: r.api_key ?? "", model: r.model },
    });
    setTestingId(null);
    const res: any = data;
    if (error || !res?.ok) {
      setTestResult((t) => ({ ...t, [r.id]: { ok: false, text: res?.error || error?.message || "Gagal terhubung" } }));
      return toast({ title: "❌ Koneksi gagal", description: res?.error || error?.message, variant: "destructive" });
    }
    if (Array.isArray(res.models) && res.models.length) setRowModels((m) => ({ ...m, [r.id]: res.models }));
    setTestResult((t) => ({ ...t, [r.id]: { ok: true, text: `OK ${res.latency_ms}ms · ${res.model} · "${String(res.reply).slice(0, 40)}"` } }));
    toast({ title: "✅ Koneksi berhasil", description: `${res.latency_ms}ms · ${res.model}` });
  };


  const addProvider = async () => {
    if (!form.label.trim() || !form.model.trim()) {
      toast({ title: "Nama & model wajib diisi", variant: "destructive" });
      return;
    }
    if (form.type === "custom" && !form.api_key.trim()) {
      toast({ title: "API key wajib untuk router custom", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("ai_providers" as any).insert({
      label: form.label.trim(),
      provider_type: form.type,
      base_url: form.base_url.trim() || "https://ai.gateway.lovable.dev/v1",
      api_key: form.type === "lovable" ? null : form.api_key.trim(),
      model: form.model.trim(),
    } as any);
    if (error) return toast({ title: "Gagal menambah", description: error.message, variant: "destructive" });
    setForm({ label: "", base_url: "", api_key: "", model: "", type: "custom" });
    toast({ title: "✅ Provider ditambahkan" });
    load();
  };

  const select = async (id: string) => {
    // unik: hanya 1 provider terpilih
    await supabase.from("ai_providers" as any).update({ is_selected: false } as any).neq("id", id);
    const { error } = await supabase.from("ai_providers" as any).update({ is_selected: true, is_active: true } as any).eq("id", id);
    if (error) return toast({ title: "Gagal memilih", description: error.message, variant: "destructive" });
    toast({ title: "✅ Router aktif diganti" });
    load();
  };

  const saveRow = async (r: Provider) => {
    setSavingId(r.id);
    const { error } = await supabase.from("ai_providers" as any).update({
      label: r.label, base_url: r.base_url, api_key: r.api_key, model: r.model,
      auto_fallback: r.auto_fallback, is_active: r.is_active, updated_at: new Date().toISOString(),
    } as any).eq("id", r.id);
    setSavingId(null);
    if (error) return toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    toast({ title: "💾 Tersimpan" });
  };

  const remove = async (r: Provider) => {
    if (r.is_selected) return toast({ title: "Tidak bisa hapus provider aktif", variant: "destructive" });
    await supabase.from("ai_providers" as any).delete().eq("id", r.id);
    toast({ title: "🗑️ Dihapus" });
    load();
  };

  const patch = (id: string, p: Partial<Provider>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <p className="font-black text-sm">Pengaturan AI (Store AI, Bot Galau, Rekomendasi, Confess, Musik)</p>
            <p className="text-[11px] text-muted-foreground">
              Pilih 1 router aktif (centang). Kalau router gagal & fallback aktif, sistem otomatis kembali ke Lovable AI.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tambah provider */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-bold text-sm flex items-center gap-1.5"><Plus className="w-4 h-4 text-primary" /> Tambah Provider / Router</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, i) => (
              <Button key={p.label} size="sm" variant="outline" className="text-[11px] h-7 rounded-full" onClick={() => applyPreset(i)}>
                <Sparkles className="w-3 h-3 mr-1" />{p.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nama</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Marketku Router" />
            </div>
            <div>
              <Label className="text-xs">Tipe</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="lovable">Lovable AI (tanpa key)</option>
                <option value="custom">Router / API Key manual</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Base URL (OpenAI-compatible)</Label>
              <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://router.marketku.id/v1" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Model</Label>
                <button
                  type="button"
                  className="text-[10px] font-bold text-primary flex items-center gap-1 disabled:opacity-50"
                  disabled={loadingModels}
                  onClick={() => fetchModels({ provider_type: form.type, base_url: form.base_url, api_key: form.api_key })}
                >
                  {loadingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Ambil model otomatis
                </button>
              </div>
              {formModels.length > 0 ? (
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                >
                  <option value="">— pilih model —</option>
                  {formModels.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="mk/auto" />
              )}
            </div>

            <div>
              <Label className="text-xs">API Key</Label>
              <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-..." disabled={form.type === "lovable"} />
            </div>
          </div>
          <Button onClick={addProvider} className="w-full font-bold gap-1.5"><Plus className="w-4 h-4" /> Tambah Provider</Button>
        </CardContent>
      </Card>

      {/* Daftar provider */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className={r.is_selected ? "border-green-500/50 bg-green-500/5" : ""}>
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => select(r.id)}
                    className={`flex items-center gap-2 text-left ${r.is_selected ? "text-green-600" : "text-muted-foreground"}`}
                  >
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${r.is_selected ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/40"}`}>
                      {r.is_selected && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="font-black text-sm text-foreground">{r.label}</span>
                    {r.provider_type === "lovable" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">BAWAAN</span>}
                    {r.is_selected && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-600 font-bold">AKTIF</span>}
                  </button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => remove(r)}><Trash2 className="w-4 h-4" /></Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-[10px]">Base URL</Label>
                    <Input className="h-9 text-xs" value={r.base_url} onChange={(e) => patch(r.id, { base_url: e.target.value })} disabled={r.provider_type === "lovable"} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px]">Model</Label>
                      <button
                        type="button"
                        className="text-[10px] font-bold text-primary flex items-center gap-1"
                        onClick={() => fetchModels({ provider_type: r.provider_type, base_url: r.base_url, api_key: r.api_key ?? "" }, r.id)}
                      >
                        <RefreshCw className="w-3 h-3" /> Ambil model
                      </button>
                    </div>
                    {(rowModels[r.id]?.length ?? 0) > 0 ? (
                      <select
                        className="w-full h-9 rounded-md border bg-background px-2 text-xs"
                        value={r.model}
                        onChange={(e) => patch(r.id, { model: e.target.value })}
                      >
                        {!rowModels[r.id].includes(r.model) && <option value={r.model}>{r.model}</option>}
                        {rowModels[r.id].map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <Input className="h-9 text-xs" value={r.model} onChange={(e) => patch(r.id, { model: e.target.value })} />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-[10px]">API Key</Label>
                    <Input type="password" className="h-9 text-xs" value={r.api_key ?? ""} onChange={(e) => patch(r.id, { api_key: e.target.value })} placeholder={r.provider_type === "lovable" ? "Otomatis (LOVABLE_API_KEY)" : "sk-..."} disabled={r.provider_type === "lovable"} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <Switch checked={r.auto_fallback} onCheckedChange={(v) => patch(r.id, { auto_fallback: v })} />
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Fallback otomatis ke Lovable</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <Switch checked={r.is_active} onCheckedChange={(v) => patch(r.id, { is_active: v })} />
                    <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> Aktif</span>
                  </label>
                  <Button size="sm" variant="outline" className="ml-auto h-8 gap-1.5 font-bold" onClick={() => testConnection(r)} disabled={testingId === r.id}>
                    {testingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5 text-primary" />} Test Koneksi
                  </Button>
                  <Button size="sm" className="h-8 gap-1.5 font-bold" onClick={() => saveRow(r)} disabled={savingId === r.id}>
                    {savingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
                  </Button>
                </div>

                {testResult[r.id] && (
                  <p className={`text-[11px] font-semibold rounded-lg px-2 py-1.5 ${testResult[r.id].ok ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
                    {testResult[r.id].ok ? "✅ " : "❌ "}{testResult[r.id].text}
                  </p>
                )}

              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Belum ada provider</p>}
        </div>
      )}
    </div>
  );
}

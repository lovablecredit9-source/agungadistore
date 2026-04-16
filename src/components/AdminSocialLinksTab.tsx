import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, X, Check, Eye, EyeOff, Globe, Upload, ImagePlus, Loader2 } from "lucide-react";

interface SocialLink {
  id: string;
  platform: string;
  label: string;
  url: string;
  icon_url: string | null;
  color_from: string;
  color_to: string;
  sort_order: number;
  is_active: boolean;
}

export default function AdminSocialLinksTab() {
  const { toast } = useToast();
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ platform: "", label: "", url: "", icon_url: "", color_from: "#3b82f6", color_to: "#6366f1" });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLinks = async () => {
    const { data } = await supabase.from("social_links").select("*").order("sort_order");
    setLinks((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); }, []);

  const resetForm = () => {
    setForm({ platform: "", label: "", url: "", icon_url: "", color_from: "#3b82f6", color_to: "#6366f1" });
    setEditId(null);
  };

  const handleUploadIcon = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File terlalu besar!", description: "Maksimal 2MB", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "File harus gambar!", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const fileName = `icon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      
      const { error } = await supabase.storage
        .from("social-icons")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("social-icons")
        .getPublicUrl(fileName);

      setForm(f => ({ ...f, icon_url: urlData.publicUrl }));
      toast({ title: "Gambar berhasil diupload!" });
    } catch (err: any) {
      toast({ title: "Gagal upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.platform || !form.label || !form.url) {
      toast({ title: "Isi semua field wajib!", variant: "destructive" });
      return;
    }
    if (editId) {
      await supabase.from("social_links").update({
        platform: form.platform, label: form.label, url: form.url,
        icon_url: form.icon_url || null, color_from: form.color_from, color_to: form.color_to,
        updated_at: new Date().toISOString()
      } as any).eq("id", editId);
      toast({ title: "Sosmed diperbarui!" });
    } else {
      const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.sort_order)) + 1 : 1;
      await supabase.from("social_links").insert({
        platform: form.platform, label: form.label, url: form.url,
        icon_url: form.icon_url || null, color_from: form.color_from, color_to: form.color_to,
        sort_order: maxOrder
      } as any);
      toast({ title: "Sosmed ditambahkan!" });
    }
    resetForm();
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus sosial media ini?")) return;
    await supabase.from("social_links").delete().eq("id", id);
    toast({ title: "Sosmed dihapus!" });
    fetchLinks();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("social_links").update({ is_active: !current } as any).eq("id", id);
    fetchLinks();
  };

  const startEdit = (link: SocialLink) => {
    setEditId(link.id);
    setForm({
      platform: link.platform, label: link.label, url: link.url,
      icon_url: link.icon_url || "", color_from: link.color_from, color_to: link.color_to
    });
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {editId ? "Edit Sosial Media" : "Tambah Sosial Media"}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Platform (whatsapp, youtube...)" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="text-xs" />
            <Input placeholder="Label (@username)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="text-xs" />
          </div>
          <Input placeholder="URL (https://...)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="text-xs" />
          
          {/* Upload Gambar */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Gambar / Logo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUploadIcon(file);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-xs h-10 border-dashed border-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Mengupload...</>
                ) : (
                  <><ImagePlus className="w-4 h-4" /> Pilih Gambar</>
                )}
              </Button>
              {form.icon_url && (
                <Button size="sm" variant="ghost" className="h-10 px-2 text-destructive" onClick={() => setForm(f => ({ ...f, icon_url: "" }))}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {form.icon_url && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                <img src={form.icon_url} alt="preview" className="w-10 h-10 object-contain rounded" onError={e => (e.currentTarget.style.display = "none")} />
                <span className="text-[10px] text-muted-foreground truncate flex-1">{form.icon_url.split("/").pop()}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-xs text-muted-foreground">Warna:</label>
            <input type="color" value={form.color_from} onChange={e => setForm(f => ({ ...f, color_from: e.target.value }))} className="w-8 h-8 rounded cursor-pointer" />
            <span className="text-xs text-muted-foreground">→</span>
            <input type="color" value={form.color_to} onChange={e => setForm(f => ({ ...f, color_to: e.target.value }))} className="w-8 h-8 rounded cursor-pointer" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="flex-1 gap-1" disabled={uploading}>
              {editId ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {editId ? "Simpan" : "Tambah"}
            </Button>
            {editId && <Button size="sm" variant="outline" onClick={resetForm}><X className="w-3 h-3" /></Button>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {links.map(link => (
          <Card key={link.id} className={`transition-all ${!link.is_active ? "opacity-50" : ""}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${link.color_from}, ${link.color_to})` }}>
                {link.icon_url ? (
                  <img src={link.icon_url} alt={link.platform} className="w-6 h-6 object-contain" onError={e => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = "block"); }} />
                ) : null}
                <span className={`text-white text-lg font-bold ${link.icon_url ? "hidden" : ""}`}>{link.platform[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{link.platform}</p>
                <p className="text-[10px] text-muted-foreground truncate">{link.label}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(link.id, link.is_active)}>
                  {link.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(link)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(link.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {links.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Belum ada sosial media</p>}
      </div>
    </div>
  );
}

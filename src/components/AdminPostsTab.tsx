import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, X, ImagePlus, ExternalLink, Eye, EyeOff } from "lucide-react";

interface AdminPost {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  link_url: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  twitter: string;
  facebook: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminPostsTab() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [editing, setEditing] = useState<AdminPost | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    const { data, error } = await supabase.from("admin_posts").select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Gagal memuat postingan", description: error.message, variant: "destructive" });
      return;
    }
    if (data) setPosts(data as unknown as AdminPost[]);
  }

  function resetForm() {
    setEditing(null); setTitle(""); setContent(""); setImageUrl(""); setLinkUrl("");
    setWhatsapp(""); setInstagram(""); setTiktok(""); setYoutube(""); setTwitter(""); setFacebook("");
  }

  function startEdit(p: AdminPost) {
    setEditing(p); setTitle(p.title); setContent(p.content || ""); setImageUrl(p.image_url || "");
    setLinkUrl(p.link_url || ""); setWhatsapp(p.whatsapp || ""); setInstagram(p.instagram || "");
    setTiktok(p.tiktok || ""); setYoutube(p.youtube || ""); setTwitter(p.twitter || ""); setFacebook(p.facebook || "");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `posts/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast({ title: "Gagal upload", variant: "destructive" }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    setImageUrl(urlData.publicUrl);
    setUploading(false);
  }

  async function savePost() {
    if (!title.trim()) { toast({ title: "Judul wajib diisi", variant: "destructive" }); return; }
    const payload = {
      title: title.trim(), content: content.trim(), image_url: imageUrl || null,
      link_url: linkUrl.trim(), whatsapp: whatsapp.trim(), instagram: instagram.trim(),
      tiktok: tiktok.trim(), youtube: youtube.trim(), twitter: twitter.trim(), facebook: facebook.trim(),
    };

    if (editing) {
      const { error } = await supabase.from("admin_posts").update(payload as any).eq("id", editing.id);
      if (error) { toast({ title: "Gagal memperbarui postingan", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Postingan diperbarui ✅" });
    } else {
      const { error } = await supabase.from("admin_posts").insert(payload as any);
      if (error) { toast({ title: "Gagal membuat postingan", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Postingan berhasil dibuat ✅" });
    }
    resetForm(); fetchPosts();
  }

  async function deletePost(id: string) {
    const { error } = await supabase.from("admin_posts").delete().eq("id", id);
    if (error) { toast({ title: "Gagal menghapus postingan", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Postingan dihapus" }); fetchPosts();
  }

  async function toggleActive(p: AdminPost) {
    const { error } = await supabase.from("admin_posts").update({ is_active: !p.is_active } as any).eq("id", p.id);
    if (error) { toast({ title: "Gagal mengubah status postingan", description: error.message, variant: "destructive" }); return; }
    toast({ title: p.is_active ? "Postingan dinonaktifkan" : "Postingan diaktifkan" }); fetchPosts();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            {editing ? "Edit Postingan" : "Buat Postingan Baru"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Judul postingan *" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Isi konten / deskripsi" value={content} onChange={e => setContent(e.target.value)} rows={3} />

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Gambar</label>
            {imageUrl && (
              <div className="relative w-full max-w-xs">
                <img src={imageUrl} alt="Preview" className="w-full rounded-lg object-cover max-h-40" />
                <button onClick={() => setImageUrl("")} className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <ImagePlus className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload Gambar"}
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
            <Input placeholder="Atau paste URL gambar" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
          </div>

          <Input placeholder="Link URL (opsional)" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Sosial Media (opsional)</label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="WhatsApp (08xxx)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
              <Input placeholder="Instagram" value={instagram} onChange={e => setInstagram(e.target.value)} />
              <Input placeholder="TikTok" value={tiktok} onChange={e => setTiktok(e.target.value)} />
              <Input placeholder="YouTube" value={youtube} onChange={e => setYoutube(e.target.value)} />
              <Input placeholder="Twitter/X" value={twitter} onChange={e => setTwitter(e.target.value)} />
              <Input placeholder="Facebook" value={facebook} onChange={e => setFacebook(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1 gap-2" onClick={savePost}>
              {editing ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editing ? "Simpan Perubahan" : "Buat Postingan"}
            </Button>
            {editing && <Button variant="outline" onClick={resetForm}>Batal</Button>}
          </div>
        </CardContent>
      </Card>

      <h3 className="font-bold text-sm">Postingan ({posts.length})</h3>
      {posts.map(p => (
        <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
          <CardContent className="p-3 space-y-2">
            {p.image_url && <img src={p.image_url} alt={p.title} className="w-full rounded-lg object-cover max-h-32" />}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{p.title}</p>
                {p.content && <p className="text-xs text-muted-foreground line-clamp-2">{p.content}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleActive(p)}>
                  {p.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(p)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deletePost(p.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2">
              <span>{new Date(p.created_at).toLocaleDateString("id-ID")}</span>
              {p.link_url && <span className="flex items-center gap-0.5"><ExternalLink className="w-2.5 h-2.5" /> Link</span>}
              {[p.whatsapp, p.instagram, p.tiktok, p.youtube, p.twitter, p.facebook].filter(Boolean).length > 0 && (
                <span>{[p.whatsapp, p.instagram, p.tiktok, p.youtube, p.twitter, p.facebook].filter(Boolean).length} sosmed</span>
              )}
              <span className={p.is_active ? "text-accent" : "text-destructive"}>{p.is_active ? "✓ Aktif" : "✗ Nonaktif"}</span>
            </div>
          </CardContent>
        </Card>
      ))}
      {posts.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Belum ada postingan</p>}
    </div>
  );
}

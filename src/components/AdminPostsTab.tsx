import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, ImagePlus, Eye, Sparkles, Loader2, RefreshCw, X, Heart, Wand2, FileText, Power, Star } from "lucide-react";
import AdminPostCard from "@/components/posts/AdminPostCard";
import { POST_ACTIONS, POST_CATEGORIES, POST_STYLES, categoryLabel, guessCategory, suggestKeywords } from "@/components/posts/adminPostMeta";

interface AdminPost {
  id: string; title: string; content: string; image_url: string | null; link_url: string;
  whatsapp: string; instagram: string; tiktok: string; youtube: string; twitter: string; facebook: string;
  is_active: boolean; created_at: string; category?: string; action_tab?: string | null; cta_label?: string | null;
  is_featured?: boolean; like_count?: number; image_position?: string;
}

const EMPTY = { title: "", content: "", image_url: "", link_url: "", whatsapp: "", instagram: "", tiktok: "", youtube: "", twitter: "", facebook: "", category: "pengumuman", action_tab: "", cta_label: "", is_featured: false, image_position: "center" };
type Form = typeof EMPTY;

async function callAi(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-post-ai", { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminPostsTab() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [style, setStyle] = useState("premium3d");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<"" | "image" | "titles" | "desc" | "save">("");
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [descDraft, setDescDraft] = useState("");
  const [previewPost, setPreviewPost] = useState<AdminPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminPost | null>(null);
  const [imgError, setImgError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const set = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }));

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    const { data, error } = await supabase.from("admin_posts").select("*").order("created_at", { ascending: false });
    if (error) return toast({ title: "Gagal memuat postingan", description: error.message, variant: "destructive" });
    setPosts((data || []) as unknown as AdminPost[]);
  }

  const stats = useMemo(() => ({
    total: posts.length, active: posts.filter((p) => p.is_active).length, inactive: posts.filter((p) => !p.is_active).length,
    latest: posts[0] ? new Date(posts[0].created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-",
  }), [posts]);
  const keywords = useMemo(() => suggestKeywords(`${f.title} ${f.content}`), [f.title, f.content]);

  function resetForm() { setEditingId(null); setF(EMPTY); setTitleOptions([]); setDescDraft(""); setImgError(""); }
  function startEdit(p: AdminPost) {
    setEditingId(p.id);
    setF({ title: p.title, content: p.content || "", image_url: p.image_url || "", link_url: p.link_url || "", whatsapp: p.whatsapp || "", instagram: p.instagram || "", tiktok: p.tiktok || "", youtube: p.youtube || "", twitter: p.twitter || "", facebook: p.facebook || "", category: p.category || "pengumuman", action_tab: p.action_tab || "", cta_label: p.cta_label || "", is_featured: !!p.is_featured, image_position: p.image_position || "center" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast({ title: "Maksimal 5MB", variant: "destructive" });
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `posts/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast({ title: "Gagal upload", description: error.message, variant: "destructive" }); setUploading(false); return; }
    set({ image_url: supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl });
    setUploading(false); setImgError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function generateImage() {
    if (!f.title.trim()) return toast({ title: "Isi judul dulu", variant: "destructive" });
    setBusy("image"); setImgError("");
    try {
      const d = await callAi({ action: "image", title: f.title, content: f.content, category: f.category, style, keywords: keywords.map((k) => k.label) });
      set({ image_url: d.imageUrl });
      toast({ title: "✨ Gambar dibuat", description: "Cek live preview sebelum publish." });
    } catch (e) {
      setImgError(e instanceof Error ? e.message : "Gagal"); 
    } finally { setBusy(""); }
  }

  async function generateTitles() {
    if (!f.content.trim() && !f.title.trim()) return toast({ title: "Tulis isi postingan dulu", variant: "destructive" });
    setBusy("titles");
    try { const d = await callAi({ action: "titles", title: f.title, content: f.content, category: f.category }); setTitleOptions(d.titles || []); }
    catch (e) { toast({ title: "Gagal membuat judul", description: e instanceof Error ? e.message : "", variant: "destructive" }); }
    finally { setBusy(""); }
  }

  async function generateDesc() {
    if (!f.content.trim() && !f.title.trim()) return toast({ title: "Tulis judul/poin fitur dulu", variant: "destructive" });
    setBusy("desc");
    try { const d = await callAi({ action: "description", title: f.title, content: f.content, category: f.category }); setDescDraft(d.description || ""); }
    catch (e) { toast({ title: "Gagal membuat deskripsi", description: e instanceof Error ? e.message : "", variant: "destructive" }); }
    finally { setBusy(""); }
  }

  async function savePost() {
    if (!f.title.trim()) return toast({ title: "Judul wajib diisi", variant: "destructive" });
    setBusy("save");
    const payload = {
      title: f.title.trim().slice(0, 200), content: f.content.trim().slice(0, 5000), image_url: f.image_url.trim() || null,
      link_url: f.link_url.trim(), whatsapp: f.whatsapp.trim(), instagram: f.instagram.trim(), tiktok: f.tiktok.trim(),
      youtube: f.youtube.trim(), twitter: f.twitter.trim(), facebook: f.facebook.trim(),
      category: f.category, action_tab: f.action_tab || null, cta_label: f.cta_label.trim() || null, is_featured: f.is_featured, image_position: f.image_position,
    };
    const { error } = editingId
      ? await supabase.from("admin_posts").update(payload as any).eq("id", editingId)
      : await supabase.from("admin_posts").insert(payload as any);
    setBusy("");
    if (error) return toast({ title: editingId ? "Gagal memperbarui" : "Gagal membuat postingan", description: error.message, variant: "destructive" });
    toast({ title: editingId ? "Postingan diperbarui ✅" : "Postingan dipublikasikan ✅" });
    resetForm(); fetchPosts();
  }

  async function deletePost(id: string) {
    const { error } = await supabase.from("admin_posts").delete().eq("id", id);
    if (error) return toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
    toast({ title: "Postingan dihapus" }); setConfirmDelete(null); fetchPosts();
  }
  async function toggleActive(p: AdminPost) {
    const { error } = await supabase.from("admin_posts").update({ is_active: !p.is_active } as any).eq("id", p.id);
    if (error) return toast({ title: "Gagal mengubah status", description: error.message, variant: "destructive" });
    toast({ title: p.is_active ? "Postingan dinonaktifkan" : "Postingan diaktifkan" }); fetchPosts();
  }

  const livePost = { id: "preview", ...f, image_url: f.image_url || null, created_at: new Date().toISOString(), like_count: 0 };
  const chip = "min-h-9 px-3 rounded-full text-[11px] font-bold border transition active:scale-95";
  const label = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* Header + stats */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-4">
        <h2 className="text-lg font-black flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />📝 POSTINGAN ADMIN</h2>
        <p className="text-xs text-muted-foreground">Kelola pengumuman, update fitur, promo, event, dan informasi untuk user.</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[["Total", stats.total], ["Aktif", stats.active], ["Nonaktif", stats.inactive], ["Terbaru", stats.latest]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-background/70 border border-border p-2 text-center">
              <div className="text-base font-black tabular-nums">{v}</div><div className="text-[10px] text-muted-foreground font-semibold">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        {/* Form */}
        <Card><CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm">{editingId ? "✏️ Edit Postingan" : "✨ Buat Postingan"}</h3>
            {editingId && <Button size="sm" variant="ghost" onClick={resetForm}><X className="w-4 h-4 mr-1" />Batal edit</Button>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><span className={label}>Judul *</span>
              <Button size="sm" variant="outline" className="h-9" onClick={generateTitles} disabled={busy === "titles"}>{busy === "titles" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}✨ Buat Judul</Button></div>
            <Input placeholder="Contoh: Streak Shop Telah Diperbarui 🔥" value={f.title} onChange={(e) => set({ title: e.target.value })} className="h-11" />
            {titleOptions.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-primary/30 bg-primary/5 p-2">
                <p className="text-[10px] font-bold text-muted-foreground">Pilih salah satu (judul tidak diganti otomatis):</p>
                {titleOptions.map((t, i) => (
                  <button key={i} onClick={() => { set({ title: t }); setTitleOptions([]); }} className="w-full min-h-10 text-left text-sm font-semibold px-3 rounded-lg bg-background hover:bg-muted border border-border"><span className="text-[10px] text-muted-foreground mr-2">Pilihan {i + 1}</span>{t}</button>
                ))}
              </div>
            )}
            {keywords.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]"><span className="text-muted-foreground">Konteks gambar:</span>
                {keywords.map((k) => <span key={k.label} className="px-2 py-0.5 rounded-full bg-muted font-semibold">{k.emoji} {k.label}</span>)}
                {f.category !== guessCategory(`${f.title} ${f.content}`) && <button className="text-primary font-bold" onClick={() => set({ category: guessCategory(`${f.title} ${f.content}`) })}>Pakai kategori {categoryLabel(guessCategory(`${f.title} ${f.content}`))}</button>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><span className={label}>Isi postingan</span>
              <Button size="sm" variant="outline" className="h-9" onClick={generateDesc} disabled={busy === "desc"}>{busy === "desc" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}✨ Buat Deskripsi</Button></div>
            <Textarea placeholder="Tulis poin update / pengumuman..." value={f.content} onChange={(e) => set({ content: e.target.value })} rows={4} />
            {descDraft && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground">Saran deskripsi AI (bisa diedit setelah dipakai):</p>
                <p className="text-sm whitespace-pre-line">{descDraft}</p>
                <div className="flex gap-2"><Button size="sm" onClick={() => { set({ content: descDraft }); setDescDraft(""); }}>Gunakan</Button><Button size="sm" variant="ghost" onClick={() => setDescDraft("")}>Abaikan</Button></div>
              </div>
            )}
          </div>

          <div className="space-y-2"><span className={label}>Kategori</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">{POST_CATEGORIES.map((c) => <button key={c.id} onClick={() => set({ category: c.id })} className={`${chip} shrink-0 ${f.category === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{c.label}</button>)}</div>
          </div>

          {/* AI image */}
          <div className="space-y-2 rounded-2xl border border-border p-3 bg-muted/30">
            <span className={label}>✨ Generate Gambar AI</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">{POST_STYLES.map((s) => <button key={s.id} onClick={() => setStyle(s.id)} className={`${chip} shrink-0 ${style === s.id ? "bg-foreground text-background border-foreground" : "bg-background border-border"}`}>{s.label}</button>)}</div>
            {f.image_url && (
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden border border-border bg-muted">
                <img src={f.image_url} alt="Gambar postingan" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: f.image_position }} />
              </div>
            )}
            {imgError && <p className="text-xs text-destructive font-semibold">{imgError}. Kamu tetap bisa upload atau paste URL gambar.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button className="min-h-11" onClick={generateImage} disabled={busy === "image"}>{busy === "image" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : f.image_url ? <RefreshCw className="w-4 h-4 mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}{f.image_url ? "Regenerate" : "Generate Gambar"}</Button>
              <Button variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()} disabled={uploading}><ImagePlus className="w-4 h-4 mr-1" />{uploading ? "Upload..." : "Upload Gambar"}</Button>
              {f.image_url && <Button variant="outline" className="min-h-11" onClick={() => set({ image_url: "" })}><Trash2 className="w-4 h-4 mr-1" />Hapus Gambar</Button>}
              {f.image_url && (
                <select className="min-h-11 rounded-md border border-border bg-background px-2 text-sm" value={f.image_position} onChange={(e) => set({ image_position: e.target.value })}>
                  <option value="center">Fokus tengah</option><option value="top">Fokus atas</option><option value="bottom">Fokus bawah</option>
                </select>
              )}
            </div>
            {busy === "image" && <p className="text-[11px] text-muted-foreground">Membuat artwork sesuai judul & isi… (±10–30 detik)</p>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <Input placeholder="Atau paste URL gambar" value={f.image_url} onChange={(e) => set({ image_url: e.target.value })} />
          </div>

          {/* CTA */}
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1"><span className={label}>Tombol aksi</span>
              <select className="w-full min-h-11 rounded-md border border-border bg-background px-2 text-sm" value={f.action_tab} onChange={(e) => set({ action_tab: e.target.value })}>
                {POST_ACTIONS.map((a) => <option key={a.tab} value={a.tab}>{a.label}</option>)}
              </select></div>
            <div className="space-y-1"><span className={label}>Teks tombol (opsional)</span><Input className="h-11" placeholder="Otomatis sesuai aksi" value={f.cta_label} onChange={(e) => set({ cta_label: e.target.value })} /></div>
          </div>
          <Input placeholder="Link URL eksternal (opsional, menggantikan tombol aksi)" value={f.link_url} onChange={(e) => set({ link_url: e.target.value })} />
          <label className="flex items-center gap-2 text-sm font-semibold min-h-10"><input type="checkbox" className="w-4 h-4" checked={f.is_featured} onChange={(e) => set({ is_featured: e.target.checked })} /><Star className="w-4 h-4 text-primary" />Jadikan FEATURED (card besar)</label>

          <div className="space-y-2"><span className={label}>Sosial media (hanya yang diisi yang tampil)</span>
            <div className="grid grid-cols-2 gap-2">
              {([["whatsapp", "WhatsApp (08xxx)"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["twitter", "X/Twitter"], ["facebook", "Facebook"]] as const).map(([k, ph]) => (
                <Input key={k} placeholder={ph} value={f[k]} onChange={(e) => set({ [k]: e.target.value } as any)} />
              ))}
            </div>
          </div>

          <Button className="w-full min-h-12 text-sm font-black" onClick={savePost} disabled={busy === "save"}>
            {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : editingId ? <Edit2 className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {editingId ? "Simpan Perubahan" : "Publish Postingan"}
          </Button>
        </CardContent></Card>

        {/* Live preview */}
        <div className="min-w-0 xl:sticky xl:top-4 space-y-2 max-w-md">
          <p className={label}>👁 Live Preview</p>
          <AdminPostCard post={livePost as any} onLike={() => {}} onShare={() => {}} onCta={() => {}} />
        </div>
      </div>

      {/* List */}
      <h3 className="font-black text-sm pt-2">Daftar Postingan ({posts.length})</h3>
      {posts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8 rounded-2xl border border-dashed border-border">Belum ada postingan. Buat yang pertama di atas.</p>}
      <div className="space-y-2">
        {posts.map((p) => (
          <Card key={p.id} className={!p.is_active ? "opacity-70" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-20 aspect-[16/9] rounded-lg overflow-hidden bg-muted shrink-0">
                {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: p.image_position || "center" }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{p.is_featured && "⭐ "}{p.title}</p>
                <div className="text-[10.5px] text-muted-foreground flex flex-wrap gap-x-2">
                  <span>{categoryLabel(p.category)}</span><span>{new Date(p.created_at).toLocaleDateString("id-ID")}</span>
                  <span className={p.is_active ? "text-emerald-500 font-bold" : "text-destructive font-bold"}>{p.is_active ? "🟢 Aktif" : "🔴 Nonaktif"}</span>
                  <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{p.like_count || 0}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Preview" onClick={() => setPreviewPost(p)}><Eye className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Edit" onClick={() => startEdit(p)}><Edit2 className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-10 w-10" aria-label={p.is_active ? "Nonaktifkan" : "Aktifkan"} onClick={() => toggleActive(p)}><Power className={`w-4 h-4 ${p.is_active ? "text-emerald-500" : "text-destructive"}`} /></Button>
                <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Hapus" onClick={() => setConfirmDelete(p)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!previewPost} onOpenChange={(o) => !o && setPreviewPost(null)}>
        <DialogContent className="max-w-md p-2 max-h-[92vh] overflow-y-auto">
          <DialogTitle className="sr-only">Preview postingan</DialogTitle>
          {previewPost && <AdminPostCard post={previewPost} variant="detail" onLike={() => {}} onShare={() => {}} onCta={() => {}} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus postingan?</AlertDialogTitle>
            <AlertDialogDescription>"{confirmDelete?.title}" akan dihapus permanen. Pilih Nonaktifkan jika hanya ingin menyembunyikan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => confirmDelete && deletePost(confirmDelete.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Trash2, Edit2, X, ImagePlus, Clock, Eye, EyeOff, TimerReset, Share2, Check, Search, Download, ArrowUpDown, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SponsorImage {
  id: string;
  sponsor_id: string;
  image_url: string;
  image_order: number;
}

interface Sponsor {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  seller_name: string;
  seller_contact: string;
  duration_type: string;
  duration_value: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  custom_note: string | null;
  created_at: string;
  sponsor_number: number;
  category: string;
  wa_number: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  twitter: string;
  threads: string;
  stock: number;
}

interface ExtendReceipt {
  sponsor: Sponsor;
  extendType: string;
  extendValue: number;
  oldExpiry: string;
  newExpiry: string;
  remainingBefore: string;
  remainingAfter: string;
  timestamp: string;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

function calcExpiry(durationType: string, durationValue: number, startsAt: Date): Date {
  const d = new Date(startsAt);
  if (durationType === "seconds") d.setSeconds(d.getSeconds() + durationValue);
  else if (durationType === "minutes") d.setMinutes(d.getMinutes() + durationValue);
  else if (durationType === "hours") d.setHours(d.getHours() + durationValue);
  else if (durationType === "days") d.setDate(d.getDate() + durationValue);
  else if (durationType === "months") d.setMonth(d.getMonth() + durationValue);
  return d;
}

function timeRemainingStr(expiresAt: string | null): string {
  if (!expiresAt) return "Tanpa batas";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Kedaluwarsa";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0) return `${days}h ${hours}j ${mins}m`;
  if (hours > 0) return `${hours}j ${mins}m ${secs}d`;
  if (mins > 0) return `${mins}m ${secs}d`;
  return `${secs}d`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const durationLabels: Record<string, string> = { seconds: "Detik", minutes: "Menit", hours: "Jam", days: "Hari", months: "Bulan" };

// --- Sponsor Form Component ---
function SponsorForm({
  editing, onSave, onCancel, sponsorImages: existingImages
}: {
  editing: Sponsor | null;
  onSave: () => void;
  onCancel: () => void;
  sponsorImages: Record<string, SponsorImage[]>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerContact, setSellerContact] = useState("");
  const [durationType, setDurationType] = useState("days");
  const [durationValue, setDurationValue] = useState("7");
  const [customNote, setCustomNote] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("0");
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [waNumber, setWaNumber] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [threads, setThreads] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description || "");
      setPrice(String(editing.price));
      setSellerName(editing.seller_name);
      setSellerContact(editing.seller_contact);
      setDurationType(editing.duration_type);
      setDurationValue(String(editing.duration_value));
      setCustomNote(editing.custom_note || "");
      setCategory(editing.category || "");
      setStock(String(editing.stock || 0));
      setWaNumber(editing.wa_number || "");
      setInstagram(editing.instagram || "");
      setFacebook(editing.facebook || "");
      setTiktok(editing.tiktok || "");
      setTwitter(editing.twitter || "");
      setThreads(editing.threads || "");
      const existing = existingImages[editing.id] || [];
      setImages(existing.map(i => i.image_url));
    } else {
      setTitle(""); setDescription(""); setPrice(""); setSellerName("");
      setSellerContact(""); setDurationType("days"); setDurationValue("7");
      setCustomNote(""); setCategory(""); setImages([]); setStock("0");
      setWaNumber(""); setInstagram(""); setFacebook(""); setTiktok(""); setTwitter(""); setThreads("");
    }
  }, [editing]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `sponsors/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (error) { toast({ title: "Upload gagal", variant: "destructive" }); continue; }
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setImages(prev => [...prev, urlData.publicUrl]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function saveSponsor() {
    if (!title.trim() || !sellerName.trim()) {
      toast({ title: "Isi judul dan nama penjual", variant: "destructive" }); return;
    }
    const dv = parseInt(durationValue) || 1;
    const startsAt = editing ? new Date(editing.starts_at) : new Date();
    const expiresAt = calcExpiry(durationType, dv, startsAt);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      price: parseInt(price) || 0,
      image_url: images[0] || null,
      seller_name: sellerName.trim(),
      seller_contact: sellerContact.trim(),
      duration_type: durationType,
      duration_value: dv,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      custom_note: customNote.trim() || null,
      category: category.trim(),
      wa_number: waNumber.trim(),
      instagram: instagram.trim(),
      facebook: facebook.trim(),
      tiktok: tiktok.trim(),
      twitter: twitter.trim(),
      threads: threads.trim(),
      stock: parseInt(stock) || 0,
    };

    let sponsorId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("sponsors").update(payload as any).eq("id", editing.id);
      if (error) { toast({ title: "Gagal update", variant: "destructive" }); return; }
      toast({ title: "Sponsor diperbarui! ✅" });
    } else {
      const { data, error } = await supabase.from("sponsors").insert(payload as any).select("id").single();
      if (error || !data) { toast({ title: "Gagal membuat sponsor", variant: "destructive" }); return; }
      sponsorId = (data as any).id;
      // Log history: created
      await supabase.from("sponsor_history").insert({
        sponsor_id: sponsorId,
        action: "created",
        details: `Sponsor "${title.trim()}" dibuat oleh ${sellerName.trim()}`,
        new_expires_at: expiresAt.toISOString(),
        amount: parseInt(price) || 0,
      } as any);
      toast({ title: "Sponsor berhasil dibuat! 📢" });
    }

    if (sponsorId) {
      await supabase.from("sponsor_images").delete().eq("sponsor_id", sponsorId);
      if (images.length > 0) {
        const imgPayload = images.map((url, i) => ({
          sponsor_id: sponsorId,
          image_url: url,
          image_order: i,
        }));
        await supabase.from("sponsor_images").insert(imgPayload as any);
      }
    }

    onSave();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary" />{editing ? "Edit Sponsor" : "Tambah Sponsor"}</span>
          {editing && <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Judul sponsor *" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea placeholder="Deskripsi (opsional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        <Input type="number" placeholder="Harga (Rp)" value={price} onChange={e => setPrice(e.target.value)} />
        <Input placeholder="Kategori (cth: Makanan, Fashion, Elektronik) *" value={category} onChange={e => setCategory(e.target.value)} />
        <Input type="number" placeholder="Stok" value={stock} onChange={e => setStock(e.target.value)} min="0" />
        <Input placeholder="Nama penjual *" value={sellerName} onChange={e => setSellerName(e.target.value)} />
        <Input placeholder="Kontak (WA/HP)" value={sellerContact} onChange={e => setSellerContact(e.target.value)} />

        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sosial Media</p>
          <Input placeholder="No. WhatsApp (cth: 6281234567890)" value={waNumber} onChange={e => setWaNumber(e.target.value)} />
          <Input placeholder="Username Instagram" value={instagram} onChange={e => setInstagram(e.target.value)} />
          <Input placeholder="Username/URL Facebook" value={facebook} onChange={e => setFacebook(e.target.value)} />
          <Input placeholder="Username TikTok" value={tiktok} onChange={e => setTiktok(e.target.value)} />
          <Input placeholder="Username X (Twitter)" value={twitter} onChange={e => setTwitter(e.target.value)} />
          <Input placeholder="Username Threads" value={threads} onChange={e => setThreads(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Durasi</label>
            <div className="flex gap-1">
              <Input type="number" min="1" placeholder="Nilai" value={durationValue} onChange={e => setDurationValue(e.target.value)} className="flex-1" />
              <Select value={durationType} onValueChange={setDurationType}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Detik</SelectItem>
                  <SelectItem value="minutes">Menit</SelectItem>
                  <SelectItem value="hours">Jam</SelectItem>
                  <SelectItem value="days">Hari</SelectItem>
                  <SelectItem value="months">Bulan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Textarea placeholder="Catatan custom (opsional)" value={customNote} onChange={e => setCustomNote(e.target.value)} rows={2} />

        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
          <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <ImagePlus className="w-4 h-4" /> {uploading ? "Uploading..." : `Upload Foto (${images.length})`}
          </Button>
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt={`foto-${i}`} className="w-full h-20 object-cover rounded-lg" />
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button className="w-full gap-2" onClick={saveSponsor} disabled={!title.trim() || !sellerName.trim()}>
          <Megaphone className="w-4 h-4" /> {editing ? "Perbarui Sponsor" : "Buat Sponsor"}
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Extend Dialog Component ---
function ExtendDialog({
  sponsor, open, onClose, onExtended
}: {
  sponsor: Sponsor | null;
  open: boolean;
  onClose: () => void;
  onExtended: (receipt: ExtendReceipt) => void;
}) {
  const [extType, setExtType] = useState("days");
  const [extValue, setExtValue] = useState("1");
  const { toast } = useToast();

  if (!sponsor) return null;

  const isExpired = sponsor.expires_at ? new Date(sponsor.expires_at).getTime() <= Date.now() : false;
  const remainingBefore = timeRemainingStr(sponsor.expires_at);

  // Calculate new expiry: if still active, add to current expires_at; if expired, add from now
  const baseDate = isExpired ? new Date() : new Date(sponsor.expires_at || Date.now());
  const ev = parseInt(extValue) || 1;
  const newExpiry = calcExpiry(extType, ev, baseDate);
  const remainingAfter = timeRemainingStr(newExpiry.toISOString());

  async function doExtend() {
    if (!sponsor) return;
    const { error } = await supabase.from("sponsors").update({
      expires_at: newExpiry.toISOString(),
      is_active: true,
    } as any).eq("id", sponsor.id);
    if (error) { toast({ title: "Gagal perpanjang", variant: "destructive" }); return; }
    // Log history: extended
    await supabase.from("sponsor_history").insert({
      sponsor_id: sponsor.id,
      action: "extended",
      details: `Perpanjang +${ev} ${durationLabels[extType]}`,
      old_expires_at: sponsor.expires_at,
      new_expires_at: newExpiry.toISOString(),
      amount: sponsor.price,
    } as any);
    toast({ title: "Sponsor berhasil diperpanjang! ⏰" });
    onExtended({
      sponsor,
      extendType: extType,
      extendValue: ev,
      oldExpiry: sponsor.expires_at || "-",
      newExpiry: newExpiry.toISOString(),
      remainingBefore,
      remainingAfter,
      timestamp: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <TimerReset className="w-5 h-5 text-primary" /> Perpanjang Sponsor
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted rounded-lg p-3 space-y-1">
            <p className="font-bold text-sm">{sponsor.title}</p>
            <p className="text-xs text-muted-foreground">Penjual: {sponsor.seller_name}</p>
            <p className="text-xs">
              Status: <span className={isExpired ? "text-destructive font-bold" : "text-accent font-bold"}>
                {isExpired ? "Kedaluwarsa" : `Sisa ${remainingBefore}`}
              </span>
            </p>
            {sponsor.expires_at && (
              <p className="text-[10px] text-muted-foreground">Berakhir: {formatDateTime(sponsor.expires_at)}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-bold">Tambah Durasi</label>
            <div className="flex gap-1 mt-1">
              <Input type="number" min="1" value={extValue} onChange={e => setExtValue(e.target.value)} className="flex-1" />
              <Select value={extType} onValueChange={setExtType}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Detik</SelectItem>
                  <SelectItem value="minutes">Menit</SelectItem>
                  <SelectItem value="hours">Jam</SelectItem>
                  <SelectItem value="days">Hari</SelectItem>
                  <SelectItem value="months">Bulan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-primary/10 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-primary">Perhitungan:</p>
            <p className="text-xs">
              {isExpired
                ? `Mulai dari sekarang + ${ev} ${durationLabels[extType]}`
                : `Sisa (${remainingBefore}) + ${ev} ${durationLabels[extType]}`
              }
            </p>
            <p className="text-xs font-bold">Berakhir baru: {formatDateTime(newExpiry.toISOString())}</p>
            <p className="text-xs">Sisa baru: <span className="text-accent font-bold">{remainingAfter}</span></p>
          </div>

          <Button className="w-full gap-2" onClick={doExtend}>
            <TimerReset className="w-4 h-4" /> Perpanjang Sekarang
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Receipt Dialog Component ---
function ReceiptDialog({
  receipt, open, onClose
}: {
  receipt: ExtendReceipt | null;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!receipt) return null;

  const receiptText = `📢 BUKTI PERPANJANGAN SPONSOR
━━━━━━━━━━━━━━━━━━━━
🆔 ID: #${receipt.sponsor.sponsor_number}
📌 Judul: ${receipt.sponsor.title}
👤 Penjual: ${receipt.sponsor.seller_name}
📞 Kontak: ${receipt.sponsor.seller_contact}
${receipt.sponsor.price > 0 ? `💰 Harga: ${formatPrice(receipt.sponsor.price)}\n` : ""}
⏰ Perpanjangan: +${receipt.extendValue} ${durationLabels[receipt.extendType]}
📅 Sebelum: ${receipt.remainingBefore}
📅 Sesudah: ${receipt.remainingAfter}
📅 Berakhir baru: ${formatDateTime(receipt.newExpiry)}
🕐 Waktu transaksi: ${formatDateTime(receipt.timestamp)}
━━━━━━━━━━━━━━━━━━━━
✅ Transaksi Berhasil`;

  function copyReceipt() {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareReceipt() {
    if (navigator.share) {
      navigator.share({ title: "Bukti Perpanjangan Sponsor", text: receiptText });
    } else {
      copyReceipt();
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-accent">
            <Check className="w-5 h-5" /> Transaksi Berhasil!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted rounded-lg p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {receiptText}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={copyReceipt}>
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Tersalin!" : "Salin"}
            </Button>
            <Button className="flex-1 gap-2" onClick={shareReceipt}>
              <Share2 className="w-4 h-4" /> Bagikan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component ---
export default function AdminSponsorTab() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorImages, setSponsorImages] = useState<Record<string, SponsorImage[]>>({});
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [extendingSponsor, setExtendingSponsor] = useState<Sponsor | null>(null);
  const [receipt, setReceipt] = useState<ExtendReceipt | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const { toast } = useToast();

  useEffect(() => { fetchSponsors(); }, []);

  async function fetchSponsors() {
    const { data } = await supabase.from("sponsors").select("*").order("created_at", { ascending: false });
    if (data) {
      setSponsors(data as unknown as Sponsor[]);
      const { data: imgData } = await supabase.from("sponsor_images").select("*").order("image_order", { ascending: true });
      if (imgData) {
        const map: Record<string, SponsorImage[]> = {};
        (imgData as unknown as SponsorImage[]).forEach(img => {
          if (!map[img.sponsor_id]) map[img.sponsor_id] = [];
          map[img.sponsor_id].push(img);
        });
        setSponsorImages(map);
      }
    }
  }

  async function toggleActive(s: Sponsor) {
    await supabase.from("sponsors").update({ is_active: !s.is_active } as any).eq("id", s.id);
    toast({ title: s.is_active ? "Sponsor dinonaktifkan" : "Sponsor diaktifkan" });
    fetchSponsors();
  }

  async function deleteSponsor(id: string) {
    await supabase.from("sponsors").delete().eq("id", id);
    toast({ title: "Sponsor dihapus" });
    fetchSponsors();
  }

  // Get unique categories
  const categories = Array.from(new Set(sponsors.map(s => s.category).filter(Boolean)));

  // Filter & sort
  const filtered = sponsors
    .filter(s => {
      const q = search.toLowerCase().trim();
      if (q && !(
        s.title.toLowerCase().includes(q) ||
        s.seller_name.toLowerCase().includes(q) ||
        String(s.sponsor_number).includes(q) ||
        (s.category || "").toLowerCase().includes(q)
      )) return false;
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

  function downloadPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text("Laporan Data Sponsor", 14, 15);
    doc.setFontSize(9);
    doc.text(`Tanggal: ${new Date().toLocaleString("id-ID")} | Total: ${filtered.length} sponsor`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["#ID", "Judul", "Kategori", "Penjual", "Harga", "Durasi", "Sisa Waktu", "Status"]],
      body: filtered.map(s => [
        `#${s.sponsor_number}`,
        s.title,
        s.category || "-",
        s.seller_name,
        formatPrice(s.price),
        `${s.duration_value} ${durationLabels[s.duration_type] || s.duration_type}`,
        timeRemainingStr(s.expires_at),
        s.is_active ? "Aktif" : "Nonaktif",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`sponsor-report-${Date.now()}.pdf`);
    toast({ title: "PDF berhasil diunduh! 📄" });
  }

  return (
    <div className="space-y-4">
      <SponsorForm
        editing={editing}
        onSave={() => { setEditing(null); fetchSponsors(); }}
        onCancel={() => setEditing(null)}
        sponsorImages={sponsorImages}
      />

      {/* Search, Filter, Sort, PDF */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari judul, penjual, ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortOrder === "newest" ? "Terbaru" : "Terlama"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={downloadPDF}>
              <Download className="w-3 h-3" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <h3 className="font-bold text-sm">Semua Sponsor ({filtered.length})</h3>
      {filtered.map(s => {
        const imgs = sponsorImages[s.id] || [];
        return (
          <Card key={s.id} className={!s.is_active ? "opacity-60" : ""}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {imgs.length > 0 && (
                    <div className="flex gap-1 overflow-x-auto mb-2">
                      {imgs.map((img, i) => (
                        <img key={i} src={img.image_url} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />
                      ))}
                    </div>
                  )}
                  {imgs.length === 0 && s.image_url && <img src={s.image_url} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />}
                  <p className="text-[10px] font-mono text-muted-foreground">#{s.sponsor_number}</p>
                  <p className="font-bold text-sm truncate">{s.title}</p>
                  {s.category && <span className="inline-block text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{s.category}</span>}
                  {s.price > 0 && <p className="text-xs text-primary font-bold">{formatPrice(s.price)}</p>}
                  <p className="text-[10px] text-muted-foreground">Penjual: {s.seller_name} | {s.seller_contact}</p>
                  {(s.wa_number || s.instagram || s.tiktok) && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {s.wa_number && `WA: ${s.wa_number} `}
                      {s.instagram && `IG: ${s.instagram} `}
                      {s.tiktok && `TT: ${s.tiktok}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setEditing(s)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] border-primary text-primary" onClick={() => setExtendingSponsor(s)}>
                    <TimerReset className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleActive(s)}>
                    {s.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => deleteSponsor(s.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground flex flex-wrap gap-3">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.duration_value} {durationLabels[s.duration_type] || s.duration_type}</span>
                <span>Sisa: {timeRemainingStr(s.expires_at)}</span>
                <span className={s.is_active ? "text-accent" : "text-destructive"}>{s.is_active ? "✓ Aktif" : "✗ Nonaktif"}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Tidak ada sponsor ditemukan</p>}

      <ExtendDialog
        sponsor={extendingSponsor}
        open={!!extendingSponsor}
        onClose={() => setExtendingSponsor(null)}
        onExtended={(r) => { setReceipt(r); fetchSponsors(); }}
      />

      <ReceiptDialog
        receipt={receipt}
        open={!!receipt}
        onClose={() => setReceipt(null)}
      />
    </div>
  );
}

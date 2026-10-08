import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PlaySquare, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFunctionError } from "@/lib/functionError";

type Row = { position: number; videoId: string; title: string; artist: string; thumbnail: string | null; url: string; status: "exists_audio" | "exists_metadata" | "new" | "unavailable" };
type Analysis = { playlistId: string; title: string; source: string; partial: boolean; items: Row[] };

const STATUS: Record<Row["status"], { label: string; cls: string; audio: string }> = {
  exists_audio: { label: "✓ Sudah ada", cls: "text-primary", audio: "Audio tersedia" },
  exists_metadata: { label: "✓ Sudah ada (YouTube)", cls: "text-primary", audio: "Menunggu file audio" },
  new: { label: "＋ Baru", cls: "text-accent", audio: "Audio legal belum tersedia" },
  unavailable: { label: "⚠ Tidak dapat diimpor", cls: "text-destructive", audio: "—" },
};

function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const a = new Audio(); const url = URL.createObjectURL(file);
    a.preload = "metadata";
    a.onloadedmetadata = () => { resolve(Number.isFinite(a.duration) ? a.duration : 0); URL.revokeObjectURL(url); };
    a.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
    a.src = url;
  });
}

export default function YouTubePlaylistImporter() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "analyze" | "commit" | string>("");
  const [data, setData] = useState<Analysis | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<any>(null);

  async function call(body: any) {
    const { data, error } = await supabase.functions.invoke("youtube-playlist-import", { body });
    if (error || data?.error) throw new Error(getFunctionError(error, data, "Gagal"));
    return data;
  }

  async function analyze() {
    if (busy) return;
    setBusy("analyze"); setSummary(null);
    try {
      const d: Analysis = await call({ action: "analyze", url });
      setData(d);
      setSelected(new Set(d.items.filter(i => i.status === "new").map(i => i.videoId)));
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setBusy("");
  }

  async function commit(ids: string[]) {
    if (busy || !data) return;
    setBusy("commit");
    try {
      const r = await call({ action: "commit", url, videoIds: ids });
      setSummary(r.summary);
      toast({ title: "Metadata tersimpan", description: "Audio belum diunduh — upload file legal per lagu bila tersedia." });
      await analyze();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setBusy("");
  }

  async function uploadAudio(row: Row, file: File) {
    if (busy) return;
    if (!file.type.startsWith("audio/") || file.size === 0) { toast({ title: "File harus audio dan tidak kosong", variant: "destructive" }); return; }
    setBusy(row.videoId);
    try {
      const duration = await readDuration(file);
      const path = `yt-licensed/${row.videoId}-${Date.now()}.${file.name.split(".").pop() || "mp3"}`;
      const { error } = await supabase.storage.from("music-files").upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      const fileUrl = supabase.storage.from("music-files").getPublicUrl(path).data.publicUrl;
      await call({ action: "attach", videoId: row.videoId, fileUrl, fileSize: file.size, duration });
      toast({ title: "Audio legal ditambahkan ke katalog" });
      await analyze();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    setBusy("");
  }

  const counts = data ? data.items.reduce((m, i) => ({ ...m, [i.status]: (m[i.status] || 0) + 1 }), {} as Record<string, number>) : {};

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><PlaySquare className="w-5 h-5 text-destructive" /> Import YouTube Playlist</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Hanya metadata yang diambil. Audio YouTube tidak pernah diunduh — upload file audio sendiri hanya untuk lagu milikmu/berlisensi.</p>
        <div className="flex gap-2">
          <Input placeholder="Paste YouTube Playlist URL" value={url} onChange={e => setUrl(e.target.value)} className="min-w-0" />
          <Button onClick={analyze} disabled={!url.trim() || !!busy}>{busy === "analyze" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analisis Playlist"}</Button>
        </div>
        {data && (
          <div className="space-y-2">
            <p className="text-sm font-bold break-words">{data.title} · {data.items.length} video</p>
            {data.partial && <p className="text-xs text-destructive">⚠ Tanpa kunci YouTube Data API hanya 15 video pertama yang bisa dibaca dari feed resmi.</p>}
            <p className="text-xs text-muted-foreground">Sudah ada: {(counts.exists_audio || 0) + (counts.exists_metadata || 0)} · Baru: {counts.new || 0} · Tidak dapat diimpor: {counts.unavailable || 0}</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50"><tr><th className="p-2"></th><th className="p-2 text-left">#</th><th className="p-2 text-left">Judul</th><th className="p-2 text-left">Artist</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Audio</th><th className="p-2 text-left">Action</th></tr></thead>
                <tbody>
                  {data.items.map(r => (
                    <tr key={r.videoId} className="border-t border-border align-top">
                      <td className="p-2"><Checkbox disabled={r.status !== "new"} checked={selected.has(r.videoId)} onCheckedChange={v => setSelected(s => { const n = new Set(s); v ? n.add(r.videoId) : n.delete(r.videoId); return n; })} /></td>
                      <td className="p-2">{r.position + 1}</td>
                      <td className="p-2 min-w-[160px]"><div className="flex gap-2 items-center">{r.thumbnail && <img src={r.thumbnail} alt="" className="w-12 h-9 rounded object-cover shrink-0" />}<span className="line-clamp-2">{r.title}</span></div><span className="text-[10px] text-muted-foreground font-mono">{r.videoId}</span></td>
                      <td className="p-2">{r.artist || "—"}</td>
                      <td className={`p-2 font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</td>
                      <td className="p-2">{STATUS[r.status].audio}</td>
                      <td className="p-2">
                        {r.status === "exists_metadata" ? (
                          <label className="inline-flex items-center gap-1 text-primary cursor-pointer">
                            {busy === r.videoId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload audio legal
                            <input type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAudio(r, f); e.target.value = ""; }} />
                          </label>
                        ) : r.status === "new" ? "Simpan metadata" : "Lewati"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => commit([...selected])} disabled={!selected.size || !!busy}>Simpan yang Dipilih ({selected.size})</Button>
              <Button size="sm" variant="secondary" onClick={() => commit(data.items.filter(i => i.status === "new").map(i => i.videoId))} disabled={!counts.new || !!busy}>Tambahkan Semua yang Belum Ada</Button>
            </div>
          </div>
        )}
        {summary && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs grid grid-cols-2 gap-1">
            <span>Total playlist: {summary.total}</span><span>Sudah ada: {summary.existing}</span>
            <span>Baru (metadata): {summary.new}</span><span>Dilewati: {summary.skipped}</span>
            <span>Berhasil: {summary.new}</span><span>Gagal: {summary.failed}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { History, Music2, Film, Search, Trash2, MousePointerClick, Play, Download, ExternalLink, Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { YtEntry } from "./useYtHistory";

const ICON = { search: Search, select: MousePointerClick, mp3: Music2, mp4: Film, play: Headphones };
const LABEL = { search: "Search", select: "Dipilih", mp3: "MP3", mp4: "MP4", play: "Diputar" };
const FILTERS = [["all", "Semua"], ["search", "Pencarian"], ["mp3", "MP3"], ["mp4", "MP4"], ["ok", "Berhasil"], ["fail", "Gagal"]] as const;
type Filter = (typeof FILTERS)[number][0];
const fmt = (t: string) => new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export function filterHistory(items: YtEntry[], f: Filter, q: string, sort: "new" | "old") {
  const s = q.trim().toLowerCase();
  const list = items.filter((it) =>
    (f === "all" || (f === "ok" || f === "fail" ? it.status === f : it.type === f)) && (!s || `${it.title} ${it.url ?? ""}`.toLowerCase().includes(s)));
  return [...list].sort((a, b) => (sort === "new" ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)));
}

export default function YoutubeHistory({ items, loading, media = false, onOpen, onPlay, onConvert, onRemove, onClear }: {
  items: YtEntry[]; loading: boolean; media?: boolean;
  onOpen: (it: YtEntry) => void; onPlay: (it: YtEntry) => void; onConvert: (it: YtEntry, mode: "mp3" | "mp4") => void;
  onRemove: (id: string) => void; onClear: () => void;
}) {
  const [f, setF] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const base = useMemo(() => (media ? items.filter((i) => (i.type === "mp3" || i.type === "mp4") && i.status === "ok" && i.media_url) : items), [items, media]);
  const list = useMemo(() => filterHistory(base, media ? "all" : f, q, sort), [base, f, q, sort, media]);

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted motion-safe:animate-pulse" />)}</div>;
  if (!base.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
        {media ? <Headphones className="h-10 w-10 text-muted-foreground" /> : <History className="h-10 w-10 text-muted-foreground" />}
        <p className="text-sm font-semibold text-foreground">{media ? "Belum ada media." : "Belum ada riwayat."}</p>
        <p className="text-xs text-muted-foreground">{media ? "Konversi MP3 atau MP4 yang berhasil akan muncul di sini." : "Mulai cari video YouTube. Riwayat tersimpan otomatis di akunmu."}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={media ? "Cari di Media Saya" : "Cari di riwayat"} aria-label="Cari di riwayat" className="h-9 pl-8" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as "new" | "old")} aria-label="Urutkan" className="h-9 rounded-md border border-input bg-background px-2 text-xs">
          <option value="new">Terbaru</option><option value="old">Terlama</option>
        </select>
      </div>
      {!media && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter riwayat">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setF(k)} aria-pressed={f === k}
              className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${f === k ? "border-destructive bg-destructive text-destructive-foreground" : "border-border bg-card text-foreground hover:bg-muted"}`}>{l}</button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{list.length} dari {base.length} • tersimpan di akunmu</p>
        {!media && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="h-8 gap-1 text-xs"><Trash2 className="h-3.5 w-3.5" />Hapus semua</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus semua riwayat YouTube?</AlertDialogTitle>
                <AlertDialogDescription>{items.length} aktivitas akan dihapus dari akunmu dan tidak bisa dikembalikan.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={onClear}>Hapus semua</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <ul className="space-y-2">
        {list.map((it, i) => {
          const Icon = ICON[it.type];
          const playable = it.status === "ok" && !!it.media_url;
          return (
            <li key={it.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md motion-safe:animate-fade-in">
              <button type="button" onClick={() => (playable ? onPlay(it) : onOpen(it))} className="flex min-w-0 gap-3 text-left" aria-label={`${playable ? "Putar" : "Buka lagi"}: ${it.title}`}>
                <span className="relative shrink-0">
                  {it.thumbnail
                    ? <img src={it.thumbnail} alt="" loading="lazy" className="h-16 w-28 rounded-lg object-cover bg-muted" />
                    : <span className="grid h-16 w-16 place-items-center rounded-lg bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></span>}
                  {playable && <span className="absolute inset-0 grid place-items-center"><span className="grid h-8 w-8 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg"><Play className="h-4 w-4" /></span></span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold text-foreground break-words">{it.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-semibold text-destructive"><Icon className="h-3 w-3" />{LABEL[it.type]}</span>
                    {it.quality && <span className="rounded-full bg-muted px-2 py-0.5">{it.quality}p</span>}
                    {it.duration && <span className="rounded-full bg-muted px-2 py-0.5">{it.duration}</span>}
                    {it.status === "ok" && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Berhasil</span>}
                    {it.status === "pending" && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Loader2 className="h-3 w-3 animate-spin" />Diproses</span>}
                    {it.status === "fail" && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive" title={it.error ?? undefined}>Gagal</span>}
                    <span className="text-muted-foreground">{fmt(it.at)}</span>
                  </span>
                </span>
              </button>
              <div className="flex flex-wrap gap-1.5">
                {playable && <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => onPlay(it)}><Play className="h-3 w-3" />Putar</Button>}
                {playable && <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-[11px]" asChild><a href={it.media_url!} target="_blank" rel="noopener noreferrer" download><Download className="h-3 w-3" />Unduh</a></Button>}
                {it.url && <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-[11px]" asChild><a href={it.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />Buka</a></Button>}
                {it.type === "search" && <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-[11px]" onClick={() => onOpen(it)}><Search className="h-3 w-3" />Cari lagi</Button>}
                {it.url && !media && <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => onConvert(it, "mp3")}>MP3</Button>}
                {it.url && !media && <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => onConvert(it, "mp4")}>MP4</Button>}
                <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 px-2 text-[11px]" aria-label="Hapus item" onClick={() => onRemove(it.id)}><Trash2 className="h-3.5 w-3.5" />Hapus</Button>
              </div>
            </li>
          );
        })}
        {!list.length && <li className="py-6 text-center text-xs text-muted-foreground">Tidak ada yang cocok dengan filter.</li>}
      </ul>
    </div>
  );
}

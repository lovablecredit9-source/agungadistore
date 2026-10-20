import { History, Music2, Film, Search, Trash2, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { YtHistoryItem } from "./youtubeHistory";

const ICON = { search: Search, select: MousePointerClick, mp3: Music2, mp4: Film };
const LABEL = { search: "Search", select: "Dipilih", mp3: "MP3", mp4: "MP4" };
const fmt = (t: number) => new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

export default function YoutubeHistory({ items, onOpen, onConvert, onRemove, onClear }: {
  items: YtHistoryItem[];
  onOpen: (it: YtHistoryItem) => void;
  onConvert: (it: YtHistoryItem, mode: "mp3" | "mp4") => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
        <History className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Belum ada riwayat.</p>
        <p className="text-xs text-muted-foreground">Mulai cari video YouTube. Riwayat tersimpan otomatis di perangkat ini.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{items.length} aktivitas • tersimpan di perangkat ini</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="h-8 gap-1 text-xs"><Trash2 className="h-3.5 w-3.5" />Hapus semua</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus semua riwayat YouTube?</AlertDialogTitle>
              <AlertDialogDescription>{items.length} aktivitas akan dihapus dari perangkat ini dan tidak bisa dikembalikan.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={onClear}>Hapus semua</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <ul className="space-y-2">
        {items.map((it) => {
          const Icon = ICON[it.type];
          return (
            <li key={it.id} className="flex min-w-0 gap-3 rounded-xl border border-border bg-card p-2.5 shadow-sm animate-fade-in">
              <button type="button" onClick={() => onOpen(it)} className="flex min-w-0 flex-1 gap-3 text-left" aria-label={`Buka lagi: ${it.title}`}>
                {it.thumbnail
                  ? <img src={it.thumbnail} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded-lg object-cover bg-muted" />
                  : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted"><Icon className="h-5 w-5 text-muted-foreground" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold text-foreground break-words">{it.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 font-semibold text-destructive"><Icon className="h-3 w-3" />{LABEL[it.type]}</span>
                    {it.quality && <span className="rounded-full bg-muted px-2 py-0.5">{it.quality}p</span>}
                    {it.status === "ok" && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Berhasil</span>}
                    {it.status === "fail" && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive" title={it.error}>Gagal</span>}
                    <span className="text-muted-foreground">{fmt(it.at)}</span>
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 flex-col gap-1">
                {it.url && <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => onConvert(it, "mp3")}>MP3</Button>}
                {it.url && <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => onConvert(it, "mp4")}>MP4</Button>}
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Hapus item" onClick={() => onRemove(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

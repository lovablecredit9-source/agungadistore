import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Only render with the store's admin-controlled is_verified flag. Tap/hover explains the badge. */
export function SellerVerifiedBadge({ verified, className }: { verified?: boolean; className?: string }) {
  if (!verified) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Penjual terverifikasi"
          title="Toko ini telah diverifikasi oleh admin."
          className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--seller-verified))] align-middle", className)}
        >
          <Check className="h-3 w-3 text-[hsl(var(--seller-verified-foreground))]" strokeWidth={3} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-[240px] rounded-xl p-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
        <p className="flex items-center gap-1.5 font-bold text-foreground">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--seller-verified))]">
            <Check className="h-3 w-3 text-[hsl(var(--seller-verified-foreground))]" strokeWidth={3} />
          </span>
          Terverifikasi
        </p>
        <p className="mt-1 text-muted-foreground">Toko ini telah diverifikasi oleh admin.</p>
      </PopoverContent>
    </Popover>
  );
}

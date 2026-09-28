import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Only render with the store's admin-controlled is_verified flag. */
export function SellerVerifiedBadge({ verified, className }: { verified?: boolean; className?: string }) {
  if (!verified) return null;
  return <span role="img" aria-label="Penjual terverifikasi" title="Penjual terverifikasi" className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--seller-verified))] align-middle", className)}><Check className="h-3 w-3 text-[hsl(var(--seller-verified-foreground))]" strokeWidth={3}/></span>;
}
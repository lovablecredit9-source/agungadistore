export function rarityStyle(r: string) {
  const k = (r || "common").toLowerCase();
  if (k === "jackpot") return { label: "Jackpot", badge: "bg-primary text-primary-foreground" };
  if (k === "mythic") return { label: "Mythic", badge: "bg-destructive text-destructive-foreground" };
  if (k === "legendary") return { label: "Legendary", badge: "bg-accent text-accent-foreground" };
  if (k === "epic") return { label: "Epic", badge: "bg-primary/20 text-primary" };
  if (k === "rare") return { label: "Rare", badge: "bg-secondary text-secondary-foreground" };
  return { label: "Common", badge: "bg-muted text-muted-foreground" };
}

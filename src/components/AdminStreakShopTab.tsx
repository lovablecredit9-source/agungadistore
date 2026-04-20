import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const SHOP_TABLES = [
  { table: "streak_shop_items", label: "Item Shop Utama", priceCol: "price_coins" },
  { table: "streak_flash_deals", label: "Flash Deals", priceCol: "flash_price" },
  { table: "event_shop_daily_rotation", label: "Daily Rotation Event", priceCol: "base_price_coins" },
  { table: "event_shop_bundles", label: "Event Bundles", priceCol: "price_coins" },
  { table: "event_shop_mystery_boxes", label: "Mystery Boxes", priceCol: "price_coins" },
  { table: "event_shop_achievement_items", label: "Achievement Items", priceCol: "price_coins" },
  { table: "gem_packages", label: "Gem Packages", priceCol: "price" },
  { table: "credit_packages", label: "Credit Packages", priceCol: "price" },
  { table: "bundle_packages", label: "Bundle Packages", priceCol: "price" },
] as const;

export default function AdminStreakShopTab() {
  const { toast } = useToast();
  const [activeTable, setActiveTable] = useState<typeof SHOP_TABLES[number]["table"]>("streak_shop_items");
  const [items, setItems] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});

  const cur = SHOP_TABLES.find((t) => t.table === activeTable)!;

  const load = async () => {
    setEdits({});
    const { data, error } = await supabase.from(activeTable as any).select("*").limit(200);
    if (error) {
      toast({ title: `Tabel ${activeTable} tidak tersedia`, variant: "destructive" });
      setItems([]);
      return;
    }
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [activeTable]);

  const save = async (id: string) => {
    const newPrice = edits[id];
    if (newPrice === undefined) return;
    const { error } = await supabase.from(activeTable as any).update({ [cur.priceCol]: newPrice } as any).eq("id", id);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: "✅ Harga tersimpan" });
    setEdits((prev) => { const c = { ...prev }; delete c[id]; return c; });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SHOP_TABLES.map((t) => (
          <Button key={t.table} size="sm" variant={activeTable === t.table ? "default" : "outline"} onClick={() => setActiveTable(t.table)}>
            {t.label}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">Edit harga di kolom <code>{cur.priceCol}</code> pada tabel <code>{cur.table}</code>.</p>

      <div className="space-y-2">
        {items.map((it) => {
          const name = it.name || it.label || it.title || it.description || it.id;
          const currentPrice = it[cur.priceCol] ?? 0;
          const editVal = edits[it.id] ?? currentPrice;
          return (
            <Card key={it.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{it.icon || ""} {name}</p>
                  <p className="text-xs text-muted-foreground truncate">ID: {it.id.slice(0, 8)}…</p>
                </div>
                <Input type="number" className="w-28" value={editVal} onChange={(e) => setEdits({ ...edits, [it.id]: +e.target.value })} />
                <Button size="sm" onClick={() => save(it.id)} disabled={edits[it.id] === undefined || edits[it.id] === currentPrice}>
                  <Save className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Tidak ada item</p>}
      </div>
    </div>
  );
}

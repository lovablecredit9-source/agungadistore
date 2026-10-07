import { createRoot } from "react-dom/client";
import AdminProductCatalog from "@/components/admin/AdminProductCatalog";
import { supabase } from "@/integrations/supabase/client";
const el = document.createElement("div"); el.id = "qa"; el.className = "fixed inset-0 z-[99999] overflow-auto bg-background p-3"; document.body.appendChild(el);
supabase.from("products").select("*").then(({ data }) => {
  const ps = (data || []) as any[];
  createRoot(el).render(<AdminProductCatalog products={ps} allProducts={ps} search="" onSearch={() => {}} getImages={(id) => { const p = ps.find(x => x.id === id); return p?.image_url ? [p.image_url] : []; }} onEdit={() => {}} onDelete={() => {}} />);
});

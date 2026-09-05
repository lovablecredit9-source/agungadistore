-- 1. Perbaiki policy update seller_applications (memblokir approve/reject)
DROP POLICY IF EXISTS "Users update own pending application" ON public.seller_applications;
CREATE POLICY "Anyone can update application" ON public.seller_applications
FOR UPDATE USING (true) WITH CHECK (true);

-- 2. Garansi produk penjual
ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS has_warranty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_duration_value integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warranty_duration_unit text NOT NULL DEFAULT 'month';

-- 3. Varian produk penjual
CREATE TABLE IF NOT EXISTS public.seller_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.seller_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  price bigint NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_product_variants TO anon;
GRANT ALL ON public.seller_product_variants TO service_role;
ALTER TABLE public.seller_product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product variants" ON public.seller_product_variants FOR SELECT USING (true);
CREATE POLICY "Anyone manage product variants" ON public.seller_product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_seller_variants_product ON public.seller_product_variants(product_id);
CREATE TRIGGER trg_seller_variants_updated BEFORE UPDATE ON public.seller_product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Notifikasi otomatis
CREATE OR REPLACE FUNCTION public.notify_seller_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.create_notification(
      NEW.visitor_id,
      CASE WHEN NEW.status = 'approved' THEN '🎉 Pendaftaran toko disetujui' ELSE '❌ Pendaftaran toko ditolak' END,
      CASE WHEN NEW.status = 'approved'
        THEN 'Selamat! Toko "' || NEW.store_name || '" sudah aktif. Kamu bisa mulai menambah produk.'
        ELSE 'Pendaftaran toko "' || NEW.store_name || '" ditolak. ' || COALESCE(NEW.admin_note, '') END,
      'seller', NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_seller_app ON public.seller_applications;
CREATE TRIGGER trg_notify_seller_app AFTER UPDATE ON public.seller_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_application_status();

CREATE OR REPLACE FUNCTION public.notify_seller_product_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
    PERFORM public.create_notification(
      NEW.visitor_id,
      CASE WHEN NEW.status = 'approved' THEN '✅ Produk disetujui' ELSE '❌ Produk ditolak' END,
      'Produk "' || NEW.title || '" ' ||
      CASE WHEN NEW.status = 'approved' THEN 'sudah tayang di etalase.' ELSE 'ditolak admin. ' || COALESCE(NEW.admin_note, '') END,
      'seller', NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_seller_product ON public.seller_products;
CREATE TRIGGER trg_notify_seller_product AFTER UPDATE ON public.seller_products
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_product_status();

CREATE OR REPLACE FUNCTION public.notify_seller_withdrawal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid','rejected') THEN
    PERFORM public.create_notification(
      NEW.visitor_id,
      CASE WHEN NEW.status = 'paid' THEN '💸 Penarikan dibayar' ELSE '❌ Penarikan ditolak' END,
      'Penarikan Rp ' || NEW.amount::text || ' via ' || NEW.method || ' ' ||
      CASE WHEN NEW.status = 'paid' THEN 'sudah dikirim.' ELSE 'ditolak. ' || COALESCE(NEW.admin_note, '') END,
      'seller', NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_seller_wd ON public.seller_withdrawals;
CREATE TRIGGER trg_notify_seller_wd AFTER UPDATE ON public.seller_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_withdrawal_status();
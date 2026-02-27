
-- Storage providers configuration table
CREATE TABLE public.storage_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.storage_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read storage providers"
  ON public.storage_providers FOR SELECT
  USING (is_super_admin());

CREATE POLICY "Super admin can insert storage providers"
  ON public.storage_providers FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can update storage providers"
  ON public.storage_providers FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "Super admin can delete storage providers"
  ON public.storage_providers FOR DELETE
  USING (is_super_admin());

-- Seed default providers
INSERT INTO public.storage_providers (provider_name, priority, credentials) VALUES
  ('cloudinary', 1, '{"cloud_name": "", "upload_preset": ""}'::jsonb),
  ('s3', 2, '{"access_key": "", "secret_key": "", "bucket_name": "", "region": ""}'::jsonb),
  ('imagekit', 3, '{"public_key": "", "url_endpoint": ""}'::jsonb);

-- Add storage_provider and upload_status to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS storage_provider text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS upload_status text DEFAULT 'success';

-- Add storage_provider and upload_status to seller_products
ALTER TABLE public.seller_products ADD COLUMN IF NOT EXISTS storage_provider text;
ALTER TABLE public.seller_products ADD COLUMN IF NOT EXISTS upload_status text DEFAULT 'success';

-- Trigger for updated_at
CREATE TRIGGER update_storage_providers_updated_at
  BEFORE UPDATE ON public.storage_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

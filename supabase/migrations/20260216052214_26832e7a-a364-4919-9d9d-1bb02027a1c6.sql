
-- Add new columns to seller_products for images, pricing, and featured flag
ALTER TABLE public.seller_products
  ADD COLUMN IF NOT EXISTS image_url_2 text,
  ADD COLUMN IF NOT EXISTS image_url_3 text,
  ADD COLUMN IF NOT EXISTS purchase_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mrp numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

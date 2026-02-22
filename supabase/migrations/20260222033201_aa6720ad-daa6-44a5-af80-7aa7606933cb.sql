
-- Add variation_type to categories
ALTER TABLE public.categories ADD COLUMN variation_type text DEFAULT NULL;
-- Values: 'size', 'weight', 'color', 'measurement', or NULL (no variations)

-- Create product_variants table
CREATE TABLE public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL,
  product_type text NOT NULL DEFAULT 'regular', -- 'regular' or 'seller'
  variant_label text NOT NULL, -- e.g. 'S', '500g', 'Red', '10cm'
  variant_value text, -- optional detailed value
  price_adjustment numeric NOT NULL DEFAULT 0, -- price override (0 = use product base price)
  price numeric NOT NULL DEFAULT 0, -- actual price for this variant
  mrp numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read active variants" ON public.product_variants
  FOR SELECT USING (is_active = true OR is_super_admin() OR has_permission('read_products'));

CREATE POLICY "Authorized can create variants" ON public.product_variants
  FOR INSERT WITH CHECK (is_super_admin() OR has_permission('create_products'));

CREATE POLICY "Authorized can update variants" ON public.product_variants
  FOR UPDATE USING (is_super_admin() OR has_permission('update_products'));

CREATE POLICY "Authorized can delete variants" ON public.product_variants
  FOR DELETE USING (is_super_admin() OR has_permission('delete_products'));

-- Trigger for updated_at
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

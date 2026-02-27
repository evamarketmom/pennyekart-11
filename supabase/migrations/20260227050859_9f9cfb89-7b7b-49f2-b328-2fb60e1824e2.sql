
-- Flash Sales table
CREATE TABLE public.flash_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  banner_color text DEFAULT '#ef4444',
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Flash Sale Products junction table (supports both admin products and seller products)
CREATE TABLE public.flash_sale_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flash_sale_id uuid NOT NULL REFERENCES public.flash_sales(id) ON DELETE CASCADE,
  product_id uuid,
  seller_product_id uuid,
  flash_price numeric NOT NULL DEFAULT 0,
  flash_mrp numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS for flash_sales
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active flash sales" ON public.flash_sales
  FOR SELECT USING (
    (is_active = true) OR is_super_admin() OR has_permission('read_products')
  );

CREATE POLICY "Authorized can create flash sales" ON public.flash_sales
  FOR INSERT WITH CHECK (
    is_super_admin() OR has_permission('create_products')
  );

CREATE POLICY "Authorized can update flash sales" ON public.flash_sales
  FOR UPDATE USING (
    is_super_admin() OR has_permission('update_products')
  );

CREATE POLICY "Authorized can delete flash sales" ON public.flash_sales
  FOR DELETE USING (
    is_super_admin() OR has_permission('delete_products')
  );

-- RLS for flash_sale_products
ALTER TABLE public.flash_sale_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read flash sale products" ON public.flash_sale_products
  FOR SELECT USING (true);

CREATE POLICY "Authorized can create flash sale products" ON public.flash_sale_products
  FOR INSERT WITH CHECK (
    is_super_admin() OR has_permission('create_products')
  );

CREATE POLICY "Authorized can update flash sale products" ON public.flash_sale_products
  FOR UPDATE USING (
    is_super_admin() OR has_permission('update_products')
  );

CREATE POLICY "Authorized can delete flash sale products" ON public.flash_sale_products
  FOR DELETE USING (
    is_super_admin() OR has_permission('delete_products')
  );

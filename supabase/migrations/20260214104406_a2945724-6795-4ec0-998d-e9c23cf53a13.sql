
-- 1. Create roles table
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create permissions table
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  feature text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create role_permissions junction table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- 4. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  category text,
  stock integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  total numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Create banners table
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  link_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Enable RLS on all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- 9. Helper function: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND is_super_admin = true
  )
$$;

-- 10. Helper function: has_permission
CREATE OR REPLACE FUNCTION public.has_permission(_permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_id = p.role_id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE p.user_id = auth.uid()
    AND perm.name = _permission_name
  )
$$;

-- 11. Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 12. Triggers for updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. RLS Policies

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id OR public.is_super_admin());
CREATE POLICY "Super admin can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_super_admin() OR auth.uid() = user_id);
CREATE POLICY "Super admin can delete profiles" ON public.profiles FOR DELETE USING (public.is_super_admin());

-- Roles
CREATE POLICY "Super admin can read roles" ON public.roles FOR SELECT USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Super admin can insert roles" ON public.roles FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin can update roles" ON public.roles FOR UPDATE USING (public.is_super_admin());
CREATE POLICY "Super admin can delete roles" ON public.roles FOR DELETE USING (public.is_super_admin());

-- Permissions
CREATE POLICY "Super admin can read permissions" ON public.permissions FOR SELECT USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Super admin can insert permissions" ON public.permissions FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin can update permissions" ON public.permissions FOR UPDATE USING (public.is_super_admin());
CREATE POLICY "Super admin can delete permissions" ON public.permissions FOR DELETE USING (public.is_super_admin());

-- Role Permissions
CREATE POLICY "Super admin can read role_permissions" ON public.role_permissions FOR SELECT USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Super admin can insert role_permissions" ON public.role_permissions FOR INSERT WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin can update role_permissions" ON public.role_permissions FOR UPDATE USING (public.is_super_admin());
CREATE POLICY "Super admin can delete role_permissions" ON public.role_permissions FOR DELETE USING (public.is_super_admin());

-- Products
CREATE POLICY "Anyone can read active products" ON public.products FOR SELECT USING (is_active = true OR public.is_super_admin() OR public.has_permission('read_products'));
CREATE POLICY "Authorized can create products" ON public.products FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_permission('create_products'));
CREATE POLICY "Authorized can update products" ON public.products FOR UPDATE USING (public.is_super_admin() OR public.has_permission('update_products'));
CREATE POLICY "Authorized can delete products" ON public.products FOR DELETE USING (public.is_super_admin() OR public.has_permission('delete_products'));

-- Orders
CREATE POLICY "Users can read own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin() OR public.has_permission('read_orders'));
CREATE POLICY "Authorized can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_super_admin() OR public.has_permission('create_orders'));
CREATE POLICY "Authorized can update orders" ON public.orders FOR UPDATE USING (public.is_super_admin() OR public.has_permission('update_orders'));
CREATE POLICY "Authorized can delete orders" ON public.orders FOR DELETE USING (public.is_super_admin() OR public.has_permission('delete_orders'));

-- Banners
CREATE POLICY "Anyone can read active banners" ON public.banners FOR SELECT USING (is_active = true OR public.is_super_admin() OR public.has_permission('read_banners'));
CREATE POLICY "Authorized can create banners" ON public.banners FOR INSERT WITH CHECK (public.is_super_admin() OR public.has_permission('create_banners'));
CREATE POLICY "Authorized can update banners" ON public.banners FOR UPDATE USING (public.is_super_admin() OR public.has_permission('update_banners'));
CREATE POLICY "Authorized can delete banners" ON public.banners FOR DELETE USING (public.is_super_admin() OR public.has_permission('delete_banners'));

-- 15. Seed default roles
INSERT INTO public.roles (name, description) VALUES
  ('accounts', 'Accounts management role'),
  ('designer', 'Design and creative role'),
  ('operations', 'Operations management role');

-- 16. Seed default permissions
INSERT INTO public.permissions (name, description, feature, action) VALUES
  ('read_products', 'View products', 'products', 'read'),
  ('create_products', 'Create products', 'products', 'create'),
  ('update_products', 'Update products', 'products', 'update'),
  ('delete_products', 'Delete products', 'products', 'delete'),
  ('read_orders', 'View orders', 'orders', 'read'),
  ('create_orders', 'Create orders', 'orders', 'create'),
  ('update_orders', 'Update orders', 'orders', 'update'),
  ('delete_orders', 'Delete orders', 'orders', 'delete'),
  ('read_banners', 'View banners', 'banners', 'read'),
  ('create_banners', 'Create banners', 'banners', 'create'),
  ('update_banners', 'Update banners', 'banners', 'update'),
  ('delete_banners', 'Delete banners', 'banners', 'delete'),
  ('read_users', 'View users', 'users', 'read'),
  ('create_users', 'Create users', 'users', 'create'),
  ('update_users', 'Update users', 'users', 'update'),
  ('delete_users', 'Delete users', 'users', 'delete');

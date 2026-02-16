
-- 1. Seller-to-godown assignments (admin assigns sellers to area godowns)
CREATE TABLE public.seller_godown_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  godown_id uuid NOT NULL REFERENCES public.godowns(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(seller_id, godown_id)
);

ALTER TABLE public.seller_godown_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read seller godown assignments" ON public.seller_godown_assignments
  FOR SELECT USING (is_super_admin() OR has_permission('read_users') OR seller_id = auth.uid());

CREATE POLICY "Admin can insert seller godown assignments" ON public.seller_godown_assignments
  FOR INSERT WITH CHECK (is_super_admin() OR has_permission('update_users'));

CREATE POLICY "Admin can delete seller godown assignments" ON public.seller_godown_assignments
  FOR DELETE USING (is_super_admin() OR has_permission('update_users'));

-- 2. Extend orders table with seller fields
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_product_id uuid REFERENCES public.seller_products(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_delivery_staff_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS godown_id uuid REFERENCES public.godowns(id);

-- 3. Seller wallets
CREATE TABLE public.seller_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can read own wallet" ON public.seller_wallets
  FOR SELECT USING (seller_id = auth.uid() OR is_super_admin() OR has_permission('read_users'));

CREATE POLICY "System can insert wallets" ON public.seller_wallets
  FOR INSERT WITH CHECK (is_super_admin() OR seller_id = auth.uid());

CREATE POLICY "System can update wallets" ON public.seller_wallets
  FOR UPDATE USING (is_super_admin() OR has_permission('update_users'));

-- 4. Seller wallet transactions
CREATE TABLE public.seller_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.seller_wallets(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit', 'settlement')),
  amount numeric NOT NULL,
  description text,
  order_id uuid REFERENCES public.orders(id),
  settled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can read own transactions" ON public.seller_wallet_transactions
  FOR SELECT USING (seller_id = auth.uid() OR is_super_admin() OR has_permission('read_users'));

CREATE POLICY "System can insert transactions" ON public.seller_wallet_transactions
  FOR INSERT WITH CHECK (is_super_admin() OR has_permission('update_users'));

-- Triggers for updated_at
CREATE TRIGGER update_seller_wallets_updated_at
  BEFORE UPDATE ON public.seller_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update orders RLS to allow sellers to read their orders
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
CREATE POLICY "Users can read own orders" ON public.orders
  FOR SELECT USING (
    auth.uid() = user_id 
    OR auth.uid() = seller_id 
    OR is_super_admin() 
    OR has_permission('read_orders')
  );

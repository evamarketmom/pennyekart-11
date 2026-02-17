
-- Table to assign wards to delivery staff
CREATE TABLE public.delivery_staff_ward_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_user_id UUID NOT NULL,
  local_body_id UUID NOT NULL REFERENCES public.locations_local_bodies(id) ON DELETE CASCADE,
  ward_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_user_id, local_body_id, ward_number)
);

ALTER TABLE public.delivery_staff_ward_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage delivery ward assignments"
ON public.delivery_staff_ward_assignments
FOR ALL
USING (public.is_super_admin() OR public.has_permission('read_users'));

CREATE POLICY "Delivery staff can read own assignments"
ON public.delivery_staff_ward_assignments
FOR SELECT
USING (auth.uid() = staff_user_id);

-- Delivery staff wallets
CREATE TABLE public.delivery_staff_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_user_id UUID NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_staff_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read own wallet"
ON public.delivery_staff_wallets
FOR SELECT
USING (auth.uid() = staff_user_id);

CREATE POLICY "Admins can manage delivery wallets"
ON public.delivery_staff_wallets
FOR ALL
USING (public.is_super_admin() OR public.has_permission('read_users'));

-- Delivery staff wallet transactions
CREATE TABLE public.delivery_staff_wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.delivery_staff_wallets(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL DEFAULT 'credit',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_staff_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read own transactions"
ON public.delivery_staff_wallet_transactions
FOR SELECT
USING (auth.uid() = staff_user_id);

CREATE POLICY "Admins can manage delivery wallet transactions"
ON public.delivery_staff_wallet_transactions
FOR ALL
USING (public.is_super_admin() OR public.has_permission('read_users'));

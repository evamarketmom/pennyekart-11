
-- Add self-delivery flag to orders
ALTER TABLE public.orders ADD COLUMN is_self_delivery boolean NOT NULL DEFAULT false;

-- Remove duplicate triggers on orders table (keeping the trg_ prefixed ones)
DROP TRIGGER IF EXISTS credit_wallet_points_on_delivery ON public.orders;
DROP TRIGGER IF EXISTS restore_stock_on_return_trigger ON public.orders;
DROP TRIGGER IF EXISTS auto_assign_delivery_on_order ON public.orders;
DROP TRIGGER IF EXISTS trigger_auto_assign_delivery ON public.orders;
DROP TRIGGER IF EXISTS trigger_deduct_stock_on_delivery ON public.orders;
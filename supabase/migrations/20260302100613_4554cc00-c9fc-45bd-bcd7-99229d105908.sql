
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_assign_delivery_staff') THEN
    CREATE TRIGGER trg_auto_assign_delivery_staff BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auto_assign_delivery_staff();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_deduct_stock_on_delivery') THEN
    CREATE TRIGGER trg_deduct_stock_on_delivery BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_delivery();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_restore_stock_on_return') THEN
    CREATE TRIGGER trg_restore_stock_on_return BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_return();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_credit_seller_wallet_on_delivery') THEN
    CREATE TRIGGER trg_credit_seller_wallet_on_delivery AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.credit_seller_wallet_on_delivery();
  END IF;
END$$;

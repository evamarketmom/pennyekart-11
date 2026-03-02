
CREATE TRIGGER trg_credit_wallet_points_on_delivery
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_wallet_points_on_delivery();

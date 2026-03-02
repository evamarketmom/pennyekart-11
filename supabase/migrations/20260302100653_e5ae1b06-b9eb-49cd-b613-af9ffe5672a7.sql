
-- Manually create wallet for customer and credit 5 points for order 70d3bffa
DO $$
DECLARE
  _wallet_id uuid;
BEGIN
  -- Create wallet if not exists
  INSERT INTO public.customer_wallets (customer_user_id, balance)
  VALUES ('152415e9-a6b8-4c14-8321-7cc81914e0da', 5)
  ON CONFLICT (customer_user_id) DO UPDATE SET balance = customer_wallets.balance + 5, updated_at = now()
  RETURNING id INTO _wallet_id;

  -- Insert transaction record
  INSERT INTO public.customer_wallet_transactions (wallet_id, customer_user_id, order_id, type, amount, description)
  VALUES (_wallet_id, '152415e9-a6b8-4c14-8321-7cc81914e0da', '70d3bffa-19a9-42d6-8a4f-13d7458594c0', 'credit', 5, 'Wallet points earned from order delivery: ₹5');
END$$;

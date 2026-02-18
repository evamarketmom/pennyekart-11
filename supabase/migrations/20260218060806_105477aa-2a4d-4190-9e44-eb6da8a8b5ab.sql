
-- Function to credit seller wallets when an order is delivered
CREATE OR REPLACE FUNCTION public.credit_seller_wallet_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item jsonb;
  _product_id uuid;
  _qty int;
  _seller_id uuid;
  _purchase_rate numeric;
  _credit_amount numeric;
  _wallet record;
BEGIN
  -- Only fire when status changes TO 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN

    -- Loop through order items
    FOR _item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      _product_id := (_item->>'id')::uuid;
      _qty := COALESCE((_item->>'quantity')::int, 1);

      -- Check if item is a seller product
      SELECT sp.seller_id, sp.purchase_rate
        INTO _seller_id, _purchase_rate
      FROM public.seller_products sp
      WHERE sp.id = _product_id;

      IF _seller_id IS NOT NULL THEN
        _credit_amount := _purchase_rate * _qty;

        -- Get or create seller wallet
        SELECT * INTO _wallet FROM public.seller_wallets WHERE seller_id = _seller_id FOR UPDATE;

        IF NOT FOUND THEN
          INSERT INTO public.seller_wallets (seller_id, balance)
          VALUES (_seller_id, 0)
          ON CONFLICT DO NOTHING
          RETURNING * INTO _wallet;

          -- Re-select in case of race
          IF _wallet IS NULL THEN
            SELECT * INTO _wallet FROM public.seller_wallets WHERE seller_id = _seller_id FOR UPDATE;
          END IF;
        END IF;

        IF _wallet IS NOT NULL THEN
          -- Credit wallet balance
          UPDATE public.seller_wallets
          SET balance = balance + _credit_amount
          WHERE id = _wallet.id;

          -- Insert credit transaction
          INSERT INTO public.seller_wallet_transactions (
            wallet_id, seller_id, order_id, type, amount, description
          ) VALUES (
            _wallet.id,
            _seller_id,
            NEW.id,
            'credit',
            _credit_amount,
            'Order delivered: ₹' || _credit_amount || ' for ' || _qty || ' unit(s) of product'
          );
        END IF;

        -- Reset for next item
        _seller_id := NULL;
        _purchase_rate := NULL;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_credit_seller_wallet_on_delivery ON public.orders;

-- Create trigger on orders table
CREATE TRIGGER trg_credit_seller_wallet_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_seller_wallet_on_delivery();

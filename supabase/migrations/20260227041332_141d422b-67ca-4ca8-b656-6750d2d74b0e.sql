
-- Function to restore stock when a return is confirmed (after delivery)
-- Stock is only restored when delivery/selling partner confirms the return
CREATE OR REPLACE FUNCTION public.restore_stock_on_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _item jsonb;
  _product_id uuid;
  _qty int;
  _godown_id uuid;
  _target_stock_id uuid;
BEGIN
  -- Only fire when status changes TO 'return_confirmed'
  IF NEW.status = 'return_confirmed' AND OLD.status IS DISTINCT FROM 'return_confirmed' THEN
    _godown_id := NEW.godown_id;
    
    FOR _item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      _product_id := (_item->>'id')::uuid;
      _qty := COALESCE((_item->>'quantity')::int, 1);
      
      -- Restore seller product stock
      IF EXISTS (SELECT 1 FROM public.seller_products WHERE id = _product_id) THEN
        UPDATE public.seller_products 
        SET stock = stock + _qty 
        WHERE id = _product_id;
      
      -- Restore godown stock
      ELSIF _godown_id IS NOT NULL THEN
        SELECT id INTO _target_stock_id
        FROM public.godown_stock 
        WHERE godown_id = _godown_id AND product_id = _product_id
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF _target_stock_id IS NOT NULL THEN
          UPDATE public.godown_stock 
          SET quantity = quantity + _qty, updated_at = now()
          WHERE id = _target_stock_id;
        ELSE
          INSERT INTO public.godown_stock (godown_id, product_id, quantity, purchase_price)
          VALUES (_godown_id, _product_id, _qty, 0);
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for stock restoration on return confirmation
CREATE TRIGGER restore_stock_on_return_trigger
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_return();

-- Update orders UPDATE RLS policy to allow customers to cancel/request returns on own orders
DROP POLICY IF EXISTS "Authorized can update orders" ON public.orders;
CREATE POLICY "Authorized can update orders"
ON public.orders
FOR UPDATE
USING (
  (auth.uid() = user_id) OR
  (auth.uid() = assigned_delivery_staff_id) OR
  (auth.uid() = seller_id) OR
  is_super_admin() OR
  has_permission('update_orders'::text)
);

-- Drop and recreate the update policy to include seller_id
DROP POLICY IF EXISTS "Authorized can update orders" ON public.orders;

CREATE POLICY "Authorized can update orders"
ON public.orders
FOR UPDATE
USING (
  (auth.uid() = assigned_delivery_staff_id)
  OR (auth.uid() = seller_id)
  OR is_super_admin()
  OR has_permission('update_orders'::text)
);
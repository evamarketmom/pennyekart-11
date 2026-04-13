
-- Fix existing data: unapprove all seller products where the partner is unapproved
UPDATE public.seller_products sp
SET is_approved = false
FROM public.profiles p
WHERE p.user_id = sp.seller_id
  AND p.is_approved = false
  AND sp.is_approved = true;

-- Drop old trigger
DROP TRIGGER IF EXISTS on_partner_unapproval ON public.profiles;

-- Replace function to handle both directions
CREATE OR REPLACE FUNCTION public.cascade_partner_approval_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_type = 'selling_partner' 
     AND OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
    UPDATE public.seller_products
    SET is_approved = NEW.is_approved
    WHERE seller_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old function if exists
DROP FUNCTION IF EXISTS public.cascade_partner_unapproval();

-- Create new trigger
CREATE TRIGGER on_partner_approval_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_partner_approval_change();

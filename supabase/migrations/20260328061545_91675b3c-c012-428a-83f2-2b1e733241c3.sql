
CREATE OR REPLACE FUNCTION public.sync_category_margin_to_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.margin_percentage IS DISTINCT FROM OLD.margin_percentage THEN
    UPDATE public.products
    SET margin_percentage = NEW.margin_percentage, updated_at = now()
    WHERE category = NEW.name;

    UPDATE public.seller_products
    SET margin_percentage = NEW.margin_percentage, updated_at = now()
    WHERE category = NEW.name;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.products
    SET category = NEW.name, updated_at = now()
    WHERE category = OLD.name;

    UPDATE public.seller_products
    SET category = NEW.name, updated_at = now()
    WHERE category = OLD.name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_category_update_sync_products
  AFTER UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_category_margin_to_products();

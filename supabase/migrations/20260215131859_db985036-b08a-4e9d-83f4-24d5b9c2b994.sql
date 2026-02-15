
CREATE TABLE public.purchase_counter (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read purchase_counter"
ON public.purchase_counter FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update purchase_counter"
ON public.purchase_counter FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Insert initial row
INSERT INTO public.purchase_counter (last_number) VALUES (0);

-- Atomic function to get next purchase number
CREATE OR REPLACE FUNCTION public.get_next_purchase_number()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  UPDATE public.purchase_counter
  SET last_number = last_number + 1, updated_at = now()
  RETURNING last_number INTO next_num;
  RETURN next_num;
END;
$$;

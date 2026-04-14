
-- Step 1: Add column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_id text;

-- Step 2: Backfill
UPDATE public.profiles
SET customer_id = 'CID' 
  || COALESCE(RIGHT(mobile_number, 4), '0000')
  || UPPER(COALESCE(LEFT(full_name, 1), 'X'))
WHERE user_type = 'customer' AND customer_id IS NULL;

-- Step 3: Deduplicate
DO $$
DECLARE
  r RECORD;
  counter INT;
BEGIN
  FOR r IN 
    SELECT customer_id, array_agg(id ORDER BY created_at) as ids
    FROM public.profiles
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    FOR i IN 2..array_length(r.ids, 1) LOOP
      UPDATE public.profiles 
      SET customer_id = r.customer_id || counter
      WHERE id = r.ids[i];
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Step 4: Unique index after dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_customer_id ON public.profiles (customer_id) WHERE customer_id IS NOT NULL;

-- Step 5: Auto-generate function
CREATE OR REPLACE FUNCTION public.generate_customer_id()
RETURNS trigger AS $$
DECLARE
  base_id text;
  final_id text;
  suffix int := 0;
BEGIN
  IF NEW.user_type = 'customer' AND NEW.customer_id IS NULL THEN
    base_id := 'CID' 
      || COALESCE(RIGHT(NEW.mobile_number, 4), '0000')
      || UPPER(COALESCE(LEFT(NEW.full_name, 1), 'X'));
    
    final_id := base_id;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE customer_id = final_id AND id != NEW.id) LOOP
      suffix := suffix + 1;
      final_id := base_id || suffix;
    END LOOP;
    
    NEW.customer_id := final_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 6: Trigger
DROP TRIGGER IF EXISTS on_generate_customer_id ON public.profiles;
CREATE TRIGGER on_generate_customer_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_customer_id();

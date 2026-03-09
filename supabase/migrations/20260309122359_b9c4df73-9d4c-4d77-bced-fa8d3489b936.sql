
-- Update handle_new_user to pass referred_by
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _customer_role_id uuid;
  _referred_by_id uuid;
BEGIN
  -- Get customer role id
  SELECT id INTO _customer_role_id FROM public.roles WHERE name = 'customer';

  -- Resolve referred_by
  _referred_by_id := NULLIF(NEW.raw_user_meta_data->>'referred_by', '')::uuid;

  INSERT INTO public.profiles (user_id, email, full_name, mobile_number, date_of_birth, user_type, local_body_id, ward_number, is_approved, role_id, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'mobile_number',
    (NEW.raw_user_meta_data->>'date_of_birth')::date,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer'),
    NULLIF(NEW.raw_user_meta_data->>'local_body_id', '')::uuid,
    NULLIF(NEW.raw_user_meta_data->>'ward_number', '')::integer,
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer') = 'customer' THEN true ELSE false END,
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer') = 'customer' THEN _customer_role_id ELSE NULL END,
    _referred_by_id
  );
  RETURN NEW;
END;
$$;

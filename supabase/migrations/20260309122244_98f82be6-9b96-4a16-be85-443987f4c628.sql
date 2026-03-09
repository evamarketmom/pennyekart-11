
-- Add referral columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);

-- Generate referral codes for existing customers
UPDATE public.profiles 
SET referral_code = upper(substr(md5(user_id::text || created_at::text), 1, 8))
WHERE user_type = 'customer' AND referral_code IS NULL;

-- Function to generate referral code on new profile
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_type = 'customer' AND NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(NEW.user_id::text || now()::text || random()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.profiles;
CREATE TRIGGER trigger_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Function to credit referral bonus
CREATE OR REPLACE FUNCTION public.credit_referral_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _enabled text;
  _amount numeric;
  _referrer_wallet record;
  _referrer_profile record;
BEGIN
  -- Only for new customer profiles with a referred_by
  IF NEW.user_type = 'customer' AND NEW.referred_by IS NOT NULL THEN
    SELECT value INTO _enabled FROM public.app_settings WHERE key = 'wallet_rule_referral_enabled';
    IF _enabled = 'true' THEN
      SELECT value INTO _amount FROM public.app_settings WHERE key = 'wallet_rule_referral_amount';
      _amount := COALESCE(_amount::numeric, 0);
      IF _amount > 0 THEN
        -- Get referrer's user_id from profile
        SELECT * INTO _referrer_profile FROM public.profiles WHERE id = NEW.referred_by;
        IF _referrer_profile IS NOT NULL THEN
          SELECT * INTO _referrer_wallet FROM public.customer_wallets WHERE customer_user_id = _referrer_profile.user_id;
          IF _referrer_wallet IS NOT NULL THEN
            UPDATE public.customer_wallets SET balance = balance + _amount, updated_at = now() WHERE id = _referrer_wallet.id;
            INSERT INTO public.customer_wallet_transactions (wallet_id, customer_user_id, type, amount, description)
            VALUES (_referrer_wallet.id, _referrer_profile.user_id, 'credit', _amount, 'Referral bonus: Friend ' || COALESCE(NEW.full_name, 'someone') || ' joined via your invite link');
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_credit_referral_bonus ON public.profiles;
CREATE TRIGGER trigger_credit_referral_bonus
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_referral_bonus();

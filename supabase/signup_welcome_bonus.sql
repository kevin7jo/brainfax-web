-- Signup welcome bonus: 10 BFAX Queue (lib/signupBonus.ts SIGNUP_WELCOME_BFAX 와 동일)
-- Supabase SQL Editor에서 실행. 기존 20 BFAX 트리거/함수가 있으면 이 스크립트로 교체됩니다.

CREATE OR REPLACE FUNCTION public.handle_new_user_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lb_user_balance (customer_email, bfax_queue, account_status)
  VALUES (trim(NEW.email), 10, 'ACTIVE')
  ON CONFLICT (customer_email) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_balance ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_auth_user_balance ON auth.users;

CREATE TRIGGER on_auth_user_created_balance
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_balance();

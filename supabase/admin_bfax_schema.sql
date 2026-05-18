-- BrainFax Admin: BFAX 장부 및 계정 상태 (Supabase SQL Editor에서 실행)
-- lb_user_balance는 기존 bfax_queue 컬럼을 사용합니다. bfax_amount는 동기화용 별칭입니다.

ALTER TABLE public.lb_user_balance
  ADD COLUMN IF NOT EXISTS bfax_amount integer,
  ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'ACTIVE';

UPDATE public.lb_user_balance
SET bfax_amount = bfax_queue
WHERE bfax_amount IS NULL AND bfax_queue IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lb_recharge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  bfax_amount integer NOT NULL DEFAULT 0,
  balance_after integer,
  status text NOT NULL,
  note text,
  admin_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lb_recharge_history_email ON public.lb_recharge_history (customer_email);
CREATE INDEX IF NOT EXISTS idx_lb_recharge_history_status ON public.lb_recharge_history (status);

ALTER TABLE public.lb_recharge_history ENABLE ROW LEVEL SECURITY;

-- 서비스 롤 API 사용 시 RLS 우회. 클라이언트 직접 접근 시 어드민만 허용하려면:
-- CREATE POLICY admin_recharge_all ON public.lb_recharge_history
--   FOR ALL TO authenticated
--   USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

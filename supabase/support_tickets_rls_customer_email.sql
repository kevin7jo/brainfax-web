-- My Support (authenticated) RLS — customer_email / sender_email 스키마
-- Supabase SQL Editor에서 실행 후 기존 user_email 전용 정책은 제거하거나 OR 로 병합하세요.

ALTER TABLE public.lb_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lb_ticket_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_select_own ON public.lb_support_tickets;
CREATE POLICY support_tickets_select_own ON public.lb_support_tickets
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR lower(customer_email) = lower(auth.jwt() ->> 'email')
  );

-- 레거시 user_email 컬럼이 남아 있으면 USING 에 추가:
-- OR lower(user_email) = lower(auth.jwt() ->> 'email')

DROP POLICY IF EXISTS ticket_replies_select_own ON public.lb_ticket_replies;
CREATE POLICY ticket_replies_select_own ON public.lb_ticket_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lb_support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR lower(t.customer_email) = lower(auth.jwt() ->> 'email')
        )
    )
  );

DROP POLICY IF EXISTS ticket_replies_insert_user ON public.lb_ticket_replies;
CREATE POLICY ticket_replies_insert_user ON public.lb_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'USER'
    AND EXISTS (
      SELECT 1 FROM public.lb_support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR lower(t.customer_email) = lower(auth.jwt() ->> 'email')
        )
    )
  );

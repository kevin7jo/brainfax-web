-- Omnichannel Helpdesk (Supabase SQL Editor)
-- lb_support_tickets + lb_ticket_replies + RLS

CREATE TABLE IF NOT EXISTS public.lb_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  user_email text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lb_support_tickets_user_id ON public.lb_support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_lb_support_tickets_user_email ON public.lb_support_tickets (user_email);
CREATE INDEX IF NOT EXISTS idx_lb_support_tickets_status ON public.lb_support_tickets (status);

CREATE TABLE IF NOT EXISTS public.lb_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.lb_support_tickets (id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('USER', 'ADMIN')),
  email text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lb_ticket_replies_ticket_id ON public.lb_ticket_replies (ticket_id);

ALTER TABLE public.lb_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lb_ticket_replies ENABLE ROW LEVEL SECURITY;

-- 본인 티켓만 조회
CREATE POLICY support_tickets_select_own ON public.lb_support_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR lower(user_email) = lower(auth.jwt() ->> 'email'));

-- 본인 티켓의 답변만 조회
CREATE POLICY ticket_replies_select_own ON public.lb_ticket_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lb_support_tickets t
      WHERE t.id = ticket_id
        AND (t.user_id = auth.uid() OR lower(t.user_email) = lower(auth.jwt() ->> 'email'))
    )
  );

-- 유저 추가 코멘트 Insert (대시보드)
CREATE POLICY ticket_replies_insert_user ON public.lb_ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'USER'
    AND lower(email) = lower(auth.jwt() ->> 'email')
    AND EXISTS (
      SELECT 1 FROM public.lb_support_tickets t
      WHERE t.id = ticket_id
        AND (t.user_id = auth.uid() OR lower(t.user_email) = lower(auth.jwt() ->> 'email'))
    )
  );

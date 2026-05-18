export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type TicketSenderType = 'USER' | 'ADMIN';

export type SupportTicket = {
  id: string;
  ticket_number: string;
  title: string;
  body: string;
  status: TicketStatus;
  user_email: string;
  user_id: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type TicketReply = {
  id: string;
  ticket_id: string;
  sender_type: TicketSenderType;
  email: string;
  content: string;
  created_at: string;
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
};

export function normalizeTicketStatus(raw: string | null | undefined): TicketStatus {
  const s = (raw ?? '').toUpperCase();
  if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') return 'IN_PROGRESS';
  if (s === 'RESOLVED' || s === 'CLOSED') return 'RESOLVED';
  return 'OPEN';
}

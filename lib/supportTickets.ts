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

/** DB가 ticket_no·customer_email·content 또는 레거시 ticket_number·user_email·body 인 경우 모두 수용 */
export function normalizeSupportTicketFromRow(row: Record<string, unknown>): SupportTicket | null {
  if (row.id == null || row.title == null) return null;
  const ticket_number = String(row.ticket_no ?? row.ticket_number ?? row.id);
  const body = String(row.content ?? row.body ?? '');
  const user_email = String(row.customer_email ?? row.user_email ?? '');
  return {
    id: String(row.id),
    ticket_number,
    title: String(row.title),
    body,
    status: normalizeTicketStatus(row.status as string),
    user_id: row.user_id != null ? String(row.user_id) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

/** 답변: sender_email 또는 레거시 email */
export function normalizeTicketReplyFromRow(row: Record<string, unknown>): TicketReply | null {
  if (row.id == null || row.ticket_id == null || row.content == null || row.created_at == null) return null;
  const st = String(row.sender_type ?? '').toUpperCase();
  return {
    id: String(row.id),
    ticket_id: String(row.ticket_id),
    sender_type: st === 'ADMIN' ? 'ADMIN' : 'USER',
    email: String(row.sender_email ?? row.email ?? ''),
    content: String(row.content),
    created_at: String(row.created_at),
  };
}

/**
 * Admin Support — lb_support_tickets / lb_ticket_replies
 * 프로덕션 DDL의 ticket_no·customer_email·content·sender_email 과
 * 레거시 ticket_number·user_email·body·email 을 run-time 정규화로 모두 수용.
 */

export type AdminTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type AdminTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type AdminSupportTicket = {
  id: string;
  ticket_no: string;
  customer_email: string;
  title: string;
  content: string;
  status: AdminTicketStatus;
  priority: AdminTicketPriority;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminTicketReply = {
  id: string;
  ticket_id: string;
  sender_type: 'USER' | 'ADMIN';
  sender_email: string;
  content: string;
  created_at: string;
};

const STATUS_SET: ReadonlySet<string> = new Set([
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]);

const PRIORITY_SET: ReadonlySet<string> = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export function normalizeAdminTicketStatus(raw: string | null | undefined): AdminTicketStatus {
  const s = String(raw ?? 'OPEN').toUpperCase().replace(/\s+/g, '_');
  if (s === 'IN_PROGRESS' || s === 'INPROGRESS') return 'IN_PROGRESS';
  if (STATUS_SET.has(s)) return s as AdminTicketStatus;
  return 'OPEN';
}

export function normalizeAdminTicketPriority(raw: string | null | undefined): AdminTicketPriority {
  const p = String(raw ?? 'MEDIUM').toUpperCase();
  if (PRIORITY_SET.has(p)) return p as AdminTicketPriority;
  return 'MEDIUM';
}

export function normalizeAdminTicketRow(row: Record<string, unknown>): AdminSupportTicket | null {
  if (row.id == null) return null;
  const ticket_no = row.ticket_no ?? row.ticket_number;
  const customer_email = row.customer_email ?? row.user_email;
  const content = row.content ?? row.body;
  if (ticket_no == null || customer_email == null || row.title == null || content == null) {
    return null;
  }
  return {
    id: String(row.id),
    ticket_no: String(ticket_no),
    customer_email: String(customer_email),
    title: String(row.title),
    content: String(content),
    status: normalizeAdminTicketStatus(row.status as string),
    priority: normalizeAdminTicketPriority(row.priority as string),
    user_id: row.user_id != null ? String(row.user_id) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? row.created_at ?? ''),
  };
}

export function normalizeAdminReplyRow(row: Record<string, unknown>): AdminTicketReply | null {
  if (row.id == null || row.ticket_id == null || row.content == null || row.created_at == null) return null;
  const st = String(row.sender_type ?? '').toUpperCase();
  const sender_type = st === 'ADMIN' ? 'ADMIN' : 'USER';
  const sender_email = String(row.sender_email ?? row.email ?? '');
  return {
    id: String(row.id),
    ticket_id: String(row.ticket_id),
    sender_type,
    sender_email,
    content: String(row.content),
    created_at: String(row.created_at),
  };
}

export function nextAdminStatusAfterReply(
  current: AdminTicketStatus,
  chosen: AdminTicketStatus | null | undefined
): AdminTicketStatus {
  if (chosen && STATUS_SET.has(chosen)) {
    return chosen;
  }
  if (current === 'OPEN') return 'IN_PROGRESS';
  if (current === 'CLOSED') return 'CLOSED';
  return current === 'RESOLVED' ? 'RESOLVED' : 'IN_PROGRESS';
}

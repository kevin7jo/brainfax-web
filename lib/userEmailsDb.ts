import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserEmailRow } from './userEmails';
import { generateEmailOtp, getOtpExpiresAt, normalizeEmail } from './userEmails';

export async function upsertPendingUserEmail(
  db: SupabaseClient,
  params: { userId: string; email: string }
): Promise<{ row: UserEmailRow; otp: string; expiresAt: string }> {
  const email = normalizeEmail(params.email);
  const otp = generateEmailOtp();
  const expiresAt = getOtpExpiresAt();

  const { data, error } = await db
    .from('lb_user_emails')
    .upsert(
      {
        user_id: params.userId,
        email,
        is_verified: false,
        verification_code: otp,
        code_expires_at: expiresAt,
      },
      { onConflict: 'user_id,email' }
    )
    .select('id, user_id, email, is_verified, verification_code, code_expires_at, created_at')
    .single();

  if (error) throw new Error(error.message);
  return { row: data as UserEmailRow, otp, expiresAt };
}

export async function findUserEmailForVerification(
  db: SupabaseClient,
  params: { userId: string; email: string }
): Promise<UserEmailRow | null> {
  const { data, error } = await db
    .from('lb_user_emails')
    .select('id, user_id, email, is_verified, verification_code, code_expires_at, created_at')
    .eq('user_id', params.userId)
    .eq('email', normalizeEmail(params.email))
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as UserEmailRow | null) ?? null;
}

export async function markUserEmailVerified(
  db: SupabaseClient,
  params: { userId: string; email: string }
): Promise<UserEmailRow> {
  const { data, error } = await db
    .from('lb_user_emails')
    .update({
      is_verified: true,
      verification_code: null,
      code_expires_at: null,
    })
    .eq('user_id', params.userId)
    .eq('email', normalizeEmail(params.email))
    .select('id, user_id, email, is_verified, verification_code, code_expires_at, created_at')
    .single();

  if (error) throw new Error(error.message);
  return data as UserEmailRow;
}

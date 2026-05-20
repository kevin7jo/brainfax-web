import { redirect } from 'next/navigation';
import { ADMIN_CONSOLE_PATH } from '../../lib/admin';

export default function AdminIndexPage() {
  redirect(`${ADMIN_CONSOLE_PATH}/audit`);
}

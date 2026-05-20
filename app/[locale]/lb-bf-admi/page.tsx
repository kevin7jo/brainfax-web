import { redirect } from '../../../i18n/navigation';
import { ADMIN_CONSOLE_PATH } from '../../../lib/admin';
import type { AppLocale } from '../../../i18n/routing';

export default function AdminIndexPage({ params }: { params: { locale: string } }) {
  redirect({ href: `${ADMIN_CONSOLE_PATH}/audit`, locale: params.locale as AppLocale });
}

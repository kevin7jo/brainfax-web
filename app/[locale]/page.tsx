import { redirect } from '../../i18n/navigation';
import type { AppLocale } from '../../i18n/routing';

export default function LocaleRootPage({ params }: { params: { locale: string } }) {
  redirect({ href: '/login', locale: params.locale as AppLocale });
}

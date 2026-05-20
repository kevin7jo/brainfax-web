'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

/**
 * next-intl은 루트 layout에서 동적 lang을 권장하지 않으므로,
 * 클라이언트에서 document.documentElement.lang만 현재 로케일과 동기화합니다.
 */
export function LocaleHtmlAttributes() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

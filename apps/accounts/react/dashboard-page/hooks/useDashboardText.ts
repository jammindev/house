import { useTranslation } from 'react-i18next';

import type { DashboardTextResolver } from '../types';

export function useDashboardText(): DashboardTextResolver {
  const { t } = useTranslation();

  return (key, fallback, params) => {
    if (!key) {
      return fallback;
    }

    return t(key, { defaultValue: fallback, ...params });
  };
}

import { useTranslation } from 'react-i18next';

import PageHeader from '@/components/PageHeader';
import TrackersPanel from './TrackersPanel';

export default function TrackersPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('trackers.title')} description={t('trackers.subtitle')} />
      <TrackersPanel />
    </div>
  );
}

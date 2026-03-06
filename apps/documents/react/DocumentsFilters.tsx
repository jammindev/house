import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';

interface DocumentsFiltersProps {
  unlinkedOnly: boolean;
  onToggle: (value: boolean) => void;
  totalCount: number;
  unlinkedCount: number;
}

export default function DocumentsFilters({
  unlinkedOnly,
  onToggle,
  totalCount,
  unlinkedCount,
}: DocumentsFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">
          {t('documents.count.all', { count: totalCount, defaultValue: '{{count}} documents' })}
        </p>
        <p className="text-xs text-gray-500">
          {t('documents.count.unlinked', {
            count: unlinkedCount,
            defaultValue: '{{count}} not linked to an interaction',
          })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={unlinkedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToggle(!unlinkedOnly)}
          className="min-w-[10rem]"
        >
          {unlinkedOnly
            ? t('documents.filter.unlinkedActive', { defaultValue: 'Showing unlinked' })
            : t('documents.filter.unlinked', { defaultValue: 'Show unlinked only' })}
        </Button>
      </div>
    </div>
  );
}

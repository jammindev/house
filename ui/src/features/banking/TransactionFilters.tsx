import { useTranslation } from 'react-i18next';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { FilterPill } from '@/design-system/filter-pill';
import type { BankAccount, TransactionFilters as Filters } from '@/lib/api/banking';

interface TransactionFiltersProps {
  filters: Filters;
  accounts: BankAccount[];
  onChange: (next: Filters) => void;
}

export default function TransactionFilters({
  filters,
  accounts,
  onChange,
}: TransactionFiltersProps) {
  const { t } = useTranslation();

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3 pb-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="search"
          value={filters.q ?? ''}
          onChange={(e) => set('q', e.target.value)}
          placeholder={t('banking.journal.searchPlaceholder')}
          aria-label={t('banking.journal.search')}
        />

        <Select
          value={filters.account ?? ''}
          onChange={(e) => set('account', e.target.value)}
          aria-label={t('banking.journal.filterAccount')}
          options={[
            { value: '', label: t('banking.journal.allAccounts') },
            ...accounts.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="date"
          value={filters.date_from ?? ''}
          onChange={(e) => set('date_from', e.target.value)}
          aria-label={t('banking.journal.dateFrom')}
        />
        <Input
          type="date"
          value={filters.date_to ?? ''}
          onChange={(e) => set('date_to', e.target.value)}
          aria-label={t('banking.journal.dateTo')}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterPill active={!filters.direction} onClick={() => set('direction', '')}>
          {t('banking.journal.all')}
        </FilterPill>
        <FilterPill
          active={filters.direction === 'out'}
          onClick={() => set('direction', 'out')}
        >
          {t('banking.journal.outflow')}
        </FilterPill>
        <FilterPill active={filters.direction === 'in'} onClick={() => set('direction', 'in')}>
          {t('banking.journal.inflow')}
        </FilterPill>
        <FilterPill
          active={filters.is_internal === 'true'}
          onClick={() =>
            set('is_internal', filters.is_internal === 'true' ? '' : 'true')
          }
        >
          {t('banking.journal.internal')}
        </FilterPill>
        {/* Le compagnon du marqueur de ligne : il dit depuis #413 ce qu'il reste
            à ranger, sans qu'on puisse s'y rendre. Sur 160 lignes, c'est la
            différence entre un reproche et une file de travail. */}
        <FilterPill
          active={filters.allocation === 'todo'}
          onClick={() => set('allocation', filters.allocation === 'todo' ? '' : 'todo')}
        >
          {t('banking.journal.toSortOut')}
        </FilterPill>
      </div>
    </div>
  );
}

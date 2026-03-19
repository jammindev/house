import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';

interface TaskItemPickerProps<T> {
  title: string;
  items: T[];
  isLoading: boolean;
  getLabel: (item: T) => string;
  getSublabel?: (item: T) => string;
  getId: (item: T) => string | number;
  onSelect: (item: T) => void;
  onClose: () => void;
  alreadyLinkedIds: Array<string | number>;
  emptyText?: string;
}

export default function TaskItemPicker<T>({
  title,
  items,
  isLoading,
  getLabel,
  getSublabel,
  getId,
  onSelect,
  onClose,
  alreadyLinkedIds,
  emptyText,
}: TaskItemPickerProps<T>) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');

  const linkedSet = React.useMemo(
    () => new Set(alreadyLinkedIds.map(String)),
    [alreadyLinkedIds],
  );

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      const label = getLabel(item).toLowerCase();
      const sub = getSublabel ? getSublabel(item).toLowerCase() : '';
      return label.includes(q) || sub.includes(q);
    });
  }, [items, search, getLabel, getSublabel]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="pl-8"
          autoFocus
        />
      </div>

      <div className="max-h-60 overflow-y-auto rounded-md border">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {emptyText ?? t('common.noResults')}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((item) => {
              const id = getId(item);
              const isLinked = linkedSet.has(String(id));
              return (
                <li key={String(id)}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start gap-2 rounded-none px-3 py-2 text-left"
                    disabled={isLinked}
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{getLabel(item)}</span>
                      {getSublabel ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {getSublabel(item)}
                        </span>
                      ) : null}
                    </span>
                    {isLinked ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t('common.linked')}
                      </span>
                    ) : null}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

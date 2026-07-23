import { useTranslation } from 'react-i18next';
import { Plus, Sparkles, X } from 'lucide-react';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import type { ShoppingSuggestion } from '@/lib/api/shopping';
import { useAddStockItemToList, useDismissSuggestion, useShoppingSuggestions } from './hooks';

function trimZeros(value: string | null): string | null {
  if (!value) return null;
  return String(Number(value));
}

/**
 * Lot 3 — a "Suggestions" section proposing low/out-of-stock items not already
 * on the list. Each can be added (deduped) or dismissed until the next depletion.
 */
export default function ShoppingSuggestions() {
  const { t } = useTranslation();
  const { data: suggestions = [] } = useShoppingSuggestions();
  const addToList = useAddStockItemToList();
  const dismiss = useDismissSuggestion();

  if (suggestions.length === 0) return null;

  function add(s: ShoppingSuggestion) {
    const qty = s.suggested_quantity ? Number(s.suggested_quantity) : undefined;
    addToList.mutate({ stockItemId: s.id, quantity: qty });
  }

  function addAll() {
    for (const s of suggestions) add(s);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          {t('shoppingList.suggestions.title', { count: suggestions.length })}
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={addAll} disabled={addToList.isPending}>
          {t('shoppingList.suggestions.addAll')}
        </Button>
      </div>

      <div className="space-y-2">
        {suggestions.map((s) => {
          const qty = trimZeros(s.suggested_quantity);
          return (
            <Card key={s.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  {s.category_emoji ? <span aria-hidden>{s.category_emoji}</span> : null}
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(`shoppingList.suggestions.reason.${s.status}`)}
                  {qty ? ` · ${t('shoppingList.suggestions.suggestedQty', { qty, unit: s.unit })}` : ''}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => add(s)}
                disabled={addToList.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('shoppingList.suggestions.add')}
              </Button>
              <button
                type="button"
                onClick={() => dismiss.mutate(s.id)}
                aria-label={t('shoppingList.suggestions.dismiss', { name: s.name })}
                className="shrink-0 rounded p-1 text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

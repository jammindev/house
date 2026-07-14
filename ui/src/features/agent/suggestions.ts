import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDisabledModules } from '@/lib/modules';

/**
 * Starter questions for the empty agent screen, adapted to the household's
 * active modules (parcours 15). Each entry names the module that gives it
 * meaning: when that module is disabled, the suggestion is dropped so we never
 * propose "combien d'œufs…" to a foyer without the chickens module.
 *
 * `module: null` = always relevant (works whatever the modules). The list is
 * ordered by priority: we keep the first `limit` still-enabled suggestions, so
 * the mix stays stable across renders (no random reshuffle).
 *
 * The text lives in i18n under `agent.suggestions.*` — the value IS the question
 * submitted verbatim when the chip is clicked.
 */
const SUGGESTIONS: { key: string; module: string | null }[] = [
  { key: 'tasks_due', module: 'tasks' },
  { key: 'last_expense', module: 'expenses' },
  { key: 'equipment_warranty', module: 'equipment' },
  { key: 'electricity_trend', module: 'electricity' },
  { key: 'eggs_this_week', module: 'chickens' },
  { key: 'stock_low', module: 'stock' },
  { key: 'find_document', module: 'documents' },
  { key: 'project_cost', module: 'projects' },
];

/** Up to `limit` starter questions relevant to the foyer's enabled modules. */
export function useAgentSuggestions(limit = 4): string[] {
  const { t } = useTranslation();
  const { disabled } = useDisabledModules();

  return React.useMemo(
    () =>
      SUGGESTIONS.filter((s) => s.module === null || !disabled.has(s.module))
        .slice(0, limit)
        .map((s) => t(`agent.suggestions.${s.key}`)),
    [disabled, limit, t],
  );
}

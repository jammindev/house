import * as React from 'react';
import { Plus, Tag as TagIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/design-system/input';
import { fetchTags, type TagOption, type TagType } from '@/lib/api/tags';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  householdId?: string;
  tagType: TagType;
  selectedTagNames: string[];
  onChange: (tagNames: string[]) => void;
  legend?: string;
  placeholder?: string;
  helperText?: string;
  maxSuggestions?: number;
}

function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizedKey(value: string): string {
  return normalizeTagName(value).toLowerCase();
}

function sortTagsByRelevance(tags: TagOption[], query: string): TagOption[] {
  const normalizedQuery = normalizedKey(query);
  if (!normalizedQuery) {
    return [...tags].sort((left, right) => left.name.localeCompare(right.name));
  }

  return [...tags].sort((left, right) => {
    const leftName = normalizedKey(left.name);
    const rightName = normalizedKey(right.name);
    const leftStarts = leftName.startsWith(normalizedQuery) ? 0 : 1;
    const rightStarts = rightName.startsWith(normalizedQuery) ? 0 : 1;

    if (leftStarts !== rightStarts) {
      return leftStarts - rightStarts;
    }

    return left.name.localeCompare(right.name);
  });
}

export function TagSelector({
  householdId,
  tagType,
  selectedTagNames,
  onChange,
  legend,
  placeholder,
  helperText,
  maxSuggestions = 8,
}: TagSelectorProps) {
  const { t } = useTranslation();
  const resolvedLegend = legend ?? t('tagSelector.legend', { defaultValue: 'Tags' });
  const resolvedPlaceholder = placeholder ?? t('tagSelector.placeholder', { defaultValue: 'Add a tag' });
  const resolvedHelperText =
    helperText ?? t('tagSelector.helper', { defaultValue: 'Press Enter or comma to add a tag.' });

  const [query, setQuery] = React.useState('');
  const [availableTags, setAvailableTags] = React.useState<TagOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const selectedTagKeys = React.useMemo(
    () => new Set(selectedTagNames.map((tagName) => normalizedKey(tagName))),
    [selectedTagNames]
  );

  const normalizedQuery = normalizedKey(query);

  const suggestions = React.useMemo(() => {
    const filtered = availableTags.filter((tag) => {
      if (selectedTagKeys.has(normalizedKey(tag.name))) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return normalizedKey(tag.name).includes(normalizedQuery);
    });

    return sortTagsByRelevance(filtered, query).slice(0, maxSuggestions);
  }, [availableTags, maxSuggestions, normalizedQuery, query, selectedTagKeys]);

  const canCreateTag =
    normalizedQuery.length > 0 &&
    !selectedTagKeys.has(normalizedQuery) &&
    !availableTags.some((tag) => normalizedKey(tag.name) === normalizedQuery);

  React.useEffect(() => {
    let isMounted = true;

    async function loadTags() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchTags({ householdId, type: tagType });
        if (isMounted) {
          setAvailableTags(data);
        }
      } catch {
        if (isMounted) {
          setError(t('tagSelector.error', { defaultValue: 'Unable to load tags.' }));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTags();

    return () => {
      isMounted = false;
    };
  }, [householdId, tagType, t]);

  function addTag(rawName: string) {
    const nextName = normalizeTagName(rawName);
    if (!nextName) {
      return;
    }

    const nextKey = normalizedKey(nextName);
    if (selectedTagKeys.has(nextKey)) {
      setQuery('');
      return;
    }

    const knownTag = availableTags.find((tag) => normalizedKey(tag.name) === nextKey);
    const resolvedName = knownTag?.name ?? nextName;
    onChange([...selectedTagNames, resolvedName]);
    setQuery('');
  }

  function removeTag(tagName: string) {
    const removedKey = normalizedKey(tagName);
    onChange(selectedTagNames.filter((currentTagName) => normalizedKey(currentTagName) !== removedKey));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(query);
      return;
    }

    if (event.key === 'Backspace' && !query && selectedTagNames.length > 0) {
      event.preventDefault();
      removeTag(selectedTagNames[selectedTagNames.length - 1]);
    }
  }

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <legend className="text-sm font-medium">{resolvedLegend}</legend>
        {selectedTagNames.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {t('tagSelector.selected_count', {
              count: selectedTagNames.length,
              defaultValue: '{{count}} selected',
            })}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
        {selectedTagNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedTagNames.map((tagName) => (
              <button
                key={tagName}
                type="button"
                onClick={() => removeTag(tagName)}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-950 transition-colors hover:bg-sky-100"
                aria-label={t('tagSelector.remove_tag', {
                  name: tagName,
                  defaultValue: `Remove ${tagName}`,
                })}
              >
                <TagIcon className="h-3.5 w-3.5" />
                <span>{tagName}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="tag-selector-input" className="text-xs font-medium text-muted-foreground">
            {t('tagSelector.search_label', { defaultValue: 'Find or create a tag' })}
          </label>
          <div className="relative">
            <TagIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tag-selector-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={resolvedPlaceholder}
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">{resolvedHelperText}</p>
        </div>

        {loading ? <p className="text-xs text-muted-foreground">{t('tagSelector.loading', { defaultValue: 'Loading tags…' })}</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {!loading && !error ? (
          <div className="space-y-2">
            {canCreateTag ? (
              <button
                type="button"
                onClick={() => addTag(query)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50/70 px-3 py-2 text-left text-sm text-sky-950 transition-colors hover:bg-sky-100"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>
                  {t('tagSelector.create_tag', {
                    name: normalizeTagName(query),
                    defaultValue: `Add tag "${normalizeTagName(query)}"`,
                  })}
                </span>
              </button>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('tagSelector.suggestions_label', { defaultValue: 'Suggested tags' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => addTag(tag.name)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground'
                      )}
                    >
                      <TagIcon className="h-3.5 w-3.5" />
                      <span>{tag.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!canCreateTag && suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('tagSelector.empty', { defaultValue: 'No tag matches this search.' })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

export default TagSelector;
import * as React from 'react';
import { Button } from './button';
import { Input } from './input';
import { Select } from './select';

/**
 * Configuration for a single filter field
 */
export interface FilterField {
  type: 'search' | 'select';
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** Optional className for custom styling */
  className?: string;
}

export interface FilterBarProps {
  /** Array of filter fields to display */
  fields: FilterField[];
  /** Callback when reset button is clicked */
  onReset: () => void;
  /** Whether any filters are currently active */
  hasActiveFilters: boolean;
  /** Optional actions to display (e.g., "New" button) */
  actions?: React.ReactNode;
  /** Optional className for the container */
  className?: string;
  /** Text for the reset button */
  resetLabel?: string;
  /** Text for the apply button (on search fields) */
  applyLabel?: string;
}

/**
 * FilterBar - A reusable, accessible filter component
 * 
 * Provides a consistent UI for filtering lists with search fields and select dropdowns.
 * Designed to be framework-agnostic with no business logic.
 * 
 * @example
 * ```tsx
 * <FilterBar
 *   fields={[
 *     {
 *       type: 'search',
 *       id: 'search',
 *       label: 'Search',
 *       value: searchValue,
 *       onChange: setSearchValue,
 *       placeholder: 'Search projects...',
 *     },
 *     {
 *       type: 'select',
 *       id: 'status',
 *       label: 'Status',
 *       value: statusValue,
 *       onChange: setStatusValue,
 *       options: [
 *         { value: '', label: 'All statuses' },
 *         { value: 'active', label: 'Active' },
 *         { value: 'completed', label: 'Completed' },
 *       ],
 *     },
 *   ]}
 *   onReset={handleReset}
 *   hasActiveFilters={!!searchValue || !!statusValue}
 *   actions={
 *     <Button asChild>
 *       <a href="/projects/new">New Project</a>
 *     </Button>
 *   }
 * />
 * ```
 */
export function FilterBar({
  fields,
  onReset,
  hasActiveFilters,
  actions,
  className = '',
  resetLabel = 'Reset',
  applyLabel = 'Apply',
}: FilterBarProps) {
  // Separate search fields from other fields for layout purposes
  const searchFields = fields.filter((f) => f.type === 'search');
  const selectFields = fields.filter((f) => f.type === 'select');

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {/* Search fields row */}
      {searchFields.map((field) => (
        <SearchField
          key={field.id}
          field={field}
          applyLabel={applyLabel}
        />
      ))}

      {/* Select fields + actions row */}
      {selectFields.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {selectFields.map((field) => (
            <SelectField key={field.id} field={field} />
          ))}

          {/* Reset button + custom actions */}
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              disabled={!hasActiveFilters}
              className="flex-1"
            >
              {resetLabel}
            </Button>
            {actions}
          </div>
        </div>
      )}

      {/* If no select fields, show reset + actions separately */}
      {selectFields.length === 0 && (hasActiveFilters || actions) && (
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button type="button" variant="outline" onClick={onReset}>
              {resetLabel}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * Internal component for rendering a search field with apply button
 */
function SearchField({
  field,
  applyLabel,
}: {
  field: FilterField;
  applyLabel: string;
}) {
  const [draft, setDraft] = React.useState(field.value);

  // Sync draft with external value changes
  React.useEffect(() => {
    setDraft(field.value);
  }, [field.value]);

  const handleApply = () => {
    field.onChange(draft.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  return (
    <div className={`flex gap-2 ${field.className || ''}`.trim()}>
      <div className="flex-1">
        <label
          htmlFor={field.id}
          className="text-xs font-medium text-muted-foreground"
        >
          {field.label}
        </label>
        <Input
          id={field.id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={field.placeholder}
          className="mt-1"
        />
      </div>
      <div className="flex items-end">
        <Button type="button" variant="outline" onClick={handleApply}>
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Internal component for rendering a select field
 */
function SelectField({ field }: { field: FilterField }) {
  return (
    <div className={`space-y-1 ${field.className || ''}`.trim()}>
      <label
        htmlFor={field.id}
        className="text-xs font-medium text-muted-foreground"
      >
        {field.label}
      </label>
      <Select
        id={field.id}
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
      >
        {field.options?.map((opt) => (
          <option key={opt.value || 'empty'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

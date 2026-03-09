import { ArrowRight } from 'lucide-react';

import { buttonVariants } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';

import { INTERACTION_TYPE_OPTIONS } from '../constants';
import { useDashboardText } from '../hooks/useDashboardText';
import type { DashboardQuickAction } from '../types';
import { DashboardIcon } from './DashboardIcon';

function buildTypedCreateUrl(baseHref: string, type: string): string {
  if (typeof window === 'undefined') {
    const separator = baseHref.includes('?') ? '&' : '?';
    return `${baseHref}${separator}type=${encodeURIComponent(type)}&return_to=dashboard`;
  }

  const url = new URL(baseHref, window.location.origin);
  url.searchParams.set('type', type);
  url.searchParams.set('return_to', 'dashboard');

  return `${url.pathname}${url.search}${url.hash}`;
}

interface TypePickerActionProps {
  action: DashboardQuickAction;
}

function TypePickerAction({ action }: TypePickerActionProps) {
  const resolveText = useDashboardText();
  const primaryOptions = INTERACTION_TYPE_OPTIONS.filter((option) => option.primary);
  const secondaryOptions = INTERACTION_TYPE_OPTIONS.filter((option) => !option.primary);

  function navigateToType(type: string, close: () => void) {
    close();

    if (typeof window === 'undefined') {
      return;
    }

    window.location.assign(buildTypedCreateUrl(action.href, type));
  }

  return (
    <SheetDialog
      title={resolveText('dashboard.typePicker.title', 'What would you like to add?')}
      description={resolveText(
        'dashboard.typePicker.description',
        'Choose the type of event to add to the household history.'
      )}
      trigger={
        <button type="button" className={buttonVariants({ variant: 'default', size: 'sm' })}>
          <DashboardIcon name={action.icon} className="mr-2 h-4 w-4" />
          {resolveText(action.labelKey, action.label)}
        </button>
      }
    >
      {({ close }) => (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {resolveText('dashboard.typePicker.primaryTitle', 'Common types')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {primaryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => navigateToType(option.value, close)}
                  className="rounded-2xl border border-border/70 bg-card p-4 text-left transition-colors hover:border-border hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {resolveText(option.labelKey, option.fallbackLabel)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {resolveText(option.descriptionKey, option.fallbackDescription)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {resolveText('dashboard.typePicker.secondaryTitle', 'More options')}
            </p>
            <div className="grid gap-2">
              {secondaryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => navigateToType(option.value, close)}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background px-4 py-3 text-left transition-colors hover:border-border hover:bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {resolveText(option.labelKey, option.fallbackLabel)}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {resolveText(option.descriptionKey, option.fallbackDescription)}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </SheetDialog>
  );
}

interface QuickActionButtonProps {
  action: DashboardQuickAction;
  index: number;
}

export function QuickActionButton({ action, index }: QuickActionButtonProps) {
  const resolveText = useDashboardText();

  if (action.actionType === 'typePicker') {
    return <TypePickerAction action={action} />;
  }

  return (
    <a
      href={action.href}
      className={buttonVariants({ variant: index === 0 ? 'default' : 'outline', size: 'sm' })}
    >
      <DashboardIcon name={action.icon} className="mr-2 h-4 w-4" />
      {resolveText(action.labelKey, action.label)}
    </a>
  );
}

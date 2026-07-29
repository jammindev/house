import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import SearchPalette from './SearchPalette';
import { useSearchShortcut } from './hooks';

/**
 * The top bar's entry point into app-wide search.
 *
 * Desktop shows a fake input — it looks like the box it opens, so the affordance is
 * readable without a tooltip, and it advertises ⌘K. Mobile gets the magnifier only:
 * the bar there already carries the burger, the logo, the bell and the avatar, and
 * a real input would squeeze all of them. Both open the same palette.
 */
export default function GlobalSearch() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  const openPalette = React.useCallback(() => setOpen(true), []);
  useSearchShortcut(openPalette);

  // ⌘ on Apple platforms, Ctrl elsewhere — showing the wrong one teaches a shortcut
  // that does not work.
  const shortcutLabel = React.useMemo(() => {
    const isApple =
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
    return isApple ? '⌘K' : 'Ctrl K';
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label={t('search.title')}
        data-testid="global-search-trigger"
        className="hidden md:flex items-center gap-2 rounded-md border border-border bg-background/50 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden lg:block">{t('search.placeholder')}</span>
        <kbd className="ml-2 hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium lg:block">
          {shortcutLabel}
        </kbd>
      </button>

      <button
        type="button"
        onClick={openPalette}
        aria-label={t('search.title')}
        data-testid="global-search-trigger-mobile"
        className="md:hidden p-1.5 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Search className="h-5 w-5" />
      </button>

      <SearchPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

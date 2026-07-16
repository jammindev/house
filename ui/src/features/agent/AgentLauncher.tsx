import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { cn } from '@/lib/utils';
import EntityAssistant from './EntityAssistant';
import HouseholdChat from './HouseholdChat';
import { resolveEntityContext, type EntityContext } from './entityRoute';

/**
 * Global, context-aware assistant launcher. A floating button on every `/app/*`
 * page opens a slide-over chat. When opened on an entity detail page it anchors
 * on that entity (same conversation as the old "Assistant" tab); elsewhere it
 * opens the household-wide assistant. A toggle lets the user switch between
 * "this page" and "the whole household" without leaving where they are.
 *
 * Context is snapshotted at open time — navigating with the panel open does NOT
 * silently re-anchor it (no surprise conversation switch mid-thread).
 */
export default function AgentLauncher() {
  const { t } = useTranslation();
  const location = useLocation();

  const [open, setOpen] = React.useState(false);
  // The entity context, snapshotted when the panel opens. null = household mode.
  const [context, setContext] = React.useState<EntityContext | null>(null);
  // The page entity captured at open time, so the toggle can restore it after
  // switching to household mode.
  const [pageContext, setPageContext] = React.useState<EntityContext | null>(null);

  // The dedicated /app/agent page already IS the household assistant.
  const onAgentPage = location.pathname.startsWith('/app/agent');

  const handleOpen = React.useCallback(() => {
    const resolved = resolveEntityContext(location.pathname);
    setPageContext(resolved);
    setContext(resolved);
    setOpen(true);
  }, [location.pathname]);

  if (onAgentPage) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('agent.launcher.open')}
        data-testid="agent-launcher-fab"
        className={cn(
          'fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center',
          'rounded-full bg-primary text-primary-foreground shadow-lg',
          'transition-transform hover:scale-105 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        style={{
          marginBottom: 'env(safe-area-inset-bottom)',
          marginRight: 'env(safe-area-inset-right)',
        }}
      >
        <Sparkles className="h-6 w-6" />
      </button>

      <SheetDialog
        open={open}
        onOpenChange={setOpen}
        size="l"
        title={t('agent.launcher.title')}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="agent-launcher-panel">
          {pageContext ? (
            <ScopeToggle
              anchored={context !== null}
              onSelect={(anchored) => setContext(anchored ? pageContext : null)}
            />
          ) : null}

          {context ? (
            <div className="min-h-0 flex-1">
              <EntityAssistant
                entityType={context.entityType}
                objectId={context.objectId}
                className="h-full"
                chatClassName="min-h-0 flex-1"
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <HouseholdChat compact />
            </div>
          )}
        </div>
      </SheetDialog>
    </>
  );
}

/** "This page" vs "Whole household" segmented control, shown on entity pages. */
function ScopeToggle({
  anchored,
  onSelect,
}: {
  anchored: boolean;
  onSelect: (anchored: boolean) => void;
}) {
  const { t } = useTranslation();
  const base = 'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors';
  return (
    <div
      className="flex gap-1 rounded-lg bg-muted p-1"
      role="tablist"
      data-testid="agent-launcher-scope"
    >
      <button
        type="button"
        role="tab"
        aria-selected={anchored}
        onClick={() => onSelect(true)}
        className={cn(base, anchored ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
        data-testid="agent-launcher-scope-page"
      >
        {t('agent.launcher.scope_page')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!anchored}
        onClick={() => onSelect(false)}
        className={cn(base, !anchored ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
        data-testid="agent-launcher-scope-household"
      >
        {t('agent.launcher.scope_household')}
      </button>
    </div>
  );
}

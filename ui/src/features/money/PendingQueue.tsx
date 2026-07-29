import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Inbox, ShieldAlert } from 'lucide-react';
import LoadMore from '@/components/LoadMore';
import { useLoadMore } from '@/lib/useLoadMore';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import EmptyState from '@/components/EmptyState';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useBudgets } from '@/features/budget/hooks';
import AllocationDialog from '@/features/banking/AllocationDialog';
import ClassifyInflowDialog from '@/features/banking/ClassifyInflowDialog';
import { useAllocations, useQualifyTransaction, useSetAllocations } from '@/features/banking/hooks';
import type { ComplianceFinding } from '@/lib/api/banking';
import {
  INFLOW_UNCLASSIFIED,
  REFUND_PARTIALLY_ALLOCATED,
  REFUND_WITHOUT_BUDGET,
  TRANSACTION_PARTIAL,
  TRANSACTION_UNALLOCATED,
} from './keys';
import { useComplianceGroup, useComplianceSummary } from './hooks';
import { householdBlocker } from './prerequisites';
import PendingCard from './PendingCard';
import WaiverDialog, { type WaiverTarget } from './WaiverDialog';

/** Une opération à ranger, quel que soit le détecteur qui l'a signalée. */
export interface PendingRow {
  kind: string;
  transactionId: string;
  label: string;
  accountName: string;
  bookedOn: string;
  /** Magnitude, toujours positive — le sens est porté par `direction`. */
  amount: string;
  allocated: string;
  remaining: string;
  /** `in` = une recette à qualifier, `out` = une sortie à ventiler. */
  direction: 'in' | 'out';
  /** Sortie à moitié ventilée, ou remboursement à moitié attribué. */
  isPartial: boolean;
  isStale: boolean;
  waiverReason: string;
}

function toRow(
  finding: ComplianceFinding,
  { direction, isPartial }: { direction: 'in' | 'out'; isPartial: boolean },
): PendingRow {
  const detail = finding.detail as Record<string, string | undefined>;
  return {
    kind: finding.kind,
    transactionId: finding.object_id,
    label: detail.label ?? finding.label,
    accountName: detail.account_name ?? '',
    bookedOn: detail.booked_on ?? '',
    // Les détecteurs de sortie nomment `outflow`, ceux de recette `amount` : la
    // file n'a pas à connaître cette différence, elle range des lignes.
    amount: detail.outflow ?? detail.amount ?? '0',
    allocated: detail.allocated ?? detail.credited ?? '0',
    remaining: detail.remaining ?? '0',
    direction,
    isPartial,
    isStale: finding.is_stale,
    waiverReason: finding.waiver_reason,
  };
}

/**
 * L'onglet « À ranger » — la file de travail quotidienne.
 *
 * Elle réunit les deux écarts qui demandent la même action : une sortie que
 * personne n'a affectée, et une sortie affectée à moitié. Les autres écarts
 * (soldes, chaînes, dépenses non rapprochées) vivent dans l'onglet Contrôle : ils
 * se résolvent ailleurs, et les mélanger ferait une file qu'on ne peut pas vider.
 *
 * La pré-catégorisation est **différée** : la file est rapide par son ergonomie
 * (une pastille = un clic, sélection multiple pour traiter un lot), pas par la
 * devinette. À ~160 lignes par mois, les actions groupées ne sont pas un confort.
 */
interface PendingQueueProps {
  /** Renvoie vers l'onglet Contrôle, où le prérequis bloquant se règle. */
  onGoToControl?: () => void;
}

export default function PendingQueue({ onGoToControl }: PendingQueueProps) {
  const { t } = useTranslation();
  // Une seule fenêtre pour les deux détecteurs : la file les présente comme une
  // liste unique triée par date, donc agrandir l'une sans l'autre ferait
  // apparaître des lignes au milieu de ce qu'on vient de lire.
  const { limit, loadMore, maxLimit } = useLoadMore(50);
  const unallocatedQuery = useComplianceGroup(TRANSACTION_UNALLOCATED, { limit });
  const partialQuery = useComplianceGroup(TRANSACTION_PARTIAL, { limit });
  // Les recettes, dans la même file et au même titre : une recette non classée
  // est du rangement, exactement comme une sortie non ventilée.
  const unclassifiedQuery = useComplianceGroup(INFLOW_UNCLASSIFIED, { limit });
  const refundNoBudgetQuery = useComplianceGroup(REFUND_WITHOUT_BUDGET, { limit });
  const refundPartialQuery = useComplianceGroup(REFUND_PARTIALLY_ALLOCATED, { limit });

  const inflowQueries = [unclassifiedQuery, refundNoBudgetQuery, refundPartialQuery];
  const allQueries = [unallocatedQuery, partialQuery, ...inflowQueries];
  const summaryQuery = useComplianceSummary();
  const budgetsQuery = useBudgets();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [postponed, setPostponed] = React.useState<Set<string>>(new Set());
  const [splitting, setSplitting] = React.useState<string | null>(null);
  const [classifying, setClassifying] = React.useState<string | null>(null);
  const classifyQuery = useAllocations(classifying ?? undefined);
  const classifyTarget = classifyQuery.data?.transaction ?? null;
  const [waiving, setWaiving] = React.useState<WaiverTarget | null>(null);

  const isLoading = allQueries.some((q) => q.isLoading);
  const showSkeleton = useDelayedLoading(isLoading);

  const rows = React.useMemo(() => {
    const out = [
      ...(unallocatedQuery.data?.results ?? []).map((f) =>
        toRow(f, { direction: 'out', isPartial: false }),
      ),
      ...(partialQuery.data?.results ?? []).map((f) =>
        toRow(f, { direction: 'out', isPartial: true }),
      ),
    ];
    const inn = [
      ...(unclassifiedQuery.data?.results ?? []).map((f) =>
        toRow(f, { direction: 'in', isPartial: false }),
      ),
      ...(refundNoBudgetQuery.data?.results ?? []).map((f) =>
        toRow(f, { direction: 'in', isPartial: false }),
      ),
      ...(refundPartialQuery.data?.results ?? []).map((f) =>
        toRow(f, { direction: 'in', isPartial: true }),
      ),
    ];
    // Les plus anciennes d'abord : ranger dans l'ordre du relevé est le seul ordre
    // qui laisse une chance de se souvenir de ce qu'était une ligne. Recettes et
    // sorties se mélangent — c'est le relevé, pas deux listes.
    return [...out, ...inn]
      .filter((row) => !postponed.has(row.transactionId))
      .sort((a, b) => a.bookedOn.localeCompare(b.bookedOn));
  }, [
    unallocatedQuery.data,
    partialQuery.data,
    unclassifiedQuery.data,
    refundNoBudgetQuery.data,
    refundPartialQuery.data,
    postponed,
  ]);

  // Pastilles, pas options : on garde des `Budget`. Seul le global est écarté —
  // une catégorie n'est pas un budget, donc elle n'arrive jamais dans cette
  // liste et il n'y a rien de plus à filtrer.
  const budgets = React.useMemo(
    () => (budgetsQuery.data ?? []).filter((b) => !b.is_global),
    [budgetsQuery.data],
  );

  const totalOpen = allQueries.reduce((sum, q) => sum + (q.data?.open ?? 0), 0);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function postpone(id: string) {
    setPostponed((prev) => new Set(prev).add(id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  // Une file vide a deux sens, et les confondre est exactement le bug qui a shippé :
  // « tout est rangé » et « rien n'est évaluable ». Le prérequis bloquant passe donc
  // devant, avec l'action qui le lève.
  const blocker = householdBlocker(summaryQuery.data);

  if (rows.length === 0 && blocker) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('money.pending.blocked')}
        description={t('money.pending.blockedHint', {
          prerequisite: t(`money.compliance.kinds.${blocker.kind}.title`),
        })}
        action={{
          label: t('money.pending.blockedAction'),
          onClick: () => onGoToControl?.(),
        }}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={totalOpen === 0 ? Check : Inbox}
        title={totalOpen === 0 ? t('money.pending.allDone') : t('money.pending.nothingLeft')}
        description={
          totalOpen === 0
            ? t('money.pending.allDoneHint')
            : t('money.pending.nothingLeftHint')
        }
      />
    );
  }

  // Une sélection ne peut porter que sur des sorties entièrement non ventilées :
  // imputer en masse une ligne déjà partiellement ventilée écraserait sa
  // ventilation existante (le PUT est un « set »). Les lignes partielles se
  // complètent une par une, dans le dialog.
  //
  // Les **recettes** ont leur propre lot, séparé : leur action groupée n'est pas
  // un budget mais une nature, et mélanger les deux sélections produirait une
  // barre d'actions dont la moitié ne s'applique pas à la moitié de la sélection.
  const selectableRows = rows.filter((row) => !row.isPartial && row.direction === 'out');
  const selectableInflows = rows.filter((row) => row.direction === 'in');
  const selectedRows = rows.filter(
    (row) => selected.has(row.transactionId) && row.direction === 'out',
  );
  const selectedInflows = rows.filter(
    (row) => selected.has(row.transactionId) && row.direction === 'in',
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t('money.pending.count', { count: totalOpen })}
        </p>
        {selectableRows.length + selectableInflows.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected((prev) =>
                prev.size === selectableRows.length + selectableInflows.length
                  ? new Set()
                  : new Set(
                      [...selectableRows, ...selectableInflows].map((r) => r.transactionId),
                    ),
              )
            }
          >
            {selected.size === selectableRows.length + selectableInflows.length
              ? t('money.pending.clearSelection')
              : t('money.pending.selectAll')}
          </Button>
        ) : null}
      </div>

      {selectedInflows.length > 0 ? (
        <InflowBulkBar rows={selectedInflows} onDone={() => setSelected(new Set())} />
      ) : null}

      {selectedRows.length > 0 ? (
        <BulkBar
          rows={selectedRows}
          budgets={budgets}
          onDone={() => setSelected(new Set())}
          onWaive={() =>
            setWaiving({
              kind: TRANSACTION_UNALLOCATED,
              objectIds: selectedRows.map((r) => r.transactionId),
              label: t('money.pending.bulkLabel', { count: selectedRows.length }),
            })
          }
        />
      ) : null}

      <div className="space-y-2">
        {rows.map((row) => (
          <PendingCard
            key={row.transactionId}
            row={row}
            budgets={budgets}
            selected={selected.has(row.transactionId)}
            onToggleSelected={
              row.isPartial && row.direction === 'out'
                ? undefined
                : () => toggleSelected(row.transactionId)
            }
            onSplit={() => setSplitting(row.transactionId)}
            onClassify={() => setClassifying(row.transactionId)}
            onPostpone={() => postpone(row.transactionId)}
            onWaive={() =>
              setWaiving({
                kind: row.kind,
                objectIds: [row.transactionId],
                label: row.label,
                previousReason: row.isStale ? row.waiverReason : undefined,
              })
            }
          />
        ))}
      </div>

      {/* Le « reporté » de la session est retiré de `rows` sans l'être du total :
          on compte donc ce qui a été chargé, pas ce qui reste affiché, sinon
          reporter trois lignes ferait réapparaître un bouton qui ne charge rien. */}
      <LoadMore
        shown={allQueries.reduce((sum, q) => sum + (q.data?.results.length ?? 0), 0)}
        total={totalOpen}
        max={maxLimit}
        onLoadMore={loadMore}
        isFetching={allQueries.some((q) => q.isFetching)}
        className="flex flex-col items-center gap-1 pt-2"
      />

      {splitting ? (
        <AllocationDialog
          open
          onOpenChange={(next) => !next && setSplitting(null)}
          transactionId={splitting}
        />
      ) : null}

      {/* Le dialogue de qualification veut la ligne complète, pas son id : la file
          ne connaît que des écarts (voir `AllocationDialog`, même contrainte
          inversée). On la relit par l'endpoint que toute cette famille de
          dialogues utilise déjà, plutôt que d'inventer un second chemin. */}
      {classifyTarget ? (
        <ClassifyInflowDialog
          open
          onOpenChange={(next) => !next && setClassifying(null)}
          transaction={classifyTarget}
        />
      ) : null}

      <WaiverDialog target={waiving} onClose={() => setWaiving(null)} />
    </div>
  );
}

/**
 * Le lot des recettes : une **nature** pour toute la sélection.
 *
 * Quinze virements internes se classent d'un geste — c'est le cas réel après un
 * import : les allers-retours entre comptes arrivent en paquet. « Remboursement »
 * n'y figure pas : il demande de désigner des enveloppes et des montants, donc il
 * se traite ligne à ligne, dans son dialogue.
 */
function InflowBulkBar({ rows, onDone }: { rows: PendingRow[]; onDone: () => void }) {
  const { t } = useTranslation();
  const [pending, setPending] = React.useState(false);
  const qualify = useQualifyTransaction();

  async function classifyAll(nature: 'salary' | 'transfer' | 'other') {
    setPending(true);
    try {
      // Séquentiel, comme pour les sorties : quinze lignes ne doivent pas partir
      // en quinze requêtes concurrentes qui verrouillent chacune leur ligne.
      for (const row of rows) {
        await qualify.mutateAsync({ id: row.transactionId, payload: { inflow_nature: nature } });
      }
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="space-y-2 border-primary/40 bg-primary/5 p-3">
      <p className="text-sm font-medium text-foreground">
        {t('money.pending.bulkSelectedInflows', { count: rows.length })}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {(['salary', 'transfer', 'other'] as const).map((nature) => (
          <Button
            key={nature}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => classifyAll(nature)}
          >
            {t(`banking.inflow.natures.${nature}`)}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function BulkBar({
  rows,
  budgets,
  onDone,
  onWaive,
}: {
  rows: PendingRow[];
  budgets: { id: string; name: string }[];
  onDone: () => void;
  onWaive: () => void;
}) {
  const { t } = useTranslation();
  const [pending, setPending] = React.useState(false);
  const setAllocationsMutation = useSetAllocations();

  async function handleBudget(budgetId: string) {
    setPending(true);
    try {
      // Séquentiel : quinze lignes ne doivent pas partir en quinze requêtes
      // concurrentes qui verrouillent chacune leur ligne de relevé.
      for (const row of rows) {
        await setAllocationsMutation.mutateAsync({
          transactionId: row.transactionId,
          lines: [{ subject: row.label, amount: row.amount, budget_id: budgetId || null }],
        });
      }
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="space-y-2 border-primary/40 bg-primary/5 p-3">
      <p className="text-sm font-medium text-foreground">
        {t('money.pending.bulkSelected', { count: rows.length })}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {budgets.map((budget) => (
          <Button
            key={budget.id}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => handleBudget(budget.id)}
          >
            {budget.name}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => handleBudget('')}
        >
          {t('money.pending.noBudget')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onWaive} disabled={pending}>
          {t('money.compliance.arbitrate')}
        </Button>
      </div>
    </Card>
  );
}

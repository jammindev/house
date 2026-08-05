import * as React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, Link2, Paperclip, Pencil, Receipt, Undo2, Wallet } from 'lucide-react';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent } from '@/design-system/card';
import BackLink from '@/components/BackLink';
import PageHeader from '@/components/PageHeader';
import InfoField from '@/components/InfoField';
import LoadError from '@/components/LoadError';
import ListSkeleton from '@/components/ListSkeleton';
import { pushBack, useNavigateBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { formatAmount, formatDate, formatDateTime } from '@/lib/format';
import { useInteraction, useAttachDocumentToInteraction } from '@/features/interactions/hooks';
import InteractionDeleteAction from '@/features/interactions/InteractionDeleteAction';
import DocumentUploadDialog from '@/features/documents/DocumentUploadDialog';
import AttachToTransactionDialog from '@/features/banking/AttachToTransactionDialog';
import LinkedLineActions from '@/features/banking/LinkedLineActions';
import { isOwnedByAllocationEditor } from '@/features/banking/ownership';
import { useAllocations } from '@/features/banking/hooks';
import { useDocuments } from '@/features/documents/hooks';
import ReconciliationBadge from './ReconciliationBadge';
import RefundExpenseDialog from './RefundExpenseDialog';

/** Vers quoi pointe l'objet auquel la dépense est rattachée, quand il en a un. */
function sourceLink(sourceType: string | null | undefined, sourceId: string | null | undefined) {
  if (!sourceType || !sourceId) return null;
  if (sourceType === 'projects.project') return `/app/projects/${sourceId}`;
  if (sourceType === 'equipment.equipment') return `/app/equipment/${sourceId}`;
  if (sourceType === 'stock.stockitem') return '/app/stock';
  return null;
}

/**
 * La fiche d'une **dépense** — pas celle d'une activité.
 *
 * Sous le capot c'est la même `Interaction` que la note ou l'entretien : un fait
 * daté du journal du foyer. Mais les questions qu'on pose à une dépense n'ont
 * rien à voir avec celles qu'on pose à une note, et la fiche générique n'en
 * répondait à aucune — elle affichait un montant et s'arrêtait là, sans dire dans
 * quelle enveloppe l'euro tombe. Ce qui a rendu l'écran d'édition le seul endroit
 * habitable, donc le seul endroit où l'on atterrissait : un formulaire, pour lire.
 *
 * Cette page répond aux trois seules questions qu'une dépense pose :
 *
 * 1. **Combien, quand, à qui** — l'en-tête et le montant.
 * 2. **Où est-ce classé** — le budget (le seul axe qui classe un euro), l'objet
 *    rattaché, les zones. Sans budget, la fiche le dit et propose d'y remédier :
 *    c'est l'écart que le Contrôle réclame, autant le résoudre là où on le lit.
 * 3. **Qu'est-ce qui la justifie** — le rapprochement, l'opération de relevé, et
 *    les **autres** dépenses qui se partagent la même ligne : sur une sortie de
 *    150 € ventilée 90/60, lire 90 € sans savoir où sont passés les 60 autres
 *    laisse croire à une erreur.
 *
 * Les gestes vivent à côté du constat qu'ils corrigent, jamais dans un autre
 * écran : éditer, supprimer, rattacher, détacher, joindre un justificatif.
 */
export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const navigateBack = useNavigateBack('/app/money/expenses');

  const [attachOpen, setAttachOpen] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const { data: expense, isLoading, error } = useInteraction(id ?? '');
  const attachDocument = useAttachDocumentToInteraction(id ?? '');
  const showSkeleton = useDelayedLoading(isLoading);

  const bankLine = expense?.bank_line ?? null;
  // Les dépenses sœurs de la même opération. Requêtée seulement quand une ligne
  // existe : une dépense en espèces ou non rapprochée n'a rien à partager.
  const allocationsQuery = useAllocations(bankLine?.id);
  const documentsQuery = useDocuments(
    React.useMemo(() => ({ linked_to: `interaction:${id ?? ''}` }), [id]),
    { enabled: Boolean(id) },
  );

  if (!id) return null;
  if (showSkeleton) return <ListSkeleton className="space-y-2 p-4" />;
  if (isLoading) return null;

  if (error || !expense) {
    return (
      <LoadError
        message={t('interactions.error_load_failed')}
        link={{ to: '/app/money/expenses', label: t('expenses.title') }}
      />
    );
  }

  const amount = expense.amount ?? null;
  const budget = expense.budget ?? null;
  const link = sourceLink(expense.source_type, expense.source_id);
  const siblings = (allocationsQuery.data?.allocations ?? []).filter((row) => row.id !== expense.id);
  const documents = documentsQuery.data ?? [];
  const isOwnedSplit = isOwnedByAllocationEditor(expense.kind);

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          backLink={
            <BackLink fallback="/app/money/expenses" fallbackLabel={t('expenses.title')} />
          }
          title={expense.subject}
          titleSuffix={
            expense.kind ? (
              <Badge variant="outline">{t(`expenses.kind.${expense.kind}`)}</Badge>
            ) : null
          }
          description={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{formatDateTime(expense.occurred_at)}</span>
              {expense.supplier ? <span>· {expense.supplier}</span> : null}
            </span>
          }
        >
          {/* Le geste part d'ici parce que c'est d'ici que part l'utilisateur :
              il regarde l'achat qu'il regrette, pas la recette. Et partir de la
              dépense fait disparaître la question du budget — c'est le sien. */}
          {budget ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => setRefundOpen(true)}
            >
              <Undo2 className="mr-1.5 h-3.5 w-3.5" />
              {t('money.refundExpense.action')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-sm"
            onClick={() => navigate(`/app/interactions/${id}/edit`, { state: pushBack(location) })}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t('common.edit')}
          </Button>
          {/* Une dépense née d'une ventilation ne « disparaît » pas quand on la
              supprime : son argent retourne dans « À ranger ». Le dire dans la
              confirmation évite d'avoir à le deviner. */}
          <InteractionDeleteAction
            id={expense.id}
            onDeleted={navigateBack}
            description={
              isOwnedSplit ? t('money.expense.deleteSplitConfirm') : t('money.expense.deleteConfirm')
            }
          />
        </PageHeader>

        {/* 1. Combien — le chiffre d'abord, c'est ce qu'on vient lire. */}
        <Card>
          <CardContent className="flex flex-wrap items-baseline justify-between gap-3 pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('interactions.expense_amount_label')}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                {amount ? formatAmount(amount) : t('expenses.list.noAmount')}
              </p>
            </div>
            <ReconciliationBadge state={expense.reconciliation_state} line={bankLine} />
          </CardContent>
        </Card>

        {/* 2. Où est-ce classé */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            {t('money.expense.classification')}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField label={t('purchase.fields.budget')}>
              {budget ? (
                <Link
                  to="/app/money/budgets"
                  state={pushBack(location)}
                  className="font-medium text-primary hover:underline"
                >
                  {budget.name}
                </Link>
              ) : (
                /* « Hors budget » est l'écart le plus courant du foyer, et le
                   résoudre demandait de deviner qu'il faut passer par l'édition. */
                <div className="space-y-1.5">
                  <p className="text-sm text-warning">{t('money.expense.noBudget')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      navigate(`/app/interactions/${id}/edit`, { state: pushBack(location) })
                    }
                  >
                    {t('money.expense.pickBudget')}
                  </Button>
                </div>
              )}
            </InfoField>

            {expense.source_label ? (
              <InfoField label={t('money.expense.attachedTo')}>
                {link ? (
                  <Link
                    to={link}
                    state={pushBack(location)}
                    className="font-medium text-primary hover:underline"
                  >
                    {expense.source_label}
                  </Link>
                ) : (
                  expense.source_label
                )}
              </InfoField>
            ) : null}

            {expense.zone_names.length > 0 ? (
              <InfoField label={t('interactions.zone_label')}>
                {expense.zone_names.join(', ')}
              </InfoField>
            ) : null}

            {expense.created_by_name ? (
              <InfoField label={t('interactions.detail_created_by')}>
                {expense.created_by_name}
              </InfoField>
            ) : null}
          </dl>
        </section>

        {/* 3. Qu'est-ce qui la justifie */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            {t('money.reconciliation.label')}
          </h2>

          <Card>
            <CardContent className="space-y-3 pt-4">
              {bankLine ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      {/* « Rapprochée » sans pouvoir aller voir à quoi est
                          invérifiable : le lien mène à l'opération. */}
                      <Link
                        to={`/app/money/transactions/${bankLine.id}`}
                        state={pushBack(location)}
                        className="font-medium text-primary hover:underline"
                      >
                        {bankLine.label}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {bankLine.account_name} · {formatDate(bankLine.booked_on)}
                      </p>
                    </div>
                    <LinkedLineActions
                      expenseId={expense.id}
                      kind={expense.kind}
                      transactionId={bankLine.id}
                      onDeleted={navigateBack}
                      className="h-7 px-2 text-xs"
                    />
                  </div>

                  {isOwnedSplit ? (
                    <p className="text-xs text-muted-foreground">{t('banking.attach.ownedHint')}</p>
                  ) : null}

                  {/* Les dépenses sœurs : le reste de l'argent de la même ligne.
                      Sans elles, 90 € lus sur une sortie de 150 € ressemblent à
                      une erreur de saisie. */}
                  {siblings.length > 0 ? (
                    <div className="space-y-1.5 border-t border-border/60 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('money.expense.sharedLine', { count: siblings.length })}
                      </p>
                      <ul className="space-y-1">
                        {siblings.map((row) => (
                          <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                            <Link
                              to={`/app/money/expenses/${row.id}`}
                              state={pushBack(location)}
                              className="min-w-0 truncate text-foreground hover:text-primary hover:underline"
                            >
                              {row.subject}
                              {row.budget ? (
                                <span className="text-muted-foreground"> · {row.budget.name}</span>
                              ) : null}
                            </Link>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {row.amount ? formatAmount(row.amount) : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {allocationsQuery.data ? (
                        <p className="text-xs text-muted-foreground">
                          {t('money.expense.lineRemaining', {
                            allocated: formatAmount(allocationsQuery.data.allocated),
                            remaining: formatAmount(allocationsQuery.data.remaining),
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('money.expense.notReconciled')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAttachOpen(true)}
                    disabled={!amount}
                  >
                    <Link2 className="mr-1.5 h-3 w-3" />
                    {t('banking.attach.action')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Le justificatif — la pièce qu'on cherche six mois plus tard. Le bloc
            s'affiche même vide : une section qui n'apparaît qu'une fois remplie
            n'apprend à personne qu'on peut la remplir. */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              {t('money.expense.receipts')}
            </h2>
            <Button
              type="button"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => setUploadOpen(true)}
            >
              {t('money.expense.addReceipt')}
            </Button>
          </div>
          {documents.length > 0 ? (
            <ul className="space-y-1.5">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to={`/app/documents/${doc.id}`}
                    state={pushBack(location)}
                    className="flex items-center gap-2 text-sm text-foreground hover:text-primary hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{doc.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-muted-foreground">{t('money.expense.noReceipt')}</p>
          )}
        </section>

        {/* Les notes en dernier : elles précisent, elles ne portent pas le sens. */}
        {expense.content ? (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              {t('interactions.description_label')}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {expense.content}
            </p>
          </section>
        ) : null}

        {expense.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {expense.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* L'upload et le lien sont un seul geste vu de l'utilisateur : un ticket
          photographié depuis la fiche d'une dépense y est *forcément* rattaché. */}
      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        // Ne pas refermer ici : le dialogue le fait lui-même quand **tout** le lot
        // est passé. Refermer au premier fichier arrivé escamotait la progression
        // et l'échec des suivants d'un ticket photographié en plusieurs pages.
        onSaved={(created) => {
          if (created) attachDocument.mutate(created.id);
        }}
      />

      {amount ? (
        <AttachToTransactionDialog
          open={attachOpen}
          onOpenChange={setAttachOpen}
          expense={{
            id: expense.id,
            subject: expense.subject,
            amount,
            occurred_at: expense.occurred_at,
          }}
        />
      ) : null}

      {budget ? (
        <RefundExpenseDialog
          open={refundOpen}
          onOpenChange={setRefundOpen}
          expense={{
            id: expense.id,
            subject: expense.subject,
            amount,
            occurred_at: expense.occurred_at,
          }}
          budget={budget}
        />
      ) : null}
    </>
  );
}

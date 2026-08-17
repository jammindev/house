import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ChevronDown, Split, Tag } from 'lucide-react';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { CheckboxField } from '@/design-system/checkbox-field';
import { appLocale, formatAmount } from '@/lib/format';
import { useQualifyTransaction, useSetAllocations } from '@/features/banking/hooks';
import type { PendingRow } from './PendingQueue';

interface PendingCardProps {
  row: PendingRow;
  budgets: { id: string; name: string }[];
  selected: boolean;
  /** Absent quand la ligne n'est pas sélectionnable (voir `PendingQueue`). */
  onToggleSelected?: () => void;
  /** La ligne que porte le curseur : elle seule déploie ses pastilles. */
  expanded: boolean;
  onToggleExpanded: () => void;
  onSplit: () => void;
  onPostpone: () => void;
  onWaive: () => void;
  /** Ouvre le dialogue de qualification — le seul chemin d'un remboursement. */
  onClassify: () => void;
}

/**
 * Une opération à ranger, avec les quatre issues possibles — et **aucune
 * cinquième** qui consisterait à la faire disparaître sans rien enregistrer :
 *
 * - **une pastille de budget** : le cas courant, un clic, toute l'opération ;
 * - **« Ventiler en plusieurs »** : le découpage, qui reste central ;
 * - **« Arbitrer »** : un motif est exigé, et l'écart devient auditable ;
 * - **« Plus tard »** : la ligne quitte l'écran pour la session, sans rien écrire —
 *   elle sera là au prochain passage, parce qu'elle n'est pas résolue.
 *
 * Les pastilles n'apparaissent **que** sur une ligne entièrement non ventilée :
 * l'enregistrement d'une ventilation est un remplacement complet, donc imputer
 * d'un clic une ligne déjà partagée écraserait le travail déjà fait. Sur une ligne
 * partielle, le seul chemin est le dialog, qui part de l'existant.
 *
 * ⚠️ **Une recette a les mêmes issues, mais pas les mêmes pastilles.** Ce qu'on lui
 * demande n'est pas un budget mais une **nature** : salaire, remboursement,
 * transfert interne, autre. Trois d'entre elles se règlent d'un clic ; le
 * remboursement ouvre son dialogue, parce que lui seul demande de désigner des
 * enveloppes *et* des montants. Offrir des pastilles de budget sur une recette
 * aurait laissé croire qu'on peut la ventiler comme une dépense — alors qu'elle
 * ne consomme rien, elle rend.
 *
 * ⚠️ **Les pastilles ne se dessinent que sur la ligne focalisée.** Répétées sur
 * chaque carte, les vingt-trois budgets faisaient d'une file de vingt lignes un
 * mur de douze mille pixels : le geste restait bon (une pastille, un clic) mais
 * il fallait défiler entre deux lignes pour l'atteindre. Repliée, une ligne dit
 * ce qu'il faut pour décider si on s'y attarde — le libellé, la date, le compte,
 * le montant — et rien de plus. Les deux alertes (ventilation partielle,
 * arbitrage périmé) font exception et restent visibles repliées : elles ne
 * décrivent pas l'opération, elles disent que celle-ci demande autre chose qu'un
 * clic, et c'est précisément ce qu'on veut savoir avant d'ouvrir.
 */
export default function PendingCard({
  row,
  budgets,
  selected,
  onToggleSelected,
  expanded,
  onToggleExpanded,
  onSplit,
  onPostpone,
  onWaive,
  onClassify,
}: PendingCardProps) {
  const { t } = useTranslation();
  const setAllocationsMutation = useSetAllocations();
  const qualify = useQualifyTransaction();
  const [pending, setPending] = React.useState(false);
  const isInflow = row.direction === 'in';

  async function classify(nature: 'salary' | 'transfer' | 'other') {
    setPending(true);
    try {
      await qualify.mutateAsync({ id: row.transactionId, payload: { inflow_nature: nature } });
    } finally {
      setPending(false);
    }
  }

  async function assignWhole(budgetId: string) {
    setPending(true);
    try {
      await setAllocationsMutation.mutateAsync({
        transactionId: row.transactionId,
        lines: [{ subject: row.label, amount: row.amount, budget_id: budgetId || null }],
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className={`p-3 ${selected ? 'border-primary/50 bg-primary/5' : ''}`}>
      <div className="flex items-start gap-2">
        {onToggleSelected ? (
          <div className="pt-0.5">
            <CheckboxField
              id={`pick-${row.transactionId}`}
              label=""
              checked={selected}
              onChange={onToggleSelected}
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          {/* Un bouton de divulgation, pas une carte cliquable : `aria-expanded`
              est la seule chose qui dise à un lecteur d'écran que les pastilles
              sont ailleurs, et son nom accessible est déjà la ligne entière. */}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggleExpanded}
            className="flex w-full items-start justify-between gap-2 text-left"
          >
            <span className="flex min-w-0 items-start gap-1.5">
              <ChevronDown
                className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  expanded ? '' : '-rotate-90'
                }`}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{row.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {row.bookedOn ? new Date(row.bookedOn).toLocaleDateString(appLocale()) : ''}
                  {row.accountName ? ` · ${row.accountName}` : ''}
                </span>
              </span>
            </span>
            <span
              className={`flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums ${
                isInflow ? 'text-primary' : 'text-foreground'
              }`}
            >
              {isInflow ? <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden /> : null}
              {formatAmount(row.amount)}
            </span>
          </button>

          {row.isPartial ? (
            <p className="mt-1 text-xs text-warning">
              {t(isInflow ? 'money.pending.partialRefund' : 'money.pending.partial', {
                allocated: formatAmount(row.allocated),
                remaining: formatAmount(row.remaining),
              })}
            </p>
          ) : null}

          {row.isStale ? (
            <p className="mt-1 text-xs italic text-warning">
              {t('money.compliance.stale', { reason: row.waiverReason })}
            </p>
          ) : null}

          {expanded ? (
            <div className="mt-2 space-y-2">
              {/* Une recette : sa nature. Une sortie : son budget. Même geste,
                  même place, mais la question posée n'est pas la même. */}
              {isInflow || !row.isPartial ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {isInflow ? (
                    <>
                      {(['salary', 'transfer', 'other'] as const).map((nature) => (
                        <Button
                          key={nature}
                          type="button"
                          variant="chip"
                          size="chip"
                          disabled={pending}
                          onClick={() => classify(nature)}
                        >
                          {t(`banking.inflow.natures.${nature}`)}
                        </Button>
                      ))}
                      {/* Le remboursement est une nature comme les trois autres,
                          d'où sa place ici — mais lui seul demande d'où l'argent
                          revient, donc lui seul ouvre un dialogue. */}
                      <Button
                        type="button"
                        variant="chip"
                        size="chip"
                        onClick={onClassify}
                        disabled={pending}
                      >
                        <Tag className="mr-1 h-3 w-3" aria-hidden />
                        {row.isPartial
                          ? t('money.pending.completeRefund')
                          : t('banking.inflow.natures.refund')}
                      </Button>
                    </>
                  ) : (
                    budgets.map((budget) => (
                      <Button
                        key={budget.id}
                        type="button"
                        variant="chip"
                        size="chip"
                        disabled={pending}
                        onClick={() => assignWhole(budget.id)}
                      >
                        {budget.name}
                      </Button>
                    ))
                  )}
                </div>
              ) : null}

              {/* Les issues qui ne se règlent pas d'un clic, en retrait : elles
                  ouvrent un dialogue ou repoussent, et les mêler aux pastilles
                  faisait quatre gestes de poids égal pour trois natures. */}
              <div className="flex flex-wrap items-center gap-1">
                {!isInflow ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onSplit}
                    disabled={pending}
                  >
                    <Split className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {row.isPartial ? t('money.pending.complete') : t('money.pending.split')}
                  </Button>
                ) : null}

                <Button type="button" variant="ghost" size="sm" onClick={onWaive} disabled={pending}>
                  {row.isStale
                    ? t('money.compliance.rearbitrate')
                    : t('money.compliance.arbitrate')}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onPostpone}
                  disabled={pending}
                  className="text-muted-foreground"
                >
                  {t('money.pending.later')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

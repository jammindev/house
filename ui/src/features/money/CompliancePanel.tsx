import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  ShieldAlert,
  Undo2,
} from 'lucide-react';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import EmptyState from '@/components/EmptyState';
import type { ComplianceFinding, ComplianceGroup, ComplianceSeverity } from '@/lib/api/banking';
import { useComplianceGroup, useComplianceSummary, useRevokeWaiver } from './hooks';
import { blockingPrerequisite } from './prerequisites';
import { ACCOUNT_ANCHOR_STALE, ACCOUNT_WITHOUT_WINDOW, PENDING_KINDS } from './keys';
import { useBankAccounts } from '@/features/banking/hooks';
import AccountDialog from '@/features/banking/AccountDialog';
import BalanceAnchorDialog from '@/features/banking/BalanceAnchorDialog';
import AllocationDialog from '@/features/banking/AllocationDialog';
import WaiverDialog, { type WaiverTarget } from './WaiverDialog';

const SEVERITY_ORDER: Record<ComplianceSeverity, number> = { blocker: 0, error: 1, warning: 2 };

const SEVERITY_ICON: Record<ComplianceSeverity, typeof AlertTriangle> = {
  blocker: ShieldAlert,
  error: AlertTriangle,
  warning: Info,
};

/**
 * L'onglet « Contrôle » — la conformité rendue visible.
 *
 * Deux principes de présentation portent tout le parcours 26 :
 *
 * 1. **Les prérequis bloquants passent en tête.** Un compte sans solde
 *    d'ouverture n'a pas de fenêtre de conformité : ses dépendants ne sont pas
 *    « conformes », ils ne sont **pas évaluables**. Les afficher au même niveau
 *    que le reste laisserait croire que tout va bien.
 * 2. **Un groupe à zéro reste visible, coché.** C'est ce qui distingue « contrôlé
 *    et conforme » de « pas encore contrôlé » — sans quoi une liste vide serait
 *    indistinguable d'un détecteur en panne.
 */
export default function CompliancePanel() {
  const { t } = useTranslation();
  const summaryQuery = useComplianceSummary();
  const showSkeleton = useDelayedLoading(summaryQuery.isLoading);
  const [openKind, setOpenKind] = React.useState<string | null>(null);
  const [waiving, setWaiving] = React.useState<WaiverTarget | null>(null);
  // Le prérequis bloquant se règle sur le compte : l'ouvrir depuis le contrôle
  // évite de renvoyer chercher dans un autre onglet ce qu'on peut corriger ici.
  const [fixingAccountId, setFixingAccountId] = React.useState<string | null>(null);
  // L'autre façon de régler le même prérequis : quand le compte porte déjà des
  // lignes, le solde d'ouverture se retrouve par arithmétique — le saisir à la
  // main suppose une information que la banque ne donne pas.
  const [anchoringAccountId, setAnchoringAccountId] = React.useState<string | null>(null);
  // ⚠️ Résoudre doit être une **action**, pas une phrase. Tant que la seule
  // commande d'une ligne était « Arbitrer », le contrôle n'offrait en un clic que
  // la sortie de secours, et renvoyait le vrai travail vers un autre onglet — le
  // contraire de ce que le parcours 26 cherche à obtenir.
  const [allocatingId, setAllocatingId] = React.useState<string | null>(null);
  const accountsQuery = useBankAccounts(true);
  const findAccount = React.useCallback(
    (id: string | null) => (accountsQuery.data ?? []).find((account) => account.id === id),
    [accountsQuery.data],
  );
  const fixingAccount = findAccount(fixingAccountId);
  const anchoringAccount = findAccount(anchoringAccountId);

  const groups = React.useMemo(() => {
    const rows = summaryQuery.data?.groups ?? [];
    return [...rows].sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.open - a.open,
    );
  }, [summaryQuery.data]);

  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!summaryQuery.data) return null;

  const { open_total, waived_total, stale_total } = summaryQuery.data;

  return (
    <div className="space-y-4">
      <ComplianceHeadline
        openTotal={open_total}
        waivedTotal={waived_total}
        staleTotal={stale_total}
        blocked={groups.some((group) => blockingPrerequisite(groups, group) !== null)}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={Check}
          title={t('money.compliance.noDetectors')}
          description={t('money.compliance.noDetectorsHint')}
        />
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <GroupRow
              key={group.kind}
              group={group}
              blockedBy={blockingPrerequisite(groups, group)}
              expanded={openKind === group.kind}
              onToggle={() => setOpenKind((prev) => (prev === group.kind ? null : group.kind))}
              onWaive={setWaiving}
              onFixAccount={setFixingAccountId}
              onAnchorAccount={setAnchoringAccountId}
              onAllocate={setAllocatingId}
            />
          ))}
        </div>
      )}

      <WaiverDialog target={waiving} onClose={() => setWaiving(null)} />

      {fixingAccount ? (
        <AccountDialog
          open
          onOpenChange={(next) => !next && setFixingAccountId(null)}
          existing={fixingAccount}
        />
      ) : null}

      {anchoringAccount ? (
        <BalanceAnchorDialog
          open
          onOpenChange={(next) => !next && setAnchoringAccountId(null)}
          account={anchoringAccount}
        />
      ) : null}

      {allocatingId ? (
        <AllocationDialog
          open
          onOpenChange={(next) => !next && setAllocatingId(null)}
          transactionId={allocatingId}
        />
      ) : null}
    </div>
  );
}

function ComplianceHeadline({
  openTotal,
  waivedTotal,
  staleTotal,
  blocked,
}: {
  openTotal: number;
  waivedTotal: number;
  staleTotal: number;
  /** Au moins un contrôle non évaluable : « tout est conforme » serait faux. */
  blocked: boolean;
}) {
  const { t } = useTranslation();
  const isClean = openTotal === 0 && !blocked;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {isClean ? (
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            {isClean
              ? t('money.compliance.clean')
              : blocked && openTotal === 0
                ? t('money.compliance.blocked')
                : t('money.compliance.openCount', { count: openTotal })}
          </p>
          <p className="text-sm text-muted-foreground">
            {isClean
              ? t('money.compliance.cleanHint')
              : blocked && openTotal === 0
                ? t('money.compliance.blockedHint')
                : t('money.compliance.openHint')}
          </p>
          {waivedTotal > 0 || staleTotal > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('money.compliance.arbitratedCount', { count: waivedTotal })}
              {staleTotal > 0
                ? ` · ${t('money.compliance.staleCount', { count: staleTotal })}`
                : ''}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function GroupRow({
  group,
  blockedBy,
  expanded,
  onToggle,
  onWaive,
  onFixAccount,
  onAnchorAccount,
  onAllocate,
}: {
  group: ComplianceGroup;
  /** Prérequis encore ouvert : ce groupe n'est pas conforme, il est non évaluable. */
  blockedBy: ComplianceGroup | null;
  expanded: boolean;
  onToggle: () => void;
  onWaive: (target: WaiverTarget) => void;
  onFixAccount: (accountId: string) => void;
  onAnchorAccount: (accountId: string) => void;
  onAllocate: (transactionId: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = SEVERITY_ICON[group.severity];
  // Un zéro a deux sens : « rien à signaler » et « rien d'évaluable ». Les confondre
  // affiche une coche verte sur un contrôle qui n'a rien vérifié.
  const isBlocked = blockedBy !== null;
  const isClean = group.open === 0 && !isBlocked;

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/60"
        aria-expanded={expanded}
      >
        {isBlocked ? (
          <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : isClean ? (
          <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <Icon
            className={
              group.severity === 'warning'
                ? 'h-4 w-4 shrink-0 text-muted-foreground'
                : 'h-4 w-4 shrink-0 text-destructive'
            }
            aria-hidden
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">
            {t(`money.compliance.kinds.${group.kind}.title`)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {isBlocked
              ? t('money.compliance.notEvaluable', {
                  prerequisite: t(`money.compliance.kinds.${blockedBy.kind}.title`),
                })
              : isClean
                ? t('money.compliance.groupClean')
                : t(`money.compliance.kinds.${group.kind}.hint`)}
          </p>
        </div>

        {group.severity === 'blocker' && group.open > 0 ? (
          <Badge variant="destructive">{t('money.compliance.prerequisite')}</Badge>
        ) : null}
        {group.stale > 0 ? (
          <Badge variant="outline">{t('money.compliance.staleBadge', { count: group.stale })}</Badge>
        ) : null}
        {group.waived > 0 ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t('money.compliance.waivedShort', { count: group.waived })}
          </span>
        ) : null}
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {isBlocked ? '—' : group.open}
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      {expanded ? (
        <GroupDetail
          group={group}
          onWaive={onWaive}
          onFixAccount={onFixAccount}
          onAnchorAccount={onAnchorAccount}
          onAllocate={onAllocate}
        />
      ) : null}
    </Card>
  );
}

function GroupDetail({
  group,
  onWaive,
  onFixAccount,
  onAnchorAccount,
  onAllocate,
}: {
  group: ComplianceGroup;
  onWaive: (target: WaiverTarget) => void;
  onFixAccount: (accountId: string) => void;
  onAnchorAccount: (accountId: string) => void;
  onAllocate: (transactionId: string) => void;
}) {
  const { t } = useTranslation();
  const [showWaived, setShowWaived] = React.useState(false);
  const openQuery = useComplianceGroup(group.kind, { limit: 25 });
  const waivedQuery = useComplianceGroup(showWaived ? group.kind : undefined, {
    waived: true,
    limit: 25,
  });
  const revoke = useRevokeWaiver();

  const openRows = openQuery.data?.results ?? [];

  return (
    <div className="space-y-3 border-t border-border p-3">
      {/* Pourquoi ce contrôle ne porte peut-être pas sur tout — jamais laissé
          implicite : un chiffre bas doit pouvoir être expliqué. */}
      {group.blocked_by ? (
        <p className="text-xs text-muted-foreground">
          {t('money.compliance.blockedBy', {
            prerequisite: t(`money.compliance.kinds.${group.blocked_by}.title`),
          })}
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {t(`money.compliance.kinds.${group.kind}.resolution`)}
      </p>

      {openQuery.isLoading ? (
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      ) : openRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('money.compliance.groupClean')}</p>
      ) : (
        <ul className="space-y-1.5">
          {openRows.map((finding) => (
            <FindingRow
              key={finding.object_id}
              finding={finding}
              waivable={group.waivable}
              onFix={
                group.kind === ACCOUNT_WITHOUT_WINDOW
                  ? () => onFixAccount(finding.object_id)
                  : undefined
              }
              // Retrouver le solde plutôt que le saisir : proposé dès que le
              // compte porte des lignes, puisque c'est alors une soustraction et
              // non une information que l'utilisateur devrait deviner.
              onAnchor={
                (group.kind === ACCOUNT_WITHOUT_WINDOW && Boolean(finding.detail.earliest_line)) ||
                group.kind === ACCOUNT_ANCHOR_STALE
                  ? () => onAnchorAccount(finding.object_id)
                  : undefined
              }
              onAllocate={
                (PENDING_KINDS as readonly string[]).includes(group.kind)
                  ? () => onAllocate(finding.object_id)
                  : undefined
              }
              onWaive={() =>
                onWaive({
                  kind: group.kind,
                  objectIds: [finding.object_id],
                  label: finding.label,
                  previousReason: finding.is_stale ? finding.waiver_reason : undefined,
                })
              }
            />
          ))}
        </ul>
      )}

      {group.open > openRows.length && openRows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('money.compliance.andMore', { count: group.open - openRows.length })}
        </p>
      ) : null}

      {/* La liste d'audit. Repliée parce qu'elle n'appelle pas à l'action — mais
          présente, parce qu'un arbitrage qu'on ne peut pas relire ne vaut rien. */}
      {group.waived > 0 ? (
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowWaived((prev) => !prev)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showWaived
              ? t('money.compliance.hideArbitrated')
              : t('money.compliance.showArbitrated', { count: group.waived })}
          </button>

          {showWaived ? (
            <ul className="mt-2 space-y-1.5">
              {(waivedQuery.data?.results ?? []).map((finding) => (
                <li
                  key={finding.object_id}
                  className="flex items-start gap-2 rounded-lg bg-muted/40 p-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">{finding.label}</p>
                    <p className="text-xs italic text-muted-foreground">
                      « {finding.waiver_reason} »
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => finding.waiver_id && revoke.mutate(finding.waiver_id)}
                    disabled={revoke.isPending}
                  >
                    <Undo2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                    {t('money.compliance.revoke')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FindingRow({
  finding,
  waivable,
  onWaive,
  onFix,
  onAnchor,
  onAllocate,
}: {
  finding: ComplianceFinding;
  waivable: boolean;
  onWaive: () => void;
  /** Corriger sur place, quand l'écart se règle sur un objet éditable. */
  onFix?: () => void;
  /** Retrouver le solde d'ouverture par arithmétique plutôt qu'à la main. */
  onAnchor?: () => void;
  /** Ventiler la ligne — la **résolution** de l'écart, pas son contournement. */
  onAllocate?: () => void;
}) {
  const { t } = useTranslation();
  const reason = typeof finding.detail.reason === 'string' ? finding.detail.reason : null;

  return (
    <li className="flex items-start gap-2 rounded-lg bg-muted/40 p-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground">{finding.label}</p>

        {/* Les dates concrètes, pas seulement la règle : sans elles l'utilisateur
            sait qu'il doit changer quelque chose mais pas quoi mettre. */}
        {reason === 'opening_date_after_data' ? (
          <p className="text-xs text-muted-foreground">
            {t('money.compliance.window.afterData', {
              openingDate: formatMaybeDate(finding.detail.opening_balance_date),
              earliestLine: formatMaybeDate(finding.detail.earliest_line),
            })}
          </p>
        ) : null}
        {reason === 'no_opening_date' ? (
          <p className="text-xs text-muted-foreground">
            {t('money.compliance.window.noDate')}
          </p>
        ) : null}
        {finding.is_stale ? (
          <p className="text-xs text-warning">
            {t('money.compliance.stale', { reason: finding.waiver_reason })}
          </p>
        ) : null}
        {typeof finding.detail.remaining === 'string' ? (
          <p className="text-xs text-muted-foreground">
            {t('money.compliance.remaining', { amount: finding.detail.remaining })}
          </p>
        ) : null}
        {/* Les deux chiffres qui ne concordent plus. Sans eux « l'ancrage a dérivé »
            n'apprend rien : c'est l'écart chiffré qui dit s'il manque un relevé ou
            si la lecture était fausse. */}
        {typeof finding.detail.drift === 'string' ? (
          <p className="text-xs text-muted-foreground">
            {t('money.compliance.anchorDrift', {
              attested: finding.detail.attested_balance,
              computed: finding.detail.computed_balance,
            })}
          </p>
        ) : null}
      </div>

      {/* La résolution d'abord, et visuellement dominante : « Arbitrer » reste un
          bouton fantôme à côté. Un écart s'arbitre parce qu'on l'a jugé légitime,
          jamais parce que c'était le seul bouton à portée de clic. */}
      {onAllocate ? (
        <Button type="button" size="sm" onClick={onAllocate}>
          {t('money.compliance.allocate')}
        </Button>
      ) : null}

      {onAnchor ? (
        <Button type="button" variant="outline" size="sm" onClick={onAnchor}>
          {t('money.compliance.findBalance')}
        </Button>
      ) : null}

      {onFix ? (
        <Button type="button" variant="outline" size="sm" onClick={onFix}>
          {t('money.compliance.fix')}
        </Button>
      ) : null}

      {waivable ? (
        <Button type="button" variant="ghost" size="sm" onClick={onWaive}>
          {finding.is_stale
            ? t('money.compliance.rearbitrate')
            : t('money.compliance.arbitrate')}
        </Button>
      ) : !onFix && !onAnchor && !onAllocate ? (
        <span className="shrink-0 text-xs italic text-muted-foreground">
          {t('money.compliance.notWaivable')}
        </span>
      ) : null}
    </li>
  );
}

/** Une date ISO en date locale, ou un tiret quand l'information manque. */
function formatMaybeDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  return new Date(value).toLocaleDateString();
}

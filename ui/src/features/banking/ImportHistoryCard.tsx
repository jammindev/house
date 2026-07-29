import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { formatDate } from '@/lib/format';
import type { StatementImport } from '@/lib/api/banking';

interface ImportHistoryCardProps {
  imports: StatementImport[];
  /** Sur la fiche d'un compte, le nom du compte est déjà le titre de la page. */
  hideAccount?: boolean;
  /** Combien de dépôts afficher. 10 sur la liste des comptes, tout sur une fiche. */
  limit?: number;
}

/**
 * Historique des dépôts de relevés.
 *
 * Les imports échoués y figurent au même titre que les réussis : c'est la seule
 * trace qui explique pourquoi un relevé n'est pas dans les comptes.
 *
 * La **période** couverte s'affiche à côté du nombre de lignes, parce que c'est
 * elle qui décide de la fenêtre de conformité du compte : « 116 opérations » ne
 * dit pas jusqu'où le contrôle porte, « du 1er au 31 mars » le dit. Et le nombre
 * de lignes rapprochées toutes seules est le seul chiffre de la trace qui parle de
 * travail épargné plutôt que de volume.
 */
export default function ImportHistoryCard({
  imports,
  hideAccount = false,
  limit = 10,
}: ImportHistoryCardProps) {
  const { t } = useTranslation();

  if (imports.length === 0) return null;

  return (
    <Card className="p-3">
      <CardTitle>{t('banking.import.history')}</CardTitle>

      <ul className="mt-3 space-y-2">
        {imports.slice(0, limit).map((row) => (
          <li key={row.id} className="flex items-start gap-2 text-sm">
            {row.status === 'failed' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            )}

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{row.filename || row.provider}</span>
              </p>

              <p className="text-xs text-muted-foreground">
                {[hideAccount ? '' : row.account_name, formatDate(row.created_at)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              {row.status === 'failed' ? (
                <p className="mt-0.5 text-xs text-destructive">{row.error}</p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    t('banking.import.result.created', { count: row.created_count }),
                    row.skipped_count > 0
                      ? t('banking.import.result.skipped', { count: row.skipped_count })
                      : '',
                    row.auto_matched_count > 0
                      ? t('banking.import.result.autoMatched', { count: row.auto_matched_count })
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}

              {/* La période, quand la banque l'a donnée : c'est elle qui borne le
                  contrôle, pas la date du dépôt. */}
              {row.period_start && row.period_end ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('banking.import.result.period', {
                    from: formatDate(row.period_start),
                    to: formatDate(row.period_end),
                  })}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {imports.length > limit ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t('banking.import.result.more', { count: imports.length - limit })}
        </p>
      ) : null}
    </Card>
  );
}

import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import type { StatementImport } from '@/lib/api/banking';

interface ImportHistoryCardProps {
  imports: StatementImport[];
}

/**
 * Historique des dépôts de relevés.
 *
 * Les imports échoués y figurent au même titre que les réussis : c'est la seule
 * trace qui explique pourquoi un relevé n'est pas dans les comptes.
 */
export default function ImportHistoryCard({ imports }: ImportHistoryCardProps) {
  const { t } = useTranslation();

  if (imports.length === 0) return null;

  return (
    <Card className="p-3">
      <CardTitle>{t('banking.import.history')}</CardTitle>

      <ul className="mt-3 space-y-2">
        {imports.slice(0, 10).map((row) => (
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
                {row.account_name} · {new Date(row.created_at).toLocaleDateString()}
              </p>

              {row.status === 'failed' ? (
                <p className="mt-0.5 text-xs text-destructive">{row.error}</p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('banking.import.result.created', { count: row.created_count })}
                  {row.skipped_count > 0
                    ? ` · ${t('banking.import.result.skipped', { count: row.skipped_count })}`
                    : ''}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

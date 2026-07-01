import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { InsuranceContract } from '@/lib/api/insurance';

interface InsuranceCardProps {
  contract: InsuranceContract;
  onEdit: (contract: InsuranceContract) => void;
  onDelete: (id: string) => void;
}

const TYPE_EMOJI: Record<string, string> = {
  health: '🩺',
  home: '🏠',
  car: '🚗',
  life: '🌱',
  liability: '⚖️',
  other: '📄',
};

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'secondary';
  if (status === 'suspended') return 'outline';
  return 'destructive';
}

export default function InsuranceCard({ contract, onEdit, onDelete }: InsuranceCardProps) {
  const { t } = useTranslation();
  const emoji = TYPE_EMOJI[contract.type] ?? '📄';

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(contract) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(contract.id), variant: 'danger' },
  ];

  const yearlyValue = Number(contract.yearly_cost);
  const monthlyValue = Number(contract.monthly_cost);
  const hasCost = yearlyValue > 0 || monthlyValue > 0;

  return (
    <Card className="p-3 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{`${emoji} ${contract.name}`}</CardTitle>
            <Badge variant="outline" className="text-[11px]">
              {t(`insurance.type.${contract.type}`)}
            </Badge>
            <Badge variant={statusVariant(contract.status)} className="text-[11px]">
              {t(`insurance.status.${contract.status}`)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {contract.provider ? <span>{contract.provider}</span> : null}
            {contract.insured_item ? <span>· {contract.insured_item}</span> : null}
            {contract.contract_number ? <span>· N° {contract.contract_number}</span> : null}
          </div>
          {hasCost ? (
            <div className="text-xs text-muted-foreground">
              {yearlyValue > 0 ? (
                <span>{t('insurance.yearly_cost_value', { value: yearlyValue.toFixed(2) })}</span>
              ) : null}
              {yearlyValue > 0 && monthlyValue > 0 ? <span> · </span> : null}
              {monthlyValue > 0 ? (
                <span>{t('insurance.monthly_cost_value', { value: monthlyValue.toFixed(2) })}</span>
              ) : null}
            </div>
          ) : null}
          {contract.renewal_date ? (
            <div className="text-xs text-muted-foreground">
              {t('insurance.renewal_on', { date: contract.renewal_date })}
            </div>
          ) : null}
        </div>

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}

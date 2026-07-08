import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Droplets, ListPlus, MessageCircle, Receipt, StickyNote, Zap } from 'lucide-react';
import { Button } from '@/design-system/button';
import { useToast } from '@/lib/toast';
import { pushBack } from '@/lib/backNavigation';
import ExpenseAdHocDialog from '@/features/expenses/ExpenseAdHocDialog';
import NewTaskDialog from '@/features/tasks/NewTaskDialog';
import WaterReadingDialog from '@/features/water/WaterReadingDialog';
import ReadingDialog from '@/features/electricity/ReadingDialog';
import { useMeters } from '@/features/electricity/hooks';
import { useWaterReadings } from '@/features/water/hooks';
import { dashboardKeys } from './hooks';

/** One-tap entry points for the most frequent captures. Module-specific
 * actions (readings) only show up once the module holds data. */
export default function QuickActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [waterOpen, setWaterOpen] = React.useState(false);
  const [elecOpen, setElecOpen] = React.useState(false);

  const { data: meters = [] } = useMeters();
  const { data: waterReadings = [] } = useWaterReadings();

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
        <Receipt className="mr-1.5 h-4 w-4" aria-hidden />
        {t('dashboard.quickActions.expense')}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setTaskOpen(true)}>
        <ListPlus className="mr-1.5 h-4 w-4" aria-hidden />
        {t('dashboard.quickActions.task')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/app/interactions/new?type=note', { state: pushBack(location) })}
      >
        <StickyNote className="mr-1.5 h-4 w-4" aria-hidden />
        {t('dashboard.quickActions.note')}
      </Button>
      {waterReadings.length > 0 ? (
        <Button variant="outline" size="sm" onClick={() => setWaterOpen(true)}>
          <Droplets className="mr-1.5 h-4 w-4" aria-hidden />
          {t('dashboard.quickActions.waterReading')}
        </Button>
      ) : null}
      {meters.length > 0 ? (
        <Button variant="outline" size="sm" onClick={() => setElecOpen(true)}>
          <Zap className="mr-1.5 h-4 w-4" aria-hidden />
          {t('dashboard.quickActions.meterReading')}
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/app/agent', { state: pushBack(location) })}
      >
        <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />
        {t('dashboard.quickActions.askAgent')}
      </Button>

      <ExpenseAdHocDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
      <NewTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: dashboardKeys.myWeek() });
          toast({ description: t('dashboard.quickActions.taskCreated'), variant: 'success' });
        }}
      />
      <WaterReadingDialog open={waterOpen} onOpenChange={setWaterOpen} />
      {meters.length > 0 ? (
        <ReadingDialog open={elecOpen} onOpenChange={setElecOpen} meter={meters[0]} />
      ) : null}
    </div>
  );
}

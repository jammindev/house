import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';
import DashboardPage, { type DashboardPageProps } from '../../../../apps/accounts/react/DashboardPage';

onDomReady(() => {
  mountWithJsonScriptProps<DashboardPageProps>('dashboard-root', 'dashboard-props', DashboardPage);
});
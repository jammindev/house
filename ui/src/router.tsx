import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
import ModuleRoute from './components/ModuleRoute';
import LegacyMoneyRedirect from './components/LegacyMoneyRedirect';
import PreserveQueryRedirect from './components/PreserveQueryRedirect';
import LoginPage from './features/auth/LoginPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import NotFoundPage from './features/general/NotFoundPage';
import { lazyWithReload } from './lib/lazyWithReload';

const TasksPage = lazyWithReload(() => import('./features/tasks/TasksPage'));
const TaskDetailPage = lazyWithReload(() => import('./features/tasks/TaskDetailPage'));
const ZonesPage = lazyWithReload(() => import('./features/zones/ZonesPage'));
const ZoneDetailPage = lazyWithReload(() => import('./features/zones/ZoneDetailPage'));
const InteractionsPage = lazyWithReload(() => import('./features/interactions/InteractionsPage'));
const InteractionDetailPage = lazyWithReload(() => import('./features/interactions/InteractionDetailPage'));
const InteractionNewPage = lazyWithReload(() => import('./features/interactions/InteractionNewPage'));
const InteractionEditPage = lazyWithReload(() => import('./features/interactions/InteractionEditPage'));
const ProjectsPage = lazyWithReload(() => import('./features/projects/ProjectsPage'));
const ProjectDetailPage = lazyWithReload(() => import('./features/projects/ProjectDetailPage'));
const EquipmentPage = lazyWithReload(() => import('./features/equipment/EquipmentPage'));
const EquipmentDetailPage = lazyWithReload(() => import('./features/equipment/EquipmentDetailPage'));
const StockPage = lazyWithReload(() => import('./features/stock/StockPage'));
const StockItemDetailPage = lazyWithReload(() => import('./features/stock/StockItemDetailPage'));
const ShoppingListPage = lazyWithReload(() => import('./features/shopping/ShoppingListPage'));
const DocumentsPage = lazyWithReload(() => import('./features/documents/DocumentsPage'));
const DocumentDetailPage = lazyWithReload(() => import('./features/documents/DocumentDetailPage'));
const DirectoryPage = lazyWithReload(() => import('./features/directory/DirectoryFeaturePage'));
const ElectricityPage = lazyWithReload(() => import('./features/electricity/ElectricityPage'));
const WaterPage = lazyWithReload(() => import('./features/water/WaterPage'));
const WeatherPage = lazyWithReload(() => import('./features/weather/WeatherPage'));
const TrackersPage = lazyWithReload(() => import('./features/trackers/TrackersPage'));
const ChickensPage = lazyWithReload(() => import('./features/chickens/ChickensPage'));
const ChickenDetailPage = lazyWithReload(() => import('./features/chickens/ChickenDetailPage'));
const TrackerDetailPage = lazyWithReload(() => import('./features/trackers/TrackerDetailPage'));
const TrackerEntryRedirect = lazyWithReload(() => import('./features/trackers/TrackerEntryRedirect'));
const InsurancePage = lazyWithReload(() => import('./features/insurance/InsurancePage'));
const PhotosPage = lazyWithReload(() => import('./features/photos/PhotosPage'));
const SettingsPage = lazyWithReload(() => import('./features/settings/SettingsPage'));
const DashboardPage = lazyWithReload(() => import('./features/dashboard/DashboardPage'));
const AlertsPage = lazyWithReload(() => import('./features/alerts/AlertsPage'));
const NotificationsPage = lazyWithReload(() => import('./features/notifications/NotificationsPage'));
const AdminUsersPage = lazyWithReload(() => import('./features/admin/AdminUsersPage'));
const AIUsagePage = lazyWithReload(() => import('./features/ai-usage/AIUsagePage'));
const AgentPage = lazyWithReload(() => import('./features/agent/AgentPage'));
const MemoryPage = lazyWithReload(() => import('./features/agent/MemoryPage'));
const DigestPage = lazyWithReload(() => import('./features/digest/DigestPage'));
const BriefingsPage = lazyWithReload(() => import('./features/briefings/BriefingsPage'));
const MoneyPage = lazyWithReload(() => import('./features/money/MoneyPage'));
const RecurringPage = lazyWithReload(() => import('./features/budget/RecurringPage'));
const ReportsPage = lazyWithReload(() => import('./features/budget/ReportsPage'));
const MoneyAnalysisPage = lazyWithReload(() => import('./features/money/AnalysisPage'));
const BudgetDetailPage = lazyWithReload(() => import('./features/money/BudgetDetailPage'));
const ExpenseDetailPage = lazyWithReload(() => import('./features/money/ExpenseDetailPage'));
const BankingTransactionsPage = lazyWithReload(
  () => import('./features/banking/TransactionsPage'),
);
const BankingTransactionDetailPage = lazyWithReload(
  () => import('./features/banking/TransactionDetailPage'),
);
const ChangelogPage = lazyWithReload(() => import('./features/changelog/ChangelogPage'));
const TutorialsPage = lazyWithReload(() => import('./features/tutorials/TutorialsPage'));
const TutorialGuidePage = lazyWithReload(() => import('./features/tutorials/TutorialGuidePage'));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/app',
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'tasks/:id', element: <TaskDetailPage /> },
      { path: 'zones', element: <ZonesPage /> },
      { path: 'zones/:id', element: <ZoneDetailPage /> },
      { path: 'interactions', element: <InteractionsPage /> },
      { path: 'interactions/new', element: <InteractionNewPage /> },
      { path: 'interactions/:id', element: <InteractionDetailPage /> },
      { path: 'interactions/:id/edit', element: <InteractionEditPage /> },
      { path: 'money', element: <MoneyPage /> },
      { path: 'money/transactions', element: <BankingTransactionsPage /> },
      { path: 'money/transactions/:id', element: <BankingTransactionDetailPage /> },
      { path: 'money/analysis', element: <MoneyAnalysisPage /> },
      { path: 'money/budgets/:id', element: <BudgetDetailPage /> },
      // Une dépense est une `Interaction`, mais sa fiche appartient à la famille
      // argent : elle vit donc sous `/app/money`, comme toute URL de la famille.
      { path: 'money/expenses/:id', element: <ExpenseDetailPage /> },
      { path: 'money/recurring', element: <RecurringPage /> },
      { path: 'money/reports', element: <ReportsPage /> },
      // Anciennes URLs (parcours 26, lot 2) : les favoris, les liens de l'agent et
      // les tutoriels pointent encore dessus. La query string est **préservée** —
      // `?b={id}` vient de `budget/apps.py::SearchableSpec.url_template`.
      { path: 'expenses', element: <LegacyMoneyRedirect tab="expenses" /> },
      { path: 'budget', element: <LegacyMoneyRedirect tab="budgets" /> },
      { path: 'banking', element: <LegacyMoneyRedirect tab="accounts" /> },
      { path: 'banking/transactions', element: <Navigate to="/app/money/transactions" replace /> },
      // Les deux dernières pages restées hors de la famille : `?r={id}` de l'agent
      // survit au déplacement.
      { path: 'budget/recurring', element: <PreserveQueryRedirect to="/app/money/recurring" /> },
      { path: 'budget/reports', element: <PreserveQueryRedirect to="/app/money/reports" /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'equipment/:id', element: <EquipmentDetailPage /> },
      { path: 'stock', element: <ModuleRoute moduleKey="stock"><StockPage /></ModuleRoute> },
      { path: 'stock/:id', element: <ModuleRoute moduleKey="stock"><StockItemDetailPage /></ModuleRoute> },
      { path: 'shopping-list', element: <ModuleRoute moduleKey="shopping"><ShoppingListPage /></ModuleRoute> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/:id', element: <DocumentDetailPage /> },
      { path: 'directory', element: <ModuleRoute moduleKey="directory"><DirectoryPage /></ModuleRoute> },
      { path: 'electricity', element: <ModuleRoute moduleKey="electricity"><ElectricityPage /></ModuleRoute> },
      { path: 'water', element: <ModuleRoute moduleKey="water"><WaterPage /></ModuleRoute> },
      { path: 'weather', element: <ModuleRoute moduleKey="weather"><WeatherPage /></ModuleRoute> },
      { path: 'chickens', element: <ModuleRoute moduleKey="chickens"><ChickensPage /></ModuleRoute> },
      { path: 'chickens/:id', element: <ModuleRoute moduleKey="chickens"><ChickenDetailPage /></ModuleRoute> },
      { path: 'trackers', element: <ModuleRoute moduleKey="trackers"><TrackersPage /></ModuleRoute> },
      { path: 'trackers/:id', element: <ModuleRoute moduleKey="trackers"><TrackerDetailPage /></ModuleRoute> },
      { path: 'tracker-entries/:id', element: <ModuleRoute moduleKey="trackers"><TrackerEntryRedirect /></ModuleRoute> },
      { path: 'insurance', element: <ModuleRoute moduleKey="insurance"><InsurancePage /></ModuleRoute> },
      { path: 'photos', element: <ModuleRoute moduleKey="photos"><PhotosPage /></ModuleRoute> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'tutorial', element: <TutorialsPage /> },
      { path: 'tutorial/:key', element: <TutorialGuidePage /> },
      { path: 'agent', element: <AgentPage /> },
      { path: 'agent/memory', element: <MemoryPage /> },
      { path: 'digest', element: <DigestPage /> },
      { path: 'briefings', element: <BriefingsPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
      { path: 'admin/ai-usage', element: <AIUsagePage /> },
      { path: 'admin/changelog', element: <ChangelogPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/app" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/app" replace />,
  },
]);

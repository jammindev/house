import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
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
const DocumentsPage = lazyWithReload(() => import('./features/documents/DocumentsPage'));
const DocumentDetailPage = lazyWithReload(() => import('./features/documents/DocumentDetailPage'));
const DirectoryPage = lazyWithReload(() => import('./features/directory/DirectoryFeaturePage'));
const ElectricityPage = lazyWithReload(() => import('./features/electricity/ElectricityPage'));
const WaterPage = lazyWithReload(() => import('./features/water/WaterPage'));
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
const ExpensesPage = lazyWithReload(() => import('./features/expenses/ExpensesPage'));
const ChangelogPage = lazyWithReload(() => import('./features/changelog/ChangelogPage'));

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
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'equipment/:id', element: <EquipmentDetailPage /> },
      { path: 'stock', element: <StockPage /> },
      { path: 'stock/:id', element: <StockItemDetailPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/:id', element: <DocumentDetailPage /> },
      { path: 'directory', element: <DirectoryPage /> },
      { path: 'electricity', element: <ElectricityPage /> },
      { path: 'water', element: <WaterPage /> },
      { path: 'chickens', element: <ChickensPage /> },
      { path: 'chickens/:id', element: <ChickenDetailPage /> },
      { path: 'trackers', element: <TrackersPage /> },
      { path: 'trackers/:id', element: <TrackerDetailPage /> },
      { path: 'tracker-entries/:id', element: <TrackerEntryRedirect /> },
      { path: 'insurance', element: <InsurancePage /> },
      { path: 'photos', element: <PhotosPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'agent', element: <AgentPage /> },
      { path: 'agent/memory', element: <MemoryPage /> },
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

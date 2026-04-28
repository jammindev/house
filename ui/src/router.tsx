import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './features/auth/LoginPage';
import { lazyWithReload } from './lib/lazyWithReload';

const TasksPage = lazyWithReload(() => import('./features/tasks/TasksPage'));
const ZonesPage = lazyWithReload(() => import('./features/zones/ZonesPage'));
const ZoneDetailPage = lazyWithReload(() => import('./features/zones/ZoneDetailPage'));
const InteractionsPage = lazyWithReload(() => import('./features/interactions/InteractionsPage'));
const InteractionNewPage = lazyWithReload(() => import('./features/interactions/InteractionNewPage'));
const InteractionEditPage = lazyWithReload(() => import('./features/interactions/InteractionEditPage'));
const ProjectsPage = lazyWithReload(() => import('./features/projects/ProjectsPage'));
const ProjectDetailPage = lazyWithReload(() => import('./features/projects/ProjectDetailPage'));
const EquipmentPage = lazyWithReload(() => import('./features/equipment/EquipmentPage'));
const EquipmentDetailPage = lazyWithReload(() => import('./features/equipment/EquipmentDetailPage'));
const StockPage = lazyWithReload(() => import('./features/stock/StockPage'));
const DocumentsPage = lazyWithReload(() => import('./features/documents/DocumentsPage'));
const DocumentDetailPage = lazyWithReload(() => import('./features/documents/DocumentDetailPage'));
const DirectoryPage = lazyWithReload(() => import('./features/directory/DirectoryFeaturePage'));
const ElectricityPage = lazyWithReload(() => import('./features/electricity/ElectricityPage'));
const PhotosPage = lazyWithReload(() => import('./features/photos/PhotosPage'));
const SettingsPage = lazyWithReload(() => import('./features/settings/SettingsPage'));
const DashboardPage = lazyWithReload(() => import('./features/dashboard/DashboardPage'));
const AlertsPage = lazyWithReload(() => import('./features/alerts/AlertsPage'));
const AdminUsersPage = lazyWithReload(() => import('./features/admin/AdminUsersPage'));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/app',
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'zones', element: <ZonesPage /> },
      { path: 'zones/:id', element: <ZoneDetailPage /> },
      { path: 'interactions', element: <InteractionsPage /> },
      { path: 'interactions/new', element: <InteractionNewPage /> },
      { path: 'interactions/:id/edit', element: <InteractionEditPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'equipment', element: <EquipmentPage /> },
      { path: 'equipment/:id', element: <EquipmentDetailPage /> },
      { path: 'stock', element: <StockPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/:id', element: <DocumentDetailPage /> },
      { path: 'directory', element: <DirectoryPage /> },
      { path: 'electricity', element: <ElectricityPage /> },
      { path: 'photos', element: <PhotosPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/app" replace />,
  },
]);

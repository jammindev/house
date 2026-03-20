import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './features/auth/LoginPage';

const TasksPage = lazy(() => import('./features/tasks/TasksPage'));
const ZonesPage = lazy(() => import('./features/zones/ZonesPage'));
const ZoneDetailPage = lazy(() => import('./features/zones/ZoneDetailPage'));
const InteractionsPage = lazy(() => import('./features/interactions/InteractionsPage'));
const InteractionNewPage = lazy(() => import('./features/interactions/InteractionNewPage'));
const InteractionEditPage = lazy(() => import('./features/interactions/InteractionEditPage'));
const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./features/projects/ProjectDetailPage'));
const EquipmentPage = lazy(() => import('./features/equipment/EquipmentPage'));
const EquipmentDetailPage = lazy(() => import('./features/equipment/EquipmentDetailPage'));
const StockPage = lazy(() => import('./features/stock/StockPage'));
const DocumentsPage = lazy(() => import('./features/documents/DocumentsPage'));
const DocumentDetailPage = lazy(() => import('./features/documents/DocumentDetailPage'));
const DirectoryPage = lazy(() => import('./features/directory/DirectoryFeaturePage'));
const ElectricityPage = lazy(() => import('./features/electricity/ElectricityPage'));
const PhotosPage = lazy(() => import('./features/photos/PhotosPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const AdminUsersPage = lazy(() => import('./features/admin/AdminUsersPage'));

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
      { path: 'settings', element: <SettingsPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/app" replace />,
  },
]);

import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './features/auth/LoginPage';
import TasksPage from './features/tasks/TasksPage';
import ZonesPage from './features/zones/ZonesPage';
import ZoneDetailPage from './features/zones/ZoneDetailPage';
import InteractionsPage from './features/interactions/InteractionsPage';
import InteractionNewPage from './features/interactions/InteractionNewPage';
import InteractionEditPage from './features/interactions/InteractionEditPage';
import ProjectsPage from './features/projects/ProjectsPage';
import ProjectDetailPage from './features/projects/ProjectDetailPage';
import EquipmentPage from './features/equipment/EquipmentPage';
import EquipmentDetailPage from './features/equipment/EquipmentDetailPage';
import StockPage from './features/stock/StockPage';
import DocumentsPage from './features/documents/DocumentsPage';
import DocumentDetailPage from './features/documents/DocumentDetailPage';
import DirectoryPage from './features/directory/DirectoryFeaturePage';
import ElectricityPage from './features/electricity/ElectricityPage';
import PhotosPage from './features/photos/PhotosPage';
import SettingsPage from './features/settings/SettingsPage';
import DashboardPage from './features/dashboard/DashboardPage';
import AdminUsersPage from './features/admin/AdminUsersPage';

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

// Admin users management page
import { AdminHeader } from '@/features/admin/components/AdminNav';
import { UserManagement } from '@/features/admin/components/UserManagement';

export default function AdminUsersPage() {
    return (
        <div className="flex-1">
            <AdminHeader
                title="Gestion des utilisateurs"
                description="Administrer les comptes utilisateurs et leurs permissions"
            />
            <div className="p-6">
                <UserManagement />
            </div>
        </div>
    );
}
// Admin management page (super admin only)
import { AdminHeader } from '@/features/admin/components/AdminNav';
import { AdminManagement } from '@/features/admin/components/AdminManagement';

export default function AdminAdminsPage() {
    return (
        <div className="flex-1">
            <AdminHeader
                title="Gestion des administrateurs"
                description="Administrer les rôles et permissions des administrateurs système"
            />
            <div className="p-6">
                <AdminManagement />
            </div>
        </div>
    );
}
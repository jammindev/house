// Admin households management page
import { AdminHeader } from '@/features/admin/components/AdminNav';
import { HouseholdManagement } from '@/features/admin/components/HouseholdManagement';

export default function AdminHouseholdsPage() {
    return (
        <div className="flex-1">
            <AdminHeader
                title="Gestion des foyers"
                description="Administrer les foyers et leur contenu"
            />
            <div className="p-6">
                <HouseholdManagement />
            </div>
        </div>
    );
}
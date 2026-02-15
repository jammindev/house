// Main admin dashboard page
import { AdminHeader } from '@/features/admin/components/AdminNav';
import { AdminDashboard } from '@/features/admin/components/AdminDashboard';

export default function AdminPage() {
    return (
        <div className="flex-1">
            <AdminHeader
                title="Administration"
                description="Vue d'ensemble du système House"
            />
            <div className="p-6">
                <AdminDashboard />
            </div>
        </div>
    );
}
// System configuration page
import { AdminHeader } from '@/features/admin/components/AdminNav';
import { SystemManagement } from '@/features/admin/components/SystemManagement';

export default function AdminSystemPage() {
  return (
    <div className="flex-1">
      <AdminHeader 
        title="Configuration système" 
        description="Surveillance et maintenance du système House"
      />
      <div className="p-6">
        <SystemManagement />
      </div>
    </div>
  );
}
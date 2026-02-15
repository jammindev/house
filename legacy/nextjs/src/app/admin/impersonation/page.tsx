import { AdminHeader } from "@/features/admin/components/AdminNav";
import { ImpersonationPanel } from "@/features/admin/components/ImpersonationPanel";

export default function AdminImpersonationPage() {
    return (
        <div className="flex-1">
            <AdminHeader
                title="Impersonation"
                description="Consulter l'application en se connectant temporairement en tant qu'un autre utilisateur"
            />
            <div className="p-6">
                <ImpersonationPanel />
            </div>
        </div>
    );
}


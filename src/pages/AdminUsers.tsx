import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserManagement } from "@/components/settings/UserManagement";
import { useUser } from "@/contexts/UserContext";
import { Navigate } from "react-router-dom";
import { hasPermission } from "@/config/permissions";

export default function AdminUsers() {
    const { user, isLoading } = useUser();

    if (isLoading) return null;

    if (!user || !hasPermission(user, 'MANAGE_USERS')) {
        return <Navigate to="/" replace />;
    }

    return (
        <PageLayout>
            <PageHeader
                title=""
                subtitle=""
            />
            {/* We render UserManagement directly. It has its own Card structure.
                The PageLayout provides padding.
                If UserManagement already has a Card with shadow, it will look fine.
             */}
            <UserManagement />
        </PageLayout>
    );
}

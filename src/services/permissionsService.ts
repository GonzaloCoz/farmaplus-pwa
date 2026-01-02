import { supabase } from "@/integrations/supabase/client";
import { Permission, ROLE_PERMISSIONS } from "@/config/permissions";
import { PERMISSION_DETAILS } from "@/config/permissionDetails";

export const permissionsService = {
    // Get all available permissions definition
    async getAllPermissions() {
        const { data, error } = await supabase
            // @ts-ignore
            .from('permissions' as any)
            .select('*')
            .order('category', { ascending: true })
            .order('code', { ascending: true });

        if (error || !data || data.length === 0) {
            console.log("Using static permissions fallback");
            return PERMISSION_DETAILS;
        }

        return data;
    },

    // Get permissions assigned to a specific role
    async getRolePermissions(role: string): Promise<Permission[]> {
        try {
            const { data, error } = await supabase
                // @ts-ignore
                .from('role_permissions' as any)
                .select('permission_code')
                .eq('role', role);

            if (error) {
                console.error(`Error fetching permissions for role ${role}:`, error);
                // Fallback to hardcoded if DB fails
                return ROLE_PERMISSIONS[role] || [];
            }

            // @ts-ignore
            return data.map(p => p.permission_code as Permission);
        } catch (e) {
            console.error("Unexpected error fetching role permissions", e);
            return ROLE_PERMISSIONS[role] || [];
        }
    },

    // Update permissions for a role (Admin only)
    async updateRolePermissions(role: string, permissionCodes: string[]) {
        // 1. Delete existing
        const { error: deleteError } = await supabase
            // @ts-ignore
            .from('role_permissions' as any)
            .delete()
            .eq('role', role);

        if (deleteError) throw deleteError;

        // 2. Insert new
        if (permissionCodes.length > 0) {
            const insertData = permissionCodes.map(code => ({
                role: role,
                permission_code: code
            }));

            const { error: insertError } = await supabase
                // @ts-ignore
                .from('role_permissions' as any)
                .insert(insertData as any);

            if (insertError) throw insertError;
        }
    }
};

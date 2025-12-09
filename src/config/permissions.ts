import { User } from "@/contexts/UserContext";

export type Permission =
    | 'VIEW_ADMIN_DASHBOARD'
    | 'MANAGE_INVENTORY_CONFIG'
    | 'VIEW_BRANCH_MONITOR'
    | 'EDIT_SETTINGS'
    | 'IMPERSONATE_BRANCH';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    'admin': [
        'VIEW_ADMIN_DASHBOARD',
        'MANAGE_INVENTORY_CONFIG',
        'VIEW_BRANCH_MONITOR',
        'EDIT_SETTINGS',
        'IMPERSONATE_BRANCH'
    ],
    'branch': [
        // Basic permissions
    ]
};

export function hasPermission(user: User | null, permission: Permission): boolean {
    if (!user) return false;

    // Safety check for role persistence
    // If user has no role but implies admin via ID/Name (legacy check), fallback?
    // Stick to strict role check.
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return userPermissions.includes(permission);
}

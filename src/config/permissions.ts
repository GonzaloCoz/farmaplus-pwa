import { User } from "@/contexts/UserContext";

export type Permission =
    | 'VIEW_ADMIN_DASHBOARD'
    | 'MANAGE_INVENTORY_CONFIG'
    | 'VIEW_BRANCH_MONITOR'
    | 'EDIT_SETTINGS'
    | 'IMPERSONATE_BRANCH'
    | 'EDIT_DASHBOARD_LAYOUT'
    | 'MANAGE_CALENDAR_EVENTS'
    | 'MANAGE_USERS'; // Special for gcoz

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    'admin': [
        'VIEW_ADMIN_DASHBOARD',
        'MANAGE_INVENTORY_CONFIG',
        'VIEW_BRANCH_MONITOR',
        'EDIT_SETTINGS',
        'IMPERSONATE_BRANCH',
        'EDIT_DASHBOARD_LAYOUT',
        'MANAGE_CALENDAR_EVENTS'
    ],
    'mod': [
        'VIEW_BRANCH_MONITOR',
        'VIEW_ADMIN_DASHBOARD',
        'EDIT_DASHBOARD_LAYOUT',
        'MANAGE_CALENDAR_EVENTS',
        'MANAGE_INVENTORY_CONFIG'
    ],
    'branch': [
        // Basic permissions
    ]
};

export function hasPermission(user: User | null, permission: Permission): boolean {
    if (!user) return false;

    // Special override for gcoz for MANAGE_USERS
    if (permission === 'MANAGE_USERS') {
        return user.username.toLowerCase() === 'gcoz';
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return userPermissions.includes(permission);
}

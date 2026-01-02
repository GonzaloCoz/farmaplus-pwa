import { Permission } from "./permissions";

export interface PermissionDetail {
    id: string;
    code: Permission;
    description: string;
    category: 'Visibilidad' | 'Personalización' | 'Operaciones' | 'Administración';
}

export const PERMISSION_DETAILS: PermissionDetail[] = [
    {
        id: '1',
        code: 'VIEW_ADMIN_DASHBOARD',
        description: 'Ver Panel Administrador',
        category: 'Visibilidad'
    },
    {
        id: '2',
        code: 'VIEW_BRANCH_MONITOR',
        description: 'Ver Monitor de Sucursales',
        category: 'Visibilidad'
    },
    {
        id: '3',
        code: 'EDIT_DASHBOARD_LAYOUT',
        description: 'Editar Diseño del Panel',
        category: 'Personalización'
    },
    {
        id: '4',
        code: 'MANAGE_CALENDAR_EVENTS',
        description: 'Gestionar Eventos de Calendario',
        category: 'Operaciones'
    },
    {
        id: '5',
        code: 'MANAGE_INVENTORY_CONFIG',
        description: 'Configurar Plazos de Inventario',
        category: 'Operaciones'
    },
    {
        id: '6',
        code: 'IMPERSONATE_BRANCH',
        description: 'Simular Sucursal',
        category: 'Administración'
    },
    {
        id: '7',
        code: 'EDIT_SETTINGS',
        description: 'Modificar Ajustes de App',
        category: 'Administración'
    },
    {
        id: '8',
        code: 'MANAGE_USERS',
        description: 'Gestión de Usuarios',
        category: 'Administración'
    }
];

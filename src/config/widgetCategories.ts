import { DollarSign, Activity, BarChart3, AlertCircle, Package, Zap } from 'lucide-react';

export interface WidgetCategory {
    id: string;
    name: string;
    icon: any;
    description: string;
}

export const WIDGET_CATEGORIES: Record<string, WidgetCategory> = {
    metrics: {
        id: 'metrics',
        name: 'Métricas',
        icon: DollarSign,
        description: 'Indicadores financieros y de rendimiento',
    },
    inventory: {
        id: 'inventory',
        name: 'Inventario',
        icon: Package,
        description: 'Gestión y control de inventarios',
    },
    analytics: {
        id: 'analytics',
        name: 'Análisis',
        icon: BarChart3,
        description: 'Gráficos y reportes analíticos',
    },
    actions: {
        id: 'actions',
        name: 'Acciones',
        icon: Zap,
        description: 'Acciones rápidas y utilidades',
    },
    alerts: {
        id: 'alerts',
        name: 'Alertas',
        icon: AlertCircle,
        description: 'Notificaciones y recordatorios',
    },
    activity: {
        id: 'activity',
        name: 'Actividad',
        icon: Activity,
        description: 'Seguimiento de actividad y usuarios',
    },
};

// Mapeo de widget types a categorías
export const WIDGET_CATEGORY_MAP: Record<string, string> = {
    'metrics-carousel': 'metrics',
    'active-products': 'inventory',
    'inventory-summary': 'inventory',
    'inventory-alerts': 'alerts',
    'upcoming-inventories': 'inventory',
    'branches-table': 'activity',
    'inventory-progress': 'inventory',
    'critical-products': 'alerts',
    'total-stock-value': 'metrics',
    'active-users': 'activity',
    'pending-inventories': 'inventory',
    'trends-chart': 'analytics',
    'top-products': 'analytics',
    'activity-timeline': 'activity',
    'category-distribution': 'analytics',
    'monthly-goals': 'metrics',
    'sync-status': 'actions',
    'quick-actions': 'actions',
    'countdown': 'alerts',
    'category-progress': 'analytics',
    'calendar': 'actions',
};

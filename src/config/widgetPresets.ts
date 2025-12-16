import { BarChart3, Zap, TrendingUp, Grid3x3 } from 'lucide-react';

export interface LayoutPreset {
    id: string;
    name: string;
    description: string;
    icon: any;
    widgetIds: string[];
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
    {
        id: 'executive',
        name: 'Ejecutivo',
        description: 'Vista enfocada en métricas financieras y tendencias',
        icon: TrendingUp,
        widgetIds: [
            'metrics-carousel',
            'total-stock-value',
            'trends-chart',
            'category-distribution',
            'monthly-goals',
            'branches-table',
        ],
    },
    {
        id: 'operational',
        name: 'Operativo',
        description: 'Vista para operaciones diarias e inventarios',
        icon: Zap,
        widgetIds: [
            'metrics-carousel',
            'active-products',
            'countdown',
            'inventory-alerts',
            'upcoming-inventories',
            'pending-inventories',
            'quick-actions',
            'category-progress',
        ],
    },
    {
        id: 'analytical',
        name: 'Analítico',
        description: 'Vista con gráficos y análisis detallados',
        icon: BarChart3,
        widgetIds: [
            'metrics-carousel',
            'trends-chart',
            'category-distribution',
            'top-products',
            'category-progress',
            'inventory-progress',
            'critical-products',
        ],
    },
    {
        id: 'complete',
        name: 'Completo',
        description: 'Todos los widgets disponibles',
        icon: Grid3x3,
        widgetIds: [
            'metrics-carousel',
            'active-products',
            'countdown',
            'inventory-summary',
            'inventory-alerts',
            'upcoming-inventories',
            'branches-table',
            'inventory-progress',
            'critical-products',
            'total-stock-value',
            'active-users',
            'pending-inventories',
            'trends-chart',
            'top-products',
            'activity-timeline',
            'category-distribution',
            'monthly-goals',
            'sync-status',
            'quick-actions',
            'category-progress',
        ],
    },
];

import React from 'react';
import type { Widget } from '@/types/dashboard';
import { Calendar, AlertCircle as AlertCircleIcon, Calendar as CalendarClock, Building01 as Building2, RefreshCw01 as History, PieChart01 as PieChart, Cloud01 as Brain } from '@untitledui/icons';

const DEFAULT_WIDGETS: Widget[] = [
    {
        id: 'countdown',
        type: 'countdown',
        title: 'Contador de Días',
        description: 'Días restantes para finalizar conteo cíclico',
        icon: Calendar,
        visible: true,
        order: 0,
        size: 'small',
        span: 1,
        row: 'top'
    },
    {
        id: 'metrics-carousel',
        type: 'metrics-carousel',
        title: 'Sobrantes de Inventario',
        description: 'Evolución mensual de diferencias positivas',
        icon: History,
        visible: true,
        order: 1,
        size: 'small',
        span: 1,
        row: 'top',
        mandatory: true
    },
    {
        id: 'trends-chart',
        type: 'trends-chart',
        title: 'Faltantes de Inventario',
        description: 'Evolución mensual de diferencias negativas',
        icon: History,
        visible: true,
        order: 2,
        size: 'small',
        span: 1,
        row: 'top',
        mandatory: true
    },
    {
        id: 'smart-analyst',
        type: 'smart-analyst',
        title: 'Analista Inteligente',
        description: 'Análisis automático de inventario',
        icon: Brain,
        visible: true,
        order: 3,
        size: 'small',
        span: 2,
        row: 'top'
    },
    {
        id: 'category-progress',
        type: 'category-progress',
        title: 'Progreso por Rubros',
        description: 'Avance de inventario por categoría',
        icon: PieChart,
        visible: true,
        order: 4,
        size: 'large',
        span: 1,
        row: 'middle'
    },
    {
        id: 'upcoming-inventories',
        type: 'upcoming-inventories',
        title: 'Próximos Inventarios',
        description: 'Inventarios programados',
        icon: CalendarClock,
        visible: true,
        order: 5,
        size: 'large',
        span: 1,
        row: 'middle'
    },
    {
        id: 'inventory-alerts',
        type: 'inventory-alerts',
        title: 'Alertas de Inventario',
        description: 'Notificaciones importantes',
        icon: AlertCircleIcon,
        visible: true,
        order: 6,
        size: 'large',
        span: 1,
        row: 'middle'
    },
    {
        id: 'branches-table',
        type: 'branches-table',
        title: 'Tabla de Sucursales',
        description: 'Listado completo de sucursales',
        icon: Building2,
        visible: true,
        order: 7,
        size: 'full',
        span: 1,
        row: 'bottom'
    }
];

export function useDashboardLayout(userId?: string) {
    return {
        visibleWidgets: DEFAULT_WIDGETS,
        hiddenWidgets: [] as Widget[],
        isEditMode: false,
        setIsEditMode: (value: boolean) => {},
        reorderWidgets: (activeId: string, overId: string) => {},
        toggleWidgetVisibility: (widgetId: string) => {},
        updateWidgetSize: (widgetId: string, newSize: any) => {},
        applyPreset: (widgetIds: string[]) => {},
        resetLayout: () => {}
    };
}

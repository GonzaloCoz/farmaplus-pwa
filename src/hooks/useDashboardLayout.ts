import { useState, useEffect } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { Widget, DashboardLayout } from '@/types/dashboard';
import {
    DollarSign,
    Activity,
    BarChart3,
    AlertCircle as AlertCircleIcon,
    CalendarClock,
    Building2,
    TrendingUp,
    AlertTriangle,
    Users,
    Clock,
    LineChart,
    Trophy,
    History,
    PieChart,
    Target,
    Wifi,
    Zap,
    Calendar
} from 'lucide-react';

const DEFAULT_WIDGETS: Widget[] = [
    {
        id: 'metrics-carousel',
        type: 'metrics-carousel',
        title: 'Métricas Financieras',
        description: 'Diferencia neta, negativos y positivos',
        icon: DollarSign,
        visible: true,
        order: 0,
        size: 'small',
        mandatory: true
    },
    {
        id: 'active-products',
        type: 'active-products',
        title: 'Productos Activos',
        description: 'Total de productos en inventarios',
        icon: Activity,
        visible: true,
        order: 1,
        size: 'small'
    },
    {
        id: 'inventory-summary',
        type: 'inventory-summary',
        title: 'Resumen de Inventario',
        description: 'Progreso de productos en stock',
        icon: BarChart3,
        visible: true,
        order: 2,
        size: 'large'
    },
    {
        id: 'inventory-alerts',
        type: 'inventory-alerts',
        title: 'Alertas de Inventario',
        description: 'Notificaciones importantes',
        icon: AlertCircleIcon,
        visible: true,
        order: 3,
        size: 'large'
    },
    {
        id: 'upcoming-inventories',
        type: 'upcoming-inventories',
        title: 'Próximos Inventarios',
        description: 'Inventarios programados',
        icon: CalendarClock,
        visible: true,
        order: 4,
        size: 'large'
    },
    {
        id: 'branches-table',
        type: 'branches-table',
        title: 'Tabla de Sucursales',
        description: 'Listado completo de sucursales',
        icon: Building2,
        visible: true,
        order: 5,
        size: 'full'
    },
    // New widgets - available in gallery
    {
        id: 'inventory-progress',
        type: 'inventory-progress',
        title: 'Progreso de Inventarios',
        description: 'Porcentaje de inventarios completados',
        icon: TrendingUp,
        visible: false,
        order: 6,
        size: 'small'
    },
    {
        id: 'critical-products',
        type: 'critical-products',
        title: 'Productos Críticos',
        description: 'Productos con stock bajo o agotados',
        icon: AlertTriangle,
        visible: false,
        order: 7,
        size: 'small'
    },
    {
        id: 'total-stock-value',
        type: 'total-stock-value',
        title: 'Valor Total de Stock',
        description: 'Valor monetario total del inventario',
        icon: DollarSign,
        visible: false,
        order: 8,
        size: 'small'
    },
    {
        id: 'active-users',
        type: 'active-users',
        title: 'Usuarios Activos',
        description: 'Usuarios trabajando en tiempo real',
        icon: Users,
        visible: false,
        order: 9,
        size: 'small'
    },
    {
        id: 'pending-inventories',
        type: 'pending-inventories',
        title: 'Inventarios Pendientes',
        description: 'Inventarios sin completar',
        icon: Clock,
        visible: false,
        order: 10,
        size: 'small'
    },
    {
        id: 'trends-chart',
        type: 'trends-chart',
        title: 'Gráfico de Tendencias',
        description: 'Evolución de diferencias en el tiempo',
        icon: LineChart,
        visible: false,
        order: 11,
        size: 'large'
    },
    {
        id: 'top-products',
        type: 'top-products',
        title: 'Top Productos con Diferencias',
        description: 'Productos con mayores discrepancias',
        icon: Trophy,
        visible: false,
        order: 12,
        size: 'large'
    },
    {
        id: 'activity-timeline',
        type: 'activity-timeline',
        title: 'Actividad Reciente',
        description: 'Timeline de últimas acciones',
        icon: History,
        visible: false,
        order: 13,
        size: 'large'
    },
    {
        id: 'category-distribution',
        type: 'category-distribution',
        title: 'Distribución por Categoría',
        description: 'Porcentaje de productos por categoría',
        icon: PieChart,
        visible: false,
        order: 14,
        size: 'large'
    },
    {
        id: 'monthly-goals',
        type: 'monthly-goals',
        title: 'Objetivos del Mes',
        description: 'Progreso hacia metas mensuales',
        icon: Target,
        visible: false,
        order: 15,
        size: 'large'
    },
    {
        id: 'sync-status',
        type: 'sync-status',
        title: 'Estado de Sincronización',
        description: 'Conexión y datos pendientes',
        icon: Wifi,
        visible: false,
        order: 16,
        size: 'large'
    },
    {
        id: 'quick-actions',
        type: 'quick-actions',
        title: 'Acciones Rápidas',
        description: 'Tareas frecuentes',
        icon: Zap,
        visible: false,
        order: 17,
        size: 'large'
    },
    {
        id: 'countdown',
        type: 'countdown',
        title: 'Contador de Días',
        description: 'Días restantes para finalizar conteo cíclico',
        icon: Calendar,
        visible: true,
        order: 6,
        size: 'small'
    },
    {
        id: 'category-progress',
        type: 'category-progress',
        title: 'Progreso por Rubros',
        description: 'Avance de inventario por categoría',
        icon: PieChart,
        visible: true,
        order: 7,
        size: 'large'
    }
];

export function useDashboardLayout(userId?: string) {
    const storageKey = `dashboard-layout-v2-${userId || 'default'}`;

    const [widgets, setWidgets] = useState<Widget[]>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const layout: DashboardLayout = JSON.parse(saved);
                // Merge saved state (visibility, order) with default config (icons, titles)
                // This is crucial because functions (icons) are not preserved in JSON
                const mergedWidgets = DEFAULT_WIDGETS.map(defaultWidget => {
                    const savedWidget = layout.widgets.find(w => w.id === defaultWidget.id);
                    if (savedWidget) {
                        return {
                            ...defaultWidget,
                            visible: savedWidget.visible,
                            order: savedWidget.order,
                            // Ensure mandatory widgets are always visible
                            ...(defaultWidget.mandatory ? { visible: true } : {})
                        };
                    }
                    return defaultWidget;
                });

                // Sort by order
                return mergedWidgets.sort((a, b) => a.order - b.order);
            }
        } catch (error) {
            console.error('Error loading dashboard layout:', error);
        }
        return DEFAULT_WIDGETS;
    });

    const [isEditMode, setIsEditMode] = useState(false);

    // Guardar en localStorage cuando cambien los widgets
    // We only need to save the serializable parts (id, visible, order)
    useEffect(() => {
        const serializableWidgets = widgets.map(({ id, visible, order }) => ({
            id,
            visible,
            order
        }));

        const layout = {
            widgets: serializableWidgets,
            lastUpdated: Date.now()
        };
        localStorage.setItem(storageKey, JSON.stringify(layout));
    }, [widgets, storageKey]);

    // Reordenar widgets (drag and drop)
    const reorderWidgets = (activeId: string, overId: string) => {
        setWidgets((items) => {
            const oldIndex = items.findIndex((item) => item.id === activeId);
            const newIndex = items.findIndex((item) => item.id === overId);

            const reordered = arrayMove(items, oldIndex, newIndex);
            return reordered.map((item, index) => ({ ...item, order: index }));
        });
    };

    // Mostrar/ocultar widget
    const toggleWidgetVisibility = (widgetId: string) => {
        setWidgets((items) =>
            items.map((item) =>
                item.id === widgetId && !item.mandatory
                    ? { ...item, visible: !item.visible }
                    : item
            )
        );
    };

    // Resetear a layout por defecto
    const resetLayout = () => {
        setWidgets(DEFAULT_WIDGETS);
        setIsEditMode(false);
    };

    // Self-healing: Ensure widgets are valid (have titles and icons)
    // This handles cases where HMR or bad localStorage data corrupts the state
    useEffect(() => {
        const isValid = widgets.every(w => w.title && w.icon);
        if (!isValid) {
            console.warn('Detected corrupted widget state, resetting to defaults');
            setWidgets(DEFAULT_WIDGETS);
        }
    }, [widgets]);

    // Obtener widgets visibles ordenados
    const visibleWidgets = widgets
        .filter((w) => w.visible)
        .sort((a, b) => a.order - b.order);

    // Obtener widgets ocultos
    const hiddenWidgets = widgets
        .filter((w) => !w.visible)
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    return {
        widgets,
        visibleWidgets,
        hiddenWidgets,
        isEditMode,
        setIsEditMode,
        reorderWidgets,
        toggleWidgetVisibility,
        resetLayout
    };
}

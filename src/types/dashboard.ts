import type { LucideIcon } from "lucide-react";

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';
export type WidgetSpan = 1 | 2; // Cuántos casilleros ocupa el widget
export type WidgetRow = 'top' | 'middle' | 'bottom'; // En qué fila se coloca

export interface Widget {
    id: string;
    type: string;
    title: string;
    description: string;
    icon: LucideIcon;
    visible: boolean;
    order: number;
    size: WidgetSize;
    span: WidgetSpan; // Nuevo: expansión horizontal
    row: WidgetRow; // Nuevo: fila de colocación
    mandatory?: boolean;
}

export interface DashboardLayout {
    widgets: Widget[];
    lastUpdated: number;
}

// Mapeo de spans a clases CSS
export const WIDGET_GRID_SPANS: Record<WidgetSpan, string> = {
    1: 'col-span-1',
    2: 'col-span-2',
};

// Alturas fijas por tipo de widget
export const WIDGET_HEIGHTS: Record<WidgetSize, string> = {
    small: 'h-[200px]',
    medium: 'h-[300px]',
    large: 'h-[400px]',
    full: 'h-auto',
};

// Sistema de Grid por tamaño (usado en layout actual)
export const WIDGET_SIZES: Record<WidgetSize, string> = {
    small: 'col-span-1', // 1/4 en grid de 4 columnas
    medium: 'col-span-1', // No usado actualmente
    large: 'col-span-1', // 1/3 en grid de 3 columnas
    full: 'col-span-full' // Ancho completo
};

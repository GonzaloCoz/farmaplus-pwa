import type { LucideIcon } from "lucide-react";

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface Widget {
    id: string;
    type: string;
    title: string;
    description: string;
    icon: LucideIcon;
    visible: boolean;
    order: number;
    size: WidgetSize;
    mandatory?: boolean;
}

export interface DashboardLayout {
    widgets: Widget[];
    lastUpdated: number;
}

export const WIDGET_SIZES: Record<WidgetSize, string> = {
    small: 'col-span-1',
    medium: 'col-span-1 md:col-span-2',
    large: 'col-span-1',
    full: 'col-span-full'
};

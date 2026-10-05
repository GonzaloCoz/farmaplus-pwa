import { memo } from "react";
import { SmartAnalystWidget } from "@/components/dashboard/widgets/SmartAnalystWidget";
import { UpcomingInventoriesWidget } from "@/components/dashboard/widgets/UpcomingInventoriesWidget";
import { CountdownWidget } from "@/components/dashboard/widgets/CountdownWidget";
import { CategoryProgressWidget } from "@/components/dashboard/widgets/CategoryProgressWidget";
import { TrendsChartWidget } from "@/components/dashboard/widgets/TrendsChartWidget";
import { TeamsChatWidget } from "@/components/dashboard/widgets/TeamsChatWidget";
import { BranchMonitorWidget } from "@/components/dashboard/widgets/BranchMonitorWidget";
import { WidgetSkeleton } from "@/components/dashboard/WidgetSkeleton";
import { hasPermission } from "@/config/permissions";
import { User } from "@/contexts/UserContext";

interface WidgetRendererProps {
    widgetType: string;
    user: User | null;
    metrics: any;
    globalProgress: number;
    assignedDays: number;
    cycleStartDate: string | null;
    onDateClick: (iso?: string) => void;
    onEditConfig: () => void;
    isLocked?: boolean;
    lockReason?: 'manual' | 'deadline' | null;
    onToggleLock?: (isLocked: boolean) => void;
    cycleFilter?: 'current' | 'previous';
    onCycleFilterChange?: (filter: 'current' | 'previous') => void;
    isLoading?: boolean;
}

export const WidgetRenderer = memo(({
    widgetType,
    user,
    metrics,
    globalProgress,
    assignedDays,
    cycleStartDate,
    onDateClick,
    onEditConfig,
    isLocked,
    lockReason,
    onToggleLock,
    cycleFilter = 'current',
    onCycleFilterChange,
    isLoading
}: WidgetRendererProps) => {

    switch (widgetType) {
        case 'smart-analyst':
            return <SmartAnalystWidget />;
        case 'metrics-carousel':
            return <TrendsChartWidget type="positive" />;
        case 'inventory-alerts':
            return <TeamsChatWidget />;
        case 'upcoming-inventories':
            return <UpcomingInventoriesWidget onDateClick={onDateClick} />;
        case 'trends-chart':
            return <TrendsChartWidget type="negative" />;
        case 'countdown':
            if (isLoading) {
                return <WidgetSkeleton />;
            }
            return (
                <CountdownWidget
                    assignedDays={assignedDays}
                    startDate={cycleStartDate}
                    totalProgress={globalProgress}
                    isEditable={hasPermission(user, 'MANAGE_INVENTORY_CONFIG')}
                    onEdit={onEditConfig}
                    isLocked={isLocked}
                    lockReason={lockReason}
                    onToggleLock={onToggleLock}
                    canManageLock={user?.role === 'admin' || user?.role === 'mod'}
                />
            );
        case 'category-progress':
            return <CategoryProgressWidget showPrevious={cycleFilter === 'previous'} />;
        case 'branch-monitor':
            return (
                <BranchMonitorWidget
                    assignedDays={assignedDays}
                    cycleStartDate={cycleStartDate}
                />
            );
        default:
            return null;
    }
});

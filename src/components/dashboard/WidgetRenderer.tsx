import { memo } from "react";
import { SmartAnalystWidget } from "@/components/dashboard/widgets/SmartAnalystWidget";
import { UpcomingInventoriesWidget } from "@/components/dashboard/widgets/UpcomingInventoriesWidget";
import { BranchesTableWidget } from "@/components/dashboard/widgets/BranchesTableWidget";
import { CountdownWidget } from "@/components/dashboard/widgets/CountdownWidget";
import { CategoryProgressWidget } from "@/components/dashboard/widgets/CategoryProgressWidget";
import { TrendsChartWidget } from "@/components/dashboard/widgets/TrendsChartWidget";
import { TeamsChatWidget } from "@/components/dashboard/widgets/TeamsChatWidget";
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
    onCycleFilterChange
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
        case 'branches-table':
            if (!hasPermission(user, 'VIEW_BRANCH_MONITOR')) return null;
            return <BranchesTableWidget 
                cycleFilter={cycleFilter}
                onCycleFilterChange={onCycleFilterChange}
                branches={[
                    { name: "Belgrano IV", address: "Av. Cabildo 2040", zonal: "Zona Norte", email: "belgrano4@farmaplus.com" },
                    { name: "Recoleta", address: "Av. Santa Fe 1860", zonal: "Zona Centro", email: "recoleta@farmaplus.com" },
                    { name: "Palermo II", address: "Av. Las Heras 3520", zonal: "Zona Norte", email: "palermo2@farmaplus.com" },
                    { name: "Microcentro", address: "Florida 520", zonal: "Zona Centro", email: "microcentro@farmaplus.com" },
                    { name: "Belgrano III", address: "Av. Cabildo 1520", zonal: "Zona Norte", email: "belgrano3@farmaplus.com" },
                    { name: "Villa Urquiza II", address: "Av. Triunvirato 4280", zonal: "Zona Norte", email: "villaurquiza2@farmaplus.com" },
                ]} 
            />;
        case 'trends-chart':
            return <TrendsChartWidget type="negative" />;
        case 'countdown':
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
        default:
            return null;
    }
});

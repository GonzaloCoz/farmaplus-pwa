import { SmartAnalystWidget } from "@/components/dashboard/widgets/SmartAnalystWidget";
import { MetricsCarouselWidget } from "@/components/dashboard/widgets/MetricsCarouselWidget";
import { ActiveProductsWidget } from "@/components/dashboard/widgets/ActiveProductsWidget";
import { InventorySummaryWidget } from "@/components/dashboard/widgets/InventorySummaryWidget";
import { TeamsChatWidget } from "@/components/dashboard/widgets/TeamsChatWidget";
import { UpcomingInventoriesWidget } from "@/components/dashboard/widgets/UpcomingInventoriesWidget";
import { BranchesTableWidget } from "@/components/dashboard/widgets/BranchesTableWidget";
import { InventoryProgressWidget } from "@/components/dashboard/widgets/InventoryProgressWidget";
import { CriticalProductsWidget } from "@/components/dashboard/widgets/CriticalProductsWidget";
import { TotalStockValueWidget } from "@/components/dashboard/widgets/TotalStockValueWidget";
import { ActiveUsersWidget } from "@/components/dashboard/widgets/ActiveUsersWidget";
import { PendingInventoriesWidget } from "@/components/dashboard/widgets/PendingInventoriesWidget";
import { TrendsChartWidget } from "@/components/dashboard/widgets/TrendsChartWidget";
import { TopProductsWidget } from "@/components/dashboard/widgets/TopProductsWidget";
import { ActivityTimelineWidget } from "@/components/dashboard/widgets/ActivityTimelineWidget";
import { CategoryDistributionWidget } from "@/components/dashboard/widgets/CategoryDistributionWidget";
import { MonthlyGoalsWidget } from "@/components/dashboard/widgets/MonthlyGoalsWidget";
import { SyncStatusWidget } from "@/components/dashboard/widgets/SyncStatusWidget";
import { QuickActionsWidget } from "@/components/dashboard/widgets/QuickActionsWidget";
import { CountdownWidget } from "@/components/dashboard/widgets/CountdownWidget";
import { CategoryProgressWidget } from "@/components/dashboard/widgets/CategoryProgressWidget";
import { CalendarWidget } from "@/components/dashboard/widgets/CalendarWidget";
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
}

export const WidgetRenderer = ({
    widgetType,
    user,
    metrics,
    globalProgress,
    assignedDays,
    cycleStartDate,
    onDateClick,
    onEditConfig
}: WidgetRendererProps) => {

    switch (widgetType) {
        case 'smart-analyst':
            return <SmartAnalystWidget />;
        case 'metrics-carousel':
            return <MetricsCarouselWidget metrics={metrics} />;
        case 'active-products':
            return <ActiveProductsWidget activeProducts={metrics.activeProducts} />;
        case 'inventory-summary':
            return <InventorySummaryWidget />;
        case 'inventory-alerts':
            return <TeamsChatWidget />;
        case 'upcoming-inventories':
            return <UpcomingInventoriesWidget onDateClick={onDateClick} />;
        case 'branches-table':
            if (!hasPermission(user, 'VIEW_BRANCH_MONITOR')) return null;
            return <BranchesTableWidget branches={[
                { name: "Belgrano IV", address: "Av. Cabildo 2040", zonal: "Zona Norte", email: "belgrano4@farmaplus.com" },
                { name: "Recoleta", address: "Av. Santa Fe 1860", zonal: "Zona Centro", email: "recoleta@farmaplus.com" },
                { name: "Palermo II", address: "Av. Las Heras 3520", zonal: "Zona Norte", email: "palermo2@farmaplus.com" },
                { name: "Microcentro", address: "Florida 520", zonal: "Zona Centro", email: "microcentro@farmaplus.com" },
                { name: "Belgrano III", address: "Av. Cabildo 1520", zonal: "Zona Norte", email: "belgrano3@farmaplus.com" },
                { name: "Villa Urquiza II", address: "Av. Triunvirato 4280", zonal: "Zona Norte", email: "villaurquiza2@farmaplus.com" },
            ]} />;
        case 'inventory-progress':
            return <InventoryProgressWidget completedCount={globalProgress} totalCount={100} />;
        case 'critical-products':
            return <CriticalProductsWidget criticalCount={15} outOfStockCount={3} />;
        case 'total-stock-value':
            return <TotalStockValueWidget totalValue={metrics.totalStock} changePercentage={5.2} />;
        case 'active-users':
            return <ActiveUsersWidget activeCount={5} activeBranches={['Belgrano IV', 'Recoleta', 'Palermo II']} />;
        case 'pending-inventories':
            return <PendingInventoriesWidget pendingCount={7} urgentCount={2} />;
        case 'trends-chart':
            return <TrendsChartWidget />;
        case 'top-products':
            return <TopProductsWidget />;
        case 'activity-timeline':
            return <ActivityTimelineWidget />;
        case 'category-distribution':
            return <CategoryDistributionWidget />;
        case 'monthly-goals':
            return <MonthlyGoalsWidget />;
        case 'sync-status':
            return <SyncStatusWidget isOnline={navigator.onLine} pendingCount={0} />;
        case 'quick-actions':
            return <QuickActionsWidget />;
        case 'calendar':
            return <CalendarWidget />;
        case 'countdown':
            return (
                <CountdownWidget
                    assignedDays={assignedDays}
                    startDate={cycleStartDate}
                    totalProgress={globalProgress}
                    isEditable={hasPermission(user, 'MANAGE_INVENTORY_CONFIG')}
                    onEdit={onEditConfig}
                />
            );
        case 'category-progress':
            return <CategoryProgressWidget />;
        default:
            return null;
    }
};

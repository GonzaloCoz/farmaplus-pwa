import { useState, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { WidgetContainer } from "@/components/dashboard/WidgetContainer";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { GlobalSearchInput } from "@/components/dashboard/GlobalSearchInput";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { WidgetErrorBoundary } from "@/components/dashboard/WidgetErrorBoundary";
import { ConfigDialog } from "@/components/dashboard/ConfigDialog";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03
    }
  }
};

export default function Dashboard() {
  const { user } = useUser();

  // Custom Hooks
  const {
    metrics,
    globalProgress,
    assignedDays,
    cycleStartDate,
    updateConfig,
    isLocked,
    lockReason,
    toggleLock,
    isLoading
  } = useDashboardMetrics();

  const { visibleWidgets } = useDashboardLayout(user?.branchName);

  // Local UI State
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [cycleFilter, setCycleFilter] = useState<'current' | 'previous'>('current');

  const handleEditConfig = useCallback(() => setShowConfigDialog(true), []);

  // Filter widgets permission
  const displayedWidgets = useMemo(() => {
    return visibleWidgets;
  }, [visibleWidgets]);

  return (
    <motion.div
      className="pt-5 lg:pt-6 pb-6 px-4 lg:px-6 space-y-5 lg:space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <DashboardHeader />

      {/* Global Search Trigger (@coss/p-input-group-23) - Mobile only */}
      <GlobalSearchInput 
        onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
        className="my-2 lg:hidden"
      />

      <div className="grid grid-cols-12 gap-4 lg:gap-6 auto-rows-auto">
        {displayedWidgets.map((widget) => (
          <div
            key={widget.id}
            className={cn(
              widget.size === 'small' && 'col-span-12 md:col-span-6 lg:col-span-3',
              widget.size === 'large' && 'col-span-12 md:col-span-6 lg:col-span-4',
              widget.size === 'full' && 'col-span-12'
            )}
          >
            <WidgetContainer widget={widget}>
              <WidgetErrorBoundary>
                <WidgetRenderer
                  widgetType={widget.type}
                  user={user}
                  metrics={metrics}
                  globalProgress={globalProgress}
                  assignedDays={assignedDays}
                  cycleStartDate={cycleStartDate}
                  onEditConfig={handleEditConfig}
                  isLocked={isLocked}
                  lockReason={lockReason}
                  onToggleLock={toggleLock}
                  cycleFilter={cycleFilter}
                  onCycleFilterChange={setCycleFilter}
                  isLoading={isLoading}
                />
              </WidgetErrorBoundary>
            </WidgetContainer>
          </div>
        ))}
      </div>

      <ConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        user={user}
        currentAssignedDays={assignedDays}
        currentStartDate={cycleStartDate}
        onSave={updateConfig}
      />

    </motion.div>
  );
}

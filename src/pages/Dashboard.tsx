import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { WidgetContainer } from "@/components/dashboard/WidgetContainer";
import { CalendarModal } from "@/components/dashboard/CalendarModal";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { GlobalSearchInput } from "@/components/dashboard/GlobalSearchInput";
import { SuperSearch } from "@/components/SuperSearch";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { WidgetErrorBoundary } from "@/components/dashboard/WidgetErrorBoundary";
import { ConfigDialog } from "@/components/dashboard/ConfigDialog";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { hasPermission } from "@/config/permissions";

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
  const [showSuperSearch, setShowSuperSearch] = useState(false);

  // Calendar State
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const openCalendarForIso = useCallback((iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    d.setHours(12, 0, 0, 0);
    setSelectedDate(d);
    setShowCalendar(true);
  }, []);

  const handleEditConfig = useCallback(() => setShowConfigDialog(true), []);

  // Filter widgets permission
  const displayedWidgets = useMemo(() => {
    return visibleWidgets.filter(w => {
      if (w.type === 'branches-table') return hasPermission(user, 'VIEW_BRANCH_MONITOR');
      return true;
    });
  }, [visibleWidgets, user]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div
      className="pt-3 pb-6 px-4 lg:px-6 space-y-4 lg:space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <DashboardHeader />

      {/* Global Search Trigger (@coss/p-input-group-23) - Mobile only */}
      <GlobalSearchInput 
        onClick={() => setShowSuperSearch(true)}
        className="my-2 lg:hidden"
      />

      <SuperSearch 
        open={showSuperSearch} 
        onOpenChange={setShowSuperSearch} 
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
                  onDateClick={openCalendarForIso}
                  onEditConfig={handleEditConfig}
                  isLocked={isLocked}
                  lockReason={lockReason}
                  onToggleLock={toggleLock}
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

      <CalendarModal
        open={showCalendar}
        onOpenChange={setShowCalendar}
        initialDate={selectedDate}
      />

    </motion.div>
  );
}

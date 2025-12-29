import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { useUser } from "@/contexts/UserContext";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { WidgetContainer } from "@/components/dashboard/WidgetContainer";
import { WidgetGallery } from "@/components/dashboard/WidgetGallery";
import { CalendarModal } from "@/components/dashboard/CalendarModal";
import { LayoutPresetsDialog } from "@/components/dashboard/LayoutPresetsDialog";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { WidgetErrorBoundary } from "@/components/dashboard/WidgetErrorBoundary";
import { ConfigDialog } from "@/components/dashboard/ConfigDialog";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { hasPermission } from "@/config/permissions";
import { LAYOUT_PRESETS } from "@/config/widgetPresets";

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
    isLoading
  } = useDashboardMetrics();

  const {
    visibleWidgets,
    hiddenWidgets,
    isEditMode,
    setIsEditMode,
    reorderWidgets,
    toggleWidgetVisibility,
    updateWidgetSize,
    applyPreset,
    resetLayout
  } = useDashboardLayout(user?.branchName);

  // Local UI State
  const [showWidgetGallery, setShowWidgetGallery] = useState(false);
  const [showPresetsDialog, setShowPresetsDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  // Calendar State
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const openCalendarForIso = useCallback((iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    d.setHours(12, 0, 0, 0);
    setSelectedDate(d);
    setShowCalendar(true);
  }, []);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderWidgets(active.id as string, over.id as string);
    }
  }, [reorderWidgets]);

  // Filter widgets permission
  const displayedWidgets = useMemo(() => {
    return visibleWidgets.filter(w => {
      if (w.type === 'branches-table') return hasPermission(user, 'VIEW_BRANCH_MONITOR');
      return true;
    });
  }, [visibleWidgets, user]);

  // Stable handlers for child components
  const handleOpenPresets = useCallback(() => setShowPresetsDialog(true), []);
  const handleOpenGallery = useCallback(() => setShowWidgetGallery(true), []);
  const handleEditConfig = useCallback(() => setShowConfigDialog(true), []);
  const handleToggleWidget = useCallback((id: string) => toggleWidgetVisibility(id), [toggleWidgetVisibility]);
  const handleSizeChange = useCallback((id: string, newSize: any) => updateWidgetSize(id, newSize), [updateWidgetSize]);
  const handleApplyPreset = useCallback((presetId: string) => {
    const preset = LAYOUT_PRESETS.find(p => p.id === presetId);
    if (preset) applyPreset(preset.widgetIds);
  }, [applyPreset]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div
      className="pt-3 pb-6 px-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <DashboardHeader
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        onOpenPresets={handleOpenPresets}
        onOpenGallery={handleOpenGallery}
        onResetLayout={resetLayout}
        hasHiddenWidgets={hiddenWidgets.length > 0}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displayedWidgets.map(w => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-12 gap-6 auto-rows-auto">
            {displayedWidgets.map((widget) => (
              <div
                key={widget.id}
                className={cn(
                  widget.size === 'small' && 'col-span-12 md:col-span-6 lg:col-span-3',
                  widget.size === 'large' && 'col-span-12 md:col-span-6 lg:col-span-4',
                  widget.size === 'full' && 'col-span-12'
                )}
              >
                <WidgetContainer
                  widget={widget}
                  isEditMode={isEditMode}
                  onRemove={() => handleToggleWidget(widget.id)}
                  onSizeChange={(newSize) => handleSizeChange(widget.id, newSize)}
                >
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
                    />
                  </WidgetErrorBoundary>
                </WidgetContainer>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <LayoutPresetsDialog
        open={showPresetsDialog}
        onOpenChange={setShowPresetsDialog}
        onApplyPreset={handleApplyPreset}
      />

      <WidgetGallery
        open={showWidgetGallery}
        onOpenChange={setShowWidgetGallery}
        hiddenWidgets={hiddenWidgets}
        onAddWidget={handleToggleWidget}
      />

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

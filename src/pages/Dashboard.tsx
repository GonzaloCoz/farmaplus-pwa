import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useUser } from "@/contexts/UserContext";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { WidgetContainer } from "@/components/dashboard/WidgetContainer";
import { WidgetGallery } from "@/components/dashboard/WidgetGallery";

// Widgets Imports
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
import { CalendarModal } from "@/components/dashboard/CalendarModal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit3, Plus, RotateCcw, Calendar, Grid3x3, Check } from "lucide-react";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";
import { getProductCount } from "@/services/preCountDB";
import { notify } from '@/lib/notifications';
import { hasPermission } from "@/config/permissions";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { LayoutPresetsDialog } from "@/components/dashboard/LayoutPresetsDialog";
import { LAYOUT_PRESETS } from "@/config/widgetPresets";


const branches = [
  { name: "Belgrano IV", address: "Av. Cabildo 2040", zonal: "Zona Norte", email: "belgrano4@farmaplus.com" },
  { name: "Recoleta", address: "Av. Santa Fe 1860", zonal: "Zona Centro", email: "recoleta@farmaplus.com" },
  { name: "Palermo II", address: "Av. Las Heras 3520", zonal: "Zona Norte", email: "palermo2@farmaplus.com" },
  { name: "Microcentro", address: "Florida 520", zonal: "Zona Centro", email: "microcentro@farmaplus.com" },
  { name: "Belgrano III", address: "Av. Cabildo 1520", zonal: "Zona Norte", email: "belgrano3@farmaplus.com" },
  { name: "Villa Urquiza II", address: "Av. Triunvirato 4280", zonal: "Zona Norte", email: "villaurquiza2@farmaplus.com" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { user } = useUser();

  // Widget system
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

  const [showWidgetGallery, setShowWidgetGallery] = useState(false);
  const [showPresetsDialog, setShowPresetsDialog] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter widgets based on user permissions
  const displayedWidgets = useMemo(() => {
    return visibleWidgets.filter(w => {
      // Monitor de Sucursales permission check
      if (w.type === 'branches-table') return hasPermission(user, 'VIEW_BRANCH_MONITOR');
      return true;
    });
  }, [visibleWidgets, user]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      reorderWidgets(active.id as string, over.id as string);
    }
  };

  const [metrics, setMetrics] = useState({
    totalStock: 0,
    activeProducts: 0,
    negativeStock: 0,
    positiveStock: 0,
    // Units for percentage calculation
    negativeUnits: 0,
    positiveUnits: 0,
    totalSystemUnits: 0
  });

  // Configuration State for Admin
  const [assignedDays, setAssignedDays] = useState(0);
  const [cycleStartDate, setCycleStartDate] = useState<string | null>(null);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configBranch, setConfigBranch] = useState("");
  const [configDays, setConfigDays] = useState(90);
  const [configStartDate, setConfigStartDate] = useState(new Date().toISOString().split('T')[0]);

  const [extensionDays, setExtensionDays] = useState(0);

  // Calendar Modal State
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Function to open calendar from widgets
  const openCalendarForIso = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    d.setHours(12, 0, 0, 0); // Avoid timezone issues
    setSelectedDate(d);
    setShowCalendar(true);
  };

  // Load Config (User's Branch or Default)
  useEffect(() => {
    const loadConfig = async () => {
      if (user?.branchName) {
        const config = await cyclicInventoryService.getBranchConfig(user.branchName);
        setAssignedDays(config.days);
        setCycleStartDate(config.startDate);
      }
    };
    loadConfig();
  }, [user]);

  const handleSaveConfig = async () => {
    if (!configBranch || !configDays) return;
    try {
      await cyclicInventoryService.saveBranchConfig(configBranch, Number(configDays));
      notify.success("Operación exitosa", `Plazo actualizado para ${configBranch}`);
      setShowConfigDialog(false);
      // Refresh if we edited our own branch
      if (user?.branchName === configBranch) {
        setAssignedDays(Number(configDays));
      }
    } catch (e) {
      notify.error("Error", "Error al guardar configuración");
    }
  };

  useEffect(() => {
    const loadMetrics = async () => {
      let currentActiveProducts = 0;

      try {
        currentActiveProducts = await getProductCount();
      } catch (e) {
        console.error("Error fetching product count:", e);
      }

      // If no branch assigned (e.g. Admin view without selected branch), keep branch metrics at 0 but show global products
      if (!user?.branchSheet) {
        setMetrics({
          totalStock: 0,
          activeProducts: currentActiveProducts,
          negativeStock: 0,
          positiveStock: 0,
          negativeUnits: 0,
          positiveUnits: 0,
          totalSystemUnits: 0
        });
        return;
      }

      try {
        // Get cyclic inventories filtered by branch
        const allInventories = await cyclicInventoryService.getAllCyclicInventories(user.branchSheet);

        // Aggregate metrics (now only for this branch)
        const aggregated = allInventories.reduce((acc, inv) => ({
          negativeStock: acc.negativeStock + inv.negativeValue,
          positiveStock: acc.positiveStock + inv.positiveValue,
          totalStock: acc.totalStock + inv.differenceValue,
          // Units
          negativeUnits: acc.negativeUnits + inv.negativeUnits,
          positiveUnits: acc.positiveUnits + inv.positiveUnits,
          totalSystemUnits: acc.totalSystemUnits + inv.totalSystemUnits,
          controlledCount: acc.controlledCount + (inv.status === 'controlado' ? 1 : 0)
        }), {
          negativeStock: 0, positiveStock: 0, totalStock: 0,
          negativeUnits: 0, positiveUnits: 0, totalSystemUnits: 0,
          controlledCount: 0
        });

        const progress = allInventories.length > 0 ? Math.round((aggregated.controlledCount / allInventories.length) * 100) : 0;
        setGlobalProgress(progress);

        setMetrics({
          totalStock: aggregated.totalStock,
          activeProducts: currentActiveProducts,
          negativeStock: aggregated.negativeStock,
          positiveStock: aggregated.positiveStock,
          negativeUnits: aggregated.negativeUnits,
          positiveUnits: aggregated.positiveUnits,
          totalSystemUnits: aggregated.totalSystemUnits
        });
      } catch (error) {
        console.error('Error loading metrics:', error);
      }
    };

    loadMetrics();
  }, [user]);

  // Función para obtener el saludo según la hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "Buenos días";
    if (hour >= 12 && hour < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  // Render widget content based on type
  const renderWidgetContent = (widgetType: string) => {
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
        return <UpcomingInventoriesWidget onDateClick={openCalendarForIso} />;
      case 'branches-table':
        // Double check permissions (though displayedWidgets filters it)
        if (!hasPermission(user, 'VIEW_BRANCH_MONITOR')) return null;
        return <BranchesTableWidget branches={branches} />;
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
            onEdit={() => setShowConfigDialog(true)}
          />
        );
      case 'category-progress':
        return <CategoryProgressWidget />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="pt-3 pb-6 px-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="space-y-1">
        {/* Date */}
        <div className="text-muted-foreground text-xs font-normal">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })}
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            {getGreeting()}, {(user?.role === 'admin' || user?.role === 'mod') ? user?.name.split(' ')[0] : (user?.branchName || 'Sucursal')} 👋
          </h1>

          <div className="flex gap-2">
            {isEditMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPresetsDialog(true)}
                >
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  Presets
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWidgetGallery(true)}
                  disabled={hiddenWidgets.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Widget
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetLayout}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetear
                </Button>
              </>
            )}

            {/* Animated Edit Button - Gated by permission */}
            {hasPermission(user, 'EDIT_DASHBOARD_LAYOUT') && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={cn(
                    "relative overflow-hidden transition-all duration-300",
                    isEditMode && "bg-green-600 hover:bg-green-700"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait">
                      {isEditMode ? (
                        <motion.div
                          key="check"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Check className="h-4 w-4" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="edit"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <span>{isEditMode ? 'Guardar' : 'Editar Dashboard'}</span>
                  </div>
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displayedWidgets.map(w => w.id)}
          strategy={rectSortingStrategy}
        >
          {/* Unified Grid - All widgets in one flexible grid */}
          <div className="grid grid-cols-12 gap-6 auto-rows-auto">
            {displayedWidgets.map((widget) => (
              <div
                key={widget.id}
                className={cn(
                  // Responsive column spans based on widget size
                  widget.size === 'small' && 'col-span-12 md:col-span-6 lg:col-span-3',
                  widget.size === 'large' && 'col-span-12 md:col-span-6 lg:col-span-4',
                  widget.size === 'full' && 'col-span-12'
                )}
              >
                <WidgetContainer
                  widget={widget}
                  isEditMode={isEditMode}
                  onRemove={() => toggleWidgetVisibility(widget.id)}
                  onSizeChange={(newSize) => updateWidgetSize(widget.id, newSize)}
                >
                  {renderWidgetContent(widget.type)}
                </WidgetContainer>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <LayoutPresetsDialog
        open={showPresetsDialog}
        onOpenChange={setShowPresetsDialog}
        onApplyPreset={(presetId) => {
          const preset = LAYOUT_PRESETS.find(p => p.id === presetId);
          if (preset) {
            applyPreset(preset.widgetIds);
          }
        }}
      />

      <WidgetGallery
        open={showWidgetGallery}
        onOpenChange={setShowWidgetGallery}
        hiddenWidgets={hiddenWidgets}
        onAddWidget={toggleWidgetVisibility}
      />

      {/* Admin Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={(open) => {
        setShowConfigDialog(open);
        if (open) {
          const currentTotal = assignedDays || 90;
          const standards = [180, 150, 120, 90];
          // Find largest standard less than or equal to current
          const foundBase = standards.find(s => s <= currentTotal) || 90;
          setConfigBranch(user?.branchName || '');
          setConfigDays(foundBase);
          setExtensionDays(Math.max(0, currentTotal - foundBase));
          setConfigStartDate(cycleStartDate ? cycleStartDate.split('T')[0] : new Date().toISOString().split('T')[0]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Plazo de Inventario</DialogTitle>
            <DialogDescription>
              Ajusta los parámetros del ciclo de inventario para esta sucursal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Branch Display (Read Only) */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Sucursal Seleccionada</Label>
              <div className="text-lg font-semibold border p-3 rounded-md bg-muted/50">
                {user?.branchName || 'Sin sucursal asignada'}
              </div>
            </div>

            {/* Standard Days Selection */}
            <div className="space-y-3">
              <Label>Días Base</Label>
              <div className="grid grid-cols-4 gap-3">
                {[90, 120, 150, 180].map((days) => (
                  <button
                    key={days}
                    onClick={() => setConfigDays(days)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                      configDays === days
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-muted hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <span className="text-xl">{days}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Extension Input */}
            <div className="space-y-2">
              <Label>Próroga (Días adicionales)</Label>
              <div className="flex gap-4 items-center">
                <Input
                  type="number"
                  placeholder="0"
                  className="text-lg font-medium"
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(Number(e.target.value))}
                  min={0}
                />
                <div className="text-sm text-muted-foreground text-nowrap">
                  Total: <span className="font-bold text-foreground mx-1 text-lg">
                    {configDays + extensionDays}
                  </span> días
                </div>
              </div>
            </div>

            {/* Start Date Selection */}
            <div className="space-y-2">
              <Label>Fecha de Inicio del Ciclo</Label>
              <Input
                type="date"
                value={configStartDate}
                onChange={(e) => setConfigStartDate(e.target.value)}
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">Esta fecha se usa para calcular los días restantes y el ritmo de avance.</p>
            </div>

            <Button
              className="w-full mt-2"
              onClick={async () => {
                if (!user?.branchName) return;
                const total = configDays + extensionDays;
                try {
                  await cyclicInventoryService.saveBranchConfig(user.branchName, total, configStartDate);
                  notify.success("Operación exitosa", `Plazo actualizado a ${total} días`);
                  setShowConfigDialog(false);
                  setAssignedDays(total);
                  setCycleStartDate(configStartDate);
                } catch (e) {
                  notify.error("Error", "Error al guardar");
                }
              }}
            >
              Guardar Configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      <CalendarModal
        open={showCalendar}
        onOpenChange={setShowCalendar}
        initialDate={selectedDate}
      />

    </motion.div >
  );
}

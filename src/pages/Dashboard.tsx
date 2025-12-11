import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import CustomCalendar from "@/components/CustomCalendar";
import { useUser } from "@/contexts/UserContext";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { WidgetContainer } from "@/components/dashboard/WidgetContainer";
import { WidgetGallery } from "@/components/dashboard/WidgetGallery";
import { MetricsCarouselWidget } from "@/components/dashboard/widgets/MetricsCarouselWidget";
import { ActiveProductsWidget } from "@/components/dashboard/widgets/ActiveProductsWidget";
import { InventorySummaryWidget } from "@/components/dashboard/widgets/InventorySummaryWidget";
import { InventoryAlertsWidget } from "@/components/dashboard/widgets/InventoryAlertsWidget";
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
import { Button } from "@/components/ui/button";
import { Edit3, Plus, RotateCcw, LayoutDashboard } from "lucide-react";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";
import { getAllProducts, getProductCount } from "@/services/preCountDB";
import { BRANCH_NAMES } from "@/config/users";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { hasPermission } from "@/config/permissions";
import { AddEventDialog } from '@/components/AddEventDialog';
import { calendarService } from '@/services/calendarService';

// Helper to format dates for display
const formatDate = (date: Date) => {
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const branches = [
  { name: "Belgrano IV", address: "Av. Cabildo 2040", zonal: "Zona Norte", email: "belgrano4@farmaplus.com" },
  { name: "Recoleta", address: "Av. Santa Fe 1860", zonal: "Zona Centro", email: "recoleta@farmaplus.com" },
  { name: "Palermo II", address: "Av. Las Heras 3520", zonal: "Zona Norte", email: "palermo2@farmaplus.com" },
  { name: "Microcentro", address: "Florida 520", zonal: "Zona Centro", email: "microcentro@farmaplus.com" },
  { name: "Belgrano III", address: "Av. Cabildo 1520", zonal: "Zona Norte", email: "belgrano3@farmaplus.com" },
  { name: "Villa Urquiza II", address: "Av. Triunvirato 4280", zonal: "Zona Norte", email: "villaurquiza2@farmaplus.com" },
];

type EventItem = {
  id: string;
  title: string;
  branch: string;
  sector: string;
  date: string;
};

interface CalendarContentProps {
  events: EventItem[];
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  showAddForm: boolean;
  setShowAddForm: (show: boolean) => void;
  newTitle: string;
  setNewTitle: (title: string) => void;
  newBranch: string;
  setNewBranch: (branch: string) => void;
  newSector: string;
  setNewSector: (sector: string) => void;
  newDate: string;
  setNewDate: (date: string) => void;
  handleAddEvent: () => void;
  setEvents: React.Dispatch<React.SetStateAction<EventItem[]>>;
  eventsForDay: (date: Date) => EventItem[];
  eventsForMonth: (date: Date) => EventItem[];
  isMobile?: boolean;
}

function CalendarContent({
  events,
  selectedDate,
  setSelectedDate,
  showAddForm,
  setShowAddForm,
  newTitle,
  setNewTitle,
  newBranch,
  setNewBranch,
  newSector,
  setNewSector,
  newDate,
  setNewDate,
  handleAddEvent,
  setEvents,
  eventsForDay,
  eventsForMonth,
  isMobile = false
}: CalendarContentProps) {
  return (
    <div className={isMobile ? "space-y-4" : "flex gap-6"}>
      <div className={isMobile ? "" : "flex-1"}>
        <CustomCalendar
          selected={selectedDate}
          onSelect={setSelectedDate}
          events={events}
        />
      </div>
      <div className={isMobile ? "" : "w-80"}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {selectedDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
            </h3>
            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? 'Cancelar' : '+ Agregar'}
            </Button>
          </div>

          {showAddForm && (
            <div className="mt-4 p-3 bg-background border rounded-md">
              <div className="space-y-2">
                <input className="w-full p-2 border rounded" placeholder="Título" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                <input className="w-full p-2 border rounded" placeholder="Sucursal" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} />
                <input className="w-full p-2 border rounded" placeholder="Sector" value={newSector} onChange={(e) => setNewSector(e.target.value)} />
                <input type="date" className="w-full p-2 border rounded" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleAddEvent}>Guardar</Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {eventsForDay(selectedDate).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay eventos programados</p>
            ) : (
              eventsForDay(selectedDate).map((event) => (
                <div key={event.id} className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">{event.branch} - {event.sector}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
    resetLayout
  } = useDashboardLayout(user?.branchName);

  const [showWidgetGallery, setShowWidgetGallery] = useState(false);

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

  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Configuration State for Admin
  const [assignedDays, setAssignedDays] = useState(0);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configBranch, setConfigBranch] = useState("");
  const [configDays, setConfigDays] = useState(90);
  const [extensionDays, setExtensionDays] = useState(0);

  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Load Config (User's Branch or Default)
  useEffect(() => {
    const loadConfig = async () => {
      if (user?.branchName) {
        const days = await cyclicInventoryService.getBranchConfig(user.branchName);
        setAssignedDays(days);
      }
    };
    loadConfig();
  }, [user]);

  const handleSaveConfig = async () => {
    if (!configBranch || !configDays) return;
    try {
      await cyclicInventoryService.saveBranchConfig(configBranch, Number(configDays));
      toast.success(`Plazo actualizado para ${configBranch}`);
      setShowConfigDialog(false);
      // Refresh if we edited our own branch
      if (user?.branchName === configBranch) {
        setAssignedDays(Number(configDays));
      }
    } catch (e) {
      toast.error("Error al guardar configuración");
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
          totalSystemUnits: acc.totalSystemUnits + inv.totalSystemUnits
        }), {
          negativeStock: 0, positiveStock: 0, totalStock: 0,
          negativeUnits: 0, positiveUnits: 0, totalSystemUnits: 0
        });

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

  // Load events from Supabase
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const isAdmin = user?.role === 'admin';
        const dbEvents = await calendarService.getEvents(user?.branchName, isAdmin);
        const mapped: EventItem[] = dbEvents.map(e => ({
          id: e.id,
          title: e.title,
          branch: e.branch_name,
          sector: e.sector,
          date: e.date
        }));
        setEvents(mapped);
      } catch (error) {
        console.error("Error loading events:", error);
      }
    };
    loadEvents();
  }, [user]); // Run on user/branch change

  const eventsForMonth = (date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    return events.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const eventsForDay = (date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    return events.filter(e => e.date === iso);
  };

  const openCalendarForIso = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    setSelectedDate(d);
    setShowCalendar(true);
  };

  const handleAddEvent = () => {
    const id = `evt-${Date.now()}`;
    const item: EventItem = { id, title: newTitle || `${newBranch} - ${newSector}`, branch: newBranch, sector: newSector, date: newDate };
    setEvents(prev => [...prev, item]);
    setShowAddForm(false);
    setNewTitle("");
    setNewBranch("");
    setNewSector("");
    setNewDate(newDate);
    toast.success("Evento creado exitosamente");
  };

  const upcomingInventories = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return events
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .map(e => ({
        branch: e.branch,
        sector: e.sector,
        date: formatDate(new Date(e.date + 'T12:00:00')),
        iso: e.date
      }));
  }, [events]);

  // Render widget content based on type
  const renderWidgetContent = (widgetType: string) => {
    switch (widgetType) {
      case 'metrics-carousel':
        return <MetricsCarouselWidget metrics={metrics} />;
      case 'active-products':
        return <ActiveProductsWidget activeProducts={metrics.activeProducts} />;
      case 'inventory-summary':
        return <InventorySummaryWidget />;
      case 'inventory-alerts':
        return <InventoryAlertsWidget />;
      case 'upcoming-inventories':
        return <UpcomingInventoriesWidget
          inventories={upcomingInventories}
          onDateClick={openCalendarForIso}
          onAddClick={() => {
            setShowCalendar(true);
            setTimeout(() => setShowAddForm(true), 100);
          }}
          onViewCalendar={() => setShowCalendar(true)}
        />;
      case 'branches-table':
        // Double check permissions (though displayedWidgets filters it)
        if (!hasPermission(user, 'VIEW_BRANCH_MONITOR')) return null;
        return <BranchesTableWidget branches={branches} />;
      case 'inventory-progress':
        return <InventoryProgressWidget completedCount={3} totalCount={10} />;
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
      case 'countdown':
        return (
          <CountdownWidget
            assignedDays={assignedDays}
            daysRemaining={assignedDays} // Simple fallback logic for now
            totalProgress={0}
            monthlyProgress={[]}
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
      {/* ... (Header) */}
      <motion.div variants={itemVariants} className="space-y-1">
        {/* Date */}
        <div className="text-muted-foreground text-xs font-normal">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', month: 'short', day: '2-digit', year: 'numeric' })}
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            {getGreeting()}, {user?.role === 'admin' ? user?.name.split(' ')[0] : (user?.branchName || 'Sucursal')} 👋
          </h1>
          <div className="flex gap-2">
            {isEditMode && (
              <>
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
            <Button
              variant={isEditMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditMode(!isEditMode)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isEditMode ? 'Guardar' : 'Editar Dashboard'}
            </Button>
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
          {/* Primera fila: Widgets pequeños (máximo 4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedWidgets
              .filter(w => w.size === 'small')
              .slice(0, 4)
              .map((widget) => (
                <WidgetContainer
                  key={widget.id}
                  widget={widget}
                  isEditMode={isEditMode}
                  onRemove={() => toggleWidgetVisibility(widget.id)}
                >
                  {renderWidgetContent(widget.type)}
                </WidgetContainer>
              ))}
          </div>

          {/* Segunda fila: Widgets grandes (Resumen, Alertas, Próximos) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedWidgets
              .filter(w => w.size === 'large')
              .map((widget) => (
                <WidgetContainer
                  key={widget.id}
                  widget={widget}
                  isEditMode={isEditMode}
                  onRemove={() => toggleWidgetVisibility(widget.id)}
                >
                  {renderWidgetContent(widget.type)}
                </WidgetContainer>
              ))}
          </div>

          {/* Widgets full-width (Tabla de Sucursales) */}
          <div className="space-y-6">
            {displayedWidgets
              .filter(w => w.size === 'full')
              .map((widget) => (
                <WidgetContainer
                  key={widget.id}
                  widget={widget}
                  isEditMode={isEditMode}
                  onRemove={() => toggleWidgetVisibility(widget.id)}
                >
                  {renderWidgetContent(widget.type)}
                </WidgetContainer>
              ))}
          </div>
        </SortableContext>
      </DndContext>

      <WidgetGallery
        open={showWidgetGallery}
        onOpenChange={setShowWidgetGallery}
        hiddenWidgets={hiddenWidgets}
        onAddWidget={toggleWidgetVisibility}
      />

      {/* Modal calendario + eventos (Responsive) */}
      {isDesktop ? (
        <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
          <DialogContent className="w-[1800px] max-w-[90vw]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Calendario de Inventarios</DialogTitle>
              <div className="text-sm text-muted-foreground">
                Visualice y gestione los eventos programados.
              </div>
            </DialogHeader>
            {user?.role === 'admin' && (
              <Button onClick={() => setShowAddForm(true)} className="absolute right-12 top-6">
                <Plus className="mr-2 h-4 w-4" />
                Programar Nuevo
              </Button>
            )}

            <div className="flex gap-6 mt-4 h-full overflow-hidden">
              <div className="flex-1 overflow-auto">
                <CustomCalendar
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  events={events} // Pass mapped events
                />
              </div>
              <div className="w-80 border-l pl-6 flex flex-col gap-4 overflow-hidden">
                <h3 className="font-semibold text-lg text-primary">
                  {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {eventsForDay(selectedDate).length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                      <p>No hay inventarios programados para hoy.</p>
                    </div>
                  ) : (
                    eventsForDay(selectedDate).map((event) => (
                      <div key={event.id} className="p-4 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow group relative">
                        {user?.role === 'admin' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('¿Eliminar este evento?')) {
                                await calendarService.deleteEvent(event.id);
                                setEvents(prev => prev.filter(p => p.id !== event.id));
                                toast.success("Evento eliminado");
                              }
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 text-destructive rounded transition-opacity"
                          >
                            <span className="sr-only">Eliminar</span>
                            x
                          </button>
                        )}
                        <div className="font-bold text-lg text-primary mb-1">{event.branch}</div>
                        <div className="text-sm font-medium text-foreground">{event.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 capitalize">{event.sector}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <AddEventDialog
              open={showAddForm}
              onOpenChange={setShowAddForm}
              onEventAdded={(newEvent) => {
                const mappedEvent: EventItem = {
                  id: newEvent.id,
                  title: newEvent.title,
                  branch: newEvent.branch_name,
                  sector: newEvent.sector,
                  date: newEvent.date
                };
                setEvents(prev => [...prev, mappedEvent]);
              }}
            />
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={showCalendar} onOpenChange={setShowCalendar}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Próximos inventarios</DrawerTitle>
            </DrawerHeader>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Calendario de Inventarios</DialogTitle>
              <div className="text-sm text-muted-foreground">
                Visualice y gestione los eventos programados.
              </div>
            </DialogHeader>
            {user?.role === 'admin' && (
              <Button onClick={() => setShowAddForm(true)} className="absolute right-12 top-6">
                <Plus className="mr-2 h-4 w-4" />
                Programar Nuevo
              </Button>
            )}

            <div className="flex gap-6 mt-4 h-full overflow-hidden">
              <div className="flex-1 overflow-auto">
                <CustomCalendar
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  events={events} // Pass mapped events
                />
              </div>
              <div className="w-80 border-l pl-6 flex flex-col gap-4 overflow-hidden">
                <h3 className="font-semibold text-lg text-primary">
                  {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {eventsForDay(selectedDate).length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                      <p>No hay inventarios programados para hoy.</p>
                    </div>
                  ) : (
                    eventsForDay(selectedDate).map((event) => (
                      <div key={event.id} className="p-4 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow group relative">
                        {user?.role === 'admin' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('¿Eliminar este evento?')) {
                                await calendarService.deleteEvent(event.id);
                                setEvents(prev => prev.filter(p => p.id !== event.id));
                                toast.success("Evento eliminado");
                              }
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 text-destructive rounded transition-opacity"
                          >
                            <span className="sr-only">Eliminar</span>
                            x
                          </button>
                        )}
                        <div className="font-bold text-lg text-primary mb-1">{event.branch}</div>
                        <div className="text-sm font-medium text-foreground">{event.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 capitalize">{event.sector}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <AddEventDialog
              open={showAddForm}
              onOpenChange={setShowAddForm}
              onEventAdded={(newEvent) => {
                const mappedEvent: EventItem = {
                  id: newEvent.id,
                  title: newEvent.title,
                  branch: newEvent.branch_name,
                  sector: newEvent.sector,
                  date: newEvent.date
                };
                setEvents(prev => [...prev, mappedEvent]);
              }}
            />    isMobile
              />
          </div>
        </DrawerContent>
        </Drawer>
  )
}

{/* Admin Config Dialog */ }
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
  }
}}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Configurar Plazo de Inventario</DialogTitle>
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

      <Button
        className="w-full mt-2"
        onClick={async () => {
          if (!user?.branchName) return;
          const total = configDays + extensionDays;
          try {
            await cyclicInventoryService.saveBranchConfig(user.branchName, total);
            toast.success(`Plazo actualizado a ${total} días`);
            setShowConfigDialog(false);
            setAssignedDays(total);
          } catch (e) {
            toast.error("Error al guardar");
          }
        }}
      >
        Guardar Configuración
      </Button>
    </div>
  </DialogContent>
</Dialog>

    </motion.div >
  );
}

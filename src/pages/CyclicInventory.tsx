import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { notify } from '@/lib/notifications';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import { Card } from "@/components/ui/card";
import { Chart as BarChart3, CheckCircle, DangerCircle as AlertCircle, Dollar, GraphDown as TrendingDown, GraphUp as TrendingUp, Restart as Loader2, Dollar as DollarSign, Magnifer as Search, Filter, MenuDots as MoreVertical, Widget as GridIcon, List as ListIcon, ClockCircle as Clock } from "@solar-icons/react";
import { LaboratoryCard, LaboratoryStatus } from "@/components/LaboratoryCard";
import { CounterAnimation } from "@/components/CounterAnimation";
import { MetricCarousel } from "@/components/MetricCarousel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, normalizeString } from "@/lib/utils";
import { ReportExporter } from "@/lib/reportExporter";
import { 
  Download, 
  Document, 
  Restart as RotateCcw, 
  DangerCircle as AlertCircleIcon,
  TrashBinMinimalistic as Trash
} from "@solar-icons/react";
import { BookOpen, Users2, DownloadCloud, PenTool, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogPanel,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Menu,
  MenuPopup,
  MenuItem,
  MenuTrigger,
  MenuCheckboxItem,
  MenuSeparator,
  MenuGroupLabel,
  MenuGroup
} from "@/components/ui/menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getLaboratoriesForBranch } from "@/services/preCountDB";
import { cyclicInventoryService, CyclicInventoryStats } from "@/services/cyclicInventoryService";
import { useUser } from "@/contexts/UserContext";
import { usePrefetchLabInventory } from "@/hooks/useInventoryQueries";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SortOption = "name-asc" | "name-desc" | "value-asc" | "value-desc";
type FilterCategory = "MEDICAMENTOS" | "PERFUMERIA" | "ACCESORIOS" | "VARIOS";
type StatusFilter = "all" | "controlado" | "pendiente" | "por_controlar";

const CATEGORIES: FilterCategory[] = ["MEDICAMENTOS", "PERFUMERIA", "ACCESORIOS", "VARIOS"];

const categoriesMap = {
  MEDICAMENTOS: "Medicamentos",
  PERFUMERIA: "Perfumería",
  ACCESORIOS: "Accesorios",
  VARIOS: "Varios",
};

type CategoryKey = keyof typeof categoriesMap;

function renderCategoryValue(value: string[]) {
  if (!value || value.length === 0) {
    return "Seleccionar rubros...";
  }

  const firstCat = categoriesMap[value[0] as CategoryKey] || value[0];
  const additionalCats =
    value.length > 1 ? ` (+${value.length - 1} más)` : "";
  return firstCat + additionalCats;
}

export default function CyclicInventory() {
  const navigate = useNavigate();
  const { user } = useUser();
  const prefetchLab = usePrefetchLabInventory();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("MEDICAMENTOS");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [laboratories, setLaboratories] = useState<CyclicInventoryStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingMassAction, setIsProcessingMassAction] = useState(false);
  const [lockStatus, setLockStatus] = useState<{ isLocked: boolean, reason: 'manual' | 'deadline' | null }>({ isLocked: false, reason: null });

  // Mass Reset State
  const [showMassResetDialog, setShowMassResetDialog] = useState(false);
  const [massResetChallenge, setMassResetChallenge] = useState("");
  const [massResetInput, setMassResetInput] = useState("");

  // Add Lab Manually State
  const [showAddLabDialog, setShowAddLabDialog] = useState(false);
  const [newLabName, setNewLabName] = useState("");
  const [newLabCategories, setNewLabCategories] = useState<string[]>(["MEDICAMENTOS"]);
  const [isAddingLab, setIsAddingLab] = useState(false);

  useEffect(() => {
    const loadLabs = async () => {
      if (!user?.branchSheet) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      try {
        // 1. Obtener lista maestra de laboratorios (Autorizados para esta sucursal)
        const allowedLabs = await getLaboratoriesForBranch(user.branchSheet);

        // 2. Obtener estado actual del inventario desde Supabase (Filtrado por sucursal)
        const inventoryStats = await cyclicInventoryService.getAllCyclicInventories(user.branchSheet);
        // 3. Unir datos: Unión de Inventario Activo + Lista Maestra (para pendientes)
        const mergedData: CyclicInventoryStats[] = [...inventoryStats];

        // Crear un Set de búsqueda para evitar duplicados (Clave: Nombre|Categoría)
        // Normalizar categoría para una comparación robusta
        const activeLabsSet = new Set(inventoryStats.map(s => `${s.labName.trim().toUpperCase()}|${normalizeString(s.category || '')}`));

        allowedLabs.forEach(labInfo => {
          const labName = labInfo.name.trim().toUpperCase();
          const category = normalizeString(labInfo.category);
          const key = `${labName}|${category}`;

          // Si esta combinación específica (Nombre+Categoría) no existe en el inventario activo, agregar como Pendiente
          if (!activeLabsSet.has(key)) {
            mergedData.push({
              labName: labInfo.name,
              category: normalizeString(labInfo.category), // Guardar categoría normalizada para ítems pendientes
              status: 'pendiente',
              totalItems: 0,
              controlledItems: 0,
              progress: 0,
              negativeValue: 0,
              positiveValue: 0,
              netValue: 0,
              differenceValue: 0,
              totalSystemUnits: 0,
              negativeUnits: 0,
              positiveUnits: 0,
              netUnits: 0
            });
          }
        });

        setLaboratories(mergedData);
      } catch (error) {
        console.error("Error loading laboratories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLabs();
  }, [user]);

  // Obtener estado de bloqueo
  useEffect(() => {
    const checkLockStatus = async () => {
      if (!user?.branchName) return;
      try {
        const config = await cyclicInventoryService.getBranchConfig(user.branchName);
        const status = await cyclicInventoryService.isInventoryLocked(
          user.branchName,
          config.days,
          config.startDate
        );
        setLockStatus(status);
      } catch (error) {
        console.error('Error checking lock status:', error);
      }
    };
    checkLockStatus();
  }, [user]);

  // Listener para datos de Excel desde el Launcher (Electron)
  useEffect(() => {
    if ((window as any).electronAPI) {
      console.log("[Electron] Registrando listener en Inventario Cíclico (Lista)");
      const cleanup = (window as any).electronAPI.onExcelData((data: any) => {
        const rows = data.rows || [];
        // Columna O (índice 14) es el Laboratorio
        const laboratory = rows[1] ? String(rows[1][14] || '').trim() : '';
        
        if (laboratory) {
          notify.info("Archivo Detectado", `Redirigiendo a ${laboratory}...`);
          // Almacenamos los datos temporalmente para que el detalle los pueda recoger tras la navegación
          sessionStorage.setItem('pending_electron_excel', JSON.stringify(data));
          navigate(`/cyclic-inventory/${encodeURIComponent(laboratory)}`);
        } else {
          notify.error("Error", "No se pudo identificar el laboratorio en el archivo enviado.");
        }
      });

      return cleanup;
    }
  }, [navigate]);

  // Calcula la cantidad total de laboratorios por categoría
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    CATEGORIES.forEach(cat => counts.set(cat, 0));
    
    // Usamos mapa temporal para agrupar únicos de todo el dataset
    const groupedLocal = new Map<string, CyclicInventoryStats>();
    laboratories.forEach(lab => {
      const key = lab.labName.trim().toUpperCase();
      if (!groupedLocal.has(key)) {
        groupedLocal.set(key, lab);
        const catNorm = lab.category ? lab.category.trim().toUpperCase() : '';
        if (counts.has(catNorm)) {
          counts.set(catNorm, counts.get(catNorm)! + 1);
        }
      }
    });
    return counts;
  }, [laboratories]);

  // Agrupar laboratorios por nombre para eliminar duplicados
  // IMPORTANTE: NO sumar valores - solo tomar la primera entrada para evitar contar duplicados
  const groupedLaboratories = useMemo(() => {
    // Primero, filtrar por la categoría seleccionada
    const filteredByCategory = categoryFilter
      ? laboratories.filter(lab => normalizeString(lab.category || '') === normalizeString(categoryFilter))
      : laboratories;

    // Then deduplicate by name (take first entry only)
    const grouped = new Map<string, CyclicInventoryStats>();

    filteredByCategory.forEach(lab => {
      const key = lab.labName.trim().toUpperCase();

      // Only add if not already present (take first entry, ignore duplicates)
      if (!grouped.has(key)) {
        grouped.set(key, { ...lab });
      }
      // If duplicate exists, we IGNORE it instead of summing
      // This prevents counting duplicate products multiple times
    });

    return Array.from(grouped.values());
  }, [laboratories, categoryFilter]);

  // Estadísticas del Panel - Usando laboratorios agrupados
  const totalLabs = groupedLaboratories.length;
  const controlledLabs = groupedLaboratories.filter(l => l.status === 'controlado').length;
  const pendingLabs = groupedLaboratories.filter(l => l.status === 'pendiente').length;

  // Estadísticas Financieras (Global - todos los laboratorios agrupados)
  const totalDifference = groupedLaboratories.reduce((acc, curr) => acc + curr.differenceValue, 0);
  const totalNegative = groupedLaboratories.reduce((acc, curr) => acc + curr.negativeValue, 0);
  const totalPositive = groupedLaboratories.reduce((acc, curr) => acc + curr.positiveValue, 0);

  // Calcular Totales de Unidades para porcentajes de tendencia
  const totalSystemUnits = groupedLaboratories.reduce((acc, curr) => acc + curr.totalSystemUnits, 0);
  const totalNegativeUnits = groupedLaboratories.reduce((acc, curr) => acc + curr.negativeUnits, 0);
  const totalPositiveUnits = groupedLaboratories.reduce((acc, curr) => acc + curr.positiveUnits, 0);

  const calculateTrend = (value: number, total: number) => {
    if (total === 0) return { value: 0, isPositive: true };
    const percentage = (value / total) * 100;
    return {
      value: Math.abs(Number(percentage.toFixed(1))),
      isPositive: percentage >= 0
    };
  };

  const netTrend = calculateTrend(totalNegativeUnits + totalPositiveUnits, totalSystemUnits);
  const negativeTrend = calculateTrend(totalNegativeUnits, totalSystemUnits);
  const positiveTrend = calculateTrend(totalPositiveUnits, totalSystemUnits);

  const progressPercentage = totalLabs > 0 ? Math.round((controlledLabs / totalLabs) * 100) : 0;

  const filteredAndSortedLabs = useMemo(() => {
    let result = [...groupedLaboratories];

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((lab) =>
        (lab.labName || '').toLowerCase().includes(term)
      );
    }

    // Filtrar por estado
    if (statusFilter !== "all") {
      result = result.filter(lab => lab.status === statusFilter);
    }

    // Ordenar
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-desc":
          return b.labName.localeCompare(a.labName);
        case "value-asc":
          return a.differenceValue - b.differenceValue;
        case "value-desc":
          return b.differenceValue - a.differenceValue;
        case "name-asc":
        default:
          return a.labName.localeCompare(b.labName);
      }
    });

    return result;
  }, [groupedLaboratories, searchTerm, sortBy, statusFilter]);

  // --- Mass Actions ---

  const handleMassSync = async () => {
    if (!user?.branchSheet || filteredAndSortedLabs.length === 0) return;
    
    setIsProcessingMassAction(true);
    notify.info("Sincronización Masiva", `Sincronizando ${filteredAndSortedLabs.length} laboratorios...`);
    
    try {
      // Usamos Promise.all con un pequeño delay o secuencial para no saturar Supabase
      // En este caso, como son RPCs, podemos dispararlos en batches
      const labsToSync = filteredAndSortedLabs.filter(l => l.status !== 'pendiente');
      
      for (const lab of labsToSync) {
        await cyclicInventoryService.recomputeLabProgress(user.branchSheet, lab.labName);
      }
      
      notify.success("Sincronización Completada", "Todos los laboratorios han sido actualizados.");
      // Recargar datos
      window.location.reload(); 
    } catch (error) {
      console.error("Error in mass sync:", error);
      notify.error("Error", "Ocurrió un error durante la sincronización masiva.");
    } finally {
      setIsProcessingMassAction(false);
    }
  };

  const prepareMassReset = () => {
    const challenge = "REINICIAR TODO";
    setMassResetChallenge(challenge);
    setMassResetInput("");
    setShowMassResetDialog(true);
  };

  const handleMassReset = async () => {
    if (massResetInput !== massResetChallenge) return;
    if (!user?.branchSheet) return;

    setIsProcessingMassAction(true);
    setShowMassResetDialog(false);
    notify.info("Reiniciando Sucursal", "Borrando todos los datos de inventario...");

    try {
      const labsToReset = filteredAndSortedLabs.filter(l => l.status !== 'pendiente');
      
      for (const lab of labsToReset) {
        await cyclicInventoryService.deleteInventory(user.branchSheet, lab.labName);
        await cyclicInventoryService.deleteAdjustmentHistory(user.branchSheet, lab.labName);
      }

      notify.success("Reinicio Completado", "Todos los laboratorios han sido puestos a cero.");
      window.location.reload();
    } catch (error) {
      console.error("Error in mass reset:", error);
      notify.error("Error", "Ocurrió un error durante el reinicio masivo.");
    } finally {
      setIsProcessingMassAction(false);
    }
  };

  const handleAddLaboratory = async () => {
    const cleanLabName = newLabName.trim().toUpperCase();
    if (!cleanLabName) {
      notify.error("Error", "El nombre del laboratorio no puede estar vacío.");
      return;
    }

    if (!newLabCategories || newLabCategories.length === 0) {
      notify.error("Error", "Debes seleccionar al menos un rubro.");
      return;
    }
    
    if (!user?.branchSheet) {
      notify.error("Error", "No se identificó la sucursal activa.");
      return;
    }

    setIsAddingLab(true);
    try {
      const rowsToInsert = newLabCategories.map(cat => ({
        branch_name: user.branchSheet.toUpperCase().trim(),
        laboratory: cleanLabName,
        category: cat.toUpperCase().trim(),
        status: 'pending'
      }));

      const { error } = await supabase
        .from('branch_laboratories')
        .upsert(rowsToInsert, {
          onConflict: 'branch_name,laboratory,category'
        });

      if (error) throw error;

      notify.success(
        "Laboratorios Agregados", 
        `Se asoció ${cleanLabName} a los rubros: ${newLabCategories.map(c => categoriesMap[c as CategoryKey] || c).join(', ')}.`
      );
      setShowAddLabDialog(false);
      setNewLabName("");
      setNewLabCategories(["MEDICAMENTOS"]);
      
      // Refresh database records
      window.location.reload();
    } catch (error: any) {
      console.error("Error adding laboratory:", error);
      notify.error("Error al agregar", error.message || "Ocurrió un error inesperado.");
    } finally {
      setIsAddingLab(false);
    }
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Lock Status Alert */}
      {lockStatus.isLocked && user?.role === 'branch' && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive font-semibold">Inventario Bloqueado</AlertTitle>
          <AlertDescription className="text-destructive/90">
            {lockStatus.reason === 'manual'
              ? 'El inventario ha sido bloqueado manualmente. No puedes cargar nuevos archivos hasta que sea desbloqueado.'
              : 'El plazo de inventario ha vencido. No puedes cargar nuevos archivos. Contacta al administrador si necesitas una extensión.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Resumen del Panel */}
      <Card className="p-6 flex flex-col gap-6 transition-all duration-300">
        {/* Top Breadcrumb and Financial Summary Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground tracking-wider">
              Rubro seleccionado
            </span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span>Inventario Cíclico</span>
              <span className="text-muted-foreground/50">›</span>
              <span className="text-primary font-bold">
                {categoriesMap[categoryFilter as CategoryKey] || categoryFilter}
              </span>
            </div>
          </div>

          {/* Financial Values horizontal list */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            {/* Diferencia Neta */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Diferencia Neta</span>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "font-bold tracking-tight text-base",
                  totalDifference < 0 ? "text-red-500 dark:text-red-400" : totalDifference > 0 ? "text-emerald-500" : "text-foreground"
                )}>
                  {totalDifference < 0 ? "-" : totalDifference > 0 ? "+" : ""}
                  <span className="text-xs font-light opacity-50 mr-0.5">$</span>
                  <CounterAnimation value={Math.abs(totalDifference)} />
                </span>
                <span className={cn("text-[10px] font-bold", totalDifference < 0 ? "text-red-500/80" : totalDifference > 0 ? "text-emerald-500/80" : "text-muted-foreground")}>
                  {totalDifference < 0 ? "↓" : totalDifference > 0 ? "↑" : ""}{netTrend.value}%
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-border/40 hidden sm:block" />

            {/* Negativo Total */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Faltante Total</span>
              <div className="flex items-baseline gap-2">
                <span className="font-bold tracking-tight text-base text-red-500 dark:text-red-400">
                  <span className="text-xs font-light opacity-50 mr-0.5">$</span>
                  <CounterAnimation value={Math.abs(totalNegative)} />
                </span>
                <span className="text-[10px] font-bold text-red-500/80">
                  ↓{negativeTrend.value}%
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-border/40 hidden sm:block" />

            {/* Positivo Total */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sobrante Total</span>
              <div className="flex items-baseline gap-2">
                <span className="font-bold tracking-tight text-base text-emerald-500">
                  <span className="text-xs font-light opacity-50 mr-0.5">$</span>
                  <CounterAnimation value={totalPositive} />
                </span>
                <span className="text-[10px] font-bold text-emerald-500/80">
                  ↑{positiveTrend.value}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Central Progress Panel (Visual structure similar to reference image) */}
        <div className="border bg-muted/20 dark:bg-muted/10 rounded-2xl p-5 flex flex-col gap-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* Custom signal/progress bars icon */}
              <div className="flex items-end gap-0.5 h-4 w-4 text-emerald-500">
                <div className="w-0.5 h-1.5 bg-current rounded-full" />
                <div className="w-0.5 h-2.5 bg-current rounded-full" />
                <div className="w-0.5 h-3.5 bg-current rounded-full" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                Avance: <span className="font-bold text-foreground tabular-nums text-base">{progressPercentage}%</span>
              </span>
            </div>

            {/* Controlled/Total Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold px-2.5 py-1">
                {controlledLabs} / {totalLabs} Controlados
              </Badge>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs font-semibold px-2.5 py-1">
                {pendingLabs} Pendientes
              </Badge>
            </div>
          </div>

          {/* Progress bar and ticks */}
          <div className="space-y-2">
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-emerald-500 rounded-full"
              />
            </div>
            {/* Ticks */}
            <div className="flex justify-between text-[10px] text-muted-foreground/60 font-medium px-0.5">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center justify-between transition-all gap-4 mb-4">
        {/* Filtros de Categoría */}
        <Group aria-label="Filtros de categoría" className="shrink-0">
          {CATEGORIES.map((cat, index) => (
            <React.Fragment key={cat}>
              {index > 0 && <GroupSeparator />}
              <Button
                variant={categoryFilter === cat ? "secondary" : "outline"}
                size="lg"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "whitespace-nowrap font-semibold transition-all px-6",
                  categoryFilter === cat
                    ? "opacity-100"
                    : "opacity-80 hover:opacity-100"
                )}
              >
                {cat === "MEDICAMENTOS" ? "Medicamentos" :
                  cat === "PERFUMERIA" ? "Perfumería" :
                    cat === "ACCESORIOS" ? "Accesorios" : "Varios"}
              </Button>
            </React.Fragment>
          ))}
        </Group>

        {/* Toolbar de Acciones */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          {/* Barra de búsqueda fija como InputGroup */}
          <div className="flex-1 max-w-[240px] md:max-w-xs transition-all">
              <InputGroup className="h-10 w-full bg-popover border-input shadow-xs">
                  <InputGroupAddon className="bg-transparent border-none">
                      <Search className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput 
                      aria-label="Search" 
                      placeholder="Buscar por nombre..." 
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent border-none focus-visible:ring-0 text-sm h-full"
                  />
              </InputGroup>
          </div>

          <Group aria-label="Acciones de tabla" className="shrink-0">
              {/* Botón Alerta / Info */}
              <Button variant="outline" size="icon" className="group">
                  <AlertCircle className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Button>
              <GroupSeparator />
              <Menu>
                  <MenuTrigger render={
                      <Button variant="outline" size="icon" className="group">
                          <Filter className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </Button>
                  } />
                  <MenuPopup align="end" className="w-52 p-2">
                    <MenuGroup>
                      <MenuGroupLabel>Ordenar por</MenuGroupLabel>
                      <MenuItem onClick={() => setSortBy("name-asc")}>
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <span>Nombre (A-Z)</span>
                      </MenuItem>
                      <MenuItem onClick={() => setSortBy("name-desc")}>
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <span>Nombre (Z-A)</span>
                      </MenuItem>
                      <MenuItem onClick={() => setSortBy("value-desc")}>
                        <TrendingUp className="w-4 h-4 text-success" />
                        <span>Mayor Diferencia</span>
                      </MenuItem>
                      <MenuItem onClick={() => setSortBy("value-asc")}>
                        <TrendingDown className="w-4 h-4 text-destructive" />
                        <span>Menor Diferencia</span>
                      </MenuItem>
                    </MenuGroup>
                    
                    <MenuSeparator className="my-2" />
                    
                    <MenuGroup>
                      <MenuGroupLabel>Filtrar por Estado</MenuGroupLabel>
                      <MenuCheckboxItem checked={statusFilter === "all"} onCheckedChange={() => setStatusFilter("all")}>
                        <div className="flex items-center gap-3">
                          <ListIcon className="w-4 h-4 text-muted-foreground" />
                          <span>Todas</span>
                        </div>
                      </MenuCheckboxItem>
                      <MenuCheckboxItem checked={statusFilter === "controlado"} onCheckedChange={() => setStatusFilter("controlado")}>
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span>Controlados</span>
                        </div>
                      </MenuCheckboxItem>
                      <MenuCheckboxItem checked={statusFilter === "por_controlar"} onCheckedChange={() => setStatusFilter("por_controlar")}>
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-purple-500" />
                          <span>En Proceso</span>
                        </div>
                      </MenuCheckboxItem>
                      <MenuCheckboxItem checked={statusFilter === "pendiente"} onCheckedChange={() => setStatusFilter("pendiente")}>
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span>Pendientes</span>
                        </div>
                      </MenuCheckboxItem>
                    </MenuGroup>
                  </MenuPopup>
              </Menu>
              <GroupSeparator />
              <Menu>
                  <MenuTrigger render={
                      <Button variant="outline" size="icon" className="group" disabled={isProcessingMassAction}>
                          <MoreVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </Button>
                  } />
                  <MenuPopup align="end" className="w-64 p-2">
                    <MenuGroup>
                      <MenuGroupLabel>Reportes (Sucursal)</MenuGroupLabel>
                      <MenuItem onClick={() => ReportExporter.exportSummaryToPDF(filteredAndSortedLabs, user?.branchSheet || "Sucursal")}>
                        <Document className="w-4 h-4 text-muted-foreground" />
                        <span>Descargar Reporte PDF</span>
                      </MenuItem>
                      <MenuItem onClick={() => ReportExporter.exportSummaryToExcel(filteredAndSortedLabs, user?.branchSheet || "Sucursal")}>
                        <Download className="w-4 h-4 text-muted-foreground" />
                        <span>Descargar Planilla Excel</span>
                      </MenuItem>
                    </MenuGroup>

                    {user?.role === 'admin' && (
                      <>
                        <MenuSeparator className="my-2" />
                        <MenuGroup>
                          <MenuGroupLabel>Administración</MenuGroupLabel>
                          <MenuItem onClick={() => setShowAddLabDialog(true)} className="text-foreground focus:text-foreground">
                            <Plus className="w-4 h-4 text-muted-foreground" />
                            <span>Agregar laboratorio</span>
                          </MenuItem>
                          <MenuItem onClick={handleMassSync} className="text-primary focus:text-primary">
                            <RotateCcw className="w-4 h-4" />
                            <span>Sincronizar todo (Forzar)</span>
                          </MenuItem>
                          <MenuItem onClick={prepareMassReset} variant="destructive" className="text-destructive focus:text-destructive">
                            <Trash className="w-4 h-4" />
                            <span>Reiniciar sucursal</span>
                          </MenuItem>
                        </MenuGroup>
                      </>
                    )}
                  </MenuPopup>
              </Menu>
          </Group>

          <Tabs 
            value={viewMode} 
            onValueChange={(val) => setViewMode(val as 'grid' | 'list')}
            className="items-center shrink-0"
          >
            <TabsList className="bg-popover border border-input shadow-sm p-1 rounded-xl h-10 w-fit inline-flex">
              <TabsTab aria-label="Vista Cuadrícula" value="grid" className="h-full rounded-[8px] px-3 data-[selected]:bg-accent data-[selected]:text-accent-foreground data-[selected]:shadow-sm text-muted-foreground transition-all">
                <GridIcon className="w-4 h-4" aria-hidden="true" />
              </TabsTab>
              <TabsTab aria-label="Vista Lista" value="list" className="h-full rounded-[8px] px-3 data-[selected]:bg-accent data-[selected]:text-accent-foreground data-[selected]:shadow-sm text-muted-foreground transition-all">
                <ListIcon className="w-4 h-4" aria-hidden="true" />
              </TabsTab>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Contenido Principal */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedLabs.map((lab) => (
            <LaboratoryCard
              key={lab.labName}
              name={lab.labName}
              negativeValue={lab.negativeValue}
              positiveValue={lab.positiveValue}
              differenceValue={lab.differenceValue}
              status={lab.status}
              progress={lab.progress}
              onClick={() => navigate(`/cyclic-inventory/${encodeURIComponent(lab.labName)}`)}
              onMouseEnter={() => prefetchLab(user?.branchSheet || "", lab.labName)}
            />
          ))}
        </div>
      ) : (
        <Frame>
          <FramePanel className="p-0 overflow-hidden">
            <Table>
              <TableHeader className="bg-transparent">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="pl-6">Laboratorio</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Valor (-)</TableHead>
                  <TableHead className="text-center">Un. (-)</TableHead>
                  <TableHead className="text-right">Valor (+)</TableHead>
                  <TableHead className="text-center">Un. (+)</TableHead>
                  <TableHead className="text-right">Dif. Neta</TableHead>
                  <TableHead className="text-center w-[140px] pr-6">Avance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-background rounded-l-xl rounded-r-xl overflow-hidden shadow-xs/5">
                {filteredAndSortedLabs.map((lab) => (
                  <TableRow 
                    key={lab.labName}
                    className="cursor-pointer border-t border-border/40 first:border-none"
                    onClick={() => navigate(`/cyclic-inventory/${encodeURIComponent(lab.labName)}`)}
                  >
                    <TableCell className="pl-6 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                      <span className="font-semibold text-foreground/90">{lab.labName}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <div className={cn(
                          "size-1.5 rounded-full shadow-sm",
                          lab.status === 'controlado' ? "bg-emerald-500" : 
                          lab.status === 'por_controlar' ? "bg-blue-500" : 
                          "bg-amber-500"
                        )} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-destructive/80 tabular-nums">
                        {lab.negativeValue !== 0 ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lab.negativeValue) : "–"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium text-destructive/80 tabular-nums">
                        {(() => {
                          const units = lab.negativeUnits !== 0 ? Math.abs(lab.negativeUnits) : (lab.netUnits < 0 ? Math.abs(lab.netUnits) : 0);
                          return units !== 0 ? units : "–";
                        })()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {lab.positiveValue !== 0 ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lab.positiveValue) : "–"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {(() => {
                          const units = lab.positiveUnits !== 0 ? lab.positiveUnits : (lab.netUnits > 0 ? lab.netUnits : 0);
                          return units !== 0 ? units : "–";
                        })()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-mono font-medium tabular-nums",
                        lab.differenceValue > 0 ? "text-emerald-600 dark:text-emerald-400" : 
                        lab.differenceValue < 0 ? "text-red-600 dark:text-red-400" : 
                          "text-muted-foreground"
                      )}>
                        {lab.differenceValue !== 0 ? (lab.differenceValue > 0 ? "+" : "") + new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lab.differenceValue) : "–"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center pr-6">
                      <div className="flex flex-col gap-0.5 w-full max-w-[100px] mx-auto">
                        <div className="flex items-center justify-between text-[11px] font-medium tabular-nums">
                          <span className={lab.progress > 0 ? "text-foreground" : "text-muted-foreground"}>{lab.progress}%</span>
                        </div>
                        <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-foreground/70"
                            style={{ width: `${lab.progress}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FramePanel>
        </Frame>
      )}

      {/* Mass Reset Confirmation Dialog */}
      <Dialog open={showMassResetDialog} onOpenChange={setShowMassResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircleIcon className="w-5 h-5" />
              Confirmar Reinicio Masivo
            </DialogTitle>
            <DialogDescription className="pt-2">
              Esta acción eliminará <strong>TODOS</strong> los datos de inventario, ajustes y productos controlados de <strong>TODOS</strong> los laboratorios mostrados actualmente. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Para confirmar, escribe:</p>
              <p className="text-lg font-black tracking-widest text-center select-none">{massResetChallenge}</p>
            </div>
            
            <Input
              value={massResetInput}
              onChange={(e) => setMassResetInput(e.target.value.toUpperCase())}
              placeholder="Escribe el texto de confirmación..."
              className="font-bold text-center"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowMassResetDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleMassReset}
              disabled={massResetInput !== massResetChallenge}
            >
              Reiniciar Todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lab Manually Dialog */}
      <Dialog open={showAddLabDialog} onOpenChange={setShowAddLabDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl shadow-xl border border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Plus className="w-5 h-5 text-primary" />
              <span>Agregar laboratorio manualmente</span>
            </DialogTitle>
            <DialogDescription>
              Esto asociará un nuevo laboratorio y rubros a la sucursal <strong>{user?.branchSheet}</strong> de forma directa.
            </DialogDescription>
          </DialogHeader>
          <Form 
            onSubmit={(e) => {
              e.preventDefault();
              handleAddLaboratory();
            }} 
            className="contents"
          >
            <DialogPanel className="grid gap-5">
              <Field>
                <FieldLabel className="text-sm font-semibold text-foreground/90">Nombre del Laboratorio</FieldLabel>
                <Input
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value.toUpperCase())}
                  placeholder="Ej. ELEA, CASASCO, ROEMMERS..."
                  className="font-bold uppercase h-11 px-4 rounded-xl border border-input focus:border-primary/50 transition-colors w-full"
                />
              </Field>
              <Field>
                <FieldLabel className="text-sm font-semibold text-foreground/90">Rubros / Categorías</FieldLabel>
                <Select 
                  value={newLabCategories} 
                  onValueChange={setNewLabCategories}
                  multiple
                >
                  <SelectTrigger className="w-full h-11 px-4 rounded-xl bg-popover text-foreground border border-input focus:border-primary/50 transition-colors">
                    <SelectValue>{renderCategoryValue}</SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="MEDICAMENTOS">Medicamentos</SelectItem>
                    <SelectItem value="PERFUMERIA">Perfumería</SelectItem>
                    <SelectItem value="ACCESORIOS">Accesorios</SelectItem>
                    <SelectItem value="VARIOS">Varios</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" className="h-10 rounded-xl" />} onClick={() => setShowAddLabDialog(false)}>
                Cancelar
              </DialogClose>
              <Button 
                type="submit"
                disabled={isAddingLab || !newLabName.trim() || newLabCategories.length === 0}
                className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold h-10 rounded-xl px-5"
              >
                {isAddingLab ? "Agregando..." : "Agregar Laboratorio"}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


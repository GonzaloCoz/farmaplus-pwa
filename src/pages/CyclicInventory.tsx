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

type SortOption = "name-asc" | "name-desc" | "value-asc" | "value-desc";
type FilterCategory = "MEDICAMENTOS" | "PERFUMERIA" | "ACCESORIOS" | "VARIOS";
type StatusFilter = "all" | "controlado" | "pendiente" | "por_controlar";

const CATEGORIES: FilterCategory[] = ["MEDICAMENTOS", "PERFUMERIA", "ACCESORIOS", "VARIOS"];

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
  const [lockStatus, setLockStatus] = useState<{ isLocked: boolean, reason: 'manual' | 'deadline' | null }>({ isLocked: false, reason: null });

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
        lab.labName.toLowerCase().includes(term)
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-6 flex flex-col justify-between bg-card/40 dark:bg-card/20 backdrop-blur-sm border border-border/50 shadow-sm rounded-2xl overflow-hidden relative group transition-all duration-300">
          <div className="flex items-center gap-3 text-primary mb-4 relative z-10">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Avance Global</span>
          </div>

          <div className="space-y-1 relative z-10">
            <div className="text-4xl font-black tracking-tighter flex items-baseline gap-1.5 text-foreground">
              <CounterAnimation value={progressPercentage} />
              <span className="text-xl font-bold opacity-30">%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-primary"
                />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/60 whitespace-nowrap uppercase tracking-wider tabular-nums">
                {controlledLabs}/{totalLabs}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between bg-card/40 dark:bg-card/20 backdrop-blur-sm border border-border/50 shadow-sm rounded-2xl overflow-hidden relative group transition-all duration-300">
          <div className="flex items-center gap-3 text-success mb-4 relative z-10">
            <div className="p-2 rounded-xl bg-success/10 border border-success/20">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Controlados</span>
          </div>

          <div className="text-4xl font-black tracking-tighter text-success relative z-10">
            <CounterAnimation value={controlledLabs} />
          </div>

          <div className="mt-2 h-1.5 w-full bg-success/10 rounded-full relative z-10 overflow-hidden">
            <div className="h-full bg-success w-full opacity-30" />
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between bg-card/40 dark:bg-card/20 backdrop-blur-sm border border-border/50 shadow-sm rounded-2xl overflow-hidden relative group transition-all duration-300">
          <div className="flex items-center gap-3 text-muted-foreground mb-4 relative z-10">
            <div className="p-2 rounded-xl bg-muted/50 border border-border/40">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Pendientes</span>
          </div>

          <div className="text-4xl font-black tracking-tighter text-muted-foreground relative z-10">
            <CounterAnimation value={pendingLabs} />
          </div>

          <div className="mt-2 h-1.5 w-full bg-muted/50 rounded-full relative z-10 overflow-hidden">
            <div className="h-full bg-muted-foreground w-full opacity-20" />
          </div>
        </Card>

        <MetricCarousel
          items={[
            {
              id: "net",
              label: "Diferencia Neta",
              value: totalDifference,
              color: totalDifference < 0 ? "text-destructive" : totalDifference > 0 ? "text-success" : "text-foreground",
              icon: DollarSign,
              prefix: "$",
              trend: netTrend
            },
            {
              id: "negative",
              label: "Negativo Total",
              value: totalNegative,
              color: "text-destructive",
              icon: TrendingDown,
              prefix: "$",
              trend: negativeTrend
            },
            {
              id: "positive",
              label: "Positivo Total",
              value: totalPositive,
              color: "text-success",
              icon: TrendingUp,
              prefix: "$",
              trend: positiveTrend
            }
          ]}
        />
      </div>

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
              <Button variant="outline" size="icon" className="group">
                  <MoreVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Button>
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
    </div>
  );
}

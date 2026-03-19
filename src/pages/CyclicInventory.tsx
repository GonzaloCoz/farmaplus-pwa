import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { notify } from '@/lib/notifications';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chart as BarChart3, CheckCircle, DangerCircle as AlertCircle, Dollar, GraphDown as TrendingDown, GraphUp as TrendingUp, Restart as Loader2, Dollar as DollarSign, Magnifer as Search, Filter, MenuDots as MoreVertical, Widget as GridIcon, List as ListIcon, ClockCircle as Clock } from "@solar-icons/react";
import { LaboratoryCard, LaboratoryStatus } from "@/components/LaboratoryCard";
import { CounterAnimation } from "@/components/CounterAnimation";
import { MetricCarousel } from "@/components/MetricCarousel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, normalizeString } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getLaboratoriesForBranch } from "@/services/preCountDB";
import { cyclicInventoryService, CyclicInventoryStats } from "@/services/cyclicInventoryService";
import { useUser } from "@/contexts/UserContext";
import { usePrefetchLabInventory } from "@/hooks/useInventoryQueries";

type SortOption = "name-asc" | "name-desc" | "value-asc" | "value-desc";
type FilterCategory = "MEDICAMENTOS" | "PERFUMERIA" | "ACCESORIOS" | "VARIOS";
type StatusFilter = "all" | "controlado" | "pendiente" | "por_controlar";

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


  const categories: FilterCategory[] = ["MEDICAMENTOS", "PERFUMERIA", "ACCESORIOS", "VARIOS"];

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

      {/* Filtros y Búsqueda - Sticky con Blur */}
      <div className="flex items-center justify-between sticky top-0 bg-[#f0eeef]/40 dark:bg-[#1a1a1a]/40 backdrop-blur-xl z-20 py-4 -mx-4 px-4 md:-mx-6 md:px-6 transition-all gap-4 mb-6">
        {/* Filtros de Categoría */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant="ghost"
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "whitespace-nowrap rounded-xl px-5 h-9 font-semibold transition-all",
                categoryFilter === cat
                  ? "bg-primary text-white shadow-sm dark:bg-white dark:text-black"
                  : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground"
              )}
            >
              {cat === "MEDICAMENTOS" ? "Medicamentos" :
                cat === "PERFUMERIA" ? "Perfumería" :
                  cat === "ACCESORIOS" ? "Accesorios" : "Varios"}
            </Button>
          ))}
        </div>

        {/* Toolbar de Acciones */}
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          {/* Barra de búsqueda expandible */}
          <div className="flex items-center">
            <motion.div
              initial={false}
              animate={{ 
                width: isSearchExpanded ? (window.innerWidth < 768 ? '160px' : '240px') : '36px',
                opacity: 1
              }}
              className="relative flex items-center h-9 bg-white/40 dark:bg-[#2a2a2a]/40 rounded-xl border-none overflow-hidden"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 hover:bg-white dark:hover:bg-white/10 transition-colors"
                onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              >
                <Search className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Button>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar laboratorio..."
                className={cn(
                  "bg-transparent border-none focus:outline-none text-sm w-full pr-3 transition-opacity duration-300",
                  isSearchExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              />
            </motion.div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/40 dark:bg-[#2a2a2a]/40 group">
                <Filter className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-2">
              <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Ordenar por</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSortBy("name-asc")} className="rounded-xl">
                <Search className="w-4 h-4 text-muted-foreground" />
                <span>Nombre (A-Z)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("name-desc")} className="rounded-xl">
                <Search className="w-4 h-4 text-muted-foreground" />
                <span>Nombre (Z-A)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("value-desc")} className="rounded-xl">
                <TrendingUp className="w-4 h-4 text-success" />
                <span>Mayor Diferencia</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("value-asc")} className="rounded-xl">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span>Menor Diferencia</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="my-2" />
              
              <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Filtrar por Estado</DropdownMenuLabel>
              <DropdownMenuCheckboxItem 
                checked={statusFilter === "all"} 
                onCheckedChange={() => setStatusFilter("all")}
                className="rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <ListIcon className="w-4 h-4 text-muted-foreground" />
                  <span>Todas</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={statusFilter === "controlado"} 
                onCheckedChange={() => setStatusFilter("controlado")}
                className="rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Controlados</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={statusFilter === "por_controlar"} 
                onCheckedChange={() => setStatusFilter("por_controlar")}
                className="rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <span>En Proceso</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={statusFilter === "pendiente"} 
                onCheckedChange={() => setStatusFilter("pendiente")}
                className="rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span>Pendientes</span>
                </div>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/40 dark:bg-[#2a2a2a]/40 group">
            <MoreVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Button>

          <div className="flex p-1 bg-card/40 dark:bg-[#1e1e1e] rounded-xl border border-border/50 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('grid')}
              className={cn(
                "h-7 w-8 rounded-[10px] transition-all",
                viewMode === 'grid' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GridIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('list')}
              className={cn(
                "h-7 w-8 rounded-[10px] transition-all",
                viewMode === 'list' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListIcon className="w-4 h-4" />
            </Button>
          </div>
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
        <div className="rounded-2xl border border-border/50 bg-card/10 backdrop-blur-sm overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 h-10 px-4">Laboratorio</TableHead>
                <TableHead className="text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 h-10">Estado</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 h-10">Valor (-)</TableHead>
                <TableHead className="text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 h-10">Un. (-)</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 h-10">Valor (+)</TableHead>
                <TableHead className="text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 h-10">Un. (+)</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 h-10">Dif. Neta</TableHead>
                <TableHead className="text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground/70 h-10 w-[140px]">Avance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedLabs.map((lab) => (
                <TableRow 
                  key={lab.labName}
                  className="border-border/30 hover:bg-white/5 dark:hover:bg-white/5 cursor-pointer h-12"
                  onClick={() => navigate(`/cyclic-inventory/${encodeURIComponent(lab.labName)}`)}
                >
                  <TableCell className="py-2 px-4 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                    <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{lab.labName}</span>
                  </TableCell>
                  <TableCell className="text-center px-1">
                    <div className="flex justify-center">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full shadow-sm transition-colors",
                        lab.status === 'controlado' ? "bg-green-500" : 
                        lab.status === 'por_controlar' ? "bg-purple-500 animate-pulse" : 
                        "bg-red-500"
                      )} title={lab.status.toUpperCase()} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-2 leading-tight">
                    <span className="font-bold text-destructive text-[11px]">
                      {lab.negativeValue !== 0 ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lab.negativeValue) : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-2 leading-tight">
                    <span className="font-bold text-destructive text-[11px]">
                      {(() => {
                        // Si tenemos persistencia (db), la usamos. Si es 0 (post-migracion), calculamos del neto
                        // para que el usuario no vea "-" hasta el proximo sync.
                        const units = lab.negativeUnits !== 0 ? Math.abs(lab.negativeUnits) : (lab.netUnits < 0 ? Math.abs(lab.netUnits) : 0);
                        return units !== 0 ? units : "-";
                      })()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2 leading-tight">
                    <span className="font-bold text-success text-[11px]">
                      {lab.positiveValue !== 0 ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lab.positiveValue) : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-2 leading-tight">
                    <span className="font-bold text-success text-[11px]">
                      {(() => {
                        const units = lab.positiveUnits !== 0 ? lab.positiveUnits : (lab.netUnits > 0 ? lab.netUnits : 0);
                        return units !== 0 ? units : "-";
                      })()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right py-2 leading-tight">
                    <span className={cn(
                      "font-mono font-bold text-[11px]",
                      lab.differenceValue > 0 ? "text-success" : 
                      lab.differenceValue < 0 ? "text-destructive" : 
                        "text-muted-foreground/30"
                    )}>
                      {lab.differenceValue !== 0 ? (lab.differenceValue > 0 ? "+" : "") + new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(lab.differenceValue) : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-2 px-4">
                    <div className="flex flex-col gap-0.5 w-full max-w-[100px] mx-auto">
                      <div className="flex items-center justify-between text-[9px] font-bold tabular-nums">
                        <span className={lab.progress > 0 ? "text-primary" : "text-muted-foreground/30"}>{lab.progress}%</span>
                      </div>
                      <div className="h-1 bg-muted/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary"
                          style={{ width: `${lab.progress}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

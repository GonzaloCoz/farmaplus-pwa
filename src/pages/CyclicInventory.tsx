import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { notify } from '@/lib/notifications';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, ArrowUpDown, BarChart3, CheckCircle2, AlertCircle, DollarSign, TrendingDown, TrendingUp, Loader2, Database } from "lucide-react";
import { LaboratoryCard, LaboratoryStatus } from "@/components/LaboratoryCard";
import { CounterAnimation } from "@/components/CounterAnimation";
import { MetricCarousel } from "@/components/MetricCarousel";
import { cn, normalizeString } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getLaboratoriesForBranch } from "@/services/preCountDB";
import { cyclicInventoryService, CyclicInventoryStats } from "@/services/cyclicInventoryService";
import { useUser } from "@/contexts/UserContext";

import { maintenanceService } from "@/services/maintenanceService";

type SortOption = "name-asc" | "name-desc" | "value-asc" | "value-desc";
type FilterCategory = "MEDICAMENTOS" | "PERFUMERIA" | "ACCESORIOS" | "VARIOS";

export default function CyclicInventory() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("MEDICAMENTOS");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
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
        // 1. Get Master List of Labs (Allowed for this branch)
        const allowedLabs = await getLaboratoriesForBranch(user.branchSheet);

        // 2. Get Current Inventory Status from Supabase (Filtered by branch)
        const inventoryStats = await cyclicInventoryService.getAllCyclicInventories(user.branchSheet);
        // 3. Merge Data: Union of Active Inventory + Master List (for pending)
        const mergedData: CyclicInventoryStats[] = [...inventoryStats];

        // Create lookup Set to prevent duplicates (Key: Name|Category)
        // Normalize category for robust comparison
        const activeLabsSet = new Set(inventoryStats.map(s => `${s.labName.trim().toUpperCase()}|${normalizeString(s.category || '')}`));

        allowedLabs.forEach(labInfo => {
          const labName = labInfo.name.trim().toUpperCase();
          const category = normalizeString(labInfo.category);
          const key = `${labName}|${category}`;

          // If this specific combination (Name+Category) doesn't exist in active inventory, add as Pending
          if (!activeLabsSet.has(key)) {
            mergedData.push({
              labName: labInfo.name,
              category: normalizeString(labInfo.category), // Save normalized category for pending items
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

  // Fetch lock status
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

  // Group laboratories by name to deduplicate
  // IMPORTANT: Do NOT sum values - just take the first entry to avoid counting duplicates
  const groupedLaboratories = useMemo(() => {
    // First, filter by selected category
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

  // Dashboard Stats - Using grouped laboratories
  const totalLabs = groupedLaboratories.length;
  const controlledLabs = groupedLaboratories.filter(l => l.status === 'controlado').length;
  const pendingLabs = groupedLaboratories.filter(l => l.status === 'pendiente').length;

  // Financial Stats (Global - all grouped labs)
  const totalDifference = groupedLaboratories.reduce((acc, curr) => acc + curr.differenceValue, 0);
  const totalNegative = groupedLaboratories.reduce((acc, curr) => acc + curr.negativeValue, 0);
  const totalPositive = groupedLaboratories.reduce((acc, curr) => acc + curr.positiveValue, 0);

  // Calculate Unit Totals for Trend percentages
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

    // Filter by search term
    if (searchTerm) {
      result = result.filter((lab) =>
        lab.labName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.labName.localeCompare(b.labName);
        case "name-desc":
          return b.labName.localeCompare(a.labName);
        case "value-asc":
          return a.differenceValue - b.differenceValue;
        case "value-desc":
          return b.differenceValue - a.differenceValue;
        default:
          return 0;
      }
    });

    return result;
  }, [searchTerm, sortBy, groupedLaboratories]);

  const getSortLabel = (sort: SortOption) => {
    switch (sort) {
      case "name-asc": return "Nombre (A-Z)";
      case "name-desc": return "Nombre (Z-A)";
      case "value-asc": return "Valor (Menor a Mayor)";
      case "value-desc": return "Valor (Mayor a Menor)";
    }
  };

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

      {/* Dashboard Summary */}
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
              <CheckCircle2 className="w-5 h-5" />
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

      {/* Filters and Search - Sticky with Blur */}
      <div className="flex flex-col gap-4 sticky top-0 bg-[#f0eeef]/80 dark:bg-[#2a2a2a]/80 backdrop-blur-xl z-20 py-4 -mx-4 px-4 md:-mx-6 md:px-6 transition-all border-b border-gray-200/30 dark:border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar laboratorio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            {/* Migration Button (Admin Only) */}
            {user?.role === 'admin' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 rounded-xl bg-white dark:bg-[#1e1e1e] border-gray-100/50 dark:border-white/5 shadow-sm hover:shadow-md transition-all font-semibold"
                  onClick={() => {
                    if (confirm("¿Ejecutar mantenimiento profundo de inventarios? Esto eliminará registros huérfanos y normalizará categorías.")) {
                      maintenanceService.performDeepCleanup();
                    }
                  }}
                >
                  <AlertCircle className="w-4 h-4 mr-2 text-warning" />
                  Mantenimiento DB
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 px-4 rounded-xl bg-white dark:bg-[#1e1e1e] border-gray-100/50 dark:border-white/5 shadow-sm hover:shadow-md transition-all font-semibold"
                  onClick={async () => {
                    if (!confirm("¿Sincronizar metas desde el Excel maestro a la base de datos?")) return;
                    const toastId = notify.info("Información", "Sincronizando metas...");
                    try {
                      await cyclicInventoryService.migrateGoalsFromExcel();
                      notify.success("Operación exitosa", "Metas sincronizadas con éxito.");
                      // Reload to reflect changes
                      window.location.reload();
                    } catch (e) {
                      notify.error("Error", "Error al sincronizar metas.");
                    }
                  }}
                >
                  <Database className="w-4 h-4 mr-2 text-primary" />
                  Sincronizar Metas
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9 px-4 rounded-xl shadow-sm hover:shadow-md transition-all font-semibold"
                  onClick={async () => {
                    if (!confirm("⚠️ ATENCIÓN: ¿Eliminar todo el avance de laboratorios de esta sucursal? Esta acción es irreversible y purgará inventarios, historial y reportes.")) return;

                    const secondConfirm = confirm("¿Estás ABSOLUTAMENTE seguro? Se borrará todo el progreso de la sucursal actual.");
                    if (!secondConfirm) return;

                    const toastId = notify.info("Purgando", "Eliminando avance de la sucursal...");
                    try {
                      await cyclicInventoryService.purgeBranchProgress(user?.branchSheet || "");
                      notify.success("Éxito", "Avance purgado correctamente.");
                      window.location.reload();
                    } catch (e) {
                      notify.error("Error", "No se pudo purgar el avance.");
                    }
                  }}
                >
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Purgar Avance
                </Button>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-xl border-gray-100/50 dark:border-white/5 bg-white dark:bg-[#1e1e1e] shadow-sm font-semibold px-4">
                  <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                  {getSortLabel(sortBy)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy("name-asc")}>
                  Nombre (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("name-desc")}>
                  Nombre (Z-A)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("value-asc")}>
                  Valor (Menor a Mayor)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("value-desc")}>
                  Valor (Mayor a Menor)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant="ghost"
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "whitespace-nowrap rounded-xl px-5 h-9 font-semibold transition-all",
                categoryFilter === cat
                  ? "bg-white dark:bg-[#1e1e1e] text-primary shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
                  : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5"
              )}
            >
              {cat === "MEDICAMENTOS" ? "Medicamentos" :
                cat === "PERFUMERIA" ? "Perfumería" :
                  cat === "ACCESORIOS" ? "Accesorios" : "Varios"}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid of Cards */}
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
          />
        ))}
      </div>
    </div>
  );
}

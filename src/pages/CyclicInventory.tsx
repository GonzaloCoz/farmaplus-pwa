import { useState, useMemo, useEffect } from "react";
import { notify } from '@/lib/notifications';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, ArrowUpDown, BarChart3, CheckCircle2, AlertCircle, DollarSign, TrendingDown, TrendingUp, Loader2, Database } from "lucide-react";
import { LaboratoryCard, LaboratoryStatus } from "@/components/LaboratoryCard";
import { CounterAnimation } from "@/components/CounterAnimation";
import { MetricCarousel } from "@/components/MetricCarousel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLaboratoriesForBranch } from "@/services/preCountDB";
import { cyclicInventoryService, CyclicInventoryStats } from "@/services/cyclicInventoryService";
import { useUser } from "@/contexts/UserContext";

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
        const activeLabsSet = new Set(inventoryStats.map(s => `${s.labName}|${s.category}`));

        allowedLabs.forEach(labInfo => {
          const key = `${labInfo.name}|${labInfo.category}`;

          // If this specific combination (Name+Category) doesn't exist in active inventory, add as Pending
          if (!activeLabsSet.has(key)) {
            mergedData.push({
              labName: labInfo.name,
              category: labInfo.category,
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

  // Dashboard Stats
  const currentViewLabs = laboratories.filter(l => l.category === categoryFilter);

  const totalLabs = currentViewLabs.length;
  const controlledLabs = currentViewLabs.filter(l => l.status === 'controlado').length;
  const pendingLabs = currentViewLabs.filter(l => l.status === 'pendiente').length;

  // Financial Stats (Global for current view)
  const totalDifference = currentViewLabs.reduce((acc, curr) => acc + curr.differenceValue, 0);
  const totalNegative = currentViewLabs.reduce((acc, curr) => acc + curr.negativeValue, 0);
  const totalPositive = currentViewLabs.reduce((acc, curr) => acc + curr.positiveValue, 0);

  // Calculate Unit Totals for Trend percentages
  const totalSystemUnits = currentViewLabs.reduce((acc, curr) => acc + curr.totalSystemUnits, 0);
  const totalNegativeUnits = currentViewLabs.reduce((acc, curr) => acc + curr.negativeUnits, 0);
  const totalPositiveUnits = currentViewLabs.reduce((acc, curr) => acc + curr.positiveUnits, 0);

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
    let result = [...laboratories];

    // Filter by search term
    if (searchTerm) {
      result = result.filter((lab) =>
        lab.labName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category (Strict)
    result = result.filter((lab) => lab.category === categoryFilter);

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
  }, [searchTerm, categoryFilter, sortBy, laboratories]);

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
      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between bg-primary/5 border-primary/10">
          <div className="flex items-center gap-2 text-primary mb-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Avance Global</span>
          </div>
          <div className="text-2xl font-bold">
            <CounterAnimation value={progressPercentage} />%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {controlledLabs} de {totalLabs} laboratorios
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between bg-success/5 border-success/10">
          <div className="flex items-center gap-2 text-success mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Controlados</span>
          </div>
          <div className="text-2xl font-bold text-success">
            <CounterAnimation value={controlledLabs} />
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between bg-muted/50 border-muted">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Pendientes</span>
          </div>
          <div className="text-2xl font-bold text-muted-foreground">
            <CounterAnimation value={pendingLabs} />
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

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
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
            {/* Migration Button (Admin Only likely, but public for now as requested) */}
            <Button
              variant="secondary"
              size="sm"
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
              <Database className="w-4 h-4 mr-2" />
              Sincronizar Metas
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="whitespace-nowrap">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
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
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className="whitespace-nowrap rounded-full px-4"
            >
              {cat === "MEDICAMENTOS" ? "Medicamentos" : cat.charAt(0) + cat.slice(1).toLowerCase()}
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

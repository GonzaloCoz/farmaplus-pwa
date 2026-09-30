import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { notify } from '@/lib/notifications';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import { Card } from "@/components/ui/card";
import { BarChart01 as BarChart3, CheckCircle, AlertCircle, CurrencyDollar as Dollar, TrendDown01 as TrendingDown, TrendUp01 as TrendingUp, RefreshCw01 as Loader2, SearchLg as Search, FilterLines as Filter, DotsHorizontal as MoreVertical, LayoutGrid01 as GridIcon, List as ListIcon, Clock, Download01 as Download, File02 as DocumentIcon, Trash01 as Trash, FileSearch02 } from '@untitledui/icons';
import { LaboratoryCard, LaboratoryStatus } from "@/components/LaboratoryCard";
import { LabRemovalModal } from "@/components/LabRemovalModal";
import { CounterAnimation } from "@/components/CounterAnimation";
import { ParticleCanvasBackground } from "@/components/ui/ParticleCanvasBackground";
import { MetricCarousel } from "@/components/MetricCarousel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn, normalizeString } from "@/lib/utils";
import { ReportExporter } from "@/lib/reportExporter";
import { Elevated } from "@/lib/elevated";
import { fontWeights } from "@/lib/font-weight";
import { BookOpen01 as BookOpen, Users01 as Users2, DownloadCloud01 as DownloadCloud, PenTool01 as PenTool, Plus, Edit01 as Edit } from '@untitledui/icons';
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
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownLabel,
  DropdownSeparator,
  MenuItem,
} from "@/components/ui/dropdown";
import {
  InputGroup,
  InputField,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabItem, TabPanel, TabsTab } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getLaboratoriesForBranch } from "@/services/preCountDB";
import { cyclicInventoryService, CyclicInventoryStats } from "@/services/cyclicInventoryService";
import { requestsService } from "@/services/requestsService";
import { supabase } from "@/integrations/supabase/client";
import { CyclicInventorySkeleton } from "@/components/skeletons/CyclicInventorySkeleton";
import { useUser } from "@/contexts/UserContext";
import { usePrefetchLabInventory } from "@/hooks/useInventoryQueries";
import { useIcons } from "@/lib/icon-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectButton } from "@/components/ui/select";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { SearchLg as SearchIcon } from '@untitledui/icons';

// Aliases for icons that are used under multiple names
const RotateCcw = Loader2;
const AlertCircleIcon = AlertCircle;

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
  const icons = useIcons();
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
  const [totalLedgerAdjustments, setTotalLedgerAdjustments] = useState(0);

  // Chunk loading state
  const [visibleCount, setVisibleCount] = useState(16);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Metric View Mode ('currency' | 'units')
  const [metricViewMode, setMetricViewMode] = useState<'currency' | 'units'>('currency');

  // Mass Reset State
  const [showMassResetDialog, setShowMassResetDialog] = useState(false);
  const [massResetChallenge, setMassResetChallenge] = useState("");
  const [massResetInput, setMassResetInput] = useState("");

  // Add/Edit Lab Manually State
  const [showAddLabDialog, setShowAddLabDialog] = useState(false);
  const [newLabName, setNewLabName] = useState("");
  const [newLabCategories, setNewLabCategories] = useState<string[]>(["MEDICAMENTOS"]);
  const [isAddingLab, setIsAddingLab] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingLabOriginalName, setEditingLabOriginalName] = useState("");
  const [selectedEditLab, setSelectedEditLab] = useState("");

  // Lab Removal Request State
  const [removalModalOpen, setRemovalModalOpen] = useState(false);
  const [removalLabData, setRemovalLabData] = useState<{ labName: string; category?: string; round?: number } | null>(null);

  const loadLabs = useCallback(async () => {
    if (!user?.branchSheet) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    try {
      // 1. Cargar en paralelo todas las consultas independientes
      const [allBranchRequests, allowedLabs, config, inventoryStats] = await Promise.all([
        requestsService.getRequests(user.branchSheet),
        getLaboratoriesForBranch(user.branchSheet),
        cyclicInventoryService.getBranchConfig(user.branchSheet),
        cyclicInventoryService.getAllCyclicInventories(user.branchSheet)
      ]);

      const approvedBajas = allBranchRequests
        .filter(r => (r.type === 'Baja de Laboratorio' || !r.type) && r.status === 'approved')
        .map(r => ({
          targetName: (r.targetName || '').trim().toUpperCase(),
          category: r.category ? r.category.trim().toUpperCase() : undefined,
          branchName: r.branchName
        }));

      const pendingBajas = allBranchRequests
        .filter(r => (r.type === 'Baja de Laboratorio' || !r.type) && r.status === 'pending')
        .map(r => ({
          targetName: (r.targetName || '').trim().toUpperCase(),
          category: r.category ? r.category.trim().toUpperCase() : undefined,
          branchName: r.branchName,
          reason: r.reason
        }));

      // Helper para verificar si un laboratorio/rubro fue dado de baja
      const checkIsDischarged = (labName: string, categoryName?: string) => {
        const normLab = labName.trim().toUpperCase();
        const normCat = (categoryName || '').trim().toUpperCase();
        return approvedBajas.some(b => {
          if (b.targetName !== normLab) return false;
          if (!b.category || b.category === "BAJA TOTAL" || b.category === "TODOS" || b.category === "GENERAL") return true;
          const allowedCats = b.category.split(',').map(c => c.trim().toUpperCase());
          return allowedCats.includes(normCat);
        });
      };

      // Helper para verificar si un laboratorio/rubro tiene solicitud de baja pendiente
      const checkPendingRemoval = (labName: string, categoryName?: string) => {
        const normLab = labName.trim().toUpperCase();
        const normCat = (categoryName || '').trim().toUpperCase();
        const match = pendingBajas.find(b => {
          if (b.targetName !== normLab) return false;
          if (!b.category || b.category === "BAJA TOTAL" || b.category === "TODOS" || b.category === "GENERAL") return true;
          const allowedCats = b.category.split(',').map(c => c.trim().toUpperCase());
          return allowedCats.includes(normCat);
        });
        return match ? { hasPending: true, reason: match.reason } : { hasPending: false, reason: undefined };
      };

      // Filtrar por la ronda activa de cada categoría
      const activeInventoryStats = inventoryStats.filter(lab => {
        const catNorm = (lab.category || 'VARIOS').toUpperCase();
        const activeRound = config.rounds?.[catNorm] || config.rounds?.GENERAL || 1;
        return (lab.round || 1) === activeRound;
      });

      const activeAllowedLabs = allowedLabs.filter(labInfo => {
        const catNorm = (labInfo.category || 'VARIOS').toUpperCase();
        const activeRound = config.rounds?.[catNorm] || config.rounds?.GENERAL || 1;
        return (labInfo.round || 1) === activeRound;
      });

      // 3. Unir datos: Unión de Inventario Activo (desde branch_laboratories) + Lista Maestra (para pendientes)
      const mergedData: CyclicInventoryStats[] = activeInventoryStats.map(stat => {
        const pending = checkPendingRemoval(stat.labName, stat.category);
        return {
          ...stat,
          isDischarged: checkIsDischarged(stat.labName, stat.category),
          hasPendingRemoval: pending.hasPending,
          pendingRemovalReason: pending.reason
        };
      });

      // Crear un Set de búsqueda para evitar duplicados (Clave: Nombre|Categoría)
      const activeLabsSet = new Set(activeInventoryStats.map(s => `${s.labName.trim().toUpperCase()}|${normalizeString(s.category || '')}`));

      activeAllowedLabs.forEach(labInfo => {
        const labName = labInfo.name.trim().toUpperCase();
        const category = normalizeString(labInfo.category);
        const key = `${labName}|${category}`;

        // Si esta combinación específica (Nombre+Categoría) no existe en el inventario activo, agregar como Pendiente
        if (!activeLabsSet.has(key)) {
          const pending = checkPendingRemoval(labInfo.name, labInfo.category);
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
            netUnits: 0,
            round: labInfo.round,
            isDischarged: checkIsDischarged(labInfo.name, labInfo.category),
            hasPendingRemoval: pending.hasPending,
            pendingRemovalReason: pending.reason
          });
        }
      });

      setLaboratories(mergedData);

      // Contar ajustes históricos reales del ledger (con ID de PLEX)
      try {
        const { count, error: ledgerErr } = await supabase
          .from('inventory_ledger' as any)
          .select('id', { count: 'exact', head: true })
          .eq('branch_name', normalizeString(user.branchSheet))
          .or('adjustment_id_shortage.not.is.null,adjustment_id_surplus.not.is.null');

        if (!ledgerErr && count !== null) {
          setTotalLedgerAdjustments(count);
        }
      } catch (ledgerCountErr) {
        console.warn('Error al contar ajustes del ledger:', ledgerCountErr);
      }
    } catch (error) {
      console.error("Error loading laboratories:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLabs();

    // Suscripción Realtime para actualizar la vista de laboratorios cuando se apruebe o rechace una solicitud
    const channel = supabase
      .channel('cyclic-inventory-requests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        loadLabs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLabs]);

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
          navigate(`/inventario-ciclico/${encodeURIComponent(laboratory)}`);
        } else {
          notify.error("Error", "No se pudo identificar el laboratorio en el archivo enviado.");
        }
      });

      return cleanup;
    }
  }, [navigate]);

  // Calcula la cantidad total de laboratorios activos por categoría
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    CATEGORIES.forEach(cat => counts.set(cat, 0));

    // Usamos mapa temporal para agrupar únicos de todo el dataset (solo activos)
    const groupedLocal = new Map<string, CyclicInventoryStats>();
    laboratories.forEach(lab => {
      if (lab.isDischarged) return; // No contar laboratorios dados de baja
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
  const groupedLaboratories = useMemo(() => {
    // Primero, filtrar por la categoría seleccionada
    const filteredByCategory = categoryFilter
      ? laboratories.filter(lab => normalizeString(lab.category || '') === normalizeString(categoryFilter))
      : laboratories;

    // Then deduplicate by name (take first entry only)
    const grouped = new Map<string, CyclicInventoryStats>();

    filteredByCategory.forEach(lab => {
      const key = lab.labName.trim().toUpperCase();

      if (!grouped.has(key)) {
        grouped.set(key, { ...lab });
      } else {
        if (lab.isDischarged) {
          grouped.get(key)!.isDischarged = true;
        }
        if (lab.hasPendingRemoval) {
          grouped.get(key)!.hasPendingRemoval = true;
          grouped.get(key)!.pendingRemovalReason = lab.pendingRemovalReason;
        }
      }
    });

    return Array.from(grouped.values());
  }, [laboratories, categoryFilter]);

  // Obtener nombres únicos de todos los laboratorios para la edición
  const uniqueLabNames = useMemo(() => {
    const names = new Set<string>();
    laboratories.forEach(l => {
      if (l.labName) names.add(l.labName.trim().toUpperCase());
    });
    return Array.from(names).sort();
  }, [laboratories]);

  const comboboxItems = useMemo(() => {
    return uniqueLabNames.map(name => ({ label: name, value: name }));
  }, [uniqueLabNames]);

  // Laboratorios activos (sin baja) para métricas, conteos y avance
  const activeLabs = useMemo(() => groupedLaboratories.filter(l => !l.isDischarged), [groupedLaboratories]);

  // Estadísticas del Panel - Usando laboratorios activos
  const totalLabs = activeLabs.length;
  const controlledLabs = activeLabs.filter(l => l.status === 'controlado').length;
  const pendingLabs = activeLabs.filter(l => l.status === 'pendiente').length;
  const inProgressLabs = activeLabs.filter(l => l.status === 'por_controlar').length;

  // Estadísticas Financieras (Global - laboratorios activos)
  const totalDifference = activeLabs.reduce((acc, curr) => acc + curr.differenceValue, 0);
  const totalNegative = activeLabs.reduce((acc, curr) => acc + curr.negativeValue, 0);
  const totalPositive = activeLabs.reduce((acc, curr) => acc + curr.positiveValue, 0);
  const totalAbsoluteDifference = totalPositive + Math.abs(totalNegative);

  // Calcular Totales de Unidades
  const totalSystemUnits = activeLabs.reduce((acc, curr) => acc + (curr.totalSystemUnits || 0), 0);
  const totalNegativeUnits = activeLabs.reduce((acc, curr) => acc + (curr.negativeUnits || 0), 0);
  const totalPositiveUnits = activeLabs.reduce((acc, curr) => acc + (curr.positiveUnits || 0), 0);

  // Total de unidades/ítems controlados para el cálculo de porcentaje sobre lo auditado
  const totalControlledItems = activeLabs.reduce((acc, curr) => acc + (curr.controlledItems || 0), 0);
  const totalAuditedUnits = totalSystemUnits > 0 
    ? totalSystemUnits 
    : (totalControlledItems > 0 ? totalControlledItems : (totalPositiveUnits + Math.abs(totalNegativeUnits)));

  const calculateTrend = (value: number, total: number) => {
    if (total === 0 || value === 0) return { value: "0", isPositive: true };
    const raw = (value / total) * 100;
    const abs = Math.abs(raw);
    const formatted = abs < 0.1 && abs > 0 ? abs.toFixed(2) : abs.toFixed(1);
    return {
      value: formatted,
      isPositive: raw >= 0
    };
  };

  const netTrend = calculateTrend(totalNegativeUnits + totalPositiveUnits, totalAuditedUnits);
  const negativeTrend = calculateTrend(totalNegativeUnits, totalAuditedUnits);
  const positiveTrend = calculateTrend(totalPositiveUnits, totalAuditedUnits);
  const absoluteTrend = calculateTrend(Math.abs(totalNegativeUnits) + totalPositiveUnits, totalAuditedUnits);
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

  // Callback ref for IntersectionObserver - must be defined after filteredAndSortedLabs
  const observerTargetRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();

      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + 16, filteredAndSortedLabs.length));
          }
        },
        {
          rootMargin: "250px",
        }
      );

      observerRef.current.observe(node);
    },
    [filteredAndSortedLabs.length]
  );

  // Chunk loading: Slice the data to render only visible items
  const renderedLabs = useMemo(() => {
    return filteredAndSortedLabs.slice(0, visibleCount);
  }, [filteredAndSortedLabs, visibleCount]);

  // Reset visible chunk count when filters change
  useEffect(() => {
    setVisibleCount(16);
  }, [searchTerm, categoryFilter, sortBy, statusFilter]);

  // --- Mass Actions ---

  const handleMassSync = async () => {
    const targetBranch = user?.branchSheet || "PADUA";

    setIsProcessingMassAction(true);
    notify.info("Sincronización Masiva", `Sincronizando laboratorios de sucursal ${targetBranch}...`);

    try {
      const cleanBranch = normalizeString(targetBranch);
      const { data: labs } = await supabase
        .from('branch_laboratories')
        .select('laboratory')
        .or(`branch_name.eq.${cleanBranch},branch_name.eq.${targetBranch.trim()}`);

      const uniqueNames = Array.from(new Set(labs?.map(l => l.laboratory) || []));

      for (const labName of uniqueNames) {
        await cyclicInventoryService.updateLabMetadata(targetBranch, labName);
      }

      notify.success("Sincronización Completada", `Todos los laboratorios de ${targetBranch} han sido actualizados.`);
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
        branch_name: normalizeString(user.branchSheet),
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

  const handleOpenAddDialog = () => {
    setIsEditMode(false);
    setEditingLabOriginalName("");
    setSelectedEditLab("");
    setNewLabName("");
    setNewLabCategories(["MEDICAMENTOS"]);
    setShowAddLabDialog(true);
  };

  const handleOpenEditDialog = () => {
    setIsEditMode(true);
    setEditingLabOriginalName("");
    setSelectedEditLab("");
    setNewLabName("");
    setNewLabCategories([]);
    setShowAddLabDialog(true);
  };

  const handleSelectLabToEdit = (labName: string) => {
    setSelectedEditLab(labName);
    setEditingLabOriginalName(labName);
    setNewLabName(labName);

    // Find categories this lab currently has in our local list of labs
    const existingCats = laboratories
      .filter(l => l.labName.trim().toUpperCase() === labName.toUpperCase())
      .map(l => l.category.trim().toUpperCase());

    setNewLabCategories(existingCats.length > 0 ? existingCats : ["MEDICAMENTOS"]);
  };

  const handleUpdateLaboratory = async () => {
    const cleanOldName = editingLabOriginalName.trim().toUpperCase();
    const cleanNewName = newLabName.trim().toUpperCase();

    if (!cleanOldName) {
      notify.error("Error", "No se ha seleccionado ningún laboratorio para editar.");
      return;
    }
    if (!cleanNewName) {
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
      const branchUpper = normalizeString(user.branchSheet);

      // 1. Rename the laboratory name across all tables if it changed
      if (cleanOldName !== cleanNewName) {
        // A. Update branch_laboratories
        const { error: errLab } = await supabase
          .from('branch_laboratories')
          .update({ laboratory: cleanNewName })
          .ilike('branch_name', branchUpper)
          .eq('laboratory', cleanOldName);
        if (errLab) throw errLab;

        // B. Update inventories
        const { error: errInv } = await supabase
          .from('inventories')
          .update({ laboratory: cleanNewName })
          .ilike('branch_name', branchUpper)
          .eq('laboratory', cleanOldName);
        if (errInv) console.error("Error updating inventories lab name:", errInv);

        // C. Update inventory_adjustments
        const { error: errAdj } = await supabase
          .from('inventory_adjustments')
          .update({ laboratory: cleanNewName })
          .ilike('branch_name', branchUpper)
          .eq('laboratory', cleanOldName);
        if (errAdj) console.error("Error updating adjustments lab name:", errAdj);
      }

      // 2. Fetch the currently assigned categories for this lab in the branch
      // to find which ones to add and which ones to delete
      const { data: dbCurrentRows, error: errFetch } = await supabase
        .from('branch_laboratories')
        .select('category')
        .ilike('branch_name', branchUpper)
        .eq('laboratory', cleanNewName);
      if (errFetch) throw errFetch;

      const currentCats = (dbCurrentRows || []).map(r => r.category.trim().toUpperCase());
      const desiredCats = newLabCategories.map(c => c.trim().toUpperCase());

      // Find categories to add
      const catsToAdd = desiredCats.filter(c => !currentCats.includes(c));
      // Find categories to delete
      const catsToDelete = currentCats.filter(c => !desiredCats.includes(c));

      // A. Insert new categories
      if (catsToAdd.length > 0) {
        const rowsToInsert = catsToAdd.map(cat => ({
          branch_name: normalizeString(user.branchSheet),
          laboratory: cleanNewName,
          category: cat,
          status: 'pending'
        }));
        const { error: errAdd } = await supabase
          .from('branch_laboratories')
          .upsert(rowsToInsert, {
            onConflict: 'branch_name,laboratory,category'
          });
        if (errAdd) throw errAdd;
      }

      // B. Delete removed categories
      if (catsToDelete.length > 0) {
        // Delete from branch_laboratories
        let queryLab = supabase.from('branch_laboratories').delete();
        queryLab = queryLab.ilike('branch_name', branchUpper);
        queryLab = queryLab.eq('laboratory', cleanNewName);
        queryLab = queryLab.in('category', catsToDelete);
        const { error: errDelLab } = await queryLab;
        if (errDelLab) throw errDelLab;

        // Delete pending inventory items under those removed categories
        let queryInv = supabase.from('inventories').delete();
        queryInv = queryInv.ilike('branch_name', branchUpper);
        queryInv = queryInv.eq('laboratory', cleanNewName);
        queryInv = queryInv.eq('status', 'pending');
        queryInv = queryInv.in('category', catsToDelete);
        const { error: errDelInv } = await queryInv;
        if (errDelInv) console.error("Error deleting pending inventories for removed categories:", errDelInv);
      }

      notify.success(
        "Laboratorio Actualizado",
        `Se actualizó el laboratorio ${cleanNewName} con los rubros: ${desiredCats.map(c => categoriesMap[c as CategoryKey] || c).join(', ')}.`
      );
      setShowAddLabDialog(false);

      // Refresh database records
      window.location.reload();
    } catch (error: any) {
      console.error("Error updating laboratory:", error);
      notify.error("Error al actualizar", error.message || "Ocurrió un error inesperado.");
    } finally {
      setIsAddingLab(false);
    }
  };



  if (isLoading) {
    return <CyclicInventorySkeleton />;
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

      {/* Resumen del Panel con doble recuadro concéntrico */}
      <div className="w-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 shadow-xs">
        <div className="w-full bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] px-5 sm:px-6 pt-3.5 pb-4 sm:pt-4 sm:pb-5 shadow-xs relative overflow-hidden flex flex-col gap-4 sm:gap-5">
          <ParticleCanvasBackground />
          
          {/* Top: Header / Rubro Title & Badges */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground" style={{ fontVariationSettings: fontWeights.normal }}>
                Rubro seleccionado
              </span>
              <div className="flex items-center gap-1.5 text-base font-bold text-foreground" style={{ fontVariationSettings: fontWeights.bold }}>
                <span>Inventario Cíclico</span>
                <span className="text-muted-foreground/50 font-normal">›</span>
                <span className="text-primary font-bold">
                  {categoriesMap[categoryFilter as CategoryKey] || categoryFilter}
                </span>
              </div>
            </div>

            {/* Badges y Selector de modo (Importes / Unidades) */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* Badges sencillos monocromáticos sin dot */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Badge variant="solid" color="gray" className="bg-muted/70 dark:bg-surface-2/70 text-foreground/80 dark:text-zinc-200 border border-border/40 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-2xs">
                  {controlledLabs} / {totalLabs} Controlados
                </Badge>
                <Badge variant="solid" color="gray" className="bg-muted/70 dark:bg-surface-2/70 text-foreground/80 dark:text-zinc-200 border border-border/40 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-2xs">
                  {inProgressLabs} En Proceso
                </Badge>
                <Badge variant="solid" color="gray" className="bg-muted/70 dark:bg-surface-2/70 text-foreground/80 dark:text-zinc-200 border border-border/40 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-2xs">
                  {pendingLabs} Pendientes
                </Badge>
              </div>

              {/* Selector de modo: Importes ($) / Unidades */}
              <Tabs
                value={metricViewMode}
                onValueChange={(v) => setMetricViewMode(v as 'currency' | 'units')}
                size="compact"
              >
                <TabsList>
                  <TabItem value="currency" label="Importes" />
                  <TabItem value="units" label="Unidades" />
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Bottom: Financial/Unit Values ocupando todo el ancho en 4 columnas */}
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 divide-y md:divide-y-0 md:divide-x divide-border/40 w-full pt-1">
            {/* Diferencia Neta */}
            <div className="flex flex-col gap-1 md:pr-4">
              <span className="text-xs text-muted-foreground font-medium" style={{ fontVariationSettings: fontWeights.normal }}>
                Diferencia Neta
              </span>
              <div className="flex items-baseline gap-2">
                <CounterAnimation 
                   value={metricViewMode === 'currency' 
                     ? Math.abs(totalDifference) 
                     : Math.abs(totalPositiveUnits + totalNegativeUnits)
                   } 
                   prefix={metricViewMode === 'currency'
                     ? (totalDifference < 0 ? "-$" : totalDifference > 0 ? "+$" : "$")
                     : ((totalPositiveUnits + totalNegativeUnits) < 0 ? "-" : (totalPositiveUnits + totalNegativeUnits) > 0 ? "+" : "")
                   }
                   suffix={metricViewMode === 'units' ? " u." : ""}
                   className={cn(
                    "font-bold tracking-tight text-xl sm:text-2xl",
                    (metricViewMode === 'currency' ? totalDifference : (totalPositiveUnits + totalNegativeUnits)) < 0 
                      ? "text-financial-negative" 
                      : (metricViewMode === 'currency' ? totalDifference : (totalPositiveUnits + totalNegativeUnits)) > 0 
                        ? "text-financial-positive" 
                        : "text-foreground"
                   )}
                />
                <span className={cn("text-xs font-bold", totalDifference !== 0 ? (totalDifference < 0 ? "text-financial-negative-muted" : "text-financial-positive-muted") : "text-muted-foreground")}>
                  {totalDifference < 0 ? "↓" : totalDifference > 0 ? "↑" : ""}{netTrend.value}%
                </span>
              </div>
            </div>

            {/* Valor Absoluto */}
            <div className="flex flex-col gap-1 pt-3 md:pt-0 md:px-4">
              <span className="text-xs text-muted-foreground font-medium" style={{ fontVariationSettings: fontWeights.normal }}>
                Valor Absoluto
              </span>
              <div className="flex items-baseline gap-2">
                <CounterAnimation 
                  value={metricViewMode === 'currency'
                    ? totalAbsoluteDifference
                    : (totalPositiveUnits + Math.abs(totalNegativeUnits))
                  } 
                  prefix={metricViewMode === 'currency' ? "$" : ""}
                  suffix={metricViewMode === 'units' ? " u." : ""}
                  className="font-bold tracking-tight text-xl sm:text-2xl text-foreground"
                />
                <span className="text-xs font-bold text-muted-foreground/60">
                  {absoluteTrend.value}%
                </span>
              </div>
            </div>

            {/* Faltante Total */}
            <div className="flex flex-col gap-1 pt-3 md:pt-0 md:px-4">
              <span className="text-xs text-muted-foreground font-medium" style={{ fontVariationSettings: fontWeights.normal }}>
                Faltante Total
              </span>
              <div className="flex items-baseline gap-2">
                <CounterAnimation 
                  value={metricViewMode === 'currency'
                    ? Math.abs(totalNegative)
                    : Math.abs(totalNegativeUnits)
                  } 
                  prefix={metricViewMode === 'currency' ? "$" : ""}
                  suffix={metricViewMode === 'units' ? " u." : ""}
                  className="font-bold tracking-tight text-xl sm:text-2xl text-financial-negative"
                />
                <span className={cn("text-xs font-bold", totalNegative !== 0 ? "text-financial-negative-muted" : "text-muted-foreground")}>
                  {totalNegative !== 0 ? "↓" : ""}{negativeTrend.value}%
                </span>
              </div>
            </div>

            {/* Sobrante Total */}
            <div className="flex flex-col gap-1 pt-3 md:pt-0 md:pl-4">
              <span className="text-xs text-muted-foreground font-medium" style={{ fontVariationSettings: fontWeights.normal }}>
                Sobrante Total
              </span>
              <div className="flex items-baseline gap-2">
                <CounterAnimation 
                  value={metricViewMode === 'currency'
                    ? totalPositive
                    : totalPositiveUnits
                  } 
                  prefix={metricViewMode === 'currency' ? "$" : ""}
                  suffix={metricViewMode === 'units' ? " u." : ""}
                  className="font-bold tracking-tight text-xl sm:text-2xl text-financial-positive"
                />
                <span className={cn("text-xs font-bold", totalPositive !== 0 ? "text-financial-positive-muted" : "text-muted-foreground")}>
                  {totalPositive !== 0 ? "↑" : ""}{positiveTrend.value}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as FilterCategory)} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between transition-all gap-4 mb-4">
          {/* Filtros de Categoría */}
          <TabsList>
            <TabItem value="MEDICAMENTOS" label="Medicamentos" />
            <TabItem value="PERFUMERIA" label="Perfumería" />
            <TabItem value="ACCESORIOS" label="Accesorios" />
            <TabItem value="VARIOS" label="Varios" />
          </TabsList>

        {/* Toolbar de Acciones */}
        <div className="flex items-center gap-2.5 flex-1 justify-end">
          {/* Botón de Solicitudes antes del buscador */}
          <Button 
            variant="tertiary" 
            size="icon" 
            onClick={() => navigate('/solicitudes')}
            className="shrink-0"
            title="Ver Solicitudes"
          >
            <FileSearch02 className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </Button>

          {/* Barra de búsqueda fija como InputGroup */}
          <InputGroup className="max-w-[240px] md:max-w-xs w-full">
            <InputField
              index={0}
              placeholder="Buscar por nombre..."
              icon={icons.search}
              value={searchTerm}
              onChange={setSearchTerm}
              alwaysShowBorder={true}
              size="default"
            />
          </InputGroup>

          <div className="flex items-center gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownTrigger render={
                <Button 
                  variant="tertiary" 
                  size="icon"
                >
                  <Filter className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </Button>
              } />
              <DropdownContent align="end" className="w-52">
                <DropdownLabel>Ordenar por</DropdownLabel>
                <MenuItem
                  index={0}
                  icon={Search}
                  label="Nombre (A-Z)"
                  onSelect={() => setSortBy("name-asc")}
                  checked={sortBy === "name-asc"}
                />
                <MenuItem
                  index={1}
                  icon={Search}
                  label="Nombre (Z-A)"
                  onSelect={() => setSortBy("name-desc")}
                  checked={sortBy === "name-desc"}
                />
                <MenuItem
                  index={2}
                  icon={TrendingUp}
                  label="Mayor Diferencia"
                  onSelect={() => setSortBy("value-desc")}
                  checked={sortBy === "value-desc"}
                />
                <MenuItem
                  index={3}
                  icon={TrendingDown}
                  label="Menor Diferencia"
                  onSelect={() => setSortBy("value-asc")}
                  checked={sortBy === "value-asc"}
                />
                <DropdownSeparator />
                <DropdownLabel>Filtrar por Estado</DropdownLabel>
                <MenuItem
                  index={4}
                  icon={ListIcon}
                  label="Todas"
                  onSelect={() => setStatusFilter("all")}
                  checked={statusFilter === "all"}
                />
                <MenuItem
                  index={5}
                  icon={CheckCircle}
                  label="Controlados"
                  onSelect={() => setStatusFilter("controlado")}
                  checked={statusFilter === "controlado"}
                />
                <MenuItem
                  index={6}
                  icon={Clock}
                  label="En Proceso"
                  onSelect={() => setStatusFilter("por_controlar")}
                  checked={statusFilter === "por_controlar"}
                />
                <MenuItem
                  index={7}
                  icon={AlertCircle}
                  label="Pendientes"
                  onSelect={() => setStatusFilter("pendiente")}
                  checked={statusFilter === "pendiente"}
                />
              </DropdownContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownTrigger render={
                <Button 
                  variant="tertiary" 
                  size="icon" 
                  disabled={isProcessingMassAction}
                >
                  <MoreVertical className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </Button>
              } />
              <DropdownContent align="end" className="w-64">
                <DropdownLabel>Reportes (Sucursal)</DropdownLabel>
                <MenuItem
                  index={0}
                  icon={DocumentIcon}
                  label="Descargar Reporte PDF"
                  onSelect={() => ReportExporter.exportSummaryToPDF(filteredAndSortedLabs, user?.branchSheet || "Sucursal")}
                />
                <MenuItem
                  index={1}
                  icon={Download}
                  label="Descargar Planilla Excel"
                  onSelect={() => ReportExporter.exportSummaryToExcel(filteredAndSortedLabs, user?.branchSheet || "Sucursal")}
                />
                <DropdownSeparator />
                <DropdownLabel>Vista</DropdownLabel>
                <MenuItem
                  index={2}
                  icon={GridIcon}
                  label="Cuadrícula"
                  onSelect={() => setViewMode("grid")}
                  checked={viewMode === "grid"}
                />
                <MenuItem
                  index={3}
                  icon={ListIcon}
                  label="Lista"
                  onSelect={() => setViewMode("list")}
                  checked={viewMode === "list"}
                />
                {user?.role === 'admin' && (
                  <>
                    <DropdownSeparator />
                    <DropdownLabel>Administración</DropdownLabel>
                    <MenuItem
                      index={4}
                      icon={Plus}
                      label="Agregar laboratorio"
                      onSelect={handleOpenAddDialog}
                    />
                    <MenuItem
                      index={5}
                      icon={Edit}
                      label="Editar laboratorio"
                      onSelect={handleOpenEditDialog}
                    />
                    <MenuItem
                      index={6}
                      icon={RotateCcw}
                      label="Sincronizar todo (Forzar)"
                      onSelect={handleMassSync}
                      className="text-primary focus:text-primary"
                    />
                    <MenuItem
                      index={7}
                      icon={Trash}
                      label="Reiniciar sucursal"
                      onSelect={prepareMassReset}
                      className="text-destructive focus:text-destructive"
                    />
                  </>
                )}
              </DropdownContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      {CATEGORIES.map((cat) => (
        <TabPanel key={cat} value={cat} className="focus-visible:outline-none">
          {categoryFilter === cat && (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {renderedLabs.map((lab) => (
                    <LaboratoryCard
                      key={lab.labName}
                      name={lab.labName}
                      negativeValue={lab.negativeValue}
                      positiveValue={lab.positiveValue}
                      differenceValue={lab.differenceValue}
                      status={lab.status}
                      progress={lab.progress}
                      isDischarged={lab.isDischarged}
                      hasPendingRemoval={lab.hasPendingRemoval}
                      pendingRemovalReason={lab.pendingRemovalReason}
                      onClick={() => {
                        if (lab.isDischarged) {
                          notify.warning("Laboratorio Desactivado", "Este laboratorio fue dado de baja mediante solicitud aprobada.");
                          return;
                        }
                        navigate(`/inventario-ciclico/${encodeURIComponent(lab.labName)}`);
                      }}
                      onMouseEnter={() => {
                        if (!lab.isDischarged) prefetchLab(user?.branchSheet || "", lab.labName);
                      }}
                      onRequestRemoval={(name) => {
                        setRemovalLabData({
                          labName: name,
                          category: categoryFilter,
                          round: 1
                        });
                        setRemovalModalOpen(true);
                      }}
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
                          <TableHead className="text-center">Ajustes</TableHead>
                          <TableHead className="text-center w-[140px] pr-6">Avance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="bg-background rounded-l-xl rounded-r-xl overflow-hidden shadow-xs/5">
                        {renderedLabs.map((lab) => (
                          <TableRow
                            key={lab.labName}
                            className={cn(
                              "border-t border-border/40 first:border-none",
                              lab.isDischarged ? "opacity-50 cursor-not-allowed select-none bg-muted/10" : "cursor-pointer"
                            )}
                            onClick={() => {
                              if (lab.isDischarged) {
                                notify.warning("Laboratorio Desactivado", "Este laboratorio fue dado de baja mediante solicitud aprobada.");
                                return;
                              }
                              navigate(`/inventario-ciclico/${encodeURIComponent(lab.labName)}`);
                            }}
                          >
                            <TableCell className="pl-6 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                              <span className={cn("font-semibold", lab.isDischarged ? "text-muted-foreground line-through" : "text-foreground/90")}>
                                {lab.labName}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center items-center gap-1.5">
                                {lab.isDischarged ? (
                                  <Badge variant="outline" color="rose" size="sm" className="text-[10px] uppercase font-semibold border-rose-500/30 text-rose-500 bg-rose-500/10">
                                    Baja
                                  </Badge>
                                ) : (
                                  <>
                                    {lab.hasPendingRemoval && (
                                      <Tooltip
                                        content={
                                          <div className="flex flex-col gap-0.5 text-left max-w-[200px] py-0.5">
                                            <span className="font-semibold text-background">Baja en trámite</span>
                                            <span className="text-[10.5px] opacity-85">
                                              {lab.pendingRemovalReason || "Solicitud pendiente de aprobación"}
                                            </span>
                                          </div>
                                        }
                                        side="top"
                                        sideOffset={4}
                                      >
                                        <span className="w-2 h-2 rounded-full bg-[var(--celeste-baja)] animate-pulse shrink-0 cursor-help" />
                                      </Tooltip>
                                    )}
                                    <div className={cn(
                                      "size-1.5 rounded-full shadow-sm",
                                      lab.status === 'controlado' ? "bg-emerald-500" :
                                        lab.status === 'por_controlar' ? "bg-blue-500" :
                                          "bg-amber-500"
                                    )} />
                                  </>
                                )}
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
                            <TableCell className="text-center">
                              <span className="font-medium text-foreground tabular-nums">
                                {lab.status !== 'pendiente' ? (lab.adjustmentCount ?? 0) : "–"}
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

              {/* Target for infinite scroll chunk loading */}
              {visibleCount < filteredAndSortedLabs.length && (
                <div ref={observerTargetRef} className="h-10 flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </TabPanel>
      ))}
    </Tabs>

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
            <Button variant="tertiary" onClick={() => setShowMassResetDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700 text-white"
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
              {isEditMode ? (
                <>
                  <Edit className="w-5 h-5 text-primary" />
                  <span>Editar laboratorio</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-primary" />
                  <span>Agregar laboratorio manualmente</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? (
                <span>Modifica el nombre y rubros asociados al laboratorio seleccionado.</span>
              ) : (
                <span>Esto asociará un nuevo laboratorio y rubros a la sucursal <strong>{user?.branchSheet}</strong> de forma directa.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              if (isEditMode) {
                handleUpdateLaboratory();
              } else {
                handleAddLaboratory();
              }
            }}
            className="contents"
          >
            <DialogPanel className="grid gap-5">
              {isEditMode && (
                <Field>
                  <FieldLabel className="text-sm font-semibold text-foreground/90">Seleccionar Laboratorio a Editar</FieldLabel>
                  <Combobox
                    items={uniqueLabNames}
                    value={selectedEditLab}
                    onValueChange={(val: string) => {
                      setSelectedEditLab(val || "");
                      if (val) {
                        handleSelectLabToEdit(val);
                      } else {
                        setSelectedEditLab("");
                        setNewLabName("");
                        setNewLabCategories(["MEDICAMENTOS"]);
                      }
                    }}
                  >
                    <ComboboxTrigger render={<SelectButton className="w-full h-11 px-4 rounded-xl bg-popover text-foreground border border-input focus:border-primary/50 transition-colors" />}>
                      <ComboboxValue>
                        {selectedEditLab || "Selecciona un laboratorio..."}
                      </ComboboxValue>
                    </ComboboxTrigger>
                    <ComboboxPopup aria-label="Selecciona un laboratorio" className="w-full md:max-w-md overflow-hidden">
                      <div className="border-b p-2">
                        <ComboboxInput
                          className="rounded-md before:rounded-[calc(var(--radius-md)-1px)]"
                          placeholder="Buscar laboratorio..."
                          icon={SearchIcon as any}
                        />
                      </div>
                      <ComboboxEmpty>No se encontraron laboratorios.</ComboboxEmpty>
                      <ComboboxList>
                        {(item: string) => (
                          <ComboboxItem key={item} value={item}>
                            {item}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxPopup>
                  </Combobox>
                </Field>
              )}

              <Field>
                <FieldLabel className="text-sm font-semibold text-foreground/90">
                  {isEditMode ? "Nuevo Nombre del Laboratorio" : "Nombre del Laboratorio"}
                </FieldLabel>
                <Input
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value.toUpperCase())}
                  placeholder="Ej. ELEA, CASASCO, ROEMMERS..."
                  disabled={isEditMode && !selectedEditLab}
                  className="font-bold uppercase h-11 px-4 rounded-xl border border-input focus:border-primary/50 transition-colors w-full disabled:opacity-50"
                />
              </Field>
              <Field>
                <FieldLabel className="text-sm font-semibold text-foreground/90">Rubros / Categorías</FieldLabel>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {CATEGORIES.map((cat) => {
                    const isSelected = newLabCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setNewLabCategories((prev) =>
                            prev.includes(cat)
                              ? prev.length > 1
                                ? prev.filter((c) => c !== cat)
                                : prev
                              : [...prev, cat]
                          );
                        }}
                        disabled={isEditMode && !selectedEditLab}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-surface-2/60 text-muted-foreground border-border/60 hover:border-border hover:text-foreground",
                          isEditMode && !selectedEditLab && "opacity-50 pointer-events-none"
                        )}
                      >
                        <span>{categoriesMap[cat as CategoryKey] || cat}</span>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          isSelected ? "bg-primary-foreground" : "bg-muted-foreground/30"
                        )} />
                      </button>
                    );
                  })}
                </div>
              </Field>
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="tertiary" className="h-10 rounded-xl" />} onClick={() => setShowAddLabDialog(false)}>
                Cancelar
              </DialogClose>
              <Button
                type="submit"
                disabled={isAddingLab || !newLabName.trim() || newLabCategories.length === 0 || (isEditMode && !selectedEditLab)}
                className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold h-10 rounded-xl px-5"
              >
                {isAddingLab ? (isEditMode ? "Guardando..." : "Agregando...") : (isEditMode ? "Guardar Cambios" : "Agregar Laboratorio")}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de Solicitud de Baja de Laboratorio */}
      {removalLabData && (
        <LabRemovalModal
          open={removalModalOpen}
          onOpenChange={setRemovalModalOpen}
          labName={removalLabData.labName}
          category={removalLabData.category}
          branchName={user?.branchSheet}
          onSuccess={() => {
            loadLabs();
          }}
        />
      )}
    </div>
  );
}


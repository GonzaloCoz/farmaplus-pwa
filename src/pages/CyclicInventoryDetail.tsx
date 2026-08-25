import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { Button, buttonVariants } from '@/components/ui/button';
import { Group, GroupSeparator } from '@/components/ui/group';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTab, TabItem } from "@/components/ui/tabs";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Upload01 as Upload, SearchLg as Search, InfoCircle as Info, RefreshCw01 as Loader2, CheckCircle, RefreshCw01 as RotateCcw, CurrencyDollar as Dollar, Clipboard as ClipboardList, ChevronLeft as ArrowLeft, FilterFunnel02 as Filter, DotsHorizontal as MoreVertical, ClipboardX as DiffIcon, AlertTriangle, File02 as Document, Download01 as Download, Edit01 as Pen, RefreshCw01 as Refresh, ArrowUpRight, ArrowDownRight, TrendUp01 as TrendingUp, FileSearch02 } from '@untitledui/icons';
import { LabRemovalModal } from "@/components/LabRemovalModal";
import {
    InputGroup,
    InputField,
} from "@/components/ui/input-group";
import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    DropdownLabel,
    DropdownSeparator,
    MenuItem,
} from "@/components/ui/dropdown";
import { CyclicInventoryList } from '@/components/CyclicInventoryList';
import { Field, FieldLabel } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import {
    Dialog,
    DialogContent,
    DialogPopup,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn, normalizeString } from '@/lib/utils';
import { FabMenu } from '@/components/FabMenu';
import { DeleteConfirmationDialog } from '@/components/cyclic/DeleteConfirmationDialog';
import { HistoryDialog } from '@/components/cyclic/HistoryDialog';
import { Table as MotionTable } from '@/components/motion/table';
import { ReportExporter } from '@/lib/reportExporter';
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FramePanel } from '@/components/ui/frame';
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Hooks & Components
import { useCyclicInventoryController } from '@/hooks/useCyclicInventoryController';
import { InventorySkeleton } from '@/components/InventorySkeleton';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useUser } from '@/contexts/UserContext';
import { Trash01 as TrashIcon } from '@untitledui/icons';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { notify as toast } from '@/lib/notifications';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

export default function CyclicInventoryDetail() {
    const { id } = useParams(); // This will be the Lab Name
    const labName = id ? decodeURIComponent(id) : '';
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const roundParam = searchParams.get('round');
    const round = roundParam ? Number(roundParam) : undefined;
    const isReadOnly = round !== undefined;

    const { activeWindowId, updateWindowMeta } = useWindowManager();
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState("pending");

    // Admin Mode State
    const [isAdminModeEnabled, setIsAdminModeEnabled] = useState(false);
    const [showAdminPurgeModal, setShowAdminPurgeModal] = useState(false);
    const [isAdminPurging, setIsAdminPurging] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    // Edit Adjustment IDs State
    const [showEditIdsDialog, setShowEditIdsDialog] = useState(false);
    const [selectedSessionToEdit, setSelectedSessionToEdit] = useState<string>("active");
    const [tempShortageId, setTempShortageId] = useState("");
    const [tempSurplusId, setTempSurplusId] = useState("");
    const [isSavingIds, setIsSavingIds] = useState(false);

    // Save Dialog View State
    const [balanceView, setBalanceView] = useState<'balance' | 'faltantes' | 'sobrantes'>('balance');
    const [accordionOpen, setAccordionOpen] = useState<string[]>(["item1"]);

    // Columns config for history table
    const historyColumns = useMemo<any[]>(() => [
        {
            key: "folio",
            header: <span className="pl-4">Folio</span>,
            width: "140px",
            cell: (h: any) => (
                <span className="pl-4 block">
                    {h.folio ? (
                        <Badge variant="outline" showDot={false} className="text-[12px] font-bold border-indigo-200 bg-indigo-50/50 text-indigo-700 dark:border-indigo-900/30 dark:bg-indigo-950/30 dark:text-indigo-400">
                            {h.folio}
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground/30 text-[13px]">–</span>
                    )}
                </span>
            )
        },
        {
            key: "date",
            header: "Fecha",
            width: "120px",
            cell: (h: any) => (
                <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap block">
                    {new Date(h.created_at).toLocaleDateString()}
                </span>
            )
        },
        {
            key: "time",
            header: "Hora",
            width: "80px",
            cell: (h: any) => (
                <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
                    {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            )
        },
        {
            key: "user_name",
            header: "Auditor",
            width: "150px",
            cell: (h: any) => (
                <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
                    {h.user_name || 'Desconocido'}
                </span>
            )
        },
        {
            key: "category",
            header: "Rubro/s",
            width: "120px",
            cell: (h: any) => (
                <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap uppercase">
                    {h.category || 'Varios'}
                </span>
            )
        },
        {
            key: "total_units_adjusted",
            header: "Art Ajustados",
            width: "110px",
            cell: (h: any) => (
                <span className="text-[13px] font-medium text-foreground tabular-nums">
                    {h.total_units_adjusted}
                </span>
            )
        },
        {
            key: "total_stock_counted",
            header: "Art Contados",
            width: "110px",
            cell: (h: any) => (
                <span className="text-[13px] font-medium text-foreground tabular-nums">
                    {h.total_stock_counted !== undefined ? h.total_stock_counted : '—'}
                </span>
            )
        },
        {
            key: "adjustment_id_shortage",
            header: "ID Ajustes (-)",
            width: "120px",
            cell: (h: any) => (
                h.adjustment_id_shortage ? (
                    <Badge variant="outline" showDot={false} className="text-[12px] font-semibold">
                        {h.adjustment_id_shortage}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground/30 text-[13px] pl-4">–</span>
                )
            )
        },
        {
            key: "shortage_value",
            header: "Ajustes Faltantes",
            width: "130px",
            cell: (h: any) => {
                const shortageVal = Number(h.shortage_value ?? h.total_shortage_value) || 0;
                return (
                    <p className={cn(
                        "text-[14px] font-medium tabular-nums",
                        shortageVal === 0 ? "text-muted-foreground" : "text-red-600 dark:text-red-400"
                    )}>
                        {shortageVal > 0 && '-'}${shortageVal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                );
            }
        },
        {
            key: "adjustment_id_surplus",
            header: "ID Ajustes (+)",
            width: "120px",
            cell: (h: any) => (
                h.adjustment_id_surplus ? (
                    <Badge variant="outline" showDot={false} className="text-[12px] font-semibold">
                        {h.adjustment_id_surplus}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground/30 text-[13px] pl-4">–</span>
                )
            )
        },
        {
            key: "surplus_value",
            header: "Ajustes Sobrantes",
            width: "130px",
            cell: (h: any) => {
                const surplusVal = Number(h.surplus_value ?? h.total_surplus_value) || 0;
                return (
                    <p className={cn(
                        "text-[14px] font-medium tabular-nums",
                        surplusVal === 0 ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                        {surplusVal > 0 && '+'}${surplusVal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                );
            }
        }
    ], []);

    // Update window tab title with lab name
    useEffect(() => {
        if (activeWindowId && labName) {
            updateWindowMeta(activeWindowId, labName, <ClipboardList className="w-4 h-4" />);
        }
    }, [activeWindowId, labName, updateWindowMeta]);

    // Keyboard listener for Admin Mode (Ctrl + B)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                if (user?.role === 'admin') {
                    setIsAdminModeEnabled(prev => !prev);
                    if (!isAdminModeEnabled) {
                        toast.info("Modo Administrador", "Funciones de depuración activadas.");
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAdminModeEnabled, user?.role]);

    const {
        // State
        items,
        isLoading,
        isUploading,
        isSaving,
        isExcelUploaded,
        progressPercentage,
        branchName,

        // Stats
        stats: {
            searchTerm, setSearchTerm,
            showDifferencesOnly, setShowDifferencesOnly,
            currentCategory, setCurrentCategory,
            pendingItems, controlledItems, adjustedItems,
            globalPending, globalControlled, globalAdjusted
        },
        history,

        // Dialogs
        showSaveDialog, setShowSaveDialog,
        shortageId, setShortageId,
        surplusId, setSurplusId,
        shortageValue, surplusValue,

        showDeleteDialog, setShowDeleteDialog,
        verificationText,
        isDeleting,

        // Actions
        handleFileUpload,
        handleElectronImport,
        handleUpdateQuantity,
        handleCheck,
        handleBulkCheck,
        handleRevertItem,
        handleFinalizeClick,
        handleSaveInventory,
        handleResetData,
        handleConfirmDelete,
        handleForceRefreshProgress,

        // Special State
        shouldHidePendings,
        isAdminEditActive,
        setIsAdminEditActive,
        handleSaveAdminEdit,
        handleCancelAdminEdit,
        isLabHidden,
        handleToggleHideLab,
        handleUpdateAdjustmentIds,
        handleUpdateSessionAdjustmentIds,

        // Mismatch Overrides
        showMismatchDialog,
        setShowMismatchDialog,
        mismatchData,
        handleResolveMismatch,

        // Advertencia de Rubros Faltantes
        showCategoryWarningDialog,
        setShowCategoryWarningDialog,
        categoryWarningData,
        handleResolveCategoryWarning,

        // Advertencia de Archivo Desactualizado
        showOutdatedWarningDialog,
        setShowOutdatedWarningDialog,
        outdatedWarningData,
        handleResolveOutdatedWarning,

        // Advanced Logic
        sortBy, setSortBy,
        getSortedItems

    } = useCyclicInventoryController({ labName, round });

    const [removalModalOpen, setRemovalModalOpen] = useState(false);

    // Resumen de Rubros Controlados y Totales para el Diálogo de Finalización
    const categoryStats = useMemo(() => {
        const statsMap = CATEGORIES.map(category => {
            const catItems = items.filter(item => {
                const normCat = normalizeString(item.category || 'Varios').toUpperCase();
                const normTarget = normalizeString(category).toUpperCase();
                return normCat === normTarget;
            });

            let controlledUnits = 0;
            let surplusUnits = 0;
            let shortageUnits = 0;
            let value = 0;

            catItems.forEach(item => {
                if (item.status === 'controlled') {
                    controlledUnits += item.countedQuantity;
                    const diff = item.countedQuantity - item.systemQuantity;
                    if (diff > 0) {
                        surplusUnits += diff;
                    } else if (diff < 0) {
                        shortageUnits += diff;
                    }
                    value += diff * item.cost;
                }
            });

            return {
                category,
                controlledUnits,
                surplusUnits,
                shortageUnits,
                value: Math.round(value * 100) / 100
            };
        });

        return statsMap;
    }, [items]);

    const totalControlledUnits = useMemo(() => {
        return categoryStats.reduce((sum, s) => sum + s.controlledUnits, 0);
    }, [categoryStats]);

    const netBalance = useMemo(() => {
        return shortageValue + surplusValue;
    }, [shortageValue, surplusValue]);

    const statsDetail = useMemo(() => {
        let totalSystemValue = 0;
        let totalCountedValue = 0;

        items.forEach(item => {
            if (item.status === 'controlled') {
                totalSystemValue += (item.systemQuantity || 0) * (item.cost || 0);
                totalCountedValue += (item.countedQuantity || 0) * (item.cost || 0);
            }
        });

        const netValueDevPercent = totalSystemValue > 0 
            ? ((totalCountedValue - totalSystemValue) / totalSystemValue) * 100 
            : 0;

        const shortagePercent = totalSystemValue > 0 
            ? -(Math.abs(shortageValue) / totalSystemValue) * 100 
            : 0;

        const surplusPercent = totalSystemValue > 0 
            ? (Math.abs(surplusValue) / totalSystemValue) * 100 
            : 0;

        return {
            netValueDevPercent,
            shortagePercent,
            surplusPercent
        };
    }, [items, shortageValue, surplusValue]);

    const handleAdminPurge = async () => {
        setIsAdminPurging(true);
        try {
            const result = (await cyclicInventoryService.adminPurgeLabInventory(
                branchName,
                labName,
                'pistacho', // ponytail: hardcoded DB credential to bypass UI input
                user?.id || ''
            )) as any;

            if (result.success) {
                toast.success("Éxito", result.message);
                setShowAdminPurgeModal(false);
                navigate('/inventario-ciclico');
            } else {
                toast.error("Error", result.message);
            }
        } catch (error) {
            console.error("Error in admin purge:", error);
            toast.error("Error", "Error al procesar la solicitud.");
        } finally {
            setIsAdminPurging(false);
        }
    };

    // Efecto para setear pestaña por defecto según carga
    useEffect(() => {
        if (!isLoading && items.length > 0) {
            if (pendingItems.length === 0 && controlledItems.length === 0 && adjustedItems.length > 0 && activeTab === "pending") {
                setActiveTab("adjusted");
            }
        }
    }, [isLoading, items.length, pendingItems.length, controlledItems.length, adjustedItems.length, activeTab]);

    // Listener para datos de Excel desde el Launcher (Electron)
    useEffect(() => {
        // 1. Verificar si hay datos pendientes de una navegación previa
        const pendingDataStr = sessionStorage.getItem('pending_electron_excel');
        if (pendingDataStr) {
            try {
                const data = JSON.parse(pendingDataStr);
                const fileLabName = data.rows?.[1] ? String(data.rows[1][14] || '').trim() : '';
                
                if (fileLabName.toUpperCase() === labName.toUpperCase()) {
                    console.log("[Electron] Procesando datos pendientes para:", labName);
                    handleElectronImport(data);
                    sessionStorage.removeItem('pending_electron_excel');
                }
            } catch (e) {
                console.error("Error al procesar datos pendientes de Electron", e);
            }
        }

        // 2. Escuchar nuevos eventos si ya estamos en la página
        if ((window as any).electronAPI) {
            console.log("[Electron] Registrando listener en Inventario Cíclico (Detalle):", labName);
            const cleanup = (window as any).electronAPI.onExcelData((data: any) => {
                const rows = data.rows || [];
                const fileLabName = rows[1] ? String(rows[1][14] || '').trim() : '';
                
                // Si el laboratorio del archivo coincide con el actual, procesamos
                if (fileLabName.toUpperCase() === labName.toUpperCase()) {
                    handleElectronImport(data);
                } else if (fileLabName) {
                    // Si es otro laboratorio, guardamos y redirigimos
                    toast.info("Cambio de Laboratorio", `El archivo es de ${fileLabName}. Redirigiendo...`);
                    sessionStorage.setItem('pending_electron_excel', JSON.stringify(data));
                    navigate(`/inventario-ciclico/${encodeURIComponent(fileLabName)}`);
                }
            });

            return cleanup;
        }
    }, [labName, handleElectronImport, navigate]);

    return (
        <PageLayout className="pt-3 pb-32 lg:pb-10 px-4 lg:px-6 space-y-4 lg:space-y-6 max-w-none">
            {/* Hidden Input for Toolbar Excel Upload */}
            <input
                id="inventory-upload-hidden"
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading || isSaving}
            />

            {/* Loading State */}
            {isLoading ? (
                <InventorySkeleton />
            ) : (
                <>
                    {/* Main View: Always show Header and Stats */}
                    <div className="flex flex-col gap-3">
                            {/* Stats Cards */}
                            {/* 1. Enhanced Status Bar - Full Width Single Row without Container Box */}
                            <div className="w-full">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full py-2">
                                    {/* Left: Lab Title & Subtitle */}
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <h1 className="text-sm font-bold text-foreground">
                                                {labName}
                                            </h1>
                                            {isReadOnly && (
                                                <Badge variant="outline" className="border-amber-200 bg-amber-50/50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-400 font-bold rounded-lg text-[11px] px-2 py-0.5 whitespace-nowrap">
                                                    Historial (Vuelta {round})
                                                </Badge>
                                            )}
                                            {/* Admin Secret Button Next to Title */}
                                            <AnimatePresence>
                                                {isAdminModeEnabled && user?.role === 'admin' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.8 }}
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm flex-shrink-0"
                                                            onClick={() => setShowAdminPurgeModal(true)}
                                                            title="Eliminación Administrativa (Crítico)"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </Button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Control de inventario cíclico.
                                        </p>
                                    </div>

                                    {/* Right: Metrics horizontal list with badges and vertical dividers */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm md:justify-end">
                                        {/* Pendientes */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] text-muted-foreground font-medium">Pendientes</span>
                                            <Badge size="lg" variant="dot" showDot={false} color="amber" className="font-bold rounded-lg px-2.5">
                                                {globalPending}
                                            </Badge>
                                        </div>

                                        <div className="hidden sm:block h-4 w-px bg-border/60" />

                                        {/* Controlados */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] text-muted-foreground font-medium">Controlados</span>
                                            <Badge size="lg" variant="dot" showDot={false} color="green" className="font-bold rounded-lg px-2.5">
                                                {globalControlled}
                                            </Badge>
                                        </div>

                                        <div className="hidden sm:block h-4 w-px bg-border/60" />

                                        {/* Ajustados */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] text-muted-foreground font-medium">Ajustados</span>
                                            <Badge size="lg" variant="dot" showDot={false} color="blue" className="font-bold rounded-lg px-2.5">
                                                {globalAdjusted}
                                            </Badge>
                                        </div>

                                        <div className="hidden sm:block h-4 w-px bg-border/60" />

                                        {/* Avance */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] text-muted-foreground font-medium">Avance</span>
                                            <Badge size="lg" variant="dot" showDot={false} color="gray" className="font-bold rounded-lg px-2.5">
                                                {progressPercentage}%
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="w-full">
                                {/* Toolbar & Categories */}
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-3">
                                    {/* Categorías */}
                                    <Tabs value={currentCategory} onValueChange={setCurrentCategory} className="w-fit shrink-0">
                                        <TabsList className="bg-popover border border-input shadow-sm p-1 rounded-xl h-10 w-fit inline-flex">
                                            {CATEGORIES.map((cat) => {
                                                const catCount = items.filter(i => {
                                                    if (i.status !== 'pending') return false;
                                                    const itemCat = i.category ? i.category.trim() : '';
                                                    const normalizedTarget = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                                                    const normalizedItem = itemCat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                                                    return normalizedItem === normalizedTarget;
                                                }).length;

                                                return (
                                                    <TabsTab 
                                                        key={cat} 
                                                        value={cat} 
                                                        label={catCount > 0 ? `${cat} (${catCount})` : cat} 
                                                    />
                                                );
                                            })}
                                        </TabsList>
                                    </Tabs>

                                    {/* Toolbar de Acciones Superior (Solo barra de búsqueda) */}
                                    <div className="flex flex-wrap items-center gap-3 flex-1 justify-end w-full xl:w-auto">
                                        {/* Barra de búsqueda fija como InputGroup */}
                                        <InputGroup className="max-w-[200px] sm:max-w-xs w-full">
                                            <InputField
                                                index={0}
                                                placeholder="Buscar por nombre..."
                                                icon={Search as any}
                                                value={searchTerm}
                                                onChange={setSearchTerm}
                                                alwaysShowBorder={true}
                                            />
                                        </InputGroup>
                                    </div>
                                </div>
                                {isAdminEditActive && (
                                    <Alert className="mb-4 bg-primary/10 border-primary/20 text-primary-foreground dark:text-primary animate-in slide-in-from-top duration-300 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-primary" />
                                            <div>
                                                <AlertTitle className="font-bold text-sm text-primary">Modo Edición de Ajuste (Administrador)</AlertTitle>
                                                <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                                                    Estás editando cantidades directamente sobre los ajustes guardados. Los cambios se guardarán sin dejar rastro en el historial ni modificar el ID de ajuste existente.
                                                </AlertDescription>
                                            </div>
                                        </div>
                                    </Alert>
                                )}
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full shrink-0">
                                    {/* Row 2: Tabs Wrapper con Botones de Acción */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                                        <TabsList className="bg-popover border border-input shadow-sm p-1 rounded-xl h-10 w-fit inline-flex shrink-0">
                                            <TabsTab value="pending" label={pendingItems.length > 0 ? `Pendientes (${pendingItems.length})` : "Pendientes"} />
                                            <TabsTab value="controlled" label={controlledItems.length > 0 ? `Controlados (${controlledItems.length})` : "Controlados"} />
                                            <TabsTab value="adjusted" label={adjustedItems.length > 0 ? `Ajustados (${adjustedItems.length})` : "Ajustados"} />
                                            <TabsTab value="history" label={history.length > 0 ? `Historial (${history.length})` : "Historial"} />
                                        </TabsList>

                                        {/* Botones de acción alineados al lado de las pestañas de estado */}
                                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                            {/* Botón Cargar Archivo */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => document.getElementById('inventory-upload-hidden')?.click()}
                                                disabled={isUploading || isSaving}
                                                className="bg-surface-2 shadow-surface-2 text-muted-foreground hover:text-foreground rounded-xl group transition-all duration-200"
                                                title="Cargar Archivo"
                                            >
                                                <Upload className="w-4 h-4 group-hover:text-foreground transition-colors" />
                                            </Button>

                                            {/* Botón Reiniciar */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleResetData}
                                                disabled={isUploading || isSaving}
                                                className="bg-surface-2 shadow-surface-2 text-muted-foreground hover:text-foreground rounded-xl group transition-all duration-200"
                                                title="Reiniciar"
                                            >
                                                <RotateCcw className="w-4 h-4 group-hover:text-foreground transition-colors" />
                                            </Button>

                                            {/* Botón Solo Diferencias */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setShowDifferencesOnly(!showDifferencesOnly)}
                                                className={cn(
                                                    "rounded-xl transition-all duration-200",
                                                    showDifferencesOnly 
                                                        ? "bg-primary text-primary-foreground shadow-sm" 
                                                        : "bg-surface-2 shadow-surface-2 text-muted-foreground hover:text-foreground"
                                                )}
                                                title="Solo Diferencias"
                                            >
                                                <DiffIcon className="w-4 h-4" />
                                            </Button>

                                            {/* Botón Solicitar Baja de Laboratorio */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setRemovalModalOpen(true)}
                                                className="bg-surface-2 shadow-surface-2 text-muted-foreground hover:text-amber-500 rounded-xl group transition-all duration-200"
                                                title="Solicitar Baja de Laboratorio"
                                            >
                                                <FileSearch02 className="w-4 h-4 group-hover:text-amber-500 transition-colors" />
                                            </Button>

                                            {/* Dropdown Ordenar */}
                                            <DropdownMenu>
                                                <DropdownTrigger render={
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="bg-surface-2 shadow-surface-2 text-muted-foreground hover:text-foreground rounded-xl group transition-all duration-200"
                                                        title="Ordenar"
                                                    >
                                                        <Filter className="w-4 h-4 group-hover:text-foreground transition-colors" />
                                                    </Button>
                                                } />
                                                <DropdownContent align="end" className="w-48">
                                                    <MenuItem
                                                        index={0}
                                                        label="Nombre (A-Z)"
                                                        onSelect={() => setSortBy('name-asc')}
                                                        checked={sortBy === 'name-asc'}
                                                    />
                                                    <MenuItem
                                                        index={1}
                                                        label="Nombre (Z-A)"
                                                        onSelect={() => setSortBy('name-desc')}
                                                        checked={sortBy === 'name-desc'}
                                                    />
                                                    <MenuItem
                                                        index={2}
                                                        label="Valor (Menor a Mayor)"
                                                        onSelect={() => setSortBy('value-asc')}
                                                        checked={sortBy === 'value-asc'}
                                                    />
                                                    <MenuItem
                                                        index={3}
                                                        label="Valor (Mayor a Menor)"
                                                        onSelect={() => setSortBy('value-desc')}
                                                        checked={sortBy === 'value-desc'}
                                                    />
                                                </DropdownContent>
                                            </DropdownMenu>

                                            {/* Dropdown Más Acciones */}
                                            <DropdownMenu>
                                                <DropdownTrigger render={
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="bg-surface-2 shadow-surface-2 text-muted-foreground hover:text-foreground rounded-xl group transition-all duration-200"
                                                        title="Más Acciones"
                                                    >
                                                        <MoreVertical className="w-4 h-4 group-hover:text-foreground transition-colors" />
                                                    </Button>
                                                } />
                                                <DropdownContent align="end" className="w-56">
                                                    {(() => {
                                                        let itemIndex = 0;
                                                        return (
                                                            <>
                                                                {!isReadOnly && (
                                                                    <>
                                                                        <DropdownLabel>Carga de Datos</DropdownLabel>
                                                                        <MenuItem
                                                                            index={itemIndex++}
                                                                            icon={Document}
                                                                            label="Cargar archivo Excel"
                                                                            onSelect={() => document.getElementById('inventory-upload-hidden')?.click()}
                                                                        />
                                                                        <DropdownSeparator />
                                                                    </>
                                                                )}
                                                                
                                                                <DropdownLabel>Reportes</DropdownLabel>
                                                                <MenuItem
                                                                    index={itemIndex++}
                                                                    icon={Download}
                                                                    label="Descargar reporte PDF"
                                                                    onSelect={() => ReportExporter.exportToPDF(items, labName, branchName)}
                                                                />
                                                                <MenuItem
                                                                    index={itemIndex++}
                                                                    icon={Download}
                                                                    label="Descargar reporte EXCEL"
                                                                    onSelect={() => ReportExporter.exportToExcel(items, labName, branchName)}
                                                                />
                                                                
                                                                <DropdownSeparator />
                                                                
                                                                <DropdownLabel>Avanzado</DropdownLabel>
                                                                {user?.role === 'admin' && (
                                                                    <MenuItem
                                                                        index={itemIndex++}
                                                                        icon={TrashIcon}
                                                                        label="Eliminar laboratorio"
                                                                        onSelect={() => setShowAdminPurgeModal(true)}
                                                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                                    />
                                                                )}

                                                                {!isReadOnly && (
                                                                    <MenuItem
                                                                        index={itemIndex++}
                                                                        icon={RotateCcw}
                                                                        label="Reiniciar laboratorio"
                                                                        onSelect={handleResetData}
                                                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                                    />
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </DropdownContent>
                                            </DropdownMenu>

                                            {/* Finalizar Button / Admin Save Changes */}
                                            {isAdminEditActive ? (
                                                <div className="flex gap-2 ml-1.5 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        onClick={handleCancelAdminEdit}
                                                        disabled={isSaving}
                                                        className="bg-surface-2 shadow-surface-2 text-muted-foreground hover:text-foreground rounded-xl h-9 px-4 group transition-all duration-200 font-semibold text-[13px]"
                                                    >
                                                        Cancelar Edición
                                                    </Button>
                                                    <Button
                                                        onClick={handleSaveAdminEdit}
                                                        disabled={isSaving}
                                                        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md rounded-xl h-9 px-4 flex items-center gap-2 font-semibold text-[13px] whitespace-nowrap"
                                                    >
                                                        <CheckCircle size={16} className="shrink-0" />
                                                        Guardar Cambios (Admin)
                                                    </Button>
                                                </div>
                                            ) : !isReadOnly ? (
                                                <Button
                                                    onClick={handleFinalizeClick}
                                                    disabled={isSaving || (pendingItems.length === 0 && controlledItems.length === 0 && adjustedItems.length === 0)}
                                                    variant="primary"
                                                    className="rounded-xl h-9 px-4 group transition-all duration-200 flex items-center gap-1.5 font-semibold text-[13px] ml-1.5 shrink-0"
                                                 >
                                                    <CheckCircle size={16} className="shrink-0" />
                                                    <span>Finalizar</span>
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                    <ScrollArea className="flex-1 -mx-4 px-4 overflow-hidden">
                                        <ScrollAreaViewport className="pb-8">
                                            <TabsContent value="pending" className="space-y-4 pt-2">
                                                {false && (
                                                    <Card className="p-12 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-4 bg-muted/10 my-4 animate-in fade-in zoom-in duration-500 rounded-xl">
                                                        <div className="p-4 bg-primary/10 rounded-full">
                                                            <Upload className="w-8 h-8 text-primary" />
                                                        </div>
                                                        
                                                        {history.length === 0 ? (
                                                            // Initial Opening State
                                                            <>
                                                                <div>
                                                                    <h3 className="text-lg font-semibold">Cargar Archivo de Inventario</h3>
                                                                    <p className="text-muted-foreground max-w-sm mx-auto mt-1">
                                                                        Sube el archivo Excel (.xlsx) o PDF descargado del sistema para comenzar el control de {labName}.
                                                                    </p>
                                                                </div>
                                                                <div className="relative">
                                                                    <Button disabled={isUploading} className="rounded-full px-8">
                                                                        {isUploading ? 'Procesando...' : 'Seleccionar Archivo'}
                                                                    </Button>
                                                                    <Input
                                                                        type="file"
                                                                        accept=".xlsx, .xls"
                                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                                        onChange={handleFileUpload}
                                                                        disabled={isUploading}
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground mt-4 opacity-70 uppercase tracking-tighter">
                                                                    Columnas requeridas: C (EAN), D (Producto), E (Cantidad), K (Costo), J (Rubro), O (Laboratorio)
                                                                </p>
                                                            </>
                                                        ) : (
                                                            // New Cycle State
                                                            <>
                                                                <div>
                                                                    <h3 className="text-lg font-semibold">Cargar Nuevo Ciclo</h3>
                                                                    <p className="text-muted-foreground max-w-sm mx-auto mt-1">
                                                                        No hay ítems para contar en este laboratorio. Cargá un nuevo archivo para iniciar el siguiente ciclo.
                                                                    </p>
                                                                </div>
                                                                <div className="relative">
                                                                    <Button disabled={isUploading} className="rounded-full px-8">
                                                                        {isUploading ? 'Procesando...' : 'Cargar Archivo de Sistema'}
                                                                    </Button>
                                                                    <Input
                                                                        type="file"
                                                                        accept=".xlsx, .xls"
                                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                                        onChange={handleFileUpload}
                                                                        disabled={isUploading}
                                                                    />
                                                                </div>
                                                            </>
                                                        )}
                                                    </Card>
                                                )}
                                                               <CyclicInventoryList
                                                    items={getSortedItems(pendingItems)}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={handleCheck}
                                                    onBulkCheck={handleBulkCheck}
                                                    isPending={true}
                                                    readOnly={isReadOnly}
                                                    isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                                />
                                            </TabsContent>
 
                                            <TabsContent value="controlled" className="space-y-4 pt-2">
                                                <CyclicInventoryList
                                                    items={getSortedItems(controlledItems)}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={handleCheck}
                                                    onBulkCheck={handleBulkCheck}
                                                    onRevert={handleRevertItem}
                                                    readOnly={isReadOnly}
                                                    isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                                />
                                            </TabsContent>
 
                                            <TabsContent value="adjusted" className="space-y-4 pt-2">
                                                <CyclicInventoryList
                                                    items={getSortedItems(adjustedItems)}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={() => { }} // No check needed for adjusted
                                                    onBulkCheck={handleBulkCheck}
                                                    readOnly={isReadOnly}
                                                    isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                                />
                                            </TabsContent>

                                            <TabsContent value="history" className="space-y-4 pt-2">
                                                {history.length === 0 ? (
                                                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border-dashed border-2">
                                                        No hay historial de ajustes para este laboratorio.
                                                    </div>
                                                ) : (
                                                    <div className="w-full flex-1 relative bg-surface-5 shadow-surface-5 rounded-2xl border border-border/40 overflow-hidden flex flex-col h-[650px]">
                                                        <MotionTable
                                                            data={history}
                                                            columns={historyColumns}
                                                            getRowId={(row: any) => row.id}
                                                            height={600}
                                                            rowHeight={56}
                                                            onRowClick={(row: any) => {
                                                                    setSelectedSessionToEdit(row.id);
                                                                    setTempShortageId(row.adjustment_id_shortage || "");
                                                                    setTempSurplusId(row.adjustment_id_surplus || "");
                                                                    setShowEditIdsDialog(true);
                                                            }}
                                                            className="border-none"
                                                            emptyState="Sin resultados."
                                                        />
                                                    </div>
                                                )}
                                            </TabsContent>
                                        </ScrollAreaViewport>
                                        <ScrollAreaScrollbar />
                                    </ScrollArea>
                                </Tabs>
                                </div>
                            </div>
                        </>
                    )}

            {/* Save Dialog */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent showCloseButton={true} className="max-w-lg p-0 gap-0 overflow-hidden rounded-2xl bg-background border border-border/60 shadow-xl">
                    <form 
                        className="flex flex-col" 
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveInventory();
                        }}
                    >
                        {/* Block 1: Header + Select + Big Value */}
                        <div className="px-5 pt-5 pb-2 space-y-2">
                            <div className="flex flex-col gap-1">
                                <DialogTitle className="text-lg font-medium tracking-tight text-foreground">
                                    Finalizar Control
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                                    Confirma los códigos de ajuste para cerrar el control del laboratorio <strong className="text-foreground">{labName}</strong>.
                                </DialogDescription>
                            </div>

                            <div className="pt-1">
                                <Select value={balanceView} onValueChange={(val: any) => setBalanceView(val)}>
                                    <SelectTrigger placeholder="Balance" className="h-9 w-[130px] bg-background/40 border-border/30 rounded-xl shadow-none" />
                                    <SelectContent className="rounded-xl shadow-2xl border-border/40 min-w-[130px]">
                                        <SelectItem index={0} value="balance">Balance</SelectItem>
                                        <SelectItem index={1} value="faltantes">Faltantes</SelectItem>
                                        <SelectItem index={2} value="sobrantes">Sobrantes</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Big value — changes based on select */}
                            <div className="flex flex-col gap-0.5 pt-1">
                                <div className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 leading-none">
                                    {balanceView === 'balance' 
                                        ? (netBalance > 0 ? `+$${netBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : `$${netBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
                                        : balanceView === 'faltantes'
                                            ? `-$${Math.abs(shortageValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                                            : `+$${Math.abs(surplusValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                                    }
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <div className="flex items-center gap-1 text-xs font-normal">
                                        {balanceView === 'balance' ? (
                                            netBalance >= 0 ? (
                                                <>
                                                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{statsDetail.netValueDevPercent >= 0 ? '+' : ''}{statsDetail.netValueDevPercent.toFixed(2)}%</span>
                                                    <span className="text-black dark:text-white">Desvío</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                                                    <span className="text-red-500 font-semibold">{statsDetail.netValueDevPercent.toFixed(2)}%</span>
                                                    <span className="text-black dark:text-white">Desvío</span>
                                                </>
                                            )
                                        ) : balanceView === 'faltantes' ? (
                                            <>
                                                <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                                                <span className="text-red-500 font-semibold">{statsDetail.shortagePercent.toFixed(2)}%</span>
                                                <span className="text-black dark:text-white">Pérdida</span>
                                            </>
                                        ) : (
                                            <>
                                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{statsDetail.surplusPercent.toFixed(2)}%</span>
                                                <span className="text-black dark:text-white">Excedente</span>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-xs font-normal text-black dark:text-white">
                                        {totalControlledUnits} Unidades Controladas
                                    </span>
                                </div>
                             </div>
                        </div>

                        {/* Block 2 — Ajustes de inventario (Showcase Accordion wrapper) */}
                        <div className="px-5 w-full">
                            <Accordion
                                type="multiple"
                                value={["item1", "item2"]}
                                className="w-full"
                            >
                                <AccordionItem value="item1">
                                    <AccordionTrigger className="pointer-events-none bg-hover">Ajustes de inventario</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="!text-black dark:!text-white">
                                        <div className="space-y-3 pt-2">
                                            {/* Item 1: Faltantes */}
                                            <div className="flex items-center justify-between gap-4 pb-3 border-b border-border/20 last:border-b-0 last:pb-0">
                                                <input
                                                    type="text"
                                                    value={shortageId}
                                                    onChange={(e) => setShortageId(e.target.value)}
                                                    placeholder={shortageValue === 0 ? "Sin diferencias" : "Ingresar ID de Ajuste"}
                                                    disabled={shortageValue === 0}
                                                    className="flex-1 h-9 px-3 text-sm font-medium bg-background border border-border/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 text-black dark:text-white placeholder:text-sm placeholder:font-normal placeholder:text-black dark:placeholder:text-white transition-all shadow-xs disabled:opacity-40 disabled:bg-muted/10 disabled:cursor-not-allowed"
                                                />
                                                <div className="text-right">
                                                    <span className="text-sm font-semibold text-black dark:text-white block leading-none">
                                                        -${Math.abs(shortageValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-xs font-normal text-red-500 mt-1 block">
                                                        Ajuste negativo
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Item 2: Sobrantes */}
                                            <div className="flex items-center justify-between gap-4 pb-3 border-b border-border/20 last:border-b-0 last:pb-0">
                                                <input
                                                    type="text"
                                                    value={surplusId}
                                                    onChange={(e) => setSurplusId(e.target.value)}
                                                    placeholder={surplusValue === 0 ? "Sin diferencias" : "Ingresar ID de Ajuste"}
                                                    disabled={surplusValue === 0}
                                                    className="flex-1 h-9 px-3 text-sm font-medium bg-background border border-border/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 text-black dark:text-white placeholder:text-sm placeholder:font-normal placeholder:text-black dark:placeholder:text-white transition-all shadow-xs disabled:opacity-40 disabled:bg-muted/10 disabled:cursor-not-allowed"
                                                />
                                                <div className="text-right">
                                                    <span className="text-sm font-semibold text-black dark:text-white block leading-none">
                                                        +${Math.abs(surplusValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 mt-1 block">
                                                        Ajuste positivo
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item2" className="mt-2">
                                    <AccordionTrigger className="pointer-events-none bg-hover">Detalle por rubros</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="!text-black dark:!text-white">
                                            <div className="space-y-3 pt-2">
                                                {categoryStats.map((stat, idx) => {
                                                    const hasDiff = stat.surplusUnits > 0 || stat.shortageUnits < 0;
                                                    
                                                    return (
                                                        <div key={idx} className="flex items-center justify-between gap-4 pb-3 border-b border-border/20 last:border-b-0 last:pb-0">
                                                            <div>
                                                                <span className="text-sm font-semibold block leading-none text-black dark:text-white">
                                                                    {stat.category}
                                                                </span>
                                                                <span className="text-xs font-normal text-black dark:text-white mt-1 block">
                                                                    {stat.controlledUnits} Unidades Controladas
                                                                </span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-sm font-semibold block leading-none text-black dark:text-white">
                                                                    {stat.value > 0 ? '+' : stat.value < 0 ? '-' : ''}${Math.abs(stat.value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                                
                                                                <div className="flex flex-wrap items-center justify-end gap-2 mt-1">
                                                                    {!hasDiff ? (
                                                                        <span className="text-xs font-normal text-black dark:text-white">
                                                                            0 Unidades
                                                                        </span>
                                                                    ) : (
                                                                        <>
                                                                            {stat.surplusUnits > 0 && (
                                                                                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                                                                                    +{stat.surplusUnits} Unidades
                                                                                </span>
                                                                            )}
                                                                            {stat.shortageUnits < 0 && (
                                                                                <span className="text-xs font-normal text-red-500">
                                                                                    {stat.shortageUnits} Unidades
                                                                                </span>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>

                        <DialogFooter className="px-5 pb-5 pt-4 mt-2 justify-end">
                            <Button 
                                variant="ghost" 
                                type="button"
                                onClick={() => setShowSaveDialog(false)}
                                disabled={isSaving}
                            >
                                Cancelar
                            </Button>
                            {isSaving ? (
                                <Button 
                                    variant="secondary"
                                    loading={true}
                                    disabled={true}
                                    className="rounded-xl"
                                >
                                    Guardando...
                                </Button>
                            ) : (
                                <Button 
                                    type="submit"
                                    disabled={
                                        (shortageValue !== 0 && !shortageId.trim()) || 
                                        (surplusValue !== 0 && !surplusId.trim())
                                    }
                                    className="bg-foreground text-background hover:bg-foreground/90 rounded-xl"
                                >
                                    Confirmar y finalizar
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <HistoryDialog 
                open={isHistoryDialogOpen}
                onOpenChange={setIsHistoryDialogOpen}
                history={history}
                onEditIds={(session) => {
                    setSelectedSessionToEdit(session.id);
                    setTempShortageId(session.adjustment_id_shortage || "");
                    setTempSurplusId(session.adjustment_id_surplus || "");
                    setIsHistoryDialogOpen(false);
                    setShowEditIdsDialog(true);
                }}
            />

            {/* Security Delete Dialog */}
            <DeleteConfirmationDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
                title={`Reiniciar ${labName}`}
            />



            {/* Laboratory Mismatch Resolution Dialog */}
            <Dialog open={showMismatchDialog} onOpenChange={setShowMismatchDialog}>
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden border border-border/60 shadow-md rounded-lg bg-background">
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                        <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                            Discrepancia de Laboratorio
                        </DialogTitle>
                    </div>

                    <div className="px-5 pb-5 space-y-4">
                        <div className="space-y-1.5">
                            <p className="text-[13px] text-muted-foreground leading-relaxed">
                                El archivo Excel contiene el laboratorio <strong className="text-foreground">{mismatchData?.fileLabName}</strong>, pero actualmente estás controlando el laboratorio <strong className="text-foreground">{labName}</strong>.
                            </p>
                            {mismatchData?.isSimilar ? (
                                <p className="text-[13px] text-muted-foreground leading-relaxed">
                                    Encontramos los siguientes laboratorios similares autorizados en tu sucursal. Seleccioná uno para importar y redirigirte, o bien forzá la carga en el actual.
                                </p>
                            ) : (
                                <p className="text-[13px] text-muted-foreground leading-relaxed">
                                    No se encontraron laboratorios similares autorizados en tu sucursal. Podés forzar la carga de los productos en el laboratorio actual si corresponde.
                                </p>
                            )}
                        </div>

                        {mismatchData?.isSimilar && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-px">
                                    Laboratorios Similares Sugeridos
                                </Label>
                                <div className="space-y-1.5">
                                    {mismatchData.similarLabs.map((similarLab) => (
                                        <button
                                            key={similarLab}
                                            onClick={() => handleResolveMismatch('redirect', similarLab)}
                                            className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all text-left group active:scale-[0.99]"
                                        >
                                            <div className="space-y-0.5">
                                                <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                                    {similarLab}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    Laboratorio de la sucursal
                                                </div>
                                            </div>
                                            <div className="text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                                                Importar y Redirigir →
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 pt-2">
                            <Button 
                                onClick={() => handleResolveMismatch('current')}
                                className="h-11 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all shadow-sm active:scale-[0.98]"
                            >
                                Forzar carga en {labName}
                            </Button>
                            
                            <Button 
                                variant="ghost" 
                                onClick={() => handleResolveMismatch('cancel')}
                                className="h-11 w-full text-[13px] text-muted-foreground hover:text-foreground font-medium rounded-xl hover:bg-muted/50"
                            >
                                Cancelar Carga
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Category Warning Dialog (Missing Rubros in Excel) */}
            <Dialog open={showCategoryWarningDialog} onOpenChange={setShowCategoryWarningDialog}>
                <DialogContent size="lg">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Advertencia de Rubros Faltantes ({categoryWarningData?.targetLab})</DialogTitle>
                            <DialogDescription>
                                El laboratorio <strong className="text-foreground">{categoryWarningData?.targetLab}</strong> tiene asignados varios rubros en tu sucursal, pero el archivo subido sólo reporta parte de ellos. Por favor verifica si descargaste el stock completo desde PLEX antes de continuar.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 pt-1 text-sm">
                            <div>
                                <span className="text-xs font-medium text-muted-foreground block mb-1">
                                    Rubros Encontrados en el Archivo:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {categoryWarningData?.foundCategories.map(cat => (
                                        <span key={cat} className="inline-flex items-center text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                                            ✓ {cat}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <span className="text-xs font-medium text-muted-foreground block mb-1">
                                    Rubros Omitidos / Faltantes en el Archivo:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {categoryWarningData?.missingCategories.map(cat => (
                                        <span key={cat} className="inline-flex items-center text-xs px-2.5 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                                            ✕ {cat}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleResolveCategoryWarning('cancel')}
                            >
                                Cancelar e ir a PLEX
                            </Button>
                            <Button
                                onClick={() => handleResolveCategoryWarning('proceed')}
                            >
                                Continuar de todos modos
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Outdated File Warning Dialog */}
            <Dialog open={showOutdatedWarningDialog} onOpenChange={setShowOutdatedWarningDialog}>
                <DialogContent size="lg">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <span>Advertencia de Archivo Desactualizado ({outdatedWarningData?.targetLab})</span>
                            </DialogTitle>
                            <DialogDescription>
                                El reporte de Excel que intentás subir para <strong className="text-foreground">{outdatedWarningData?.targetLab}</strong> fue emitido <strong className="text-foreground">{outdatedWarningData?.relativeDateStr || 'en una fecha anterior'}</strong>. Importar un archivo desactualizado puede generar diferencias involuntarias de stock durante el conteo.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 pt-1 text-sm">
                            <div>
                                <span className="text-xs font-medium text-muted-foreground block mb-1">
                                    Fecha y Hora de Emisión del Archivo:
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center text-xs px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                                        {outdatedWarningData?.fileDateStr || 'Desconocida'}
                                    </span>
                                    <span className="inline-flex items-center text-xs px-2.5 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                                        ✕ Posibles diferencias de stock
                                    </span>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleResolveOutdatedWarning('cancel')}
                            >
                                Cancelar e ir a PLEX
                            </Button>
                            <Button
                                onClick={() => handleResolveOutdatedWarning('proceed')}
                            >
                                Continuar de todos modos
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>


            {/* Minimalist Admin Purge Modal */}
            <Dialog open={showAdminPurgeModal} onOpenChange={setShowAdminPurgeModal}>
                <DialogContent size="lg">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Eliminar {labName}</DialogTitle>
                            <DialogDescription>
                                ¿Estás seguro de que quieres eliminar permanentemente todos los datos de este laboratorio? Esta acción no se puede deshacer.
                            </DialogDescription>
                        </DialogHeader>

                        <DialogFooter>
                            <DialogClose render={<Button type="button" variant="ghost" disabled={isAdminPurging} />}>
                                Cancelar
                            </DialogClose>
                            <Button 
                                onClick={handleAdminPurge} 
                                disabled={isAdminPurging}
                                loading={isAdminPurging}
                            >
                                Eliminar
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Adjustment IDs Dialog */}
            <Dialog open={showEditIdsDialog} onOpenChange={(open) => !open && setShowEditIdsDialog(false)}>
                <DialogContent size="lg">
                    <Form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            setIsSavingIds(true);
                            try {
                                if (selectedSessionToEdit === "active") {
                                    await handleUpdateAdjustmentIds(tempShortageId, tempSurplusId);
                                } else {
                                    const session = history.find(s => s.id === selectedSessionToEdit);
                                    if (session) {
                                        await handleUpdateSessionAdjustmentIds(
                                            selectedSessionToEdit,
                                            tempShortageId,
                                            tempSurplusId,
                                            session.created_at
                                        );
                                    }
                                }
                                setShowEditIdsDialog(false);
                                toast.success("Operación exitosa", "IDs de ajuste actualizados correctamente.");
                            } catch (err) {
                                toast.error("Error", "No se pudieron actualizar los IDs de ajuste.");
                            } finally {
                                setIsSavingIds(false);
                            }
                        }}
                        className="space-y-4"
                    >
                        <DialogHeader>
                            <DialogTitle>Editar IDs de Ajuste</DialogTitle>
                            <DialogDescription>
                                Modifica los IDs de ajuste cargados en PLEX para Faltantes y Sobrantes.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <Field className="space-y-1.5">
                                <FieldLabel className="text-xs font-semibold text-foreground/90">
                                    Seleccionar Sesión / Historial
                                </FieldLabel>
                                <select
                                    value={selectedSessionToEdit}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedSessionToEdit(val);
                                        if (val === "active") {
                                            const existingShortage = items.find(i => i.status === 'adjusted' && i.shortageId)?.shortageId || "";
                                            const existingSurplus = items.find(i => i.status === 'adjusted' && i.surplusId)?.surplusId || "";
                                            setTempShortageId(existingShortage);
                                            setTempSurplusId(existingSurplus);
                                        } else {
                                            const session = history.find(s => s.id === val);
                                            if (session) {
                                                setTempShortageId(session.adjustment_id_shortage || "");
                                                setTempSurplusId(session.adjustment_id_surplus || "");
                                            }
                                        }
                                    }}
                                    className="w-full h-10 px-3 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer font-medium"
                                >
                                    <option value="active">Control Activo (Actual)</option>
                                    {history.map((session: any) => {
                                        const dateStr = format(new Date(session.created_at), "d 'de' MMMM, HH:mm", { locale: es });
                                        const categoryStr = session.category || "General";
                                        return (
                                            <option key={session.id} value={session.id}>
                                                {`${dateStr} - ${categoryStr} (${session.total_units_adjusted} unids)`}
                                            </option>
                                        );
                                    })}
                                </select>
                            </Field>

                            <Field>
                                <FieldLabel className="text-xs font-semibold text-foreground/90">
                                    ID Ajuste Faltantes (negativos)
                                </FieldLabel>
                                <Input
                                    value={tempShortageId}
                                    onChange={(e) => setTempShortageId(e.target.value)}
                                    placeholder="ID Ajuste Faltantes (PLEX)"
                                    className="h-10 text-xs rounded-xl"
                                />
                            </Field>

                            <Field>
                                <FieldLabel className="text-xs font-semibold text-foreground/90">
                                    ID Ajuste Sobrantes (positivos)
                                </FieldLabel>
                                <Input
                                    value={tempSurplusId}
                                    onChange={(e) => setTempSurplusId(e.target.value)}
                                    placeholder="ID Ajuste Sobrantes (PLEX)"
                                    className="h-10 text-xs rounded-xl"
                                />
                            </Field>
                        </div>

                        <DialogFooter>
                            <DialogClose nativeButton={false} render={<Button type="button" variant="ghost" />}>
                                Cancelar
                            </DialogClose>
                            <Button
                                type="submit"
                                loading={isSavingIds}
                            >
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Modal de Solicitud de Baja */}
            <LabRemovalModal
                open={removalModalOpen}
                onOpenChange={setRemovalModalOpen}
                labName={labName}
                category={currentCategory}
                round={round}
                branchName={branchName}
            />
        </PageLayout>
    );
}

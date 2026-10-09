import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { Button, buttonVariants } from '@/components/ui/button';
import { Group, GroupSeparator } from '@/components/ui/group';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabItem } from "@/components/ui/tabs";
import { TabsSubtle, TabsSubtleItem, TabsSubtlePanel } from "@/components/ui/tabs-subtle";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Upload01 as Upload, SearchLg as Search, InfoCircle as Info, RefreshCw01 as Loader2, CheckCircle, RefreshCw01 as RotateCcw, CurrencyDollar as Dollar, Clipboard as ClipboardList, ChevronLeft as ArrowLeft, FilterFunnel02 as Filter, DotsHorizontal as MoreVertical, ClipboardX as DiffIcon, AlertTriangle, File02 as Document, Download01 as Download, Edit01 as Pen, RefreshCw01 as Refresh, ArrowUpRight, ArrowDownRight, TrendUp01 as TrendingUp, FileSearch02 } from '@untitledui/icons';
import { Database, RefreshCw as LucideRefreshCw } from 'lucide-react';
import { fontWeights } from "@/lib/font-weight";
import { LabRemovalModal } from "@/components/LabRemovalModal";
import {
    InputGroup,
    InputField,
    InputGroupAddon,
    InputGroupInput,
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
    const [adminPurgePassword, setAdminPurgePassword] = useState("");
    const [adminPurgeError, setAdminPurgeError] = useState("");
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    // Save Dialog View State
    const [balanceView, setBalanceView] = useState<'balance' | 'faltantes' | 'sobrantes'>('balance');
    const [historySearchTerm, setHistorySearchTerm] = useState("");

    // Columns config for history table (unified with main table styling)
    const historyColumns = useMemo<any[]>(() => [
        {
            key: "folio",
            header: "Folio",
            sortable: true,
            width: "130px",
            sortValue: (h: any) => h.folio || '',
            cell: (h: any) => (
                <div className="flex items-center">
                    {h.folio ? (
                        <Badge
                            variant="outline"
                            size="default"
                            className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10 dark:border-indigo-500/30 dark:bg-indigo-950/40 font-medium"
                        >
                            {h.folio}
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground/30 text-xs">–</span>
                    )}
                </div>
            )
        },
        {
            key: "date",
            header: "Fecha",
            sortable: true,
            width: "110px",
            sortValue: (h: any) => new Date(h.created_at).getTime(),
            cell: (h: any) => (
                <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap block">
                    {new Date(h.created_at).toLocaleDateString()}
                </span>
            )
        },
        {
            key: "time",
            header: "Hora",
            sortable: true,
            width: "85px",
            sortValue: (h: any) => new Date(h.created_at).getTime(),
            cell: (h: any) => (
                <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                    {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            )
        },
        {
            key: "user_name",
            header: "Auditor",
            sortable: true,
            width: "140px",
            sortValue: (h: any) => h.user_name || '',
            cell: (h: any) => (
                <span className="text-xs font-medium text-foreground whitespace-nowrap truncate block">
                    {h.user_name || 'Desconocido'}
                </span>
            )
        },
        {
            key: "category",
            header: "Rubro/s",
            sortable: true,
            width: "120px",
            sortValue: (h: any) => h.category || '',
            cell: (h: any) => (
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-tight truncate block">
                    {h.category || 'Varios'}
                </span>
            )
        },
        {
            key: "total_units_adjusted",
            header: "Art Ajustados",
            sortable: true,
            width: "110px",
            sortValue: (h: any) => Number(h.total_units_adjusted) || 0,
            cell: (h: any) => (
                <span className="text-xs font-semibold text-foreground tabular-nums">
                    {h.total_units_adjusted}
                </span>
            )
        },
        {
            key: "total_stock_counted",
            header: "Art Contados",
            sortable: true,
            width: "110px",
            sortValue: (h: any) => Number(h.total_stock_counted) || 0,
            cell: (h: any) => (
                <span className="text-xs font-semibold text-foreground tabular-nums">
                    {h.total_stock_counted !== undefined ? h.total_stock_counted : '—'}
                </span>
            )
        },
        {
            key: "adjustment_id_shortage",
            header: "ID Ajustes (-)",
            sortable: true,
            width: "115px",
            sortValue: (h: any) => h.adjustment_id_shortage || '',
            cell: (h: any) => (
                h.adjustment_id_shortage ? (
                    <Badge variant="outline" size="default" className="text-xs font-medium tabular-nums">
                        {h.adjustment_id_shortage}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground/30 text-xs">–</span>
                )
            )
        },
        {
            key: "shortage_value",
            header: "Ajustes Faltantes",
            sortable: true,
            width: "135px",
            sortValue: (h: any) => Number(h.shortage_value ?? h.total_shortage_value) || 0,
            cell: (h: any) => {
                const shortageVal = Number(h.shortage_value ?? h.total_shortage_value) || 0;
                return (
                    <p className={cn(
                        "text-xs font-semibold tabular-nums",
                        shortageVal === 0 ? "text-muted-foreground/40 font-normal" : "text-red-600 dark:text-red-400"
                    )}>
                        {shortageVal > 0 ? `-$${shortageVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "–"}
                    </p>
                );
            }
        },
        {
            key: "adjustment_id_surplus",
            header: "ID Ajustes (+)",
            sortable: true,
            width: "115px",
            sortValue: (h: any) => h.adjustment_id_surplus || '',
            cell: (h: any) => (
                h.adjustment_id_surplus ? (
                    <Badge variant="outline" size="default" className="text-xs font-medium tabular-nums">
                        {h.adjustment_id_surplus}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground/30 text-xs">–</span>
                )
            )
        },
        {
            key: "surplus_value",
            header: "Ajustes Sobrantes",
            sortable: true,
            width: "135px",
            sortValue: (h: any) => Number(h.surplus_value ?? h.total_surplus_value) || 0,
            cell: (h: any) => {
                const surplusVal = Number(h.surplus_value ?? h.total_surplus_value) || 0;
                return (
                    <p className={cn(
                        "text-xs font-semibold tabular-nums",
                        surplusVal === 0 ? "text-muted-foreground/40 font-normal" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                        {surplusVal > 0 ? `+$${surplusVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "–"}
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
        isSyncingMysql,
        handleMysqlSync,
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

    const filteredHistory = useMemo(() => {
        const term = historySearchTerm.toLowerCase().trim();
        if (!term) return history;
        return history.filter((h: any) => {
            const folio = String(h.folio || '').toLowerCase();
            const user = String(h.user_name || '').toLowerCase();
            const cat = String(h.category || '').toLowerCase();
            const idShortage = String(h.adjustment_id_shortage || '').toLowerCase();
            const idSurplus = String(h.adjustment_id_surplus || '').toLowerCase();
            const dateStr = h.created_at ? new Date(h.created_at).toLocaleDateString().toLowerCase() : '';
            return (
                folio.includes(term) ||
                user.includes(term) ||
                cat.includes(term) ||
                idShortage.includes(term) ||
                idSurplus.includes(term) ||
                dateStr.includes(term)
            );
        });
    }, [history, historySearchTerm]);

    const [removalModalOpen, setRemovalModalOpen] = useState(false);

    // Resumen de Rubros Controlados y Totales para el Diálogo de Finalización
    const categoryStats = useMemo(() => {
        const statsMap = CATEGORIES.map(category => {
            const catItems = items.filter(item => {
                const normCat = normalizeString(item.category || 'Varios').toUpperCase();
                const normTarget = normalizeString(category).toUpperCase();
                return normCat === normTarget;
            });

            let controlledArticles = 0;
            let surplusUnits = 0;
            let shortageUnits = 0;
            let value = 0;

            catItems.forEach(item => {
                if (item.status === 'controlled') {
                    controlledArticles += 1;
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
                controlledArticles,
                surplusUnits,
                shortageUnits,
                value: Math.round(value * 100) / 100
            };
        });

        return statsMap;
    }, [items]);

    const totalControlledArticles = useMemo(() => {
        return categoryStats.reduce((sum, s) => sum + s.controlledArticles, 0);
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
        if (!adminPurgePassword.trim()) {
            setAdminPurgeError("Ingresá la contraseña administrativa");
            return;
        }
        setIsAdminPurging(true);
        setAdminPurgeError("");
        try {
            const result = (await cyclicInventoryService.adminPurgeLabInventory(
                branchName,
                labName,
                adminPurgePassword.trim(),
                user?.id || ''
            )) as any;

            if (result.success) {
                toast.success("Éxito", result.message);
                setShowAdminPurgeModal(false);
                setAdminPurgePassword("");
                navigate('/inventario-ciclico');
            } else {
                setAdminPurgeError(result.message || "Error al procesar la solicitud.");
                toast.error("Error", result.message);
            }
        } catch (error: any) {
            console.error("Error in admin purge:", error);
            setAdminPurgeError(error?.message || "Error al procesar la solicitud.");
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
                    {/* Main Content */}
                    <div className="w-full flex-1 flex flex-col min-h-0">
                        {/* Fila superior: Tabs de Categorías a la izquierda y Título/Info al fondo a la derecha */}
                        <div className="flex items-center justify-between gap-3 mb-2.5">
                            {/* Categorías */}
                            <Tabs value={currentCategory} onValueChange={setCurrentCategory} className="w-fit shrink-0">
                                <TabsList>
                                    {CATEGORIES.map((cat) => {
                                        const catCount = items.filter(i => {
                                            if (i.status !== 'pending') return false;
                                            const itemCat = i.category ? i.category.trim() : '';
                                            const normalizedTarget = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                                            const normalizedItem = itemCat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                                            return normalizedItem === normalizedTarget;
                                        }).length;

                                        return (
                                            <TabItem 
                                                key={cat} 
                                                value={cat} 
                                                label={catCount > 0 ? `${cat} (${catCount})` : cat} 
                                            />
                                        );
                                    })}
                                </TabsList>
                            </Tabs>

                            {/* Al fondo a la derecha: Título de inventario y subtítulo en la misma línea de los tabs */}
                            <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
                                <h1 className="sr-only">
                                    {labName}
                                </h1>
                                <span
                                    title={labName}
                                    className="text-[13px] text-foreground font-semibold max-w-[280px] sm:max-w-[420px] truncate"
                                    style={{ fontVariationSettings: fontWeights.semibold }}
                                >
                                    {labName || "Sin Laboratorio"}
                                </span>
                                <Badge
                                    variant="solid"
                                    color="gray"
                                    size="default"
                                    className="bg-muted/70 dark:bg-surface-2/70 text-foreground/80 dark:text-zinc-200 border border-border/40 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-2xs tabular-nums"
                                >
                                    {progressPercentage}% avance
                                </Badge>
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
                                {(() => {
                                    const cyclicActions = (
                                        <>
                                            {/* Botón Sincronizar desde Servidor Plex (MySQL) - Desactivado temporalmente */}
                                            <Button
                                                variant="tertiary"
                                                size="icon"
                                                disabled
                                                aria-label="Sincronizar Stock desde Servidor Plex (MySQL) (Desactivado)"
                                                title="Sincronizar Stock desde Servidor Plex (MySQL) (Desactivado)"
                                                className="h-8 w-8 rounded-lg border border-border bg-transparent opacity-40 grayscale cursor-not-allowed pointer-events-none text-muted-foreground transition-all duration-80"
                                            >
                                                <Database className="size-3.5" />
                                            </Button>

                                            {/* Botón Cargar Archivo */}
                                            <Button
                                                variant="tertiary"
                                                size="icon"
                                                onClick={() => document.getElementById('inventory-upload-hidden')?.click()}
                                                disabled={isUploading || isSaving || isSyncingMysql}
                                                aria-label="Cargar Archivo"
                                                title="Cargar Archivo"
                                                className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                            >
                                                <Upload className="size-3.5" />
                                            </Button>

                                            {/* Botón Reiniciar */}
                                            <Button
                                                variant="tertiary"
                                                size="icon"
                                                onClick={handleResetData}
                                                disabled={isUploading || isSaving}
                                                aria-label="Reiniciar"
                                                title="Reiniciar"
                                                className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </Button>

                                            {/* Botón Solo Diferencias */}
                                            <Button
                                                variant="tertiary"
                                                size="icon"
                                                onClick={() => setShowDifferencesOnly(!showDifferencesOnly)}
                                                aria-label="Solo Diferencias"
                                                title="Solo Diferencias"
                                                className={cn(
                                                    "h-8 w-8 rounded-lg border transition-all duration-80 cursor-pointer",
                                                    showDifferencesOnly 
                                                        ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20" 
                                                        : "border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <DiffIcon className="size-3.5" />
                                            </Button>

                                            {/* Botón Solicitar Baja de Laboratorio */}
                                            <Button
                                                variant="tertiary"
                                                size="icon"
                                                onClick={() => setRemovalModalOpen(true)}
                                                aria-label="Solicitar Baja de Laboratorio"
                                                title="Solicitar Baja de Laboratorio"
                                                className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-amber-500 transition-all duration-80 cursor-pointer"
                                            >
                                                <FileSearch02 className="size-3.5" />
                                            </Button>

                                            {/* Dropdown Ordenar */}
                                            <DropdownMenu>
                                                <DropdownTrigger render={
                                                    <Button 
                                                        variant="tertiary" 
                                                        size="icon" 
                                                        aria-label="Ordenar"
                                                        title="Ordenar"
                                                        className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                                    >
                                                        <Filter className="size-3.5" />
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
                                                        variant="tertiary" 
                                                        size="icon" 
                                                        aria-label="Más Acciones"
                                                        title="Más Acciones"
                                                        className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                                    >
                                                        <MoreVertical className="size-3.5" />
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
                                                                            icon={Database}
                                                                            label="Sincronizar desde Servidor Plex"
                                                                            disabled
                                                                            className="opacity-40 grayscale cursor-not-allowed pointer-events-none"
                                                                        />
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
                                                <div className="flex gap-1.5 ml-1 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        onClick={handleCancelAdminEdit}
                                                        disabled={isSaving}
                                                        className="h-8 px-3 rounded-lg font-semibold text-xs border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80"
                                                    >
                                                        Cancelar Edición
                                                    </Button>
                                                    <Button
                                                        onClick={handleSaveAdminEdit}
                                                        disabled={isSaving}
                                                        className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs rounded-lg flex items-center gap-1.5 font-semibold text-xs whitespace-nowrap transition-all duration-80"
                                                    >
                                                        <CheckCircle size={14} className="shrink-0" />
                                                        Guardar Cambios (Admin)
                                                    </Button>
                                                </div>
                                            ) : !isReadOnly ? (
                                                <Button
                                                    onClick={handleFinalizeClick}
                                                    disabled={isSaving || (pendingItems.length === 0 && controlledItems.length === 0 && adjustedItems.length === 0)}
                                                    className="h-8 px-3.5 bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] shadow-xs rounded-lg font-semibold text-xs whitespace-nowrap ml-1 shrink-0 transition-all duration-80 cursor-pointer"
                                                >
                                                    Finalizar
                                                </Button>
                                            ) : null}
                                        </>
                                    );

                                    const statusTabKeys = ["pending", "controlled", "adjusted", "history"] as const;
                                    const selectedTab = Math.max(0, statusTabKeys.indexOf(activeTab as any));

                                    const statusTabsData = [
                                        { key: "pending", label: pendingItems.length > 0 ? `Pendientes (${pendingItems.length})` : "Pendientes" },
                                        { key: "controlled", label: controlledItems.length > 0 ? `Controlados (${controlledItems.length})` : "Controlados" },
                                        { key: "adjusted", label: adjustedItems.length > 0 ? `Ajustados (${adjustedItems.length})` : "Ajustados" },
                                        { key: "history", label: history.length > 0 ? `Historial (${history.length})` : "Historial" },
                                    ];

                                    const statusTabs = (
                                        <TabsSubtle
                                            idPrefix="cyclic-status"
                                            selectedIndex={selectedTab}
                                            onSelect={(idx) => setActiveTab(statusTabKeys[idx] || "pending")}
                                            size="compact"
                                            className="h-8 items-center"
                                        >
                                            {statusTabsData.map((tab, i) => (
                                                <TabsSubtleItem
                                                    key={tab.key}
                                                    index={i}
                                                    label={tab.label}
                                                    className="h-8 px-3 text-xs"
                                                />
                                            ))}
                                        </TabsSubtle>
                                    );

                                    const activeTabItems = selectedTab === 0
                                        ? getSortedItems(pendingItems)
                                        : selectedTab === 1
                                        ? getSortedItems(controlledItems)
                                        : selectedTab === 2
                                        ? getSortedItems(adjustedItems)
                                        : [];

                                    return (
                                        <div className="w-full pb-8">
                                            <TabsSubtlePanel index={0} selectedIndex={selectedTab} idPrefix="cyclic-status" className="space-y-4 pt-2">
                                                <CyclicInventoryList
                                                    items={selectedTab === 0 ? activeTabItems : []}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={handleCheck}
                                                    onBulkCheck={handleBulkCheck}
                                                    isPending={true}
                                                    readOnly={isReadOnly}
                                                    isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                                    actions={cyclicActions}
                                                    tabsSlot={statusTabs}
                                                />
                                            </TabsSubtlePanel>
        
                                            <TabsSubtlePanel index={1} selectedIndex={selectedTab} idPrefix="cyclic-status" className="space-y-4 pt-2">
                                                <CyclicInventoryList
                                                    items={selectedTab === 1 ? activeTabItems : []}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={handleCheck}
                                                    onBulkCheck={handleBulkCheck}
                                                    onRevert={handleRevertItem}
                                                    readOnly={isReadOnly}
                                                    isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                                    actions={cyclicActions}
                                                    tabsSlot={statusTabs}
                                                />
                                            </TabsSubtlePanel>
        
                                            <TabsSubtlePanel index={2} selectedIndex={selectedTab} idPrefix="cyclic-status" className="space-y-4 pt-2">
                                                <CyclicInventoryList
                                                    items={selectedTab === 2 ? activeTabItems : []}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={() => { }}
                                                    onBulkCheck={handleBulkCheck}
                                                    readOnly={isReadOnly}
                                                    isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                                    actions={cyclicActions}
                                                    tabsSlot={statusTabs}
                                                />
                                            </TabsSubtlePanel>

                                            <TabsSubtlePanel index={3} selectedIndex={selectedTab} idPrefix="cyclic-status" className="space-y-4 pt-2">
                                                <div className="w-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 shadow-xs">
                                                    <div className="w-full bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-2 sm:p-3 shadow-xs min-h-[560px] flex flex-col relative">
                                                        <div className="sticky top-0 z-30 bg-white/95 dark:bg-surface-3/95 backdrop-blur-md -mx-2 sm:-mx-3 -mt-2 sm:-mt-3 px-3 sm:px-4 py-3 rounded-t-[22px] border-b border-border/40 flex flex-wrap items-center justify-between gap-3 transition-colors shadow-2xs">
                                                            <div className="flex flex-wrap items-center gap-3">
                                                                {/* Buscador */}
                                                                <InputGroup className="w-[180px] h-8 rounded-lg border border-border bg-transparent hover:bg-hover transition-all duration-80 focus-within:ring-1 focus-within:ring-[color:var(--focus-ring,#6B97FF)] shadow-none shrink-0">
                                                                    <InputGroupAddon className="pl-2.5 pr-1.5 text-muted-foreground">
                                                                        <Search className="size-3.5 shrink-0" />
                                                                    </InputGroupAddon>
                                                                    <InputGroupInput
                                                                        type="text"
                                                                        placeholder="Buscar en historial..."
                                                                        value={historySearchTerm}
                                                                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                                                                        className="h-full text-xs font-normal placeholder:text-muted-foreground text-foreground bg-transparent border-0 focus-visible:ring-0 px-0"
                                                                    />
                                                                </InputGroup>

                                                                {statusTabs}
                                                            </div>
                                                            {cyclicActions && (
                                                                <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap justify-end">
                                                                    {cyclicActions}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {history.length === 0 ? (
                                                            <div className="text-center py-16 text-muted-foreground text-xs flex flex-col items-center justify-center gap-1">
                                                                <span className="font-semibold text-foreground text-sm">No hay historial de ajustes</span>
                                                                <span>No se encontraron sesiones de ajuste registradas para este laboratorio.</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex-1 w-full overflow-hidden rounded-b-[18px]">
                                                                <MotionTable
                                                                    data={filteredHistory}
                                                                    columns={historyColumns}
                                                                    getRowId={(row: any) => row.id}
                                                                    resizable
                                                                    reorderable
                                                                    defaultSort={{ key: "date", direction: "desc" }}
                                                                    height={520}
                                                                    rowHeight={40}
                                                                    dense={true}
                                                                    overscan={5}
                                                                    headerClassName="bg-white dark:bg-[#252525] dark:bg-surface-3 shadow-2xs"
                                                                    className="rounded-xl border-none w-full bg-transparent"
                                                                    emptyState={
                                                                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs gap-1.5">
                                                                            <span className="font-semibold text-foreground text-sm">Sin coincidencias</span>
                                                                            <span className="text-muted-foreground text-xs">
                                                                                No se encontraron resultados para "{historySearchTerm}".
                                                                            </span>
                                                                        </div>
                                                                    }
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TabsSubtlePanel>
                                        </div>
                                    );
                        })()}
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
                                    Confirma los códigos de ajuste para cerrar el control del laboratorio <strong className="text-foreground">{labName.replace(/\.+$/, '')}</strong>.
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
                                <div className={cn(
                                    "text-3xl font-bold tracking-tight leading-none tabular-nums",
                                    balanceView === 'balance'
                                        ? (netBalance > 0 ? "text-financial-positive" : netBalance < 0 ? "text-financial-negative" : "text-foreground")
                                        : balanceView === 'faltantes'
                                        ? "text-financial-negative"
                                        : "text-financial-positive"
                                )}>
                                    {balanceView === 'balance' 
                                        ? (netBalance > 0 ? `+$${netBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : `$${netBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`)
                                        : balanceView === 'faltantes'
                                            ? `-$${Math.abs(shortageValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                                            : `+$${Math.abs(surplusValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                                    }
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <div className="flex items-center gap-1 text-xs font-normal tabular-nums">
                                        {balanceView === 'balance' ? (
                                            netBalance >= 0 ? (
                                                <>
                                                    <ArrowUpRight className="w-3.5 h-3.5 text-financial-positive" />
                                                    <span className="text-financial-positive font-semibold">+{statsDetail.netValueDevPercent.toFixed(2)}%</span>
                                                    <span className="text-muted-foreground">Desvío</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowDownRight className="w-3.5 h-3.5 text-financial-negative" />
                                                    <span className="text-financial-negative font-semibold">{statsDetail.netValueDevPercent.toFixed(2)}%</span>
                                                    <span className="text-muted-foreground">Desvío</span>
                                                </>
                                            )
                                        ) : balanceView === 'faltantes' ? (
                                            <>
                                                <ArrowDownRight className="w-3.5 h-3.5 text-financial-negative" />
                                                <span className="text-financial-negative font-semibold">{statsDetail.shortagePercent.toFixed(2)}%</span>
                                                <span className="text-muted-foreground">Pérdida</span>
                                            </>
                                        ) : (
                                            <>
                                                <ArrowUpRight className="w-3.5 h-3.5 text-financial-positive" />
                                                <span className="text-financial-positive font-semibold">+{statsDetail.surplusPercent.toFixed(2)}%</span>
                                                <span className="text-muted-foreground">Excedente</span>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {totalControlledArticles} {totalControlledArticles === 1 ? 'Artículo Controlado' : 'Artículos Controlados'}
                                    </span>
                                </div>
                             </div>
                        </div>

                        {/* Block 2 — Ajustes y Detalle por rubros */}
                        <div className="px-5 w-full space-y-3.5 pt-1">
                            {/* Sección Ajustes de inventario */}
                            <div className="flex flex-col gap-2">
                                <div className="px-3 py-1.5 rounded-lg bg-hover font-semibold text-xs text-foreground select-none">
                                    Ajustes de inventario
                                </div>
                                <div className="space-y-3 pt-1">
                                    {/* Item 1: Faltantes */}
                                    <div className="flex items-center justify-between gap-4 pb-3 border-b border-border/20 last:border-b-0 last:pb-0">
                                        <input
                                            type="text"
                                            value={shortageId}
                                            onChange={(e) => setShortageId(e.target.value)}
                                            placeholder={shortageValue === 0 ? "Sin diferencias" : "Ingresar ID de Ajuste"}
                                            disabled={shortageValue === 0}
                                            className="flex-1 h-9 px-3 text-sm font-medium bg-background border border-border/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 text-foreground placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground/60 tabular-nums transition-all shadow-xs disabled:opacity-40 disabled:bg-muted/10 disabled:cursor-not-allowed"
                                        />
                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-semibold text-foreground tabular-nums block leading-none">
                                                -${Math.abs(shortageValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-xs font-normal text-financial-negative mt-1 block">
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
                                            className="flex-1 h-9 px-3 text-sm font-medium bg-background border border-border/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 text-foreground placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground/60 tabular-nums transition-all shadow-xs disabled:opacity-40 disabled:bg-muted/10 disabled:cursor-not-allowed"
                                        />
                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-semibold text-foreground tabular-nums block leading-none">
                                                +${Math.abs(surplusValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-xs font-normal text-financial-positive mt-1 block">
                                                Ajuste positivo
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sección Detalle por rubros */}
                            <div className="flex flex-col gap-2">
                                <div className="px-3 py-1.5 rounded-lg bg-hover font-semibold text-xs text-foreground select-none">
                                    Detalle por rubros
                                </div>
                                <div className="space-y-3 pt-1">
                                    {categoryStats.map((stat, idx) => {
                                        const hasDiff = stat.surplusUnits > 0 || stat.shortageUnits < 0;
                                        const isZero = stat.value === 0 && !hasDiff;
                                        
                                        return (
                                            <div key={idx} className="flex items-center justify-between gap-4 pb-3 border-b border-border/20 last:border-b-0 last:pb-0">
                                                <div className="min-w-0">
                                                    <span className={cn(
                                                        "text-sm font-semibold block leading-none",
                                                        isZero ? "text-muted-foreground/70" : "text-foreground"
                                                    )}>
                                                        {stat.category}
                                                    </span>
                                                    <span className="text-xs font-normal text-muted-foreground mt-1 block">
                                                        {stat.controlledArticles} {stat.controlledArticles === 1 ? 'Artículo Controlado' : 'Artículos Controlados'}
                                                    </span>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className={cn(
                                                        "text-sm font-semibold tabular-nums block leading-none",
                                                        isZero ? "text-muted-foreground/60" : stat.value > 0 ? "text-financial-positive" : stat.value < 0 ? "text-financial-negative" : "text-foreground"
                                                    )}>
                                                        {stat.value > 0 ? '+' : stat.value < 0 ? '-' : ''}${Math.abs(stat.value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    
                                                    <div className="flex flex-wrap items-center justify-end gap-2 mt-1 tabular-nums">
                                                        {!hasDiff ? (
                                                            <span className="text-xs font-normal text-muted-foreground/50">
                                                                0 Unidades
                                                            </span>
                                                        ) : (
                                                            <>
                                                                {stat.surplusUnits > 0 && (
                                                                    <span className="text-xs font-medium text-financial-positive">
                                                                        +{stat.surplusUnits} Unidades
                                                                    </span>
                                                                )}
                                                                {stat.shortageUnits < 0 && (
                                                                    <span className="text-xs font-medium text-financial-negative">
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
            <Dialog 
                open={showAdminPurgeModal} 
                onOpenChange={(open) => {
                    setShowAdminPurgeModal(open);
                    if (!open) {
                        setAdminPurgePassword("");
                        setAdminPurgeError("");
                    }
                }}
            >
                <DialogContent size="lg">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Eliminar {labName}</DialogTitle>
                            <DialogDescription>
                                ¿Estás seguro de que quieres eliminar permanentemente todos los datos de este laboratorio? Esta acción no se puede deshacer.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-1.5 py-1">
                            <label className="text-xs font-medium text-foreground">
                                Contraseña de Administrador
                            </label>
                            <Input
                                type="password"
                                placeholder="Ingresá la contraseña requerida..."
                                value={adminPurgePassword}
                                onChange={(e) => {
                                    setAdminPurgePassword(e.target.value);
                                    if (adminPurgeError) setAdminPurgeError("");
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && adminPurgePassword.trim() && !isAdminPurging) {
                                        handleAdminPurge();
                                    }
                                }}
                                disabled={isAdminPurging}
                            />
                            {adminPurgeError && (
                                <p className="text-xs text-rose-500 font-medium">{adminPurgeError}</p>
                            )}
                        </div>

                        <DialogFooter>
                            <DialogClose render={<Button type="button" variant="ghost" disabled={isAdminPurging} />}>
                                Cancelar
                            </DialogClose>
                            <Button 
                                onClick={handleAdminPurge} 
                                disabled={isAdminPurging || !adminPurgePassword.trim()}
                                loading={isAdminPurging}
                            >
                                Eliminar
                            </Button>
                        </DialogFooter>
                    </div>
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

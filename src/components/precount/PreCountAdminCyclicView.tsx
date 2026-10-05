import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabItem, TabPanel } from "@/components/ui/tabs";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Upload01 as Upload,
    SearchLg as Search,
    RefreshCw01 as RotateCcw,
    CheckCircle,
    Clipboard as ClipboardList,
    FilterFunnel02 as Filter,
    ClipboardX as DiffIcon,
    AlertTriangle,
    FileSearch02,
    Trash01 as TrashIcon,
    File02 as Document,
    Download01 as Download,
    ArrowUpRight,
    ArrowDownRight
} from '@untitledui/icons';
import { HugeiconsIcon } from "@hugeicons/react";
import PackageAdd01Icon from "@hugeicons/core-free-icons/PackageAdd01Icon";
import Delete01Icon from "@hugeicons/core-free-icons/Delete01Icon";
import DeletePutBackIcon from "@hugeicons/core-free-icons/DeletePutBackIcon";
import { fontWeights } from "@/lib/font-weight";
import { Database, RefreshCw as LucideRefreshCw, Ellipsis as EllipsisIcon } from 'lucide-react';
import { LabRemovalModal } from "@/components/LabRemovalModal";
import { SendPlexApiDialog } from './SendPlexApiDialog';
import { OpenSessionsDialog } from './OpenSessionsDialog';
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
import { DeviceMonitorView } from './DeviceMonitorView';
import { PreCountConfigView } from './PreCountConfigView';
import { PreCountProductsView } from './PreCountProductsView';
import { PreCountSummaryView } from './PreCountSummaryView';
import { PreCountFilesView } from './PreCountFilesView';
import { CheckboxGroup, CheckboxItem } from '@/components/ui/checkbox-group';
import { Field, FieldLabel } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import {
    Dialog,
    DialogContent,
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
import { DeleteConfirmationDialog } from '@/components/cyclic/DeleteConfirmationDialog';
import { HistoryDialog } from '@/components/cyclic/HistoryDialog';
import { Table as MotionTable } from '@/components/motion/table';
import { PageLayout } from "@/components/layout/PageLayout";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Hooks & Components
import { useCyclicInventoryController } from '@/hooks/useCyclicInventoryController';
import { InventorySkeleton } from '@/components/InventorySkeleton';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useUser } from '@/contexts/UserContext';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { notify as toast } from '@/lib/notifications';
import { syncMysqlToLocalDb, exportLocalSessionToFile, getLocalSessionSummary } from '@/services/tauriLocalDb';
import { ReportExporter } from '@/lib/reportExporter';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

const TABLE_COLUMNS_CONFIG = [
    { key: "ean", label: "Código EAN" },
    { key: "productName", label: "Producto" },
    { key: "laboratory", label: "Laboratorio" },
    { key: "rubro", label: "Rubro" },
    { key: "sector", label: "Sector" },
    { key: "quantity", label: "Cantidad" },
    { key: "systemDiff", label: "Sist / Dif" },
    { key: "user", label: "Usuario" },
    { key: "lotes", label: "Lotes" },
    { key: "vencimiento", label: "Vto." },
    { key: "alerta", label: "Alerta" },
];

export function cleanSectorTitle(raw: string): string {
    if (!raw) return "Inventario";
    let s = raw.trim();

    // 1. Quitar prefijo LISTADO_DE_STOCK / LISTADO DE STOCK
    s = s.replace(/^LISTADO[_\s]+DE[_\s]+STOCK[_\s-]*/i, "");

    // 2. Detectar si hay sufijo pegado con sucursal o repetición: ej: "(2038)INVENTARIO..."
    const matchDuplicate = s.match(/^(.*?)\s*\((\d+)\)\s*(?:INVENTARIO\s+)?(.*?)$/i);
    if (matchDuplicate) {
        const baseName = matchDuplicate[1].trim();
        const branchCode = matchDuplicate[2].trim();
        const extra = matchDuplicate[3].trim();

        // Si extra contiene el nombre de la sucursal (ej: "PERFUMERIA BELGRANO VIII" o "BELGRANO VIII")
        let branchName = extra;
        if (baseName) {
            const words = baseName.split(/\s+/);
            for (const w of words) {
                if (w.length > 3) {
                    branchName = branchName.replace(new RegExp(`\\b${w}\\b`, 'gi'), '').trim();
                }
            }
        }

        if (branchName) {
            return `${baseName} (${branchCode} - ${branchName})`.replace(/\s+/g, ' ');
        } else {
            return `${baseName} (${branchCode})`.replace(/\s+/g, ' ');
        }
    }

    return s.replace(/\s+/g, ' ').trim();
}

interface PreCountAdminCyclicViewProps {
    defaultLabName?: string;
    sessionId?: string;
    onResumeSession?: (session: any) => void;
    onDeleteSession?: (sessionId: string) => void;
    currentProfile?: 'admin' | 'salon';
}

export function PreCountAdminCyclicView({ 
    defaultLabName = "", 
    sessionId, 
    onResumeSession, 
    onDeleteSession,
    currentProfile = 'admin'
}: PreCountAdminCyclicViewProps) {
    const labName = defaultLabName;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const roundParam = searchParams.get('round');
    const round = roundParam ? Number(roundParam) : undefined;
    const isReadOnly = round !== undefined;

    const { activeWindowId, updateWindowMeta } = useWindowManager();
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState("pending");
    const [mainTab, setMainTab] = useState<string>(() => {
        return sessionId ? "productos" : "configuracion";
    });

    useEffect(() => {
        if (sessionId) {
            setMainTab("productos");
        } else {
            setMainTab("configuracion");
        }
    }, [sessionId]);

    const displayTitle = useMemo(() => {
        if (!labName || labName === "ABBVIE" || labName === "Sin Sesión") return "Sin Sesión Activa";
        return cleanSectorTitle(labName);
    }, [labName]);

    // Admin Mode State
    const [isAdminModeEnabled, setIsAdminModeEnabled] = useState(false);
    const [showAdminPurgeModal, setShowAdminPurgeModal] = useState(false);
    const [isAdminPurging, setIsAdminPurging] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
    const [addProductTrigger, setAddProductTrigger] = useState(0);
    const [checkedColumns, setCheckedColumns] = useState<Set<number>>(
        () => new Set([0, 1, 2, 3, 4, 5, 6, 7])
    );

    const visibleColumns = useMemo(() => {
        return TABLE_COLUMNS_CONFIG
            .filter((_, idx) => checkedColumns.has(idx))
            .map((col) => col.key);
    }, [checkedColumns]);


    // Save Dialog View State
    const [balanceView, setBalanceView] = useState<'balance' | 'faltantes' | 'sobrantes'>('balance');

    // Open Sessions Modal
    const [showOpenSessionsModal, setShowOpenSessionsModal] = useState(false);

    // Local DB & Export Actions (Tauri Desktop)
    const [isSyncingLocalDb, setIsSyncingLocalDb] = useState(false);
    const [isExportingSession, setIsExportingSession] = useState(false);

    const handleSyncToLocalDb = async () => {
        setIsSyncingLocalDb(true);
        toast.info("Motor Local", "Iniciando sincronización MySQL → SQLite local...");
        try {
            const summary = await syncMysqlToLocalDb(user?.branchId || labName);
            toast.success("Sincronización exitosa", `${summary.total_products_synced.toLocaleString('es-AR')} productos sincronizados en stock_local.db.`);
        } catch (err: any) {
            console.error('Error sincronizando MySQL a SQLite:', err);
            toast.error("Error al sincronizar", err?.message || String(err));
        } finally {
            setIsSyncingLocalDb(false);
        }
    };

    const handleExportLocalSession = async () => {
        setIsExportingSession(true);
        const activeSessionId = typeof window !== 'undefined'
            ? localStorage.getItem('last_precount_session_id') || localStorage.getItem('precount_session_id') || 'default_session'
            : 'default_session';
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `inventario_${labName.toLowerCase()}_${dateStr}.txt`;
        try {
            const path = await exportLocalSessionToFile(activeSessionId, filename);
            toast.success("Inventario exportado", `Guardado en: ${path}`, { duration: 6000 });
        } catch (err: any) {
            console.error('Error exportando archivo de inventario:', err);
            toast.error("Error al exportar", err?.message || String(err));
        } finally {
            setIsExportingSession(false);
        }
    };

    const handleViewLocalSummary = async () => {
        const activeSessionId = typeof window !== 'undefined'
            ? localStorage.getItem('last_precount_session_id') || localStorage.getItem('precount_session_id') || 'default_session'
            : 'default_session';
        try {
            const summary = await getLocalSessionSummary(activeSessionId);
            toast.info("Resumen SQLite Local", `EANs: ${summary.total_skus} | Unidades totales: ${summary.total_units}`);
        } catch (err: any) {
            toast.error("No se pudo leer resumen", String(err));
        }
    };

    // Columns config for history table
    const historyColumns = useMemo<any[]>(() => [
        {
            key: "folio",
            header: <span className="pl-4">Folio</span>,
            width: "140px",
            cell: (h: any) => (
                <span className="pl-4 block">
                    {h.folio ? (
                        <Badge
                            variant="outline"
                            size="default"
                            className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10 dark:border-indigo-500/30 dark:bg-indigo-950/40 font-medium"
                        >
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

        // Special State
        isAdminEditActive,
        handleSaveAdminEdit,
        handleCancelAdminEdit,

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
    const [showPlexApiModal, setShowPlexApiModal] = useState(false);
    const [scannedTableItems, setScannedTableItems] = useState<any[]>([]);

    const handleExportExcel = () => {
        const listToExport = items.length > 0
            ? items
            : scannedTableItems.map(it => ({
                ean: it.ean,
                name: it.productName || (it as any).name,
                category: it.rubro || (it as any).category || 'Varios',
                systemQuantity: (it as any).systemStock || 0,
                countedQuantity: Number(it.quantity) || 0,
                cost: (it as any).cost || 0,
                status: 'controlled' as const
            }));

        if (listToExport.length === 0) {
            toast.warning("Sin datos", "No hay productos en la sesión para exportar.");
            return;
        }

        ReportExporter.exportToExcel(listToExport as any, labName || 'Inventario', branchName || user?.branchName || 'Sucursal');
        toast.success("Reporte descargado", "El reporte Excel se generó correctamente.");
    };

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
        setIsAdminPurging(true);
        try {
            const result = (await cyclicInventoryService.adminPurgeLabInventory(
                branchName,
                labName,
                'pistacho',
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
        const pendingDataStr = sessionStorage.getItem('pending_electron_excel');
        if (pendingDataStr) {
            try {
                const data = JSON.parse(pendingDataStr);
                const fileLabName = data.rows?.[1] ? String(data.rows[1][14] || '').trim() : '';
                
                if (fileLabName.toUpperCase() === labName.toUpperCase()) {
                    handleElectronImport(data);
                    sessionStorage.removeItem('pending_electron_excel');
                }
            } catch (e) {
                console.error("Error al procesar datos pendientes de Electron", e);
            }
        }

        if ((window as any).electronAPI) {
            const cleanup = (window as any).electronAPI.onExcelData((data: any) => {
                const rows = data.rows || [];
                const fileLabName = rows[1] ? String(rows[1][14] || '').trim() : '';
                
                if (fileLabName.toUpperCase() === labName.toUpperCase()) {
                    handleElectronImport(data);
                } else if (fileLabName) {
                    toast.info("Cambio de Laboratorio", `El archivo es de ${fileLabName}. Redirigiendo...`);
                    sessionStorage.setItem('pending_electron_excel', JSON.stringify(data));
                    navigate(`/inventario-ciclico/${encodeURIComponent(fileLabName)}`);
                }
            });

            return cleanup;
        }
    }, [labName, handleElectronImport, navigate]);

    return (
        <div className="w-full h-full flex flex-col overflow-hidden p-4 lg:p-6 bg-transparent">
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
                    {/* Main View */}
                    <div className="flex flex-col gap-3 flex-1 min-h-0 w-full">
                        {/* Main Content */}
                        <div className="w-full flex-1 flex flex-col min-h-0">
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

                            <Tabs value={mainTab} onValueChange={setMainTab} className="w-full flex-1 flex flex-col min-h-0">
                                {/* Fila superior: Tabs a la izquierda y Título/Info al fondo a la derecha */}
                                <div className="flex items-center justify-between gap-3 mb-2.5 shrink-0">
                                    <TabsList>
                                        <TabItem value="productos" label="Productos" />
                                        <TabItem 
                                            value="resumen" 
                                            label="Resumen" 
                                            disabled 
                                            className="opacity-40 grayscale cursor-not-allowed pointer-events-none" 
                                        />
                                        <TabItem value="archivos" label="Archivos" />
                                        <TabItem value="monitor" label="Monitor" />
                                        <TabItem value="configuracion" label="Configuración" />
                                    </TabsList>

                                    {/* Al fondo a la derecha: Título de inventario y subtítulo en la misma línea de los tabs */}
                                    <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
                                        <h1 className="sr-only">
                                            {displayTitle} - Control de inventario nocturno
                                        </h1>
                                        <span
                                            title={labName}
                                            className="text-[13px] text-muted-foreground font-normal max-w-[280px] sm:max-w-[420px] truncate"
                                            style={{ fontVariationSettings: fontWeights.normal }}
                                        >
                                            {displayTitle}
                                        </span>
                                        <span className="text-muted-foreground/50 text-xs select-none">·</span>
                                        <span
                                            className="text-[13px] text-foreground font-semibold whitespace-nowrap"
                                            style={{ fontVariationSettings: fontWeights.semibold }}
                                        >
                                            Control de inventario nocturno.
                                        </span>
                                        {isReadOnly && (
                                            <Badge variant="outline" className="border-amber-200 bg-amber-50/50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-400 font-bold rounded-lg text-[11px] px-2 py-0.5 whitespace-nowrap">
                                                Historial (Vuelta {round})
                                            </Badge>
                                        )}

                                        {/* Divisor sutil y 3 botones de icono sin acciones */}
                                        <div className="h-4 w-px bg-border/60 mx-1" />
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Button
                                                variant="tertiary"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80"
                                            >
                                                <Search className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="tertiary"
                                                size="icon"
                                                onClick={() => {
                                                    window.dispatchEvent(new CustomEvent('precount:item_scanned'));
                                                    window.dispatchEvent(new CustomEvent('precount:device_heartbeat'));
                                                    toast.info("Actualizando datos", "Consultando últimos registros del servidor...");
                                                }}
                                                title="Actualizar datos"
                                                className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                            >
                                                <RotateCcw className="size-3.5" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownTrigger
                                                    render={(props) => (
                                                        <Button
                                                            {...props}
                                                            variant="tertiary"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                                            title="Opciones de base local y exportación"
                                                        >
                                                            <EllipsisIcon className="size-3.5" />
                                                        </Button>
                                                    )}
                                                />
                                                <DropdownContent align="end" className="w-56">
                                                    <MenuItem
                                                        index={0}
                                                        icon={ClipboardList}
                                                        label="Sesiones abiertas"
                                                        onSelect={() => setShowOpenSessionsModal(true)}
                                                    />
                                                    <DropdownSeparator />
                                                    <MenuItem
                                                        index={1}
                                                        icon={Download}
                                                        label="Descargar reporte EXCEL"
                                                        onSelect={handleExportExcel}
                                                    />
                                                </DropdownContent>
                                            </DropdownMenu>
                                        </div>
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
                                                        className="h-7 w-7 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm flex-shrink-0"
                                                        onClick={() => setShowAdminPurgeModal(true)}
                                                        title="Eliminación Administrativa (Crítico)"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </Button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                <TabPanel value="productos" className="flex-1 min-h-0 pt-2 w-full flex flex-col">
                                    <PreCountProductsView
                                        sessionId={sessionId}
                                        onItemsChange={setScannedTableItems}
                                        visibleColumns={visibleColumns}
                                        addProductTrigger={addProductTrigger}
                                        className="flex-1 min-h-0"
                                        actions={({ selectedCount, onDeleteSelected, canRestore, onRestoreDeleted }) => (
                                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                                {/* Botón Agregar Producto a la Tabla */}
                                                <Button
                                                    variant="tertiary"
                                                    size="icon"
                                                    onClick={() => {
                                                        setAddProductTrigger(prev => prev + 1);
                                                    }}
                                                    aria-label="Agregar Producto"
                                                    title="Agregar Producto"
                                                    className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                                >
                                                    <HugeiconsIcon icon={PackageAdd01Icon as any} size={15} strokeWidth={1.8} />
                                                </Button>

                                                {/* Botón Eliminar Producto(s) Seleccionado(s) */}
                                                <Button
                                                    variant="tertiary"
                                                    size="icon"
                                                    disabled={selectedCount === 0}
                                                    onClick={onDeleteSelected}
                                                    aria-label="Eliminar Productos Seleccionados"
                                                    title={selectedCount > 0 ? `Eliminar (${selectedCount}) seleccionados` : "Seleccionar al menos un producto para eliminar"}
                                                    className={cn(
                                                        "h-8 w-8 rounded-lg border transition-all duration-80",
                                                        selectedCount > 0
                                                            ? "border-border bg-transparent hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 text-muted-foreground cursor-pointer"
                                                            : "border-border/40 bg-transparent text-muted-foreground/30 opacity-40 cursor-not-allowed pointer-events-none"
                                                    )}
                                                >
                                                    <HugeiconsIcon icon={Delete01Icon as any} size={15} strokeWidth={1.8} />
                                                </Button>

                                                {/* Botón Recuperar Productos Eliminados */}
                                                <Button
                                                    variant="tertiary"
                                                    size="icon"
                                                    disabled={!canRestore}
                                                    onClick={onRestoreDeleted}
                                                    aria-label="Recuperar Productos Eliminados"
                                                    title={canRestore ? "Recuperar productos eliminados" : "No hay productos para recuperar"}
                                                    className={cn(
                                                        "h-8 w-8 rounded-lg border transition-all duration-80",
                                                        canRestore
                                                            ? "border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground cursor-pointer"
                                                            : "border-border/40 bg-transparent text-muted-foreground/30 opacity-40 cursor-not-allowed pointer-events-none"
                                                    )}
                                                >
                                                    <HugeiconsIcon icon={DeletePutBackIcon as any} size={15} strokeWidth={1.8} />
                                                </Button>


                                                {/* Botón Solo Diferencias */}
                                                <Button
                                                    variant="tertiary"
                                                    size="icon"
                                                    onClick={() => setShowDifferencesOnly(!showDifferencesOnly)}
                                                    active={showDifferencesOnly}
                                                    aria-label="Solo Diferencias"
                                                    title="Solo Diferencias"
                                                    className={cn(
                                                        "h-8 w-8 rounded-lg border transition-all duration-80",
                                                        showDifferencesOnly
                                                            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                                            : "border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    <DiffIcon className="size-3.5" />
                                                </Button>

                                                {/* Botón Transmitir a Plex (Carga API) */}
                                                <Button
                                                    variant="tertiary"
                                                    size="icon"
                                                    onClick={() => setShowPlexApiModal(true)}
                                                    aria-label="Enviar productos a Plex (Carga API)"
                                                    title="Enviar productos a Plex (Carga API)"
                                                    className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                                >
                                                    <Upload className="size-3.5" />
                                                </Button>

                                                {/* Botón Filtros (Abre Dialog) */}
                                                <Button 
                                                    variant="tertiary" 
                                                    size="icon" 
                                                    onClick={() => setIsFilterDialogOpen(true)}
                                                    aria-label="Filtros"
                                                    title="Filtros"
                                                    className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80"
                                                >
                                                    <Filter className="size-3.5" />
                                                </Button>

                                                {/* Finalizar Button / Admin Save Changes */}
                                                {isAdminEditActive ? (
                                                    <div className="flex gap-1.5 ml-1 shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            onClick={handleCancelAdminEdit}
                                                            disabled={isSaving}
                                                            className="bg-surface-2 shadow-surface-2 text-muted-foreground hover:text-foreground rounded-lg h-8 px-3 font-semibold text-xs transition-all duration-80"
                                                        >
                                                            Cancelar Edición
                                                        </Button>
                                                        <Button
                                                            onClick={handleSaveAdminEdit}
                                                            disabled={isSaving}
                                                            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs rounded-lg h-8 px-3 flex items-center gap-1.5 font-semibold text-xs whitespace-nowrap"
                                                        >
                                                            <CheckCircle size={14} className="shrink-0" />
                                                            Guardar Cambios (Admin)
                                                        </Button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    />
                                </TabPanel>

                                <TabPanel value="resumen" className="flex-1 min-h-0 pt-2 w-full flex flex-col">
                                    <PreCountSummaryView />
                                </TabPanel>

                                <TabPanel value="archivos" className="flex-1 min-h-0 pt-2 w-full flex flex-col">
                                    <PreCountFilesView key="precount-files-view" sessionId={sessionId} />
                                </TabPanel>

                                <TabPanel value="monitor" className="flex-1 min-h-0 pt-2 w-full flex flex-col">
                                    <DeviceMonitorView key={sessionId || 'no-session'} sessionId={sessionId} />
                                </TabPanel>

                                <TabPanel value="configuracion" className="flex-1 min-h-0 pt-2 w-full flex flex-col">
                                    <PreCountConfigView
                                        sessionId={sessionId}
                                        onSessionCreated={(newSession) => {
                                            setActiveTab("productos");
                                            if (onResumeSession) {
                                                onResumeSession(newSession);
                                            }
                                        }}
                                    />
                                </TabPanel>
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
                                        {totalControlledArticles} {totalControlledArticles === 1 ? 'Artículo Controlado' : 'Artículos Controlados'}
                                    </span>
                                </div>
                             </div>
                        </div>

                        {/* Block 2 — Ajustes de inventario */}
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
                                                                    {stat.controlledArticles} {stat.controlledArticles === 1 ? 'Artículo Controlado' : 'Artículos Controlados'}
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


            {/* Modal de Filtros (Recuadro cuadrado adaptivo) */}
            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                <DialogContent
                    size="sm"
                    className="w-[90vw] max-w-[420px] aspect-square flex flex-col justify-between p-6"
                >
                    <DialogHeader>
                        <DialogTitle>Columnas visibles</DialogTitle>
                        <DialogDescription>
                            Seleccioná las columnas que querés mostrar en la tabla.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 my-auto flex flex-col items-center justify-center w-full py-2 overflow-y-auto">
                        <CheckboxGroup checkedIndices={checkedColumns} className="w-full max-w-[280px]">
                            {TABLE_COLUMNS_CONFIG.map((col, i) => (
                                <CheckboxItem
                                    key={col.key}
                                    index={i}
                                    label={col.label}
                                    checked={checkedColumns.has(i)}
                                    onToggle={() => {
                                        setCheckedColumns((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(i)) {
                                                if (next.size > 1) next.delete(i);
                                            } else {
                                                next.add(i);
                                            }
                                            return next;
                                        });
                                    }}
                                />
                            ))}
                        </CheckboxGroup>
                    </div>

                    <DialogFooter className="mt-auto pt-4 border-t border-border/40">
                        <DialogClose nativeButton={false} render={<Button type="button" variant="ghost" />}>
                            Cerrar
                        </DialogClose>
                    </DialogFooter>
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

            {/* Modal de Transmisión a Plex por API (Perfil Admin) */}
            <SendPlexApiDialog
                open={showPlexApiModal}
                onOpenChange={setShowPlexApiModal}
                inventoryTitle={displayTitle}
                sectorOrLab={labName || 'General'}
                items={scannedTableItems.length > 0
                    ? scannedTableItems.map(it => ({
                        id: it.id,
                        id_producto: (it as any).id_producto,
                        ean: it.ean,
                        productName: it.productName || (it as any).name,
                        quantity: Number(it.quantity) || 1,
                        laboratory: it.laboratory || labName,
                        rubro: it.rubro || (it as any).category,
                        sector: it.sector || labName
                    }))
                    : undefined
                }
                sessionId={sessionId}
            />

            {/* Modal Visualizador de Sesiones Abiertas */}
            <OpenSessionsDialog
                open={showOpenSessionsModal}
                onOpenChange={setShowOpenSessionsModal}
                branchName={undefined}
                branchId={user?.role === 'admin' ? undefined : user?.branchId}
                onResumeSession={onResumeSession}
                onDeleteSession={onDeleteSession}
            />

        </div>
    );
}

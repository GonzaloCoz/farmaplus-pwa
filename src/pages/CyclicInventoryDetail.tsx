import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from "motion/react";
import { spring } from "@/lib/springs";
import { Button, buttonVariants } from '@/components/ui/button';
import { Group, GroupSeparator } from '@/components/ui/group';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabItem } from "@/components/ui/tabs";
import { TabsSubtle, TabsSubtleItem, TabsSubtlePanel } from "@/components/ui/tabs-subtle";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Toolbar } from "@/components/ui/toolbar";
import { Elevated } from "@/lib/elevated";
import { typeClass } from "@/lib/type-scale";
import { Upload01 as Upload, SearchLg as Search, InfoCircle as Info, RefreshCw01 as Loader2, CheckCircle, RefreshCw01 as RotateCcw, CurrencyDollar as Dollar, Clipboard as ClipboardList, ChevronLeft as ArrowLeft, FilterFunnel02 as Filter, DotsHorizontal as MoreVertical, ClipboardX as DiffIcon, AlertTriangle, Download01 as Download, Edit01 as Pen, RefreshCw01 as Refresh, ArrowUpRight, ArrowDownRight, TrendUp01 as TrendingUp, FileSearch02, Plus } from '@untitledui/icons';
import { RefreshCw as LucideRefreshCw, Activity } from 'lucide-react';
import { HugeiconsIcon } from "@hugeicons/react";
import CloudIcon from "@hugeicons/core-free-icons/CloudIcon";
import CloudDownloadIcon from "@hugeicons/core-free-icons/CloudDownloadIcon";
import CloudAlertIcon from "@hugeicons/core-free-icons/CloudAlertIcon";
import CloudCheckIcon from "@hugeicons/core-free-icons/CloudCheckIcon";
import CloudOffIcon from "@hugeicons/core-free-icons/CloudOffIcon";
import Xls01Icon from "@hugeicons/core-free-icons/Xls01Icon";
import Pdf01Icon from "@hugeicons/core-free-icons/Pdf01Icon";
import ShieldCheckIcon from "@hugeicons/core-free-icons/ShieldCheckIcon";
import ShieldXIcon from "@hugeicons/core-free-icons/ShieldXIcon";
import ShieldOffIcon from "@hugeicons/core-free-icons/ShieldOffIcon";
import PrinterIcon from "@hugeicons/core-free-icons/PrinterIcon";
import ArrowExpandIcon from "@hugeicons/core-free-icons/ArrowExpandIcon";
import ArrowShrinkIcon from "@hugeicons/core-free-icons/ArrowShrinkIcon";
import CleanIcon from "@hugeicons/core-free-icons/CleanIcon";

function AnimatedCloudDownloadIcon({ size = 15, strokeWidth = 1.8, className }: { size?: number; strokeWidth?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Contorno de la nube estático */}
            <path
                d="M17.4776 9.01106C17.485 9.01102 17.4925 9.01101 17.5 9.01101C19.9853 9.01101 22 11.0294 22 13.5193C22 15.8398 20.25 17.7508 18 18M17.4776 9.01106C17.4924 8.84606 17.5 8.67896 17.5 8.51009C17.5 5.46695 15.0376 3 12 3C9.12324 3 6.76233 5.21267 6.52042 8.03192M17.4776 9.01106C17.3753 10.1476 16.9286 11.1846 16.2428 12.0165M6.52042 8.03192C3.98398 8.27373 2 10.4139 2 13.0183C2 15.4417 3.71776 17.4632 6 17.9273M6.52042 8.03192C6.67826 8.01687 6.83823 8.00917 7 8.00917C8.12582 8.00917 9.16474 8.38194 10.0005 9.01101"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Flecha interior con deslizamiento sutil hacia abajo */}
            <motion.path
                d="M12 21L12 13M12 21C11.2998 21 9.99153 19.0057 9.5 18.5M12 21C12.7002 21 14.0085 19.0057 14.5 18.5"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ y: [0, 2, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            />
        </svg>
    );
}
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
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
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
import { useUser } from '@/contexts/UserContext';
import { Trash01 as TrashIcon } from '@untitledui/icons';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { notify as toast } from '@/lib/notifications';
import { usePlexSession } from '@/hooks/usePlexSession';
import { executePlexCyclicAdjustments, getNextPlexAdjustmentIds, isTauriEnvironment } from '@/services/mysqlTauriBridge';
import { useLayout } from '@/contexts/LayoutContext';
import { useSystemModules } from '@/hooks/useSystemModules';
import { Tooltip } from '@/components/ui/tooltip';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

export default function CyclicInventoryDetail() {
    const { modules } = useSystemModules();
    const isStockSyncDisabled = !modules.stockSyncServer;
    const { id } = useParams(); // This will be the Lab Name
    const labName = id ? decodeURIComponent(id) : '';
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const roundParam = searchParams.get('round');
    const round = roundParam ? Number(roundParam) : undefined;
    const isReadOnly = round !== undefined;

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
        setItems,
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
        mysqlSyncStatus,
        setMysqlSyncStatus,
        hasNewSkuAlert,
        setHasNewSkuAlert,
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
        requiresStockRefresh,
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

    // Integración de Sesión en tiempo real con Plex 25 (solo escritorio Tauri)
    const isTauri = isTauriEnvironment();
    const {
        session: plexSession,
        operators: plexOperators,
        selectedOperator,
        setSelectedOperator,
        isLoadingOperators,
        isAuthorized,
        refresh: refreshPlex
    } = usePlexSession(branchName);

    const plexConnectionStatus = useMemo<'connected' | 'out_of_service' | 'disconnected'>(() => {
        if (!plexSession.running) return 'disconnected';
        if (!plexSession.logged_in) return 'out_of_service';
        return 'connected';
    }, [plexSession.running, plexSession.logged_in]);

    const { setIsSidebarCollapsed } = useLayout();
    const [isAutoAdjusting, setIsAutoAdjusting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleToggleExpand = useCallback(() => {
        setIsExpanded(prev => {
            const next = !prev;
            setIsSidebarCollapsed(next);
            return next;
        });
    }, [setIsSidebarCollapsed]);

    useEffect(() => {
        return () => {
            setIsSidebarCollapsed(false);
        };
    }, [setIsSidebarCollapsed]);

    const [isLoadingNextAdjustmentIds, setIsLoadingNextAdjustmentIds] = useState(false);
    const [isPlexPreview, setIsPlexPreview] = useState(false);

    // Previsualización y escala de la hoja de impresión A4
    const a4ContainerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [a4Scale, setA4Scale] = useState(0.35);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [groupByFilter, setGroupByFilter] = useState("laboratorio");
    const [stockQuantityFilter, setStockQuantityFilter] = useState("no_filtrar");

    const filteredItemsCount = useMemo(() => {
        if (!items) return 0;
        let filtered = items;
        if (stockQuantityFilter === 'mayor_a') {
            filtered = filtered.filter(i => (i.systemQuantity ?? 0) > 0);
        } else if (stockQuantityFilter === 'menor_a') {
            filtered = filtered.filter(i => (i.systemQuantity ?? 0) <= 0);
        } else if (stockQuantityFilter === 'debajo_minimo') {
            filtered = filtered.filter(i => (i.minimo !== undefined && i.minimo > 0) && (i.systemQuantity ?? 0) < i.minimo);
        } else if (stockQuantityFilter === 'sin_minimo') {
            filtered = filtered.filter(i => !i.minimo || i.minimo === 0);
        } else if (stockQuantityFilter === 'encima_minimo') {
            filtered = filtered.filter(i => (i.minimo !== undefined && i.minimo > 0) && (i.systemQuantity ?? 0) >= i.minimo);
        }
        return filtered.length;
    }, [items, stockQuantityFilter]);

    const calculatedPages = useMemo(() => {
        const count = filteredItemsCount;
        if (count <= 48) return 1;
        return 1 + Math.ceil((count - 48) / 58);
    }, [filteredItemsCount]);

    useEffect(() => {
        setTotalPages(calculatedPages);
    }, [calculatedPages]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    useEffect(() => {
        if (!isPlexPreview) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsPlexPreview(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPlexPreview]);

    const handleIframeLoad = useCallback(() => {
        try {
            const doc = iframeRef.current?.contentDocument;
            if (doc) {
                const totalsRow = doc.querySelector('.totals-row');
                const table = doc.querySelector('.table-data');
                let contentBottom = 0;

                if (totalsRow) {
                    contentBottom = totalsRow.getBoundingClientRect().bottom;
                } else if (table) {
                    contentBottom = table.getBoundingClientRect().bottom;
                } else {
                    contentBottom = doc.body.getBoundingClientRect().height;
                }

                if (contentBottom > 0) {
                    if (contentBottom <= 1060) {
                        setTotalPages(1);
                    } else {
                        const exactPages = Math.max(1, Math.ceil(contentBottom / 1123));
                        setTotalPages(exactPages);
                    }
                }
            }
        } catch {
            // fallback
        }
    }, []);

    useEffect(() => {
        const el = a4ContainerRef.current;
        if (!el) return;

        const updateScale = () => {
            if (el.clientHeight > 0) {
                setA4Scale(el.clientHeight / 1123);
            }
        };

        updateScale();
        const observer = new ResizeObserver(updateScale);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const fechaImpresion = useMemo(() => {
        return format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    }, []);

    const reportHtml = useMemo(() => {
        return ReportExporter.getReportHTML(items || [], labName, branchName, {
            groupBy: groupByFilter,
            stockFilter: stockQuantityFilter,
        });
    }, [items, labName, branchName, groupByFilter, stockQuantityFilter]);

    // Captura automática de los próximos IDs de ajuste de Plex al abrir el diálogo
    useEffect(() => {
        if (!showSaveDialog) {
            setIsPlexPreview(false);
            return;
        }

        const hasShortage = shortageValue !== 0;
        const hasSurplus = surplusValue !== 0;

        if (!hasShortage && !hasSurplus) return;

        let isMounted = true;
        setIsLoadingNextAdjustmentIds(true);

        getNextPlexAdjustmentIds(branchName, hasShortage, hasSurplus)
            .then(res => {
                if (!isMounted) return;
                let previewed = false;
                if (hasShortage && res.next_shortage_id) {
                    setShortageId(String(res.next_shortage_id));
                    previewed = true;
                }
                if (hasSurplus && res.next_surplus_id) {
                    setSurplusId(String(res.next_surplus_id));
                    previewed = true;
                }
                if (previewed) {
                    setIsPlexPreview(true);
                }
            })
            .catch(err => {
                console.warn("No se pudieron pre-capturar los próximos IDs de Plex:", err);
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingNextAdjustmentIds(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [showSaveDialog, shortageValue, surplusValue, branchName, setShortageId, setSurplusId]);

    const handleConfirmAndFinalize = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const hasShortage = shortageValue !== 0;
        const hasSurplus = surplusValue !== 0;

        // Si no hay diferencias para ajustar, guardamos directamente
        if (!hasShortage && !hasSurplus) {
            await handleSaveInventory();
            return;
        }

        const canImpactPlexDirectly = plexSession.running && plexSession.logged_in;

        if (canImpactPlexDirectly) {
            if (!selectedOperator?.id_usuario || !selectedOperator.is_authorized) {
                toast.error("Firma requerida", "Seleccione un encargado o subencargado autorizado para firmar el ajuste en Plex.");
                return;
            }

            const controlledItems = items.filter(i => i.status === 'controlled');
            const shortages = controlledItems
                .filter(i => i.countedQuantity < i.systemQuantity)
                .map(i => ({
                    id_producto: i.id_producto,
                    ean: i.ean,
                    quantity: Math.abs(i.countedQuantity - i.systemQuantity)
                }));
            const surpluses = controlledItems
                .filter(i => i.countedQuantity > i.systemQuantity)
                .map(i => ({
                    id_producto: i.id_producto,
                    ean: i.ean,
                    quantity: i.countedQuantity - i.systemQuantity
                }));

            setIsAutoAdjusting(true);
            try {
                const res = await executePlexCyclicAdjustments(
                    branchName,
                    selectedOperator.id_usuario,
                    selectedOperator.user_name,
                    labName,
                    shortages,
                    surpluses
                );

                if (!res.success) {
                    toast.error("Error al impactar en Plex", res.message);
                    return;
                }

                toast.success("Impactado en Plex", res.message);
                const finalShortageId = res.baja_id ? String(res.baja_id) : shortageId;
                const finalSurplusId = res.alta_id ? String(res.alta_id) : surplusId;

                await handleSaveInventory(finalShortageId, finalSurplusId);
            } catch (err: any) {
                console.error("Error al impactar en Plex y guardar:", err);
                toast.error("Error de impacto", err?.message || "No se pudo conectar con Plex.");
            } finally {
                setIsAutoAdjusting(false);
            }
        } else {
            // Flujo estándar / manual si Plex no está activo en esta terminal
            await handleSaveInventory(shortageId, surplusId);
        }
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
        <PageLayout className={cn(
            "transition-all duration-300 max-w-none",
            isExpanded
                ? "p-0 sm:p-0 lg:p-0 pt-0 sm:pt-0 lg:pt-0.5 px-1.5 sm:px-2.5 lg:px-3 pb-3 space-y-0"
                : "pt-3 pb-32 lg:pb-10 px-4 lg:px-6 space-y-4 lg:space-y-6"
        )}>
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
                        <AnimatePresence initial={false}>
                            {!isExpanded && (
                                <motion.div
                                    key="lab-detail-header-row"
                                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                    animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="w-full shrink-0"
                                >
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
                                            {isTauri && (
                                            <Tooltip
                                                content={
                                                    plexConnectionStatus === 'connected'
                                                        ? `Plex 25 Conectado${plexSession.terminal ? ` (Terminal ${plexSession.terminal})` : ''}`
                                                        : plexConnectionStatus === 'out_of_service'
                                                            ? "Plex 25 Fuera de Servicio"
                                                            : "Plex 25 Desconectado"
                                                }
                                                side="top"
                                                sideOffset={6}
                                                className="font-semibold"
                                            >
                                                <Button
                                                    variant="tertiary"
                                                    size="icon"
                                                    onClick={() => refreshPlex()}
                                                    aria-label="Estado de conexión Plex 25"
                                                    className={cn(
                                                        "h-8 w-8 rounded-lg border transition-all duration-80 cursor-pointer",
                                                        plexConnectionStatus === 'connected' && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15",
                                                        plexConnectionStatus === 'out_of_service' && "border-amber-500/40 bg-amber-500/10 text-amber-500 dark:text-amber-400 hover:bg-amber-500/15",
                                                        plexConnectionStatus === 'disconnected' && "border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground"
                                                    )}
                                                >
                                                    {plexConnectionStatus === 'connected' && (
                                                        <HugeiconsIcon icon={ShieldCheckIcon} size={15} strokeWidth={1.8} className="text-emerald-600 dark:text-emerald-400 animate-in fade-in zoom-in-75 duration-200" />
                                                    )}
                                                    {plexConnectionStatus === 'out_of_service' && (
                                                        <HugeiconsIcon icon={ShieldOffIcon} size={15} strokeWidth={1.8} className="text-amber-500 dark:text-amber-400 animate-in fade-in zoom-in-75 duration-200" />
                                                    )}
                                                    {plexConnectionStatus === 'disconnected' && (
                                                        <HugeiconsIcon icon={ShieldXIcon} size={15} strokeWidth={1.8} className="text-muted-foreground hover:text-foreground transition-colors" />
                                                    )}
                                                </Button>
                                            </Tooltip>
                                            )}
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
                                                        <Tooltip
                                                            content="Eliminación Administrativa"
                                                            side="top"
                                                            sideOffset={6}
                                                            className="font-semibold"
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm flex-shrink-0 cursor-pointer"
                                                                onClick={() => setShowAdminPurgeModal(true)}
                                                                aria-label="Eliminación Administrativa"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </Button>
                                                        </Tooltip>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                                    {/* Botón Sincronizar desde Servidor Plex (MySQL) con Tooltip de Fluid */}
                                    <Tooltip
                                        content={
                                            isStockSyncDisabled
                                                ? "Acceso Bloqueado"
                                                : requiresStockRefresh
                                                    ? "Sincronizar Stock (Requerido)"
                                                    : mysqlSyncStatus === 'loading'
                                                        ? "Sincronizando Stock..."
                                                        : mysqlSyncStatus === 'error'
                                                            ? "Alerta de Fallo"
                                                            : mysqlSyncStatus === 'success'
                                                                ? "Sincronización Exitosa"
                                                                : hasNewSkuAlert
                                                                    ? "Nuevo SKU Detectado"
                                                                    : "Sincronizar Stock"
                                        }
                                        side="top"
                                        sideOffset={6}
                                        className="font-semibold"
                                    >
                                        <Button
                                            variant="tertiary"
                                            size="icon"
                                            onClick={() => {
                                                if (isStockSyncDisabled) {
                                                    toast.info("Función no disponible", "Esta función no se encuentra disponible.");
                                                    return;
                                                }
                                                handleMysqlSync();
                                            }}
                                            disabled={isUploading || isSaving || (isSyncingMysql && !isStockSyncDisabled)}
                                            aria-label="Sincronizar existencias desde servidor"
                                            className={cn(
                                                "h-8 w-8 rounded-lg border bg-transparent transition-all duration-80 cursor-pointer",
                                                isStockSyncDisabled && "border-destructive/30 bg-destructive/10 text-destructive/80 hover:bg-destructive/15",
                                                !isStockSyncDisabled && mysqlSyncStatus === 'idle' && (
                                                    requiresStockRefresh
                                                        ? "border-amber-500/60 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                                                        : hasNewSkuAlert
                                                            ? "border-[var(--cloud-sku-alert-border)] bg-[var(--cloud-sku-alert-bg)] text-[var(--cloud-sku-alert)] hover:bg-[var(--cloud-sku-alert-hover)]"
                                                            : "border-border hover:bg-hover text-muted-foreground hover:text-foreground"
                                                ),
                                                !isStockSyncDisabled && mysqlSyncStatus === 'loading' && "border-primary/40 bg-primary/10 text-primary",
                                                !isStockSyncDisabled && mysqlSyncStatus === 'error' && "border-[var(--cloud-conn-alert-border)] bg-[var(--cloud-conn-alert-bg)] text-[var(--cloud-conn-alert)] hover:bg-[var(--cloud-conn-alert-hover)]",
                                                !isStockSyncDisabled && mysqlSyncStatus === 'success' && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
                                            )}
                                        >
                                            {isStockSyncDisabled ? (
                                                <HugeiconsIcon icon={CloudOffIcon} size={15} strokeWidth={1.8} className="text-destructive/80" />
                                            ) : (
                                                <>
                                                    {mysqlSyncStatus === 'loading' && (
                                                        <AnimatedCloudDownloadIcon size={15} strokeWidth={1.8} className="text-primary" />
                                                    )}
                                                    {mysqlSyncStatus === 'error' && (
                                                        <HugeiconsIcon icon={CloudAlertIcon} size={15} strokeWidth={1.8} className="text-[var(--cloud-conn-alert)]" />
                                                    )}
                                                    {mysqlSyncStatus === 'success' && (
                                                        <HugeiconsIcon icon={CloudCheckIcon} size={15} strokeWidth={1.8} className="text-emerald-600 dark:text-emerald-400" />
                                                    )}
                                                    {mysqlSyncStatus === 'idle' && (
                                                        hasNewSkuAlert ? (
                                                            <HugeiconsIcon icon={CloudAlertIcon} size={15} strokeWidth={1.8} className="text-[var(--cloud-sku-alert)]" />
                                                        ) : (
                                                            <HugeiconsIcon icon={CloudIcon} size={15} strokeWidth={1.8} className="text-muted-foreground hover:text-foreground transition-colors" />
                                                        )
                                                    )}
                                                </>
                                            )}
                                        </Button>
                                    </Tooltip>

                                    {/* Botón Cargar Archivo Excel */}
                                    <Tooltip content="Cargar Excel" side="top" sideOffset={6} className="font-semibold">
                                        <Button
                                            variant="tertiary"
                                            size="icon"
                                            onClick={() => document.getElementById('inventory-upload-hidden')?.click()}
                                            disabled={isUploading || isSaving || isSyncingMysql}
                                            aria-label="Cargar Archivo Excel"
                                            className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                        >
                                            <HugeiconsIcon icon={Xls01Icon} size={16} strokeWidth={1.8} />
                                        </Button>
                                    </Tooltip>

                                    {/* Dropdown Ordenar */}
                                    <DropdownMenu>
                                        <Tooltip content="Ordenar Productos" side="top" sideOffset={6} className="font-semibold">
                                            <DropdownTrigger render={
                                                <Button
                                                    variant="tertiary"
                                                    size="icon"
                                                    aria-label="Ordenar"
                                                    className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                                >
                                                    <Filter className="size-3.5" />
                                                </Button>
                                            } />
                                        </Tooltip>
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

                                    {/* Botón Imprimir Tabla / Previsualizar Listado */}
                                    <Tooltip content={isPlexPreview ? "Cerrar Previsualización" : "Previsualizar Listado"} side="top" sideOffset={6} className="font-semibold">
                                        <Button
                                            variant="tertiary"
                                            size="icon"
                                            onClick={() => setIsPlexPreview(prev => !prev)}
                                            aria-label="Previsualizar Listado"
                                            className={cn(
                                                "h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer",
                                                isPlexPreview && "bg-muted text-foreground border-primary/40 shadow-xs"
                                            )}
                                        >
                                            <HugeiconsIcon icon={PrinterIcon} size={16} strokeWidth={1.8} />
                                        </Button>
                                    </Tooltip>

                                    {/* Botón Expandir / Contraer */}
                                    <Tooltip content={isExpanded ? "Contraer Vista" : "Pantalla Completa"} side="top" sideOffset={6} className="font-semibold">
                                        <Button
                                            variant="tertiary"
                                            size="icon"
                                            onClick={handleToggleExpand}
                                            aria-label={isExpanded ? "Contraer" : "Expandir"}
                                            className={cn(
                                                "h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer",
                                                isExpanded && "bg-muted text-foreground border-primary/40 shadow-xs"
                                            )}
                                        >
                                            <HugeiconsIcon icon={isExpanded ? ArrowShrinkIcon : ArrowExpandIcon} size={16} strokeWidth={1.8} />
                                        </Button>
                                    </Tooltip>

                                    {/* Dropdown Más Acciones */}
                                    <DropdownMenu>
                                        <Tooltip content="Más Opciones" side="top" sideOffset={6} className="font-semibold">
                                            <DropdownTrigger render={
                                                <Button
                                                    variant="tertiary"
                                                    size="icon"
                                                    aria-label="Más Acciones"
                                                    className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                                >
                                                    <MoreVertical className="size-3.5" />
                                                </Button>
                                            } />
                                        </Tooltip>
                                        <DropdownContent align="end" className="w-56">
                                            {(() => {
                                                let itemIndex = 0;
                                                return (
                                                    <>
                                                        <DropdownLabel>Reportes</DropdownLabel>
                                                        <MenuItem
                                                            index={itemIndex++}
                                                            icon={(props) => <HugeiconsIcon icon={Pdf01Icon} {...props} />}
                                                            label="Descargar reporte PDF"
                                                            onSelect={() => ReportExporter.exportToPDF(items, labName, branchName)}
                                                        />
                                                        <MenuItem
                                                            index={itemIndex++}
                                                            icon={(props) => <HugeiconsIcon icon={Xls01Icon} {...props} />}
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
                                                                icon={(props) => <HugeiconsIcon icon={CleanIcon} {...props} />}
                                                                label="Borrar ajustes"
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
                                            <Tooltip content="Cancelar Edición" side="top" sideOffset={6} className="font-semibold">
                                                <Button
                                                    variant="ghost"
                                                    onClick={handleCancelAdminEdit}
                                                    disabled={isSaving}
                                                    className="h-8 px-3 rounded-lg font-semibold text-xs border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80"
                                                >
                                                    Cancelar Edición
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="Guardar Cambios" side="top" sideOffset={6} className="font-semibold">
                                                <Button
                                                    onClick={handleSaveAdminEdit}
                                                    disabled={isSaving}
                                                    className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs rounded-lg flex items-center gap-1.5 font-semibold text-xs whitespace-nowrap transition-all duration-80"
                                                >
                                                    <CheckCircle size={14} className="shrink-0" />
                                                    Guardar Cambios (Admin)
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    ) : !isReadOnly ? (
                                        <Tooltip
                                            content={
                                                pendingItems.length === 0 && controlledItems.length === 0 && adjustedItems.length === 0
                                                    ? "Sin conteos registrados"
                                                    : "Finalizar Inventario"
                                            }
                                            side="top"
                                            sideOffset={6}
                                            className="font-semibold"
                                        >
                                            <span className="inline-flex">
                                                <Button
                                                    onClick={handleFinalizeClick}
                                                    disabled={isSaving || (pendingItems.length === 0 && controlledItems.length === 0 && adjustedItems.length === 0)}
                                                    className="h-8 px-3.5 bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] shadow-xs rounded-lg font-semibold text-xs whitespace-nowrap ml-1 shrink-0 transition-all duration-80 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Finalizar
                                                </Button>
                                            </span>
                                        </Tooltip>
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
                                ? (requiresStockRefresh ? [] : getSortedItems(pendingItems))
                                : selectedTab === 1
                                    ? getSortedItems(controlledItems)
                                    : selectedTab === 2
                                        ? getSortedItems(adjustedItems)
                                        : [];

                            return (
                                <div className={cn("w-full", isExpanded ? "pb-2" : "pb-8")}>
                                    <TabsSubtlePanel index={0} selectedIndex={selectedTab} idPrefix="cyclic-status" className={cn(isExpanded ? "space-y-1 pt-0" : "space-y-4 pt-2")}>
                                        <CyclicInventoryList
                                            items={selectedTab === 0 ? activeTabItems : []}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={handleCheck}
                                            onBulkCheck={handleBulkCheck}
                                            isPending={true}
                                            tabType="pending"
                                            readOnly={isReadOnly}
                                            isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                            requiresStockRefresh={requiresStockRefresh}
                                            actions={cyclicActions}
                                            tabsSlot={statusTabs}
                                            isExpanded={isExpanded}
                                        />
                                    </TabsSubtlePanel>

                                    <TabsSubtlePanel index={1} selectedIndex={selectedTab} idPrefix="cyclic-status" className={cn(isExpanded ? "space-y-1 pt-0" : "space-y-4 pt-2")}>
                                        <CyclicInventoryList
                                            items={selectedTab === 1 ? activeTabItems : []}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={handleCheck}
                                            onBulkCheck={handleBulkCheck}
                                            onRevert={handleRevertItem}
                                            tabType="controlled"
                                            readOnly={isReadOnly}
                                            isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                            actions={cyclicActions}
                                            tabsSlot={statusTabs}
                                            isExpanded={isExpanded}
                                        />
                                    </TabsSubtlePanel>

                                    <TabsSubtlePanel index={2} selectedIndex={selectedTab} idPrefix="cyclic-status" className={cn(isExpanded ? "space-y-1 pt-0" : "space-y-4 pt-2")}>
                                        <CyclicInventoryList
                                            items={selectedTab === 2 ? activeTabItems : []}
                                            onUpdateQuantity={handleUpdateQuantity}
                                            onCheck={() => { }}
                                            onBulkCheck={handleBulkCheck}
                                            tabType="adjusted"
                                            readOnly={isReadOnly}
                                            isExcelUploaded={isExcelUploaded || isAdminEditActive}
                                            actions={cyclicActions}
                                            tabsSlot={statusTabs}
                                            isExpanded={isExpanded}
                                        />
                                    </TabsSubtlePanel>

                                    <TabsSubtlePanel index={3} selectedIndex={selectedTab} idPrefix="cyclic-status" className={cn(isExpanded ? "space-y-1 pt-0" : "space-y-4 pt-2")}>
                                        <div className="w-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 shadow-xs">
                                            <div className={cn(
                                                "w-full bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-2 sm:p-3 shadow-xs flex flex-col relative transition-all duration-300",
                                                isExpanded ? "min-h-[740px]" : "min-h-[560px]"
                                            )}>
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
                                                            height={isExpanded ? 700 : 520}
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
                        onSubmit={handleConfirmAndFinalize}
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
                            {/* Tarjeta de Sesión Plex en Tiempo Real (solo escritorio Tauri) */}
                            {isTauri && (
                            <div className={cn(
                                "p-3 rounded-xl border transition-all text-xs flex flex-col gap-2.5",
                                !plexSession.running
                                    ? "bg-muted/30 border-border/40 text-muted-foreground"
                                    : !plexSession.logged_in
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                            )}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn(
                                            "size-2 rounded-full shrink-0",
                                            !plexSession.running
                                                ? "bg-muted-foreground/40"
                                                : !plexSession.logged_in
                                                    ? "bg-amber-500 animate-pulse"
                                                    : "bg-emerald-500 shadow-xs"
                                        )} />
                                        <span className="font-semibold text-xs tracking-tight truncate">
                                            {!plexSession.running
                                                ? "Plex 25 no detectado en esta PC"
                                                : !plexSession.logged_in
                                                    ? `Plex 25 Bloqueado (${plexSession.screen || 'Pase su credencial'})`
                                                    : "Plex 25 Conectado y Autenticado"}
                                        </span>
                                    </div>
                                    {plexSession.terminal && (
                                        <span className="text-[10px] font-mono text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded border border-border/30 shrink-0">
                                            Term. {plexSession.terminal}
                                        </span>
                                    )}
                                </div>

                                {/* Banner explicativo si Plex está en pantalla de credencial / bloqueo */}
                                {plexSession.running && !plexSession.logged_in && (
                                    <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 leading-snug">
                                        Plex se encuentra en la pantalla de credencial o bloqueado. Ingrese su usuario y clave en Plex para habilitar el impacto de inventario.
                                    </div>
                                )}

                                {/* Selector de Operador de Inventario (Encargado/Subencargado) */}
                                <div className="flex flex-col gap-1 pt-0.5">
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                        <span>Firma del Ajuste:</span>
                                        {isLoadingOperators && (
                                            <span className="text-[10px] flex items-center gap-1 text-primary">
                                                <Loader2 className="size-2.5 animate-spin" /> Cargando...
                                            </span>
                                        )}
                                    </div>
                                    <select
                                        value={selectedOperator?.id_usuario ? String(selectedOperator.id_usuario) : ''}
                                        onChange={(e) => {
                                            const chosen = plexOperators.find(o => String(o.id_usuario) === e.target.value);
                                            setSelectedOperator(chosen || null);
                                        }}
                                        disabled={!plexSession.logged_in || isLoadingOperators || plexOperators.length === 0}
                                        className="w-full h-8 px-2.5 text-xs bg-background/90 dark:bg-zinc-800 border border-border/60 rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:outline-none shadow-2xs font-medium cursor-pointer disabled:opacity-50"
                                    >
                                        {plexOperators.length === 0 ? (
                                            <option value="">No se encontraron encargados</option>
                                        ) : (
                                            plexOperators.map(op => (
                                                <option key={op.id_usuario} value={String(op.id_usuario)}>
                                                    {op.full_name || op.user_name} ({op.profile || 'Autorizado'})
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                {plexSession.running && plexSession.logged_in && selectedOperator && (shortageValue !== 0 || surplusValue !== 0) && (
                                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-emerald-500/20">
                                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium min-w-0">
                                            <CheckCircle className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                            <span className="truncate">Impacto directo activo: se grabará en Plex al confirmar</span>
                                        </div>
                                        {isPlexPreview && (
                                            <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                                                IDs previsualizados
                                            </span>
                                        )}
                                    </div>
                                )}
                                {!plexSession.running && (
                                    <p className="text-[10px] text-muted-foreground italic pt-0.5">
                                        Abra Plex 25 en esta terminal para habilitar el impacto directo.
                                    </p>
                                )}
                            </div>
                            )}

                            {/* Sección Ajustes de inventario */}
                            <div className="flex flex-col gap-2">
                                <div className="px-3 py-1.5 rounded-lg bg-hover font-semibold text-xs text-foreground select-none flex items-center justify-between">
                                    <span>Ajustes de inventario</span>
                                    {isLoadingNextAdjustmentIds && (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-normal">
                                            <Loader2 className="size-2.5 animate-spin text-primary" />
                                            Capturando próximos IDs de Plex...
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-3 pt-1">
                                    {/* Item 1: Faltantes */}
                                    <div className="flex items-center justify-between gap-4 pb-3 border-b border-border/20 last:border-b-0 last:pb-0">
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={shortageId}
                                                onChange={(e) => {
                                                    setShortageId(e.target.value);
                                                    setIsPlexPreview(false);
                                                }}
                                                placeholder={shortageValue === 0 ? "Sin diferencias" : "Ingresar ID de Ajuste"}
                                                disabled={shortageValue === 0 || isLoadingNextAdjustmentIds}
                                                className="w-full h-9 px-3 pr-24 text-sm font-medium bg-background border border-border/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 text-foreground placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground/60 tabular-nums transition-all shadow-xs disabled:opacity-40 disabled:bg-muted/10 disabled:cursor-not-allowed"
                                            />
                                            {isPlexPreview && shortageId && shortageValue !== 0 && (
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 pointer-events-none select-none">
                                                    Plex Preview
                                                </span>
                                            )}
                                        </div>
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
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={surplusId}
                                                onChange={(e) => {
                                                    setSurplusId(e.target.value);
                                                    setIsPlexPreview(false);
                                                }}
                                                placeholder={surplusValue === 0 ? "Sin diferencias" : "Ingresar ID de Ajuste"}
                                                disabled={surplusValue === 0 || isLoadingNextAdjustmentIds}
                                                className="w-full h-9 px-3 pr-24 text-sm font-medium bg-background border border-border/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 text-foreground placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground/60 tabular-nums transition-all shadow-xs disabled:opacity-40 disabled:bg-muted/10 disabled:cursor-not-allowed"
                                            />
                                            {isPlexPreview && surplusId && surplusValue !== 0 && (
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 pointer-events-none select-none">
                                                    Plex Preview
                                                </span>
                                            )}
                                        </div>
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
                                disabled={isSaving || isAutoAdjusting}
                            >
                                Cancelar
                            </Button>
                            {isAutoAdjusting ? (
                                <Button
                                    variant="secondary"
                                    loading={true}
                                    disabled={true}
                                    className="rounded-xl"
                                >
                                    Impactando en Plex...
                                </Button>
                            ) : isSaving ? (
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
                                        isLoadingNextAdjustmentIds ||
                                        (shortageValue !== 0 && !shortageId.trim()) ||
                                        (surplusValue !== 0 && !surplusId.trim()) ||
                                        (plexSession.running && plexSession.logged_in && (!selectedOperator || !selectedOperator.is_authorized) && (shortageValue !== 0 || surplusValue !== 0))
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
                title={`Borrar ajustes de ${labName}`}
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

            {/* Contenedor flotante centrado: Previsualización + Dock con separación fija permanente */}
            <AnimatePresence>
                {isPlexPreview && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: spring.slow }}
                        exit={{ opacity: 0, y: 12, scale: 0.98, transition: spring.slow.exit }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2.5 pointer-events-none w-[635px] max-w-[95vw]"
                    >
                        {/* Panel flotante superior de previsualización (modo diseño) */}
                        <Elevated
                            offset={2}
                            shadowLevel={3}
                            className="w-full h-[500px] max-h-[calc(100vh-100px)] rounded-xl pointer-events-auto flex flex-col overflow-hidden"
                        >
                            {/* Header superior */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                                <div className="flex flex-col gap-0.5">
                                    <span className={cn(typeClass("caption"), "text-foreground font-normal")}>
                                        {labName || "Sin Laboratorio"}
                                    </span>
                                    <span className={cn(typeClass("micro"), "text-muted-foreground")}>
                                        {fechaImpresion}
                                    </span>
                                </div>

                                <div className="flex flex-col items-end gap-0.5 text-right">
                                    <span className={cn(typeClass("caption"), "text-foreground font-normal")}>
                                        {branchName ? (branchName.toLowerCase().startsWith('sucursal') ? branchName : `Sucursal ${branchName}`) : 'Sucursal'}
                                    </span>
                                    <span className={cn(typeClass("micro"), "text-muted-foreground")}>
                                        Listado de Stock · Plex
                                    </span>
                                </div>
                            </div>

                            {/* Contenido del recuadro */}
                            <div className="flex-1 p-2.5 min-h-0 flex items-start justify-start gap-2.5">
                                {/* Hoja A4 con dimensión y proporción exacta (210/297) */}
                                <div
                                    ref={a4ContainerRef}
                                    className="relative h-full aspect-[210/297] bg-white rounded-lg shadow-md border border-black/5 shrink-0 overflow-hidden"
                                >
                                    {/* Renderizado real de lo que se imprime (documento A4 exacto) */}
                                    {reportHtml ? (
                                        <iframe
                                            ref={iframeRef}
                                            srcDoc={reportHtml}
                                            onLoad={handleIframeLoad}
                                            title="Previsualización Listado de Stock"
                                            className="border-none pointer-events-none origin-top-left select-none bg-white absolute top-0 left-0 transition-transform duration-200"
                                            style={{
                                                width: 794,
                                                height: Math.max(1123, 1123 * totalPages),
                                                transform: `scale(${a4Scale}) translateY(-${(currentPage - 1) * 1123}px)`,
                                                transformOrigin: 'top left',
                                            }}
                                        />
                                    ) : null}

                                    {/* Botones flotantes por encima de la hoja */}
                                    <div className="absolute bottom-2.5 inset-x-2.5 z-10 flex items-center justify-between pointer-events-auto">
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                if (totalPages > 1) {
                                                    setCurrentPage(prev => (prev % totalPages) + 1);
                                                }
                                            }}
                                            className="h-8 px-3.5 bg-[#484848] text-white hover:bg-[#545454] active:scale-[0.98] rounded-lg text-xs whitespace-nowrap shrink-0 transition-all duration-80 cursor-pointer shadow-sm"
                                        >
                                            {currentPage}/{totalPages} Paginas
                                        </Button>
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="ghost"
                                                aria-label="Imprimir / Descargar PDF"
                                                onClick={() => ReportExporter.exportToPDF(items || [], labName, branchName, {
                                                    groupBy: groupByFilter,
                                                    stockFilter: stockQuantityFilter,
                                                })}
                                                className="size-8 bg-[#484848] text-white hover:bg-[#545454] active:scale-[0.98] rounded-lg shrink-0 transition-all duration-80 cursor-pointer p-0 flex items-center justify-center shadow-sm"
                                            >
                                                <Download className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                aria-label="Ampliar"
                                                className="size-8 bg-[#484848] text-white hover:bg-[#545454] active:scale-[0.98] rounded-lg shrink-0 transition-all duration-80 cursor-pointer p-0 flex items-center justify-center shadow-sm"
                                            >
                                                <Plus className="size-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Columna derecha: Filtros de Fluid con RadioGroup (sin circle/dot, con motion y selección) */}
                                <div className="flex flex-col gap-3.5 flex-1 min-w-0 shrink-0 pt-0.5 overflow-y-auto overflow-x-hidden max-h-full pr-1.5 scrollbar-none">
                                    {/* Grupo 1: Agrupar Por */}
                                    <div className="flex flex-col gap-1 w-full">
                                        <span className={cn(typeClass("micro"), "text-muted-foreground px-4")}>
                                            Agrupar Por
                                        </span>
                                        <RadioGroup
                                            value={groupByFilter}
                                            onValueChange={setGroupByFilter}
                                            className="w-full gap-1.5"
                                        >
                                            {[
                                                { id: "laboratorio", label: "Laboratorio" },
                                                { id: "rubro", label: "Rubro" },
                                                { id: "psicofarmaco", label: "Psicofarmaco" },
                                            ].map((item) => (
                                                <RadioItem
                                                    key={item.id}
                                                    value={item.id}
                                                    label={item.label}
                                                    showIndicator={false}
                                                    className="w-full h-9 px-4 text-xs font-normal"
                                                />
                                            ))}
                                        </RadioGroup>
                                    </div>

                                    {/* Grupo 2: Cantidad de Stock */}
                                    <div className="flex flex-col gap-1 w-full">
                                        <span className={cn(typeClass("micro"), "text-muted-foreground px-4")}>
                                            Cantidad de Stock
                                        </span>
                                        <RadioGroup
                                            value={stockQuantityFilter}
                                            onValueChange={setStockQuantityFilter}
                                            className="w-full gap-1.5"
                                        >
                                            {[
                                                { id: "no_filtrar", label: "No Filtrar" },
                                                { id: "mayor_a", label: "Mayor a" },
                                                { id: "menor_a", label: "Menos a" },
                                                { id: "debajo_minimo", label: "Debajo del Minimo" },
                                                { id: "sin_minimo", label: "Sin Minimo" },
                                                { id: "encima_minimo", label: "Encima del Minimo" },
                                            ].map((item) => (
                                                <RadioItem
                                                    key={item.id}
                                                    value={item.id}
                                                    label={item.label}
                                                    showIndicator={false}
                                                    className="w-full h-9 px-4 text-xs font-normal"
                                                />
                                            ))}
                                        </RadioGroup>
                                    </div>
                                </div>
                            </div>
                        </Elevated>

                        {/* Barra flotante inferior de previsualización (dock) */}
                        <Elevated
                            offset={2}
                            shadowLevel={3}
                            className="w-full rounded-xl pointer-events-auto"
                        >
                            <Toolbar
                                aria-label="Barra flotante de previsualización"
                                className="h-11 w-full px-2.5 py-1.5 rounded-xl border-none bg-transparent shadow-none flex items-center justify-start gap-1 pointer-events-auto"
                            >
                                <Button
                                    variant="ghost"
                                    className="h-8 px-3.5 bg-active text-foreground hover:bg-active/80 active:scale-[0.98] rounded-lg text-xs whitespace-nowrap shrink-0 transition-all duration-80 cursor-pointer"
                                >
                                    {labName || "Laboratorio"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="h-8 px-3.5 bg-active text-foreground hover:bg-active/80 active:scale-[0.98] rounded-lg text-xs whitespace-nowrap shrink-0 transition-all duration-80 cursor-pointer"
                                >
                                    Listado de Stock
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => ReportExporter.exportToPDF(items || [], labName, branchName, {
                                        groupBy: groupByFilter,
                                        stockFilter: stockQuantityFilter,
                                    })}
                                    className="h-8 px-3.5 text-foreground hover:bg-active/60 active:scale-[0.98] rounded-lg text-xs whitespace-nowrap shrink-0 transition-all duration-80 cursor-pointer flex items-center gap-1.5 ml-0.5"
                                >
                                    <HugeiconsIcon icon={PrinterIcon} size={14} strokeWidth={1.8} className="text-muted-foreground" />
                                    Imprimir
                                </Button>
                            </Toolbar>
                        </Elevated>
                    </motion.div>
                )}
            </AnimatePresence>
        </PageLayout>
    );
}

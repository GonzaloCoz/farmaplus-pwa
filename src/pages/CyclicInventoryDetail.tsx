import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { Button, buttonVariants } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Group, GroupSeparator } from '@/components/ui/group';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTab } from "@/components/ui/tabs";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
    Upload, 
    Magnifer as Search, 
    InfoCircle as Info, 
    Restart as Loader2, 
    CheckCircle, 
    Restart as RotateCcw, 
    Dollar, 
    ClipboardList, 
    AltArrowLeft as ArrowLeft,
    Filter,
    MenuDots as MoreVertical,
    DangerCircle as DiffIcon,
    Danger as AlertTriangle,
    Document,
    Download,
    Pen,
    Refresh
} from "@solar-icons/react";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    Menu,
    MenuPopup,
    MenuItem,
    MenuTrigger,
    MenuGroup,
    MenuGroupLabel,
    MenuSeparator,
} from "@/components/ui/menu";
import { CyclicInventoryList } from '@/components/CyclicInventoryList';
import { AnimatedCounter } from '@/components/AnimatedCounter';
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
import { Onboarding } from '@/components/Onboarding';
import { cn, normalizeString } from '@/lib/utils';
import { FabMenu } from '@/components/FabMenu';
import { DeleteConfirmationDialog } from '@/components/cyclic/DeleteConfirmationDialog';
import { HistoryDialog } from '@/components/cyclic/HistoryDialog';
import { ReportExporter } from '@/lib/reportExporter';
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { FramePanel } from '@/components/ui/frame';

// Hooks & Components
import { useCyclicInventoryController } from '@/hooks/useCyclicInventoryController';
import { InventorySkeleton } from '@/components/InventorySkeleton';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { useUser } from '@/contexts/UserContext';
import { TrashBinMinimalistic as TrashIcon } from '@solar-icons/react';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { notify as toast } from '@/lib/notifications';

const CATEGORIES = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

export default function CyclicInventoryDetail() {
    const { id } = useParams(); // This will be the Lab Name
    const labName = id ? decodeURIComponent(id) : '';
    const navigate = useNavigate();
    const { activeWindowId, updateWindowMeta } = useWindowManager();
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState("pending");

    // Admin Mode State
    const [isAdminModeEnabled, setIsAdminModeEnabled] = useState(false);
    const [showAdminPurgeModal, setShowAdminPurgeModal] = useState(false);
    const [adminPassword, setAdminPassword] = useState("");
    const [isAdminPurging, setIsAdminPurging] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

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

        // Mismatch Overrides
        showMismatchDialog,
        setShowMismatchDialog,
        mismatchData,
        handleResolveMismatch,

        // Advanced Logic
        sortBy, setSortBy,
        getSortedItems

    } = useCyclicInventoryController({ labName });

    // Resumen de Rubros Controlados y Totales para el Diálogo de Finalización
    const categoryStats = useMemo(() => {
        const statsMap = CATEGORIES.map(category => {
            const catItems = items.filter(item => {
                const normCat = normalizeString(item.category || 'Varios').toUpperCase();
                const normTarget = normalizeString(category).toUpperCase();
                return normCat === normTarget;
            });

            let controlledUnits = 0;
            let differenceUnits = 0;
            let value = 0;

            catItems.forEach(item => {
                if (item.status === 'controlled') {
                    controlledUnits += item.countedQuantity;
                    const diff = item.countedQuantity - item.systemQuantity;
                    differenceUnits += diff;
                    value += diff * item.cost;
                }
            });

            return {
                category,
                controlledUnits,
                differenceUnits,
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

    const handleAdminPurge = async () => {
        if (!adminPassword) {
            toast.error("Error", "Debes ingresar la contraseña.");
            return;
        }

        setIsAdminPurging(true);
        try {
            const result = (await cyclicInventoryService.adminPurgeLabInventory(
                branchName,
                labName,
                adminPassword,
                user?.id || ''
            )) as any;

            if (result.success) {
                toast.success("Éxito", result.message);
                setShowAdminPurgeModal(false);
                setAdminPassword("");
                navigate('/cyclic-inventory');
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
                    navigate(`/cyclic-inventory/${encodeURIComponent(fileLabName)}`);
                }
            });

            return cleanup;
        }
    }, [labName, handleElectronImport, navigate]);

    return (
        <PageLayout className="pb-32 lg:pb-10">
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
                    {/* Header Info Bar */}
                    {items.length > 0 && (
                        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/10 p-2 rounded-lg border border-dashed border-muted/30">
                            <Info className="w-3.5 h-3.5 opacity-70" />
                            <span>
                                Última actualización del inventario:
                                <span className="font-mono ml-1 font-medium text-foreground opacity-80">
                                    {new Date(Math.max(...items.map(i => new Date(i.updatedAt || new Date()).getTime()))).toLocaleString()}
                                </span>
                            </span>
                        </div>
                    )}

                    {/* Main View: Always show Header and Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Stats Cards */}
                            {/* 1. Enhanced Status Bar - Full Width Single Row */}
                            <FramePanel className="lg:col-span-3 min-h-[100px] mb-4 flex flex-col justify-center px-6 sm:px-8 bg-popover border-input shadow-xs/5 dark:bg-input/20 overflow-hidden">
                                <div className="flex items-center justify-between gap-4 w-full">
                                    {/* Left: Navigation + Lab Label + Name */}
                                    <div className="flex items-center gap-4 min-w-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full hover:bg-muted/50 -ml-2"
                                            onClick={() => navigate('/cyclic-inventory')}
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </Button>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] sm:text-xs text-muted-foreground/60 uppercase tracking-widest font-cal font-bold whitespace-nowrap">Lab</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-foreground text-lg sm:text-xl truncate font-cal">{labName}</span>
                                                        <Badge variant="outline" className="ml-2 bg-muted/20 text-muted-foreground text-[10px] font-bold border-input/40">
                                                            {branchName}
                                                        </Badge>

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
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="h-10 sm:h-12 w-px bg-border/40 flex-shrink-0 mx-2" />
                                    </div>

                                    {/* Center: Counters - Horizontal Layout */}
                                    <div className="flex items-center gap-6 sm:gap-12 flex-1 justify-center">
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground/60 uppercase tracking-widest font-cal font-bold whitespace-nowrap">Pendientes</span>
                                            <div className="flex items-center">
                                                <div className="text-2xl sm:text-3xl font-bold text-warning leading-none flex items-center tabular-nums">
                                                    <AnimatedCounter value={globalPending} digits={4} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground/60 uppercase tracking-widest font-cal font-bold whitespace-nowrap">Controlados</span>
                                            <div className="flex items-center">
                                                <div className="text-2xl sm:text-3xl font-bold text-success leading-none flex items-center tabular-nums">
                                                    <AnimatedCounter value={globalControlled} digits={4} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground/60 uppercase tracking-widest font-cal font-bold whitespace-nowrap">Ajustados</span>
                                            <div className="flex items-center">
                                                <div className="text-2xl sm:text-3xl font-bold text-blue-500 leading-none flex items-center tabular-nums">
                                                    <AnimatedCounter value={globalAdjusted} digits={4} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <span className="text-[10px] sm:text-xs text-muted-foreground/60 uppercase tracking-widest font-cal font-bold whitespace-nowrap">Avance</span>
                                            <div className="flex items-center gap-1">
                                                <div className="text-2xl sm:text-3xl font-bold text-foreground leading-none flex items-center tabular-nums">
                                                    <AnimatedCounter value={progressPercentage} digits={3} />
                                                </div>
                                                <span className="text-xl font-bold opacity-30 leading-none">%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </FramePanel>

                            {/* Main Content */}
                            <div className="lg:col-span-3">
                                {/* Toolbar & Categories */}
                                <div className="flex items-center justify-between gap-4 mb-4">
                                    {/* Categorías */}
                                    <Group aria-label="Filtros de categoría" className="shrink-0 flex w-full md:w-fit overflow-x-auto no-scrollbar">
                                        {CATEGORIES.map((cat, index) => {
                                            const catCount = items.filter(i => {
                                                if (i.status !== 'pending') return false;
                                                const itemCat = i.category ? i.category.trim() : '';
                                                const normalizedTarget = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                                                const normalizedItem = itemCat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                                                return normalizedItem === normalizedTarget;
                                            }).length;

                                            return (
                                                <React.Fragment key={cat}>
                                                    {index > 0 && <GroupSeparator />}
                                                    <Button
                                                        variant={currentCategory === cat ? "secondary" : "outline"}
                                                        size="lg"
                                                        onClick={() => setCurrentCategory(cat)}
                                                        className={cn(
                                                            "whitespace-nowrap font-semibold transition-all px-6 flex-1 md:flex-none",
                                                            currentCategory === cat ? "opacity-100" : "opacity-80 hover:opacity-100"
                                                        )}
                                                    >
                                                        {cat}
                                                        <Badge className="ml-2 rounded-full px-2" variant={currentCategory === cat ? "secondary" : "outline"}>
                                                            {catCount}
                                                        </Badge>
                                                    </Button>
                                                </React.Fragment>
                                            );
                                        })}
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
                                            {/* Botón Solo Diferencias */}
                                            <Button
                                                variant={showDifferencesOnly ? "secondary" : "outline"}
                                                size="icon"
                                                onClick={() => setShowDifferencesOnly(!showDifferencesOnly)}
                                                title="Solo Diferencias"
                                            >
                                                <DiffIcon className="w-4 h-4" />
                                            </Button>

                                            <GroupSeparator />

                                            <Menu>
                                                <MenuTrigger render={
                                                    <Button variant="outline" size="icon" className="group">
                                                        <Filter className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                    </Button>
                                                } />
                                                <MenuPopup align="end" className="w-48 rounded-xl p-1">
                                                    <MenuItem onClick={() => setSortBy('name-asc')} className="rounded-lg text-xs font-semibold">
                                                        Nombre (A-Z)
                                                    </MenuItem>
                                                    <MenuItem onClick={() => setSortBy('name-desc')} className="rounded-lg text-xs font-semibold">
                                                        Nombre (Z-A)
                                                    </MenuItem>
                                                    <MenuItem onClick={() => setSortBy('value-asc')} className="rounded-lg text-xs font-semibold">
                                                        Valor (Menor a Mayor)
                                                    </MenuItem>
                                                    <MenuItem onClick={() => setSortBy('value-desc')} className="rounded-lg text-xs font-semibold">
                                                        Valor (Mayor a Menor)
                                                    </MenuItem>
                                                </MenuPopup>
                                            </Menu>

                                            <GroupSeparator />

                                            <Menu>
                                                <MenuTrigger render={
                                                    <Button variant="outline" size="icon" className="group">
                                                        <MoreVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                    </Button>
                                                } />
                                                <MenuPopup align="end" className="w-56 rounded-xl p-1">
                                                    <MenuGroup>
                                                        <MenuGroupLabel>Carga de Datos</MenuGroupLabel>
                                                        <MenuItem onClick={() => document.getElementById('inventory-upload-hidden')?.click()} className="rounded-lg text-sm font-medium cursor-pointer">
                                                            <Document className="w-4 h-4 text-muted-foreground" />
                                                            Cargar archivo Excel
                                                        </MenuItem>
                                                    </MenuGroup>
                                                    
                                                    <MenuSeparator />
                                                    
                                                    <MenuGroup>
                                                        <MenuGroupLabel>Reportes</MenuGroupLabel>
                                                        <MenuItem onClick={() => ReportExporter.exportToPDF(items, labName, branchName)} className="rounded-lg text-sm font-medium cursor-pointer">
                                                            <Download className="w-4 h-4 text-muted-foreground" />
                                                            Descargar reporte PDF
                                                        </MenuItem>
                                                        <MenuItem onClick={() => ReportExporter.exportToExcel(items, labName, branchName)} className="rounded-lg text-sm font-medium cursor-pointer">
                                                            <Download className="w-4 h-4 text-muted-foreground" />
                                                            Descargar reporte EXCEL
                                                        </MenuItem>
                                                    </MenuGroup>
                                                    
                                                    <MenuSeparator />
                                                    
                                                    <MenuGroup>
                                                        <MenuGroupLabel>Avanzado</MenuGroupLabel>
                                                        <MenuItem onClick={() => setIsHistoryDialogOpen(true)} className="rounded-lg text-sm font-medium cursor-pointer">
                                                            <Pen className="w-4 h-4 text-muted-foreground" />
                                                            Ver historial completo
                                                        </MenuItem>

                                                        {user?.role === 'admin' && (
                                                            <MenuItem onClick={handleForceRefreshProgress} className="rounded-lg text-sm font-medium cursor-pointer">
                                                                <Refresh className="w-4 h-4 text-muted-foreground" />
                                                                Sincronizar avance (Forzar)
                                                            </MenuItem>
                                                        )}

                                                        <MenuItem variant="destructive" onClick={handleResetData} className="rounded-lg text-sm font-medium cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                                                            <RotateCcw className="w-4 h-4 opacity-80" />
                                                            Reiniciar laboratorio
                                                        </MenuItem>
                                                    </MenuGroup>
                                                </MenuPopup>
                                            </Menu>
                                        </Group>
                                    </div>
                                </div>
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full shrink-0">
                                    {/* Row 2: Tabs + Actions Wrapper */}
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                                <Group aria-label="Filtros de estado" className="shrink-0 flex w-full md:w-fit overflow-x-auto no-scrollbar">
                                                    <Button
                                                        variant={activeTab === "pending" ? "secondary" : "outline"}
                                                        size="lg"
                                                        onClick={() => setActiveTab("pending")}
                                                        className={cn(
                                                            "whitespace-nowrap font-semibold transition-all px-6 flex-1 md:flex-none",
                                                            activeTab === "pending" ? "opacity-100" : "opacity-80 hover:opacity-100"
                                                        )}
                                                    >
                                                        Pendientes
                                                        {pendingItems.length > 0 && (
                                                            <Badge className="ml-2 rounded-full px-2" variant={activeTab === "pending" ? "secondary" : "outline"}>
                                                                {pendingItems.length}
                                                            </Badge>
                                                        )}
                                                    </Button>
                                                    <GroupSeparator />

                                                    <Button
                                                        variant={activeTab === "controlled" ? "secondary" : "outline"}
                                                        size="lg"
                                                        onClick={() => setActiveTab("controlled")}
                                                        className={cn(
                                                            "whitespace-nowrap font-semibold transition-all px-6 flex-1 md:flex-none",
                                                            activeTab === "controlled" ? "opacity-100" : "opacity-80 hover:opacity-100"
                                                        )}
                                                    >
                                                        Controlados
                                                        {controlledItems.length > 0 && (
                                                            <Badge className="ml-2 rounded-full px-2" variant={activeTab === "controlled" ? "secondary" : "outline"}>
                                                                {controlledItems.length}
                                                            </Badge>
                                                        )}
                                                    </Button>
                                                    <GroupSeparator />

                                                    <Button
                                                        variant={activeTab === "adjusted" ? "secondary" : "outline"}
                                                        size="lg"
                                                        onClick={() => setActiveTab("adjusted")}
                                                        className={cn(
                                                            "whitespace-nowrap font-semibold transition-all px-6 flex-1 md:flex-none",
                                                            activeTab === "adjusted" ? "opacity-100" : "opacity-80 hover:opacity-100"
                                                        )}
                                                    >
                                                        Ajustados
                                                        {adjustedItems.length > 0 && (
                                                            <Badge className="ml-2 rounded-full px-2 shadow-xs" variant={activeTab === "adjusted" ? "secondary" : "outline"}>
                                                                {adjustedItems.length}
                                                            </Badge>
                                                        )}
                                                    </Button>
                                                    <GroupSeparator />

                                                    <Button
                                                        variant={activeTab === "history" ? "secondary" : "outline"}
                                                        size="lg"
                                                        onClick={() => setActiveTab("history")}
                                                        className={cn(
                                                            "whitespace-nowrap font-semibold transition-all px-6 flex-1 md:flex-none",
                                                            activeTab === "history" ? "opacity-100" : "opacity-80 hover:opacity-100"
                                                        )}
                                                    >
                                                        Historial
                                                        {history.length > 0 && (
                                                            <Badge className="ml-2 rounded-full px-2 shadow-xs" variant={activeTab === "history" ? "secondary" : "outline"}>
                                                                {history.length}
                                                            </Badge>
                                                        )}
                                                    </Button>
                                                </Group>

                                        {/* Row 2 Actions (Right) */}
                                        <div className="flex items-center gap-3 self-end md:self-auto">
                                            {/* Action Group: Cargar Excel & Reiniciar - same pattern as Row 1 filter group */}
                                            <Group className="shrink-0">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => document.getElementById('inventory-upload-hidden')?.click()}
                                                    disabled={isUploading || isSaving}
                                                    className="group"
                                                    title="Cargar Archivo"
                                                >
                                                    <Upload className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                </Button>
                                                <GroupSeparator />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={handleResetData}
                                                    disabled={isUploading || isSaving}
                                                    className="group"
                                                    title="Reiniciar"
                                                >
                                                    <RotateCcw className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                </Button>
                                            </Group>

                                            {/* Finalizar Button */}
                                            <GradientButton
                                                onClick={handleFinalizeClick}
                                                disabled={isSaving || (pendingItems.length === 0 && controlledItems.length === 0 && adjustedItems.length === 0)}
                                                className="h-10 whitespace-nowrap"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Finalizar
                                            </GradientButton>
                                        </div>
                                    </div>
                                    <ScrollArea className="flex-1 -mx-4 px-4 overflow-hidden">
                                        <ScrollAreaViewport className="pb-8">
                                            <TabsContent value="pending" className="space-y-4 pt-4">
                                                {pendingItems.length === 0 && controlledItems.length === 0 && (
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

                                                {pendingItems.length > 0 && (
                                                    <Alert className="bg-muted/10 border-muted/20 mb-4 rounded-lg py-3 shadow-none">
                                                        <Info className="h-4 w-4 text-primary" />
                                                        <AlertDescription className="text-sm font-medium text-muted-foreground ml-2">
                                                            Desliza a la derecha para confirmar (verde) o a la izquierda para reportar diferencia (naranja).
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                                
                                                {shouldHidePendings && (
                                                    <Alert className="bg-primary/10 border-primary/20 mb-4 rounded-lg py-3 shadow-none">
                                                        <Info className="h-4 w-4 text-primary" />
                                                        <AlertDescription className="text-sm font-medium text-primary/80 ml-2">
                                                            <strong>Vista de Cierre:</strong> Los productos pendientes están ocultos para mantener el laboratorio limpio. Se volverán a activar automáticamente cuando cargues un nuevo Excel.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                {!isExcelUploaded && adjustedItems.length > 0 && (
                                                    <Alert className="bg-warning/10 border-warning/20 mb-4 rounded-lg py-3 shadow-none">
                                                        <AlertTriangle className="h-4 w-4 text-warning" />
                                                        <AlertDescription className="text-sm font-medium text-warning/80 ml-2">
                                                            <strong>Regla de Re-ajuste:</strong> Para modificar productos ya finalizados, debes cargar el Excel de sistema más reciente.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                <CyclicInventoryList
                                                    items={getSortedItems(pendingItems)}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={handleCheck}
                                                    onBulkCheck={handleBulkCheck}
                                                    isPending={true}
                                                    isExcelUploaded={isExcelUploaded}
                                                />
                                            </TabsContent>

                                            <TabsContent value="controlled" className="space-y-4 pt-4">
                                                <CyclicInventoryList
                                                    items={getSortedItems(controlledItems)}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={handleCheck}
                                                    onBulkCheck={handleBulkCheck}
                                                    onRevert={handleRevertItem}
                                                    readOnly={false}
                                                    isExcelUploaded={isExcelUploaded}
                                                />
                                            </TabsContent>

                                            <TabsContent value="adjusted" className="space-y-4 pt-4">
                                                <CyclicInventoryList
                                                    items={getSortedItems(adjustedItems)}
                                                    onUpdateQuantity={handleUpdateQuantity}
                                                    onCheck={() => { }} // No check needed for adjusted
                                                    onBulkCheck={handleBulkCheck}
                                                    readOnly={false} // Enable editing for readjustments
                                                    isExcelUploaded={isExcelUploaded}
                                                />
                                            </TabsContent>

                                            <TabsContent value="history" className="space-y-4 pt-4">
                                                {history.length === 0 ? (
                                                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border-dashed border-2">
                                                        No hay historial de ajustes para este laboratorio.
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {history.map((h: any) => (
                                                            <Card key={h.id} className="p-4 flex flex-col gap-2 border shadow-xs/5 rounded-lg">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <p className="text-sm font-bold text-primary">
                                                                            {new Date(h.created_at).toLocaleDateString()} {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </p>
                                                                        <div className="flex gap-2 items-center">
                                                                            <p className="text-xs text-muted-foreground">Por: {h.user_name || 'Desconocido'}</p>
                                                                            {h.category && (
                                                                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                                                                                    {h.category}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                                                            {h.total_units_adjusted} items
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                                                    <div className="bg-destructive/10 p-2 rounded border border-destructive/20">
                                                                        <span className="font-semibold text-destructive block">Faltantes</span>
                                                                        ID: {h.adjustment_id_shortage || '-'}
                                                                        <div className="font-mono mt-1">${(Number(h.shortage_value ?? h.total_shortage_value) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                                                    </div>
                                                                    <div className="bg-success/10 p-2 rounded border border-success/20">
                                                                        <span className="font-semibold text-success block">Sobrantes</span>
                                                                        ID: {h.adjustment_id_surplus || '-'}
                                                                        <div className="font-mono mt-1">${(Number(h.surplus_value ?? h.total_surplus_value) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        ))}
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
                <DialogContent showCloseButton={false} className="max-w-5xl p-0 gap-0 overflow-hidden border border-border/60 shadow-lg rounded-2xl bg-background">
                    <Form 
                        className="flex flex-col md:flex-row min-h-[580px] gap-0" 
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveInventory();
                        }}
                    >
                        {/* Columna Izquierda (45% de ancho en escritorio) */}
                        <div className="w-full md:w-[42%] p-6 flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                                        Finalizar Control
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                                        Confirma los códigos de ajuste para cerrar el control del laboratorio <strong className="text-foreground">{labName}</strong>.
                                    </DialogDescription>
                                </div>

                                {/* Warning Alert Badge */}
                                <div className="flex items-center gap-2.5 px-3 py-2 bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 rounded-xl text-[11px] font-medium leading-relaxed">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-500" />
                                    <span>Por favor, controlar ID y valores ingresados antes de confirmar.</span>
                                </div>

                                <div className="space-y-4 pt-2">
                                    {/* Faltantes Card */}
                                    <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
                                                    <TrashIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-semibold text-red-500/90">Faltantes (negativos)</span>
                                            </div>
                                            <span className="font-mono font-bold text-red-500 text-sm">
                                                -${Math.abs(shortageValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <Input
                                            value={shortageId}
                                            onChange={(e) => setShortageId(e.target.value)}
                                            placeholder="ID Ajuste Faltantes (PLEX)"
                                            className="h-10 text-xs bg-background/50 border-red-500/20 focus:border-red-500/50 focus:ring-red-500/10 rounded-xl"
                                        />
                                    </div>

                                    {/* Sobrantes Card */}
                                    <div className="p-4 rounded-xl border border-green-500/10 bg-green-500/5 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-green-500/10 text-green-500">
                                                    <CheckCircle className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-semibold text-green-500/90">Sobrantes (positivos)</span>
                                            </div>
                                            <span className="font-mono font-bold text-green-500 text-sm">
                                                +${Math.abs(surplusValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <Input
                                            value={surplusId}
                                            onChange={(e) => setSurplusId(e.target.value)}
                                            placeholder="ID Ajuste Sobrantes (PLEX)"
                                            className="h-10 text-xs bg-background/50 border-green-500/20 focus:border-green-500/50 focus:ring-green-500/10 rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <Button 
                                    type="submit" 
                                    variant="default"
                                    disabled={isSaving}
                                    className="h-11 w-full bg-emerald-600 border-emerald-700 hover:bg-emerald-600/90 text-white font-semibold rounded-xl shadow-emerald-600/24 shadow-xs flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Confirmar y finalizar
                                </Button>
                                
                                <Button 
                                    variant="outline" 
                                    type="button"
                                    onClick={() => setShowSaveDialog(false)}
                                    className="h-11 w-full text-xs font-semibold rounded-xl"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>

                        {/* Columna Derecha (58% de ancho en escritorio) */}
                        <div className="w-full md:w-[58%] p-6 bg-muted/20 border-l border-border/30 flex flex-col justify-between space-y-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-1">
                                    <h3 className="text-sm font-semibold text-foreground">
                                        Resumen de rubros controlados
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowSaveDialog(false)}
                                        className="p-1.5 rounded-lg text-muted-foreground/75 hover:text-foreground hover:bg-muted/50 transition-colors"
                                    >
                                        <span className="sr-only">Cerrar</span>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <ScrollArea className="h-[280px] pr-2">
                                    <ScrollAreaViewport className="w-full h-full">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                                            {categoryStats.map((catStat) => (
                                                <div key={catStat.category} className="space-y-1.5">
                                                    <h4 className="text-sm font-semibold text-foreground pl-1">
                                                        {catStat.category}
                                                    </h4>
                                                    <div className="bg-background border border-border/40 rounded-xl p-3 space-y-1.5">
                                                        <div className="flex justify-between items-center text-[11px]">
                                                            <span className="text-muted-foreground">Unidades</span>
                                                            <span className="font-semibold text-foreground">{catStat.controlledUnits} u.</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[11px]">
                                                            <span className="text-muted-foreground">Diferencia</span>
                                                            <span className={cn(
                                                                "font-semibold",
                                                                catStat.differenceUnits > 0 ? "text-green-500" : catStat.differenceUnits < 0 ? "text-red-500" : "text-muted-foreground"
                                                            )}>
                                                                {catStat.differenceUnits > 0 ? `+${catStat.differenceUnits}` : catStat.differenceUnits} u.
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-border/30">
                                                            <span className="text-muted-foreground">Valor Neto</span>
                                                            <span className={cn(
                                                                "font-mono font-bold",
                                                                catStat.value > 0 ? "text-green-500" : catStat.value < 0 ? "text-red-500" : "text-muted-foreground"
                                                            )}>
                                                                {catStat.value > 0 ? `+$${catStat.value.toLocaleString('es-AR')}` : `$${catStat.value.toLocaleString('es-AR')}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollAreaViewport>
                                    <ScrollAreaScrollbar />
                                </ScrollArea>
                            </div>

                            <div className="pt-4 border-t border-border/40 space-y-2.5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Total Faltantes</span>
                                    <span className="font-mono text-red-500 font-semibold">
                                        -${Math.abs(shortageValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Total Sobrantes</span>
                                    <span className="font-mono text-green-500 font-semibold">
                                        +${Math.abs(surplusValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Total Unidades Controladas</span>
                                    <span className="font-semibold text-foreground">
                                        {totalControlledUnits} unidades
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-2.5 border-t border-border/40">
                                    <span className="font-semibold text-foreground">Balance de Ajuste</span>
                                    <span className={cn(
                                        "font-mono font-bold text-base",
                                        netBalance > 0 ? "text-green-500" : netBalance < 0 ? "text-red-500" : "text-foreground"
                                    )}>
                                        {netBalance > 0 ? `+$${netBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : `$${netBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Form>
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
                verificationText={verificationText}
                isDeleting={isDeleting}
                title={`Reiniciar ${labName}`}
                description={
                    <div className="space-y-2">
                        <p>¿Estás seguro de que quieres reiniciar todo el progreso de este laboratorio?</p>
                        <ul className="list-disc pl-4 text-sm text-muted-foreground">
                            <li>Se eliminarán todos los conteos actuales (Pendientes, Controlados, Ajustados).</li>
                            <li>Esta acción <strong>NO</strong> se puede deshacer.</li>
                            <li>Deberás comenzar desde cero o cargar un nuevo Excel.</li>
                        </ul>
                    </div>
                }
            />

            {/* Onboarding Overlay */}
            <Onboarding />

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

            {/* Minimalist Admin Purge Modal */}
            <Dialog open={showAdminPurgeModal} onOpenChange={setShowAdminPurgeModal}>
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden border border-border/60 shadow-md rounded-lg bg-background">
                    {/* Header: Exact copy of NotificationsMenu style */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-3">
                        <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                             <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                            Administración
                        </DialogTitle>
                    </div>

                    <div className="px-5 pb-5 space-y-4">
                        <div className="space-y-1.5">
                            <h3 className="text-sm font-semibold text-foreground">Eliminación de Laboratorio</h3>
                            <p className="text-[13px] text-muted-foreground leading-relaxed">
                                Esta acción eliminará permanentemente todos los datos de <strong>{labName}</strong> para la sucursal <strong>{branchName}</strong>.
                            </p>
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-px">
                                Contraseña
                            </Label>
                            <Input
                                type="password"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="Ingresa la contraseña para confirmar..."
                                className="h-11 text-sm bg-muted/30 border-border/40 focus:border-red-500/50 focus:ring-0 focus:ring-offset-0 rounded-xl"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleAdminPurge()}
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                             <Button 
                                variant="ghost" 
                                onClick={() => {
                                    setShowAdminPurgeModal(false);
                                    setAdminPassword("");
                                }}
                                className="h-11 flex-1 text-[13px] text-muted-foreground hover:text-foreground font-medium rounded-xl hover:bg-muted/50"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                onClick={handleAdminPurge} 
                                className="h-11 flex-[2] bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all shadow-sm active:scale-[0.98]"
                                disabled={isAdminPurging || !adminPassword}
                            >
                                {isAdminPurging ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <TrashIcon className="w-4 h-4 mr-2" />
                                )}
                                {isAdminPurging ? 'Procesando...' : 'Confirmar'}
                            </Button>
                        </div>
                    </div>

                    <div className="h-px bg-border/40" />
                    
                    <div className="px-5 py-3.5 bg-muted/20 flex items-center gap-2.5 justify-center text-[10px] text-muted-foreground/70 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                        Esta operación quedará registrada en los logs de auditoría.
                    </div>
                </DialogContent>
            </Dialog>
        </PageLayout>
    );
}


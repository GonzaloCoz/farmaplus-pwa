import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent
} from "@/components/ui/accordion";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFrame,
    CardFrameHeader,
    CardFrameTitle,
    CardFrameDescription,
    CardFrameAction,
    CardPanel
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Elevated } from '@/lib/elevated';
import { SurfaceProvider } from '@/lib/surface-context';
import { Scan as Barcode, SearchLg as Search, Trash01 as Trash2, Save01 as Save, Upload01 as Upload, ArrowLeft, LayersTwo01 as Layers, Plus, ClockRewind as History, Play, Calendar, ArrowRight, CheckCircle, Wifi, XCircle, File02 as FileText, RefreshCcw01 as RotateCcw, ShieldOff as ZapOff, Laptop01 as Laptop, Monitor01 as Monitor, Phone as Smartphone, AlertTriangle as Danger, InfoCircle as Info, Activity as Infinity, Keyboard01 as Keyboard, Download01 as Download, ChevronDown, Zap, Package, MarkerPin01 as MapPin, XClose as X, Pencil01 as Pencil, FileCheck01 as FileSpreadsheet, AlertCircle, AlertTriangle, LayoutGrid01 as LayoutGrid, Hash01 as Hash, Printer, Check, Maximize01 as Maximize, Settings01 as Settings, Minimize01 as Minimize, FilterLines as Filter, ArrowUp, ArrowDown, LogOut01 as LogOut, RefreshCcw01 as RefreshCcw } from '@untitledui/icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SmartProductSearch } from '@/components/SmartProductSearch';
import { PreCountList } from '@/components/PreCountList';
import { usePreCount } from '@/hooks/usePreCount';
import { NumericKeyboard } from '@/components/NumericKeyboard';
import { LocationClosingDrawer } from '@/components/LocationClosingDrawer';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerClose,
    DrawerTrigger,
} from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    DropdownLabel,
    DropdownSeparator,
    MenuItem,
} from "@/components/ui/dropdown";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Table, type TableColumn } from "@/components/motion/table";
import { MasterCatalogItem, getSessionByPin, PreCountSession, getDeviceId, getProductByEAN } from '@/services/preCountDB';
import { Product } from '@/services/preCountDB';
import { notify } from '@/lib/notifications';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import * as XLSX from 'xlsx';
import ExcelNightWorker from '../workers/excelNightWorker?worker';
import { PreCountAdminCyclicView } from '@/components/precount/PreCountAdminCyclicView';
import { PreCountBranchCyclicView } from '@/components/precount/PreCountBranchCyclicView';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { enhancedProductCache } from '@/services/enhancedProductCache';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';
import { useHaptic } from '@/hooks/useHaptic';
import { Switch } from '@/components/ui/switch';
import { searchLocalBarcode } from '@/services/tauriLocalDb';
import { emitDeviceTelemetry } from '@/services/deviceTelemetry';
import { getFullSectorName } from '@/constants/farmaplusSectors';

import { 
    FinishSessionDialog, 
    NoZoneDialog, 
    AddSectorDialog, 
    QuantityDrawer 
} from '@/components/precount/PreCountDialogs';
import { SettingsMenu } from '@/components/precount/PreCountSettingsMenu';


import { playSound } from '@/utils/soundUtils';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Frame, FrameHeader, FramePanel, FrameTitle, FrameDescription } from '@/components/ui/frame';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';

import {
    NumberField,
    NumberFieldDecrement,
    NumberFieldIncrement,
    NumberFieldInput,
} from '@/components/ui/number-field';
import {
    Dialog,
    DialogClose,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPopup,
    DialogTitle,
    DialogPanel,
} from '@/components/ui/dialog';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import FileUpload from '@/components/FileUpload';
import { formatBytes } from '@/hooks/use-file-upload';

import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import { ConnectedDevicesList } from '@/components/inventory/ConnectedDevicesList';

import { QRPrintLayout } from '@/components/qr/QRPrintLayout';
import QRCode from 'qrcode';
import { db } from '@/services/db';
import {
    SelectItem,
    SelectPopup,
    SelectTrigger,
    SelectButton,
} from "@/components/ui/select";
import {
    Group,
    GroupSeparator,
    GroupText
} from "@/components/ui/group";
import {
    Combobox,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxPopup,
    ComboboxTrigger,
} from "@/components/ui/combobox";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { toast } from "sonner";

interface EditableCatalogPreviewProps {
    catalog: MasterCatalogItem[];
    onChange: (updatedCatalog: MasterCatalogItem[]) => void;
    profile: 'sucursal' | 'sap';
}

export function EditableCatalogPreview({ catalog, onChange, profile }: EditableCatalogPreviewProps) {
    const [editable, setEditable] = useState(false);

    const [keys, setKeys] = useState<string[]>([]);
    const [labels, setLabels] = useState<Record<string, string>>({});
    const [nextColId, setNextColId] = useState(1);

    useEffect(() => {
        if (catalog && catalog.length > 0) {
            const standardKeys = profile === 'sap' 
                ? ['id_producto', 'ean', 'name', 'systemStock']
                : ['id_producto', 'ean', 'name', 'systemStock', 'cost', 'laboratory', 'rubro'];
            
            const standardLabels = profile === 'sap'
                ? {
                    id_producto: 'MATERIAL',
                    ean: 'EAN',
                    name: 'DESCRIPCION',
                    systemStock: 'STOCK SAP'
                  }
                : {
                    id_producto: 'MATERIAL',
                    ean: 'EAN',
                    name: 'DESCRIPCION',
                    systemStock: 'STOCK SISTEMA',
                    cost: 'COSTO',
                    laboratory: 'LABORATORIO',
                    rubro: 'RUBRO'
                  };

            setKeys(standardKeys);
            setLabels(standardLabels);
        }
    }, [profile, catalog === null]);

    const [rows, setRows] = useState<any[]>([]);

    useEffect(() => {
        if (catalog) {
            setRows(catalog.map((item, idx) => ({
                id: `r-${idx}-${item.id_producto || ''}-${item.ean || ''}`,
                ...item
            })));
        }
    }, [catalog]);

    const onCellEdit = useCallback((rowId: string, key: string, value: string) => {
        setRows((prev) => {
            const updated = prev.map((row) => {
                if (row.id === rowId) {
                    const typedValue = (key === 'systemStock' || key === 'cost' || key === 'salePrice') ? Number(value) || 0 : value;
                    return { ...row, [key]: typedValue };
                }
                return row;
            });
            const nextCatalog = updated.map(({ id, ...item }) => item);
            onChange(nextCatalog);
            return updated;
        });
    }, [onChange]);

    const onInsertRow = useCallback((index: number, position: 'before' | 'after') => {
        const at = position === 'after' ? index + 1 : index;
        setRows((prev) => {
            const next = [...prev];
            const newRow = {
                id: `r-new-${Date.now()}`,
                id_producto: 'NUEVO',
                ean: '',
                name: 'Nuevo Producto',
                systemStock: 0,
                cost: 0,
                salePrice: 0,
                laboratory: profile === 'sap' ? 'SAP' : 'Varios',
                rubro: profile === 'sap' ? 'Depósito' : 'Varios',
                eans: [],
                isPrimaryEan: true
            };
            next.splice(at, 0, newRow);
            const nextCatalog = next.map(({ id, ...item }) => item);
            onChange(nextCatalog);
            return next;
        });
    }, [onChange, profile]);

    const onDeleteRow = useCallback((rowId: string) => {
        setRows((prev) => {
            const next = prev.filter((row) => row.id !== rowId);
            const nextCatalog = next.map(({ id, ...item }) => item);
            onChange(nextCatalog);
            return next;
        });
    }, [onChange]);

    const onInsertColumn = useCallback((index: number, position: 'before' | 'after') => {
        const key = `custom_field_${nextColId}`;
        const at = position === 'after' ? index + 1 : index;
        setLabels((prev) => ({ ...prev, [key]: `Columna ${nextColId}` }));
        setKeys((prev) => {
            const next = [...prev];
            next.splice(at, 0, key);
            return next;
        });
        setRows((prev) => {
            const next = prev.map((row) => ({ ...row, [key]: '' }));
            const nextCatalog = next.map(({ id, ...item }) => item);
            onChange(nextCatalog);
            return next;
        });
        setNextColId((n) => n + 1);
    }, [nextColId, onChange]);

    const onColumnRename = useCallback((key: string, value: string) => {
        setLabels((prev) => ({ ...prev, [key]: value }));
    }, []);

    const onDeleteColumn = useCallback((key: string) => {
        setKeys((prev) => prev.filter((k) => k !== key));
        setRows((prev) => {
            const next = prev.map((row) => {
                const updated = { ...row };
                delete updated[key];
                return updated;
            });
            const nextCatalog = next.map(({ id, ...item }) => item);
            onChange(nextCatalog);
            return next;
        });
    }, [onChange]);

    const columns = useMemo<TableColumn<any>[]>(
        () =>
            keys.map((key, i) => ({
                key,
                header: labels[key] ?? key,
                editable,
                width: i === 0 ? "140px" : i === 2 ? "260px" : "120px",
            })),
        [keys, labels, editable]
    );

    const bodyHeight = Math.min(Math.max(rows.length, 1), 14) * 48;

    return (
        <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-transparent overflow-hidden">
            <div className="px-6 py-4 border-b border-border/10 flex items-center justify-between bg-muted/5">
                <div className="space-y-1">
                    <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                        <FileSpreadsheet className="size-4 text-primary" />
                        Vista Previa y Edición de Planilla
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                        {editable
                            ? "Hacé clic en una celda para editar. Usá las manijas de fila y columna para agregar/eliminar."
                            : "Solo lectura."}
                    </p>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-1 bg-muted/20 rounded-full border border-border/10">
                    <span className="text-xs font-bold text-foreground select-none">Editar</span>
                    <Switch
                        label="Editar"
                        checked={editable}
                        onToggle={() => setEditable(v => !v)}
                        className="scale-90"
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 custom-scrollbar flex flex-col">
                <Elevated offset={1} className="border border-border/40 rounded-xl overflow-hidden">
                    <Table
                        data={rows}
                        columns={columns}
                        getRowId={(row) => row.id}
                        rowHeight={48}
                        height={bodyHeight}
                        onCellEdit={editable ? onCellEdit : undefined}
                        onColumnRename={editable ? onColumnRename : undefined}
                        onInsertRow={editable ? onInsertRow : undefined}
                        onDeleteRow={editable ? onDeleteRow : undefined}
                        onInsertColumn={editable ? onInsertColumn : undefined}
                        onDeleteColumn={editable ? onDeleteColumn : undefined}
                        emptyState={
                            <button
                                type="button"
                                onClick={() => onInsertRow(0, "before")}
                                className="rounded-full border border-border px-3 py-1.5 font-bold text-foreground text-xs transition-colors hover:bg-muted"
                            >
                                Insertar primer fila
                            </button>
                        }
                    />
                </Elevated>
            </div>
        </div>
    );
}

type Step = 'config' | 'admin_config' | 'admin_summary' | 'admin_sync' | 'qr_generator' | 'counting';

export default function PreCount() {
    const navigate = useNavigate();
    const { user, logout } = useUser();
    const isAdmin = user?.role === 'admin' || user?.role === 'mod';
    const [step, setStep] = useState<Step>('counting');
    const [autoSave, setAutoSave] = useState(true);

    // Sincronizar preferencia de autoguardado con el gestor de colas en segundo plano
    useEffect(() => {
        import('@/services/syncManager').then(({ syncManager }) => {
            syncManager.setAutoSaveEnabled(autoSave);
        });
    }, [autoSave]);

    const [sortOrder, setSortOrder] = useState<'name_asc' | 'name_desc' | 'qty_asc' | 'qty_desc'>('name_asc');
    const [isManualMode, setIsManualMode] = useState(false);
    const [comboboxAnchor, setComboboxAnchor] = useState<HTMLElement | null>(null);
    const comboboxAnchorRef = useRef<HTMLButtonElement>(null);
    const [sector, setSector] = useState('');
    const [manualEAN, setManualEAN] = useState('');
    const [quantity, setQuantity] = useState(0);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const lastScanTimeRef = useRef<number>(0);
    const [highSpeedMode, setHighSpeedMode] = useState(false);
    const [showQtyDrawer, setShowQtyDrawer] = useState(false);
    const [deviceName, setDeviceName] = useState(() => localStorage.getItem('precount_device_name') || '');
    const isUserAdmin = Boolean(user?.role === 'admin' || user?.role === 'mod');
    const [accessMode, setAccessMode] = useState<'admin' | 'salon' | 'legacy'>(() => isUserAdmin ? 'admin' : 'salon');

    useEffect(() => {
        setAccessMode(isUserAdmin ? 'admin' : 'salon');
    }, [isUserAdmin]);
    const [showAdmin, setShowAdmin] = useState(false);
    const { trigger } = useHaptic();
    const [showFinishDialog, setShowFinishDialog] = useState(false);
    const [finishPassword, setFinishPassword] = useState('');
    const [finishPasswordError, setFinishPasswordError] = useState('');
    const [inventoryName, setInventoryName] = useState('');
    const [inventoryProfile, setInventoryProfile] = useState<'sucursal' | 'sap'>('sucursal');
    const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
    const [parsedStock, setParsedStock] = useState<{ total: number; filename: string; size: number } | null>(null);
    const [masterCatalog, setMasterCatalog] = useState<MasterCatalogItem[] | null>(null);
    const [syncPin, setSyncPin] = useState<string>('');
    const [loadStatus, setLoadStatus] = useState<'success' | 'warning' | 'error' | null>(null);
    const [otpValue, setOtpValue] = useState('');
    const [searchResetKey, setSearchResetKey] = useState(0);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [sessionToResume, setSessionToResume] = useState<PreCountSession | null>(null);
    const [qrQuantities, setQrQuantities] = useState<Record<string, number>>({
        'GO': 5,
        'CA': 10,
        'HE': 2,
        'DE': 1,
        'ES': 5
    });
    const [showQRPrintView, setShowQRPrintView] = useState(false);
    const [showNoZoneDialog, setShowNoZoneDialog] = useState(false);
    const [adminTab, setAdminTab] = useState<string>("conexiones");
    const [isZenMode, setIsZenMode] = useState(false);
    const [pendingFile, setPendingFile] = useState<{ filename: string, rows: any[][], size: number, laboratory?: string } | null>(null);
    const [showAddSectorDialog, setShowAddSectorDialog] = useState(false);
    const [newSectorName, setNewSectorName] = useState('');

    // Listener para Alt + A (Admin Mode)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ALT + A
            if (e.altKey && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) {
                e.preventDefault();
                e.stopPropagation();
                setShowAdmin(prev => {
                    const next = !prev;
                    notify.info("Modo Admin", next ? "Panel de administración activado" : "Panel de administración desactivado");
                    return next;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Listener para datos de Excel desde el Launcher (Electron)
    useEffect(() => {
        if ((window as any).electronAPI) {
            console.log("[Electron] Registrando listener de Excel");
            const cleanup = (window as any).electronAPI.onExcelData((data: any) => {
                const rows = data.rows || [];
                // La Columna O es el índice 14. Buscamos en la primera fila de datos (índice 1)
                const laboratory = rows[1] ? String(rows[1][14] || 'Sin Laboratorio').trim() : 'Desconocido';
                
                console.log(`[Electron] Archivo de ${laboratory} detectado:`, data.filename);
                
                // Si estamos en la pantalla de inicio o configuración, automatizamos el flujo
                if (accessMode === null) {
                    setAccessMode('admin');
                    setStep('admin_config');
                }

                if (step === 'config' || step === 'admin_config') {
                    setInventoryName(`${laboratory} - ${format(new Date(), 'dd/MM HH:mm')}`);
                    handleElectronImport(data);
                } else {
                    // Si ya estamos en una sesión, lo dejamos como pendiente para inyectar
                    setPendingFile({ ...data, laboratory });
                    notify.info("Archivo de Plex25", `Se detectó un archivo de ${laboratory}. ¿Deseas inyectarlo?`, {
                        duration: 10000,
                    });
                }
            });

            return cleanup;
        }
    }, [accessMode, step]);

    const precount = usePreCount();
    const {
        items,
        session,
        totalProducts,
        totalUnits,
        isLoading,
        startSession,
        addItem,
        updateItem,
        removeItem,
        finishSession,
        availableSessions,
        deleteSession,
        resumeSession,
        errorCount,
        registerError,
        connectedDevices,
        receivedFiles = [], // Add default fallback here
        announcePresence,
        sendFinalCount
    } = precount;

    // Memoize combined files for the UI (Admin Side)
    const combinedFiles = useMemo(() => {
        const hookFiles = (receivedFiles || []).map(f => ({
            id: f.id,
            name: f.filename,
            size: f.size,
            content: f.content,
            isReceived: true,
            from: f.deviceName,
            lastModified: f.timestamp
        }));

        const hookFileNames = new Set(hookFiles.map(f => f.name));
        const manualFiles = uploadedFiles.filter(f => !hookFileNames.has(f.name));

        return [...hookFiles, ...manualFiles].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    }, [uploadedFiles, receivedFiles]);

    // Listener for incoming files from devices (Admin Side)
    const [elapsedTime, setElapsedTime] = useState('00:00');

    // Timer effect for real-time counter
    useEffect(() => {
        if (!session) {
            setElapsedTime('00:00');
            return;
        }

        // Try both createdAt and created_at (common in Supabase/Dexie)
        const dateValue = (session as any).created_at || (session as any).createdAt;
        const startTime = dateValue ? new Date(dateValue).getTime() : Date.now();

        const updateTimer = () => {
            if (isNaN(startTime)) {
                setElapsedTime('00:00');
                return;
            }

            const now = new Date().getTime();
            const diff = Math.floor((now - startTime) / 1000);

            if (diff < 0) {
                setElapsedTime('00:00');
                return;
            }

            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;

            setElapsedTime(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000); // Actualizar cada segundo

        return () => clearInterval(interval);
    }, [session]);

    // Calculate Stock Metrics from Master Catalog
    const stockMetrics = useMemo(() => {
        if (!masterCatalog || masterCatalog.length === 0) return null;

        const eans = masterCatalog.filter(item => item.isPrimaryEan).length;
        let positiveUnits = 0;
        let negativeUnits = 0;
        let totalValue = 0;
        let negativeValue = 0;

        masterCatalog.forEach(item => {
            if (!item.isPrimaryEan) return;
            const stock = item.systemStock || 0;
            const price = item.cost || item.salePrice || 0;

            if (stock > 0) positiveUnits += stock;
            if (stock < 0) {
                negativeUnits += Math.abs(stock);
                negativeValue += Math.abs(stock) * price;
            }

            totalValue += stock * price;
        });

        return {
            eans,
            positiveUnits,
            negativeUnits,
            totalValue,
            negativeValue
        };
    }, [masterCatalog]);

    // Auto-Resume Session only on initial load or step entry
    const hasAttemptedAutoResume = useRef(false);
    useEffect(() => {
        if (isAdmin) {
            setAccessMode('admin');
            setStep('counting');
            if (!session && availableSessions.length > 0) {
                const active = availableSessions.find(s => s.status === 'active') || availableSessions[0];
                resumeSession(active, false);
            }
        } else {
            setAccessMode('salon');
            if (session && session.status === 'active') {
                setStep('counting');
            } else {
                const savedSessionId = typeof localStorage !== 'undefined' 
                    ? (localStorage.getItem('last_precount_session_id') || localStorage.getItem('precount_session_id')) 
                    : null;
                if (savedSessionId) {
                    const toResume = availableSessions.find(s => s.id === savedSessionId && s.status === 'active');
                    if (toResume) {
                        resumeSession(toResume, false);
                    } else if (!session) {
                        // Rescatar de Dexie local si la red aún se está restableciendo al desbloquear la terminal
                        db.sessions.get(savedSessionId).then(localSess => {
                            if (localSess && localSess.status === 'active') {
                                resumeSession(localSess as any, false);
                            }
                        }).catch(() => {});
                    }
                }
                setStep('counting');
            }
        }
    }, [isAdmin, session?.id, session?.status, availableSessions]);

    // Exit Warning
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (step === 'counting') {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [step]);




    const [activeLocation, setActiveLocation] = useState<string | null>(null);
    const [showLocationSummary, setShowLocationSummary] = useState(false);
    const [locationStats, setLocationStats] = useState({ products: 0, units: 0 });

    const sessionLocations = useLiveQuery(
        () => session ? db.locations.where('session_id').equals(session.id).toArray() : [],
        [session]
    );

    const isActiveLocationClosed = sessionLocations?.find(l => l.location_tag === activeLocation)?.status === 'closed';

    // Si la ubicación activa quedó cerrada en Supabase/Dexie, deseleccionarla inmediatamente
    useEffect(() => {
        if (isActiveLocationClosed && activeLocation) {
            setActiveLocation(null);
        }
    }, [isActiveLocationClosed, activeLocation]);

    // Auto-select last open (non-closed) sector when entering counting step
    useEffect(() => {
        if (step === 'counting' && sessionLocations && sessionLocations.length > 0 && !activeLocation) {
            const openLocations = sessionLocations.filter(l => l.status !== 'closed');
            if (openLocations.length > 0) {
                const lastOpen = openLocations[openLocations.length - 1];
                setActiveLocation(lastOpen.location_tag);
                notify.info("Zona Restaurada", `Se seleccionó automáticamente: ${lastOpen.location_tag}`);
            }
        }
    }, [step, sessionLocations, activeLocation]);

    // Emitir telemetría liviana y periódica a la PC Admin (sólo en modo carga legacy; en salón lo gestiona PreCountBranchCyclicView)
    useEffect(() => {
        if (!session?.id) return;
        if (accessMode === 'admin' || accessMode === 'salon') return;

        const locMap: Record<string, number> = {};
        items.forEach(i => {
            if (i.location_tag) {
                locMap[i.location_tag] = (locMap[i.location_tag] || 0) + (i.quantity || 1);
            }
        });
        const activeZoneUnits = activeLocation ? (locMap[activeLocation] || 0) : 0;

        emitDeviceTelemetry({
            sessionId: session.id,
            currentLocation: activeLocation || null,
            totalScanned: totalUnits,
            totalSkus: totalProducts,
            locationUnits: activeZoneUnits,
            locationsMap: locMap,
        }).catch(err => console.debug('[Telemetry] emit error:', err));

        const interval = setInterval(() => {
            emitDeviceTelemetry({
                sessionId: session.id,
                currentLocation: activeLocation || null,
                totalScanned: totalUnits,
                totalSkus: totalProducts,
                locationUnits: activeZoneUnits,
                locationsMap: locMap,
            }).catch(() => {});
        }, 6000);

        return () => clearInterval(interval);
    }, [activeLocation, session?.id, totalUnits, totalProducts, items, accessMode]);

    // Build complete sector list from locations table + unique location_tags from items
    const allSectors = useMemo(() => {
        const sectorMap = new Map<string, string>();
        sessionLocations?.forEach(l => {
            sectorMap.set(l.location_tag, l.status || 'open');
        });
        items.forEach(item => {
            if (item.location_tag && !sectorMap.has(item.location_tag)) {
                sectorMap.set(item.location_tag, 'open');
            }
        });
        return Array.from(sectorMap.entries())
            .map(([tag, status]) => ({ tag, status }))
            .sort((a, b) => a.tag.localeCompare(b.tag));
    }, [sessionLocations, items]);

    const sortedItems = useMemo(() => {
        let filtered = activeLocation ? items.filter(item => item.location_tag === activeLocation) : items;

        return [...filtered].sort((a, b) => {
            if (sortOrder === 'name_asc') {
                return (a.productName || '').localeCompare(b.productName || '');
            } else if (sortOrder === 'name_desc') {
                return (b.productName || '').localeCompare(a.productName || '');
            } else if (sortOrder === 'qty_asc') {
                return a.quantity - b.quantity;
            } else if (sortOrder === 'qty_desc') {
                return b.quantity - a.quantity;
            }
            return 0;
        });
    }, [items, activeLocation, sortOrder]);

    // Determine list interaction mode
    // full: open sector, can edit + delete
    // restricted: no sector selected (general view), can delete with confirmation, no edit
    // readonly: closed sector selected, view only
    const listMode: 'full' | 'restricted' | 'readonly' = useMemo(() => {
        if (!activeLocation) return 'restricted';
        if (isActiveLocationClosed) return 'readonly';
        return 'full';
    }, [activeLocation, isActiveLocationClosed]);

    const isOnline = true; // Always online for cloud version

    // Handle Admin File Upload Parsing
    const handleJoinSession = async (pin: string) => {
        // Normalización del PIN para evitar espacios
        const normalizedPin = pin.trim();
        if (normalizedPin.length !== 6) return;
        if (normalizedPin.length < 6) return;

        console.log(`[Sync] Attempting to join session with PIN: ${normalizedPin}`);

        // 1. Prioridad Absoluta: Buscar en Supabase por PIN
        // Ignoramos lo que haya localmente para evitar desfases
        let remoteSession = await getSessionByPin(normalizedPin);

        // Reintento rápido por si la red es inestable
        if (!remoteSession) {
            console.log('[Sync] PIN not found, retrying in 1s...');
            await new Promise(r => setTimeout(r, 1000));
            remoteSession = await getSessionByPin(normalizedPin);
        }

        if (remoteSession) {
            console.log('[Sync] Session found remotely:', remoteSession.id);
            localStorage.setItem('last_precount_session_id', remoteSession.id);
            localStorage.setItem('precount_session_id', remoteSession.id);

            await resumeSession(remoteSession);
            await announcePresence(remoteSession.id);
            emitDeviceTelemetry({
                sessionId: remoteSession.id,
                currentLocation: null,
                totalScanned: 0,
                totalSkus: 0
            }).catch(() => {});
            setStep('counting');
            notify.success("Conectado", `Unido a: ${remoteSession.sector}`);
            return;
        }

        // 2. Fallback de emergencia solo para testing
        if (normalizedPin === "123456" && availableSessions.length > 0) {
            const fallbackSession = availableSessions[0];
            localStorage.setItem('last_precount_session_id', fallbackSession.id);
            localStorage.setItem('precount_session_id', fallbackSession.id);
            await resumeSession(fallbackSession);
            await announcePresence(fallbackSession.id);
            emitDeviceTelemetry({
                sessionId: fallbackSession.id,
                currentLocation: null,
                totalScanned: 0,
                totalSkus: 0
            }).catch(() => {});
            setStep('counting');
            notify.success("Modo Demo", `Unido a la primera sesión disponible.`);
            return;
        }

        notify.error("Error", "Código de sincronización inválido o sesión no encontrada.");
        setOtpValue('');
    };

    const handleElectronImport = (data: { filename: string, rows: any[][], size: number }) => {
        try {
            if (!data.rows || data.rows.length < 2) {
                throw new Error("El archivo no contiene suficientes datos.");
            }

            const worker = new ExcelNightWorker();

            worker.onmessage = (eMsg) => {
                const { success, error, catalog } = eMsg.data;

                if (error) {
                    notify.error("Error", error);
                    setLoadStatus('error');
                    worker.terminate();
                    return;
                }

                if (success) {
                    const primaryCount = catalog.filter((item: MasterCatalogItem) => item.isPrimaryEan).length;
                    if (catalog.length === 0) {
                        setLoadStatus('warning');
                        notify.error("Error de formato", "No se encontraron productos válidos en el archivo.");
                    } else {
                        setLoadStatus('success');
                        notify.success("Datos Cargados", `Se procesaron ${primaryCount} productos correctamente.`);
                        
                        // Autocompletar nombre si estamos en configuración
                        if (step === 'admin_config' || step === 'config') {
                            const laboratory = catalog[0]?.laboratory || '';
                            const suffix = laboratory ? ` (${laboratory})` : '';
                            setInventoryName(data.filename.replace(/\.[^/.]+$/, "") + suffix);
                        }
                    }

                    setMasterCatalog(catalog);
                    setParsedStock({
                        total: primaryCount,
                        filename: data.filename,
                        size: data.size
                    });
                    
                    worker.terminate();
                }
            };

            worker.onerror = (err) => {
                console.error("Worker Error:", err);
                notify.error("Error", "Hubo un fallo crítico al procesar los datos de Electron.");
                setLoadStatus('error');
                worker.terminate();
            };

            worker.postMessage({ rows: data.rows, profile: inventoryProfile });

        } catch (err) {
            console.error("Error en handleElectronImport:", err);
            notify.error("Error", 'No se pudo procesar el archivo. Verifique el formato.');
            setLoadStatus('error');
        }
    };

    const handleFileChange = async (files: any[]) => {
        setUploadedFiles(files);
        if (files.length > 0) {
            const file = files[0].file;
            if (file instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const fileContent = e.target?.result;
                    const worker = new ExcelNightWorker();

                    worker.onmessage = (eMsg) => {
                        const { success, error, catalog } = eMsg.data;

                        if (error) {
                            notify.error("Error", error);
                            setLoadStatus('error');
                            setUploadedFiles([]);
                            setMasterCatalog(null);
                            worker.terminate();
                            return;
                        }

                        if (success) {
                            const primaryCount = catalog.filter((item: MasterCatalogItem) => item.isPrimaryEan).length;
                            if (catalog.length === 0) {
                                setLoadStatus('warning');
                                notify.error("Error de formato", "No se encontraron productos válidos en el archivo estructurado.");
                            } else {
                                setLoadStatus('success');
                                notify.success("Datos Cargados", `Se procesaron ${primaryCount} productos correctamente.`);
                                
                                // Autocompletar nombre si estamos en configuración
                                if (step === 'admin_config' || step === 'config') {
                                    const rawFileName = file.name.replace(/\.[^/.]+$/, "");
                                    const cleanFileName = rawFileName
                                        .replace(/^LISTADO[_\s]+DE[_\s]+STOCK[_\s-]*/i, "")
                                        .replace(/_/g, " ")
                                        .trim();

                                    const laboratory = catalog[0]?.laboratory?.trim() || '';
                                    let finalName = cleanFileName;
                                    if (laboratory && !cleanFileName.toLowerCase().includes(laboratory.toLowerCase())) {
                                        finalName = `${cleanFileName} (${laboratory})`;
                                    }
                                    setInventoryName(finalName || rawFileName);
                                }
                            }

                            setMasterCatalog(catalog);
                            setParsedStock({
                                total: primaryCount,
                                filename: file.name,
                                size: file.size
                            });
                            
                            worker.terminate();
                        }
                    };

                    worker.onerror = (err) => {
                        console.error("Worker Error:", err);
                        notify.error("Error", "Hubo un fallo crítico al procesar el archivo.");
                        setLoadStatus('error');
                        setUploadedFiles([]);
                        setMasterCatalog(null);
                        worker.terminate();
                    };

                    worker.postMessage({ fileData: fileContent, profile: inventoryProfile });
                };
                reader.readAsBinaryString(file);
            }
        } else {
            setParsedStock(null);
            setMasterCatalog(null);
            setLoadStatus(null);
        }
    };

    // Paso 1: Configuración
    const handleStartSession = async () => {
        const sectorName = accessMode === 'admin' ? inventoryName : sector;

        if (!sectorName.trim()) {
            notify.error("Error", `Por favor, ingresa el nombre del ${accessMode === 'admin' ? 'inventario' : 'sector'}`);
            return;
        }

        // Save device name to localStorage
        if (deviceName.trim()) {
            localStorage.setItem('precount_device_name', deviceName.trim());
        }

        // Limpiar archivos subidos (el Excel maestro ya fue procesado y guardado en masterCatalog)
        setUploadedFiles([]);

        // Si ya hay una sesión activa (creada en el paso admin_summary), NO crear otra.
        // Solo transicionar a la pantalla de conteo.
        if (session && session.status === 'active') {
            console.log('[PreCount] Session already exists, skipping creation. ID:', session.id);
            setStep('counting');
            return;
        }

        await startSession(sectorName.trim(), masterCatalog || undefined, syncPin || undefined, inventoryProfile);
        setStep('counting');
    };

    // Manejar escaneo de código de barras
    const handleBarcodeScan = async (code: string) => {
        try {
            console.log('Barcode scanned (Hardware):', code);

            lastScanTimeRef.current = Date.now();

            let productToUse: any = null;

            // 1. Prioridad: Buscar en la base de datos local SQLite (.db) de Tauri (< 1ms sin red)
            try {
                const localProd = await searchLocalBarcode(code);
                if (localProd) {
                    productToUse = {
                        ean: code,
                        name: localProd.name,
                        cost: localProd.cost || 0,
                        salePrice: localProd.sale_price || 0,
                        stock: localProd.stock || 0,
                        id_producto: localProd.id_producto,
                        isMaster: true
                    };
                }
            } catch (err) {
                console.debug('[PreCount] SQLite local lookup error/fallback:', err);
            }

            // 2. Si no se encontró en SQLite o en modo web, buscar en IndexedDB de la sesión activa (por EAN o por id_producto)
            if (!productToUse && session?.id) {
                let dbProduct = await db.precount_products
                    .where('[session_id+ean]')
                    .equals([session.id, code])
                    .first();

                if (!dbProduct) {
                    try {
                        dbProduct = await db.precount_products
                            .where('[session_id+id_producto]')
                            .equals([session.id, code])
                            .first();
                    } catch {
                        // fallback if compound index not initialized
                    }
                }

                if (!dbProduct) {
                    dbProduct = await db.precount_products
                        .where('session_id').equals(session.id)
                        .filter(p => p.id_producto === code || String(p.id_producto).trim() === code)
                        .first();
                }

                if (dbProduct) {
                    productToUse = {
                        ean: dbProduct.ean || code,
                        name: dbProduct.name,
                        cost: dbProduct.cost,
                        salePrice: dbProduct.salePrice || 0,
                        stock: dbProduct.stock || 0,
                        id_producto: dbProduct.id_producto,
                        isMaster: true
                    };
                }
            }

            // 3. Si aún no se encontró, buscar en el backend Supabase por EAN o IDProducto
            if (!productToUse) {
                try {
                    const { getProductByEanOrId } = await import('@/services/productService');
                    const remoteProd = await getProductByEanOrId(code);
                    if (remoteProd) {
                        productToUse = {
                            ean: remoteProd.ean || code,
                            name: remoteProd.name,
                            cost: remoteProd.cost || 0,
                            salePrice: remoteProd.salePrice || 0,
                            stock: remoteProd.stock || 0,
                            id_producto: remoteProd.id_producto,
                            isMaster: true
                        };
                    }
                } catch (remoteErr) {
                    console.debug('[PreCount] Backend lookup error:', remoteErr);
                }
            }

            if (productToUse) {
                setSelectedProduct(productToUse);
                setManualEAN(code);

                if (highSpeedMode) {
                    // Fast flow: Add immediately with 1
                    const qtyToAdd = 1;
                    await addItem(code, productToUse.name, qtyToAdd, productToUse.id_producto, activeLocation || undefined);

                    toast.success(`${productToUse.name} agregado (+1)`, {
                        description: `EAN: ${code} | Zona: ${activeLocation}`,
                        duration: 1500,
                        position: 'top-center',
                        icon: <CheckCircle className="size-4 text-emerald-500" />
                    });

                    setManualEAN('');
                    setSelectedProduct(null);
                    setSearchResetKey(prev => prev + 1);
                    trigger('success');
                    playSound('success');
                } else {
                    // notify.success("Operación exitosa", `Producto encontrado: ${productToUse.name}`);
                    trigger('success');
                    // En móvil (modo Cantidad): abrir teclado virtual
                    // En desktop: enfocar el input de cantidad
                    setTimeout(() => {
                        const qtyInput = document.getElementById('quantity-input') as HTMLInputElement;
                        if (qtyInput) {
                            qtyInput.focus();
                            qtyInput.select();
                        }
                    }, 100);
                }
            } else {
                setManualEAN(code);
                notify.warning("Advertencia", 'Producto no encontrado en la base de datos', {
                    description: 'Puedes agregarlo manualmente',
                });
                registerError();
                trigger('warning');
                playSound('error');
            }
        } catch (error) {
            console.error('Error fetching product:', error);
            notify.error("Error", 'Error al buscar el producto');
        }
    };

    // Nueva lógica para manejar escaneo de zonas (Apertura/Cierre) con validación atómica
    const handleLocationScan = async (code: string) => {
        if (!session) return;

        // Reglas de negocio: ESP-, CA-, DEP-, EST-, GO-
        const isZoneCode = /^(ESP|CA|DEP|EST|GO)-/i.test(code);
        if (!isZoneCode) return false;

        const normalizedCode = code.toUpperCase();

        // 1. Si ya estamos en ESA zona -> Intentar CERRAR
        if (activeLocation === normalizedCode) {
            const { getPreCountItemsBySessionId } = await import('@/services/preCountDB');
            const sessionItems = await getPreCountItemsBySessionId(session.id);
            const zoneItems = sessionItems.filter(i => i.location_tag === normalizedCode);

            const stats = {
                products: zoneItems.length,
                units: zoneItems.reduce((acc, curr) => acc + curr.quantity, 0)
            };

            setLocationStats(stats);
            setShowLocationSummary(true);
            trigger('warning');
            return true;
        }

        // 2. Si estamos en OTRA zona (y está abierta) -> Forzar cierre de la anterior
        if (activeLocation && activeLocation !== normalizedCode && !isActiveLocationClosed) {
            notify.warning("Zona ocupada", `Debes cerrar ${getFullSectorName(activeLocation)} antes de cambiar de zona.`);
            trigger('error');
            return true;
        }

        // 3. Abrir o Validar sector atómicamente contra Supabase
        try {
            const { claimOrValidateLocation } = await import('@/services/preCountDB');
            const result = await claimOrValidateLocation(
                session.id,
                normalizedCode,
                localStorage.getItem('precount_operator_name') || undefined,
                localStorage.getItem('precount_device_name') || undefined
            );

            if (!result.success) {
                if (result.code === 'ALREADY_CLOSED') {
                    notify.warning("Sector Cerrado", `El sector ${getFullSectorName(normalizedCode)} ya fue contabilizado y cerrado.`);
                    trigger('error');
                    playSound('error');
                    return true;
                }
                if (result.code === 'OCCUPIED') {
                    const who = result.opened_by_user || 'otro operario';
                    const dev = result.opened_by_device ? ` (${result.opened_by_device})` : '';
                    notify.warning("Sector Ocupado", `El sector ${getFullSectorName(normalizedCode)} ya está siendo operado por ${who}${dev}.`);
                    trigger('error');
                    playSound('error');
                    return true;
                }
                if (result.code === 'NOT_CONFIGURED') {
                    notify.error("Sector No Válido", `El sector ${normalizedCode} no forma parte de los sectores preconfigurados.`);
                    trigger('error');
                    playSound('error');
                    return true;
                }
            }

            // Exitoso: Asignar
            setActiveLocation(normalizedCode);
            notify.success("Sector Asignado", `📍 Contando en: ${getFullSectorName(normalizedCode)}`);
            trigger('success');
            playSound('success');

            // Calcular mapa de unidades por zona
            const locMap: Record<string, number> = {};
            items.forEach(i => {
                if (i.location_tag) {
                    locMap[i.location_tag] = (locMap[i.location_tag] || 0) + (i.quantity || 1);
                }
            });

            // Emitir telemetría de inmediato para actualizar el monitor sin delay
            emitDeviceTelemetry({
                sessionId: session.id,
                currentLocation: normalizedCode,
                totalScanned: totalUnits,
                totalSkus: totalProducts,
                locationUnits: locMap[normalizedCode] || 0,
                locationsMap: locMap,
            }).catch(() => {});

            return true;
        } catch (err) {
            console.error('[PreCount] Error al abrir sector:', err);
            return true;
        }
    };

    const confirmCloseLocation = async () => {
        if (!session || !activeLocation) return;

        const closedLoc = activeLocation;
        try {
            // 1. Calcular mapa completo de unidades y unidades específicas de la zona cerrada
            const locMap: Record<string, number> = {};
            items.forEach(i => {
                if (i.location_tag) {
                    locMap[i.location_tag] = (locMap[i.location_tag] || 0) + (i.quantity || 1);
                }
            });
            const closedUnits = locMap[closedLoc] || 0;

            const { closeLocationWithSync } = await import('@/services/preCountDB');
            await closeLocationWithSync(
                session.id,
                closedLoc,
                localStorage.getItem('precount_operator_name') || undefined,
                localStorage.getItem('precount_device_name') || undefined,
                undefined,
                closedUnits
            );

            // Vaciar inmediatamente cualquier producto pendiente de la zona cerrada hacia Supabase
            try {
                const { syncManager } = await import('@/services/syncManager');
                await syncManager.flushNow();
            } catch (syncErr) {
                console.debug('[PreCount] Error flushNow al cerrar zona:', syncErr);
            }

            setActiveLocation(null);
            setShowLocationSummary(false);
            trigger('success');
            playSound('success');

            // Emitir telemetría inmediatamente con currentLocation = null y pasando locMap
            // para que la zona cerrada pase a completed con sus unidades reales en el monitor
            emitDeviceTelemetry({
                sessionId: session.id,
                currentLocation: null,
                totalScanned: totalUnits,
                totalSkus: totalProducts,
                locationUnits: 0,
                locationsMap: locMap,
            }).catch(() => {});

            notify.success("Sector Cerrado", `Se cerró con éxito: ${getFullSectorName(closedLoc)} (${closedUnits} un.)`);
        } catch (error) {
            notify.error("Error", "No se pudo cerrar la zona");
        }
    };

    // Generar PDF de Etiquetas QR
    const generateLocationQRPDF = async () => {
        try {
            notify.info("Generando PDF", "Preparando etiquetas para impresión...");
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 10;
            const cols = 4;
            const rows = 5;
            const cellWidth = (pageWidth - (margin * 2)) / cols;
            const cellHeight = (pageHeight - (margin * 2)) / rows;

            let x = margin;
            let y = margin;
            let count = 0;

            const allLabels = Object.entries(qrQuantities).flatMap(([prefix, qty]) => {
                const name = prefix === 'GO' ? 'Góndola' :
                    prefix === 'CA' ? 'Cajón' :
                        prefix === 'HE' ? 'Heladera' :
                            prefix === 'DE' ? 'Depósito' :
                                prefix === 'ES' ? 'Estantería' : prefix;
                return Array.from({ length: qty }, (_, i) => ({
                    code: `${prefix}-${(i + 1).toString().padStart(2, '0')}`,
                    name
                }));
            });

            if (allLabels.length === 0) {
                notify.warning("Sin etiquetas", "No has definido cantidades para imprimir.");
                return;
            }

            for (const label of allLabels) {
                if (count > 0 && count % (cols * rows) === 0) {
                    doc.addPage();
                    x = margin;
                    y = margin;
                }

                // Dibujar Celda (Borde punteado simulado)
                doc.setDrawColor(200);
                doc.setLineWidth(0.1);
                (doc as any).setLineDashPattern([2, 2], 0);
                doc.roundedRect(x, y, cellWidth, cellHeight, 3, 3, 'S');
                (doc as any).setLineDashPattern([], 0);

                // Generar QR
                const qrSize = cellWidth * 0.6;
                const qrX = x + (cellWidth - qrSize) / 2;
                const qrY = y + 8;

                const qrDataUrl = await QRCode.toDataURL(label.code, {
                    margin: 0,
                    errorCorrectionLevel: 'H',
                    color: { dark: '#000000', light: '#ffffff' }
                });

                doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

                // Texto descriptivo (Tipo de Zona)
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.setFont("helvetica", "bold");
                const typeWidth = doc.getTextWidth(label.name.toUpperCase());
                doc.text(label.name.toUpperCase(), x + (cellWidth - typeWidth) / 2, qrY + qrSize + 5);

                // Código (GO-01)
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.setFont("helvetica", "bold");
                const codeWidth = doc.getTextWidth(label.code);
                doc.text(label.code, x + (cellWidth - codeWidth) / 2, qrY + qrSize + 12);

                // Actualizar coordenadas
                x += cellWidth;
                if ((count + 1) % cols === 0) {
                    x = margin;
                    y += cellHeight;
                }
                count++;
            }

            doc.save(`Etiquetas_QR_${inventoryName || 'Sucursal'}_${new Date().getTime()}.pdf`);
            notify.success("PDF Generado", "Se ha descargado el archivo de etiquetas.");
            trigger('success');
        } catch (err) {
            console.error(err);
            notify.error("Error", "No se pudo generar el PDF de etiquetas.");
        }
    };

    // Hardware Scanner Listener
    useHardwareScanner({
        onScan: async (code) => {
            if (step === 'counting') {
                // Primero intentamos ver si es una ubicación
                const handledAsLocation = await handleLocationScan(code);
                if (!handledAsLocation) {
                    handleBarcodeScan(code);
                }
            } else if (step === 'config') {
                // Permitir unirse a sesión escaneando el código de sincronización
                handleJoinSession(code);
            }
        },
        minChars: 4 // Permitir códigos de zona cortos
    });

    const handleProductSelect = (product: Product) => {
        setSelectedProduct(product);
        setManualEAN(product.ean);
    };

    // Agregar producto al colector
    const handleAddProduct = async () => {
        if (!manualEAN.trim()) {
            notify.error("Error", 'Por favor, ingresa o escanea un código EAN');
            return;
        }

        const baseQty = quantity;
        if (isNaN(baseQty) || baseQty === 0) {
            notify.error("Error", 'Por favor, ingresa una cantidad válida');
            return;
        }

        const qty = baseQty;

        let productName = selectedProduct?.name;
        let idProducto = selectedProduct?.id_producto;

        // Si no hay producto seleccionado, intentar buscarlo en IndexedDB de la sesión -> cache -> bd por EAN o ID
        const cleanEanOrId = manualEAN.trim();
        if (!productName && session?.id) {
            let dbProduct = await db.precount_products
                .where('[session_id+ean]')
                .equals([session.id, cleanEanOrId])
                .first();

            if (!dbProduct) {
                try {
                    dbProduct = await db.precount_products
                        .where('[session_id+id_producto]')
                        .equals([session.id, cleanEanOrId])
                        .first();
                } catch {
                    // Fallback
                }
            }

            if (!dbProduct) {
                dbProduct = await db.precount_products
                    .where('session_id').equals(session.id)
                    .filter(p => p.id_producto === cleanEanOrId || String(p.id_producto).trim() === cleanEanOrId)
                    .first();
            }

            if (dbProduct) {
                productName = dbProduct.name;
                idProducto = dbProduct.id_producto;
            }
        }

        if (!productName) {
            const cached = await enhancedProductCache.get(cleanEanOrId);
            if (cached) {
                productName = cached.name;
                if (!idProducto) idProducto = cached.id_producto;
            }
        }

        if (!productName) {
            try {
                const { getProductByEanOrId } = await import('@/services/productService');
                const remoteProd = await getProductByEanOrId(cleanEanOrId);
                if (remoteProd) {
                    productName = remoteProd.name;
                    if (!idProducto) idProducto = remoteProd.id_producto;
                }
            } catch (err) {
                console.debug('[PreCount] Error lookup backend:', err);
            }
        }

        // Si estamos editando, usar updateItem para reemplazar el valor
        if (editingItemId) {
            await updateItem(editingItemId, qty);
            setEditingItemId(null);
            notify.success("Actualizado", "Cantidad modificada correctamente");
        } else {
            await addItem(manualEAN, productName || 'Producto Desconocido', qty, idProducto, activeLocation || undefined);
        }

        // Limpiar formulario y devolver foco al buscador
        setManualEAN('');
        setQuantity(0);
        setSelectedProduct(null);
        setSearchResetKey(prev => prev + 1);

        // Timeout breve para asegurar que el renderizado limpie el estado antes de enfocar
        setTimeout(() => {
            document.getElementById('smart-search-input')?.focus();
        }, 50);
    };

    // Abrir diálogo de finalización
    const handleFinishClick = () => {
        if (items.length === 0) {
            notify.error("Error", 'No hay productos para finalizar');
            return;
        }
        setFinishPassword('');
        setFinishPasswordError('');
        setShowFinishDialog(true);
    };

    // Reiniciar sector actual
    const handleResetSector = async () => {
        if (!activeLocation || !session) {
            notify.warning("Sin zona activa", "Debes estar en una zona para reiniciarla");
            return;
        }

        const confirmReset = window.confirm(`¿Estás seguro de que deseas reiniciar la zona ${activeLocation}? Se borrarán todos los productos contados en esta zona.`);
        if (!confirmReset) return;

        try {
            // Filter items to find those in this location
            const itemsToDelete = items.filter(i => i.location_tag === activeLocation);
            for (const item of itemsToDelete) {
                await removeItem(item.id);
            }
            notify.success("Zona reiniciada", `Se han borrado los productos de la zona ${activeLocation}`);
            trigger('warning');
        } catch (error) {
            notify.error("Error", "No se pudo reiniciar la zona");
        }
    };


    // Confirmar finalización con contraseña
    const handleConfirmFinish = async () => {
        if (finishPassword !== 'farmaplus') {
            setFinishPasswordError('Contraseña incorrecta');
            return;
        }
        setShowFinishDialog(false);
        setFinishPassword('');

        // Si no es admin, enviamos el archivo al admin y salimos LOCALMENTE
        if (accessMode !== 'admin') {
            const content = await generateTXTContent();
            if (content) {
                const filename = `Colector_${deviceName || 'Zebra'}_${session?.sector}_${new Date().toISOString().split('T')[0]}.txt`;

                // Notificamos que estamos enviando
                notify.info("Enviando...", "Sincronizando conteo con el administrador");

                const sent = await sendFinalCount(filename, content);
                if (sent) {
                    notify.success("Enviado", "El conteo ha sido enviado al Administrador.");
                } else {
                    notify.warning("Sincronización diferida", "El conteo se envió por broadcast. Verifique en el panel Admin.");
                }
            }

            // IMPORTANTE: NO llamamos a finishSession() si no es admin
            // Solo limpiamos el estado local para volver al inicio
            setStep('counting');
            notify.success("Sesión terminada", "Has finalizado tu parte del conteo.");
        } else {
            // Si es admin, descarga el consolidado y CIERRA para todos
            handleExportTXT();
            await finishSession();
            notify.success("Inventario Finalizado", "El inventario global ha sido cerrado.");
            setStep('counting');
        }
    };



    // Generar contenido del TXT (Formato: IDProducto;EAN;Cantidad;0)
    const generateTXTContent = async () => {
        if (items.length === 0) return null;

        // Si no es admin, solo enviamos lo que escaneó ESTE dispositivo
        const deviceId = getDeviceId();
        const filteredItems = accessMode === 'admin'
            ? items
            : items.filter(item => item.deviceId === deviceId);

        if (filteredItems.length === 0) {
            console.warn('[Sync] No items found for this device to export');
            return null;
        }

        // Mapa de catálogo para resolver ID de producto si no vino grabado
        const productMap = new Map<string, string>();
        try {
            const allCatalogProds = await db.precount_products.toArray();
            for (const p of allCatalogProds) {
                if (p.id_producto) {
                    if (p.ean) productMap.set(String(p.ean).trim(), String(p.id_producto).trim());
                    if (Array.isArray(p.eans)) {
                        for (const altEan of p.eans) {
                            if (altEan) productMap.set(String(altEan).trim(), String(p.id_producto).trim());
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[PreCount] Error cargando catálogo local para exportación:', e);
        }

        if (session?.master_catalog) {
            for (const p of session.master_catalog) {
                if (p.id_producto) {
                    const idStr = String(p.id_producto).trim();
                    if (p.ean && !productMap.has(String(p.ean).trim())) {
                        productMap.set(String(p.ean).trim(), idStr);
                    }
                    if (Array.isArray(p.eans)) {
                        for (const altEan of p.eans) {
                            const trimmedAlt = String(altEan).trim();
                            if (trimmedAlt && !productMap.has(trimmedAlt)) {
                                productMap.set(trimmedAlt, idStr);
                            }
                        }
                    }
                }
            }
        }

        const lines = filteredItems.map(item => {
            const eanStr = String(item.ean || '').trim();
            const rawId = item.id_producto ? String(item.id_producto).trim() : '';
            const mappedId = eanStr ? productMap.get(eanStr) : undefined;
            const isShortCode = eanStr.length > 0 && eanStr.length <= 7 && /^\d+$/.test(eanStr);
            const idProd = rawId || mappedId || (isShortCode ? eanStr : '') || eanStr || '0';
            return `${idProd};${eanStr};${item.quantity};0`;
        });
        return lines.join('\n');
    };

    // Exportar a TXT
    const handleExportTXT = async () => {
        const content = await generateTXTContent();
        if (!content) {
            notify.error("Error", 'No hay productos para exportar');
            return;
        }

        try {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ColectorDatos_${sector || session?.sector}_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            notify.success("Operación exitosa", 'Archivo TXT generado correctamente');
        } catch (error) {
            console.error('Error generating TXT:', error);
            notify.error("Error", 'Error al generar el archivo TXT');
        }
    };

    // Exportar Conciliación a Excel
    const handleExportExcel = () => {
        if (!session?.master_catalog) {
            notify.error("Error", 'No hay catálogo maestro cargado para conciliar');
            return;
        }

        try {
            // 1. Group items by EAN and sum quantity, also track locations
            const groupedItems: Record<string, number> = {};
            const itemLocations: Record<string, Set<string>> = {};

            items.forEach(item => {
                groupedItems[item.ean] = (groupedItems[item.ean] || 0) + item.quantity;
                if (item.location_tag) {
                    if (!itemLocations[item.ean]) itemLocations[item.ean] = new Set();
                    itemLocations[item.ean].add(item.location_tag);
                }
            });

            // 2. Cross with Master Catalog
            const isSapProfile = session?.profile === 'sap';
            const results: any[] = [];
            const processedEans = new Set<string>();

            // Aggregate totals for a summary row at the bottom
            let totalPhysical = 0;
            let totalSystem = 0;
            let totalDiffVal = 0;

            // Solo iterar sobre los EANs primarios para evitar contar el stock
            // del sistema múltiples veces cuando un producto tiene varios EANs.
            // Los EANs secundarios también se contabilizan porque groupedItems los acumula.
            const catalogForReport = session.master_catalog.filter(
                m => m.isPrimaryEan !== false || !m.eans || m.eans.length <= 1
            );

            catalogForReport.forEach(master => {
                // Sumar conteo de TODOS los EANs del mismo producto
                const allEans = master.eans && master.eans.length > 0 ? master.eans : [master.ean];
                const counted = allEans.reduce((sum, ean) => sum + (groupedItems[ean] || 0), 0);
                allEans.forEach(ean => processedEans.add(ean));

                totalPhysical += counted;
                totalSystem += master.systemStock;

                if (isSapProfile) {
                    // ponytail: keep exact SAP columns layout
                    results.push({
                        'MATERIAL': master.id_producto,
                        'EAN': master.ean,
                        'DESCRIPCION': master.name,
                        'STOCK SAP': master.systemStock,
                        'STOCK FISICO': counted
                    });
                } else {
                    const diffQty = counted - master.systemStock;
                    const diffValue = diffQty * master.cost;
                    totalDiffVal += diffValue;

                    results.push({
                        'Código (EAN)': master.ean,
                        'Producto': master.name,
                        'Cant. Física (Colector)': counted,
                        'Cant. Sistema (Excel)': master.systemStock,
                        'Diferencia (U)': diffQty,
                        'Costo Unitario': master.cost,
                        'Diferencia Val ($)': diffValue,
                        'Estado': diffQty > 0 ? 'Sobrante' : diffQty < 0 ? 'Faltante' : 'OK',
                        'Ubicación': Array.from(itemLocations[master.ean] || []).join(', ')
                    });
                }
            });

            // 3. Add products scanned that are NOT in master catalog (Nuevos)
            Object.keys(groupedItems).forEach(ean => {
                if (!processedEans.has(ean)) {
                    const foundItem = items.find(i => i.ean === ean);
                    const name = foundItem?.productName || 'Desconocido';
                    const counted = groupedItems[ean];

                    totalPhysical += counted;

                    if (isSapProfile) {
                        results.push({
                            'MATERIAL': foundItem?.id_producto || 'NUEVO',
                            'EAN': ean,
                            'DESCRIPCION': name,
                            'STOCK SAP': 0,
                            'STOCK FISICO': counted
                        });
                    } else {
                        results.push({
                            'Código (EAN)': ean,
                            'Producto': name,
                            'Cant. Física (Colector)': counted,
                            'Cant. Sistema (Excel)': 0,
                            'Diferencia (U)': counted,
                            'Costo Unitario': 0,
                            'Diferencia Val ($)': 0,
                            'Estado': 'Sobrante (NUEVO)',
                            'Ubicación': Array.from(itemLocations[ean] || []).join(', ')
                        });
                    }
                }
            });

            if (!isSapProfile) {
                // Sort results so Faltantes are at the top, followed by Sobrantes, then OK
                results.sort((a, b) => a['Diferencia Val ($)'] - b['Diferencia Val ($)']);

                // Append a summary row
                results.push({
                    'Código (EAN)': 'TOTALES',
                    'Producto': '',
                    'Cant. Física (Colector)': totalPhysical,
                    'Cant. Sistema (Excel)': totalSystem,
                    'Diferencia (U)': totalPhysical - totalSystem,
                    'Costo Unitario': '',
                    'Diferencia Val ($)': totalDiffVal,
                    'Estado': ''
                });
            }

            // 4. Create and download Excel
            const ws = XLSX.utils.json_to_sheet(results);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Conciliación de Stock");

            XLSX.writeFile(wb, `Conciliacion_${sector}_${new Date().toISOString().split('T')[0]}.xlsx`);

            notify.success("Exportado exitosamente", "El Excel con las diferencias ha sido descargado.");
        } catch (error) {
            console.error('Error generating Excel:', error);
            notify.error("Error", 'Error al generar la conciliación en Excel.');
        }
    };

    // Exportar a PDF
    const handleExportPDF = () => {
        if (items.length === 0) {
            notify.error("Error", 'No hay productos para exportar');
            return;
        }

        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 10;
            const cols = 3;
            const gap = 3; // Reduced gap
            const cellWidth = (pageWidth - (margin * 2) - (gap * (cols - 1))) / cols;
            const cellHeight = 28; // Reduced height to fit more items (Compact Layout)

            let x = margin;
            let y = margin + 15; // Reduced top margin for title

            // Título del documento
            doc.setFontSize(14);
            doc.text(`Colector de Datos: ${sector}`, margin, margin + 5);
            doc.setFontSize(8);
            doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - margin - 30, margin + 5);

            items.forEach((item, index) => {
                // Verificar si necesitamos una nueva página
                if (y + cellHeight > pageHeight - margin) {
                    doc.addPage();
                    y = margin;
                }

                // Dibujar borde de la celda
                doc.setDrawColor(200);
                doc.setLineWidth(0.1);
                doc.roundedRect(x, y, cellWidth, cellHeight, 2, 2, 'S');

                // --- Layout Compacto ---

                // 1. Nombre del Producto (Arriba, truncado a 1 línea si es largo)
                const contentWidth = cellWidth - 4;
                const titleX = x + 2;
                const titleY = y + 5;

                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");

                // Truncar texto si es muy largo para que entre en una línea
                let title = item.productName;
                if (doc.getTextWidth(title) > contentWidth) {
                    // Simple truncation logic
                    const maxChars = Math.floor(contentWidth / 2); // Aprox conversion
                    title = title.substring(0, maxChars) + "...";
                }
                doc.text(title, titleX, titleY);

                // 2. Código de Barras (Abajo Izquierda)
                const barcodeWidth = cellWidth * 0.65; // 65% del ancho
                const barcodeHeight = 15;
                const barcodeX = x + 2;
                const barcodeY = y + 8;

                const canvas = document.createElement('canvas');
                try {
                    const barcodeOptions = {
                        displayValue: true,
                        fontSize: 14,
                        fontOptions: "bold",
                        margin: 0,
                        height: 40,
                        width: 2,
                        background: "#ffffff",
                        lineColor: "#000000",
                        textMargin: 0,
                    };

                    // Use CODE128 to avoid automatic check digit calculation
                    // EAN13 format adds an extra digit which causes scanner issues
                    JsBarcode(canvas, item.ean, {
                        ...barcodeOptions,
                        format: "CODE128",
                    });

                    const barcodeData = canvas.toDataURL("image/png");
                    doc.addImage(barcodeData, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
                } catch (e) {
                    console.error('Error generating barcode:', e);
                    doc.setFontSize(8);
                    doc.setTextColor(255, 0, 0);
                    doc.text("Error Barcode", barcodeX, barcodeY + 10);
                    doc.setTextColor(0, 0, 0);
                }

                // 3. Cantidad (Abajo Derecha - Grande)
                const qtyX = x + cellWidth - 2;
                const qtyY = y + cellHeight - 6;

                doc.setFontSize(24);
                doc.setFont("helvetica", "bold");
                doc.text(item.quantity.toString(), qtyX, qtyY, { align: "right" });

                // Etiqueta "Cant." muy pequeña arriba del número o al lado
                doc.setFontSize(6);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100);
                doc.text("CANT", qtyX, qtyY - 10, { align: "right" });
                doc.setTextColor(0);

                // Mover a la siguiente columna/fila
                if ((index + 1) % cols === 0) {
                    x = margin;
                    y += cellHeight + gap;
                } else {
                    x += cellWidth + gap;
                }
            });

            const fileName = `ColectorDatos_${sector}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            notify.success("Operación exitosa", 'PDF generado correctamente');

        } catch (error) {
            console.error('Error generating PDF:', error);
            notify.error("Error", 'Error al generar el PDF');
        }
    };

    // Vista de Configuración (Nueva Sesión / Seleccionar)
    // Screen 1: Admin Config (Title + File)
    const renderAdminConfig = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-muted/5 shrink-0">
                <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                    <Laptop className="size-4 text-primary" />
                    Configuración de Inventario Maestro
                </div>
                <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Paso 1/3</span>
                </div>
            </div>
            <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                    <Field className="w-full">
                        <FieldLabel className="text-[13px] font-bold">
                            Nombre del Inventario <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                            placeholder="Ej: Inventario General Abril 2026"
                            value={inventoryName}
                            onChange={(e) => setInventoryName(e.target.value)}
                            className="h-10 text-sm bg-muted/30 border-border/40 focus:ring-1 focus:ring-primary/20"
                            required
                        />
                        {!inventoryName && <FieldError className="text-[10px]">El nombre es obligatorio para continuar.</FieldError>}
                    </Field>

                    <div className="space-y-2">
                        <Label className="text-[13px] font-bold">Carga de Stock Externo (Planilla)</Label>
                        <FileUpload
                            onFilesChange={handleFileChange}
                            maxFiles={1}
                            accept=".xlsx,.xls,.csv"
                            className="mt-1"
                        />
                    </div>
                </div>
            </div>

            {/* Navigation Footer */}
            <div className="p-4 border-t border-border/10 bg-muted/5 flex items-center justify-between shrink-0 mt-auto">
                <Button
                    variant="outline"
                    className="group font-bold px-5 h-9 rounded-xl shadow-none"
                    onClick={() => navigate('/')}
                >
                    <ArrowLeft className="size-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Retroceder
                </Button>
                <Button
                    variant={inventoryName.trim() && uploadedFiles.length > 0 ? "default" : "outline"}
                    className={cn(
                        "group font-bold px-8 h-9 rounded-xl shadow-none",
                        !(inventoryName.trim() && uploadedFiles.length > 0) && "opacity-50 grayscale"
                    )}
                    disabled={!(inventoryName.trim() && uploadedFiles.length > 0)}
                    onClick={() => setStep('admin_summary')}
                >
                    Continuar
                    <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
            </div>
        </div>
    );


    // Screen 2: Admin Summary
    const renderAdminSummary = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-muted/5 shrink-0">
                <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                    <CheckCircle className="size-4 text-emerald-500" />
                    Resumen de Carga
                </div>
                <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Paso 2/3</span>
                </div>
            </div>
            <div className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                {loadStatus === 'success' && (
                    <Alert variant="success" className="animate-in fade-in zoom-in-95 duration-300">
                        <CheckCircle className="size-4" />
                        <AlertTitle className="font-bold">Carga Exitosa</AlertTitle>
                        <AlertDescription className="text-muted-foreground/80">
                            El archivo <span className="font-bold text-success/90">**{inventoryName}**</span> ha sido procesado localmente con éxito.
                        </AlertDescription>
                    </Alert>
                )}

                {loadStatus === 'warning' && (
                    <Alert variant="warning" className="animate-in fade-in zoom-in-95 duration-300">
                        <AlertTriangle className="size-4" />
                        <AlertTitle className="font-bold">Carga Incompleta</AlertTitle>
                        <AlertDescription className="text-muted-foreground/80">
                            El archivo fue procesado pero no se encontraron productos válidos.
                        </AlertDescription>
                    </Alert>
                )}

                {loadStatus === 'error' && (
                    <Alert variant="error" className="animate-in fade-in zoom-in-95 duration-300">
                        <AlertCircle className="size-4" />
                        <AlertTitle className="font-bold">Error de Carga</AlertTitle>
                        <AlertDescription className="text-muted-foreground/80">
                            Hubo un problema crítico al intentar leer el archivo. Verifique el formato.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-col gap-3">
                    <Alert variant="outline" className="animate-in fade-in slide-in-from-bottom-2 duration-400 bg-muted/5 border-border/40">
                        <Info className="size-4 text-muted-foreground/60" />
                        <AlertTitle className="font-bold">Productos</AlertTitle>
                        <AlertDescription className="text-muted-foreground/70">
                            Se han encontrado <span className="text-foreground font-semibold">{parsedStock?.total || 0}</span> productos en el archivo.
                        </AlertDescription>
                    </Alert>

                    <Alert variant="outline" className="animate-in fade-in slide-in-from-bottom-2 duration-500 bg-muted/5 border-border/40">
                        <FileText className="size-4 text-muted-foreground/60" />
                        <AlertTitle className="font-bold">Archivo</AlertTitle>
                        <AlertDescription className="text-muted-foreground/70 truncate">
                            <span className="text-foreground font-semibold">{parsedStock?.filename || 'Sin nombre'}</span> ({formatBytes(parsedStock?.size || 0)})
                        </AlertDescription>
                    </Alert>
                </div>
            </div>

            <div className="p-4 border-t border-border/10 bg-muted/5 flex items-center justify-between shrink-0 mt-auto">
                <Button
                    variant="outline"
                    className="group font-bold px-5 h-9 rounded-xl shadow-none"
                    onClick={() => setStep('admin_config')}
                >
                    <ArrowLeft className="size-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Retroceder
                </Button>
                <Button
                    className="group font-bold px-10 h-9 rounded-xl shadow-none bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={async () => {
                        const existing = availableSessions.find(s => s.sector === inventoryName && s.status === 'active');

                        if (existing) {
                            if (confirm(`Ya existe una sesión activa llamada "${inventoryName}". ¿Deseas usar esa en lugar de crear una nueva?`)) {
                                setSyncPin(existing.sync_pin || '');
                                await resumeSession(existing);
                                setStep('admin_sync');
                                return;
                            }
                        }

                        const pin = Math.floor(100000 + Math.random() * 900000).toString();
                        setSyncPin(pin);
                        await startSession(inventoryName, masterCatalog || undefined, pin);
                        setStep('admin_sync');
                        trigger('success');
                    }}
                >
                    Continuar
                    <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
            </div>
        </div>
    );


    // Screen 3: Admin Sync (Lobby)
    const renderAdminSync = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-muted/5 shrink-0">
                <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                    <Laptop className="size-4 text-primary" />
                    Conexión de Dispositivos
                    {session?.synced === 1 ? (
                        <span className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-green-500/10 text-green-500 text-[10px] rounded-md border border-green-500/20">
                            <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                            ONLINE
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] rounded-md border border-amber-500/20">
                            <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                            SINCRONIZANDO...
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Paso 3/3</span>
                </div>
            </div>
            <div className="p-6 pb-10 flex flex-col items-center justify-center space-y-6 flex-1 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center gap-6 w-full">
                    <div className="text-center space-y-1.5 mb-2">
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Código de verificación</h2>
                        <p className="text-xs text-muted-foreground/60">Ingrese el código de 6 dígitos en la terminal</p>
                    </div>

                    <InputOTP maxLength={6} value={syncPin} readOnly>
                        <InputOTPGroup className="gap-2">
                            <InputOTPSlot index={0} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                            <InputOTPSlot index={1} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                            <InputOTPSlot index={2} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                        </InputOTPGroup>

                        <div className="mx-2 text-muted-foreground/20 font-bold text-xl">-</div>

                        <InputOTPGroup className="gap-2">
                            <InputOTPSlot index={3} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                            <InputOTPSlot index={4} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                            <InputOTPSlot index={5} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                        </InputOTPGroup>
                    </InputOTP>

                    <div className="pt-2 text-center">
                        <p className="text-[11px] text-muted-foreground/50 leading-relaxed px-4">
                            Esta pantalla se actualizará automáticamente cuando se detecte una conexión entrante desde los dispositivos móviles o PC Salón.
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-border/10 bg-muted/5 flex items-center justify-between shrink-0 mt-auto">
                <Button
                    variant="outline"
                    className="group font-bold px-5 h-9 rounded-xl shadow-none"
                    onClick={() => setStep('admin_summary')}
                >
                    <ArrowLeft className="size-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    Retroceder
                </Button>
                <Button
                    className="group font-bold px-8 h-9 rounded-xl shadow-none bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => {
                        setStep('qr_generator');
                        trigger('success');
                    }}
                >
                    Siguiente Paso
                    <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
            </div>
        </div>
    );


    // Step 4: QR Generator
    const renderQRGenerator = () => (
        <div className="flex flex-col h-full">
            {showQRPrintView ? (
                <div className="flex flex-col h-full overflow-hidden bg-white">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-muted/5 print:hidden">
                        <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                            <Printer className="size-4 text-primary" />
                            Vista Previa
                        </div>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setShowQRPrintView(false)}
                            className="print:hidden"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                    <div className="p-0 overflow-auto max-h-[50vh] custom-scrollbar bg-gray-50 print:bg-white flex-1">
                        <div className="print:block">
                            <QRPrintLayout quantities={qrQuantities} branchName={inventoryName} />
                        </div>
                    </div>
                    <div className="p-4 border-t border-border/10 flex flex-col gap-2 bg-card print:hidden mt-auto">
                        <Button
                            className="w-full bg-primary text-white font-bold"
                            onClick={generateLocationQRPDF}
                        >
                            <Download className="size-4 mr-2" />
                            Descargar PDF
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => setShowQRPrintView(false)}>
                            Cerrar Vista Previa
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-muted/5 shrink-0">
                        <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                            Ubicaciones (QR)
                        </div>
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">OPCIONAL</span>
                        </div>
                    </div>
                    <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="text-center space-y-1">
                            <h2 className="text-base font-bold">Generador de Etiquetas</h2>
                            <p className="text-[11px] text-muted-foreground">
                                Define cuántas etiquetas de cada tipo necesitas imprimir.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {Object.entries(qrQuantities).map(([prefix, count]) => (
                                <div key={prefix} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-sm font-semibold tracking-tight text-foreground">
                                            {prefix === 'GO' ? 'Góndolas' :
                                                prefix === 'CA' ? 'Cajones' :
                                                    prefix === 'HE' ? 'Heladeras' :
                                                        prefix === 'DE' ? 'Depósito' :
                                                            prefix === 'ES' ? 'Estantería' : prefix}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground text-[10px] font-medium border border-border/50 w-fit mt-1">
                                            {prefix}-XX
                                        </span>
                                    </div>
                                    <NumberField
                                        value={count}
                                        onValueChange={(val) => setQrQuantities(prev => ({ ...prev, [prefix]: val || 0 }))}
                                        min={0}
                                        className="relative w-32 shrink-0 group"
                                    >
                                        <NumberFieldDecrement />
                                        <NumberFieldInput />
                                        <NumberFieldIncrement />
                                    </NumberField>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <Button
                                className="w-full bg-primary text-primary-foreground font-bold rounded-xl h-9"
                                onClick={generateLocationQRPDF}
                            >
                                <Download className="size-4 mr-2" />
                                Generar PDF de Etiquetas
                            </Button>
                        </div>
                    </div>

                    <div className="p-4 border-t border-border/10 bg-muted/5 flex items-center justify-between shrink-0 mt-auto">
                        <Button
                            variant="outline"
                            className="group font-bold px-5 h-9 rounded-xl shadow-none"
                            onClick={() => setStep('admin_sync')}
                        >
                            <ArrowLeft className="size-4 mr-2 transition-transform group-hover:-translate-x-1" />
                            Retroceder
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                className="font-bold px-4 h-9 rounded-xl transition-all shadow-none text-muted-foreground hover:text-foreground text-xs"
                                onClick={handleStartSession}
                            >
                                Omitir
                            </Button>
                            <Button
                                className="group font-bold px-8 h-9 rounded-xl shadow-none bg-primary hover:bg-primary/90 text-primary-foreground"
                                onClick={handleStartSession}
                            >
                                Comenzar
                                <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );


    const handleSkip = async () => {
        if (availableSessions.length > 0) {
            await resumeSession(availableSessions[0]);
        } else {
            const deviceId = localStorage.getItem('precount_device_id') || Math.random().toString(36).substring(7);
            const name = deviceName || `Dispositivo ${deviceId.substring(0, 4)}`;
            await startSession(`Inventario ${name}`, undefined, undefined);
        }
        setStep('counting');
        trigger('success');
    };

    const renderConfig = () => {
        if (accessMode === 'admin') {
            if (step === 'admin_config') return renderAdminConfig();
            if (step === 'admin_summary') return renderAdminSummary();
            if (step === 'admin_sync') return renderAdminSync();
            if (step === 'qr_generator') return renderQRGenerator();
        }
        if (accessMode === 'salon') {
            return (
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-muted/5 shrink-0">
                        <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                            <Monitor className="size-4 text-primary" />
                            Conexión de Dispositivos
                        </div>
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                                PC SALÓN
                            </span>
                        </div>
                    </div>

                    <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-8 text-center overflow-y-auto custom-scrollbar">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold tracking-tight">Código de verificación</h3>
                            <p className="text-sm text-muted-foreground/70">Ingrese el código de 6 dígitos generado por la PC Administradora</p>
                        </div>

                        <InputOTP
                            maxLength={6}
                            value={otpValue}
                            onChange={(val) => {
                                setOtpValue(val);
                                if (val.length === 6) {
                                    handleJoinSession(val);
                                }
                            }}
                            autoFocus
                        >
                            <InputOTPGroup className="gap-2">
                                <InputOTPSlot index={0} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                                <InputOTPSlot index={1} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                                <InputOTPSlot index={2} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                            </InputOTPGroup>

                            <div className="mx-2 text-muted-foreground/20 font-bold text-xl">-</div>

                            <InputOTPGroup className="gap-2">
                                <InputOTPSlot index={3} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                                <InputOTPSlot index={4} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                                <InputOTPSlot index={5} className="!h-12 !w-10 !rounded-lg !border border-border/30 bg-background shadow-xs text-xl font-black ring-offset-background" />
                            </InputOTPGroup>
                        </InputOTP>

                        <div className="max-w-[320px] space-y-4">
                            <p className="text-[11px] leading-relaxed text-muted-foreground/50">
                                Esta pantalla se actualizará automáticamente cuando se confirme la conexión con la sesión activa.
                            </p>
                        </div>
                    </div>

                    <div className="p-4 border-t border-border/10 bg-muted/5 flex flex-col gap-3 shrink-0 mt-auto">
                        <Button
                            variant="ghost"
                            className="w-full font-bold h-10 rounded-xl text-muted-foreground hover:text-foreground text-xs"
                            onClick={handleSkip}
                        >
                            Omitir conexión
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="flex-1 font-bold h-10 rounded-xl shadow-none"
                                onClick={() => navigate('/')}
                            >
                                <ArrowLeft className="size-4 mr-2" />
                                Retroceder
                            </Button>
                            <Button
                                className="flex-1 group font-bold h-10 rounded-xl shadow-none bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                                onClick={() => handleJoinSession(otpValue)}
                                disabled={otpValue.length !== 6}
                            >
                                Comenzar
                                <ArrowRight className="size-3 ml-2 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Main Render logic (No modification needed to steps, we stay in the same layout)

    return (
        <div className="h-full flex flex-col relative overflow-hidden">
            {step !== 'counting' && accessMode !== 'admin' ? (
                <div className="flex-1 flex flex-col p-0 md:p-2 lg:grid lg:grid-cols-12 gap-0 lg:gap-6 w-full h-full">
                    {/* Left Column: Config Steps */}
                    <div className="lg:col-span-4 lg:col-start-1 flex-1 flex flex-col min-h-0 h-full">
                        <div className="flex flex-col flex-1 overflow-hidden bg-surface-8 border border-border/40 rounded-xl h-full shadow-surface-8">
                            {renderConfig()}
                        </div>
                    </div>

                    {/* Right Column: Empty State, Table Preview or Connected Devices during config */}
                    <div className="hidden lg:flex lg:col-span-8 lg:col-start-5 flex-col min-h-0 bg-surface-8 border border-border/40 rounded-xl overflow-hidden shadow-surface-8">
                        {masterCatalog && masterCatalog.length > 0 ? (
                            <EditableCatalogPreview
                                catalog={masterCatalog}
                                onChange={(updatedCatalog) => {
                                    setMasterCatalog(updatedCatalog);
                                    const primaryCount = updatedCatalog.filter((item: MasterCatalogItem) => item.isPrimaryEan).length;
                                    setParsedStock((prev) => prev ? { ...prev, total: primaryCount } : null);
                                }}
                                profile={inventoryProfile}
                            />
                        ) : (step === 'admin_sync' || step === 'qr_generator') ? (
                            <ConnectedDevicesList devices={connectedDevices} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-12 animate-in fade-in duration-700">
                                <div className="flex flex-col items-center gap-6">
                                    <Laptop className="w-24 h-24 text-muted-foreground/20 stroke-[1.5]" />
                                    <div className="space-y-3">
                                        <h3 className="text-xl font-black text-muted-foreground/40 tracking-tight">Configuración en progreso</h3>
                                        <p className="text-xs text-muted-foreground/30 max-w-sm leading-relaxed mx-auto">
                                            Una vez completados los pasos de configuración inicial en el panel izquierdo, este espacio mostrará la lista de productos y el control de inventario en tiempo real.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div
                    id="counting-main-container"
                    className="flex-1 w-full h-full overflow-hidden flex flex-col bg-surface-2 dark:bg-surface-1"
                >
                            {/* VISTA COLECTOR DE DATOS: PERFIL ADMIN / PERFIL SUCURSAL */}
                            {accessMode === 'admin' ? (
                                <SurfaceProvider value={2}>
                                    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-transparent">
                                        <PreCountAdminCyclicView 
                                            defaultLabName={session?.sector || ""} 
                                            sessionId={session?.id}
                                            onResumeSession={resumeSession}
                                            onDeleteSession={deleteSession}
                                            currentProfile={accessMode}
                                        />
                                    </div>
                                </SurfaceProvider>
                            ) : accessMode === 'salon' ? (
                                <SurfaceProvider value={2}>
                                    <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-transparent">
                                        <PreCountBranchCyclicView 
                                            defaultLabName={session?.sector || ""} 
                                            sessionId={session?.id}
                                            onResumeSession={resumeSession}
                                            onDeleteSession={deleteSession}
                                            currentProfile={accessMode}
                                        />
                                    </div>
                                </SurfaceProvider>
                            ) : (
                                /* VISTA CARGA LEGACY (ZEBRA/SALON - 2 COLUMNAS) */
                                <div className="flex flex-col h-full bg-background lg:bg-transparent rounded-t-2xl lg:rounded-none border-t lg:border-none border-white/20 relative isolate col-span-1 lg:col-span-12 row-span-2 lg:row-span-1 w-full">
                                    {pendingFile && (
                                        <div className="mx-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                            <Alert className="bg-primary/10 border-primary/20 flex flex-row items-center justify-between p-3 gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/20 rounded-lg">
                                                        <FileSpreadsheet className="size-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <AlertTitle className="text-sm font-bold">
                                                            Archivo de Plex25: <span className="text-primary uppercase">{pendingFile.laboratory || 'Desconocido'}</span>
                                                        </AlertTitle>
                                                        <AlertDescription className="text-xs text-muted-foreground">
                                                            {pendingFile.filename} ({Math.round(pendingFile.size / 1024)} KB)
                                                        </AlertDescription>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 text-xs"
                                                        onClick={() => setPendingFile(null)}
                                                    >
                                                        Descartar
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        className="h-8 text-xs font-bold gap-1.5"
                                                        onClick={() => {
                                                            handleElectronImport(pendingFile);
                                                            setPendingFile(null);
                                                        }}
                                                    >
                                                        <Zap className="size-3.5 fill-current" /> Inyectar ahora
                                                    </Button>
                                                </div>
                                            </Alert>
                                        </div>
                                    )}
                                    <div className="flex-1 flex flex-col overflow-hidden rounded-t-2xl min-h-0">
                                        {/* Unico Recuadro Unificado en Superficie Capa 4 */}
                                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden min-w-0 bg-card rounded-2xl border border-border/30 shadow-xs">
                                            {/* Cabecera Superior Integrada de Controles (Fila Única) */}
                                            <div className="p-3 sm:p-4 border-b border-border/20 shrink-0">
                                                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3">
                                                    {/* Buscador de Productos */}
                                                    <div className="w-full max-w-[560px] flex-1 min-w-0">
                                                        <SmartProductSearch
                                                            key={searchResetKey}
                                                            sessionId={session?.id}
                                                            onSelect={async (p) => {
                                                                const timeSinceScan = Date.now() - lastScanTimeRef.current;
                                                                if (timeSinceScan < 500) return;
                                                                if (!p.name) {
                                                                    notify.warning("Advertencia", 'Producto no encontrado en la base de datos', { description: 'Puedes agregarlo manualmente' });
                                                                    registerError();
                                                                }
                                                                setManualEAN(p.ean);
                                                                setSelectedProduct({ ...p, stock: 0, salePrice: 0, cost: 0, id_producto: p.id_producto });
                                                                setEditingItemId(null);
                                                                if (highSpeedMode) {
                                                                    await addItem(p.ean, p.name, 1, p.id_producto, activeLocation || undefined);
                                                                    setManualEAN('');
                                                                    setSelectedProduct(null);
                                                                    setSearchResetKey(prev => prev + 1);
                                                                    trigger('success');
                                                                    playSound('success');
                                                                } else {
                                                                    setTimeout(() => {
                                                                        document.getElementById('quantity-input')?.focus();
                                                                        (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                                    }, 50);
                                                                }
                                                            }}
                                                            autoFocus={true}
                                                            className="w-full"
                                                        />
                                                    </div>

                                                    {/* Stepper de Cantidad + Botón (+) */}
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <NumberField
                                                            key={searchResetKey}
                                                            value={quantity}
                                                            onValueChange={(val) => setQuantity(val ?? 1)}
                                                            min={1}
                                                            className="w-28 relative"
                                                        >
                                                            <div className="relative">
                                                                <NumberFieldDecrement className="text-muted-foreground/40 hover:text-primary" />
                                                                <NumberFieldInput
                                                                    id="quantity-input"
                                                                    className="h-10 text-sm font-bold bg-transparent border-input shadow-none focus-visible:ring-primary/10 text-center"
                                                                    inputMode="none"
                                                                    onKeyDown={(e: React.KeyboardEvent) => {
                                                                        if (e.key === 'Enter') {
                                                                            handleAddProduct();
                                                                        }
                                                                    }}
                                                                />
                                                                <NumberFieldIncrement className="text-muted-foreground/40 hover:text-primary" />
                                                            </div>
                                                        </NumberField>
                                                         <Button
                                                             onClick={handleAddProduct}
                                                             className="h-10 px-4 shadow-none font-bold flex-shrink-0 bg-black dark:bg-white text-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 rounded-xl"
                                                             disabled={!manualEAN.trim()}
                                                         >
                                                             <Plus className="size-4" />
                                                         </Button>
                                                    </div>

                                                    {/* Exportar TXT + Configuración */}
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-10 px-3 font-bold text-xs gap-1.5 shrink-0 bg-transparent hover:bg-muted/40 transition-colors"
                                                            onClick={handleExportTXT}
                                                            title="Exportar archivo TXT"
                                                        >
                                                            <Download className="size-3.5 text-primary" />
                                                            <span className="hidden sm:inline">Exportar TXT</span>
                                                        </Button>
                                                        <SettingsMenu
                                                            highSpeedMode={highSpeedMode}
                                                            setHighSpeedMode={setHighSpeedMode}
                                                            isManualMode={isManualMode}
                                                            setIsManualMode={setIsManualMode}
                                                            autoSave={autoSave}
                                                            setAutoSave={setAutoSave}
                                                            sortOrder={sortOrder}
                                                            setSortOrder={setSortOrder}
                                                            isZenMode={isZenMode}
                                                            setIsZenMode={setIsZenMode}
                                                            handleResetSector={handleResetSector}
                                                            handleExportTXT={handleExportTXT}
                                                            accessMode={accessMode === 'legacy' ? 'salon' : accessMode}
                                                            handleFinishClick={handleFinishClick}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Espacio Reservado Fijo para Producto Seleccionado */}
                                                <div className="mt-2 h-9 flex items-center w-full">
                                                    <AnimatePresence mode="wait">
                                                        {selectedProduct ? (
                                                            <motion.button
                                                                key={selectedProduct.id_producto || selectedProduct.ean}
                                                                initial={{ opacity: 0, scale: 0.98 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0, scale: 0.98 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="w-full h-full bg-emerald-500/10 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between py-1.5 px-3 overflow-hidden cursor-pointer active:scale-[0.98] transition-all text-left font-sans"
                                                                onClick={() => {
                                                                    document.getElementById('quantity-input')?.focus();
                                                                    (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                                    <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline gap-1.5 font-sans">
                                                                        <span className="font-semibold text-foreground text-xs truncate font-sans">{selectedProduct.name}</span>
                                                                        <span className="text-xs text-muted-foreground font-sans truncate">{selectedProduct.ean}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="size-6 text-muted-foreground/60 hover:text-primary hover:bg-primary/5"
                                                                        onClick={() => {
                                                                            document.getElementById('quantity-input')?.focus();
                                                                            (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                                        }}
                                                                    >
                                                                        <Pencil className="size-3" />
                                                                    </Button>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="size-6 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedProduct(null);
                                                                            setManualEAN('');
                                                                        }}
                                                                    >
                                                                        <Trash2 className="size-3" />
                                                                    </Button>
                                                                </div>
                                                            </motion.button>
                                                        ) : (
                                                            <div className="w-full h-full rounded-xl border border-dashed border-border/30 bg-muted/10 flex items-center px-3 text-xs text-muted-foreground/50 select-none">
                                                                <span>Sin producto seleccionado — el ítem activo se mostrará aquí</span>
                                                            </div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>

                                            {/* Cuerpo: Tabla de Datos */}
                                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
                                                <PreCountList
                                                    items={sortedItems}
                                                    mode={listMode}
                                                    onUpdate={updateItem}
                                                    onDelete={removeItem}
                                                    onEditRequest={(item) => {
                                                        setSelectedProduct({
                                                            ean: item.ean,
                                                            name: item.productName || 'Producto',
                                                            stock: 0,
                                                            salePrice: 0,
                                                            cost: 0,
                                                            id_producto: item.id_producto
                                                        });
                                                        setManualEAN(item.ean);
                                                        setQuantity(item.quantity);
                                                        setEditingItemId(item.id);
                                                        setTimeout(() => {
                                                            document.getElementById('quantity-input')?.focus();
                                                            (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                        }, 50);
                                                    }}
                                                    masterCatalog={session?.master_catalog}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                </div>
            )}


            {/* Modales y Drawers Modulares */}
            <FinishSessionDialog
                open={showFinishDialog}
                onOpenChange={setShowFinishDialog}
                totalProducts={totalProducts}
                totalUnits={totalUnits}
                finishPassword={finishPassword}
                setFinishPassword={setFinishPassword}
                finishPasswordError={finishPasswordError}
                setFinishPasswordError={setFinishPasswordError}
                onConfirmFinish={handleConfirmFinish}
            />

            <NoZoneDialog
                open={showNoZoneDialog}
                onOpenChange={setShowNoZoneDialog}
                onOpenSectorSelector={() => {
                    document.getElementById('sector-selector-trigger')?.click();
                }}
            />

            <AddSectorDialog
                open={showAddSectorDialog}
                onOpenChange={setShowAddSectorDialog}
                newSectorName={newSectorName}
                setNewSectorName={setNewSectorName}
                onAddSector={handleLocationScan}
            />

            <LocationClosingDrawer
                isOpen={showLocationSummary}
                onOpenChange={setShowLocationSummary}
                locationName={activeLocation || ''}
                stats={locationStats}
                onConfirm={confirmCloseLocation}
            />

            <QuantityDrawer
                open={showQtyDrawer}
                onOpenChange={setShowQtyDrawer}
                quantity={quantity}
                setQuantity={setQuantity}
                productName={selectedProduct?.name}
                productEAN={selectedProduct?.ean || manualEAN}
                onConfirm={async () => {
                    setShowQtyDrawer(false);
                    if (editingItemId) {
                        await updateItem(editingItemId, quantity);
                        setEditingItemId(null);
                        setManualEAN('');
                        setSelectedProduct(null);
                    } else {
                        await handleAddProduct();
                    }
                }}
            />
        </div>
    );
}


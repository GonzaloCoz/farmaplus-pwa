import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionPanel
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
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { enhancedProductCache } from '@/services/enhancedProductCache';
import { useHardwareScanner } from '@/hooks/useHardwareScanner';
import { useHaptic } from '@/hooks/useHaptic';
import { useTheme } from '@/hooks/useTheme';
import { Switch } from '@/components/ui/switch';


import { PreCountSettingsMenu as SettingsMenu } from '@/components/precount/PreCountSettingsMenu';
import { 
    FinishSessionDialog, 
    NoZoneDialog, 
    AddSectorDialog, 
    QuantityDrawer 
} from '@/components/precount/PreCountDialogs';


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
                        checked={editable}
                        onCheckedChange={setEditable}
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
    const { logout } = useUser();
    const [step, setStep] = useState<Step>('config');
    const [autoSave, setAutoSave] = useState(true);
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
    const [accessMode, setAccessMode] = useState<'admin' | 'zebra' | 'salon' | null>(null);
    const [showAdmin, setShowAdmin] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<'admin' | 'zebra' | 'salon' | null>(null);
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
    // This prevents the loop when the user manually clears the selection
    const hasAttemptedAutoResume = useRef(false);
    useEffect(() => {
        if (hasAttemptedAutoResume.current) return;

        const lastSessionId = localStorage.getItem('last_precount_session_id');
        if (step === 'config' && lastSessionId && availableSessions.length > 0) {
            const lastSession = availableSessions.find(s => s.id === lastSessionId);
            if (lastSession) {
                setSessionToResume(lastSession);
                hasAttemptedAutoResume.current = true;
                // Also try to restore the profile if it was saved
                const lastProfile = localStorage.getItem('precount_last_profile') as any;
                if (lastProfile && ['admin', 'zebra', 'salon'].includes(lastProfile)) {
                    setSelectedProfile(lastProfile);
                }
            }
        }
    }, [availableSessions, step]);

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

    // Zebra counting layout management (hides top and bottom bars)
    useEffect(() => {
        const isZebraCounting = accessMode === 'zebra' && step === 'counting';
        localStorage.setItem('is_zebra_counting', isZebraCounting ? 'true' : 'false');
        window.dispatchEvent(new Event('zebraCountingStateChange'));
        
        return () => {
            localStorage.setItem('is_zebra_counting', 'false');
            window.dispatchEvent(new Event('zebraCountingStateChange'));
        };
    }, [accessMode, step]);


    const [activeLocation, setActiveLocation] = useState<string | null>(null);
    const [showLocationSummary, setShowLocationSummary] = useState(false);
    const [locationStats, setLocationStats] = useState({ products: 0, units: 0 });

    const sessionLocations = useLiveQuery(
        () => session ? db.locations.where('session_id').equals(session.id).toArray() : [],
        [session]
    );

    const isActiveLocationClosed = sessionLocations?.find(l => l.location_tag === activeLocation)?.status === 'closed';

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
            // Limpiamos rastro de sesiones viejas
            localStorage.removeItem('precount_session_id');

            await resumeSession(remoteSession);
            announcePresence(remoteSession.id);
            setStep('counting');
            notify.success("Conectado", `Unido a: ${remoteSession.sector}`);
            return;
        }

        // 2. Fallback de emergencia solo para testing
        if (normalizedPin === "123456" && availableSessions.length > 0) {
            const fallbackSession = availableSessions[0];
            await resumeSession(fallbackSession);
            announcePresence(fallbackSession.id);
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
                                    const laboratory = catalog[0]?.laboratory || '';
                                    const suffix = laboratory ? ` (${laboratory})` : '';
                                    setInventoryName(file.name.replace(/\.[^/.]+$/, "") + suffix);
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

            // Fuente ÚNICA de datos: la tabla IndexedDB de la sesión activa
            if (session?.id) {
                const dbProduct = await db.precount_products
                    .where('[session_id+ean]')
                    .equals([session.id, code])
                    .first();
                if (dbProduct) {
                    productToUse = {
                        ean: code,
                        name: dbProduct.name,
                        cost: dbProduct.cost,
                        salePrice: dbProduct.salePrice || 0,
                        stock: dbProduct.stock || 0,
                        id_producto: dbProduct.id_producto,
                        isMaster: true
                    };
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
                    if (accessMode === 'zebra') {
                        setTimeout(() => setShowQtyDrawer(true), 120);
                    } else {
                        setTimeout(() => {
                            const qtyInput = document.getElementById('quantity-input') as HTMLInputElement;
                            if (qtyInput) {
                                qtyInput.focus();
                                qtyInput.select();
                            }
                        }, 100);
                    }
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

    // Nueva lógica para manejar escaneo de zonas (Apertura/Cierre)
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
            notify.warning("Zona ocupada", `Debes cerrar ${activeLocation} antes de cambiar de zona.`);
            trigger('error');
            return true;
        }

        // 3. Abrir o Visualizar zona
        try {
            const { getLocationStatus } = await import('@/services/preCountDB') as any;
            const statusResult = await getLocationStatus(session.id, normalizedCode);

            if (statusResult?.status === 'closed') {
                notify.info("Modo Lectura", `La zona ${normalizedCode} está finalizada. Solo lectura.`);
            } else {
                notify.success("Zona Abierta", `📍 Contando en: ${normalizedCode}`);
            }

            setActiveLocation(normalizedCode);
            trigger('success');
            playSound('success');
            return true;
        } catch (err) {
            console.error(err);
            return true;
        }
    };

    const confirmCloseLocation = async () => {
        if (!session || !activeLocation) return;

        try {
            const { updateLocationStatus } = await import('@/services/preCountDB');
            await updateLocationStatus(session.id, activeLocation, 'closed');

            // notify.success("Zona Cerrada", `Se ha bloqueado la zona ${activeLocation}`);
            setActiveLocation(null);
            setShowLocationSummary(false);
            trigger('success');
            playSound('success');
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

        // Si no hay producto seleccionado, intentar buscarlo en IndexedDB de la sesión -> cache -> bd
        if (!productName && session?.id) {
            const dbProduct = await db.precount_products
                .where('[session_id+ean]')
                .equals([session.id, manualEAN.trim()])
                .first();
            if (dbProduct) {
                productName = dbProduct.name;
                idProducto = dbProduct.id_producto;
            }
        }

        if (!productName) {
            const cached = await enhancedProductCache.get(manualEAN.trim());
            if (cached) {
                productName = cached.name;
                if (!idProducto) idProducto = cached.id_producto;
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
            const content = generateTXTContent();
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
            setStep('config');
            setAccessMode(null);
            notify.success("Sesión terminada", "Has finalizado tu parte del conteo.");
        } else {
            // Si es admin, descarga el consolidado y CIERRA para todos
            handleExportTXT();
            await finishSession();
            notify.success("Inventario Finalizado", "El inventario global ha sido cerrado.");
            setStep('config');
            setAccessMode(null);
        }
    };



    // Generar contenido del TXT (Formato: IDProducto;EAN;Cantidad;0)
    const generateTXTContent = () => {
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

        const lines = filteredItems.map(item => {
            const idProd = item.id_producto || '';
            return `${idProd};${item.ean};${item.quantity};0`;
        });
        return lines.join('\n');
    };

    // Exportar a TXT
    const handleExportTXT = () => {
        const content = generateTXTContent();
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



    // Vista de Selección de Modo (Triple recuadro - Coss UI Redesign)
    const renderSelection = () => (
        <div className="max-w-2xl mx-auto py-6 md:py-12 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Sesiones Abiertas */}
            <Frame className="w-full shadow-sm border-border/30 rounded-lg overflow-hidden">
                <Collapsible defaultOpen className="w-full">
                    <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                        <CollapsibleTrigger
                            className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground transition-all group data-panel-open:[&_svg]:rotate-180"
                        >
                            <History className="size-4 text-primary transition-transform duration-300" />
                            Sesiones Abiertas
                        </CollapsibleTrigger>
                    </FrameHeader>
                    <CollapsibleContent>
                        <FramePanel className="p-0 overflow-hidden">
                            {availableSessions.length > 0 ? (
                                <div className="divide-y divide-border/10 max-h-[320px] overflow-y-auto custom-scrollbar">
                                    {availableSessions.map((s) => (
                                        <div key={s.id} className="p-4 hover:bg-accent/20 transition-colors flex items-center justify-between group">
                                            <div className="space-y-1.5 min-w-0">
                                                <h3 className="font-bold text-sm leading-none text-foreground group-hover:text-primary transition-colors truncate">
                                                    {s.sector}
                                                </h3>
                                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                                                    <Calendar className="size-3" />
                                                    <span>
                                                        {format(new Date(s.start_time), "d MMM, HH:mm", { locale: es })}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2.5 text-[10px] items-center">
                                                    <span className="flex items-center gap-1 text-primary font-bold bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                                                        {s.totalProducts || 0} prod.
                                                    </span>
                                                    <span className="flex items-center gap-1 text-secondary-foreground font-bold bg-secondary/50 px-1.5 py-0.5 rounded border border-border/40">
                                                        {s.totalUnits || 0} unid.
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 ml-4">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteSession(s.id);
                                                    }}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </Button>
                                                <Button
                                                    variant={sessionToResume?.id === s.id ? "default" : "outline"}
                                                    size="sm"
                                                    className={cn(
                                                        "gap-1.5 font-bold h-8 text-[11px] rounded-lg shadow-none transition-all",
                                                        sessionToResume?.id === s.id && "bg-primary text-primary-foreground border-primary"
                                                    )}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (sessionToResume?.id === s.id) {
                                                            setSessionToResume(null);
                                                            setSelectedProfile(null);
                                                            notify.info("Selección cancelada", "Has desmarcado la sesión.");
                                                        } else {
                                                            setSessionToResume(s);
                                                            // Scroll to profile selection
                                                            const profileSection = document.getElementById('profile-selection-section');
                                                            if (profileSection) {
                                                                profileSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            }
                                                            notify.info("Sesión seleccionada", `Has seleccionado retomar: ${s.sector}. Ahora elige tu perfil.`);
                                                        }
                                                    }}
                                                >
                                                    {sessionToResume?.id === s.id ? 'Seleccionada' : 'Retomar'}
                                                    {sessionToResume?.id === s.id ? <X className="size-3" /> : <ArrowRight className="size-3" />}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <Empty className="py-12">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <History className="size-5 text-muted-foreground" />
                                        </EmptyMedia>
                                        <EmptyTitle className="text-sm font-bold">No hay sesiones activas</EmptyTitle>
                                        <EmptyDescription className="text-xs">
                                            Solo el administrador puede iniciar nuevas sesiones de control de inventario.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </FramePanel>
                    </CollapsibleContent>
                </Collapsible>
            </Frame>

            <Frame className="w-full shadow-sm border-border/30 rounded-lg overflow-hidden">
                <Collapsible defaultOpen className="w-full">
                    <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                        <CollapsibleTrigger
                            className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground transition-all group data-panel-open:[&_svg]:rotate-180"
                        >
                            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-300" />
                            Configuración de Acceso
                            {showAdmin && <div className="size-1.5 rounded-full bg-emerald-500 ml-1 animate-pulse" title="Admin Mode Active" />}
                        </CollapsibleTrigger>
                    </FrameHeader>
                    <CollapsibleContent>
                        <FramePanel id="profile-selection-section" className="p-4 sm:p-6 space-y-6">
                            <div className="space-y-1.5">
                                <FrameTitle className="text-base font-bold tracking-tight">Seleccionar Perfil</FrameTitle>
                                <FrameDescription className="text-xs text-muted-foreground">
                                    Elija el tipo de dispositivo con el que operará en esta sesión.
                                </FrameDescription>
                            </div>

                            <div className="space-y-3">
                                <Label
                                    className={cn(
                                        "flex items-start gap-4 rounded-xl border p-4 hover:bg-accent/30 cursor-pointer transition-all border-border/40",
                                        selectedProfile === 'admin' && "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                    )}
                                >
                                    <Checkbox
                                        checked={selectedProfile === 'admin'}
                                        onCheckedChange={() => setSelectedProfile('admin')}
                                    />
                                    <div className="flex flex-col gap-1 select-none">
                                        <p className="font-bold text-[13px] text-foreground">PC Administrador</p>
                                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                                            Control central, conciliación de stock e importación maestra.
                                        </p>
                                    </div>
                                </Label>

                                <Label
                                    className={cn(
                                        "flex items-start gap-4 rounded-xl border p-4 hover:bg-accent/30 cursor-pointer transition-all border-border/40",
                                        selectedProfile === 'zebra' && "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                                    )}
                                >
                                    <Checkbox
                                        checked={selectedProfile === 'zebra'}
                                        onCheckedChange={() => setSelectedProfile('zebra')}
                                    />
                                    <div className="flex flex-col gap-1 select-none">
                                        <p className="font-bold text-[13px] text-foreground">Zebra (Colector)</p>
                                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                                            Optimizado para escaneo rápido de códigos de barras y movilidad.
                                        </p>
                                    </div>
                                </Label>

                                <Label
                                    className={cn(
                                        "flex items-start gap-4 rounded-xl border p-4 hover:bg-accent/30 cursor-pointer transition-all border-border/40",
                                        selectedProfile === 'salon' && "border-indigo-500/40 bg-indigo-500/5 ring-1 ring-indigo-500/20"
                                    )}
                                >
                                    <Checkbox
                                        checked={selectedProfile === 'salon'}
                                        onCheckedChange={() => setSelectedProfile('salon')}
                                    />
                                    <div className="flex flex-col gap-1 select-none">
                                        <p className="font-bold text-[13px] text-foreground">PC Salón</p>
                                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                                            Terminal fija para conteo manual y verificación de estanterías.
                                        </p>
                                    </div>
                                </Label>
                            </div>
                        </FramePanel>
                    </CollapsibleContent>
                </Collapsible>
            </Frame>

            {/* Pagination Controls */}
            <div className="mt-4 px-1">
                <div className="flex items-center justify-between gap-4">
                    <Button
                        variant="outline"
                        className="flex-1 font-bold h-11 rounded-xl shadow-none border-border/40"
                        onClick={() => navigate('/stock')}
                    >
                        <ArrowLeft className="size-4 mr-2" />
                        Retroceder
                    </Button>
                    <Button
                        variant={selectedProfile ? "default" : "outline"}
                        className={cn(
                            "flex-[1.5] font-bold h-11 rounded-xl transition-all shadow-none",
                            selectedProfile ? "bg-primary text-primary-foreground" : "opacity-40 grayscale"
                        )}
                        disabled={!selectedProfile}
                        onClick={() => {
                            if (selectedProfile) {
                                setAccessMode(selectedProfile);
                                localStorage.setItem('precount_last_profile', selectedProfile);
                                if (sessionToResume) {
                                    resumeSession(sessionToResume);
                                    setStep('counting');
                                    setSessionToResume(null); // Clear after use
                                } else if (selectedProfile === 'admin') {
                                    setStep('admin_config');
                                } else {
                                    setStep('config');
                                }
                                trigger('success');
                            }
                        }}
                    >
                        {sessionToResume ? 'Retomar Sesión' : 'Continuar'}
                        <ArrowRight className="size-4 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );

    // Vista de Configuración (Nueva Sesión / Seleccionar)
    // Screen 1: Admin Config (Title + File)
    const renderAdminConfig = () => (
        <>
            <Frame className="w-full shadow-sm border-border/40">
                <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                    <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                        <Laptop className="size-4 text-primary" />
                        Configuración de Inventario Maestro
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Paso 1/3</span>
                    </div>
                </FrameHeader>
                <FramePanel className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-border/10">
                            <span className="text-[13px] font-bold text-foreground">Perfil de Carga</span>
                            <div className="flex items-center gap-3">
                                <span className={cn("text-xs font-semibold select-none", inventoryProfile === 'sucursal' ? "text-primary font-bold" : "text-muted-foreground")}>
                                    Sucursal
                                </span>
                                <Switch
                                    checked={inventoryProfile === 'sap'}
                                    onCheckedChange={(checked) => {
                                        setInventoryProfile(checked ? 'sap' : 'sucursal');
                                        setUploadedFiles([]);
                                        setMasterCatalog(null);
                                        setParsedStock(null);
                                        setLoadStatus(null);
                                    }}
                                />
                                <span className={cn("text-xs font-semibold select-none", inventoryProfile === 'sap' ? "text-primary font-bold" : "text-muted-foreground")}>
                                    SAP
                                </span>
                            </div>
                        </div>

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
                </FramePanel>
            </Frame>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Navigation Footer */}
            <div className="p-3 border-t border-border/40 bg-card/50 flex items-center justify-between">
                <Button
                    variant="outline"
                    className="group font-bold px-5 h-9 rounded-xl shadow-none"
                    onClick={() => {
                        setAccessMode(null);
                        setStep('config');
                    }}
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
        </>
    );


    // Screen 2: Admin Summary
    const renderAdminSummary = () => (
        <>
            <Frame className="w-full shadow-sm border-border/40">
                <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                    <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                        <CheckCircle className="size-4 text-emerald-500" />
                        Resumen de Carga
                    </div>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Paso 2/3</span>
                    </div>
                </FrameHeader>
                <FramePanel className="p-6 flex flex-col gap-4">
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
                </FramePanel>
            </Frame>

            <div className="flex-1" />

            <div className="p-3 border-t border-border/40 bg-card/50 flex items-center justify-between">
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
                        // Check if we already have an active session for this specific inventory name
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
                        // Save session to Supabase immediately so devices can find it by PIN
                        await startSession(inventoryName, masterCatalog || undefined, pin);
                        setStep('admin_sync');
                        trigger('success');
                    }}

                >
                    Continuar
                    <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
            </div>
        </>
    );


    // Screen 3: Admin Sync (Lobby)
    const renderAdminSync = () => (
        <>
            <Frame className="w-full shadow-sm border-border/40">
                <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
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
                </FrameHeader>
                <FramePanel className="p-6 pb-10 flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex flex-col items-center gap-6 w-full">
                        <div className="text-center space-y-1.5 mb-2">
                            <h2 className="text-lg font-semibold text-foreground tracking-tight">Código de verificación</h2>
                            <p className="text-xs text-muted-foreground/60">Ingrese el código de 6 dígitos en la terminal Zebra</p>
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
                                Esta pantalla se actualizará automáticamente cuando se detecte una conexión entrante desde los dispositivos móviles.
                            </p>
                        </div>
                    </div>
                </FramePanel>
            </Frame>

            <div className="flex-1" />

            <div className="p-3 border-t border-border/40 bg-card/50 flex items-center justify-between">
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
        </>
    );


    // Step 4: QR Generator
    const renderQRGenerator = () => (
        <>
            {showQRPrintView ? (
                <Frame className="w-full shadow-lg border-border/40 overflow-hidden bg-white">
                    <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5 print:hidden">
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
                    </FrameHeader>
                    <FramePanel className="p-0 overflow-auto max-h-[50vh] custom-scrollbar bg-gray-50 print:bg-white">
                        <div className="print:block">
                            <QRPrintLayout quantities={qrQuantities} branchName={inventoryName} />
                        </div>
                    </FramePanel>
                    <div className="p-3 border-t border-border/10 flex flex-col gap-2 bg-card print:hidden">
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
                </Frame>
            ) : (
                <Frame className="w-full shadow-sm border-border/40">
                    <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                        <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                            Ubicaciones (QR)
                        </div>
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">OPCIONAL</span>
                        </div>
                    </FrameHeader>
                    <FramePanel className="p-5 space-y-5">
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
                    </FramePanel>
                </Frame>
            )}

            <div className="flex-1" />

            {!showQRPrintView && (
                <div className="p-3 border-t border-border/40 bg-card/50 flex items-center justify-between">
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
                            className="group font-bold px-6 h-9 rounded-xl shadow-none bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                            onClick={handleStartSession}
                        >
                            Comenzar
                            <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );


    const handleSkip = async () => {
        if (availableSessions.length > 0) {
            await resumeSession(availableSessions[0]);
        } else {
            // Start a generic session if none exists
            // This will use the app's full database as fallback
            const deviceId = localStorage.getItem('precount_device_id') || Math.random().toString(36).substring(7);
            const name = deviceName || `Zebra ${deviceId.substring(0, 4)}`;
            await startSession(`Inventario ${name}`, undefined, undefined);
        }
        setStep('counting');
        trigger('success');
    };

    const renderConfig = () => {
        if (!accessMode) return (
            <div className="space-y-4 px-4 py-4">
                {renderSelection()}
            </div>
        );

        if (accessMode === 'admin') {
            if (step === 'admin_config') return renderAdminConfig();
            if (step === 'admin_summary') return renderAdminSummary();
            if (step === 'admin_sync') return renderAdminSync();
            if (step === 'qr_generator') return renderQRGenerator();
        }
        if (accessMode === 'zebra' || accessMode === 'salon') {
            const isZebra = accessMode === 'zebra';
            return (
                <div className="flex-1 flex flex-col min-h-full space-y-4 px-4 pb-4">
                    <Frame className="w-full shadow-sm border-border/30 rounded-lg overflow-hidden">
                        <FrameHeader className="flex-row items-center justify-between px-4 py-3 border-b border-border/10 bg-muted/5">
                            <div className="flex items-center gap-2.5 font-bold text-sm tracking-tight text-foreground">
                                {isZebra ? <Barcode className="size-4 text-primary" /> : <Monitor className="size-4 text-primary" />}
                                Conexión de Dispositivos
                            </div>
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                                    {isZebra ? 'ZEBRA SYNC' : 'PC SALÓN'}
                                </span>
                            </div>
                        </FrameHeader>

                        <FramePanel className="p-0">
                            <CardPanel className="flex flex-col items-center justify-center space-y-8 text-center py-12 px-6">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold tracking-tight">Código de verificación</h3>
                                    <p className="text-sm text-muted-foreground/70">Ingrese el código de 6 dígitos en la terminal Zebra</p>
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
                                        Esta pantalla se actualizará automáticamente cuando se detecte una conexión entrante desde los dispositivos móviles.
                                    </p>
                                </div>
                            </CardPanel>
                        </FramePanel>
                    </Frame>

                    <div className="flex-1" />

                    <div className="mb-6 flex flex-col gap-3">
                        <Button
                            variant="ghost"
                            className="w-full font-bold h-12 rounded-xl text-muted-foreground hover:text-foreground"
                            onClick={handleSkip}
                        >
                            Omitir conexión
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="flex-1 font-bold h-10 rounded-xl shadow-none"
                                onClick={() => setAccessMode(null)}
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
    };

    // Main Render logic (No modification needed to steps, we stay in the same layout)

    return (
        <div className={cn(
            "h-full flex flex-col relative overflow-hidden", 
            accessMode === 'zebra' && "fixed lg:relative inset-0 lg:inset-auto z-[100] lg:z-auto bg-background lg:bg-transparent"
        )}>
            <motion.div
                className="h-full flex flex-col space-y-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <AnimatePresence mode="wait">
                    {accessMode === null ? (
                        <motion.div
                            key="selection"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 overflow-auto custom-scrollbar p-4 md:p-0"
                        >
                            {renderSelection()}
                        </motion.div>
                    ) : (step === 'config' || step === 'admin_config' || step === 'admin_summary' || step === 'admin_sync' || step === 'qr_generator') ? (
                        <motion.div
                            key="config"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 flex flex-col p-0 md:p-2 lg:grid lg:grid-cols-12 gap-0 lg:gap-6 w-full h-full"
                        >
                            {/* Left Column: Config Steps */}
                            <div className="lg:col-span-4 lg:col-start-1 flex-1 flex flex-col min-h-0 h-full">
                                <Card className="flex flex-col flex-1 overflow-hidden bg-transparent lg:bg-gradient-to-br from-secondary/5 to-secondary/10 border-0 lg:border-muted/50 shadow-none lg:shadow-md h-full">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={step}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.25 }}
                                            className="flex flex-col flex-1 overflow-auto custom-scrollbar"
                                        >
                                            {renderConfig()}
                                        </motion.div>
                                    </AnimatePresence>
                                </Card>
                            </div>

                            {/* Right Column: Empty State, Table Preview or Connected Devices during config */}
                            <Elevated
                                offset={1}
                                className="hidden lg:flex lg:col-span-8 lg:col-start-5 flex-col min-h-0 border border-border/40 rounded-xl overflow-hidden"
                            >
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
                            </Elevated>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="counting"
                            id="counting-main-container"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 p-0 md:p-2 grid grid-cols-1 grid-rows-[auto_1fr] lg:grid-rows-none lg:grid-cols-12 gap-0 lg:gap-6 w-full h-full overflow-hidden"
                        >
                            {/* VISTA MONITOR ADMIN (3 COLUMNAS) */}
                            {accessMode === 'admin' ? (
                                <>
                                    {/* Column 1: Tabs + Session Control (4 units) */}
                                    <div className="lg:col-span-4 flex flex-col h-full min-h-0 bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm">

                                        {/* Header Section (v0 Style) */}
                                        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                                                    {session?.sector || 'Inventario General'}
                                                </h1>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground/60">
                                                    <div className="flex items-center">
                                                        {(() => {
                                                            const dateStr = format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
                                                            return dateStr.charAt(0).toUpperCase() + dateStr.slice(1).replace(/de (\w)/, (match, p1) => `de ${p1.toUpperCase()}`);
                                                        })()}
                                                    </div>
                                                    <span className="text-muted-foreground/20 font-black">·</span>
                                                    <div className="font-bold text-primary/70 tracking-tight">
                                                        {elapsedTime}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" size="sm">ID: {session?.id?.slice(-4) || '----'}</Badge>
                                                <Badge variant="success" size="sm">Online</Badge>
                                            </div>
                                        </div>

                                        {/* Tabs Navigation */}
                                        <Tabs value={adminTab} onValueChange={setAdminTab} className="flex-1 flex flex-col min-h-0">
                                            <div className="px-4 pb-2">
                                                <TabsList className="w-full">
                                                    <TabsTab value="resumen">Resumen</TabsTab>
                                                    <TabsTab value="archivos">Archivos</TabsTab>
                                                    <TabsTab value="conexiones">Conexiones</TabsTab>
                                                </TabsList>
                                            </div>

                                            <TabsPanel value="resumen" className="flex-1 flex flex-col gap-4 p-4 overflow-auto bg-muted/5">
                                                {/* Frame 1: Resumen General - Key Metrics Pattern */}
                                                <CardFrame className="w-full">
                                                    <CardFrameHeader className="flex-row items-center justify-between py-3">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="size-4 text-primary" />
                                                            <CardFrameTitle>Resumen de Catálogo</CardFrameTitle>
                                                        </div>
                                                    </CardFrameHeader>
                                                    <Card>
                                                        <CardPanel className="p-0">
                                                            <div className="grid grid-cols-2 divide-x divide-y divide-border/40">
                                                                {/* Metric 1: Total SKUs */}
                                                                <div className="p-6 flex flex-col items-center justify-center text-center space-y-1">
                                                                    <p className="text-xs font-medium text-muted-foreground/60 tracking-tight">Total skus</p>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-2xl font-bold tracking-tight">{stockMetrics?.eans.toLocaleString() || '0'}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Metric 2: Total Unidades */}
                                                                <div className="p-6 flex flex-col items-center justify-center text-center space-y-1">
                                                                    <p className="text-xs font-medium text-muted-foreground/60 tracking-tight">Total unidades</p>
                                                                    <div className="flex items-baseline gap-1">
                                                                        <span className="text-2xl font-bold tracking-tight">{stockMetrics?.positiveUnits.toLocaleString() || '0'}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Metric 3: Stock Negativo */}
                                                                <div className="p-6 flex flex-col items-center justify-center text-center space-y-1">
                                                                    <p className="text-xs font-medium text-muted-foreground/60 tracking-tight">Stock negativo</p>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-2xl font-bold tracking-tight text-red-500">{stockMetrics?.negativeUnits.toLocaleString() || '0'}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Metric 4: Valorización Negativa */}
                                                                <div className="p-6 flex flex-col items-center justify-center text-center space-y-1">
                                                                    <p className="text-xs font-medium text-muted-foreground/60 tracking-tight">Valorización negativa</p>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-2xl font-bold tracking-tight text-red-600/80">$ {(stockMetrics?.negativeValue || 0).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardPanel>
                                                    </Card>
                                                </CardFrame>

                                                {/* Frame 2: Estadísticas de Sesión */}
                                                <CardFrame className="w-full">
                                                    <CardFrameHeader className="flex-row items-center justify-between py-3">
                                                        <div className="flex items-center gap-2">
                                                            <Zap className="size-4 text-primary" />
                                                            <CardFrameTitle>Estadísticas de Sesión</CardFrameTitle>
                                                        </div>
                                                    </CardFrameHeader>
                                                    <Card>
                                                        <CardPanel className="p-0">
                                                            <Accordion className="w-full">
                                                                <AccordionItem value="item-1">
                                                                    <AccordionTrigger className="px-6 py-4">Resumen de Terminales</AccordionTrigger>
                                                                    <AccordionPanel className="px-6 pb-4 text-muted-foreground text-sm">
                                                                        Información detallada sobre el estado de conexión y progreso de cada terminal Zebra activa.
                                                                    </AccordionPanel>
                                                                </AccordionItem>
                                                                <AccordionItem value="item-2">
                                                                    <AccordionTrigger className="px-6 py-4">Velocidad de Conteo</AccordionTrigger>
                                                                    <AccordionPanel className="px-6 pb-4 text-muted-foreground text-sm">
                                                                        Análisis promedio de productos escaneados por minuto en toda la sesión actual.
                                                                    </AccordionPanel>
                                                                </AccordionItem>
                                                                <AccordionItem value="item-3">
                                                                    <AccordionTrigger className="px-6 py-4">Alertas de Sincronización</AccordionTrigger>
                                                                    <AccordionPanel className="px-6 pb-4 text-muted-foreground text-sm">
                                                                        Registro de posibles conflictos o advertencias durante la transmisión de datos.
                                                                    </AccordionPanel>
                                                                </AccordionItem>
                                                                <AccordionItem value="item-4">
                                                                    <AccordionTrigger className="px-6 py-4">Historial de Errores</AccordionTrigger>
                                                                    <AccordionPanel className="px-6 pb-4 text-muted-foreground text-sm">
                                                                        Listado de EANs no encontrados o problemas de lectura reportados por los operadores.
                                                                    </AccordionPanel>
                                                                </AccordionItem>
                                                            </Accordion>
                                                        </CardPanel>
                                                    </Card>
                                                </CardFrame>
                                            </TabsPanel>

                                            <TabsPanel value="archivos" className="flex-1 overflow-auto p-4 bg-muted/5 space-y-4">
                                                <CardFrame className="w-full">
                                                    <CardFrameHeader className="flex-row items-center justify-between py-3">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="size-4 text-primary" />
                                                            <CardFrameTitle>Gestión de archivos de inventario</CardFrameTitle>
                                                        </div>
                                                        <CardFrameAction className="col-start-auto flex items-center gap-2">
                                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold text-[10px]">
                                                                {combinedFiles.length} archivos
                                                            </Badge>
                                                        </CardFrameAction>
                                                    </CardFrameHeader>
                                                    <Card>
                                                        <CardPanel className="p-4 space-y-4">
                                                            <div
                                                                className={cn(
                                                                    "flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer group",
                                                                    "border-border/40 hover:border-primary/40 hover:bg-primary/5",
                                                                    combinedFiles.length > 0 && "min-h-[120px]"
                                                                )}
                                                                onClick={() => {
                                                                    const input = document.getElementById('admin-file-upload-active');
                                                                    if (input) input.click();
                                                                }}
                                                            >
                                                                <input
                                                                    id="admin-file-upload-active"
                                                                    type="file"
                                                                    className="sr-only"
                                                                    multiple
                                                                    accept=".txt,.csv"
                                                                    onChange={(e) => {
                                                                        if (e.target.files) {
                                                                            const newFiles = Array.from(e.target.files).map(f => ({
                                                                                id: Math.random().toString(36).substr(2, 9),
                                                                                name: f.name,
                                                                                size: f.size,
                                                                                lastModified: f.lastModified
                                                                            }));
                                                                            setUploadedFiles(prev => [...prev, ...newFiles]);
                                                                        }
                                                                    }}
                                                                />

                                                                <div className="flex flex-col items-center justify-center text-center">
                                                                    <div className="mb-3 flex size-12 shrink-0 items-center justify-center rounded-full border border-border/40 bg-background shadow-sm group-hover:scale-110 transition-transform">
                                                                        <Upload className="size-5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                                                                    </div>
                                                                    <p className="mb-1 font-bold text-sm text-foreground">Subir archivos de conteo</p>
                                                                    <p className="mb-3 text-muted-foreground text-[11px]">
                                                                        Arrastre y suelte sus archivos .txt o haga clic para buscar
                                                                    </p>
                                                                    <div className="flex flex-wrap justify-center gap-1.5 text-muted-foreground/50 text-[10px] font-medium">
                                                                        <span>Solo txt / csv</span>
                                                                        <span>•</span>
                                                                        <span>Máx 10 MB</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {combinedFiles.length > 0 && (
                                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                    <div className="flex items-center justify-between px-1">
                                                                        <span className="text-sm font-bold text-foreground">Listado de archivos para procesar</span>
                                                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-destructive hover:bg-destructive/10" onClick={() => setUploadedFiles([])}>
                                                                            Limpiar lista
                                                                        </Button>
                                                                    </div>

                                                                    <div className="grid gap-2">
                                                                        {combinedFiles.map((file) => (
                                                                            <div
                                                                                key={file.id}
                                                                                className={cn(
                                                                                    "flex items-center justify-between gap-3 rounded-xl border border-border/40 p-3 hover:bg-accent/30 transition-colors group/item",
                                                                                    file.isReceived ? "bg-primary/5 border-primary/20" : "bg-muted/5"
                                                                                )}
                                                                            >
                                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                                    <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background shadow-sm">
                                                                                        {file.isReceived ? <Smartphone className="size-4 text-primary" /> : <FileText className="size-4 text-muted-foreground/60" />}
                                                                                    </div>
                                                                                    <div className="flex min-w-0 flex-col gap-0.5">
                                                                                        <p className="truncate font-bold text-[12px] text-foreground">{file.name}</p>
                                                                                        <p className="text-muted-foreground text-[10px] font-medium">
                                                                                            {file.isReceived ? (
                                                                                                <span className="flex items-center gap-1">
                                                                                                    <Badge variant="outline" className="h-3.5 px-1 text-[8px] font-black uppercase bg-primary/10 text-primary border-primary/10">RECIBIDO</Badge>
                                                                                                    De {file.from} • {formatBytes(Number(file.size || 0))}
                                                                                                </span>
                                                                                            ) : (
                                                                                                `${formatBytes(Number(file.size || 0))} • Listo para procesar`
                                                                                            )}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-1">
                                                                                    {file.content && (
                                                                                        <Button variant="ghost" size="icon" className="size-7 text-primary hover:bg-primary/10 rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={() => {
                                                                                            const blob = new Blob([file.content], { type: 'text/plain' });
                                                                                            const url = URL.createObjectURL(blob);
                                                                                            const link = document.createElement('a');
                                                                                            link.href = url;
                                                                                            link.download = file.name;
                                                                                            document.body.appendChild(link);
                                                                                            link.click();
                                                                                            document.body.removeChild(link);
                                                                                            URL.revokeObjectURL(url);
                                                                                        }}>
                                                                                            <Download className="size-4" />
                                                                                        </Button>
                                                                                    )}
                                                                                    {!file.isReceived && (
                                                                                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity" onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}>
                                                                                            <X aria-hidden="true" className="size-4" />
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <Button className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 rounded-xl shadow-none group">
                                                                        <Zap className="size-4 mr-2 group-hover:animate-pulse" />
                                                                        Procesar conteo general
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </CardPanel>
                                                    </Card>
                                                </CardFrame>
                                            </TabsPanel>

                                            <TabsPanel value="conexiones" className="flex-1 flex flex-col gap-0 overflow-y-auto custom-scrollbar">
                                                <div className="p-4">
                                                    <CardFrame className="w-full">
                                                        <CardFrameHeader className="flex-row items-center justify-between py-3">
                                                            <div className="flex items-center gap-2">
                                                                <Laptop className="size-4 text-primary" />
                                                                <CardFrameTitle>Conexión de Dispositivos</CardFrameTitle>
                                                            </div>
                                                        </CardFrameHeader>
                                                        <Card>
                                                            <CardPanel className="flex flex-col items-center justify-center space-y-6 text-center py-10">
                                                                <div className="space-y-2">
                                                                    <h3 className="text-xl font-bold tracking-tight">Código de verificación</h3>
                                                                    <p className="text-sm text-muted-foreground/70">Ingrese el código de 6 dígitos en la terminal Zebra</p>
                                                                </div>

                                                                <InputOTP maxLength={6} value={syncPin} readOnly>
                                                                    <InputOTPGroup className="gap-1.5">
                                                                        <InputOTPSlot index={0} className="!h-12 !w-10 !rounded-xl !border border-border/30 bg-background shadow-xs text-xl font-black" />
                                                                        <InputOTPSlot index={1} className="!h-12 !w-10 !rounded-xl !border border-border/30 bg-background shadow-xs text-xl font-black" />
                                                                        <InputOTPSlot index={2} className="!h-12 !w-10 !rounded-xl !border border-border/30 bg-background shadow-xs text-xl font-black" />
                                                                    </InputOTPGroup>
                                                                    <div className="mx-2 text-muted-foreground/20 font-bold text-xl">-</div>
                                                                    <InputOTPGroup className="gap-1.5">
                                                                        <InputOTPSlot index={3} className="!h-12 !w-10 !rounded-xl !border border-border/30 bg-background shadow-xs text-xl font-black" />
                                                                        <InputOTPSlot index={4} className="!h-12 !w-10 !rounded-xl !border border-border/30 bg-background shadow-xs text-xl font-black" />
                                                                        <InputOTPSlot index={5} className="!h-12 !w-10 !rounded-xl !border border-border/30 bg-background shadow-xs text-xl font-black" />
                                                                    </InputOTPGroup>
                                                                </InputOTP>

                                                                <p className="max-w-[280px] text-[11px] leading-relaxed text-muted-foreground/50">
                                                                    Esta pantalla se actualizará automáticamente cuando se detecte una conexión entrante desde los dispositivos móviles.
                                                                </p>
                                                            </CardPanel>
                                                        </Card>
                                                    </CardFrame>
                                                </div>
                                            </TabsPanel>
                                        </Tabs>

                                        {/* Action Buttons inside Col 1 */}
                                        <div className="flex flex-col gap-2 p-4 border-t border-border/40 bg-background mt-auto">
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="outline" onClick={handleExportPDF} className="h-10 font-bold text-xs gap-2 rounded-xl border-border/40">
                                                    <FileText className="size-4" /> PDF
                                                </Button>
                                                <Button variant="outline" onClick={handleExportTXT} className="h-10 font-bold text-xs gap-2 rounded-xl border-border/40">
                                                    <Upload className="size-4" /> TXT
                                                </Button>
                                            </div>
                                            <Button onClick={handleFinishClick} className="w-full h-12 font-bold text-sm gap-2 rounded-xl">
                                                <CheckCircle className="size-5" /> Finalizar Inventario
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Column 2: Connected Terminals (8 units) */}
                                    <div className="lg:col-span-8 lg:col-start-5 flex flex-col h-full min-h-0 bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm">
                                        <ConnectedDevicesList devices={connectedDevices} className="flex-1" />
                                    </div>
                                </>
                            ) : (
                                /* VISTA CARGA (ZEBRA/SALON - 2 COLUMNAS) */
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
                                                                } else if (accessMode === 'zebra') {
                                                                    setTimeout(() => setShowQtyDrawer(true), 80);
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
                                                            accessMode={accessMode}
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
                                                                    if (accessMode === 'zebra') {
                                                                        setShowQtyDrawer(true);
                                                                    } else {
                                                                        document.getElementById('quantity-input')?.focus();
                                                                        (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                                    }
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
                                                                            if (accessMode === 'zebra') {
                                                                                setShowQtyDrawer(true);
                                                                            } else {
                                                                                document.getElementById('quantity-input')?.focus();
                                                                                (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                                            }
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
                                                        if (accessMode === 'zebra') {
                                                            setShowQtyDrawer(true);
                                                        } else {
                                                            setTimeout(() => {
                                                                document.getElementById('quantity-input')?.focus();
                                                                (document.getElementById('quantity-input') as HTMLInputElement)?.select();
                                                            }, 50);
                                                        }
                                                    }}
                                                    masterCatalog={session?.master_catalog}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>


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


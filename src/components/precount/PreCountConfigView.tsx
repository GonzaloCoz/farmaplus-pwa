import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import {
    CheckCircle2,
    ChevronDown,
    ShieldCheck,
    Globe,
    FileSpreadsheet,
    Database,
    Upload,
    Wifi,
    AlertCircle,
    RefreshCw,
    Loader2,
    Copy,
    KeyRound,
    Eye,
    EyeOff,
    QrCode,
    ChevronUp
} from 'lucide-react';
import { InventoryQrLocationsPanel } from '@/components/settings/InventoryQrLocationsPanel';
import { OFFICIAL_71_BRANCHES } from '@/lib/branchNetworkMap';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import { seedSessionLocationsFromBranch } from '@/services/branchLocationsService';
import { OtpInput } from '@/components/ui/otp-segmented-input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabItem, TabPanel } from '@/components/ui/tabs';
import { testMysqlConnection, isTauriEnvironment, fetchMysqlStock, convertMysqlToMasterCatalog, createPlexInventorySession, getPlexOpenInventorySessions, sanitizeMysqlError, type PlexOpenSession } from '@/services/mysqlTauriBridge';
import { syncMysqlToLocalDb, importCatalogToLocalDb } from '@/services/tauriLocalDb';
import ExcelNightWorker from '@/workers/excelNightWorker?worker';
import { MasterCatalogItem, createSession, getSessionByPin, getDeviceId } from '@/services/preCountDB';
import { emitDeviceTelemetry } from '@/services/deviceTelemetry';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/services/db';
import { OneTimeCode } from '@/components/ui/OneTimeCode';
import { ScrollArea } from '@/components/ui/scroll-area';
import { compressJsonToGzipBase64, decompressGzipBase64ToJson } from '@/lib/compression';

const RUBROS_CONFIG = ["Medicamentos", "Perfumería", "Accesorios", "Varios"] as const;

export type StockFilterOption = 'all' | 'positive' | 'negative' | 'zero';
export type ImportSourceOption = 'file' | 'server';

interface PreCountConfigViewProps {
    sessionId?: string;
    defaultInventoryName?: string;
    isBranchProfile?: boolean;
    onSave?: (config: {
        name: string;
        branch: string;
        ip: string;
        port?: string;
        file?: File | null;
        importSource?: ImportSourceOption;
        verificationCode: string;
        rubros?: string[];
        stockFilter?: StockFilterOption;
    }) => void;
    onSessionCreated?: (session: any) => void;
}

function expandCatalogToDbProducts(catalog: MasterCatalogItem[], sessionId: string) {
    const rows: any[] = [];
    catalog.forEach(p => {
        const eans: string[] = (p.eans && p.eans.length > 0) ? p.eans : [p.ean];
        eans.forEach((ean: string) => {
            if (!ean || ean === 'undefined') return;
            rows.push({
                ean,
                name: p.name,
                cost: p.cost || 0,
                salePrice: p.salePrice || 0,
                laboratory: p.laboratory || '',
                rubro: p.rubro || (p as any).category || '',
                subrubro: p.subrubro || '',
                stock: p.systemStock || 0,
                id_producto: p.id_producto || '',
                session_id: sessionId
            });
        });
    });
    return rows;
}

function getRubroIndex(rubroName?: string): number {
    if (!rubroName) return 3; // Varios por defecto
    const clean = rubroName.toLowerCase().trim();
    if (clean.includes('medicam') || clean.includes('farmacia') || clean.includes('etico') || clean.includes('generico') || clean.includes('otc') || clean.includes('droga')) {
        return 0; // Medicamentos
    }
    if (clean.includes('perfum') || clean.includes('belleza') || clean.includes('cosmet') || clean.includes('cuidado') || clean.includes('higiene')) {
        return 1; // Perfumería
    }
    if (clean.includes('accesor') || clean.includes('insumo') || clean.includes('descartab') || clean.includes('material') || clean.includes('ortopedia')) {
        return 2; // Accesorios
    }
    return 3; // Varios
}

function applyCatalogFilters(
    catalog: MasterCatalogItem[] | null,
    checkedRubros: Set<number>,
    stockFilter: StockFilterOption,
    includeCatalogEans: boolean = false
): MasterCatalogItem[] | null {
    if (!catalog || catalog.length === 0) return null;

    return catalog.filter((item) => {
        // 1. Filtro de Rubro
        const rubroIdx = getRubroIndex(item.rubro);
        if (!checkedRubros.has(rubroIdx)) {
            return false;
        }

        // 2. Filtro de Saldo de Stock
        const stockVal = Number(item.systemStock) || 0;
        const isComplementary = includeCatalogEans && (stockVal === 0) && Boolean(item.ean);
        const isHidden = Boolean(item.is_hidden);

        if (stockFilter === 'positive' && stockVal <= 0 && !isComplementary && !isHidden) {
            return false;
        }
        if (stockFilter === 'negative' && stockVal >= 0 && !isComplementary && !isHidden) {
            return false;
        }
        if (stockFilter === 'zero' && stockVal !== 0 && !isHidden) {
            return false;
        }

        return true;
    });
}

function formatBranchName(raw: string): string {
    return raw
        .toLowerCase()
        .split(' ')
        .map(word => {
            if (['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'].includes(word)) {
                return word.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

const SORTED_BRANCHES = [...OFFICIAL_71_BRANCHES].sort((a, b) =>
    formatBranchName(a.name).localeCompare(formatBranchName(b.name), 'es', { sensitivity: 'base' })
);

const BRANCH_OPTIONS = SORTED_BRANCHES.map(
    (b) => formatBranchName(b.name)
);

export function PreCountConfigView({
    sessionId,
    defaultInventoryName,
    isBranchProfile = false,
    onSave,
    onSessionCreated
}: PreCountConfigViewProps) {
    const { user } = useUser();

    // Determinar sucursal inicial (guardada previamente en localStorage, usuario logueado o Saladillo por defecto)
    const initialBranchObj = useMemo(() => {
        if (typeof window !== 'undefined') {
            const savedBranch = localStorage.getItem('precount_config_selected_branch');
            if (savedBranch) {
                const cleanSaved = savedBranch.replace(/\s*\([^)]*\)$/, '').trim();
                const matchSaved = OFFICIAL_71_BRANCHES.find(b => 
                    formatBranchName(b.name).toLowerCase() === cleanSaved.toLowerCase() ||
                    b.name.toLowerCase() === cleanSaved.toLowerCase() ||
                    cleanSaved.toLowerCase().includes(b.name.toLowerCase())
                );
                if (matchSaved) return matchSaved;
            }
        }
        if (user?.branchSheet) {
            const match = OFFICIAL_71_BRANCHES.find(b => 
                b.name.toLowerCase() === user.branchSheet?.toLowerCase() ||
                user.branchSheet?.toLowerCase().includes(b.name.toLowerCase())
            );
            if (match) return match;
        }
        return OFFICIAL_71_BRANCHES.find(b => b.name.toUpperCase() === 'SALADILLO') || OFFICIAL_71_BRANCHES[0];
    }, [user?.branchSheet]);

    const initialBranchLabel = useMemo(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('precount_config_selected_branch');
            if (saved) {
                const cleanSaved = saved.replace(/\s*\([^)]*\)$/, '').trim();
                if (BRANCH_OPTIONS.includes(cleanSaved)) {
                    return cleanSaved;
                }
            }
        }
        return formatBranchName(initialBranchObj.name);
    }, [initialBranchObj]);

    const initialName = useMemo(() => {
        if (defaultInventoryName && !/^listado[_\s]+(?:de[_\s]+)?stock/i.test(defaultInventoryName.trim())) {
            return defaultInventoryName;
        }
        if (typeof window !== 'undefined') {
            const savedName = localStorage.getItem('precount_config_inventory_name');
            if (savedName && !/^listado[_\s]+(?:de[_\s]+)?stock/i.test(savedName.trim())) {
                return savedName;
            }
        }
        return `Inventario ${formatBranchName(initialBranchObj.name)}`;
    }, [defaultInventoryName, initialBranchObj]);

    const [selectedBranch, setSelectedBranch] = useState<string>(initialBranchLabel);
    const [inventoryName, setInventoryName] = useState(initialName);
    const [operatorName, setOperatorName] = useState<string>(() => {
        if (isBranchProfile) {
            return '';
        }
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('precount_device_name');
            if (saved && saved !== 'Generic Device') return saved;
        }
        return user?.name || user?.username || '';
    });
    const [branchPin, setBranchPin] = useState<string>('');
    const [serverIp, setServerIp] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedIp = localStorage.getItem('precount_config_server_ip');
            if (savedIp) return savedIp;
        }
        return initialBranchObj.primaryIp;
    });
    const [showServerIp, setShowServerIp] = useState(false);
    const [serverPort, setServerPort] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedPort = localStorage.getItem('precount_config_server_port');
            if (savedPort && savedPort !== "****") return savedPort;
        }
        return "****";
    });
    const [checkedRubros, setCheckedRubros] = useState<Set<number>>(new Set([0, 1, 2, 3]));
    const [stockFilter, setStockFilter] = useState<StockFilterOption>('all');
    const [includeCatalogEans, setIncludeCatalogEans] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('precount_config_include_catalog_eans');
            if (saved !== null) return saved === 'true';
        }
        return false;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('precount_config_include_catalog_eans', String(includeCatalogEans));
        }
    }, [includeCatalogEans]);

    const [includeHiddenInactive, setIncludeHiddenInactive] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('precount_config_include_hidden_inactive');
            if (saved !== null) return saved === 'true';
        }
        return false;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('precount_config_include_hidden_inactive', String(includeHiddenInactive));
        }
    }, [includeHiddenInactive]);

    const [generatedPin, setGeneratedPin] = useState<string>(() => Math.floor(100000 + Math.random() * 900000).toString());
    const [copiedPin, setCopiedPin] = useState(false);
    const [showQrLocationsSection, setShowQrLocationsSection] = useState(true);
    const [importSource, setImportSource] = useState<ImportSourceOption>('file');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [isSyncingLocalDb, setIsSyncingLocalDb] = useState(false);
    const [isParsingFile, setIsParsingFile] = useState(false);
    const [isStartingSession, setIsStartingSession] = useState(false);
    const isStartingSessionRef = useRef(false);
    const [rawCatalog, setRawCatalog] = useState<MasterCatalogItem[] | null>(null);
    const [localDbCount, setLocalDbCount] = useState<number | null>(null);

    // Catálogo filtrado reactivo según rubros y saldo de stock
    const parsedCatalog = useMemo(
        () => applyCatalogFilters(rawCatalog, checkedRubros, stockFilter, includeCatalogEans),
        [rawCatalog, checkedRubros, stockFilter, includeCatalogEans]
    );

    // Resolver Branch ID real en Supabase (insensible a tildes) para evitar asignar usuario Nuñez o branch_id null
    const resolveTargetBranch = async (branchLabel: string) => {
        const cleanBranchName = branchLabel.replace(/\s*\([^)]*\)/, '').trim();
        const normalizeName = (s: string) =>
            s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const targetNorm = normalizeName(cleanBranchName);

        try {
            const { data: supaBranches } = await supabase.from('branches').select('id, name');
            if (supaBranches && supaBranches.length > 0) {
                const match =
                    supaBranches.find(b => normalizeName(b.name) === targetNorm) ||
                    supaBranches.find(b =>
                        targetNorm.includes(normalizeName(b.name)) ||
                        normalizeName(b.name).includes(targetNorm)
                    );
                if (match) {
                    return { branchId: match.id, branchName: match.name };
                }
            }
        } catch (err) {
            console.warn('Error resolviendo branch en Supabase:', err);
        }
        return { branchId: null, branchName: cleanBranchName };
    };

    // Estado para sesiones abiertas en el Servidor Plex de la IP elegida
    const [openPlexSessions, setOpenPlexSessions] = useState<PlexOpenSession[]>([]);
    const [isCheckingPlexSessions, setIsCheckingPlexSessions] = useState(false);
    const [selectedPlexMode, setSelectedPlexMode] = useState<string>('new');
    const [selectedPlexSession, setSelectedPlexSession] = useState<PlexOpenSession | null>(null);

    const fetchOpenSessions = async (targetIp: string, targetPort: string = "3306") => {
        const ip = targetIp.trim();
        if (!ip) return;
        setIsCheckingPlexSessions(true);
        try {
            const res = await getPlexOpenInventorySessions({
                host: ip,
                port: Number(targetPort) || 3306,
                user: 'root',
                password: '',
                database: 'plex',
            });
            if (res.success && res.sessions) {
                setOpenPlexSessions(res.sessions);
            } else {
                setOpenPlexSessions([]);
            }
        } catch (err) {
            console.warn('[Plex] Error consultando sesiones abiertas:', err);
            setOpenPlexSessions([]);
        } finally {
            setIsCheckingPlexSessions(false);
        }
    };

    useEffect(() => {
        if (!isBranchProfile && serverIp) {
            fetchOpenSessions(serverIp, serverPort);
        }
    }, [isBranchProfile, serverIp]);

    // Sincronizar nombre de operador en storage cuando cambia
    useEffect(() => {
        if (isBranchProfile && operatorName.trim()) {
            localStorage.setItem('precount_device_name', operatorName.trim());
        }
    }, [isBranchProfile, operatorName]);

    // Si se retoma una sesión existente (o hay una activa), cargar su PIN y configuración verificando que siga activa en el servidor
    useEffect(() => {
        let isCancelled = false;
        async function loadActiveSessionInfo() {
            const activeId = sessionId || (typeof window !== 'undefined' ? (localStorage.getItem('last_precount_session_id') || localStorage.getItem('precount_session_id')) : null);
            if (!activeId) return;

            try {
                // 1. Si hay conexión, verificar primero en Supabase si la sesión sigue activa
                let remote: any = null;
                let remoteChecked = false;
                if (typeof navigator === 'undefined' || navigator.onLine) {
                    const { data, error } = await (supabase as any)
                        .from('precount_sessions')
                        .select('*')
                        .eq('id', activeId)
                        .eq('status', 'active')
                        .maybeSingle();
                    if (!error) {
                        remote = data;
                        remoteChecked = true;
                    }
                }

                // Verificar si tiene un create pendiente offline antes de descartarla
                const pendingCreates = await db.pendingActions
                    .where('entity').equals('session')
                    .and(a => (a as any).type === 'create' && a.data?.id === activeId)
                    .count();

                if (remoteChecked && !remote && pendingCreates === 0) {
                    // La sesión fue eliminada o cerrada en el servidor: purgar de Dexie y storage local
                    await db.sessions.delete(activeId);
                    await db.items.where('session_id').equals(activeId).delete();
                    await db.locations.where('session_id').equals(activeId).delete();
                    await db.precount_products.where('session_id').equals(activeId).delete();

                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('last_precount_session_id');
                        localStorage.removeItem('precount_session_id');
                        localStorage.removeItem('active_precount_session_id');
                        localStorage.removeItem('precount_config_inventory_name');
                        sessionStorage.removeItem('active_precount_session_id');
                    }
                    if (!isCancelled) {
                        const cleanDefault = `Inventario ${formatBranchName(initialBranchObj.name)}`;
                        setInventoryName(cleanDefault);
                    }
                    return;
                }

                // 2. Buscar en Dexie local (o usar datos remotos)
                const local = await db.sessions.get(activeId);
                if (local && !isCancelled) {
                    const savedCustomName = typeof window !== 'undefined' ? localStorage.getItem('precount_config_inventory_name') : null;
                    if (savedCustomName && !/^listado[_\s]+(?:de[_\s]+)?stock/i.test(savedCustomName.trim())) {
                        setInventoryName(savedCustomName);
                    } else if (local.sector) {
                        setInventoryName(local.sector);
                    }
                    if (local.sync_pin) {
                        setGeneratedPin(local.sync_pin);
                    }
                    if (local.master_catalog && local.master_catalog.length > 0) {
                        setRawCatalog(local.master_catalog);
                        setLocalDbCount(local.master_catalog.length);
                    }
                    return;
                }

                if (remote && !isCancelled) {
                    const savedCustomName = typeof window !== 'undefined' ? localStorage.getItem('precount_config_inventory_name') : null;
                    if (savedCustomName && !/^listado[_\s]+(?:de[_\s]+)?stock/i.test(savedCustomName.trim())) {
                        setInventoryName(savedCustomName);
                    } else if (remote.sector) {
                        setInventoryName(remote.sector);
                    }
                    if (remote.sync_pin) setGeneratedPin(remote.sync_pin);

                    // Intentar recuperar el archivo master_catalog.json de Supabase
                    try {
                        const { data: catFile } = await (supabase as any)
                            .from('precount_device_files')
                            .select('content')
                            .eq('session_id', activeId)
                            .eq('filename', 'master_catalog.json')
                            .maybeSingle();
                        if (catFile?.content && !isCancelled) {
                            const parsed = await decompressGzipBase64ToJson(catFile.content);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                setRawCatalog(parsed);
                                setLocalDbCount(parsed.length);
                            }
                        }
                    } catch {}
                }
            } catch (err) {
                console.warn('[PreCountConfigView] Error cargando datos de sesión activa:', err);
            }
        }
        loadActiveSessionInfo();
        return () => {
            isCancelled = true;
        };
    }, [sessionId, initialBranchObj]);

    const parseExcelFile = (file: File) => {
        setIsParsingFile(true);
        notify.info('Procesando archivo', `Leyendo "${file.name}"...`);

        const reader = new FileReader();
        reader.onload = (e) => {
            const fileContent = e.target?.result;
            const worker = new ExcelNightWorker();

            worker.onmessage = (eMsg) => {
                const { success, error, catalog } = eMsg.data;
                setIsParsingFile(false);
                if (error) {
                    notify.error('Error al procesar archivo', error);
                    setSelectedFile(null);
                    setRawCatalog(null);
                    worker.terminate();
                    return;
                }

                if (success && catalog && catalog.length > 0) {
                    setRawCatalog(catalog);
                    notify.success('Catálogo procesado', `${catalog.length.toLocaleString('es-AR')} productos listos para filtrar e inventariar.`);
                } else {
                    notify.warning('Sin productos', 'No se encontraron productos válidos en el archivo.');
                }
                worker.terminate();
            };

            worker.onerror = (err) => {
                console.error('Worker error:', err);
                setIsParsingFile(false);
                notify.error('Error', 'Fallo al procesar el archivo Excel.');
                worker.terminate();
            };

            worker.postMessage({ fileData: fileContent, profile: 'sucursal' });
        };

        reader.onerror = () => {
            setIsParsingFile(false);
            notify.error('Error', 'No se pudo leer el archivo seleccionado.');
        };

        reader.readAsBinaryString(file);
    };

    const handleSyncLocalStock = async () => {
        setIsSyncingLocalDb(true);
        notify.info('Servidor Plex', `Descargando stock de ${selectedBranch}...`);
        try {
            // 1. Extraer los productos directamente para armar el catálogo
            const res = await fetchMysqlStock({
                host: serverIp.trim() || '10.0.70.10',
                port: Number(serverPort) || 3306,
                user: 'root',
                password: '',
                database: 'plex',
                include_catalog_eans: includeCatalogEans,
                include_hidden_inactive: includeHiddenInactive,
            });

            if (res.success && res.products) {
                const catalog = convertMysqlToMasterCatalog(res.products);
                setRawCatalog(catalog);
                setLocalDbCount(res.total_products);
                notify.success('Stock sincronizado', `${res.total_products.toLocaleString('es-AR')} productos descargados desde Plex.`);
            } else {
                notify.error('Error al obtener productos', res.message || 'Sin datos de Plex');
            }
        } catch (err: any) {
            console.error('Error sincronizando MySQL:', err);
            notify.error('Error de sincronización', err?.message || String(err));
        } finally {
            setIsSyncingLocalDb(false);
        }
    };

    const hasStockReady = (rawCatalog !== null && rawCatalog.length > 0) || (importSource === 'file' && selectedFile !== null) || (importSource === 'server' && Boolean(serverIp.trim()));
    const isReadyToStart = isBranchProfile
        ? Boolean(operatorName.trim()) && branchPin.trim().length === 6
        : Boolean(inventoryName.trim()) && Boolean(serverIp.trim()) && hasStockReady;

    const handleValidateAndSyncPin = async (pinInput: string): Promise<boolean> => {
        const pinClean = pinInput.trim();
        if (pinClean.length !== 6) return false;

        const nameClean = operatorName.trim();
        if (isBranchProfile && !nameClean) {
            notify.error("Nombre requerido", "Por favor ingresá tu nombre de operador para identificar esta terminal.");
            return false;
        }

        const effectiveName = nameClean || user?.name || user?.username || 'Operador';
        localStorage.setItem('precount_device_name', effectiveName);
        localStorage.setItem('precount_user_name', effectiveName);

        try {
            // 1. Consultar sesión por PIN en Supabase (con fallback offline a Dexie)
            const remoteSession = await getSessionByPin(pinClean);

            if (remoteSession) {
                // Guardar id de sesión en storage para que todo el módulo de conteo se active
                localStorage.setItem('last_precount_session_id', remoteSession.id);
                localStorage.setItem('precount_session_id', remoteSession.id);
                sessionStorage.setItem('active_precount_session_id', remoteSession.id);

                // Adjuntar id de sesión con id de terminal y nombre de operador
                const devId = getDeviceId();
                try {
                    await (supabase as any).from('precount_connected_devices').upsert({
                        session_id: remoteSession.id,
                        device_id: devId,
                        device_name: effectiveName,
                        device_type: /Android/i.test(navigator.userAgent) ? 'zebra' : 'pc',
                        status: 'online',
                        last_seen: new Date().toISOString()
                    });
                    emitDeviceTelemetry({ sessionId: remoteSession.id });
                } catch (devErr) {
                    console.debug('[PreCountConfigView] Error registrando terminal conectada:', devErr);
                }

                notify.success("¡Sincronizado!", `Conectado al inventario "${remoteSession.sector}".`);

                if (onSessionCreated) {
                    setTimeout(() => {
                        onSessionCreated(remoteSession);
                    }, 500);
                }
                return true;
            } else {
                notify.error("PIN inválido", "No se encontró ninguna sesión activa con este PIN en el servidor.");
                return false;
            }
        } catch (err: any) {
            console.error('Error al validar PIN en servidor:', err);
            notify.error("Error de verificación", err?.message || "No se pudo contactar al servidor.");
            return false;
        }
    };

    const handleSyncBranchSession = async () => {
        const nameClean = operatorName.trim();
        if (!nameClean) {
            notify.error("Operador requerido", "Ingresá el nombre del operador para identificar los conteos de esta terminal.");
            return;
        }

        const pinClean = branchPin.trim();
        if (pinClean.length !== 6) {
            notify.error("PIN incompleto", "Por favor ingresá los 6 dígitos del PIN de sincronización.");
            return;
        }

        setIsStartingSession(true);
        try {
            await handleValidateAndSyncPin(pinClean);
        } finally {
            setIsStartingSession(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        setConnectionStatus('testing');

        if (!isTauriEnvironment()) {
            setTimeout(() => {
                const isValidIp = serverIp.trim().startsWith('10.') || serverIp.trim().startsWith('172.') || serverIp.trim() === '127.0.0.1' || serverIp.trim() === 'localhost';
                if (isValidIp) {
                    setConnectionStatus('connected');
                    notify.success('Servidor alcanzable', 'Conexión establecida correctamente.');
                } else {
                    setConnectionStatus('error');
                    notify.error('Dirección no válida', 'Ingresá una dirección válida de la red interna.');
                }
                setIsTestingConnection(false);
            }, 600);
            return;
        }

        try {
            const resolvedPort = !serverPort || serverPort.trim() === '****' ? 3306 : Number(serverPort) || 3306;
            const res = await testMysqlConnection({
                host: serverIp.trim(),
                port: resolvedPort,
                user: 'root',
                password: '',
                database: 'plex',
            });

            if (res.success) {
                setConnectionStatus('connected');
                notify.success('Conexión exitosa', 'Servidor vinculado correctamente.');
                fetchOpenSessions(serverIp, serverPort);
            } else {
                setConnectionStatus('error');
                notify.error('Fallo de conexión', sanitizeMysqlError(res.message) || 'No se pudo contactar el servidor.');
            }
        } catch (err: any) {
            setConnectionStatus('error');
            notify.error('Fallo de conexión', sanitizeMysqlError(err?.message) || 'No se pudo contactar el servidor.');
        } finally {
            setIsTestingConnection(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            parseExcelFile(file);
        }
    };

    const handleBranchChange = (val: string) => {
        setSelectedBranch(val);
        if (typeof window !== 'undefined') {
            localStorage.setItem('precount_config_selected_branch', val);
        }
        setConnectionStatus('idle');
        setSelectedPlexMode('new');
        setSelectedPlexSession(null);
        const found = OFFICIAL_71_BRANCHES.find(
            (b) => formatBranchName(b.name).toLowerCase() === val.toLowerCase() || b.name.toLowerCase() === val.toLowerCase()
        );
        if (found) {
            const cleanName = formatBranchName(found.name);
            setServerIp(found.primaryIp);
            if (typeof window !== 'undefined') {
                localStorage.setItem('precount_config_server_ip', found.primaryIp);
                localStorage.setItem('plex_target_ip', found.primaryIp);
                localStorage.setItem('plex_target_branch', found.name);
            }
            const newName = `Inventario ${cleanName}`;
            setInventoryName(newName);
            if (typeof window !== 'undefined') {
                localStorage.setItem('precount_config_inventory_name', newName);
            }
            notify.info(`Sucursal seleccionada: ${cleanName}`);
            fetchOpenSessions(found.primaryIp, serverPort);
        }
    };

    const handlePlexSessionSelect = async (val: string) => {
        setSelectedPlexMode(val);
        if (val === 'new') {
            setSelectedPlexSession(null);
            const found = OFFICIAL_71_BRANCHES.find(
                (b) => formatBranchName(b.name).toLowerCase() === selectedBranch.toLowerCase() || b.name.toLowerCase() === selectedBranch.toLowerCase()
            );
            if (found) {
                const newName = `Inventario ${formatBranchName(found.name)}`;
                setInventoryName(newName);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('precount_config_inventory_name', newName);
                }
            }
            const freshPin = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedPin(freshPin);
        } else {
            const id = Number(val.replace('plex_', ''));
            const sess = openPlexSessions.find((s) => s.id_inventario === id);
            if (sess) {
                setSelectedPlexSession(sess);
                if (sess.descripcion) {
                    setInventoryName(sess.descripcion);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('precount_config_inventory_name', sess.descripcion);
                    }
                }

                // Buscar PIN en sesión local o remota
                try {
                    let pinFound: string | null = null;
                    const localSessions = await db.sessions
                        .where('status')
                        .equals('active')
                        .toArray();
                    const match = localSessions.find(
                        s => s.sector?.trim().toLowerCase() === sess.descripcion?.trim().toLowerCase()
                    );
                    if (match && match.sync_pin) {
                        pinFound = match.sync_pin;
                    } else {
                        const { data: remoteSessions } = await (supabase as any)
                            .from('precount_sessions')
                            .select('sync_pin')
                            .eq('status', 'active')
                            .ilike('sector', sess.descripcion?.trim())
                            .limit(1);
                        if (remoteSessions && remoteSessions.length > 0 && remoteSessions[0].sync_pin) {
                            pinFound = remoteSessions[0].sync_pin;
                        }
                    }

                    if (pinFound) {
                        setGeneratedPin(pinFound);
                        notify.info("Sesión vinculada", `PIN de enlace recuperado: ${pinFound}`);
                    } else {
                        const newPin = Math.floor(100000 + Math.random() * 900000).toString();
                        setGeneratedPin(newPin);
                        notify.info("PIN de enlace asignado", `Se configuró el PIN ${newPin} para conectar otros dispositivos.`);
                    }
                } catch (pinErr) {
                    console.warn("No se pudo leer PIN existente:", pinErr);
                    const fallbackPin = Math.floor(100000 + Math.random() * 900000).toString();
                    setGeneratedPin(fallbackPin);
                }

                notify.info("Sesión seleccionada", `Se retomará la sesión #${sess.id_inventario} de Plex.`);
            }
        }
    };

    const toggleRubro = (idx: number) => {
        setCheckedRubros((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) {
                if (next.size > 1) {
                    next.delete(idx);
                } else {
                    notify.warning("Debe quedar al menos un rubro seleccionado");
                }
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const selectAllRubros = () => {
        setCheckedRubros(new Set([0, 1, 2, 3]));
    };

    const handleStartInventory = async () => {
        if (isStartingSessionRef.current) return;

        if (!inventoryName.trim()) {
            notify.error("Nombre requerido", "Ingresá un nombre para el inventario.");
            return;
        }

        if (isParsingFile) {
            notify.warning("Procesando archivo", "Aguarde a que finalice la lectura del Excel...");
            return;
        }

        isStartingSessionRef.current = true;
        setIsStartingSession(true);
        try {
            let currentRaw = rawCatalog;

            // Si eligió servidor y todavía no sincronizó
            if (importSource === 'server' && (!currentRaw || currentRaw.length === 0)) {
                notify.info("Sincronizando...", "Descargando stock antes de iniciar la sesión...");
                try {
                    const res = await fetchMysqlStock({
                        host: serverIp.trim() || '10.0.70.10',
                        port: Number(serverPort) || 3306,
                        user: 'root',
                        password: '',
                        database: 'plex',
                        include_catalog_eans: includeCatalogEans,
                        include_hidden_inactive: includeHiddenInactive,
                    });
                    if (res.success && res.products) {
                        const catalog = convertMysqlToMasterCatalog(res.products);
                        setRawCatalog(catalog);
                        setLocalDbCount(res.total_products);
                        currentRaw = catalog;
                    } else {
                        notify.error("Error de sincronización", res.message || "No se pudo descargar el stock de Plex");
                        return;
                    }
                } catch (err: any) {
                    notify.error("Error conectando a Plex", err?.message || String(err));
                    return;
                }
            }

            if (!currentRaw || currentRaw.length === 0) {
                notify.error("Stock no disponible", "Cargá un archivo Excel o sincronizá desde el servidor Plex.");
                return;
            }

            const catalogToUse = applyCatalogFilters(currentRaw, checkedRubros, stockFilter, includeCatalogEans);

            if (!catalogToUse || catalogToUse.length === 0) {
                notify.error("Sin productos", "Ningún producto coincide con los rubros y saldos de stock seleccionados.");
                return;
            }

            // Si ya hay un PIN generado o recuperado de 6 dígitos, mantenerlo; de lo contrario generar uno
            const effectivePin = (generatedPin && generatedPin.length === 6)
                ? generatedPin
                : Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedPin(effectivePin);
            // 0. Si hay conexión configurada a Plex, reutilizar sesión existente o crear una nueva en la tabla `inventarios` de Plex
            let plexInvId: number | undefined;
            if (selectedPlexMode !== 'new' && selectedPlexSession) {
                plexInvId = selectedPlexSession.id_inventario;
                localStorage.setItem('plex_active_inventory_id', String(plexInvId));
                console.log(`[Plex] Retomando inventario #${plexInvId} en Plex (${serverIp})`);
            } else {
                try {
                    const targetHost = serverIp.trim() || '172.30.40.63';
                    const plexRes = await createPlexInventorySession(
                        {
                            host: targetHost,
                            port: Number(serverPort) || 3306,
                            user: 'root',
                            password: '',
                            database: 'plex',
                        },
                        inventoryName.trim(),
                        1590, // Gonzalo Coz
                        168   // Terminal de creación
                    );
                    if (plexRes.success && plexRes.id_inventario) {
                        plexInvId = plexRes.id_inventario;
                        localStorage.setItem('plex_active_inventory_id', String(plexInvId));
                        console.log(`[Plex] Inventario #${plexInvId} creado en Plex (${targetHost})`);
                    }
                } catch (plexErr) {
                    console.warn('[Plex] No se pudo crear sesión en Plex:', plexErr);
                }
            }

            // 1. Si estamos en Tauri, insertar el catálogo filtrado en SQLite local stock_local.db
            if (isTauriEnvironment()) {
                try {
                    const localInputs = catalogToUse.map(item => ({
                        id_producto: item.id_producto,
                        troquel: undefined,
                        name: item.name,
                        stock: item.systemStock || 0,
                        sale_price: item.salePrice || 0,
                        cost: item.cost || 0,
                        category: item.rubro,
                        subrubro: item.subrubro,
                        laboratory: item.laboratory,
                        is_hidden: item.is_hidden ?? false,
                        is_traceable: item.is_traceable ?? false,
                        gtin: item.gtin,
                        eans: (item.eans && item.eans.length > 0) ? item.eans : [item.ean],
                    }));
                    await importCatalogToLocalDb(localInputs);
                    console.log(`[TauriLocalDb] ${localInputs.length} productos filtrados guardados en stock_local.db.`);
                } catch (dbErr) {
                    console.warn('[TauriLocalDb] Advertencia al guardar en SQLite local:', dbErr);
                }
            }

            // 2. Comprobar si ya existe una sesión activa local o remota con este nombre o ID para retomarla
            let targetSession: any = null;
            try {
                const activeSessions = await db.sessions
                    .where('status')
                    .equals('active')
                    .toArray();
                targetSession = activeSessions.find(
                    s => (sessionId && s.id === sessionId) ||
                         s.sector?.trim().toLowerCase() === inventoryName.trim().toLowerCase()
                );
            } catch (dexErr) {
                console.warn('[Dexie] Error buscando sesión existente:', dexErr);
            }

            // Resolver sucursal de destino real (Saladillo, FP ADM, etc. o null para global)
            const { branchId: targetBranchId, branchName: cleanBranchName } = await resolveTargetBranch(selectedBranch);
            if (typeof window !== 'undefined') {
                localStorage.setItem('plex_target_branch', cleanBranchName || selectedBranch);
                localStorage.setItem('plex_target_ip', serverIp.trim());
            }
            const finalPin = targetSession?.sync_pin || effectivePin;
            setGeneratedPin(finalPin);

            if (!targetSession) {
                targetSession = await createSession(
                    inventoryName.trim(),
                    targetBranchId || undefined,
                    catalogToUse,
                    finalPin,
                    'sucursal'
                );
            } else {
                // Actualizar sesión existente para garantizar PIN y sucursal correctos
                targetSession.sync_pin = finalPin;
                targetSession.branch_id = targetBranchId || null;
                targetSession.sector = inventoryName.trim();
                if (catalogToUse && catalogToUse.length > 0) {
                    targetSession.master_catalog = catalogToUse;
                }
                await db.sessions.put(targetSession);
            }

            // 3. Crear o actualizar sesión en Supabase precount_sessions para disponibilidad inmediata en otras PCs
            try {
                await (supabase as any).from('precount_sessions').upsert({
                    id: targetSession.id,
                    sector: targetSession.sector,
                    status: 'active',
                    start_time: targetSession.start_time,
                    sync_pin: finalPin,
                    branch_id: targetBranchId || null
                });
                console.log('[Supabase] Sesión sincronizada con éxito en precount_sessions:', targetSession.id, 'branch_id:', targetBranchId);

                // Snapshot automático de ubicaciones QR vigentes de la sucursal (desactivado temporalmente)
                const ENABLE_INVENTORY_QR_LOCATIONS = false;
                if (ENABLE_INVENTORY_QR_LOCATIONS) {
                    const seededCount = await seedSessionLocationsFromBranch(
                        targetSession.id,
                        cleanBranchName || selectedBranch
                    );
                    if (seededCount > 0) {
                        console.log(`[Ubicaciones QR] ${seededCount} ubicaciones vigentes vinculadas a la sesión ${targetSession.id}.`);
                    }
                }
            } catch (supaErr) {
                console.warn('[Supabase] Error directo en precount_sessions, encolado vía syncManager:', supaErr);
            }

            // 4. Subir master_catalog.json optimizado y comprimido (gzip) a Supabase (precount_device_files)
            if (catalogToUse && catalogToUse.length > 0) {
                try {
                    await (supabase as any)
                        .from('precount_device_files')
                        .delete()
                        .eq('session_id', targetSession.id)
                        .eq('device_id', 'system')
                        .eq('filename', 'master_catalog.json');

                    const compressedContent = await compressJsonToGzipBase64(catalogToUse);

                    const { error: fileErr } = await (supabase as any).from('precount_device_files').insert({
                        session_id: targetSession.id,
                        device_id: 'system',
                        device_name: 'System',
                        filename: 'master_catalog.json',
                        content: compressedContent
                    });
                    if (fileErr) {
                        console.warn('[Supabase] Error insertando master_catalog.json:', fileErr);
                    } else {
                        console.log('[Supabase] master_catalog.json (gzip) subido con éxito para sesión:', targetSession.id, `(bytes comprimidos aprox: ${compressedContent.length})`);
                    }
                } catch (fileErr) {
                    console.warn('[Supabase] Error subiendo master_catalog.json:', fileErr);
                }
            }

            // 5. Guardar productos localmente en Dexie precount_products solo si estamos en Web/PWA
            // En modo Tauri de escritorio, SQLite (stock_local.db) ya almacena todo sin saturar el hilo principal de JS
            if (!isTauriEnvironment() && catalogToUse && catalogToUse.length > 0) {
                try {
                    const dbProducts = expandCatalogToDbProducts(catalogToUse, targetSession.id);
                    const CHUNK_SIZE = 5000;
                    for (let i = 0; i < dbProducts.length; i += CHUNK_SIZE) {
                        await db.precount_products.bulkPut(dbProducts.slice(i, i + CHUNK_SIZE));
                    }
                } catch (dexErr) {
                    console.warn('[Dexie] Error guardando precount_products:', dexErr);
                }
            }

            // 6. Activar sesión en storage
            localStorage.setItem('last_precount_session_id', targetSession.id);
            localStorage.setItem('precount_session_id', targetSession.id);
            sessionStorage.setItem('active_precount_session_id', targetSession.id);
            localStorage.removeItem('precount_config_inventory_name');

            notify.success(
                selectedPlexMode !== 'new' && selectedPlexSession ? "¡Sesión de Plex retomada!" : "¡Sesión iniciada exitosamente!",
                `Inventario "${targetSession.sector}" ${plexInvId ? `(Plex #${plexInvId}) ` : ''}conectado. Colectores listos para sincronizar.`
            );

            if (onSessionCreated) {
                onSessionCreated(targetSession);
            } else if (onSave) {
                onSave({
                    name: inventoryName,
                    branch: selectedBranch,
                    ip: serverIp,
                    port: serverPort,
                    file: selectedFile,
                    importSource,
                    verificationCode: targetSession.sync_pin || effectivePin,
                    rubros: Array.from(checkedRubros).map((idx) => RUBROS_CONFIG[idx]),
                    stockFilter
                });
            }
        } catch (err: any) {
            console.error('Error al iniciar sesión:', err);
            notify.error("Error al iniciar inventario", err?.message || String(err));
        } finally {
            isStartingSessionRef.current = false;
            setIsStartingSession(false);
        }
    };

    return (
        <ScrollArea orientation="vertical" viewportClassName="scroll-fade pe-1" className="w-full flex-1 min-h-0 h-full">
            {/* Contenedor exterior estilo Fluid: 1.5px de padding, bordes redondeados y sombra sutil */}
            <div className="w-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[22px] p-[1.5px] transition-all duration-200 shadow-xs">
                {/* Recuadro interior que agrupa las secciones y mantiene el pie de acciones siempre visible */}
                <div className="w-full bg-white dark:bg-surface-3 border border-border/40 rounded-[20px] p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-5">
                    {/* Grilla principal de dos columnas alineada a bordes compartidos */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-7 flex-1 items-start">
                        
                        {/* COLUMNA PRINCIPAL (IZQUIERDA): Identificación, Red Plex y Alcance del Conteo */}
                        <div className="lg:col-span-7 flex flex-col gap-5">
                            {/* SECCIÓN 1: Identificación y Destino */}
                            <section aria-labelledby="config-identity-heading" className="space-y-3">
                                <div>
                                    <h3 id="config-identity-heading" className="text-sm font-semibold text-foreground tracking-tight">
                                        {isBranchProfile ? "Identificación del operador" : "Identificación y destino"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                                        {isBranchProfile 
                                            ? "Identificador obligatorio de quién opera este colector o terminal. Tus conteos se registrarán bajo este nombre."
                                            : "Definí el nombre oficial de la sesión y la sucursal sobre la cual se realizará el control."}
                                    </p>
                                </div>

                                <div className={cn("grid grid-cols-1 gap-3.5", !isBranchProfile && "sm:grid-cols-2")}>
                                    {/* Campo 1: Nombre del inventario / Operador */}
                                    <div className="space-y-1.5">
                                        <label
                                            htmlFor="precount-config-name-input"
                                            className="text-xs font-medium text-foreground flex items-center gap-1"
                                        >
                                            <span>{isBranchProfile ? "Nombre del usuario operador" : "Nombre del inventario"}</span>
                                            <span className="text-destructive font-bold" aria-hidden="true">*</span>
                                        </label>
                                        <Input
                                            id="precount-config-name-input"
                                            name={isBranchProfile ? "operatorName" : "inventoryName"}
                                            autoComplete={isBranchProfile ? "name" : "off"}
                                            aria-required="true"
                                            aria-invalid={isBranchProfile ? !operatorName.trim() : !inventoryName.trim()}
                                            aria-describedby={isBranchProfile && !operatorName.trim() ? "operator-name-error" : undefined}
                                            value={isBranchProfile ? operatorName : inventoryName}
                                            onChange={(e) => {
                                                if (isBranchProfile) {
                                                    setOperatorName(e.target.value);
                                                } else {
                                                    setInventoryName(e.target.value);
                                                    if (typeof window !== 'undefined') {
                                                        localStorage.setItem('precount_config_inventory_name', e.target.value);
                                                    }
                                                }
                                            }}
                                            placeholder={isBranchProfile ? "Ej: Juan Pérez / Colector 1" : "Ej: Inventario Saladillo"}
                                            className={cn(
                                                "h-9 text-xs rounded-xl bg-surface-2/50 dark:bg-surface-2/30 border text-foreground hover:border-border/60 focus-visible:ring-2 focus-visible:ring-primary/40 px-3 transition-colors",
                                                isBranchProfile && !operatorName.trim()
                                                    ? "border-destructive/60 focus-visible:ring-destructive/40 placeholder:text-destructive/50"
                                                    : "border-border/40"
                                            )}
                                        />
                                        {isBranchProfile && !operatorName.trim() && (
                                            <p id="operator-name-error" className="text-[11px] text-destructive font-medium">
                                                Campo obligatorio para autorizar la sincronización de esta terminal.
                                            </p>
                                        )}
                                    </div>

                                    {/* Campo 2: Sucursal (Solo en perfil Admin) */}
                                    {!isBranchProfile && (
                                        <div className="space-y-1.5">
                                            <label
                                                id="precount-branch-select-label"
                                                className="text-xs font-medium text-foreground block"
                                            >
                                                Sucursal de destino
                                            </label>
                                            <Select value={selectedBranch} onValueChange={handleBranchChange}>
                                                <SelectTrigger 
                                                    aria-labelledby="precount-branch-select-label"
                                                    placeholder="Selecciona una sucursal..." 
                                                    className="h-9 text-xs w-full rounded-xl bg-surface-2/50 dark:bg-surface-2/30 border border-border/40 hover:border-border/60 focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors" 
                                                />
                                                <SelectContent className="max-h-[380px] min-w-[320px]">
                                                    {BRANCH_OPTIONS.map((branchLabel, idx) => (
                                                        <SelectItem key={branchLabel} value={branchLabel} index={idx} className="font-sans text-xs sm:text-[13px] h-9 shrink-0">
                                                            {branchLabel}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {!isBranchProfile && (
                                <>
                                    {/* SECCIÓN 2: Conexión y Sesión en Servidor Plex */}
                                    <section
                                        aria-labelledby="config-plex-heading"
                                        className="rounded-2xl bg-surface-2/30 dark:bg-surface-2/20 border border-border/40 p-3.5 space-y-3.5"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <h3 id="config-plex-heading" className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                                                    <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                                                    <span>Conexión con Servidor Plex</span>
                                                </h3>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                                                    Parámetros de red MySQL y vinculación con la sesión de inventario del servidor local.
                                                </p>
                                            </div>
                                            <div role="status" aria-live="polite" className="flex items-center gap-2 shrink-0">
                                                {connectionStatus === 'connected' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> En línea
                                                    </span>
                                                )}
                                                {connectionStatus === 'error' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-[11px] font-medium text-destructive">
                                                        <AlertCircle className="w-3 h-3" aria-hidden="true" /> Sin respuesta
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Fila 1: Host IP y Puerto TCP alineados al eje 50/50 de las secciones superior e inferior */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                            <div className="space-y-1.5">
                                                <label htmlFor="plex-server-ip-input" className="text-xs font-medium text-foreground block">
                                                    Dirección IP del Servidor Plex
                                                </label>
                                                <div className="relative flex items-center">
                                                    <Input
                                                        id="plex-server-ip-input"
                                                        name="serverIp"
                                                        type={showServerIp ? "text" : "password"}
                                                        inputMode="decimal"
                                                        autoComplete="off"
                                                        value={serverIp}
                                                        onChange={(e) => {
                                                            const newIp = e.target.value;
                                                            setServerIp(newIp);
                                                            setConnectionStatus('idle');
                                                            if (typeof window !== 'undefined') {
                                                                localStorage.setItem('precount_config_server_ip', newIp);
                                                            }
                                                        }}
                                                        placeholder="***.***.***.***"
                                                        className="h-9 text-xs rounded-xl bg-surface-1 dark:bg-surface-3 border border-border/40 text-foreground px-3 pr-8 hover:border-border/60 focus-visible:ring-2 focus-visible:ring-primary/40 font-mono transition-colors w-full"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowServerIp((prev) => !prev)}
                                                        className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                                                        title={showServerIp ? "Ocultar IP" : "Mostrar IP"}
                                                        tabIndex={-1}
                                                    >
                                                        {showServerIp ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label htmlFor="plex-server-port-input" className="text-xs font-medium text-foreground block">
                                                    Puerto TCP
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <Input
                                                        id="plex-server-port-input"
                                                        name="serverPort"
                                                        inputMode="numeric"
                                                        autoComplete="off"
                                                        value={serverPort}
                                                        onChange={(e) => {
                                                            const newPort = e.target.value;
                                                            setServerPort(newPort);
                                                            if (typeof window !== 'undefined') {
                                                                localStorage.setItem('precount_config_server_port', newPort);
                                                            }
                                                        }}
                                                        placeholder="****"
                                                        className="h-9 text-xs rounded-xl bg-surface-1 dark:bg-surface-3 border border-border/40 text-foreground px-3 hover:border-border/60 focus-visible:ring-2 focus-visible:ring-primary/40 flex-1 min-w-0 font-mono transition-colors"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={isTestingConnection || !serverIp.trim()}
                                                        onClick={handleTestConnection}
                                                        aria-label="Probar conexión con el servidor Plex"
                                                        className="h-9 px-3.5 rounded-xl text-xs font-medium border border-border/40 bg-surface-1 dark:bg-surface-3 hover:bg-surface-2 text-foreground transition-colors shrink-0 gap-1.5"
                                                    >
                                                        <Wifi className={cn("w-3.5 h-3.5", isTestingConnection && "animate-pulse text-primary")} aria-hidden="true" />
                                                        <span>{isTestingConnection ? "Probando..." : "Probar"}</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fila 2: Selector de sesión en Plex + acción directa para consultar sesiones abiertas */}
                                        <div className="space-y-1.5">
                                            <label id="plex-session-select-label" className="text-xs font-medium text-foreground block">
                                                Sesión de inventario en Servidor Plex
                                            </label>
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <Select value={selectedPlexMode} onValueChange={handlePlexSessionSelect}>
                                                        <SelectTrigger 
                                                            aria-labelledby="plex-session-select-label"
                                                            placeholder="Seleccionar sesión de Plex..." 
                                                            className="h-9 text-xs w-full rounded-xl bg-surface-1 dark:bg-surface-3 border border-border/40 hover:border-border/60 focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors" 
                                                        />
                                                        <SelectContent className="max-h-[320px] min-w-[320px]">
                                                            <SelectItem value="new" index={0} className="font-sans text-xs sm:text-[13px] h-9">
                                                                + Crear nueva sesión de inventario en Plex
                                                            </SelectItem>
                                                            {openPlexSessions.map((sess, sIdx) => (
                                                                <SelectItem 
                                                                    key={`plex_${sess.id_inventario}`} 
                                                                    value={`plex_${sess.id_inventario}`} 
                                                                    index={sIdx + 1}
                                                                    className="font-sans text-xs sm:text-[13px] h-9"
                                                                >
                                                                    {`#${sess.id_inventario} - ${sess.descripcion || 'Sin descripción'} (${sess.fecha} ${sess.hora})`}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => fetchOpenSessions(serverIp, serverPort)}
                                                    disabled={isCheckingPlexSessions || !serverIp.trim()}
                                                    className="h-9 px-3.5 rounded-xl text-xs font-medium border border-border/40 bg-surface-1 dark:bg-surface-3 hover:bg-surface-2 text-foreground transition-colors shrink-0 gap-1.5"
                                                >
                                                    <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isCheckingPlexSessions && "animate-spin text-primary")} aria-hidden="true" />
                                                    <span>{isCheckingPlexSessions ? "Comprobando..." : "Buscar sesiones abiertas"}</span>
                                                </Button>
                                            </div>
                                        </div>

                                        {selectedPlexMode !== 'new' && selectedPlexSession && (
                                            <div role="status" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
                                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                                                <span>
                                                    Se retomará la <strong>Sesión #{selectedPlexSession.id_inventario}</strong> de Plex ({selectedPlexSession.usuario || 'Operador'}). Los conteos se enviarán directamente a este inventario.
                                                </span>
                                            </div>
                                        )}
                                    </section>
                                </>
                            )}

                            {/* SECCIÓN 3: Alcance y Filtros de Stock (Dos columnas simétricas + Opción de catálogo sin stock a ancho completo) */}
                            <section aria-labelledby="config-scope-heading" className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                                    {/* Subgrupo 3A: Rubros a inventariar (4 ítems) */}
                                    <div className="rounded-2xl bg-surface-2/25 dark:bg-surface-2/15 border border-border/35 p-3.5 flex flex-col justify-between space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 id="config-scope-heading" className="text-xs font-semibold text-foreground">
                                                    Rubros a inventariar
                                                </h3>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                                                    Rubros habilitados para el conteo físico.
                                                </p>
                                            </div>
                                            {checkedRubros.size < 4 && (
                                                <button
                                                    type="button"
                                                    onClick={selectAllRubros}
                                                    className="min-h-6 px-2 rounded-md border border-border/40 bg-surface-1/80 dark:bg-surface-3/80 hover:bg-surface-2 text-[11px] text-primary font-medium cursor-pointer shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                                >
                                                    Todos
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-1 pt-0.5">
                                            {RUBROS_CONFIG.map((rubro, idx) => (
                                                <div key={rubro} className="flex items-center">
                                                    <Switch
                                                        checked={checkedRubros.has(idx)}
                                                        onToggle={() => toggleRubro(idx)}
                                                        label={rubro}
                                                        className="font-medium text-xs sm:text-[13px] text-foreground py-1 px-1.5 cursor-pointer w-full"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Subgrupo 3B: Valores de stock a incluir (4 ítems, misma altura que Rubros) */}
                                    <div className="rounded-2xl bg-surface-2/25 dark:bg-surface-2/15 border border-border/35 p-3.5 flex flex-col justify-between space-y-2">
                                        <div>
                                            <h3 className="text-xs font-semibold text-foreground">
                                                Valores de stock a incluir
                                            </h3>
                                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                                                Filtrá productos según su saldo actual.
                                            </p>
                                        </div>

                                        <div className="pt-0.5">
                                            <RadioGroup
                                                value={stockFilter}
                                                onValueChange={(v) => setStockFilter(v as StockFilterOption)}
                                                className="space-y-1"
                                            >
                                                <RadioItem index={0} value="all" label="Todos los valores de stock" className="py-1 px-1.5 text-xs sm:text-[13px] text-foreground cursor-pointer" />
                                                <RadioItem index={1} value="positive" label="Solo con stock positivo (> 0)" className="py-1 px-1.5 text-xs sm:text-[13px] text-foreground cursor-pointer" />
                                                <RadioItem index={2} value="negative" label="Stock en negativo (< 0)" className="py-1 px-1.5 text-xs sm:text-[13px] text-foreground cursor-pointer" />
                                                <RadioItem index={3} value="zero" label="Stock en 0" className="py-1 px-1.5 text-xs sm:text-[13px] text-foreground cursor-pointer" />
                                            </RadioGroup>
                                        </div>
                                    </div>
                                </div>

                                {/* Opción complementaria a ancho completo para evitar truncamiento vertical */}
                                <label className="flex items-start gap-3 p-3 rounded-2xl bg-surface-2/30 dark:bg-surface-2/20 hover:bg-surface-2/50 border border-border/40 cursor-pointer transition-colors group">
                                    <Checkbox
                                        checked={includeCatalogEans}
                                        onCheckedChange={(checked) => setIncludeCatalogEans(Boolean(checked))}
                                        className="mt-0.5 shrink-0"
                                    />
                                    <div className="space-y-0.5 select-none flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs sm:text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                                                Incluir catálogo activo con EAN (sin stock)
                                            </span>
                                            {rawCatalog && rawCatalog.length > 0 && importSource === 'server' && (
                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                                    Requiere re-sincronizar desde Plex
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-normal">
                                            Suma productos activos del padrón maestro sin stock ni movimiento en la sucursal para reconocerlos al escanear en colectores Zebra.
                                        </p>
                                    </div>
                                </label>

                                {/* Switch opcional para incluir productos ocultos o inactivos en Plex */}
                                <div className="flex items-start justify-between gap-3 p-3 rounded-2xl bg-surface-2/30 dark:bg-surface-2/20 hover:bg-surface-2/50 border border-border/40 transition-colors group">
                                    <div
                                        onClick={() => setIncludeHiddenInactive((prev) => !prev)}
                                        className="space-y-0.5 select-none flex-1 min-w-0 cursor-pointer"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs sm:text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">
                                                Incluir productos ocultos o inactivos
                                            </span>
                                            {rawCatalog && rawCatalog.length > 0 && importSource === 'server' && (
                                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                                    Requiere re-sincronizar desde Plex
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-normal">
                                            Incluye artículos marcados como ocultos (Visible = 0) o inactivos (Activo = N) en Plex que aún tengan stock o código de barras en la sucursal.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={includeHiddenInactive}
                                        onToggle={() => setIncludeHiddenInactive((prev) => !prev)}
                                        className="mt-0.5 shrink-0 cursor-pointer"
                                    />
                                </div>
                            </section>
                        </div>

                        {/* COLUMNA SECUNDARIA (DERECHA): Origen de Stock Teórico y Código PIN */}
                        <div className="lg:col-span-5 flex flex-col justify-between gap-5 lg:border-s lg:border-border/30 lg:ps-7">
                            {/* SECCIÓN 4: Importar Stock Teórico (Primero en perfil Admin por orden de flujo de trabajo) */}
                            {!isBranchProfile && (
                                <section aria-labelledby="config-import-heading" className="space-y-2.5">
                                    <div>
                                        <h3 id="config-import-heading" className="text-sm font-semibold text-foreground tracking-tight">
                                            Importar stock teórico
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                                            Seleccioná el origen de datos para contrastar el conteo físico contra las existencias esperadas.
                                        </p>
                                    </div>

                                    <Tabs
                                        value={importSource}
                                        onValueChange={(v) => setImportSource(v as ImportSourceOption)}
                                        className="w-full"
                                    >
                                        <TabsList className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 p-1 rounded-xl w-full">
                                            <TabItem value="file" label="Desde archivo Excel" icon={FileSpreadsheet as any} className="flex-1 text-xs" />
                                            <TabItem 
                                                value="server" 
                                                label="Desde servidor Plex" 
                                                icon={Database as any} 
                                                className="flex-1 text-xs" 
                                            />
                                        </TabsList>

                                        {/* TabPanel 1: Importar stock desde archivo */}
                                        <TabPanel value="file" className="pt-2.5">
                                            <input
                                                id="precount-excel-file-input"
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".xlsx, .xls"
                                                className="sr-only"
                                                onChange={handleFileChange}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className={cn(
                                                    "w-full group relative border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                                    rawCatalog && rawCatalog.length > 0
                                                        ? "border-emerald-500/40 bg-emerald-500/5"
                                                        : selectedFile
                                                            ? "border-foreground/30 bg-surface-2"
                                                            : "border-border/60 hover:border-border bg-surface-2/30 dark:bg-surface-2/20 hover:bg-surface-2/60"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-transform duration-200 group-hover:scale-105",
                                                    rawCatalog && rawCatalog.length > 0
                                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                        : isParsingFile
                                                            ? "bg-surface-3 text-foreground animate-pulse"
                                                            : "bg-surface-3 text-foreground"
                                                )}>
                                                    {isParsingFile ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                                    ) : rawCatalog && rawCatalog.length > 0 ? (
                                                        <CheckCircle2 className="w-4 h-4 stroke-[2]" aria-hidden="true" />
                                                    ) : selectedFile ? (
                                                        <FileSpreadsheet className="w-4 h-4 stroke-[1.8]" aria-hidden="true" />
                                                    ) : (
                                                        <Upload className="w-4 h-4 stroke-[1.8]" aria-hidden="true" />
                                                    )}
                                                </div>

                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-semibold text-foreground tracking-tight">
                                                        {isParsingFile ? (
                                                            'Procesando archivo...'
                                                        ) : rawCatalog && rawCatalog.length > 0 ? (
                                                            `Listo: ${selectedFile?.name || 'Catálogo cargado'}`
                                                        ) : selectedFile ? (
                                                            selectedFile.name
                                                        ) : (
                                                            <>Seleccionar planilla Excel <span className="text-muted-foreground font-normal">(.xlsx, .xls)</span></>
                                                        )}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {rawCatalog && rawCatalog.length > 0
                                                            ? `${parsedCatalog ? parsedCatalog.length.toLocaleString('es-AR') : 0} de ${rawCatalog.length.toLocaleString('es-AR')} productos habilitados por filtros`
                                                            : 'Padrón maestro de existencias teóricas (17 columnas)'}
                                                    </p>
                                                </div>
                                            </button>
                                        </TabPanel>

                                        {/* TabPanel 2: Importar stock desde servidor Plex */}
                                        <TabPanel value="server" className="pt-2.5">
                                            <div className="p-4 rounded-2xl border border-border/40 bg-surface-2/30 dark:bg-surface-2/20 flex flex-col items-center justify-center text-center space-y-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-surface-3 flex items-center justify-center text-foreground">
                                                    <Database className="w-4 h-4 stroke-[1.8]" aria-hidden="true" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-semibold text-foreground tracking-tight">
                                                        Sincronización directa con MySQL
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Descarga la foto de stock actual directamente desde <span className="font-mono text-foreground font-medium">{serverIp}</span>.
                                                    </p>
                                                </div>
                                                <div className="pt-0.5 w-full max-w-[300px]">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={isSyncingLocalDb}
                                                        onClick={handleSyncLocalStock}
                                                        className="w-full h-9 text-xs font-semibold rounded-xl border border-border/40 bg-surface-1 hover:bg-hover text-foreground flex items-center justify-center gap-2"
                                                    >
                                                        <RefreshCw className={cn("w-3.5 h-3.5", isSyncingLocalDb && "animate-spin text-primary")} aria-hidden="true" />
                                                        <span>
                                                            {isSyncingLocalDb 
                                                                ? "Descargando desde Plex..." 
                                                                : rawCatalog && rawCatalog.length > 0 
                                                                    ? `Actualizar Stock (${parsedCatalog ? parsedCatalog.length.toLocaleString('es-AR') : 0} de ${rawCatalog.length.toLocaleString('es-AR')})`
                                                                    : localDbCount !== null
                                                                        ? `Actualizar Stock Plex (${localDbCount.toLocaleString('es-AR')} prods)`
                                                                        : "Descargar Stock desde Servidor Plex"}
                                                        </span>
                                                    </Button>
                                                    <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                                                        Almacena <code className="text-primary font-mono text-[10px]">stock_local.db</code> localmente para lecturas offline instantáneas.
                                                    </p>
                                                </div>
                                            </div>
                                        </TabPanel>
                                    </Tabs>
                                </section>
                            )}

                            {/* SECCIÓN 5: Código de Verificación (PIN de enlace) */}
                            <section
                                aria-labelledby="config-pin-heading"
                                className="rounded-2xl bg-surface-2/30 dark:bg-surface-2/20 border border-border/40 p-4 space-y-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 id="config-pin-heading" className="text-sm font-semibold text-foreground tracking-tight">
                                            Código de verificación (PIN)
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                                            {isBranchProfile
                                                ? "Ingresá los 6 dígitos provistos por el administrador para vincular esta terminal."
                                                : "PIN de 6 dígitos requerido en colectores y terminales para unirse a la sesión."}
                                        </p>
                                    </div>
                                    {!isBranchProfile && generatedPin && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(generatedPin);
                                                setCopiedPin(true);
                                                notify.success("PIN copiado al portapapeles");
                                                setTimeout(() => setCopiedPin(false), 2000);
                                            }}
                                            aria-label="Copiar PIN de verificación al portapapeles"
                                            className="min-h-7 px-2.5 rounded-lg border border-border/40 bg-surface-1 dark:bg-surface-3 hover:bg-surface-2 text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        >
                                            {copiedPin ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />}
                                            <span>{copiedPin ? '¡Copiado!' : 'Copiar PIN'}</span>
                                        </button>
                                    )}
                                </div>

                                <div className="w-full flex flex-col items-center justify-center py-1.5 space-y-2">
                                    {isBranchProfile ? (
                                        <OneTimeCode
                                            length={6}
                                            value={branchPin}
                                            onChange={(val) => setBranchPin(val)}
                                            onComplete={handleValidateAndSyncPin}
                                            autoFocus
                                            corner={12}
                                        />
                                    ) : (
                                        <OneTimeCode
                                            length={6}
                                            value={generatedPin}
                                            readOnly
                                            corner={12}
                                        />
                                    )}

                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                        {isBranchProfile ? (
                                            <>
                                                <KeyRound className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                                                <span>Se sincronizará automáticamente al completar los 6 dígitos</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                                                <span>{sessionId ? 'PIN activo de la sesión en curso' : 'PIN listo para asignar al iniciar el inventario'}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* SECCIÓN INFERIOR: Generador de Ubicaciones QR (desactivado temporalmente) */}
                    {false && !isBranchProfile && (
                        <section
                            aria-labelledby="config-qr-locations-heading"
                            className="rounded-2xl bg-surface-2/25 dark:bg-surface-2/15 border border-border/40 p-4 sm:p-5 space-y-4"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        <QrCode className="w-4 h-4" aria-hidden="true" />
                                    </div>
                                    <div>
                                        <h3 id="config-qr-locations-heading" className="text-sm font-semibold text-foreground tracking-tight">
                                            Ubicaciones QR del Inventario (A4 2×4)
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                                            Configurá las góndolas/sectores de la sucursal, imprimí las etiquetas QR en A4 y habilitá la auditoría de posiciones.
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowQrLocationsSection((prev) => !prev)}
                                    className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl gap-1.5"
                                >
                                    <span>{showQrLocationsSection ? 'Ocultar' : 'Mostrar'}</span>
                                    {showQrLocationsSection ? (
                                        <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                                    ) : (
                                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                                    )}
                                </Button>
                            </div>

                            {showQrLocationsSection && (
                                <div className="pt-2 border-t border-border/30">
                                    <InventoryQrLocationsPanel defaultBranchName={selectedBranch} />
                                </div>
                            )}
                        </section>
                    )}

                    {/* BARRA INFERIOR DE ESTADO Y ACCIONES (Siempre visible al pie del panel) */}
                    <div className="pt-3.5 border-t border-border/30 flex flex-wrap items-center justify-between gap-3">
                        {/* Indicador de estado en vivo (accesible mediante role="status") */}
                        <div role="status" aria-live="polite" className="text-xs text-muted-foreground flex items-center gap-2">
                            {isBranchProfile ? (
                                isReadyToStart ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                                        <span className="text-foreground font-medium">Terminal lista para sincronizar</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                                        <span>Completá tu nombre de operador y el PIN de 6 dígitos</span>
                                    </>
                                )
                            ) : rawCatalog && rawCatalog.length > 0 ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                                    <span>
                                        Catálogo listo: <strong className="text-foreground font-semibold">{parsedCatalog ? parsedCatalog.length.toLocaleString('es-AR') : 0}</strong> de {rawCatalog.length.toLocaleString('es-AR')} productos seleccionados
                                    </span>
                                </>
                            ) : importSource === 'server' && serverIp.trim() ? (
                                <>
                                    <Database className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                                    <span>Se descargará el stock desde <strong className="text-foreground font-mono">{serverIp}</strong> al iniciar</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                                    <span>Pendiente: cargá una planilla Excel o elegí sincronizar desde el servidor Plex</span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5 ms-auto">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    if (isBranchProfile) {
                                        setBranchPin('');
                                        setOperatorName('');
                                    } else {
                                        if (typeof window !== 'undefined') {
                                            localStorage.removeItem('precount_config_selected_branch');
                                            localStorage.removeItem('precount_config_server_ip');
                                            localStorage.removeItem('precount_config_inventory_name');
                                        }
                                        const defaultBranch = user?.branchSheet 
                                            ? OFFICIAL_71_BRANCHES.find(b => b.name.toLowerCase() === user.branchSheet?.toLowerCase()) || OFFICIAL_71_BRANCHES[0]
                                            : OFFICIAL_71_BRANCHES.find(b => b.name.toUpperCase() === 'SALADILLO') || OFFICIAL_71_BRANCHES[0];
                                        const formattedBranch = formatBranchName(defaultBranch.name);
                                        setInventoryName(`Inventario ${formattedBranch}`);
                                        setSelectedBranch(formattedBranch);
                                        setServerIp(defaultBranch.primaryIp);
                                        setGeneratedPin(Math.floor(100000 + Math.random() * 900000).toString());
                                        setServerPort("****");
                                        setSelectedFile(null);
                                        setRawCatalog(null);
                                        setImportSource('file');
                                        setCheckedRubros(new Set([0, 1, 2, 3]));
                                        setStockFilter('all');
                                        setConnectionStatus('idle');
                                    }
                                }}
                            >
                                Restablecer
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                loading={isStartingSession}
                                disabled={isStartingSession || isParsingFile}
                                onClick={isBranchProfile ? handleSyncBranchSession : handleStartInventory}
                            >
                                {isStartingSession
                                    ? (isBranchProfile ? "Sincronizando..." : "Iniciando inventario...")
                                    : (isBranchProfile ? "Sincronizar inventario" : "Iniciar inventario")}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
}


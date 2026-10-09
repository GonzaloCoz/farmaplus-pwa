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
    KeyRound
} from 'lucide-react';
import { OFFICIAL_71_BRANCHES } from '@/lib/branchNetworkMap';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import { OtpInput } from '@/components/ui/otp-segmented-input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabItem, TabPanel } from '@/components/ui/tabs';
import { testMysqlConnection, isTauriEnvironment, fetchMysqlStock, convertMysqlToMasterCatalog, createPlexInventorySession, getPlexOpenInventorySessions, type PlexOpenSession } from '@/services/mysqlTauriBridge';
import { syncMysqlToLocalDb, importCatalogToLocalDb } from '@/services/tauriLocalDb';
import ExcelNightWorker from '@/workers/excelNightWorker?worker';
import { MasterCatalogItem, createSession, getSessionByPin } from '@/services/preCountDB';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/services/db';
import { OneTimeCode } from '@/components/ui/OneTimeCode';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    stockFilter: StockFilterOption
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
        if (stockFilter === 'positive' && stockVal <= 0) {
            return false;
        }
        if (stockFilter === 'negative' && stockVal >= 0) {
            return false;
        }
        if (stockFilter === 'zero' && stockVal !== 0) {
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
    (b) => `${formatBranchName(b.name)} (${b.primaryIp})`
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
                const matchSaved = OFFICIAL_71_BRANCHES.find(b => 
                    `${formatBranchName(b.name)} (${b.primaryIp})` === savedBranch ||
                    b.name.toLowerCase() === savedBranch.toLowerCase() ||
                    savedBranch.toLowerCase().includes(b.name.toLowerCase())
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
            if (saved && BRANCH_OPTIONS.includes(saved)) {
                return saved;
            }
        }
        return `${formatBranchName(initialBranchObj.name)} (${initialBranchObj.primaryIp})`;
    }, [initialBranchObj]);

    const initialName = useMemo(() => {
        if (defaultInventoryName) return defaultInventoryName;
        if (typeof window !== 'undefined') {
            const savedName = localStorage.getItem('precount_config_inventory_name');
            if (savedName) return savedName;
        }
        return `Inventario ${formatBranchName(initialBranchObj.name)}`;
    }, [defaultInventoryName, initialBranchObj]);

    const [selectedBranch, setSelectedBranch] = useState<string>(initialBranchLabel);
    const [inventoryName, setInventoryName] = useState(initialName);
    const [operatorName, setOperatorName] = useState<string>(() => {
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
    const [serverPort, setServerPort] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedPort = localStorage.getItem('precount_config_server_port');
            if (savedPort) return savedPort;
        }
        return "3306";
    });
    const [checkedRubros, setCheckedRubros] = useState<Set<number>>(new Set([0, 1, 2, 3]));
    const [stockFilter, setStockFilter] = useState<StockFilterOption>('all');
    const [generatedPin, setGeneratedPin] = useState<string>(() => Math.floor(100000 + Math.random() * 900000).toString());
    const [copiedPin, setCopiedPin] = useState(false);
    const [importSource, setImportSource] = useState<ImportSourceOption>('file');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [isSyncingLocalDb, setIsSyncingLocalDb] = useState(false);
    const [isParsingFile, setIsParsingFile] = useState(false);
    const [isStartingSession, setIsStartingSession] = useState(false);
    const [rawCatalog, setRawCatalog] = useState<MasterCatalogItem[] | null>(null);
    const [localDbCount, setLocalDbCount] = useState<number | null>(null);

    // Catálogo filtrado reactivo según rubros y saldo de stock
    const parsedCatalog = useMemo(
        () => applyCatalogFilters(rawCatalog, checkedRubros, stockFilter),
        [rawCatalog, checkedRubros, stockFilter]
    );

    // Resolver Branch ID real en Supabase para evitar asignar usuario Nuñez en sucursales
    const resolveTargetBranch = async (branchLabel: string) => {
        const cleanBranchName = branchLabel.replace(/\s*\([^)]*\)/, '').trim();
        try {
            const { data: supaBranches } = await supabase.from('branches').select('id, name');
            if (supaBranches && supaBranches.length > 0) {
                const match = supaBranches.find(b => 
                    b.name.toLowerCase().trim() === cleanBranchName.toLowerCase() ||
                    cleanBranchName.toLowerCase().includes(b.name.toLowerCase().trim()) ||
                    b.name.toLowerCase().trim().includes(cleanBranchName.toLowerCase())
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

    // Si se retoma una sesión existente (o hay una activa), cargar su PIN y configuración inmediatamente
    useEffect(() => {
        let isCancelled = false;
        async function loadActiveSessionInfo() {
            const activeId = sessionId || (typeof window !== 'undefined' ? (localStorage.getItem('last_precount_session_id') || localStorage.getItem('precount_session_id')) : null);
            if (!activeId) return;

            try {
                // 1. Buscar en Dexie local
                const local = await db.sessions.get(activeId);
                if (local && !isCancelled) {
                    const savedCustomName = typeof window !== 'undefined' ? localStorage.getItem('precount_config_inventory_name') : null;
                    if (savedCustomName) {
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

                // 2. Si no está en Dexie, consultar Supabase
                const { data: remote } = await (supabase as any)
                    .from('precount_sessions')
                    .select('*')
                    .eq('id', activeId)
                    .maybeSingle();

                if (remote && !isCancelled) {
                    const savedCustomName = typeof window !== 'undefined' ? localStorage.getItem('precount_config_inventory_name') : null;
                    if (savedCustomName) {
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
                            const parsed = JSON.parse(catFile.content);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                setRawCatalog(parsed);
                                setLocalDbCount(parsed.length);
                            }
                        }
                    } catch {}
                } else if (!remote && !isCancelled) {
                    // La sesión fue eliminada en el servidor o no existe
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('last_precount_session_id');
                        localStorage.removeItem('precount_session_id');
                        localStorage.removeItem('active_precount_session_id');
                    }
                }
            } catch (err) {
                console.warn('[PreCountConfigView] Error cargando datos de sesión activa:', err);
            }
        }
        loadActiveSessionInfo();
        return () => {
            isCancelled = true;
        };
    }, [sessionId]);

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

        const nameClean = operatorName.trim() || user?.name || user?.username || 'Operador';
        localStorage.setItem('precount_device_name', nameClean);

        try {
            // 1. Consultar sesión por PIN en Supabase (con fallback offline a Dexie)
            const remoteSession = await getSessionByPin(pinClean);

            if (remoteSession) {
                // Guardar id de sesión en storage para que todo el módulo de conteo se active
                localStorage.setItem('last_precount_session_id', remoteSession.id);
                localStorage.setItem('precount_session_id', remoteSession.id);
                sessionStorage.setItem('active_precount_session_id', remoteSession.id);

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
                const isValidIp = serverIp.trim().startsWith('10.') || serverIp.trim() === '127.0.0.1' || serverIp.trim() === 'localhost';
                if (isValidIp) {
                    setConnectionStatus('connected');
                    notify.success('Servidor Plex alcanzable', `Host ${serverIp}:${serverPort} configurado correctamente.`);
                } else {
                    setConnectionStatus('error');
                    notify.error('Dirección IP no válida', 'Ingresá una IP de la red interna de Farmaplus.');
                }
                setIsTestingConnection(false);
            }, 600);
            return;
        }

        try {
            const res = await testMysqlConnection({
                host: serverIp.trim(),
                port: Number(serverPort) || 3306,
                user: 'root',
                password: '',
                database: 'plex',
            });

            if (res.success) {
                setConnectionStatus('connected');
                notify.success('Conexión con Plex exitosa', `MySQL ${res.server_version || ''} disponible.`);
                fetchOpenSessions(serverIp, serverPort);
            } else {
                setConnectionStatus('error');
                notify.error('Fallo de conexión a Plex', res.message || 'No se pudo contactar el servidor.');
            }
        } catch (err: any) {
            setConnectionStatus('error');
            notify.error('Error de red', err?.message || 'Fallo al conectar con el servidor Plex');
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
            (b) => `${formatBranchName(b.name)} (${b.primaryIp})` === val
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
            notify.info(`Sucursal seleccionada: ${cleanName} (${found.primaryIp})`);
            fetchOpenSessions(found.primaryIp, serverPort);
        }
    };

    const handlePlexSessionSelect = async (val: string) => {
        setSelectedPlexMode(val);
        if (val === 'new') {
            setSelectedPlexSession(null);
            const found = OFFICIAL_71_BRANCHES.find(
                (b) => `${formatBranchName(b.name)} (${b.primaryIp})` === selectedBranch
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
        if (!inventoryName.trim()) {
            notify.error("Nombre requerido", "Ingresá un nombre para el inventario.");
            return;
        }

        if (isParsingFile) {
            notify.warning("Procesando archivo", "Aguarde a que finalice la lectura del Excel...");
            return;
        }

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

        const catalogToUse = applyCatalogFilters(currentRaw, checkedRubros, stockFilter);

        if (!catalogToUse || catalogToUse.length === 0) {
            notify.error("Sin productos", "Ningún producto coincide con los rubros y saldos de stock seleccionados.");
            return;
        }

        // Si ya hay un PIN generado o recuperado de 6 dígitos, mantenerlo; de lo contrario generar uno
        const effectivePin = (generatedPin && generatedPin.length === 6)
            ? generatedPin
            : Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedPin(effectivePin);

        setIsStartingSession(true);
        try {
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
            } catch (supaErr) {
                console.warn('[Supabase] Error directo en precount_sessions, encolado vía syncManager:', supaErr);
            }

            // 4. Subir master_catalog.json a Supabase (precount_device_files) para que los colectores y otras terminales descarguen la base
            if (catalogToUse && catalogToUse.length > 0) {
                try {
                    await (supabase as any)
                        .from('precount_device_files')
                        .delete()
                        .eq('session_id', targetSession.id)
                        .eq('device_id', 'system')
                        .eq('filename', 'master_catalog.json');

                    const { error: fileErr } = await (supabase as any).from('precount_device_files').insert({
                        session_id: targetSession.id,
                        device_id: 'system',
                        device_name: 'System',
                        filename: 'master_catalog.json',
                        content: JSON.stringify(catalogToUse)
                    });
                    if (fileErr) {
                        console.warn('[Supabase] Error insertando master_catalog.json:', fileErr);
                    } else {
                        console.log('[Supabase] master_catalog.json subido con éxito para sesión:', targetSession.id);
                    }
                } catch (fileErr) {
                    console.warn('[Supabase] Error subiendo master_catalog.json:', fileErr);
                }
            }

            // 5. Guardar productos localmente en Dexie precount_products
            if (catalogToUse && catalogToUse.length > 0) {
                try {
                    const dbProducts = expandCatalogToDbProducts(catalogToUse, targetSession.id);
                    await db.precount_products.bulkPut(dbProducts);
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
            setIsStartingSession(false);
        }
    };

    return (
        <ScrollArea orientation="vertical" viewportClassName="scroll-fade pr-1" className="w-full flex-1 min-h-0 h-full">
            {/* Contenedor exterior estilo Fluid: 2px de padding, bordes redondeados y sombra sutil */}
            <div className="w-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[22px] p-[1.5px] transition-all duration-200 shadow-xs">
                {/* Recuadro interior blanco/más claro que ocupa todo el ancho */}
                <div className="w-full bg-white dark:bg-surface-3 border border-border/40 rounded-[20px] p-4 sm:p-5.5 shadow-xs flex flex-col justify-between">
                    {/* Grilla de dos columnas */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 flex-1">
                        
                        {/* COLUMNA IZQUIERDA: Formulario de Configuración General */}
                        <div className="lg:col-span-7 flex flex-col space-y-3.5">
                            {/* 1. Nombre del inventario / Nombre del usuario operador */}
                            <div className="space-y-1.5">
                                <div>
                                    <h3 className="text-base font-bold text-foreground tracking-tight">
                                        {isBranchProfile ? "Nombre del usuario operador" : "Nombre del inventario"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                        {isBranchProfile 
                                            ? "Identificador del operador para este colector (visible en monitoreo, tabla y reportes)."
                                            : "El título oficial del inventario visible en todas las terminales y reportes."}
                                    </p>
                                </div>
                                <Input
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
                                    placeholder={isBranchProfile ? "Ej: Juan Pérez" : "Ej: Inventario Saladillo"}
                                    className="h-9 text-xs rounded-xl bg-surface-2/50 dark:bg-surface-2/30 border border-border/40 text-foreground hover:border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40 px-3 transition-colors"
                                />
                            </div>

                            {!isBranchProfile && (
                                <>
                                    {/* 2. Sucursal */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">
                                            Sucursal
                                        </label>
                                        <Select value={selectedBranch} onValueChange={handleBranchChange}>
                                            <SelectTrigger 
                                                placeholder="Selecciona una sucursal..." 
                                                className="h-9 text-xs w-full rounded-xl bg-surface-2/50 dark:bg-surface-2/30 border border-border/40 hover:border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40 transition-colors" 
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

                                    {/* 3 y 4. Parámetros de Red: IP y Puerto TCP (Solo lectura / Inactivo) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                        <div className="sm:col-span-8 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-semibold text-foreground">
                                                    Dirección IP del Servidor Plex
                                                </label>
                                                {connectionStatus === 'connected' && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                                        <CheckCircle2 className="w-3 h-3" /> En línea
                                                    </span>
                                                )}
                                                {connectionStatus === 'error' && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                                                        <AlertCircle className="w-3 h-3" /> Sin respuesta
                                                    </span>
                                                )}
                                            </div>
                                            <Input
                                                value={serverIp}
                                                onChange={(e) => {
                                                    const newIp = e.target.value;
                                                    setServerIp(newIp);
                                                    setConnectionStatus('idle');
                                                    if (typeof window !== 'undefined') {
                                                        localStorage.setItem('precount_config_server_ip', newIp);
                                                    }
                                                }}
                                                placeholder="10.0.70.10"
                                                className="h-9 text-xs rounded-xl bg-surface-2/50 dark:bg-surface-2/30 border border-border/40 text-foreground px-3 hover:border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40 font-mono transition-colors"
                                            />
                                        </div>

                                        <div className="sm:col-span-4 space-y-1.5">
                                            <label className="text-xs font-semibold text-foreground">
                                                Puerto TCP
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={serverPort}
                                                    onChange={(e) => {
                                                        const newPort = e.target.value;
                                                        setServerPort(newPort);
                                                        if (typeof window !== 'undefined') {
                                                            localStorage.setItem('precount_config_server_port', newPort);
                                                        }
                                                    }}
                                                    placeholder="3306"
                                                    className="h-9 text-xs rounded-xl bg-surface-2/50 dark:bg-surface-2/30 border border-border/40 text-foreground px-3 hover:border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40 flex-1 font-mono transition-colors"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={isTestingConnection || !serverIp.trim()}
                                                    onClick={handleTestConnection}
                                                    className="h-9 px-3 rounded-xl text-xs font-medium border border-border/40 bg-surface-2/60 hover:bg-surface-2 text-foreground transition-colors shrink-0 gap-1.5"
                                                    title="Probar conexión con el servidor Plex"
                                                >
                                                    <Wifi className={cn("w-3 h-3", isTestingConnection && "animate-pulse text-primary")} />
                                                    <span className="hidden sm:inline">{isTestingConnection ? "Probando..." : "Probar"}</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4.5. Sesión en Servidor Plex */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                                                Sesión de Inventario en Servidor Plex
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => fetchOpenSessions(serverIp, serverPort)}
                                                disabled={isCheckingPlexSessions || !serverIp.trim()}
                                                className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <RefreshCw className={cn("w-2.5 h-2.5", isCheckingPlexSessions && "animate-spin")} />
                                                <span>{isCheckingPlexSessions ? "Comprobando..." : "Comprobar sesiones abiertas"}</span>
                                            </button>
                                        </div>

                                        <Select value={selectedPlexMode} onValueChange={handlePlexSessionSelect}>
                                            <SelectTrigger 
                                                placeholder="Seleccionar sesión de Plex..." 
                                                className="h-9 text-xs w-full rounded-xl bg-surface-2/50 dark:bg-surface-2/30 border border-border/40 hover:border-border/60 focus-visible:ring-1 focus-visible:ring-primary/40 transition-colors" 
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

                                        {selectedPlexMode !== 'new' && selectedPlexSession && (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
                                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                                <span>
                                                    Se retomará la <strong>Sesión #{selectedPlexSession.id_inventario}</strong> de Plex ({selectedPlexSession.usuario || 'Operador'}). Los conteos se enviarán directamente a este inventario.
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* 5. Rubros a inventariar y Valores de stock a incluir */}
                            <div className="pt-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                    {/* Rubros a inventariar */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="text-xs font-semibold text-foreground">
                                                    Rubros a inventariar
                                                </label>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                                                    Seleccioná los rubros habilitados para el conteo físico.
                                                </p>
                                            </div>
                                            {checkedRubros.size < 4 && (
                                                <button
                                                    type="button"
                                                    onClick={selectAllRubros}
                                                    className="text-[11px] text-primary hover:text-primary/80 font-medium cursor-pointer shrink-0"
                                                >
                                                    Seleccionar todos
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-0.5 pt-0.5">
                                            {RUBROS_CONFIG.map((rubro, idx) => (
                                                <div key={rubro} className="flex items-center">
                                                    <Switch
                                                        checked={checkedRubros.has(idx)}
                                                        onToggle={() => toggleRubro(idx)}
                                                        label={rubro}
                                                        className="font-medium text-xs sm:text-[13px] text-foreground py-1 px-1.5 cursor-pointer"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Valores de stock a incluir */}
                                    <div className="space-y-1.5">
                                        <div>
                                            <label className="text-xs font-semibold text-foreground">
                                                Valores de stock a incluir
                                            </label>
                                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                                                Filtrá los productos según su saldo de stock.
                                            </p>
                                        </div>

                                        <div className="pt-0.5">
                                            <RadioGroup
                                                value={stockFilter}
                                                onValueChange={(v) => setStockFilter(v as StockFilterOption)}
                                                className="space-y-0.5"
                                            >
                                                <RadioItem index={0} value="all" label="Todos los valores de stock" className="py-1 px-1.5 text-xs sm:text-[13px] text-foreground cursor-pointer" />
                                                <RadioItem index={1} value="positive" label="Solo con stock positivo (> 0)" className="py-1 px-1.5 text-xs sm:text-[13px] text-foreground cursor-pointer" />
                                                <RadioItem index={2} value="negative" label="Stock en negativo (< 0)" className="py-1 px-1.5 text-xs sm:text-[13px] text-foreground cursor-pointer" />
                                                <RadioItem index={3} value="zero" label="Stock en 0" className="py-1 px-1.5 text-xs sm:text-[13px] text-foreground cursor-pointer" />
                                            </RadioGroup>
                                        </div>
                                    </div>
                                </div>

                                {/* Resumen interactivo de productos filtrados */}
                                {rawCatalog && rawCatalog.length > 0 && (
                                    <div className="mt-3 px-3 py-2 rounded-xl bg-surface-2/70 dark:bg-surface-2/40 border border-border/40 flex items-center justify-between text-xs text-foreground">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                            Filtros activos:
                                        </span>
                                        <span className="font-medium">
                                            <strong className="text-primary font-semibold">
                                                {parsedCatalog ? parsedCatalog.length.toLocaleString('es-AR') : 0}
                                            </strong> de {rawCatalog.length.toLocaleString('es-AR')} productos listos para inventariar
                                        </span>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* COLUMNA DERECHA: Código de Verificación OTP e Importación */}
                        <div className="lg:col-span-5 flex flex-col justify-between space-y-4 pt-1 lg:pt-0 lg:border-l lg:border-border/30 lg:pl-8">
                            <div className="space-y-3.5">
                                <div>
                                    <h3 className="text-base font-bold text-foreground tracking-tight">
                                        Código de verificación (PIN)
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                        PIN de 6 dígitos requerido en las terminales y colectores para autorizar la sincronización del inventario.
                                    </p>
                                </div>

                                {/* Bloque del PIN: Componente de seguridad oficial (Monocromático) */}
                                <div className="w-full flex flex-col items-center justify-center py-2 space-y-2">
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
                                    {isBranchProfile ? (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium pt-1">
                                            <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span>Ingresá el PIN provisto por el administrador</span>
                                        </div>
                                    ) : generatedPin ? (
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedPin);
                                                    setCopiedPin(true);
                                                    notify.success("PIN copiado al portapapeles");
                                                    setTimeout(() => setCopiedPin(false), 2000);
                                                }}
                                                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
                                            >
                                                {copiedPin ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copiedPin ? '¡Copiado!' : 'Copiar PIN'}</span>
                                            </button>
                                            <span className="text-border/60">•</span>
                                            <div className="inline-flex items-center gap-1.5 font-medium">
                                                <ShieldCheck className="w-3.5 h-3.5 text-foreground/70" />
                                                <span>{sessionId ? 'PIN activo de la sesión' : 'PIN asignado al iniciar'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium pt-1">
                                            <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span>Se creará automáticamente al iniciar inventario</span>
                                        </div>
                                    )}
                                </div>

                                {/* Importar Stock Teórico (Solo en perfil administrador) */}
                                {!isBranchProfile && (
                                    <div className="space-y-2 pt-1">
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground tracking-tight">
                                                Importar stock teórico
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                                Seleccioná el origen para contrastar el conteo contra las existencias esperadas.
                                            </p>
                                        </div>

                                        <Tabs
                                            value={importSource}
                                            onValueChange={(v) => setImportSource(v as ImportSourceOption)}
                                            className="w-full"
                                        >
                                            <TabsList className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 p-1 rounded-xl w-full">
                                                <TabItem value="file" label="Importar desde archivo" icon={FileSpreadsheet as any} className="flex-1 text-xs" />
                                                <TabItem 
                                                    value="server" 
                                                    label="Importar desde servidor" 
                                                    icon={Database as any} 
                                                    className="flex-1 text-xs" 
                                                />
                                            </TabsList>

                                            {/* TabPanel 1: Importar stock desde archivo */}
                                            <TabPanel value="file" className="pt-2">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".xlsx, .xls"
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                />
                                                <div
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className={cn(
                                                        "group relative border-2 border-dashed rounded-2xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200",
                                                        rawCatalog && rawCatalog.length > 0
                                                            ? "border-foreground/40 bg-surface-3"
                                                            : selectedFile
                                                                ? "border-foreground/30 bg-surface-2"
                                                                : "border-border/60 hover:border-border bg-surface-2/40 dark:bg-surface-2/20 hover:bg-surface-2/70"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 transition-transform duration-200 group-hover:scale-105",
                                                        rawCatalog && rawCatalog.length > 0
                                                            ? "bg-surface-4 text-foreground"
                                                            : isParsingFile
                                                                ? "bg-surface-3 text-foreground animate-pulse"
                                                                : "bg-surface-3 text-foreground"
                                                    )}>
                                                        {isParsingFile ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : rawCatalog && rawCatalog.length > 0 ? (
                                                            <CheckCircle2 className="w-4 h-4 stroke-[2] text-foreground" />
                                                        ) : selectedFile ? (
                                                            <FileSpreadsheet className="w-4 h-4 stroke-[1.8]" />
                                                        ) : (
                                                            <Upload className="w-4 h-4 stroke-[1.8]" />
                                                        )}
                                                    </div>

                                                    <div className="space-y-0.5">
                                                        <p className="text-xs font-semibold text-foreground tracking-tight">
                                                            {isParsingFile ? (
                                                                'Procesando archivo...'
                                                            ) : rawCatalog && rawCatalog.length > 0 ? (
                                                                `Listo: ${selectedFile?.name || 'Archivo Excel cargado'}`
                                                            ) : selectedFile ? (
                                                                selectedFile.name
                                                            ) : (
                                                                <>Hacé clic para cargar Excel <span className="text-muted-foreground font-normal">(.xlsx, .xls)</span></>
                                                            )}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {rawCatalog && rawCatalog.length > 0
                                                                ? `${parsedCatalog ? parsedCatalog.length.toLocaleString('es-AR') : 0} de ${rawCatalog.length.toLocaleString('es-AR')} productos listos para inventariar`
                                                                : 'Padrón maestro de existencias teóricas (17 columnas)'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TabPanel>

                                            {/* TabPanel 2: Importar stock desde servidor Plex */}
                                            <TabPanel value="server" className="pt-2">
                                                <div className="p-3.5 rounded-2xl border border-border/40 bg-surface-2/40 dark:bg-surface-2/20 flex flex-col items-center justify-center text-center space-y-2">
                                                    <div className="w-8 h-8 rounded-xl bg-surface-3 flex items-center justify-center text-foreground">
                                                        <Database className="w-4 h-4 stroke-[1.8]" />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <p className="text-xs font-semibold text-foreground tracking-tight">
                                                            Sincronización directa con MySQL
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            Descarga la foto de stock actual directamente desde <span className="font-mono text-foreground font-medium">{serverIp}</span>.
                                                        </p>
                                                    </div>
                                                    <div className="pt-0.5 w-full max-w-[280px]">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={isSyncingLocalDb}
                                                            onClick={handleSyncLocalStock}
                                                            className="w-full text-xs font-semibold rounded-xl border border-border/40 bg-surface-1 hover:bg-hover text-foreground flex items-center justify-center gap-2 py-1.5"
                                                        >
                                                            <RefreshCw className={cn("w-3.5 h-3.5", isSyncingLocalDb && "animate-spin text-primary")} />
                                                            <span>
                                                                {isSyncingLocalDb 
                                                                    ? "Descargando desde Plex..." 
                                                                    : rawCatalog && rawCatalog.length > 0 
                                                                        ? `Actualizar Stock (${parsedCatalog ? parsedCatalog.length.toLocaleString('es-AR') : 0} filtrados de ${rawCatalog.length.toLocaleString('es-AR')})`
                                                                        : localDbCount !== null
                                                                            ? `Actualizar Stock Plex (${localDbCount.toLocaleString('es-AR')} prods)`
                                                                            : "Descargar Stock desde Servidor Plex"}
                                                            </span>
                                                        </Button>
                                                        <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                            Guarda <code className="text-primary font-mono text-[10px]">stock_local.db</code> en Windows para lecturas a 0.2ms offline.
                                                        </p>
                                                    </div>
                                                </div>
                                            </TabPanel>
                                        </Tabs>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Barra inferior de acciones */}
                    <div className="pt-4 mt-4 border-t border-border/20 flex items-center justify-end gap-2.5">
                        <Button
                                variant="ghost"
                                onClick={() => {
                                    if (isBranchProfile) {
                                        setBranchPin('');
                                    } else {
                                        if (typeof window !== 'undefined') {
                                            localStorage.removeItem('precount_config_selected_branch');
                                            localStorage.removeItem('precount_config_server_ip');
                                            localStorage.removeItem('precount_config_inventory_name');
                                        }
                                        const defaultBranch = user?.branchSheet 
                                            ? OFFICIAL_71_BRANCHES.find(b => b.name.toLowerCase() === user.branchSheet?.toLowerCase()) || OFFICIAL_71_BRANCHES[0]
                                            : OFFICIAL_71_BRANCHES.find(b => b.name.toUpperCase() === 'SALADILLO') || OFFICIAL_71_BRANCHES[0];
                                        const defLabel = `${formatBranchName(defaultBranch.name)} (${defaultBranch.primaryIp})`;
                                        setInventoryName(`Inventario ${formatBranchName(defaultBranch.name)}`);
                                        setSelectedBranch(defLabel);
                                        setServerIp(defaultBranch.primaryIp);
                                        setGeneratedPin(Math.floor(100000 + Math.random() * 900000).toString());
                                        setServerPort("3306");
                                        setSelectedFile(null);
                                        setRawCatalog(null);
                                        setImportSource('file');
                                        setCheckedRubros(new Set([0, 1, 2, 3]));
                                        setStockFilter('all');
                                        setConnectionStatus('idle');
                                    }
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                loading={isStartingSession}
                                disabled={!isReadyToStart || isStartingSession || isParsingFile}
                                onClick={isBranchProfile ? handleSyncBranchSession : handleStartInventory}
                            >
                                {isStartingSession
                                    ? (isBranchProfile ? "Sincronizando..." : "Iniciando inventario...")
                                    : (isBranchProfile ? "Sincronizar inventario" : "Iniciar inventario")}
                            </Button>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
}


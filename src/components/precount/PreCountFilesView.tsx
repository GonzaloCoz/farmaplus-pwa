import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Smartphone as SmartphoneIcon,
    Monitor as MonitorIcon,
    Package,
    Clock,
    Download,
    FileText,
    FolderDown,
    Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { db, LocalItem } from '@/services/db';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/services/deviceTelemetry';
import { getFullSectorName } from '@/constants/farmaplusSectors';
import { normalizeDeviceModel } from './DeviceMonitorView';
import { preCountExportService, SentBatchRecord } from '@/services/preCountExportService';

export interface ExportFileItem {
    id: string;
    fileName: string;
    batchCode: string;
    format: 'txt' | 'csv' | 'xlsx';
    timestamp: string;      // e.g. "14:25 hs" o "Hoy 13:40"
    unitsCount: number;     // e.g. 310
    skusCount: number;      // e.g. 45
    status: 'exported' | 'pending' | 'processed';
    fileSize?: string;
    content?: string;
    items?: Array<{
        id_producto?: string;
        ean: string;
        quantity: number;
        product_name?: string;
    }>;
}

export interface TerminalFilesGroup {
    id: string;
    connectionId: string;   // e.g. "ST-00142"
    userName: string;       // e.g. "Station 1 - Zebra 01"
    deviceType: 'zebra' | 'pc';
    deviceModel: string;    // e.g. "Type 2 · TC26 Android"
    locationSubtitle: string; // e.g. "Sector Salón Principal · Sincronizado hace 1m"
    files: ExportFileItem[];
}

export interface PreCountFilesViewProps {
    sessionId?: string;
    isBranchMode?: boolean;
}

function downloadExportFile(file: ExportFileItem, terminalName: string) {
    try {
        let content = file.content;
        if (!content) {
            if (!file.items || file.items.length === 0) {
                toast.info(`No hay ítems registrados para el lote ${file.batchCode}`);
                return;
            }

            // Formato estándar Colector Farmaplus: IDProducto;EAN;Cantidad;0
            const lines = file.items.map(item => {
                const idProd = item.id_producto || '';
                return `${idProd};${item.ean};${item.quantity};0`;
            });
            content = lines.join('\n');
        }

        const blob = new Blob([content], { 
            type: file.format === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Archivo descargado: ${file.fileName}`);
    } catch (err) {
        console.error('Error al descargar archivo:', err);
        toast.error('No se pudo generar el archivo');
    }
}

function downloadTerminalBatch(terminal: TerminalFilesGroup) {
    if (!terminal.files || terminal.files.length === 0) {
        toast.info('No hay archivos disponibles en esta terminal');
        return;
    }
    terminal.files.forEach((f, idx) => {
        setTimeout(() => downloadExportFile(f, terminal.userName), idx * 180);
    });
    toast.success(`Exportando ${terminal.files.length} archivos de ${terminal.userName}`);
}

export function PreCountFilesView({ sessionId, isBranchMode = false }: PreCountFilesViewProps) {
    const [terminals, setTerminals] = useState<TerminalFilesGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const activeSessionId = useMemo(() => {
        if (sessionId) return sessionId;
        if (typeof window !== 'undefined') {
            return localStorage.getItem('last_precount_session_id') || localStorage.getItem('precount_session_id') || '';
        }
        return '';
    }, [sessionId]);

    const loadRealFiles = useCallback(async () => {
        try {
            const resultGroups: TerminalFilesGroup[] = [];

            // 1. Cargar lotes enviados desde Supabase (recibidos desde sucursales)
            const sentBatches = await preCountExportService.fetchAdminSentBatches();
            if (sentBatches && sentBatches.length > 0) {
                const branchGroups = new Map<string, SentBatchRecord[]>();
                sentBatches.forEach(b => {
                    const key = b.branch_name || 'Sucursal';
                    if (!branchGroups.has(key)) branchGroups.set(key, []);
                    branchGroups.get(key)!.push(b);
                });

                branchGroups.forEach((batches, branchName) => {
                    const connId = batches[0].device_id.substring(0, 8).toUpperCase();
                    const isZebra = batches[0].device_name.toLowerCase().includes('zebra');
                    
                    const files: ExportFileItem[] = batches.map(b => {
                        let timeFormatted = 'Hoy';
                        if (b.created_at) {
                            try {
                                const d = new Date(b.created_at);
                                timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} hs`;
                            } catch {}
                        }
                        const byteSize = (b.content || '').length;
                        const sizeFormatted = byteSize > 1024 ? `${(byteSize / 1024).toFixed(1)} KB` : `${byteSize} B`;

                        return {
                            id: `sent-${b.id}`,
                            fileName: b.file_name,
                            batchCode: b.sector,
                            format: 'txt',
                            timestamp: timeFormatted,
                            unitsCount: b.total_units,
                            skusCount: b.total_skus,
                            status: 'exported',
                            fileSize: sizeFormatted,
                            content: b.content
                        };
                    });

                    resultGroups.push({
                        id: `branch-${branchName}`,
                        connectionId: connId,
                        userName: `${branchName} · ${batches[0].device_name}`,
                        deviceType: isZebra ? 'zebra' : 'pc',
                        deviceModel: isZebra ? 'Type 2 · TC26 Android' : 'Type 1 · PC Salón',
                        locationSubtitle: `Enviado desde ${branchName} · ${batches.length} ${batches.length === 1 ? 'lote' : 'lotes'}`,
                        files
                    });
                });
            }

            // 2. Si hay sesión activa local, consultar ítems locales y remotos de la sesión
            if (activeSessionId) {
                let items: LocalItem[] = await db.items
                    .where('session_id')
                    .equals(activeSessionId)
                    .toArray();

                // SIEMPRE consultar ítems remotos de Supabase para ver los enviados por la Zebra y otras terminales
                const { data: supaItems } = await supabase
                    .from('precount_items')
                    .select('*')
                    .eq('session_id', activeSessionId);

                if (supaItems && supaItems.length > 0) {
                    const localIds = new Set(items.map(it => it.id));
                    supaItems.forEach((si: any) => {
                        if (!localIds.has(si.id)) {
                            items.push({
                                id: si.id,
                                session_id: si.session_id,
                                ean: si.ean,
                                product_name: si.product_name,
                                quantity: si.quantity,
                                scanned_at: si.scanned_at,
                                scanned_by: si.device_name || si.device_id,
                                synced: 1,
                                id_producto: si.id_producto || '',
                                device_id: si.device_id || 'TERMINAL-01',
                                device_name: si.device_name || 'Terminal',
                                location_tag: si.location_tag || 'GENERAL'
                            });
                        }
                    });
                }

                if (items.length > 0) {
                    const closedSectors = new Set<string>();
                    try {
                        const localLocations = await db.locations
                            .where('session_id')
                            .equals(activeSessionId)
                            .toArray();
                        localLocations.forEach(loc => {
                            if (loc.status === 'closed') {
                                closedSectors.add(loc.location_tag.toUpperCase());
                            }
                        });
                    } catch {}

                    try {
                        const { data: supaLocs } = await (supabase as any)
                            .from('precount_location_status')
                            .select('location_tag, status')
                            .eq('session_id', activeSessionId);
                        if (supaLocs) {
                            supaLocs.forEach((loc: any) => {
                                if (loc.status === 'closed' && loc.location_tag) {
                                    closedSectors.add(loc.location_tag.toUpperCase());
                                }
                            });
                        }
                    } catch {}

                    const deviceMetaMap = new Map<string, any>();

                    // Cargar metadatos desde precount_connected_devices en Supabase
                    try {
                        const { data: supaDevs } = await (supabase as any)
                            .from('precount_connected_devices')
                            .select('*')
                            .eq('session_id', activeSessionId);
                        if (supaDevs) {
                            supaDevs.forEach((d: any) => {
                                const isZ = (d.device_type === 'zebra') || (d.device_name || '').toLowerCase().includes('zebra') || (d.device_model || '').toLowerCase().includes('zebra');
                                deviceMetaMap.set(d.device_id, {
                                    deviceId: d.device_id,
                                    deviceName: d.device_name,
                                    userName: d.device_name,
                                    deviceType: isZ ? 'zebra' : 'pc',
                                    deviceModel: isZ ? 'Type 2 · TC22 Android' : 'Type 1 · PC Salón',
                                    connectionId: d.device_id.substring(0, 8).toUpperCase()
                                });
                            });
                        }
                    } catch {}

                    if (typeof localStorage !== 'undefined') {
                        try {
                            for (let i = 0; i < localStorage.length; i++) {
                                const k = localStorage.key(i);
                                if (k && (k.startsWith('precount_monitor_cache_') || k.startsWith('precount_active_terminal_'))) {
                                    const val = localStorage.getItem(k);
                                    if (val) {
                                        const parsed = JSON.parse(val);
                                        const dId = parsed.deviceId || parsed.id;
                                        if (dId && !deviceMetaMap.has(dId)) deviceMetaMap.set(dId, parsed);
                                    }
                                }
                            }
                        } catch {}
                    }

                    const deviceGroups = new Map<string, LocalItem[]>();
                    items.forEach(item => {
                        const dId = item.device_id || item.scanned_by || 'TERMINAL-1';
                        if (!deviceGroups.has(dId)) deviceGroups.set(dId, []);
                        deviceGroups.get(dId)!.push(item);
                    });

                    deviceGroups.forEach((devItems, devId) => {
                        const meta = deviceMetaMap.get(devId) || {};
                        const isZebra = meta.deviceType === 'zebra' || 
                            devId.toLowerCase().includes('zebra') ||
                            (meta.userName || meta.deviceName || devItems[0]?.device_name || '').toLowerCase().includes('zebra');

                        const connId = meta.connectionId || devId.substring(0, 8).toUpperCase();
                        const userName = meta.userName || meta.deviceName || devItems[0]?.device_name || (isZebra ? `Zebra ${connId}` : `Station ${connId}`);
                        const model = meta.deviceModel || (isZebra ? 'Type 2 · TC26 Android' : 'Type 1 · PC Salón');
                        const subtitle = meta.locationSubtitle || (devItems[0]?.location_tag ? `${getFullSectorName(devItems[0].location_tag)} · En Vivo` : 'Sincronizado');

                        const locationGroups = new Map<string, LocalItem[]>();
                        devItems.forEach(item => {
                            const loc = (item.location_tag || 'GENERAL').trim();
                            if (!locationGroups.has(loc)) locationGroups.set(loc, []);
                            locationGroups.get(loc)!.push(item);
                        });

                        const files: ExportFileItem[] = [];
                        locationGroups.forEach((batchItems, locTag) => {
                            const totalQty = batchItems.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
                            const skusCount = new Set(batchItems.map(it => it.ean)).size;
                            
                            const lastItem = [...batchItems].sort((a, b) => 
                                new Date(b.scanned_at || 0).getTime() - new Date(a.scanned_at || 0).getTime()
                            )[0];
                            let timeFormatted = 'Hoy';
                            if (lastItem?.scanned_at) {
                                try {
                                    const d = new Date(lastItem.scanned_at);
                                    timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} hs`;
                                } catch {}
                            }

                            const isClosed = closedSectors.has(locTag.toUpperCase());
                            const safeSector = locTag.replace(/[^a-zA-Z0-9_-]/g, '_');
                            const cleanConn = connId.replace(/[^a-zA-Z0-9]/g, '');
                            const fileName = `INV_${cleanConn}_${safeSector}.txt`;

                            const byteSize = batchItems.length * 28;
                            const sizeFormatted = byteSize > 1024 ? `${(byteSize / 1024).toFixed(1)} KB` : `${byteSize} B`;

                            files.push({
                                id: `file-${devId}-${locTag}`,
                                fileName,
                                batchCode: locTag,
                                format: 'txt',
                                timestamp: timeFormatted,
                                unitsCount: totalQty,
                                skusCount,
                                status: isClosed ? 'processed' : 'pending',
                                fileSize: sizeFormatted,
                                items: batchItems.map(it => ({
                                    id_producto: it.id_producto,
                                    ean: it.ean,
                                    quantity: it.quantity,
                                    product_name: it.product_name
                                }))
                            });
                        });

                        if (files.length > 0) {
                            resultGroups.push({
                                id: devId,
                                connectionId: connId,
                                userName,
                                deviceType: isZebra ? 'zebra' : 'pc',
                                deviceModel: model,
                                locationSubtitle: subtitle,
                                files
                            });
                        }
                    });
                }
            }

            setTerminals(resultGroups);
        } catch (err) {
            console.error('[PreCountFilesView] Error loading files:', err);
        } finally {
            setIsLoading(false);
        }
    }, [activeSessionId]);

    useEffect(() => {
        loadRealFiles();

        const handleUpdate = () => loadRealFiles();
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('precount:item_added' as any, handleUpdate);
        window.addEventListener('precount:item_scanned' as any, handleUpdate);
        window.addEventListener('precount:item_deleted' as any, handleUpdate);
        window.addEventListener('precount:batch_sent' as any, handleUpdate);
        window.addEventListener('precount:device_joined' as any, handleUpdate);

        let channel: any = null;
        if (activeSessionId) {
            channel = supabase
                .channel(`precount_files_live:${activeSessionId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'precount_items',
                    filter: `session_id=eq.${activeSessionId}`
                }, () => loadRealFiles())
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'precount_location_status',
                    filter: `session_id=eq.${activeSessionId}`
                }, () => loadRealFiles())
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'precount_device_files',
                    filter: `session_id=eq.${activeSessionId}`
                }, () => loadRealFiles())
                .subscribe();
        }

        return () => {
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('precount:item_added' as any, handleUpdate);
            window.removeEventListener('precount:item_scanned' as any, handleUpdate);
            window.removeEventListener('precount:item_deleted' as any, handleUpdate);
            window.removeEventListener('precount:batch_sent' as any, handleUpdate);
            window.removeEventListener('precount:device_joined' as any, handleUpdate);
            if (channel) {
                try { supabase.removeChannel(channel); } catch {}
            }
        };
    }, [loadRealFiles, activeSessionId]);

    const myDeviceId = useMemo(() => getDeviceId(), []);
    const myDeviceName = useMemo(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('precount_device_name') || localStorage.getItem('precount_user_name') || '').toLowerCase().trim();
        }
        return '';
    }, []);

    const visibleTerminals = useMemo(() => {
        if (!isBranchMode) return terminals;

        // En modo sucursal, filtrar para mostrar exclusivamente la terminal local
        const matched = terminals.filter(t => {
            const tIdLower = (t.id || '').toLowerCase();
            const tConnLower = (t.connectionId || '').toLowerCase();
            const tUserLower = (t.userName || '').toLowerCase();
            const myIdLower = myDeviceId.toLowerCase();

            const isCurrentDevice = tIdLower.includes(myIdLower) || myIdLower.includes(tIdLower);
            const isCurrentConn = myIdLower.startsWith(tConnLower) || tConnLower.startsWith(myIdLower.substring(0, 8));
            const isCurrentName = Boolean(myDeviceName && (tUserLower.includes(myDeviceName) || myDeviceName.includes(tUserLower)));
            const isLocalPc = t.deviceType === 'pc' && !tUserLower.includes('zebra') && !tIdLower.includes('zebra');

            return isCurrentDevice || isCurrentConn || isCurrentName || isLocalPc;
        });

        if (matched.length > 0) return matched;
        const localPc = terminals.filter(t => t.deviceType === 'pc');
        return localPc.length > 0 ? [localPc[0]] : (terminals.length > 0 ? [terminals[0]] : []);
    }, [terminals, isBranchMode, myDeviceId, myDeviceName]);

    const totalUnits = visibleTerminals.reduce((acc, t) => acc + t.files.reduce((fa, f) => fa + f.unitsCount, 0), 0);
    const totalSkus = visibleTerminals.reduce((acc, t) => acc + t.files.reduce((fa, f) => fa + f.skusCount, 0), 0);
    const totalFiles = visibleTerminals.reduce((acc, t) => acc + t.files.length, 0);

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Header / Resumen de Archivos (Estructura y altura 100% idéntica a DeviceMonitorView) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/20">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-foreground">
                        {isBranchMode
                            ? (totalFiles > 0 
                                ? `Mis Archivos de Conteo (${totalFiles} ${totalFiles === 1 ? 'Archivo' : 'Archivos'})`
                                : 'Mis Archivos de Conteo')
                            : (totalFiles > 0 
                                ? `Archivos de Conteo por Terminal (${totalFiles} ${totalFiles === 1 ? 'Archivo' : 'Archivos'})`
                                : 'Archivos de Conteo por Terminal')}
                    </h2>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div>
                        Total escaneado: <strong className="text-foreground">{totalUnits.toLocaleString('es-AR')} un.</strong>
                    </div>
                    <div className="hidden sm:block h-3.5 w-px bg-border/40" />
                    <div>
                        Variedad: <strong className="text-foreground">{totalSkus} {totalSkus === 1 ? 'SKU' : 'SKUs'}</strong>
                    </div>
                </div>
            </div>

            {/* Grilla de Dispositivos / Terminales o Estado Vacío */}
            {visibleTerminals.length > 0 ? (
                <div className={cn("grid gap-4 pb-8", isBranchMode ? "grid-cols-1 max-w-2xl" : "grid-cols-1 xl:grid-cols-2")}>
                    {visibleTerminals.map((terminal) => (
                        <TerminalFilesCard key={terminal.id} terminal={terminal} />
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground text-xs gap-1.5 text-center">
                    <span className="font-semibold text-foreground text-sm">
                        No hay archivos generados aún
                    </span>
                    <span className="text-muted-foreground text-xs">
                        A medida que las terminales y colectores escaneen productos en sus respectivos sectores, los lotes de archivos se generarán automáticamente aquí listos para exportar.
                    </span>
                </div>
            )}
        </div>
    );
}

function TerminalFilesCard({ terminal }: { terminal: TerminalFilesGroup }) {
    const totalUnits = terminal.files.reduce((acc, f) => acc + f.unitsCount, 0);
    const totalSkus = terminal.files.reduce((acc, f) => acc + f.skusCount, 0);

    return (
        <div className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md">
            {/* Recuadro interno superior idéntico a DeviceCard */}
            <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-4 sm:p-5 shadow-xs flex flex-col space-y-4">
                {/* Top Bar: Nombre, Badge ID y Tipo */}
                <div>
                    <div className="flex items-start justify-between gap-3">
                        {/* Left: Título y Badge ID */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-bold text-[15px] text-foreground tracking-tight">
                                {terminal.userName}
                            </h3>

                            {/* Badge ID de conexión */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
                                {terminal.connectionId}
                            </span>
                        </div>

                        {/* Right: Tipo de dispositivo */}
                        <div className="text-xs font-medium text-muted-foreground/70 shrink-0 flex items-center gap-1.5">
                            {terminal.deviceType === 'zebra' ? (
                                <SmartphoneIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
                            ) : (
                                <MonitorIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
                            )}
                            <span>{terminal.deviceModel}</span>
                        </div>
                    </div>

                    {/* Leyenda debajo del título */}
                    <p className="text-xs text-muted-foreground mt-1">
                        {terminal.locationSubtitle}
                    </p>
                </div>

                {/* Fila de Recuadros Compactos: altura h-[142px], rounded-[24px], gap-3 exacto */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {terminal.files.map((file) => {
                        return (
                            <div
                                key={file.id}
                                className={cn(
                                    "rounded-[24px] p-3.5 sm:p-4 flex flex-col justify-between h-[142px] transition-all duration-150",
                                    "bg-[#F4F4F6] dark:bg-surface-2"
                                )}
                            >
                                {/* Cabecera del sub-recuadro: Nombre archivo/lote + Halo Dot */}
                                <div className="flex items-center justify-between gap-1">
                                    <span 
                                        className="font-bold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight leading-none truncate" 
                                        title={file.fileName}
                                    >
                                        {file.fileName}
                                    </span>
                                    {file.status === 'exported' ? (
                                        <span className="w-5 h-5 rounded-full bg-[#D1FADF] dark:bg-emerald-950/80 flex items-center justify-center shrink-0" title="Exportado">
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A]" />
                                        </span>
                                    ) : file.status === 'pending' ? (
                                        <span className="w-5 h-5 rounded-full border-2 border-dotted border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0" title="Pendiente" />
                                    ) : (
                                        <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center shrink-0" title="Procesado">
                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                        </span>
                                    )}
                                </div>

                                {/* Centro: Unidades y SKUs alineados */}
                                <div className="flex flex-col items-center justify-center py-0.5">
                                    <div className="flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-bold text-sm">
                                        <Package className="w-4 h-4 stroke-[1.8] text-zinc-400 dark:text-zinc-500" />
                                        <span>{file.unitsCount} <span className="text-xs font-normal text-muted-foreground">un.</span></span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                        {file.skusCount} {file.skusCount === 1 ? 'SKU' : 'SKUs'} · {file.timestamp}
                                    </span>
                                </div>

                                {/* Pie del sub-recuadro: Botón Exportar con altura fija */}
                                <button
                                    type="button"
                                    onClick={() => downloadExportFile(file, terminal.userName)}
                                    className="w-full h-7 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-white dark:bg-surface-3 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-900 hover:text-white dark:hover:bg-primary dark:hover:text-primary-foreground transition-colors shadow-2xs cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Exportar</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Informativo Inferior */}
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground font-medium">
                {/* Left: Archivos y totales de unidades */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <strong className="text-foreground">{terminal.files.length}</strong> {terminal.files.length === 1 ? 'archivo generado' : 'archivos generados'}
                    </span>
                    <span>·</span>
                    <span>
                        <strong className="text-foreground">{totalUnits.toLocaleString('es-AR')}</strong> un. escaneadas
                    </span>
                    <span>·</span>
                    <span>
                        <strong className="text-foreground">{totalSkus}</strong> {totalSkus === 1 ? 'SKU' : 'SKUs'}
                    </span>
                </div>

                {/* Right: Descargar Lote de la Terminal */}
                <button
                    type="button"
                    onClick={() => downloadTerminalBatch(terminal)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer shrink-0"
                >
                    <FolderDown className="w-3.5 h-3.5" />
                    <span>Descargar Lote Terminal</span>
                </button>
            </div>
        </div>
    );
}


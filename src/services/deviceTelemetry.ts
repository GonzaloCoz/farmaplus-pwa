import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, getDeviceName } from '@/services/preCountDB';
import { isTauriEnvironment } from '@/services/mysqlTauriBridge';
import { getFullSectorName } from '@/constants/farmaplusSectors';
import { db } from '@/services/db';

export { getDeviceId, getDeviceName };

export interface DevicePositionInfo {
    id: string;
    code: string;
    status: 'current' | 'completed' | 'pending';
    productsCount?: number;
    battery?: number;
}

export interface DeviceTelemetryData {
    deviceId: string;
    connectionId: string;
    userName: string;
    deviceType: 'zebra' | 'pc';
    deviceModel: string;
    status: 'online' | 'offline';
    locationSubtitle: string;
    batteryLevel: number;
    isCharging?: boolean;
    uptime: string;
    totalScanned: number;
    totalSkus: number;
    ratePerHour: number;
    positions: DevicePositionInfo[];
}

let sessionStartTime = Date.now();
let knownLocations: Map<string, number> = new Map(); // location_tag -> unitsCount

export function resetTelemetrySession() {
    sessionStartTime = Date.now();
    knownLocations.clear();
}

/**
 * Obtiene el nivel de batería real del dispositivo (Zebra o Laptop) mediante Battery API
 */
export async function getRealBatteryStatus(): Promise<{ level: number; isCharging: boolean }> {
    try {
        if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
            const battery = await (navigator as any).getBattery();
            return {
                level: Math.round(battery.level * 100),
                isCharging: battery.charging,
            };
        }
    } catch {
        // Ignorar si el navegador bloquea la API de batería
    }
    return { level: 100, isCharging: false };
}

function formatSessionUptime(startMs: number): string {
    const elapsedSecs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const hours = Math.floor(elapsedSecs / 3600);
    const minutes = Math.floor((elapsedSecs % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${Math.max(1, minutes)}m`;
}

function calculateRate(totalUnits: number, startMs: number): number {
    const elapsedHours = Math.max(0.01, (Date.now() - startMs) / (1000 * 3600));
    return Math.round(totalUnits / elapsedHours);
}

let telemetryChannel: any = null;
let telemetrySessionId: string | null = null;

export async function getOrInitTelemetryChannel(sessionId: string) {
    if (telemetryChannel && telemetrySessionId === sessionId && (telemetryChannel.state === 'joined' || telemetryChannel.state === 'joining')) {
        return telemetryChannel;
    }

    // Check if an existing channel already exists on the supabase client (e.g. DeviceMonitorView)
    const existing = supabase.getChannels().find(
        (ch: any) => ch.topic === `realtime:precount_presence:${sessionId}` || ch.subTopic === `precount_presence:${sessionId}`
    );

    if (existing) {
        if (existing.state === 'closed') {
            try {
                supabase.removeChannel(existing);
            } catch {}
        } else {
            telemetryChannel = existing;
            telemetrySessionId = sessionId;
            if (existing.state === 'joined') {
                return existing;
            }
            if (existing.state !== 'joining') {
                await new Promise<void>((resolve) => {
                    existing.subscribe((status: string) => {
                        if (status === 'SUBSCRIBED') resolve();
                    });
                    setTimeout(resolve, 1500);
                });
            }
            return telemetryChannel;
        }
    }

    telemetrySessionId = sessionId;
    telemetryChannel = supabase.channel(`precount_presence:${sessionId}`, {
        config: {
            broadcast: { self: true },
            presence: { key: getDeviceId() }
        }
    });

    await new Promise<void>((resolve) => {
        telemetryChannel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') resolve();
        });
        setTimeout(resolve, 1500);
    });

    return telemetryChannel;
}

/**
 * Obtiene el resumen cronológico exacto de sectores escaneados desde Dexie db.items.
 * Ordena estrictamente del sector más recientemente escaneado/guardado al más antiguo (igual que la tabla).
 */
export async function getOrderedSectorSummary(sessionId: string, targetDeviceId?: string): Promise<{
    orderedLocations: Array<{ code: string; count: number; lastScanned: number }>;
    totalUnits: number;
    totalSkus: number;
}> {
    if (!sessionId) {
        return { orderedLocations: [], totalUnits: 0, totalSkus: 0 };
    }
    try {
        const myDeviceId = (targetDeviceId || getDeviceId() || '').toLowerCase();
        const myDeviceName = (typeof window !== 'undefined' ? (localStorage.getItem('precount_device_name') || localStorage.getItem('precount_user_name') || '') : '').toLowerCase().trim();

        let allItems = await db.items
            .where('session_id')
            .equals(sessionId)
            .reverse()
            .sortBy('scanned_at');

        // Filtrar exclusivamente los items correspondientes a este dispositivo / terminal
        allItems = allItems.filter(rec => {
            const recDevId = (rec.device_id || '').toLowerCase();
            const recDevName = (rec.device_name || '').toLowerCase();
            const recScannedBy = (rec.scanned_by || '').toLowerCase();

            if (recDevId && (recDevId === myDeviceId || myDeviceId.includes(recDevId) || recDevId.includes(myDeviceId))) {
                return true;
            }
            if (myDeviceName && recDevName && (recDevName === myDeviceName || recDevName.includes(myDeviceName) || myDeviceName.includes(recDevName))) {
                return true;
            }
            if (!recDevId && !recDevName.includes('zebra') && !recScannedBy.includes('zebra')) {
                return true;
            }
            return false;
        });

        const sectorMap = new Map<string, { count: number; lastScanned: number }>();
        let totalUnits = 0;
        const skusSet = new Set<string>();

        for (const item of allItems) {
            const loc = (item.location_tag || (item as any).sector || '').trim().toUpperCase();
            const qty = Number(item.quantity) || 1;
            totalUnits += qty;
            if (item.ean) skusSet.add(item.ean);

            if (loc) {
                const time = item.scanned_at ? new Date(item.scanned_at).getTime() : 0;
                const existing = sectorMap.get(loc);
                if (!existing) {
                    sectorMap.set(loc, { count: qty, lastScanned: time });
                } else {
                    existing.count += qty;
                    if (time > existing.lastScanned) existing.lastScanned = time;
                }
            }
        }

        // Ordenar del más recientemente escaneado al más antiguo (idéntico a la tabla de productos)
        const orderedLocations = Array.from(sectorMap.entries())
            .sort((a, b) => b[1].lastScanned - a[1].lastScanned)
            .map(([code, data]) => ({
                code,
                count: data.count,
                lastScanned: data.lastScanned
            }));

        return { orderedLocations, totalUnits, totalSkus: skusSet.size };
    } catch {
        return { orderedLocations: [], totalUnits: 0, totalSkus: 0 };
    }
}

/**
 * Emite un ping de telemetría ligero (~200 bytes) hacia la PC Admin.
 * Se envía periódicamente o ante un cambio de sector/conteo sin transmitir producto por producto.
 */
export async function emitDeviceTelemetry(options: {
    sessionId: string;
    currentLocation?: string | null;
    totalScanned?: number;
    totalSkus?: number;
    locationUnits?: number;
    locationsMap?: Record<string, number>;
    orderedLocations?: Array<{ code: string; count: number; lastScanned?: number }>;
    isZebra?: boolean;
}): Promise<void> {
    const { sessionId, currentLocation, isZebra } = options;
    if (!sessionId) return;

    let finalOrdered = options.orderedLocations;
    let totalScanned = options.totalScanned ?? 0;
    let totalSkus = options.totalSkus ?? 0;

    // Si no se pasaron ubicaciones ya ordenadas cronológicamente, consultamos el orden real de escaneo
    if (!finalOrdered || finalOrdered.length === 0) {
        try {
            const summary = await getOrderedSectorSummary(sessionId);
            if (summary.orderedLocations.length > 0) {
                finalOrdered = summary.orderedLocations;
                if (totalScanned === 0) totalScanned = summary.totalUnits;
                if (totalSkus === 0) totalSkus = summary.totalSkus;
            }
        } catch {}
    }

    const deviceId = getDeviceId();
    const rawName = getDeviceName();
    const battery = await getRealBatteryStatus();
    const activeLoc = currentLocation ? currentLocation.trim() : '';

    // Si nos pasan un locationsMap de respaldo, actualizar knownLocations
    if (options.locationsMap) {
        for (const [loc, count] of Object.entries(options.locationsMap)) {
            if (loc && loc.trim()) {
                knownLocations.set(loc.trim(), count);
            }
        }
    }

    // Armar los bloques de posiciones para el DeviceCard de la PC Admin
    const positions: DevicePositionInfo[] = [];
    let idx = 1;
    const fullActiveLoc = activeLoc ? getFullSectorName(activeLoc) : '';

    // 1. Posición actual (el sector abierto que está cargando productos en la tabla)
    if (activeLoc) {
        const activeUnits = finalOrdered?.find(o => o.code.toUpperCase() === activeLoc.toUpperCase())?.count ?? 
                            (options.locationUnits !== undefined ? options.locationUnits : (knownLocations.get(activeLoc) || 0));
        positions.push({
            id: `pos-${idx++}`,
            code: fullActiveLoc,
            status: 'current',
            battery: battery.level,
            productsCount: activeUnits,
        });
    } else {
        positions.push({
            id: `pos-${idx++}`,
            code: 'Sin sector abierto',
            status: 'current',
            battery: battery.level,
            productsCount: 0,
        });
    }

    // 2. Posiciones anteriores completadas (EN EL ORDEN CRONOLÓGICO DE LA TABLA: MÁS RECIENTE PRIMERO)
    const completedLocs: DevicePositionInfo[] = [];
    if (finalOrdered && finalOrdered.length > 0) {
        for (const item of finalOrdered) {
            const fullCode = getFullSectorName(item.code);
            if (fullCode !== fullActiveLoc && item.code.toUpperCase() !== activeLoc.toUpperCase()) {
                completedLocs.push({
                    id: `pos-${idx++}`,
                    code: fullCode,
                    status: 'completed',
                    productsCount: item.count,
                });
            }
        }
    } else if (options.locationsMap) {
        for (const [loc, count] of Object.entries(options.locationsMap)) {
            const fullCode = getFullSectorName(loc);
            if (fullCode !== fullActiveLoc && loc.toUpperCase() !== activeLoc.toUpperCase()) {
                completedLocs.push({
                    id: `pos-${idx++}`,
                    code: fullCode,
                    status: 'completed',
                    productsCount: count,
                });
            }
        }
    }

    // Tomamos exactamente los 3 últimos sectores finalizados (ya en orden del más reciente al más antiguo)
    const recentCompleted = completedLocs.slice(0, 3);
    positions.push(...recentCompleted);

    const isZebraDevice = isZebra ?? (
        rawName.toLowerCase().includes('zebra') ||
        (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent) && !isTauriEnvironment())
    );

    const userConfiguredType = typeof localStorage !== 'undefined' ? localStorage.getItem('precount_device_type') : null;
    let detectedModel: 'PC' | 'Notebook' | 'Zebra' = 'PC';

    if (userConfiguredType && ['PC', 'Notebook', 'Zebra'].includes(userConfiguredType)) {
        detectedModel = userConfiguredType as 'PC' | 'Notebook' | 'Zebra';
    } else if (isZebraDevice) {
        detectedModel = 'Zebra';
    } else if (rawName.toLowerCase().includes('notebook') || rawName.toLowerCase().includes('laptop')) {
        detectedModel = 'Notebook';
    } else if (typeof navigator !== 'undefined' && 'getBattery' in navigator && (battery.level < 100 || !battery.isCharging)) {
        detectedModel = 'Notebook';
    } else {
        detectedModel = 'PC';
    }

    const telemetry: DeviceTelemetryData = {
        deviceId,
        connectionId: deviceId.substring(0, 8).toUpperCase(),
        userName: rawName || (isZebraDevice ? 'Zebra TC26' : 'PC Salón 01'),
        deviceType: isZebraDevice ? 'zebra' : 'pc',
        deviceModel: detectedModel,
        status: 'online',
        locationSubtitle: activeLoc ? `${fullActiveLoc} · Sincronizado recién` : 'Sin sector abierto · Esperando zona',
        batteryLevel: battery.level,
        isCharging: battery.isCharging,
        uptime: formatSessionUptime(sessionStartTime),
        totalScanned,
        totalSkus,
        ratePerHour: calculateRate(totalScanned, sessionStartTime),
        positions,
    };



    // 1. Guardar en localStorage para comunicación instantánea entre pestañas/ventanas de la misma máquina
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(`precount_active_terminal_${deviceId}`, JSON.stringify(telemetry));
        } catch {}
    }

    // 2. Emitir eventos locales para ventanas o componentes en la misma aplicación
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('precount:device_joined', { detail: telemetry }));
        window.dispatchEvent(new CustomEvent('precount:device_heartbeat', { detail: telemetry }));
    }

    // 3. Emitir por Supabase Realtime (Presence State + Broadcast de Heartbeat)
    try {
        const channel = await getOrInitTelemetryChannel(sessionId);
        if (channel) {
            // Track presence (queda persistido en el cluster de Supabase mientras el cliente esté online)
            await channel.track(telemetry);
            
            // Broadcast para listeners inmediatos
            await channel.send({
                type: 'broadcast',
                event: 'device_joined',
                payload: telemetry,
            });
            await channel.send({
                type: 'broadcast',
                event: 'device_heartbeat',
                payload: telemetry,
            });

            // Compatibilidad con usePreCount (que escucha precount_sync)
            try {
                const syncCh = supabase.getChannels().find(
                    (c: any) => c.topic === `realtime:precount_sync:${sessionId}` || c.subTopic === `precount_sync:${sessionId}`
                );
                if (syncCh) {
                    await syncCh.send({
                        type: 'broadcast',
                        event: 'device_joined',
                        payload: telemetry,
                    });
                }
            } catch {}
        }
    } catch (err) {
        console.warn('[Telemetry] Error enviando telemetría a Supabase:', err);
    }

    // 4. Actualizar tabla precount_connected_devices en Supabase (garantiza persistencia e inmediatez si Realtime re-conecta)
    try {
        await (supabase as any).from('precount_connected_devices').upsert({
            session_id: sessionId,
            device_id: deviceId,
            device_name: telemetry.userName,
            device_type: telemetry.deviceType,
            device_model: telemetry.deviceModel,
            battery_level: telemetry.batteryLevel,
            is_charging: telemetry.isCharging,
            current_location: activeLoc || null,
            last_seen: new Date().toISOString()
        });
    } catch (dbErr) {
        console.debug('[Telemetry] Error actualizando precount_connected_devices:', dbErr);
    }
}

/**
 * Emite una notificación instantánea por WebSocket Realtime (<50ms)
 * cuando un operador abre o cierra un sector.
 */
export async function broadcastSectorStatusChange(sessionId: string, payload: {
    location_tag: string;
    status: 'open' | 'closed';
    user_name?: string;
    device_name?: string;
    device_id?: string;
    closed_at?: string;
    opened_at?: string;
    units?: number;
}): Promise<void> {
    if (!sessionId) return;
    try {
        const channel = await getOrInitTelemetryChannel(sessionId);
        if (channel) {
            await channel.send({
                type: 'broadcast',
                event: 'sector_status_changed',
                payload: {
                    ...payload,
                    device_id: payload.device_id || getDeviceId(),
                    device_name: payload.device_name || getDeviceName(),
                    timestamp: Date.now()
                },
            });
        }
    } catch (err) {
        console.warn('[Telemetry] Error broadcastSectorStatusChange:', err);
    }
}


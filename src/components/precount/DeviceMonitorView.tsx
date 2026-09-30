import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/services/db';
import { getDeviceId } from '@/services/deviceTelemetry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Wifi,
    Smartphone as SmartphoneIcon,
    Monitor as MonitorIcon,
    Laptop,
    Battery as BatteryEmptyIcon,
    BatteryLow as BatteryLowIcon,
    BatteryMedium as BatteryMedium01Icon,
    BatteryMedium as BatteryMedium02Icon,
    BatteryFull as BatteryFullIcon,
    BatteryWarning as BatteryWarningIcon,
    BatteryCharging as BatteryChargingIcon,
    Barcode,
    Package,
    CheckCircle2,
    Clock,
    Layers,
    RefreshCw,
    Radio,
    Zap,
    AlertCircle
} from 'lucide-react';
import { getFullSectorName, getSectorIcon } from '@/constants/farmaplusSectors';
import { HugeiconsIcon } from '@hugeicons/react';
import { ThinkingIndicator } from "./components";

export {
    BatteryEmptyIcon,
    BatteryLowIcon,
    BatteryMedium01Icon,
    BatteryMedium02Icon,
    BatteryFullIcon,
    BatteryWarningIcon,
    BatteryChargingIcon
};

export function renderBatteryIcon(level: number, isCharging?: boolean) {
    if (isCharging) {
        return <BatteryChargingIcon className="w-5 h-5 stroke-[1.8] text-emerald-500" />;
    }
    if (level <= 15) {
        return <BatteryWarningIcon className="w-5 h-5 stroke-[1.8] text-rose-500 animate-pulse" />;
    }
    if (level <= 30) {
        return <BatteryLowIcon className="w-5 h-5 stroke-[1.8] text-amber-500" />;
    }
    if (level <= 60) {
        return <BatteryMedium01Icon className="w-5 h-5 stroke-[1.8] text-zinc-400 dark:text-zinc-500" />;
    }
    if (level <= 85) {
        return <BatteryMedium02Icon className="w-5 h-5 stroke-[1.8] text-zinc-400 dark:text-zinc-500" />;
    }
    return <BatteryFullIcon className="w-5 h-5 stroke-[1.8] text-zinc-400 dark:text-zinc-500" />;
}

export function normalizeDeviceModel(raw?: string, deviceType?: string): 'PC' | 'Notebook' | 'Zebra' {
    const text = (raw || '').toLowerCase();
    if (text.includes('zebra') || text.includes('tc26') || text.includes('tc22') || text.includes('tc21') || text.includes('tc52') || text.includes('tc57')) {
        return 'Zebra';
    }
    if (text.includes('notebook') || text.includes('laptop')) {
        return 'Notebook';
    }
    if (text.includes('pc') || text.includes('desktop') || text.includes('mostrador') || text.includes('farmacia')) {
        return 'PC';
    }
    if (deviceType === 'zebra') {
        return 'Zebra';
    }
    return 'PC';
}
import { cn } from '@/lib/utils';
import { Elevated } from '@/lib/elevated';

export interface DevicePosition {
    id: string;
    code: string;           // e.g. "B1 - L", "Góndola A1"
    status: 'current' | 'completed' | 'pending';
    productsCount?: number; // cantidad de productos controlados
    battery?: number;       // si es la posición actual
}

export interface MonitoredDevice {
    id: string;
    connectionId: string;   // e.g. "ST-00142"
    userName: string;       // e.g. "Station 1", "Zebra 01 - Marcelo G."
    deviceType: 'zebra' | 'pc';
    deviceModel: string;    // e.g. "Zebra TC26", "PC Salón HP"
    status: 'online' | 'offline' | 'idle';
    locationSubtitle: string; // e.g. "Sector Salón Principal · Sincronizado hace 1m"
    batteryLevel: number;   // 0 - 100
    isCharging?: boolean;
    uptime: string;         // e.g. "2h 45m"
    totalScanned: number;   // cantidad total de productos
    totalSkus: number;      // SKUs únicos
    ratePerHour: number;    // e.g. 280 un/h
    positions: DevicePosition[];
    isPendingTelemetry?: boolean;
}

export interface DeviceMonitorViewProps {
    initialDevices?: MonitoredDevice[];
    sessionId?: string;
}

const globalMonitorCache = new Map<string, MonitoredDevice>();

function purgeStaleDeviceCache(currentSessionId: string | null) {
    if (typeof localStorage === 'undefined') return;
    try {
        const keysToRemove: string[] = [];
        const curId = getDeviceId();
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            // Purgar claves no asociadas a la sesión actual o asociadas a la propia terminal PC
            if (k.startsWith('precount_active_terminal_') || k.startsWith('precount_monitor_cache_')) {
                if (!currentSessionId || !k.includes(currentSessionId) || k.includes(curId)) {
                    keysToRemove.push(k);
                }
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
}

function getInitialMonitoredDevices(sessionId?: string): MonitoredDevice[] {
    const curId = getDeviceId();
    // Si no hay una sesión activa explícitamente abierta, no cargar terminales de sesiones eliminadas
    if (!sessionId) {
        purgeStaleDeviceCache(null);
        globalMonitorCache.clear();
        return [];
    }
    const activeSessionId = sessionId;
    
    // Purgar inmediatamente cualquier residuo de sesiones viejas
    purgeStaleDeviceCache(activeSessionId);

    if (globalMonitorCache.size > 0) {
        return Array.from(globalMonitorCache.values()).filter(d => d.id !== curId);
    }

    if (typeof localStorage !== 'undefined') {
        const found: MonitoredDevice[] = [];
        try {
            const prefix = `precount_monitor_cache_${activeSessionId}_`;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefix)) {
                    const val = localStorage.getItem(k);
                    if (val) {
                        const parsed = JSON.parse(val);
                        const dId = parsed.deviceId || parsed.id;
                        if (dId && dId !== curId && !dId.toLowerCase().includes(curId.toLowerCase())) {
                            const nLower = (parsed.userName || parsed.deviceName || '').toLowerCase();
                            const mLower = (parsed.deviceModel || '').toLowerCase();
                            const isZ = nLower.includes('zebra') || nLower.includes('tc2') || nLower.includes('tc5') ||
                                        mLower.includes('zebra') || mLower.includes('tc2') || mLower.includes('tc5');
                            if (!isZ && parsed.deviceType === 'zebra') {
                                parsed.deviceType = 'pc';
                                parsed.deviceModel = 'PC';
                            }
                            found.push(parsed);
                            globalMonitorCache.set(dId, parsed);
                        }
                    }
                }
            }
        } catch {}
        if (found.length > 0) return found;
    }
    return [];
}

export function DeviceMonitorView({ initialDevices, sessionId }: DeviceMonitorViewProps) {
    const [devices, setDevices] = useState<MonitoredDevice[]>(() => {
        if (!sessionId) return [];
        if (initialDevices && initialDevices.length > 0) return initialDevices;
        return getInitialMonitoredDevices(sessionId);
    });
    const currentDeviceId = getDeviceId();
    const closedLocationsRef = React.useRef<Set<string>>(new Set());
    const closedDeviceMapRef = React.useRef<Map<string, string>>(new Map());
    const itemsByIdRef = React.useRef<Map<string, { id: string; device_id: string; location_tag?: string; quantity: number; ean?: string }>>(new Map());

    // Escucha de conexiones en tiempo real para pruebas y uso en vivo
    React.useEffect(() => {
        if (!sessionId) {
            setDevices([]);
            globalMonitorCache.clear();
            itemsByIdRef.current.clear();
            purgeStaleDeviceCache(null);
            return;
        }

        const activeSessionId = sessionId;

        // Purgar inmediatamente terminales fantasma de sesiones anteriores
        purgeStaleDeviceCache(activeSessionId);
        globalMonitorCache.clear();

        const liveDeviceIds = new Set<string>();

        const syncDevicePositionsAndStats = () => {
            // Recalcular conteos por dispositivo desde itemsByIdRef desde cero (idempotente 100%)
            const countsByDevice = new Map<string, { total: number; skus: Set<string>; positions: Map<string, number> }>();
            
            itemsByIdRef.current.forEach(it => {
                const devId = (it.device_id || '').toLowerCase();
                if (!devId) return;
                if (!countsByDevice.has(devId)) {
                    countsByDevice.set(devId, { total: 0, skus: new Set(), positions: new Map() });
                }
                const entry = countsByDevice.get(devId)!;
                entry.total += (Number(it.quantity) || 0);
                if (it.ean) entry.skus.add(it.ean);
                const loc = it.location_tag;
                if (loc) {
                    entry.positions.set(loc, (entry.positions.get(loc) || 0) + (Number(it.quantity) || 0));
                }
            });

            setDevices(prev => prev.map(dev => {
                const devIdLower = (dev.id || '').toLowerCase();
                const connIdLower = (dev.connectionId || '').toLowerCase();
                const userNameLower = (dev.userName || '').toLowerCase();

                let stats: { total: number; skus: Set<string>; positions: Map<string, number> } | undefined;
                
                for (const [key, val] of countsByDevice.entries()) {
                    if (key === devIdLower || devIdLower.includes(key) || key.includes(devIdLower) ||
                        (connIdLower && (key.startsWith(connIdLower) || connIdLower.startsWith(key.substring(0, 8)))) ||
                        (userNameLower && (key.includes(userNameLower) || userNameLower.includes(key)))) {
                        stats = val;
                        break;
                    }
                }

                const totalScanned = stats ? stats.total : (dev.totalScanned ?? 0);
                const totalSkus = stats ? stats.skus.size : (dev.totalSkus ?? 0);

                // Armar completedSlots desde closedLocationsRef y stats.positions
                const completedSlots: DevicePosition[] = [];
                const seenLocs = new Set<string>();

                if (stats?.positions) {
                    stats.positions.forEach((units, loc) => {
                        const fullLoc = getFullSectorName(loc);
                        const isClosed = closedLocationsRef.current.has(loc.toUpperCase()) || 
                                         closedLocationsRef.current.has(fullLoc.toUpperCase());
                        if (isClosed && !seenLocs.has(fullLoc.toUpperCase())) {
                            seenLocs.add(fullLoc.toUpperCase());
                            completedSlots.push({
                                id: `pos-${loc}`,
                                code: fullLoc,
                                status: 'completed' as const,
                                productsCount: units
                            });
                        }
                    });
                }

                // También incluir sectores cerrados asignados a este dispositivo en precount_location_status
                closedDeviceMapRef.current.forEach((closedDevId, locTag) => {
                    const fullLoc = getFullSectorName(locTag);
                    const matchesDev = closedDevId === dev.id || 
                                       closedDevId === dev.connectionId || 
                                       (dev.userName && (closedDevId.includes(dev.userName) || dev.userName.includes(closedDevId)));
                    if (matchesDev && !seenLocs.has(fullLoc.toUpperCase())) {
                        seenLocs.add(fullLoc.toUpperCase());
                        completedSlots.push({
                            id: `pos-${locTag}`,
                            code: fullLoc,
                            status: 'completed' as const,
                            productsCount: stats?.positions?.get(locTag) || 0
                        });
                    }
                });

                // Si no hay sector actual abierto o el actual fue cerrado:
                const curPositions = dev.positions || [];
                let currentSlot = curPositions.find(p => p.status === 'current' && p.code !== 'Sin sector abierto');
                if (currentSlot) {
                    const isClosed = closedLocationsRef.current.has(currentSlot.code.toUpperCase()) ||
                                     closedLocationsRef.current.has(getFullSectorName(currentSlot.code).toUpperCase());
                    if (isClosed) {
                        currentSlot = undefined;
                    }
                }

                if (!currentSlot) {
                    currentSlot = {
                        id: 'pos-current',
                        code: 'Sin sector abierto',
                        status: 'current' as const,
                        battery: dev.batteryLevel,
                        productsCount: 0
                    };
                }

                const updatedPositions = [
                    currentSlot,
                    ...completedSlots.slice(0, 3)
                ];

                return {
                    ...dev,
                    totalScanned,
                    totalSkus,
                    locationSubtitle: currentSlot.code === 'Sin sector abierto'
                        ? 'Sin sector abierto · Esperando zona'
                        : `${currentSlot.code} · En línea`,
                    positions: updatedPositions
                };
            }));
        };

        const upsertDevice = (dev: any, isHistorical = false) => {
            if (!dev) return;
            const deviceId = dev.deviceId || dev.id;
            if (!deviceId) return;

            // Ocultar la propia PC Monitor de la lista de terminales
            const isSelf = 
                deviceId === currentDeviceId || 
                deviceId.toLowerCase() === currentDeviceId.toLowerCase() ||
                dev.connectionId === currentDeviceId.substring(0, 8).toUpperCase() ||
                (dev.connectionId && currentDeviceId.toUpperCase().includes(dev.connectionId));
            if (isSelf) return;

            if (isHistorical && liveDeviceIds.has(deviceId)) {
                return;
            }

            if (!isHistorical) {
                liveDeviceIds.add(deviceId);
            }

            setDevices(prev => {
                const index = prev.findIndex(d => d.id === deviceId || d.connectionId === deviceId);
                const nameLower = (dev.userName || dev.deviceName || '').toLowerCase();
                const modelLower = (dev.deviceModel || '').toLowerCase();
                const isExplicitNonZebra = nameLower.includes('farmacia') || nameLower.includes('saladillo') || 
                                           nameLower.includes('caja') || nameLower.includes('mostrador') || 
                                           nameLower.includes('pc') || modelLower.includes('pc') || modelLower.includes('notebook');
                const isZebra = !isExplicitNonZebra && (
                    dev.deviceType === 'zebra' || 
                    nameLower.includes('zebra') || nameLower.includes('tc2') || nameLower.includes('tc5') ||
                    modelLower.includes('zebra') || modelLower.includes('tc2') || modelLower.includes('tc5')
                );

                const currentLoc = dev.currentLocation || (dev.positions && dev.positions[0]?.code) || null;
                const cleanLoc = (currentLoc && currentLoc !== 'Salón Principal') ? getFullSectorName(currentLoc) : 'Sin sector abierto';

                let cleanSubtitle = 'Sin sector abierto · Esperando zona';
                const rawSubtitle = dev.locationSubtitle || '';
                if (rawSubtitle && !rawSubtitle.includes('Salón Principal')) {
                    const parts = rawSubtitle.split('·');
                    if (parts.length >= 2) {
                        cleanSubtitle = `${getFullSectorName(parts[0].trim())} · ${parts.slice(1).join('·').trim()}`;
                    } else {
                        cleanSubtitle = getFullSectorName(rawSubtitle);
                    }
                } else if (cleanLoc !== 'Sin sector abierto') {
                    cleanSubtitle = `${cleanLoc} · En línea`;
                }

                const rawPositions = (dev.positions || [
                    { id: 'p1', code: cleanLoc, status: 'current', battery: dev.batteryLevel ?? (isHistorical ? undefined : 100) }
                ]);

                // Sanitizar posiciones contra closedLocationsRef para que NUNCA un sector cerrado aparezca como 'current'
                const sanitizedPositions = rawPositions
                    .filter((p: any) => p.status !== 'pending')
                    .map((p: any) => {
                        const fullCode = getFullSectorName(p.code);
                        const isClosed = closedLocationsRef.current.has(p.code.toUpperCase()) || 
                                         closedLocationsRef.current.has(fullCode.toUpperCase());
                        if (isClosed && p.status === 'current') {
                            return {
                                ...p,
                                code: fullCode,
                                status: 'completed' as const
                            };
                        }
                        return {
                            ...p,
                            code: fullCode
                        };
                    });

                const hasCurrent = sanitizedPositions.some(
                    (p: any) => p.status === 'current' && p.code !== 'Sin sector abierto'
                );

                let currentSlot: DevicePosition;
                if (hasCurrent) {
                    currentSlot = sanitizedPositions.find((p: any) => p.status === 'current' && p.code !== 'Sin sector abierto')!;
                } else {
                    currentSlot = {
                        id: 'pos-current',
                        code: 'Sin sector abierto',
                        status: 'current' as const,
                        battery: dev.batteryLevel ?? (isHistorical ? undefined : 100),
                        productsCount: 0
                    };
                    if (!isHistorical) {
                        cleanSubtitle = 'Sin sector abierto · Esperando zona';
                    }
                }

                const completedSlots = sanitizedPositions.filter(
                    (p: any) => p.status === 'completed' && p.code !== 'Sin sector abierto'
                );

                // Máximo 4 en total: 1 actual + hasta 3 últimos finalizados
                const finalPositions = [
                    currentSlot,
                    ...completedSlots.slice(0, 3)
                ];

                const existingDev = index >= 0 ? prev[index] : null;

                const mappedDevice: MonitoredDevice = {
                    id: deviceId,
                    connectionId: dev.connectionId || deviceId.substring(0, 8).toUpperCase(),
                    userName: dev.userName || dev.deviceName || (isZebra ? 'Zebra TC22' : 'PC Salón 01'),
                    deviceType: isZebra ? 'zebra' : 'pc',
                    deviceModel: dev.deviceModel ? normalizeDeviceModel(dev.deviceModel, isZebra ? 'zebra' : dev.deviceType) : (isHistorical ? '-' : (isZebra ? 'Zebra' : 'PC')),
                    status: dev.status || 'online',
                    locationSubtitle: cleanSubtitle,
                    batteryLevel: dev.batteryLevel ?? (existingDev?.batteryLevel ?? (isHistorical ? undefined : 100)),
                    isCharging: dev.isCharging ?? existingDev?.isCharging,
                    uptime: dev.uptime || existingDev?.uptime || (isHistorical ? '-' : '1m'),
                    totalScanned: dev.totalScanned !== undefined ? dev.totalScanned : (existingDev?.totalScanned ?? 0),
                    totalSkus: dev.totalSkus !== undefined ? dev.totalSkus : (existingDev?.totalSkus ?? 0),
                    ratePerHour: dev.ratePerHour !== undefined ? dev.ratePerHour : (existingDev?.ratePerHour ?? 0),
                    isPendingTelemetry: Boolean(dev.isPendingTelemetry),
                    positions: finalPositions
                };

                // Persistir en memoria y localStorage asociado a esta sesión específica
                globalMonitorCache.set(deviceId, mappedDevice);
                if (activeSessionId && typeof localStorage !== 'undefined') {
                    try {
                        localStorage.setItem(`precount_monitor_cache_${activeSessionId}_${deviceId}`, JSON.stringify(mappedDevice));
                    } catch {}
                }

                if (index >= 0) {
                    const next = [...prev];
                    next[index] = {
                        ...next[index],
                        ...mappedDevice,
                        positions: finalPositions
                    };
                    return next;
                }
                return [...prev, mappedDevice];
            });
        };

        // 1. Cargar terminales guardadas en caché local inmediata de esta sesión
        if (activeSessionId && typeof localStorage !== 'undefined') {
            try {
                const prefix = `precount_monitor_cache_${activeSessionId}_`;
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(prefix) && !k.includes(currentDeviceId)) {
                        const val = localStorage.getItem(k);
                        if (val) {
                            const parsed = JSON.parse(val);
                            const dId = parsed.deviceId || parsed.id;
                            if (dId) {
                                liveDeviceIds.add(dId);
                                upsertDevice(parsed, false);
                            }
                        }
                    }
                }
            } catch {}
        }

        // 2. Sincronizar estado de sectores cerrados desde Dexie y Supabase
        if (activeSessionId) {
            db.locations.where('session_id').equals(activeSessionId).toArray().then(locs => {
                locs.forEach(l => {
                    if (l.status === 'closed') {
                        closedLocationsRef.current.add(l.location_tag.toUpperCase());
                        closedLocationsRef.current.add(getFullSectorName(l.location_tag).toUpperCase());
                    }
                });
                syncDevicePositionsAndStats();
            }).catch(() => {});

            (supabase as any)
                .from('precount_location_status')
                .select('location_tag, status, closed_by_device_id, opened_by_device_id')
                .eq('session_id', activeSessionId)
                .then((locsRes: any) => {
                    if (locsRes?.data) {
                        locsRes.data.forEach((l: any) => {
                            if (l.status === 'closed' && l.location_tag) {
                                closedLocationsRef.current.add(l.location_tag.toUpperCase());
                                closedLocationsRef.current.add(getFullSectorName(l.location_tag).toUpperCase());
                                if (l.closed_by_device_id) {
                                    closedDeviceMapRef.current.set(l.location_tag.toUpperCase(), l.closed_by_device_id);
                                    closedDeviceMapRef.current.set(getFullSectorName(l.location_tag).toUpperCase(), l.closed_by_device_id);
                                }
                            }
                        });
                        syncDevicePositionsAndStats();
                    }
                }).catch(() => {});

            // 3. Consultar terminales conectadas en Supabase (precount_connected_devices)
            (supabase as any)
                .from('precount_connected_devices')
                .select('*')
                .eq('session_id', activeSessionId)
                .then((res: any) => {
                    if (res?.data && Array.isArray(res.data)) {
                        res.data.forEach((row: any) => {
                            const isRecentlyActive = row.last_seen 
                                ? (Date.now() - new Date(row.last_seen).getTime()) < 5 * 60 * 1000 
                                : false;
                            const nameLower = (row.device_name || '').toLowerCase();
                            const modelLower = (row.device_model || '').toLowerCase();
                            const isExplicitNonZebra = nameLower.includes('farmacia') || nameLower.includes('saladillo') || 
                                                       nameLower.includes('caja') || nameLower.includes('mostrador') || 
                                                       nameLower.includes('pc') || modelLower.includes('pc') || modelLower.includes('notebook');
                            const isZebra = !isExplicitNonZebra && (
                                row.device_type === 'zebra' || 
                                nameLower.includes('zebra') || modelLower.includes('zebra') || 
                                nameLower.includes('tc2') || modelLower.includes('tc2')
                            );
                            upsertDevice({
                                id: row.device_id,
                                deviceId: row.device_id,
                                deviceName: row.device_name,
                                userName: row.device_name,
                                deviceType: isZebra ? 'zebra' : (row.device_type || 'pc'),
                                deviceModel: row.device_model || (isZebra ? 'Zebra TC22' : 'PC'),
                                batteryLevel: row.battery_level ?? 100,
                                isCharging: row.is_charging,
                                currentLocation: row.current_location,
                                status: isRecentlyActive ? 'online' : 'offline',
                                uptime: '1m',
                            }, false);
                        });
                        syncDevicePositionsAndStats();
                    }
                }).catch(() => {});

            // 4. Cargar conteos reales exactos escaneados en esta sesión por cada dispositivo
            (supabase as any)
                .from('precount_items')
                .select('id, device_id, device_name, location_tag, quantity, ean')
                .eq('session_id', activeSessionId)
                .then((res: any) => {
                    if (res?.data && Array.isArray(res.data)) {
                        itemsByIdRef.current.clear();
                        res.data.forEach((it: any) => {
                            if (it && it.id) {
                                itemsByIdRef.current.set(it.id, {
                                    id: it.id,
                                    device_id: it.device_id,
                                    location_tag: it.location_tag,
                                    quantity: it.quantity || 0,
                                    ean: it.ean
                                });
                            }
                        });
                        syncDevicePositionsAndStats();
                    }
                }).catch(() => {});
        }

        // 5. Listeners locales
        const handleDeviceJoined = (e: CustomEvent) => {
            if (e.detail?.deviceId) liveDeviceIds.add(e.detail.deviceId);
            upsertDevice(e.detail, false);
        };
        const handleDeviceHeartbeat = (e: CustomEvent) => {
            if (e.detail?.deviceId) liveDeviceIds.add(e.detail.deviceId);
            upsertDevice(e.detail, false);
        };
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key && e.key.startsWith(`precount_monitor_cache_${activeSessionId}_`) && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    if (parsed.deviceId) liveDeviceIds.add(parsed.deviceId);
                    upsertDevice(parsed, false);
                } catch {}
            }
        };

        window.addEventListener('precount:device_joined' as any, handleDeviceJoined);
        window.addEventListener('precount:device_heartbeat' as any, handleDeviceHeartbeat);
        window.addEventListener('storage', handleStorageChange);

        // 6. Suscripción Realtime por WebSockets (Presence + Broadcast + Postgres CDC)
        let channel: any = null;
        if (activeSessionId) {
            const topic = `precount_presence:${activeSessionId}`;
            const existingChannels = supabase.getChannels();
            const existing = existingChannels.find(
                (ch: any) => ch.topic === `realtime:${topic}` || ch.subTopic === topic
            );

            if (existing) {
                try {
                    supabase.removeChannel(existing);
                } catch {}
            }

            channel = supabase.channel(topic, {
                config: {
                    broadcast: { self: true },
                    presence: { key: getDeviceId() }
                }
            });

            channel
                .on('presence', { event: 'sync' }, () => {
                    try {
                        const state = channel.presenceState();
                        const allPresences: any[] = Object.values(state).flat();
                        allPresences.forEach((p: any) => upsertDevice(p));
                    } catch (e) {
                        console.debug('[DeviceMonitor] Error syncing presence state:', e);
                    }
                })
                .on('presence', { event: 'join' }, ({ newPresences }: any) => {
                    newPresences?.forEach((p: any) => upsertDevice(p));
                })
                .on('broadcast', { event: 'device_joined' }, ({ payload }: any) => {
                    if (payload?.deviceId) liveDeviceIds.add(payload.deviceId);
                    upsertDevice(payload, false);
                })
                .on('broadcast', { event: 'device_heartbeat' }, ({ payload }: any) => {
                    if (payload?.deviceId) liveDeviceIds.add(payload.deviceId);
                    upsertDevice(payload, false);
                })
                .on('broadcast', { event: 'sector_status_changed' }, ({ payload }: any) => {
                    if (!payload) return;
                    const targetDevId = payload.device_id;
                    const fullSector = getFullSectorName(payload.location_tag);
                    const closedUnits = payload.units ?? 0;

                    if (payload.status === 'closed') {
                        closedLocationsRef.current.add(payload.location_tag.toUpperCase());
                        closedLocationsRef.current.add(fullSector.toUpperCase());
                    } else if (payload.status === 'open') {
                        closedLocationsRef.current.delete(payload.location_tag.toUpperCase());
                        closedLocationsRef.current.delete(fullSector.toUpperCase());
                    }

                    setDevices(prev => prev.map(dev => {
                        if (!targetDevId || dev.id === targetDevId) {
                            if (payload.status === 'closed') {
                                const otherCompleted = (dev.positions || []).filter(
                                    p => p.status === 'completed' && p.code !== fullSector && p.code !== payload.location_tag && p.code !== 'Sin sector abierto'
                                );

                                const completedList = [
                                    {
                                        id: `pos-${payload.location_tag}`,
                                        code: fullSector,
                                        status: 'completed' as const,
                                        productsCount: closedUnits > 0 ? closedUnits : ((dev.positions || []).find(p => p.code === fullSector)?.productsCount || 0)
                                    },
                                    ...otherCompleted
                                ].slice(0, 3);

                                return {
                                    ...dev,
                                    locationSubtitle: 'Sin sector abierto · Esperando zona',
                                    positions: [
                                        {
                                            id: `pos-${Date.now()}`,
                                            code: 'Sin sector abierto',
                                            status: 'current' as const,
                                            battery: dev.batteryLevel,
                                            productsCount: 0
                                        },
                                        ...completedList
                                    ]
                                };
                            } else if (payload.status === 'open') {
                                const prevPositions = (dev.positions || []).filter(
                                    p => p.code !== fullSector && p.code !== 'Sin sector abierto'
                                );
                                return {
                                    ...dev,
                                    locationSubtitle: `${fullSector} · En línea`,
                                    positions: [
                                        {
                                            id: `pos-${Date.now()}`,
                                            code: fullSector,
                                            status: 'current' as const,
                                            battery: dev.batteryLevel,
                                            productsCount: 0
                                        },
                                        ...prevPositions
                                    ]
                                };
                            }
                        }
                        return dev;
                    }));
                })
                // Escucha de terminales conectadas en tiempo real (Zebra y recolectores)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'precount_connected_devices',
                    filter: `session_id=eq.${activeSessionId}`
                }, (payload: any) => {
                    const row = payload.new || payload.old;
                    if (!row) return;
                    const isRecentlyActive = row.last_seen 
                        ? (Date.now() - new Date(row.last_seen).getTime()) < 5 * 60 * 1000 
                        : false;
                    const nameLower = (row.device_name || '').toLowerCase();
                    const modelLower = (row.device_model || '').toLowerCase();
                    const isExplicitNonZebra = nameLower.includes('farmacia') || nameLower.includes('saladillo') || 
                                               nameLower.includes('caja') || nameLower.includes('mostrador') || 
                                               nameLower.includes('pc') || modelLower.includes('pc') || modelLower.includes('notebook');
                    const isZebra = !isExplicitNonZebra && (
                        row.device_type === 'zebra' || 
                        nameLower.includes('zebra') || modelLower.includes('zebra') || 
                        nameLower.includes('tc2') || modelLower.includes('tc2')
                    );
                    upsertDevice({
                        id: row.device_id,
                        deviceId: row.device_id,
                        deviceName: row.device_name,
                        userName: row.device_name,
                        deviceType: isZebra ? 'zebra' : (row.device_type || 'pc'),
                        deviceModel: row.device_model || (isZebra ? 'Zebra TC22' : 'PC'),
                        batteryLevel: row.battery_level ?? 100,
                        isCharging: row.is_charging,
                        currentLocation: row.current_location,
                        status: isRecentlyActive ? 'online' : 'offline',
                        uptime: '1m',
                    }, false);
                })
                // Escucha de conteos insertados en tiempo real
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'precount_items',
                    filter: `session_id=eq.${activeSessionId}`
                }, (payload: any) => {
                    if (payload.eventType === 'DELETE' && payload.old?.id) {
                        itemsByIdRef.current.delete(payload.old.id);
                        syncDevicePositionsAndStats();
                    } else if (payload.new && payload.new.id) {
                        const newItem = payload.new;
                        itemsByIdRef.current.set(newItem.id, {
                            id: newItem.id,
                            device_id: newItem.device_id,
                            location_tag: newItem.location_tag,
                            quantity: newItem.quantity || 0,
                            ean: newItem.ean
                        });
                        syncDevicePositionsAndStats();
                    }
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'precount_location_status',
                    filter: `session_id=eq.${activeSessionId}`
                }, (payload: any) => {
                    const row = payload.new || payload.old;
                    if (!row || !row.location_tag) return;
                    const fullSector = getFullSectorName(row.location_tag);

                    if (row.status === 'closed') {
                        closedLocationsRef.current.add(row.location_tag.toUpperCase());
                        closedLocationsRef.current.add(fullSector.toUpperCase());
                        if (row.closed_by_device_id) {
                            closedDeviceMapRef.current.set(row.location_tag.toUpperCase(), row.closed_by_device_id);
                            closedDeviceMapRef.current.set(fullSector.toUpperCase(), row.closed_by_device_id);
                        }
                    } else if (row.status === 'open') {
                        closedLocationsRef.current.delete(row.location_tag.toUpperCase());
                        closedLocationsRef.current.delete(fullSector.toUpperCase());
                    }

                    syncDevicePositionsAndStats();
                });

            if (channel.state !== 'joined' && channel.state !== 'joining') {
                channel.subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                        try {
                            const state = channel.presenceState();
                            const allPresences: any[] = Object.values(state).flat();
                            allPresences.forEach((p: any) => upsertDevice(p));
                        } catch {}
                    }
                });
            } else if (channel.state === 'joined') {
                try {
                    const state = channel.presenceState();
                    const allPresences: any[] = Object.values(state).flat();
                    allPresences.forEach((p: any) => upsertDevice(p));
                } catch {}
            }
        }

        const handleSessionDeleted = () => {
            globalMonitorCache.clear();
            setDevices([]);
            purgeStaleDeviceCache(null);
        };
        window.addEventListener('precount:session_deleted' as any, handleSessionDeleted);

        return () => {
            window.removeEventListener('precount:device_joined' as any, handleDeviceJoined);
            window.removeEventListener('precount:device_heartbeat' as any, handleDeviceHeartbeat);
            window.removeEventListener('precount:session_deleted' as any, handleSessionDeleted);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [sessionId]);

    if (!sessionId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground text-xs gap-1.5 text-center">
                <span className="font-semibold text-foreground text-sm">
                    Sin Sesión Activa
                </span>
                <span className="text-muted-foreground text-xs">
                    No hay ninguna sesión de inventario activa en este momento. Inicie o retome una sesión desde la barra superior para ver y monitorear las terminales conectadas en vivo.
                </span>
            </div>
        );
    }

    const visibleDevices = React.useMemo(() => {
        return devices.filter(d => {
            const isSelf = 
                d.id === currentDeviceId || 
                d.id.toLowerCase() === currentDeviceId.toLowerCase() ||
                d.connectionId === currentDeviceId.substring(0, 8).toUpperCase() ||
                (d.connectionId && currentDeviceId.toUpperCase().includes(d.connectionId));
            return !isSelf;
        });
    }, [devices, currentDeviceId]);

    const onlineCount = visibleDevices.filter(d => d.status === 'online').length;
    const totalUnits = visibleDevices.reduce((acc, d) => acc + d.totalScanned, 0);
    const totalSkus = visibleDevices.reduce((acc, d) => acc + d.totalSkus, 0);

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Header / Resumen del Monitor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/20">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-foreground">
                        {visibleDevices.length > 0 
                            ? `Terminales Conectadas (${onlineCount}/${visibleDevices.length} Activas)`
                            : 'Terminales Conectadas (Esperando dispositivos)'}
                    </h2>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div>
                        Total escaneado: <strong className="text-foreground">{totalUnits.toLocaleString('es-AR')} un.</strong>
                    </div>
                    <div className="hidden sm:block h-3.5 w-px bg-border/40" />
                    <div>
                        Variedad: <strong className="text-foreground">{totalSkus} SKUs</strong>
                    </div>
                </div>
            </div>

            {/* Grilla de Dispositivos o Estado Vacío */}
            {visibleDevices.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-8">
                    {visibleDevices.map((device) => (
                        <DeviceCard key={device.id} device={device} />
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-muted-foreground text-xs gap-1.5 text-center">
                    <span className="font-semibold text-foreground text-sm">
                        Esperando conexión de terminales
                    </span>
                    <span className="text-muted-foreground text-xs">
                        No hay terminales conectadas en este momento. Apenas una terminal Zebra TC26 o una PC de mostrador inicie sesión con el PIN de este inventario, aparecerá aquí automáticamente con su telemetría en vivo.
                    </span>
                </div>
            )}
        </div>
    );
}

function DeviceCard({ device }: { device: MonitoredDevice }) {
    const isOnline = device.status === 'online';
    const allPositions = (device.positions || []).filter(pos => pos.status !== 'pending');

    const currentPos = allPositions.find(pos => pos.status === 'current') || {
        id: 'pos-current',
        code: 'Sin sector abierto',
        status: 'current' as const,
        battery: device.batteryLevel,
        productsCount: 0
    };

    const completedPositions = allPositions.filter(
        pos => pos.status === 'completed' && pos.code !== 'Sin sector abierto'
    );

    // Exactamente 4 visibles como máximo: 1 estático actual a la izquierda + hasta 3 últimos finalizados
    const activePositions = device.isPendingTelemetry 
        ? [currentPos]
        : [currentPos, ...completedPositions.slice(0, 3)];

    return (
        <div className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md">
            {/* Recuadro interno superior más claro (Estilo Fluid / Diseño de Referencia) */}
            <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-4 sm:p-5 shadow-xs flex flex-col space-y-4">
                {/* Top Bar: Nombre, Badges, Leyenda y Tipo */}
                <div>
                    <div className="flex items-start justify-between gap-3">
                        {/* Left: Título y Badges */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-bold text-[15px] text-foreground tracking-tight">
                                {device.isPendingTelemetry ? (
                                    <ThinkingIndicator showIcon={false} className="p-0 text-foreground font-bold text-[15px] inline-flex" />
                                ) : (
                                    device.userName
                                )}
                            </h3>

                            {/* Badge ID de conexión (Monocromático) */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-surface-2 text-foreground border border-border/50">
                                {device.connectionId}
                            </span>

                            {/* Badge Online */}
                            <span className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border",
                                isOnline
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40"
                                    : "bg-surface-2 text-muted-foreground border-border/40"
                            )}>
                                <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    isOnline ? "bg-emerald-500" : "bg-muted-foreground"
                                )} />
                                {isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>

                        {/* Right: Tipo de dispositivo */}
                        <div className="text-xs font-semibold text-muted-foreground/75 shrink-0 tracking-tight">
                            {device.isPendingTelemetry || !device.deviceModel || device.deviceModel === '-' ? (
                                <span>-</span>
                            ) : (
                                <span>{normalizeDeviceModel(device.deviceModel, device.deviceType)}</span>
                            )}
                        </div>
                    </div>

                    {/* Leyenda debajo del título */}
                    {device.isPendingTelemetry ? (
                        <div className="mt-1 flex items-center h-4">
                            <ThinkingIndicator showIcon={false} label="Cargando..." className="p-0 text-xs text-muted-foreground" />
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                            {(() => {
                                const sub = device.locationSubtitle || '';
                                const parts = sub.split('·');
                                if (parts.length >= 2) {
                                    return `${getFullSectorName(parts[0].trim())} · ${parts.slice(1).join('·').trim()}`;
                                }
                                return getFullSectorName(sub);
                            })()}
                        </p>
                    )}
                </div>

                {/* Fila de Recuadros (Mini-cards con forma y proporciones originales de referencia) */}
                {activePositions.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {activePositions.map((pos) => {
                            const isCurrent = pos.status === 'current';
                            const isCompleted = pos.status === 'completed';
                            const fullSectorTitle = getFullSectorName(pos.code);

                            return (
                                <div
                                    key={pos.id}
                                    className={cn(
                                        "rounded-[24px] p-3.5 sm:p-4 flex flex-col justify-between h-[142px] transition-all duration-150",
                                        "bg-[#F4F4F6] dark:bg-surface-2"
                                    )}
                                >
                                    {/* Cabecera del sub-recuadro: Nombre posición + Halo Dot alineado ópticamente con la primera línea */}
                                    <div className="flex items-start justify-between gap-1.5 min-w-0">
                                        <span 
                                            className="font-bold text-[15px] sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight leading-[1.15] break-words"
                                            title={fullSectorTitle}
                                        >
                                            {device.isPendingTelemetry ? "-" : fullSectorTitle}
                                        </span>
                                        {isCurrent && (
                                            <span className="w-6 h-6 rounded-full bg-[#D1FADF] dark:bg-emerald-950/80 flex items-center justify-center shrink-0 mt-0.5">
                                                <span className="w-3 h-3 rounded-full bg-[#12B76A]" />
                                            </span>
                                        )}
                                    </div>

                                    {/* Centro: Ícono flotante limpio (SmartphoneIcon para móvil/zebra y MonitorIcon para pc) */}
                                    <div className="flex items-center justify-center py-0.5">
                                        {isCurrent ? (
                                            device.deviceType === 'zebra' ? (
                                                <SmartphoneIcon className="w-9 h-9 stroke-[1.8] text-[#2E90FA] dark:text-blue-400" />
                                            ) : (
                                                <MonitorIcon className="w-9 h-9 stroke-[1.8] text-[#2E90FA] dark:text-blue-400" />
                                            )
                                        ) : (() => {
                                            const SectorIcon = getSectorIcon(pos.code);
                                            if (SectorIcon) {
                                                return (
                                                    <HugeiconsIcon 
                                                        icon={SectorIcon} 
                                                        size={34} 
                                                        strokeWidth={1.8} 
                                                        className="text-zinc-400 dark:text-zinc-500" 
                                                    />
                                                );
                                            }
                                            return <Package className="w-8 h-8 stroke-[1.8] text-zinc-400 dark:text-zinc-500" />;
                                        })()}
                                    </div>

                                    {/* Pie del sub-recuadro: Ícono + Métrica unificada en tamaño y tipografía Inter */}
                                    <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500">
                                        {isCurrent ? (
                                            device.isPendingTelemetry || pos.battery === undefined || pos.battery < 0 ? (
                                                <span className="text-[17px] font-normal tracking-tight leading-none text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                    -
                                                </span>
                                            ) : (
                                                <>
                                                    {renderBatteryIcon(pos.battery ?? device.batteryLevel, device.isCharging)}
                                                    <span className="text-[17px] font-normal tracking-tight leading-none text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                        {pos.battery ?? device.batteryLevel}%
                                                    </span>
                                                </>
                                            )
                                        ) : (
                                            <>
                                                <Package className="w-5 h-5 stroke-[1.8] text-zinc-400 dark:text-zinc-500" />
                                                <span className="text-[17px] font-normal tracking-tight leading-none text-zinc-500 dark:text-zinc-400 tabular-nums">
                                                    {pos.productsCount} un.
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Informativo Inferior (En el recuadro contenedor externo) */}
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground font-medium">
                {/* Left: Horas de inventario, productos y SKUs */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                        {device.isPendingTelemetry || !device.uptime || device.uptime === '-' ? (
                            <span className="text-foreground font-medium">-</span>
                        ) : (
                            <><strong className="text-foreground">{device.uptime}</strong> activo</>
                        )}
                    </span>
                    <span>·</span>
                    <span>
                        <strong className="text-foreground">{device.isPendingTelemetry ? "-" : device.totalScanned.toLocaleString('es-AR')}</strong> un. escaneadas
                    </span>
                    <span>·</span>
                    <span>
                        <strong className="text-foreground">{device.isPendingTelemetry ? "-" : device.totalSkus}</strong> SKUs
                    </span>
                </div>

                {/* Right: Velocidad de escaneo / Rendimiento */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Rendimiento:</span>
                    {device.isPendingTelemetry || !device.ratePerHour ? (
                        <span className="text-foreground font-semibold">-</span>
                    ) : (
                        <strong className="text-foreground font-semibold">{device.ratePerHour} un/h</strong>
                    )}
                </div>
            </div>
        </div>
    );
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

export type ConstructionPageKey =
    | 'inventario-ciclico'
    | 'stock'
    | 'control-vencimiento'
    | 'solicitudes'
    | 'interfarmacias'
    | 'trazabilidad'
    | 'movimientos';

export interface ConstructionPageMeta {
    key: ConstructionPageKey;
    label: string;
    description: string;
}

export const CONSTRUCTION_PAGES_LIST: ConstructionPageMeta[] = [
    {
        key: 'inventario-ciclico',
        label: 'Inventarios Cíclicos',
        description: 'Muestra la pantalla "Inventarios Cíclicos está en construcción" en tiempo real.',
    },
    {
        key: 'stock',
        label: 'Stock y Colector',
        description: 'Muestra la pantalla "Stock está en construcción" en tiempo real.',
    },
    {
        key: 'control-vencimiento',
        label: 'Control de Vencimiento',
        description: 'Muestra la pantalla "Control de Vencimiento está en construcción" en tiempo real.',
    },
    {
        key: 'solicitudes',
        label: 'Solicitudes',
        description: 'Muestra la pantalla "Solicitudes está en construcción" en tiempo real.',
    },
    {
        key: 'interfarmacias',
        label: 'Interfarmacias',
        description: 'Muestra la pantalla "Interfarmacias está en construcción" en tiempo real.',
    },
    {
        key: 'trazabilidad',
        label: 'Trazabilidad',
        description: 'Muestra la pantalla "Trazabilidad está en construcción" en tiempo real.',
    },
    {
        key: 'movimientos',
        label: 'Movimientos',
        description: 'Muestra la pantalla "Movimientos está en construcción" en tiempo real.',
    },
];

export const DEFAULT_CONSTRUCTION_PAGES: Record<ConstructionPageKey, boolean> = {
    'inventario-ciclico': false,
    'stock': false,
    'control-vencimiento': false,
    'solicitudes': false,
    'interfarmacias': true,
    'trazabilidad': true,
    'movimientos': true,
};

export interface SystemModulesConfig {
    /** Sincronización e importación de existencias desde el servidor central Plex / MySQL */
    stockSyncServer: boolean;
    /** Impacto directo de ajustes de inventario a la base de datos de Plex */
    plexDirectAdjustments: boolean;
    /** Detección y alerta automática de nuevos SKUs no registrados */
    autoDetectNewSkus: boolean;
    /** Exportación y descarga local de lotes y planillas de recuento */
    exportBatches: boolean;
    /** Modo Sandbox: Simula exportaciones y escrituras en Plex sin impactar el servidor real */
    sandboxMode: boolean;
    /** Estado "En construcción" por módulo/página sincronizado en tiempo real */
    constructionPages: Record<ConstructionPageKey, boolean>;
}

interface SystemModulesState {
    modules: SystemModulesConfig;
    isRealtimeReady: boolean;
    setModule: (key: Exclude<keyof SystemModulesConfig, 'constructionPages'>, value: boolean) => void;
    toggleModule: (key: Exclude<keyof SystemModulesConfig, 'constructionPages'>) => void;
    setConstructionPage: (pageKey: ConstructionPageKey, value: boolean) => void;
    toggleConstructionPage: (pageKey: ConstructionPageKey) => void;
    applyRemoteConfig: (remote: Partial<SystemModulesConfig>) => void;
    initRealtimeSync: () => void;
    resetToDefaults: () => void;
}

const DEFAULT_MODULES: SystemModulesConfig = {
    stockSyncServer: true,
    plexDirectAdjustments: true,
    autoDetectNewSkus: true,
    exportBatches: true,
    sandboxMode: false,
    constructionPages: { ...DEFAULT_CONSTRUCTION_PAGES },
};

const CONFIG_ROW_VERSION_KEY = '__SYSTEM_MODULES_CONFIG__';
const REALTIME_CHANNEL_NAME = 'system_modules_realtime_sync';

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let isInitializingSync = false;

function normalizeModulesConfig(raw?: Partial<SystemModulesConfig> | null): SystemModulesConfig {
    return {
        stockSyncServer: raw?.stockSyncServer ?? DEFAULT_MODULES.stockSyncServer,
        plexDirectAdjustments: raw?.plexDirectAdjustments ?? DEFAULT_MODULES.plexDirectAdjustments,
        autoDetectNewSkus: raw?.autoDetectNewSkus ?? DEFAULT_MODULES.autoDetectNewSkus,
        exportBatches: raw?.exportBatches ?? DEFAULT_MODULES.exportBatches,
        sandboxMode: false,
        constructionPages: {
            ...DEFAULT_CONSTRUCTION_PAGES,
            ...(raw?.constructionPages || {}),
        },
    };
}

async function persistAndBroadcastModules(nextModules: SystemModulesConfig) {
    // 1. Emitir por Broadcast de Supabase Realtime para impacto instantáneo (<50ms) en todos los clientes conectados
    try {
        if (realtimeChannel) {
            await realtimeChannel.send({
                type: 'broadcast',
                event: 'modules_updated',
                payload: { modules: nextModules, updatedAt: Date.now() },
            });
        }
    } catch (err) {
        console.warn('[SystemModules] Broadcast warning:', err);
    }

    // 2. Persistir en Supabase (tabla `app_versions` con `is_active = false` y `version = '__SYSTEM_MODULES_CONFIG__'`)
    //    Esto dispara además `postgres_changes` a todos los clientes y guarda el estado para quienes entren después.
    try {
        const serialized = JSON.stringify(nextModules);
        const { data: existing } = await supabase
            .from('app_versions')
            .select('id')
            .eq('version', CONFIG_ROW_VERSION_KEY)
            .maybeSingle();

        if (existing?.id) {
            await supabase
                .from('app_versions')
                .update({
                    release_notes: serialized,
                    is_active: false,
                    published_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('app_versions')
                .insert({
                    version: CONFIG_ROW_VERSION_KEY,
                    release_notes: serialized,
                    is_active: false,
                    published_at: new Date().toISOString(),
                });
        }
    } catch (err) {
        console.warn('[SystemModules] Error persisting modules config to Supabase:', err);
    }
}

export const useSystemModules = create<SystemModulesState>()(
    persist(
        (set, get) => ({
            modules: DEFAULT_MODULES,
            isRealtimeReady: false,

            setModule: (key, value) => {
                const nextModules = normalizeModulesConfig({
                    ...get().modules,
                    [key]: value,
                });
                set({ modules: nextModules });
                void persistAndBroadcastModules(nextModules);
            },

            toggleModule: (key) => {
                const current = get().modules[key];
                const nextModules = normalizeModulesConfig({
                    ...get().modules,
                    [key]: !current,
                });
                set({ modules: nextModules });
                void persistAndBroadcastModules(nextModules);
            },

            setConstructionPage: (pageKey, value) => {
                const currentPages = get().modules.constructionPages || DEFAULT_CONSTRUCTION_PAGES;
                const nextModules = normalizeModulesConfig({
                    ...get().modules,
                    constructionPages: {
                        ...currentPages,
                        [pageKey]: value,
                    },
                });
                set({ modules: nextModules });
                void persistAndBroadcastModules(nextModules);
            },

            toggleConstructionPage: (pageKey) => {
                const currentPages = get().modules.constructionPages || DEFAULT_CONSTRUCTION_PAGES;
                const currentVal = currentPages[pageKey] ?? DEFAULT_CONSTRUCTION_PAGES[pageKey];
                const nextModules = normalizeModulesConfig({
                    ...get().modules,
                    constructionPages: {
                        ...currentPages,
                        [pageKey]: !currentVal,
                    },
                });
                set({ modules: nextModules });
                void persistAndBroadcastModules(nextModules);
            },

            applyRemoteConfig: (remote) => {
                const nextModules = normalizeModulesConfig(remote);
                set({ modules: nextModules });
            },

            initRealtimeSync: () => {
                if (realtimeChannel || isInitializingSync) return;
                isInitializingSync = true;

                // 1. Cargar configuración actual desde Supabase al iniciar
                void (async () => {
                    try {
                        const { data, error } = await supabase
                            .from('app_versions')
                            .select('release_notes')
                            .eq('version', CONFIG_ROW_VERSION_KEY)
                            .maybeSingle();

                        if (!error && data?.release_notes) {
                            const parsed = JSON.parse(data.release_notes) as Partial<SystemModulesConfig>;
                            get().applyRemoteConfig(parsed);
                        }
                    } catch (err) {
                        console.warn('[SystemModules] Initial fetch warning:', err);
                    } finally {
                        isInitializingSync = false;
                    }
                })();

                // 2. Sincronización instantánea entre pestañas del mismo navegador
                if (typeof window !== 'undefined') {
                    window.addEventListener('storage', (e) => {
                        if (e.key === 'farmaplus-system-modules' && e.newValue) {
                            try {
                                const parsed = JSON.parse(e.newValue);
                                if (parsed?.state?.modules) {
                                    get().applyRemoteConfig(parsed.state.modules);
                                }
                            } catch {
                                // ignore malformed storage payload
                            }
                        }
                    });
                }

                // 3. Suscripción en tiempo real (Broadcast + Postgres Changes)
                realtimeChannel = supabase
                    .channel(REALTIME_CHANNEL_NAME, {
                        config: {
                            broadcast: { self: true },
                        },
                    })
                    .on('broadcast', { event: 'modules_updated' }, ({ payload }) => {
                        if (payload?.modules) {
                            get().applyRemoteConfig(payload.modules as Partial<SystemModulesConfig>);
                        }
                    })
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'app_versions',
                        },
                        (payload) => {
                            const row = payload.new as { version?: string; release_notes?: string | null } | undefined;
                            if (row?.version === CONFIG_ROW_VERSION_KEY && row.release_notes) {
                                try {
                                    const parsed = JSON.parse(row.release_notes) as Partial<SystemModulesConfig>;
                                    get().applyRemoteConfig(parsed);
                                } catch (e) {
                                    console.warn('[SystemModules] Error parsing realtime payload:', e);
                                }
                            }
                        }
                    )
                    .subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            set({ isRealtimeReady: true });
                        }
                    });
            },

            resetToDefaults: () => {
                set({ modules: DEFAULT_MODULES });
                void persistAndBroadcastModules(DEFAULT_MODULES);
            },
        }),
        {
            name: 'farmaplus-system-modules',
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<SystemModulesState> | undefined;
                return {
                    ...currentState,
                    modules: normalizeModulesConfig(persisted?.modules),
                };
            },
        }
    )
);

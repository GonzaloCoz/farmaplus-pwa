import { db, PendingAction } from './db';
import { supabase } from '@/integrations/supabase/client';
import { auditService } from './auditService';
import {
    chunkArray,
    computeBackoffMs,
    getErrorMessage,
    isNetworkOnline,
    isPermanentDbError,
    isTransientError,
    registerReconnectWakeup
} from './supabaseHelpers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id?: unknown): id is string {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

function isClosedLocationError(error: unknown): boolean {
    const msg = getErrorMessage(error).toLowerCase();
    return msg.includes('se encuentra cerrada') || msg.includes('cerrada para esta sesi');
}

function toCleanItemPayload(raw: any) {
    return {
        id: raw.id,
        session_id: raw.session_id,
        ean: raw.ean,
        product_name: raw.product_name,
        quantity: raw.quantity,
        scanned_by: isValidUUID(raw.scanned_by) ? raw.scanned_by : null,
        id_producto: raw.id_producto || null,
        device_id: raw.device_id || null,
        device_name: raw.device_name || null,
        location_tag: raw.location_tag || null
    };
}

export class SyncManager {
    private isSyncing = false;
    private needsRescan = false;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private recurringInterval: ReturnType<typeof setInterval> | null = null;
    private backoffTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingItemCount = 0;
    private autoSaveEnabled = true;
    private enqueueMutex: Promise<void> = Promise.resolve();
    private cleanupConnectivity?: () => void;

    // Timing constants: micro-batching para latencia cercana a 0 y recuperación continua
    private readonly DEBOUNCE_INTERVAL_MS = 300;
    private readonly MAX_BATCH_THRESHOLD = 15;
    private readonly RECURRING_INTERVAL_MS = 10000;
    private readonly SLOW_BATCH_THRESHOLD_MS = 1500;
    private readonly STALE_SYNCING_MS = 30000;
    private readonly MAX_OTHER_CONCURRENCY = 4;

    constructor() {
        if (typeof window !== 'undefined') {
            this.cleanupConnectivity = registerReconnectWakeup(() => {
                void this.onConnectivityRestored();
            });

            window.addEventListener('offline', () => {
                console.log('[SyncManager] Dispositivo sin conexión. Operaciones resguardadas en cola local.');
                void this.emitCurrentPendingCount();
            });

            const flushOnExit = () => {
                void this.flushNow();
            };
            window.addEventListener('beforeunload', flushOnExit);
            window.addEventListener('pagehide', flushOnExit);

            // Recuperar acciones que hayan quedado en 'syncing' por cierre abrupto de pestaña/app
            void this.recoverStuckSyncingActions(true).then(() => {
                if (this.autoSaveEnabled && isNetworkOnline()) {
                    void this.processQueue();
                }
            });

            // Barrido periódico de autoguardado y reintentos con backoff cumplido
            this.recurringInterval = setInterval(() => {
                if (this.autoSaveEnabled && isNetworkOnline() && !this.isSyncing) {
                    void this.processQueue();
                }
            }, this.RECURRING_INTERVAL_MS);
        }
    }

    /**
     * Activa o desactiva el autoguardado automático periódico hacia Supabase.
     */
    public setAutoSaveEnabled(enabled: boolean) {
        this.autoSaveEnabled = enabled;
        if (enabled && isNetworkOnline()) {
            void this.processQueue();
        }
    }

    /**
     * Libera timers y listeners (útil para desmontaje limpio en tests o reinicios).
     */
    public dispose() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.recurringInterval) clearInterval(this.recurringInterval);
        if (this.backoffTimer) clearTimeout(this.backoffTimer);
        this.cleanupConnectivity?.();
    }

    /**
     * Devuelve la cantidad de acciones recuperables actualmente pendientes/fallidas.
     */
    public async getPendingCount(): Promise<number> {
        try {
            return await db.pendingActions
                .where('status')
                .anyOf('pending', 'failed', 'syncing')
                .filter(a => !a.permanentError)
                .count();
        } catch {
            return 0;
        }
    }

    /**
     * Emite un evento en el DOM para que los componentes UI muestren estado de sincronización.
     */
    private emitSyncStatus(isSyncing: boolean, pendingCount: number, latencyMs?: number) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('precount:sync_status', {
                detail: { isSyncing, pendingCount, latencyMs, timestamp: Date.now() }
            }));
        }
    }

    private async emitCurrentPendingCount(latencyMs?: number) {
        const count = await this.getPendingCount();
        this.emitSyncStatus(this.isSyncing, count, latencyMs);
    }

    /**
     * Al recuperar red/visibilidad/foco, limpia esperas de backoff en errores transitorios y dispara la cola.
     */
    public async onConnectivityRestored(): Promise<void> {
        try {
            await this.recoverStuckSyncingActions(false);
            await db.pendingActions
                .where('status')
                .equals('failed')
                .filter(a => !a.permanentError)
                .modify({
                    nextRetryAt: 0,
                    status: 'pending'
                });
        } catch (err) {
            console.warn('[SyncManager] Error preparando reintentos tras reconexión:', err);
        }
        await this.flushNow();
    }

    /**
     * Reintenta manualmente todas las acciones fallidas no permanentes.
     */
    public async retryAllFailed(): Promise<void> {
        await db.pendingActions
            .where('status')
            .equals('failed')
            .filter(a => !a.permanentError)
            .modify({
                retries: 0,
                nextRetryAt: 0,
                status: 'pending',
                error: undefined
            });
        await this.flushNow();
    }

    /**
     * Recupera filas atascadas en 'syncing' (por cierre inesperado o timeout).
     * Marca un flag en creates de ítems para verificar existencia previa y evitar doble conteo.
     */
    private async recoverStuckSyncingActions(recoverAllSyncing: boolean): Promise<void> {
        try {
            const cutoff = Date.now() - this.STALE_SYNCING_MS;
            const syncingRows = await db.pendingActions.where('status').equals('syncing').toArray();
            for (const row of syncingRows) {
                if (!row.id) continue;
                const isStale = recoverAllSyncing || !row.lastAttemptAt || row.lastAttemptAt < cutoff;
                if (!isStale) continue;

                const nextData = (row.entity === 'item' && row.type === 'create')
                    ? { ...(row.data || {}), _checkExistsBeforeCreate: true }
                    : row.data;

                await db.pendingActions.update(row.id, {
                    status: 'pending',
                    data: nextData,
                    nextRetryAt: 0
                });
            }
        } catch (err) {
            console.warn('[SyncManager] Error recuperando acciones syncing:', err);
        }
    }

    private computeDedupeKey(action: Omit<PendingAction, 'id' | 'status' | 'timestamp' | 'retries'>): string | undefined {
        if (action.dedupeKey) return action.dedupeKey;
        const d = action.data || {};
        if (action.entity === 'item' && d.id) return `item:${d.id}`;
        if (action.entity === 'session') {
            if (d.action === 'toggle_location' && d.session_id && d.location_tag) {
                return `location:${d.session_id}:${String(d.location_tag).trim().toUpperCase()}`;
            }
            if (d.id) return `session:${d.id}`;
        }
        if (action.entity === 'location' && d.session_id && d.location_tag) {
            return `location:${d.session_id}:${String(d.location_tag).trim().toUpperCase()}`;
        }
        if (action.entity === 'device_file' && d.session_id && d.filename) {
            return `device_file:${d.session_id}:${d.filename}`;
        }
        if (action.entity === 'serial' && d.session_id) {
            return `serial:${d.session_id}:${d.id_producto || ''}:${d.serial || d.gtin || d.raw_datamatrix || ''}`;
        }
        if (action.entity === 'batch_export') {
            return `batch_export:${d.sessionId || ''}:${d.fileName || ''}`;
        }
        return undefined;
    }

    private async enqueueWithCoalescing(
        action: Omit<PendingAction, 'id' | 'status' | 'timestamp' | 'retries'>
    ): Promise<void> {
        const now = Date.now();
        const dedupeKey = this.computeDedupeKey(action);

        // Si se elimina una sesión completa, purgar acciones pendientes huérfanas de esa sesión
        if (action.entity === 'session' && action.type === 'delete' && action.data?.id) {
            const targetSessionId = action.data.id;
            const orphaned = await db.pendingActions
                .filter(a => a.status !== 'syncing' && (a.data?.session_id === targetSessionId || a.data?.sessionId === targetSessionId))
                .toArray();
            const orphanIds = orphaned.map(a => a.id!).filter(Boolean);
            if (orphanIds.length > 0) {
                await db.pendingActions.bulkDelete(orphanIds);
            }
        }

        if (dedupeKey) {
            const existingList = await db.pendingActions
                .where('dedupeKey')
                .equals(dedupeKey)
                .filter(a => a.status !== 'syncing')
                .toArray();

            // Respaldo para filas heredadas de schema v11 sin dedupeKey
            if (existingList.length === 0 && action.entity === 'item' && action.data?.id) {
                const legacyMatches = await db.pendingActions
                    .where('entity')
                    .equals('item')
                    .filter(a => a.status !== 'syncing' && a.data?.id === action.data.id)
                    .toArray();
                existingList.push(...legacyMatches);
            }

            if (action.entity === 'item' && action.data?.id) {
                const unsentCreates = existingList.filter(a => a.type === 'create');
                const unsentUpdates = existingList.filter(a => a.type === 'update');

                if (action.type === 'delete') {
                    const removableIds = existingList.map(a => a.id!).filter(Boolean);
                    if (removableIds.length > 0) {
                        await db.pendingActions.bulkDelete(removableIds);
                    }
                    const inflightCreate = await db.pendingActions
                        .where('entity')
                        .equals('item')
                        .filter(a => a.status === 'syncing' && a.data?.id === action.data.id)
                        .count();

                    // Si solo había un 'create' local nunca enviado y nada en vuelo, no hace falta borrar en remoto
                    if (unsentCreates.length > 0 && inflightCreate === 0 && action.data._skipRemoteIfNeverSynced !== false) {
                        return;
                    }
                    await db.pendingActions.add({
                        ...action,
                        dedupeKey,
                        status: 'pending',
                        timestamp: now,
                        retries: 0
                    });
                    return;
                }

                if (unsentCreates.length > 0) {
                    const primaryCreate = unsentCreates[0];
                    const mergedData = { ...(primaryCreate.data || {}), ...(action.data || {}) };
                    await db.pendingActions.update(primaryCreate.id!, {
                        data: mergedData,
                        timestamp: now,
                        status: 'pending',
                        retries: 0,
                        error: undefined,
                        nextRetryAt: undefined,
                        permanentError: false,
                        dedupeKey
                    });
                    // Limpiar actualizaciones redundantes del mismo ítem
                    const redundantIds = [
                        ...unsentCreates.slice(1).map(a => a.id!),
                        ...unsentUpdates.map(a => a.id!)
                    ].filter(Boolean);
                    if (redundantIds.length > 0) {
                        await db.pendingActions.bulkDelete(redundantIds);
                    }
                    return;
                }

                if (action.type === 'update' && unsentUpdates.length > 0) {
                    const primaryUpdate = unsentUpdates[0];
                    await db.pendingActions.update(primaryUpdate.id!, {
                        data: { ...(primaryUpdate.data || {}), ...(action.data || {}) },
                        timestamp: now,
                        status: 'pending',
                        retries: 0,
                        error: undefined,
                        nextRetryAt: undefined,
                        permanentError: false,
                        dedupeKey
                    });
                    const extraIds = unsentUpdates.slice(1).map(a => a.id!).filter(Boolean);
                    if (extraIds.length > 0) {
                        await db.pendingActions.bulkDelete(extraIds);
                    }
                    return;
                }
            } else if (existingList.length > 0) {
                const target = existingList[existingList.length - 1];
                const mergedData = (action.type === 'delete')
                    ? action.data
                    : { ...(target.data || {}), ...(action.data || {}) };

                await db.pendingActions.update(target.id!, {
                    type: action.type,
                    entity: action.entity,
                    data: mergedData,
                    timestamp: now,
                    status: 'pending',
                    retries: 0,
                    error: undefined,
                    nextRetryAt: undefined,
                    permanentError: false,
                    dedupeKey
                });
                const duplicateIds = existingList.slice(0, -1).map(a => a.id!).filter(Boolean);
                if (duplicateIds.length > 0) {
                    await db.pendingActions.bulkDelete(duplicateIds);
                }
                return;
            }
        }

        await db.pendingActions.add({
            ...action,
            dedupeKey,
            status: 'pending',
            timestamp: now,
            retries: 0
        });
    }

    async addToQueue(
        action: Omit<PendingAction, 'id' | 'status' | 'timestamp' | 'retries'>,
        options?: { skipFlush?: boolean }
    ) {
        const task = this.enqueueMutex.then(() => this.enqueueWithCoalescing(action));
        this.enqueueMutex = task.catch(() => {});
        await task;

        void this.emitCurrentPendingCount();

        if (options?.skipFlush) {
            return;
        }

        // 1. Acciones críticas, archivos, ubicaciones o ediciones/borrados -> sincronizar de inmediato
        if (action.entity !== 'item' || action.type === 'update' || action.type === 'delete') {
            if (isNetworkOnline()) {
                void this.processQueue();
            }
            return;
        }

        // 2. Si el usuario desactivó el autoguardado en ajustes, solo persistir en disco local
        if (!this.autoSaveEnabled) {
            return;
        }

        // 3. Escaneo de productos: micro-batching (máximo 15 ítems o 300ms de debounce)
        this.pendingItemCount++;

        if (this.pendingItemCount >= this.MAX_BATCH_THRESHOLD) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            this.pendingItemCount = 0;
            if (isNetworkOnline()) {
                void this.processQueue();
            }
            return;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.pendingItemCount = 0;
            this.debounceTimer = null;
            if (isNetworkOnline()) {
                void this.processQueue();
            }
        }, this.DEBOUNCE_INTERVAL_MS);
    }

    /**
     * Fuerza el vaciado inmediato de la cola a Supabase (ej: al cerrar zona, salir o reconectar).
     */
    async flushNow(): Promise<void> {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingItemCount = 0;
        if (isNetworkOnline()) {
            await this.processQueue({ ignoreBackoff: true });
        }
    }

    private scheduleNextBackoffWakeup(delayMs: number) {
        if (this.backoffTimer) {
            clearTimeout(this.backoffTimer);
        }
        const boundedDelay = Math.max(1000, Math.min(delayMs, 60000));
        this.backoffTimer = setTimeout(() => {
            this.backoffTimer = null;
            if (this.autoSaveEnabled && isNetworkOnline() && !this.isSyncing) {
                void this.processQueue();
            }
        }, boundedDelay);
    }

    private async markActionFailed(action: PendingAction, error: unknown): Promise<number | null> {
        if (!action.id) return null;
        const offline = !isNetworkOnline();
        if (offline || isTransientError(error)) {
            const nextRetries = (action.retries || 0) + (offline ? 0 : 1);
            const backoffMs = offline ? 0 : computeBackoffMs(nextRetries - 1, 1000, 60000);
            const nextRetryAt = offline ? 0 : Date.now() + backoffMs;
            await db.pendingActions.update(action.id, {
                status: offline ? 'pending' : 'failed',
                retries: nextRetries,
                nextRetryAt,
                permanentError: false,
                error: getErrorMessage(error)
            });
            return offline ? null : backoffMs;
        }

        const isPerm = isPermanentDbError(error) || isClosedLocationError(error);
        const nextRetries = (action.retries || 0) + 1;
        const backoffMs = isPerm ? 0 : computeBackoffMs(nextRetries - 1, 2000, 60000);
        await db.pendingActions.update(action.id, {
            status: 'failed',
            retries: nextRetries,
            nextRetryAt: isPerm ? undefined : Date.now() + backoffMs,
            permanentError: isPerm,
            error: getErrorMessage(error)
        });
        return isPerm ? null : backoffMs;
    }

    async processQueue(options?: { ignoreBackoff?: boolean }): Promise<void> {
        if (!isNetworkOnline()) {
            await this.emitCurrentPendingCount();
            return;
        }
        if (this.isSyncing) {
            this.needsRescan = true;
            return;
        }

        this.isSyncing = true;
        this.needsRescan = false;
        let lastBatchLatencyMs: number | undefined;
        let earliestRetryDelayMs: number | null = null;

        const recordRetryDelay = (delay: number | null) => {
            if (delay !== null && delay > 0) {
                earliestRetryDelayMs = earliestRetryDelayMs === null ? delay : Math.min(earliestRetryDelayMs, delay);
            }
        };

        try {
            // Esperar a que termine cualquier encolamiento concurrente
            await this.enqueueMutex;
            await this.recoverStuckSyncingActions(false);

            const now = Date.now();
            const allPending = await db.pendingActions
                .where('status')
                .anyOf('pending', 'failed')
                .sortBy('timestamp');

            const pendingActions = allPending.filter(a => {
                if (a.permanentError) return false;
                if (options?.ignoreBackoff) return true;
                return !a.nextRetryAt || a.nextRetryAt <= now;
            });

            if (pendingActions.length === 0) {
                return;
            }

            this.emitSyncStatus(true, allPending.filter(a => !a.permanentError).length);

            const sessionMutations: PendingAction[] = [];
            const itemUpserts: PendingAction[] = [];
            const otherActions: PendingAction[] = [];

            for (const action of pendingActions) {
                if (action.entity === 'session' && action.type !== 'delete' && action.data?.action !== 'toggle_location') {
                    sessionMutations.push(action);
                } else if (action.entity === 'item' && action.type === 'create') {
                    itemUpserts.push(action);
                } else {
                    otherActions.push(action);
                }
            }

            // 0. Sincronizar primero sesiones nuevas/actualizadas para evitar errores FK en ítems/archivos hijos
            for (const action of sessionMutations) {
                if (!action.id || !isNetworkOnline()) break;
                await db.pendingActions.update(action.id, { status: 'syncing', lastAttemptAt: Date.now() });
                try {
                    await this.executeAction(action);
                    if (action.data?.id) {
                        await db.sessions.update(action.data.id, { synced: 1 });
                    }
                    await db.pendingActions.delete(action.id);
                } catch (error: any) {
                    console.error('[SyncManager] Session sync failed:', error);
                    if (error?.code === '23505' || error?.status === 409) {
                        if (action.data?.id) {
                            await db.sessions.update(action.data.id, { synced: 1 });
                        }
                        await db.pendingActions.delete(action.id);
                        continue;
                    }
                    recordRetryDelay(await this.markActionFailed(action, error));
                }
            }

            // 1. Procesar lotes idempotentes de ítems nuevos
            if (itemUpserts.length > 0 && isNetworkOnline()) {
                const BATCH_SIZE = 50;
                const batches = chunkArray(itemUpserts, BATCH_SIZE);

                for (let bIdx = 0; bIdx < batches.length; bIdx++) {
                    if (!isNetworkOnline()) break;

                    const currentBatch = batches[bIdx];
                    const batchIds = currentBatch.map(a => a.id!).filter(Boolean);
                    await db.pendingActions.where('id').anyOf(batchIds).modify({
                        status: 'syncing',
                        lastAttemptAt: Date.now()
                    });

                    const startMs = performance.now();

                    try {
                        const requiresIdempotencyCheck = currentBatch.some(
                            a => (a.retries || 0) > 0 || Boolean(a.data?._checkExistsBeforeCreate)
                        );
                        const batchItemUuids = currentBatch.map(a => a.data?.id).filter(isValidUUID);
                        let existingRemoteIds = new Set<string>();

                        if (requiresIdempotencyCheck && batchItemUuids.length > 0) {
                            const { data: existingRows, error: checkErr } = await supabase
                                .from('precount_items')
                                .select('id')
                                .in('id', batchItemUuids);
                            if (checkErr) throw checkErr;
                            existingRemoteIds = new Set((existingRows || []).map((r: any) => r.id));
                        }

                        const itemsToOverwrite: any[] = [];
                        const itemsToInsertViaRpc: any[] = [];

                        for (const action of currentBatch) {
                            const cleaned = toCleanItemPayload(action.data);
                            if (existingRemoteIds.has(cleaned.id)) {
                                itemsToOverwrite.push(cleaned);
                            } else {
                                itemsToInsertViaRpc.push(cleaned);
                            }
                        }

                        if (itemsToOverwrite.length > 0) {
                            const { error: upsertErr } = await supabase
                                .from('precount_items')
                                .upsert(itemsToOverwrite, { onConflict: 'id' });
                            if (upsertErr) throw upsertErr;
                        }

                        if (itemsToInsertViaRpc.length > 0) {
                            const { error: rpcErr } = await (supabase as any).rpc('batch_upsert_precount_items', {
                                p_items: itemsToInsertViaRpc
                            });
                            if (rpcErr) throw rpcErr;
                        }

                        const durationMs = Math.round(performance.now() - startMs);
                        lastBatchLatencyMs = durationMs;

                        const localItemIds = currentBatch.map(a => a.data?.id).filter(Boolean);
                        if (localItemIds.length > 0) {
                            await db.items.where('id').anyOf(localItemIds).modify({ synced: 1 });
                        }
                        await db.pendingActions.where('id').anyOf(batchIds).delete();

                        if (durationMs >= this.SLOW_BATCH_THRESHOLD_MS) {
                            console.warn(`[SyncManager][REA] Lote lento detectado: ${durationMs}ms para ${currentBatch.length} ítems`);
                            auditService.logAction({
                                action: 'SYNC_BATCH_SLOW',
                                entityType: 'SYSTEM',
                                details: {
                                    batchSize: currentBatch.length,
                                    latencyMs: durationMs,
                                    deviceName: currentBatch[0]?.data?.device_name || 'Terminal',
                                    sessionId: currentBatch[0]?.data?.session_id
                                }
                            }).catch(() => {});
                        }
                    } catch (error: any) {
                        const durationMs = Math.round(performance.now() - startMs);
                        console.error(`Batch sync failed (${error?.status || 'unknown'}) after ${durationMs}ms:`, error);

                        if (!isNetworkOnline() || isTransientError(error)) {
                            for (const action of currentBatch) {
                                recordRetryDelay(await this.markActionFailed(action, error));
                            }
                            break;
                        }

                        auditService.logAction({
                            action: 'SYNC_QUEUE_ERROR',
                            entityType: 'SYSTEM',
                            details: {
                                batchSize: currentBatch.length,
                                latencyMs: durationMs,
                                error: getErrorMessage(error),
                                deviceName: currentBatch[0]?.data?.device_name || 'Terminal'
                            }
                        }).catch(() => {});

                        // Aislamiento fila a fila solo cuando el fallo NO es de red (ej. sector cerrado puntual)
                        for (const action of currentBatch) {
                            if (!isNetworkOnline()) {
                                if (action.id) {
                                    await db.pendingActions.update(action.id, { status: 'pending' });
                                }
                                continue;
                            }
                            try {
                                await this.executeAction(action);
                                if (action.id) await db.pendingActions.delete(action.id);
                                if (action.data?.id) await db.items.update(action.data.id, { synced: 1 });
                            } catch (indError: any) {
                                console.error(`[SyncManager] Individual item sync failed for ${action.data?.ean}:`, indError);
                                recordRetryDelay(await this.markActionFailed(action, indError));
                                if (!isNetworkOnline() || isTransientError(indError)) {
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // 2. Procesar acciones restantes con concurrencia acotada
            if (otherActions.length > 0 && isNetworkOnline()) {
                const groups = chunkArray(otherActions, this.MAX_OTHER_CONCURRENCY);
                for (const group of groups) {
                    if (!isNetworkOnline()) break;

                    await Promise.all(group.map(async (action) => {
                        if (!action.id || !isNetworkOnline()) return;
                        await db.pendingActions.update(action.id, {
                            status: 'syncing',
                            lastAttemptAt: Date.now()
                        });
                        try {
                            await this.executeAction(action);
                            if (action.entity === 'session' && action.data?.id && action.type !== 'delete') {
                                await db.sessions.update(action.data.id, { synced: 1 });
                            } else if (action.entity === 'item' && action.data?.id && action.type !== 'delete') {
                                await db.items.update(action.data.id, { synced: 1 });
                            }
                            await db.pendingActions.delete(action.id);
                        } catch (error: any) {
                            console.error('[SyncManager] Action sync failed:', error);
                            if (action.entity === 'session' && (error?.code === '23505' || error?.status === 409)) {
                                if (action.data?.id) {
                                    await db.sessions.update(action.data.id, { synced: 1 });
                                }
                                await db.pendingActions.delete(action.id);
                                return;
                            }
                            recordRetryDelay(await this.markActionFailed(action, error));
                        }
                    }));
                }
            }
        } finally {
            this.isSyncing = false;
            const remaining = await this.getPendingCount();
            this.emitSyncStatus(false, remaining, lastBatchLatencyMs);

            if (this.needsRescan && isNetworkOnline()) {
                this.needsRescan = false;
                queueMicrotask(() => {
                    void this.processQueue();
                });
            } else if (earliestRetryDelayMs !== null && isNetworkOnline()) {
                this.scheduleNextBackoffWakeup(earliestRetryDelayMs);
            }
        }
    }

    private async executeItemCreateIdempotent(data: any) {
        const cleaned = toCleanItemPayload(data);
        if ((data?._checkExistsBeforeCreate || data?._preferDirectUpsert) && isValidUUID(cleaned.id)) {
            const { data: existing, error: selectErr } = await supabase
                .from('precount_items')
                .select('id')
                .eq('id', cleaned.id)
                .maybeSingle();
            if (selectErr) throw selectErr;
            if (existing?.id) {
                const { error: upsertErr } = await (supabase as any)
                    .from('precount_items')
                    .upsert(cleaned, { onConflict: 'id' });
                if (upsertErr) throw upsertErr;
                return;
            }
        }

        const { error } = await (supabase as any).rpc('upsert_precount_item', {
            p_id: cleaned.id,
            p_session_id: cleaned.session_id,
            p_ean: cleaned.ean,
            p_product_name: cleaned.product_name,
            p_quantity: cleaned.quantity,
            p_user_id: cleaned.scanned_by,
            p_id_producto: cleaned.id_producto,
            p_device_id: cleaned.device_id,
            p_device_name: cleaned.device_name,
            p_location_tag: cleaned.location_tag
        });
        if (error) throw error;
    }

    private async executeLocationAction(data: any) {
        const sessionId = data.session_id;
        const normTag = String(data.location_tag || '').trim().toUpperCase();
        const status = data.status === 'closed' ? 'closed' : 'open';
        const userName = data.user_name || data.operator_name || data.device_name || 'Operador';
        const deviceId = data.device_id || null;
        const deviceName = data.device_name || 'Terminal';

        if (!sessionId || !normTag) return;

        const rpcName = status === 'closed' ? 'close_precount_location' : 'claim_or_validate_location';
        const { error } = await (supabase as any).rpc(rpcName, {
            p_session_id: sessionId,
            p_location_tag: normTag,
            p_user_name: userName,
            p_device_id: deviceId,
            p_device_name: deviceName
        });

        if (!error) return;

        const code = String((error as any).code || '');
        const msg = getErrorMessage(error).toLowerCase();
        // Fallback solo si el RPC nuevo no existe en esta instancia
        if (code === 'PGRST202' || code === '42883' || msg.includes('could not find the function')) {
            const { error: fbErr } = await (supabase as any).rpc('toggle_precount_location', {
                p_session_id: sessionId,
                p_location_tag: normTag,
                p_status: status
            });
            if (fbErr) throw fbErr;
            return;
        }
        throw error;
    }

    private async executeDeviceFileUpsert(data: any) {
        const { replaceBySessionAndFilename, ...rawPayload } = data || {};
        if (!rawPayload.session_id || !rawPayload.filename) {
            throw new Error('device_file requiere session_id y filename');
        }

        const shouldReplace = replaceBySessionAndFilename !== false;
        if (shouldReplace) {
            const { error: delErr } = await (supabase as any)
                .from('precount_device_files')
                .delete()
                .eq('session_id', rawPayload.session_id)
                .eq('filename', rawPayload.filename);
            if (delErr) throw delErr;
        }

        const { error: insErr } = await (supabase as any)
            .from('precount_device_files')
            .insert(rawPayload);
        if (insErr) throw insErr;
    }

    private async executeBatchExportAction(data: any) {
        const {
            sessionId,
            itemsToUpsert = [],
            deviceFileRow,
            auditLogPayload,
            notificationPayload
        } = data || {};

        if (Array.isArray(itemsToUpsert) && itemsToUpsert.length > 0) {
            for (const chunk of chunkArray(itemsToUpsert, 100)) {
                const { error } = await (supabase as any)
                    .from('precount_items')
                    .upsert(chunk, { onConflict: 'id' });
                if (error) throw error;
            }
            if (sessionId) {
                await db.items.where('session_id').equals(sessionId).modify({ synced: 1 }).catch(() => {});
            }
        }

        if (deviceFileRow) {
            await this.executeDeviceFileUpsert(deviceFileRow);
        }

        if (auditLogPayload) {
            const { error: auditErr } = await supabase.from('audit_logs').insert(auditLogPayload);
            if (auditErr) throw auditErr;
        }

        if (notificationPayload) {
            const { error: notifErr } = await supabase.from('notifications').insert(notificationPayload);
            if (notifErr) throw notifErr;
        }
    }

    private async executeAction(action: PendingAction) {
        const { entity, type, data } = action;

        if (entity === 'session') {
            if (data?.action === 'toggle_location') {
                await this.executeLocationAction(data);
                return;
            }

            const { synced, master_catalog, totalProducts, totalUnits, errorCount, ...sessionData } = data;

            if (type === 'create') {
                const { error } = await supabase.from('precount_sessions').upsert(sessionData, { onConflict: 'id' });
                if (error) {
                    const pgError = error as any;
                    if (pgError.code === '23505' || pgError.status === 409) {
                        const { id, ...updates } = sessionData;
                        const { error: updateErr } = await supabase.from('precount_sessions').update(updates).eq('id', id);
                        if (updateErr) throw updateErr;
                    } else {
                        throw error;
                    }
                }
            } else if (type === 'update') {
                const { id, ...updates } = sessionData;
                const { error } = await supabase.from('precount_sessions').update(updates).eq('id', id);
                if (error) throw error;
            } else if (type === 'delete') {
                const tables = [
                    'precount_connected_devices',
                    'precount_location_status',
                    'precount_device_files',
                    'precount_serials',
                    'precount_items'
                ];
                for (const table of tables) {
                    const { error: childErr } = await (supabase as any).from(table).delete().eq('session_id', data.id);
                    if (childErr && String(childErr.code || '') !== '42P01') {
                        throw childErr;
                    }
                }
                const { error } = await supabase.from('precount_sessions').delete().eq('id', data.id);
                if (error) throw error;
            }
        } else if (entity === 'item') {
            if (type === 'create') {
                await this.executeItemCreateIdempotent(data);
            } else if (type === 'update') {
                const { id, ...updates } = data;
                const cleanUpdates: any = {};
                if (updates.quantity !== undefined) cleanUpdates.quantity = updates.quantity;
                if (updates.location_tag !== undefined) cleanUpdates.location_tag = updates.location_tag;
                if (updates.product_name !== undefined) cleanUpdates.product_name = updates.product_name;
                if (updates.id_producto !== undefined) cleanUpdates.id_producto = updates.id_producto;
                if (updates.device_name !== undefined) cleanUpdates.device_name = updates.device_name;

                const { data: updatedRows, error: updateError } = await supabase
                    .from('precount_items')
                    .update(cleanUpdates)
                    .eq('id', id)
                    .select('id');

                if (updateError) throw updateError;

                // Si la fila aún no existía en remoto (ej. edición offline previa al primer create), hacer upsert completo
                if (!updatedRows || updatedRows.length === 0) {
                    const localItem = await db.items.get(id);
                    const fullSource = localItem ? { ...localItem, ...updates, id } : data;
                    if (fullSource?.session_id && fullSource?.ean) {
                        const { error: upsertErr } = await (supabase as any)
                            .from('precount_items')
                            .upsert(toCleanItemPayload(fullSource), { onConflict: 'id' });
                        if (upsertErr) throw upsertErr;
                    }
                }
            } else if (type === 'delete') {
                const { error } = await supabase.from('precount_items').delete().eq('id', data.id);
                if (error) throw error;
            }
        } else if (entity === 'location') {
            await this.executeLocationAction(data);
        } else if (entity === 'device_file') {
            if (type === 'create' || type === 'update') {
                await this.executeDeviceFileUpsert(data);
            } else if (type === 'delete') {
                const { error } = await (supabase as any)
                    .from('precount_device_files')
                    .delete()
                    .eq('session_id', data.session_id)
                    .eq('filename', data.filename);
                if (error) throw error;
            }
        } else if (entity === 'serial') {
            const { error } = await (supabase as any)
                .from('precount_serials')
                .insert(data);
            if (error && String((error as any).code || '') !== '23505') {
                throw error;
            }
        } else if (entity === 'batch_export') {
            await this.executeBatchExportAction(data);
        }
    }
}

export const syncManager = new SyncManager();

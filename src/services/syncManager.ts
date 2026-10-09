import { db, PendingAction } from './db';
import { supabase } from '@/integrations/supabase/client';

export class SyncManager {
    private isSyncing = false;
    private maxRetries = 3;
    private debounceTimer: NodeJS.Timeout | null = null;
    private recurringInterval: NodeJS.Timeout | null = null;
    private pendingItemCount = 0;
    private autoSaveEnabled = true;

    // Timing constants para evitar saturación de red en sucursales
    private readonly DEBOUNCE_INTERVAL_MS = 10000; // 10s tras último escaneo
    private readonly MAX_BATCH_THRESHOLD = 20;     // Disparo forzado al acumular 20 lecturas continuas
    private readonly RECURRING_INTERVAL_MS = 15000; // Chequeo periódico de rutina cada 15s

    constructor() {
        if (typeof window !== 'undefined') {
            // Escucha de estado de conexión
            window.addEventListener('online', () => this.processQueue());
            window.addEventListener('offline', () => {
                console.log('[SyncManager] Dispositivo sin conexión. Sincronización en cola suspendida.');
            });

            // Al cerrar la ventana o salir de la app, forzar guardado de pendientes
            window.addEventListener('beforeunload', () => {
                this.flushNow();
            });

            // Heartbeat periódico de autoguardado en segundo plano (cada 15s)
            this.recurringInterval = setInterval(() => {
                if (this.autoSaveEnabled && navigator.onLine && !this.isSyncing) {
                    this.processQueue();
                }
            }, this.RECURRING_INTERVAL_MS);
        }
    }

    /**
     * Activa o desactiva el autoguardado automático periódico hacia Supabase
     */
    public setAutoSaveEnabled(enabled: boolean) {
        this.autoSaveEnabled = enabled;
        if (enabled && navigator.onLine) {
            this.processQueue();
        }
    }

    /**
     * Emite un evento en el DOM para que los componentes UI muestren estado de sincronización
     */
    private emitSyncStatus(isSyncing: boolean, pendingCount: number) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('precount:sync_status', {
                detail: { isSyncing, pendingCount, timestamp: Date.now() }
            }));
        }
    }

    async addToQueue(action: Omit<PendingAction, 'id' | 'status' | 'timestamp' | 'retries'>) {
        await db.pendingActions.add({
            ...action,
            status: 'pending',
            timestamp: Date.now(),
            retries: 0
        });

        // 1. Acciones críticas o ediciones/borrados directos -> sincronizar ya
        if (action.entity !== 'item' || action.type === 'update' || action.type === 'delete') {
            if (navigator.onLine) {
                this.processQueue();
            }
            return;
        }

        // 2. Si el usuario desactivó el autoguardado en ajustes, solo persistir en disco local
        if (!this.autoSaveEnabled) {
            return;
        }

        // 3. Escaneo de productos: Agrupación inteligente por Lote / Tiempo (Debounce)
        this.pendingItemCount++;

        // Si se acumularon 20 o más productos seguidos sin pausa, enviar inmediatamente
        if (this.pendingItemCount >= this.MAX_BATCH_THRESHOLD) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            this.pendingItemCount = 0;
            if (navigator.onLine) {
                this.processQueue();
            }
            return;
        }

        // Si no se llegó a 20, programar autoguardado debounced (10 segundos tras la última lectura)
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.pendingItemCount = 0;
            this.debounceTimer = null;
            if (navigator.onLine) {
                this.processQueue();
            }
        }, this.DEBOUNCE_INTERVAL_MS);
    }

    /**
     * Fuerza el vaciado inmediato de la cola a Supabase (ej: al cerrar zona o terminar turno)
     */
    async flushNow(): Promise<void> {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingItemCount = 0;
        await this.processQueue();
    }

    async processQueue() {
        console.log(`[SyncManager] processQueue called. isSyncing: ${this.isSyncing}, onLine: ${navigator.onLine}`);
        if (this.isSyncing || !navigator.onLine) return;

        this.isSyncing = true;

        try {
            const pendingActions = await db.pendingActions
                .where('status')
                .anyOf('pending', 'failed') // Retry failed ones too
                .sortBy('timestamp');

            if (pendingActions.length === 0) {
                console.log('[SyncManager] No pending actions to sync.');
                return;
            }
            
            console.log(`[SyncManager] Processing queue (${pendingActions.length} items)`);

            // Group item upserts to batch them
            const itemUpserts: PendingAction[] = [];
            const otherActions: PendingAction[] = [];

            for (const action of pendingActions) {
                if (action.entity === 'item' && action.type === 'create') {
                    itemUpserts.push(action);
                } else {
                    otherActions.push(action);
                }
            }

            // 1. Process Batchable Item Upserts
            if (itemUpserts.length > 0) {
                // Batch size of 50 is safe for Nano instances
                const BATCH_SIZE = 50;
                for (let i = 0; i < itemUpserts.length; i += BATCH_SIZE) {
                    const currentBatch = itemUpserts.slice(i, i + BATCH_SIZE);
                    const batchIds = currentBatch.map(a => a.id!).filter(Boolean);
                    
                    await db.pendingActions.where('id').anyOf(batchIds).modify({ status: 'syncing' });

                    try {
                        const itemsData = currentBatch.map(a => {
                            // Ensure scanned_by is a valid UUID or null to avoid DB error 400
                            const isValidUUID = (id?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
                            const scannedBy = isValidUUID(a.data.scanned_by) ? a.data.scanned_by : null;

                            return {
                                id: a.data.id,
                                session_id: a.data.session_id,
                                ean: a.data.ean,
                                product_name: a.data.product_name,
                                quantity: a.data.quantity,
                                scanned_by: scannedBy,
                                id_producto: a.data.id_producto,
                                device_id: a.data.device_id,
                                device_name: a.data.device_name,
                                location_tag: a.data.location_tag
                            };
                        });

                        const { error } = await (supabase as any).rpc('batch_upsert_precount_items', {
                            p_items: itemsData
                        });

                        if (error) throw error;

                        // Success! Update local state
                        const localItemIds = currentBatch.map(a => a.data.id).filter(Boolean);
                        await db.items.where('id').anyOf(localItemIds).modify({ synced: 1 });
                        await db.pendingActions.where('id').anyOf(batchIds).delete();

                        console.log(`SyncManager: Successfully synced batch of ${currentBatch.length} items`);

                        // Throttle to let the DB breathe (Nano tier)
                        if (i + BATCH_SIZE < itemUpserts.length) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    } catch (error: any) {
                        console.error(`Batch sync failed (${error.status || 'unknown'}):`, error);
                        
                        // FALLBACK: If batch fails, try items individually
                        console.log(`[SyncManager] Falling back to individual sync for batch of ${currentBatch.length} items...`);
                        
                        for (const action of currentBatch) {
                            try {
                                await this.executeAction(action);
                                // If success, cleanup
                                if (action.id) await db.pendingActions.delete(action.id);
                                if (action.data?.id) await db.items.update(action.data.id, { synced: 1 });
                            } catch (indError: any) {
                                console.error(`[SyncManager] Individual item sync failed for ${action.data?.ean}:`, indError);
                                if (action.id) {
                                    await db.pendingActions.update(action.id, { 
                                        status: 'failed', 
                                        error: indError.message || 'Individual sync error' 
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // 2. Process Individual Actions (Sessions, deletes, etc.)
            for (const action of otherActions) {
                if (!action.id) continue;
                await db.pendingActions.update(action.id, { status: 'syncing' });
                try {
                    await this.executeAction(action);
                    if (action.entity === 'session') {
                        await db.sessions.update(action.data.id, { synced: 1 });
                    } else if (action.entity === 'item' && action.data?.id) {
                        await db.items.update(action.data.id, { synced: 1 });
                    }
                    await db.pendingActions.delete(action.id);
                } catch (error: any) {
                    console.error('Individual sync failed:', error);
                    // If conflict (duplicate key), session is already present on server
                    if (action.entity === 'session' && (error?.code === '23505' || error?.status === 409)) {
                        console.log(`[SyncManager] Session ${action.data?.id} already exists on Supabase. Marking as synced.`);
                        if (action.data?.id) {
                            await db.sessions.update(action.data.id, { synced: 1 });
                        }
                        await db.pendingActions.delete(action.id);
                        continue;
                    }
                    await db.pendingActions.update(action.id, { 
                        status: 'failed', 
                        error: error.message || 'Action error' 
                    });
                }
            }
        } finally {
            this.isSyncing = false;
            try {
                const remaining = await db.pendingActions.where('status').anyOf('pending', 'failed').count();
                this.emitSyncStatus(false, remaining);
            } catch {
                this.emitSyncStatus(false, 0);
            }
        }
    }

    private async executeAction(action: PendingAction) {
        const { entity, type, data } = action;

        if (entity === 'session') {
            const { synced, master_catalog, totalProducts, totalUnits, errorCount, ...sessionData } = data; // Strip local-only fields

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
                // First delete all items belonging to this session to avoid FK issues
                await supabase.from('precount_items').delete().eq('session_id', data.id);
                
                // Then delete the session
                const { error } = await supabase.from('precount_sessions').delete().eq('id', data.id);
                if (error) throw error;
            }
        } else if (entity === 'item') {
            if (type === 'create') {
                // Use upsert RPC for atoms / scans (additive)
                const { error } = await supabase.rpc('upsert_precount_item', {
                    p_id: data.id,
                    p_session_id: data.session_id,
                    p_ean: data.ean,
                    p_product_name: data.product_name,
                    p_quantity: data.quantity,
                    p_user_id: data.scanned_by,
                    p_id_producto: data.id_producto,
                    p_device_id: data.device_id,
                    p_device_name: data.device_name,
                    p_location_tag: data.location_tag
                });
                if (error) throw error;
            } else if (type === 'update') {
                // Direct absolute update for item modifications (stepper, quantity edits, sector)
                const { id, ...updates } = data;
                const cleanUpdates: any = {};
                if (updates.quantity !== undefined) cleanUpdates.quantity = updates.quantity;
                if (updates.location_tag !== undefined) cleanUpdates.location_tag = updates.location_tag;
                if (updates.product_name !== undefined) cleanUpdates.product_name = updates.product_name;
                if (updates.id_producto !== undefined) cleanUpdates.id_producto = updates.id_producto;

                const { error: updateError } = await supabase
                    .from('precount_items')
                    .update(cleanUpdates)
                    .eq('id', id);
                
                if (updateError) throw updateError;
            } else if (type === 'delete') {
                const { error } = await supabase.from('precount_items').delete().eq('id', data.id);
                if (error) throw error;
            }
        } else if (entity === 'device_file') {
            if (type === 'create') {
                const { error } = await (supabase as any).from('precount_device_files').insert(data);
                if (error) throw error;
            }
        }
    }
}

export const syncManager = new SyncManager();

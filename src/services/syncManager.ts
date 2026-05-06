import { db, PendingAction } from './db';
import { supabase } from '@/integrations/supabase/client';

export class SyncManager {
    private isSyncing = false;
    private maxRetries = 3;

    constructor() {
        // Listen to online status changes
        window.addEventListener('online', () => this.processQueue());
        window.addEventListener('offline', () => {
            console.log('App went offline. Sync suspended.');
        });
    }

    async addToQueue(action: Omit<PendingAction, 'id' | 'status' | 'timestamp' | 'retries'>) {
        await db.pendingActions.add({
            ...action,
            status: 'pending',
            timestamp: Date.now(),
            retries: 0
        });

        // Try to sync immediately if online
        if (navigator.onLine) {
            this.processQueue();
        }
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
                if (action.entity === 'item' && (action.type === 'create' || action.type === 'update')) {
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
                        console.error('Batch sync failed:', error);
                        await db.pendingActions.where('id').anyOf(batchIds).modify({ 
                            status: 'failed', 
                            error: error.message || 'Batch error' 
                        });
                        // Stop this run on full batch failure to avoid hammering
                        break;
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
                    }
                    await db.pendingActions.delete(action.id);
                } catch (error: any) {
                    console.error('Individual sync failed:', error);
                    await db.pendingActions.update(action.id, { 
                        status: 'failed', 
                        error: error.message || 'Action error' 
                    });
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private async executeAction(action: PendingAction) {
        const { entity, type, data } = action;

        if (entity === 'session') {
            const { synced, ...sessionData } = data; // Strip local-only fields

            if (type === 'create') {
                const { error } = await supabase.from('precount_sessions').insert(sessionData);
                if (error) throw error;
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
            if (type === 'create' || type === 'update') {
                // Use upsert RPC for atoms
                const { error } = await supabase.rpc('upsert_precount_item', {
                    p_id: data.id,
                    p_session_id: data.session_id,
                    p_ean: data.ean,
                    p_product_name: data.product_name,
                    p_quantity: data.quantity,
                    p_user_id: data.scanned_by,
                    p_id_producto: data.id_producto,
                    p_device_id: data.device_id,
                    p_device_name: data.device_name
                });
                if (error) throw error;
            } else if (type === 'delete') {
                const { error } = await supabase.from('precount_items').delete().eq('id', data.id);
                if (error) throw error;
            }
        }
    }
}

export const syncManager = new SyncManager();

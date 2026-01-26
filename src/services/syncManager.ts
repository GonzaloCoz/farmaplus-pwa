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
        if (this.isSyncing || !navigator.onLine) return;

        this.isSyncing = true;

        try {
            const pendingActions = await db.pendingActions
                .where('status')
                .anyOf('pending', 'failed') // Retry failed ones too
                .sortBy('timestamp');

            for (const action of pendingActions) {
                if (!action.id) continue;

                await db.pendingActions.update(action.id, { status: 'syncing' });

                try {
                    await this.executeAction(action);
                    await db.pendingActions.update(action.id, { status: 'success' });
                    // Remove successfully synced items after a while or immediately?
                    // Let's keep them for "History" in UI for now, or delete to keep DB small.
                    // For now, delete to keep it clean, UI can show "Empty" when done.
                    await db.pendingActions.delete(action.id);
                } catch (error: any) {
                    console.error('Sync failed for action:', action, error);
                    const newRetries = (action.retries || 0) + 1;

                    if (newRetries >= this.maxRetries) {
                        // Mark as dead letter or stay failed
                        await db.pendingActions.update(action.id, {
                            status: 'failed',
                            retries: newRetries,
                            error: error.message || 'Unknown error'
                        });
                    } else {
                        await db.pendingActions.update(action.id, {
                            status: 'pending', // Reset to pending to retry later
                            retries: newRetries,
                            error: error.message || 'Unknown error'
                        });
                    }
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private async executeAction(action: PendingAction) {
        const { entity, type, data } = action;

        if (entity === 'session') {
            const { is_synced, ...sessionData } = data; // Strip local-only fields

            if (type === 'create') {
                const { error } = await supabase.from('precount_sessions').insert(sessionData);
                if (error) throw error;
            } else if (type === 'update') {
                const { id, ...updates } = sessionData;
                const { error } = await supabase.from('precount_sessions').update(updates).eq('id', id);
                if (error) throw error;
            }
        } else if (entity === 'item') {
            if (type === 'create' || type === 'update') {
                // Use upsert RPC for atoms
                const { error } = await supabase.rpc('upsert_precount_item', {
                    p_session_id: data.session_id,
                    p_ean: data.ean,
                    p_product_name: data.product_name,
                    p_quantity: data.quantity,
                    p_user_id: data.scanned_by
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

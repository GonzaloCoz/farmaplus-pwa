import { useState, useEffect, useCallback } from 'react';
import { OfflineQueue, QueueItem } from '../services/OfflineQueue';
import { notify } from '@/lib/notifications';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export function useSyncManager() {
    const [status, setStatus] = useState<SyncStatus>(navigator.onLine ? 'idle' : 'offline');
    const [queueLength, setQueueLength] = useState(0);

    const updateQueueLength = useCallback(async () => {
        const offlineQueueLength = OfflineQueue.getQueue().length;
        setQueueLength(offlineQueueLength);
    }, []);

    // Mock API call
    const processItem = async (item: QueueItem) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // In a real app, this would be a switch statement handling different item types
        // and calling actual API endpoints.
        console.log(`Processing item ${item.id} of type ${item.type}`, item.payload);

        // Simulate random failure for demonstration if needed, but let's assume success for now.
        return true;
    };

    const sync = useCallback(async () => {
        if (!navigator.onLine) {
            setStatus('offline');
            return;
        }

        const queue = OfflineQueue.getQueue();
        if (queue.length === 0) {
            setStatus('idle');
            return;
        }

        setStatus('syncing');
        let successCount = 0;
        let errorCount = 0;

        for (const item of queue) {
            try {
                await processItem(item);
                OfflineQueue.remove(item.id);
                successCount++;
            } catch (error) {
                console.error(`Failed to process item ${item.id}`, error);
                errorCount++;
            }
        }

        updateQueueLength();

        if (errorCount > 0) {
            setStatus('error');
            notify.error("Error de sincronización", `Completada con ${errorCount} errores`);
        } else {
            setStatus('idle');
            if (successCount > 0) {
                notify.success("Sincronización exitosa", `${successCount} elementos sincronizados`);
            }
        }
    }, [updateQueueLength]);

    useEffect(() => {
        const handleOnline = () => {
            setStatus('idle');
            sync();
        };
        const handleOffline = () => setStatus('offline');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        updateQueueLength();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [sync, updateQueueLength]);

    return { status, queueLength, sync };
}

import { useState, useEffect, useCallback } from 'react';
import { getUnsyncedItems, markItemsAsSynced } from '@/services/preCountDB';
import { toast } from 'sonner';

interface UseOfflineSyncReturn {
    isOnline: boolean;
    isSyncing: boolean;
    unsyncedCount: number;
    syncNow: () => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [unsyncedCount, setUnsyncedCount] = useState(0);

    // Monitorear estado de conexión
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Conexión restaurada', {
                description: 'Los datos se sincronizarán automáticamente',
            });
            // Auto-sync cuando vuelva la conexión
            syncNow();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.warning('Sin conexión', {
                description: 'Los datos se guardarán localmente',
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Contar items no sincronizados
    const updateUnsyncedCount = useCallback(async () => {
        try {
            const items = await getUnsyncedItems();
            setUnsyncedCount(items.length);
        } catch (error) {
            console.error('Error counting unsynced items:', error);
        }
    }, []);

    // Actualizar contador periódicamente
    useEffect(() => {
        updateUnsyncedCount();

        const interval = setInterval(updateUnsyncedCount, 30000); // Cada 30 segundos

        return () => clearInterval(interval);
    }, [updateUnsyncedCount]);

    // Sincronizar datos
    const syncNow = useCallback(async () => {
        if (!isOnline) {
            toast.error('No hay conexión a internet');
            return;
        }

        if (isSyncing) {
            return;
        }

        try {
            setIsSyncing(true);

            const unsyncedItems = await getUnsyncedItems();

            if (unsyncedItems.length === 0) {
                toast.info('No hay datos pendientes de sincronización');
                return;
            }

            // TODO: Aquí iría la lógica para enviar los datos al servidor
            // Por ahora, simulamos una sincronización exitosa
            console.log('Syncing items:', unsyncedItems);

            // Simular delay de red
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Marcar items como sincronizados
            const itemIds = unsyncedItems.map(item => item.id);
            await markItemsAsSynced(itemIds);

            await updateUnsyncedCount();

            toast.success('Sincronización completada', {
                description: `${unsyncedItems.length} productos sincronizados`,
            });
        } catch (error) {
            console.error('Error syncing data:', error);
            toast.error('Error al sincronizar datos', {
                description: 'Se reintentará automáticamente',
            });
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, isSyncing, updateUnsyncedCount]);

    // Intentar sincronizar cuando vuelva la conexión
    useEffect(() => {
        if (isOnline && unsyncedCount > 0 && !isSyncing) {
            // Esperar un poco antes de sincronizar automáticamente
            const timer = setTimeout(() => {
                syncNow();
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [isOnline, unsyncedCount, isSyncing, syncNow]);

    return {
        isOnline,
        isSyncing,
        unsyncedCount,
        syncNow,
    };
}

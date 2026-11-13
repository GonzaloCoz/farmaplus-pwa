import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Cloud01 as WifiOff, Wifi } from '@untitledui/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import { db, PendingAction } from '@/services/db';
import { syncManager } from '@/services/syncManager';

function isPermanentErrorAction(item: PendingAction): boolean {
    return Boolean((item as PendingAction & { permanentError?: boolean }).permanentError);
}

function triggerReconnectSync(): void {
    const mgr = syncManager as unknown as { onConnectivityRestored?: () => Promise<void> };
    if (typeof mgr.onConnectivityRestored === 'function') {
        void mgr.onConnectivityRestored();
    } else {
        void syncManager.flushNow();
    }
}

export function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [showRestored, setShowRestored] = useState(false);
    const wasOfflineRef = useRef(typeof navigator !== 'undefined' ? !navigator.onLine : false);

    const pendingCount = useLiveQuery(
        async () => {
            try {
                const items = await db.pendingActions.toArray();
                return items.filter(
                    (i) =>
                        (i.status === 'pending' || i.status === 'syncing' || i.status === 'failed') &&
                        !isPermanentErrorAction(i)
                ).length;
            } catch {
                return 0;
            }
        },
        [],
        0
    );

    useEffect(() => {
        let hideTimer: ReturnType<typeof setTimeout> | null = null;

        const scheduleHideRestored = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                setShowRestored(false);
            }, 3500);
        };

        const handleOnline = () => {
            setIsOnline(true);
            if (wasOfflineRef.current) {
                wasOfflineRef.current = false;
                setShowRestored(true);
                scheduleHideRestored();
            }
            triggerReconnectSync();
        };

        const handleOffline = () => {
            if (hideTimer) clearTimeout(hideTimer);
            wasOfflineRef.current = true;
            setShowRestored(false);
            setIsOnline(false);
        };

        const handleWakeUp = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
            setIsOnline(onlineNow);
            if (onlineNow) {
                triggerReconnectSync();
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('focus', handleWakeUp);
        document.addEventListener('visibilitychange', handleWakeUp);

        return () => {
            if (hideTimer) clearTimeout(hideTimer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('focus', handleWakeUp);
            document.removeEventListener('visibilitychange', handleWakeUp);
        };
    }, []);

    return (
        <AnimatePresence>
            {!isOnline && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={cn(
                        'fixed top-0 left-0 right-0 z-50',
                        'bg-destructive text-destructive-foreground',
                        'px-4 py-3 shadow-lg'
                    )}
                >
                    <div className="container mx-auto flex items-center justify-center gap-2 text-center">
                        <WifiOff className="h-5 w-5 animate-pulse shrink-0" />
                        <span className="font-medium text-sm">
                            Sin conexión a Internet - Los cambios se guardan localmente
                            {pendingCount > 0 ? ` (${pendingCount} pendiente${pendingCount === 1 ? '' : 's'})` : ''}
                        </span>
                    </div>
                </motion.div>
            )}

            {isOnline && showRestored && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={cn(
                        'fixed top-0 left-0 right-0 z-50',
                        'bg-success text-success-foreground',
                        'px-4 py-2 shadow-lg'
                    )}
                >
                    <div className="container mx-auto flex items-center justify-center gap-2">
                        <Wifi className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">
                            Conexión restaurada
                            {pendingCount > 0 ? ` — Sincronizando ${pendingCount} cambio${pendingCount === 1 ? '' : 's'}...` : ''}
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineBanner() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
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
                    <div className="container mx-auto flex items-center justify-center gap-2">
                        <WifiOff className="h-5 w-5 animate-pulse" />
                        <span className="font-medium">
                            Sin conexión a Internet - Los cambios se sincronizarán cuando vuelvas a estar en línea
                        </span>
                    </div>
                </motion.div>
            )}

            {isOnline && (
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
                        <Wifi className="h-4 w-4" />
                        <span className="text-sm font-medium">Conexión restaurada</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

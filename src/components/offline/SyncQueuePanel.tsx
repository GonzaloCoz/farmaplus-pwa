import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Clock, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, PendingAction } from '@/services/db';
import { syncManager } from '@/services/syncManager';

export function SyncQueuePanel() {
    const [isOpen, setIsOpen] = useState(false);

    // Live query to local DB
    const queueItems = useLiveQuery(
        () => db.pendingActions.orderBy('timestamp').reverse().toArray(),
        []
    );

    const pendingCount = queueItems?.filter((item) => item.status === 'pending' || item.status === 'failed').length || 0;
    const isSyncing = queueItems?.some(item => item.status === 'syncing');

    const getStatusIcon = (status: PendingAction['status']) => {
        switch (status) {
            case 'pending':
                return <Clock className="h-4 w-4 text-muted-foreground" />;
            case 'syncing':
                return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-success" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-destructive" />;
        }
    };

    const getTypeLabel = (type: PendingAction['type']) => {
        switch (type) {
            case 'create':
                return 'Crear';
            case 'update':
                return 'Actualizar';
            case 'delete':
                return 'Eliminar';
            default:
                return type;
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Hace un momento';
        if (minutes === 1) return 'Hace 1 minuto';
        if (minutes < 60) return `Hace ${minutes} minutos`;
        const hours = Math.floor(minutes / 60);
        if (hours === 1) return 'Hace 1 hora';
        return `Hace ${hours} horas`;
    };

    const handleRetry = () => {
        syncManager.processQueue();
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="relative"
                >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                    Cola de Sync
                    {pendingCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="ml-2 h-5 w-5 p-0 flex items-center justify-center"
                        >
                            {pendingCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Cola de Sincronización</SheetTitle>
                    <SheetDescription>
                        Cambios pendientes de sincronizar con el servidor
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4 max-h-[80vh] overflow-y-auto pr-2">
                    {!queueItems || queueItems.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-success" />
                            <p className="font-medium">Todo sincronizado</p>
                            <p className="text-sm mt-1">No hay cambios pendientes</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {queueItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Card className={cn(
                                        'p-4',
                                        item.status === 'failed' && 'border-destructive',
                                        item.status === 'success' && 'border-success/50 bg-success/5'
                                    )}>
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1">
                                                {getStatusIcon(item.status)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {getTypeLabel(item.type)}
                                                    </Badge>
                                                    <span className="text-xs font-mono uppercase text-muted-foreground">
                                                        {item.entity}
                                                    </span>
                                                    {item.retries > 0 && item.status !== 'success' && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            {item.retries} reintentos
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium truncate">
                                                    {/* Intentamos mostrar algo descriptivo del payload */}
                                                    {item.data.product_name || item.data.ean || item.data.sector || `#${item.data.id?.substring(0, 8)}`}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatTimestamp(item.timestamp)}
                                                </p>
                                                {item.error && (
                                                    <p className="text-xs text-destructive mt-1 break-words">
                                                        {item.error}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}

                    {pendingCount > 0 && (
                        <Button className="w-full" variant="outline" onClick={handleRetry} disabled={isSyncing}>
                            <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                            {isSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

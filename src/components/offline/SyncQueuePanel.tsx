import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Clock, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueItem {
    id: string;
    type: 'create' | 'update' | 'delete';
    entity: string;
    timestamp: number;
    status: 'pending' | 'syncing' | 'success' | 'error';
    retries?: number;
}

// Mock data - en producción vendría de IndexedDB o similar
const mockQueueItems: QueueItem[] = [
    {
        id: '1',
        type: 'update',
        entity: 'Producto: Paracetamol 500mg',
        timestamp: Date.now() - 300000,
        status: 'pending',
    },
    {
        id: '2',
        type: 'create',
        entity: 'Inventario: Laboratorio A',
        timestamp: Date.now() - 180000,
        status: 'pending',
    },
];

export function SyncQueuePanel() {
    const [queueItems] = useState<QueueItem[]>(mockQueueItems);
    const [isOpen, setIsOpen] = useState(false);

    const pendingCount = queueItems.filter((item) => item.status === 'pending').length;

    const getStatusIcon = (status: QueueItem['status']) => {
        switch (status) {
            case 'pending':
                return <Clock className="h-4 w-4 text-muted-foreground" />;
            case 'syncing':
                return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-success" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-destructive" />;
        }
    };

    const getTypeLabel = (type: QueueItem['type']) => {
        switch (type) {
            case 'create':
                return 'Crear';
            case 'update':
                return 'Actualizar';
            case 'delete':
                return 'Eliminar';
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

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="relative"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
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

                <div className="mt-6 space-y-4">
                    {queueItems.length === 0 ? (
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
                                        item.status === 'error' && 'border-destructive'
                                    )}>
                                        <div className="flex items-start gap-3">
                                            {getStatusIcon(item.status)}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {getTypeLabel(item.type)}
                                                    </Badge>
                                                    {item.retries && item.retries > 0 && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            {item.retries} reintentos
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium truncate">
                                                    {item.entity}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {formatTimestamp(item.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}

                    {pendingCount > 0 && (
                        <Button className="w-full" variant="outline">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reintentar Sincronización
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

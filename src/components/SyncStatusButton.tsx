import { useSyncManager } from '@/hooks/useSyncManager';
import { Restart as RefreshCw, CloseCircle as WifiOff, CloudCross as CloudOff, CheckCircle } from '@solar-icons/react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function SyncStatusButton() {
    const { status, queueLength, sync } = useSyncManager();

    const getStatusIcon = () => {
        if (status === 'offline') return <WifiOff className="h-4 w-4" />;
        if (status === 'syncing') return <RefreshCw className="h-4 w-4 animate-spin" />;
        if (queueLength > 0) return <CloudOff className="h-4 w-4" />;
        return <CheckCircle className="h-4 w-4" />;
    };

    const getStatusText = () => {
        if (status === 'offline') return 'Sin Conexión';
        if (status === 'syncing') return 'Sincronizando...';
        if (queueLength > 0) return `${queueLength} Pendientes`;
        return 'Sincronizado';
    };

    const getStatusColor = () => {
        if (status === 'offline') return 'text-destructive';
        if (status === 'syncing') return 'text-blue-500';
        if (queueLength > 0) return 'text-orange-500';
        return 'text-success';
    };

    const getTooltipText = () => {
        if (status === 'offline') return 'Sin conexión a internet';
        if (status === 'syncing') return 'Sincronizando datos...';
        if (queueLength > 0) return `${queueLength} elementos pendientes de sincronización`;
        return 'Todos los datos están sincronizados';
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "gap-2 h-9 px-3",
                        status === 'syncing' && "cursor-wait"
                    )}
                    onClick={sync}
                    disabled={status === 'syncing' || status === 'offline'}
                >
                    <span className={cn("transition-colors", getStatusColor())}>
                        {getStatusIcon()}
                    </span>
                    <span className="text-xs font-medium">
                        {getStatusText()}
                    </span>
                    {queueLength > 0 && (
                        <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                            {queueLength}
                        </span>
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{getTooltipText()}</p>
            </TooltipContent>
        </Tooltip>
    );
}

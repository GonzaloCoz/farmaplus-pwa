import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

interface SyncStatusWidgetProps {
    isOnline?: boolean;
    pendingCount?: number;
    lastSync?: string;
    onSync?: () => void;
}

export function SyncStatusWidget({
    isOnline = true,
    pendingCount = 0,
    lastSync = 'Hace 5 minutos',
    onSync
}: SyncStatusWidgetProps) {
    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Sincronización</CardTitle>
                    {isOnline ? (
                        <Wifi className="h-5 w-5 text-success" />
                    ) : (
                        <WifiOff className="h-5 w-5 text-destructive" />
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                        <p className="text-sm font-medium">Estado de Conexión</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {isOnline ? 'Conectado' : 'Sin conexión'}
                        </p>
                    </div>
                    <Badge variant={isOnline ? "default" : "destructive"}>
                        {isOnline ? 'Online' : 'Offline'}
                    </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                        <p className="text-sm font-medium">Datos Pendientes</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {pendingCount > 0 ? `${pendingCount} elementos` : 'Todo sincronizado'}
                        </p>
                    </div>
                    {pendingCount > 0 ? (
                        <Badge variant="warning">{pendingCount}</Badge>
                    ) : (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Última sincronización: {lastSync}</span>
                </div>

                <Button
                    className="w-full"
                    variant={pendingCount > 0 ? "default" : "outline"}
                    onClick={onSync}
                    disabled={!isOnline}
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {pendingCount > 0 ? 'Sincronizar Ahora' : 'Actualizar'}
                </Button>
            </CardContent>
        </Card>
    );
}

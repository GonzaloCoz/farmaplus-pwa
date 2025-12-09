import { Card } from '@/components/ui/card';
import { AlertCircle as AlertCircleIcon } from 'lucide-react';

export function InventoryAlertsWidget() {
    return (
        <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-medium text-muted-foreground">Alertas de Inventario</h2>
                <span className="px-3 py-1 bg-warning/10 text-warning text-xs font-medium rounded-full">
                    3 Activas
                </span>
            </div>

            <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <AlertCircleIcon className="w-5 h-5 text-warning mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Stock bajo en Sucursal Palermo II</p>
                        <p className="text-xs text-muted-foreground mt-1">15 productos necesitan reabastecimiento</p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <AlertCircleIcon className="w-5 h-5 text-warning mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Inventario cíclico pendiente</p>
                        <p className="text-xs text-muted-foreground mt-1">Sucursal Microcentro - Vence en 2 días</p>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <AlertCircleIcon className="w-5 h-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Diferencia significativa detectada</p>
                        <p className="text-xs text-muted-foreground mt-1">Sucursal Belgrano III - Revisar urgente</p>
                    </div>
                </div>
            </div>
        </Card>
    );
}

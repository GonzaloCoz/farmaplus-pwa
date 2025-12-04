import { Card } from '@/components/ui/card';
import { AnimatedProgressBar } from '@/components/AnimatedProgressBar';

export function InventorySummaryWidget() {
    return (
        <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-medium text-muted-foreground">Resumen de Inventario</h2>
                <button className="text-sm text-muted-foreground hover:text-foreground">
                    Ver detalles
                </button>
            </div>

            <div className="space-y-6">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Productos en Stock</span>
                        <span className="text-sm font-medium">85%</span>
                    </div>
                    <AnimatedProgressBar value={85} />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Productos con Bajo Stock</span>
                        <span className="text-sm font-medium text-warning">12%</span>
                    </div>
                    <AnimatedProgressBar value={12} variant="warning" />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Productos Agotados</span>
                        <span className="text-sm font-medium text-destructive">3%</span>
                    </div>
                    <AnimatedProgressBar value={3} variant="destructive" />
                </div>
            </div>
        </Card>
    );
}

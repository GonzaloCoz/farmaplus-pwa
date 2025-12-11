import { CyclicItem } from '@/components/CyclicInventoryList';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, RefreshCw } from 'lucide-react';

interface CyclicInventoryTableProps {
    items: CyclicItem[];
    onUpdateQuantity: (id: string, quantity: number) => void;
    onCheck: (id: string, quantity: number) => void;
    showDifferencesOnly?: boolean;
}

export function CyclicInventoryTable({ items, onUpdateQuantity, onCheck, showDifferencesOnly }: CyclicInventoryTableProps) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
                <RefreshCw className="h-10 w-10 mb-2" />
                <p>No hay items para mostrar</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {items.map((item) => {
                const diff = item.countedQuantity - item.systemQuantity;
                const hasDiff = diff !== 0;

                // If showDifferencesOnly is true, skip items with no difference
                if (showDifferencesOnly && !hasDiff) return null;

                const isControlled = item.status === 'controlled' || item.status === 'adjusted';
                const statusColor = item.status === 'adjusted' ? 'bg-blue-500/10 border-blue-500/20' :
                    (item.status === 'controlled' ? 'bg-green-500/10 border-green-500/20' : 'bg-card');

                return (
                    <Card key={item.id} className={cn("p-3 flex items-center justify-between border transition-colors", statusColor)}>
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 rounded">{item.ean}</span>
                                {item.wasReadjusted && (
                                    <Badge variant="secondary" className="h-4 text-[9px] px-1 bg-purple-100 text-purple-700">Modif.</Badge>
                                )}
                            </div>
                            <h4 className="font-semibold text-sm truncate leading-tight mt-1">{item.name}</h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>Sis: {item.systemQuantity}</span>
                                {hasDiff && (
                                    <span className={cn("font-bold", diff > 0 ? "text-green-600" : "text-red-500")}>
                                        Dif: {diff > 0 ? '+' : ''}{diff}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Quantity Control */}
                        <div className="flex items-center gap-2 bg-background rounded-lg border p-1 shadow-sm">
                            <button
                                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-lg font-bold"
                                onClick={() => onUpdateQuantity(item.id, Math.max(0, item.countedQuantity - 1))}
                            >
                                -
                            </button>
                            <div className="w-10 text-center font-mono font-bold text-lg">
                                {item.countedQuantity}
                            </div>
                            <button
                                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-lg font-bold"
                                onClick={() => onUpdateQuantity(item.id, item.countedQuantity + 1)}
                            >
                                +
                            </button>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}

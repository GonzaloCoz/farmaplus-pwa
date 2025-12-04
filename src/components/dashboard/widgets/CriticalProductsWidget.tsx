import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface CriticalProductsWidgetProps {
    criticalCount: number;
    outOfStockCount: number;
}

export function CriticalProductsWidget({ criticalCount, outOfStockCount }: CriticalProductsWidgetProps) {
    const hasIssues = criticalCount > 0 || outOfStockCount > 0;

    return (
        <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Críticos</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${hasIssues ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
                <div className={`text-xl font-bold ${hasIssues ? 'text-destructive' : 'text-foreground'}`}>
                    {criticalCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Productos con stock bajo
                </p>
                {outOfStockCount > 0 && (
                    <Badge variant="destructive" className="mt-2">
                        {outOfStockCount} agotados
                    </Badge>
                )}
            </CardContent>
        </Card>
    );
}

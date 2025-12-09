import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CounterAnimation } from '@/components/CounterAnimation';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface TotalStockValueWidgetProps {
    totalValue: number;
    changePercentage?: number;
}

export function TotalStockValueWidget({ totalValue, changePercentage }: TotalStockValueWidgetProps) {
    const isPositive = changePercentage !== undefined && changePercentage >= 0;

    return (
        <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold">
                    $<CounterAnimation value={totalValue} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Valor de inventario
                </p>
                {changePercentage !== undefined && (
                    <div className={`flex items-center gap-1 mt-2 text-xs ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{Math.abs(changePercentage).toFixed(1)}% vs mes anterior</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp } from 'lucide-react';

interface InventoryProgressWidgetProps {
    completedCount: number;
    totalCount: number;
}

export function InventoryProgressWidget({ completedCount, totalCount }: InventoryProgressWidgetProps) {
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const getColor = () => {
        if (percentage >= 80) return 'text-success';
        if (percentage >= 50) return 'text-warning';
        return 'text-destructive';
    };

    return (
        <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progreso</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-xl font-bold ${getColor()}`}>
                    {percentage}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    {completedCount} de {totalCount} completados
                </p>
                <Progress value={percentage} className="mt-2" />
            </CardContent>
        </Card>
    );
}

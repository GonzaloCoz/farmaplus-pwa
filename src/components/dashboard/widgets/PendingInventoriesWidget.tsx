import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface PendingInventoriesWidgetProps {
    pendingCount: number;
    urgentCount: number;
}

export function PendingInventoriesWidget({ pendingCount, urgentCount }: PendingInventoriesWidgetProps) {
    return (
        <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-xl font-bold ${pendingCount > 0 ? 'text-warning' : 'text-foreground'}`}>
                    {pendingCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Inventarios sin completar
                </p>
                {urgentCount > 0 && (
                    <Badge variant="destructive" className="mt-2">
                        {urgentCount} urgentes
                    </Badge>
                )}
            </CardContent>
        </Card>
    );
}

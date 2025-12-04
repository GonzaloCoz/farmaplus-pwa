import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CounterAnimation } from '@/components/CounterAnimation';
import { Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownWidgetProps {
    daysRemaining: number;
    totalDays?: number;
}

export function CountdownWidget({ daysRemaining, totalDays = 30 }: CountdownWidgetProps) {
    // Calculate progress percentage
    const progressPercentage = totalDays > 0 ? ((totalDays - daysRemaining) / totalDays) * 100 : 0;

    // Determine urgency level
    const isUrgent = daysRemaining <= 7;
    const isWarning = daysRemaining <= 14 && daysRemaining > 7;

    return (
        <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pt-4 pb-1">
                <CardTitle className="text-sm font-medium">Días Restantes</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col justify-between flex-1 px-5 pb-4 pt-0">
                {/* Days Counter */}
                <div className="flex items-baseline gap-2 mt-0">
                    <div className={cn(
                        "text-3xl font-bold transition-colors tracking-tight",
                        isUrgent && "text-destructive",
                        isWarning && "text-warning",
                        !isUrgent && !isWarning && "text-foreground"
                    )}>
                        <CounterAnimation value={daysRemaining} />
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">
                        {daysRemaining === 1 ? 'día' : 'días'}
                    </span>
                </div>

                <div className="space-y-2">
                    {/* Progress Bar */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            <span>Progreso</span>
                            <span>{Math.round(progressPercentage)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full transition-all duration-500 rounded-full",
                                    isUrgent && "bg-destructive",
                                    isWarning && "bg-warning",
                                    !isUrgent && !isWarning && "bg-primary"
                                )}
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Status Message */}
                    <p className={cn(
                        "text-xs font-medium flex items-center gap-1.5",
                        isUrgent && "text-destructive",
                        isWarning && "text-warning",
                        !isUrgent && !isWarning && "text-muted-foreground"
                    )}>
                        {isUrgent && '⚠️ Finalización urgente'}
                        {isWarning && '⏰ Próximo a vencer'}
                        {!isUrgent && !isWarning && '✓ Tiempo suficiente'}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

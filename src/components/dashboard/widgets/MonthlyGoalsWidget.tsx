import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Award } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Goal {
    title: string;
    current: number;
    target: number;
    badge?: string;
}

interface MonthlyGoalsWidgetProps {
    goals?: Goal[];
}

export function MonthlyGoalsWidget({ goals = [] }: MonthlyGoalsWidgetProps) {
    const sampleGoals: Goal[] = [
        { title: 'Inventarios Completados', current: 45, target: 60, badge: '75%' },
        { title: 'Productos Controlados', current: 1250, target: 1500, badge: '83%' },
        { title: 'Diferencias Resueltas', current: 28, target: 35, badge: '80%' },
    ];

    const displayGoals = goals.length > 0 ? goals : sampleGoals;

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold">Objetivos del Mes</CardTitle>
                        <p className="text-sm text-muted-foreground">Progreso hacia metas</p>
                    </div>
                    <Target className="h-5 w-5 text-primary" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {displayGoals.map((goal, index) => {
                        const percentage = Math.round((goal.current / goal.target) * 100);
                        const isComplete = percentage >= 100;

                        return (
                            <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{goal.title}</span>
                                        {isComplete && <Award className="h-4 w-4 text-success" />}
                                    </div>
                                    <Badge variant={isComplete ? "default" : "secondary"}>
                                        {goal.current}/{goal.target}
                                    </Badge>
                                </div>
                                <Progress value={percentage} className="h-2" />
                                <p className="text-xs text-muted-foreground">
                                    {percentage}% completado
                                </p>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

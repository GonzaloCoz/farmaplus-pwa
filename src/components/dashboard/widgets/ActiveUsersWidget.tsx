import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface ActiveUsersWidgetProps {
    activeCount: number;
    activeBranches: string[];
}

export function ActiveUsersWidget({ activeCount, activeBranches }: ActiveUsersWidgetProps) {
    return (
        <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Activos</CardTitle>
                <div className="relative">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {activeCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-success rounded-full animate-pulse" />
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold">
                    {activeCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Usuarios trabajando
                </p>
                {activeBranches.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {activeBranches.slice(0, 2).map((branch, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                                {branch}
                            </Badge>
                        ))}
                        {activeBranches.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                                +{activeBranches.length - 2}
                            </Badge>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

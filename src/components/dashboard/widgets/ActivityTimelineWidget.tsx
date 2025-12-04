import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Edit, Upload, Clock } from 'lucide-react';

interface ActivityItem {
    id: string;
    type: 'completed' | 'adjusted' | 'imported';
    title: string;
    branch: string;
    timestamp: string;
    user?: string;
}

interface ActivityTimelineWidgetProps {
    activities?: ActivityItem[];
}

export function ActivityTimelineWidget({ activities = [] }: ActivityTimelineWidgetProps) {
    // Sample data if none provided
    const sampleActivities: ActivityItem[] = [
        {
            id: '1',
            type: 'completed',
            title: 'Inventario Farmacia completado',
            branch: 'Belgrano IV',
            timestamp: 'Hace 5 minutos',
            user: 'Juan Pérez'
        },
        {
            id: '2',
            type: 'adjusted',
            title: 'Ajustes realizados en Perfumería',
            branch: 'Recoleta',
            timestamp: 'Hace 15 minutos',
            user: 'María González'
        },
        {
            id: '3',
            type: 'imported',
            title: 'Inventario importado',
            branch: 'Palermo II',
            timestamp: 'Hace 1 hora',
            user: 'Carlos Rodríguez'
        },
        {
            id: '4',
            type: 'completed',
            title: 'Pre-conteo finalizado',
            branch: 'Microcentro',
            timestamp: 'Hace 2 horas',
            user: 'Ana Martínez'
        },
    ];

    const displayActivities = activities.length > 0 ? activities : sampleActivities;

    const getIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'completed':
                return <CheckCircle2 className="h-4 w-4 text-success" />;
            case 'adjusted':
                return <Edit className="h-4 w-4 text-warning" />;
            case 'imported':
                return <Upload className="h-4 w-4 text-primary" />;
        }
    };

    const getTypeLabel = (type: ActivityItem['type']) => {
        switch (type) {
            case 'completed':
                return 'Completado';
            case 'adjusted':
                return 'Ajustado';
            case 'imported':
                return 'Importado';
        }
    };

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Actividad Reciente</CardTitle>
                <p className="text-sm text-muted-foreground">Últimas acciones realizadas</p>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {displayActivities.map((activity, index) => (
                        <div key={activity.id} className="relative">
                            {index < displayActivities.length - 1 && (
                                <div className="absolute left-2 top-8 bottom-0 w-px bg-border" />
                            )}
                            <div className="flex gap-3">
                                <div className="relative z-10 mt-1 rounded-full bg-background p-1 border">
                                    {getIcon(activity.type)}
                                </div>
                                <div className="flex-1 pb-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{activity.title}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {activity.branch} • {activity.user}
                                            </p>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                            {getTypeLabel(activity.type)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>{activity.timestamp}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

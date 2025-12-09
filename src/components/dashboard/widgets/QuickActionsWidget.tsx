import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    FileSpreadsheet,
    Upload,
    BarChart3,
    Plus,
    Download,
    Settings
} from 'lucide-react';

interface QuickAction {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary';
}

interface QuickActionsWidgetProps {
    actions?: QuickAction[];
}

export function QuickActionsWidget({ actions = [] }: QuickActionsWidgetProps) {
    const defaultActions: QuickAction[] = [
        {
            title: 'Nuevo Pre-Conteo',
            description: 'Iniciar nuevo pre-conteo',
            icon: Plus,
            onClick: () => console.log('Nuevo Pre-Conteo'),
            variant: 'default'
        },
        {
            title: 'Importar Inventario',
            description: 'Cargar desde Excel',
            icon: Upload,
            onClick: () => console.log('Importar'),
            variant: 'outline'
        },
        {
            title: 'Ver Reportes',
            description: 'Análisis y estadísticas',
            icon: BarChart3,
            onClick: () => console.log('Reportes'),
            variant: 'outline'
        },
        {
            title: 'Exportar Datos',
            description: 'Descargar información',
            icon: Download,
            onClick: () => console.log('Exportar'),
            variant: 'outline'
        },
        {
            title: 'Configuración',
            description: 'Ajustes del sistema',
            icon: Settings,
            onClick: () => console.log('Configuración'),
            variant: 'secondary'
        },
    ];

    const displayActions = actions.length > 0 ? actions : defaultActions;

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Acciones Rápidas</CardTitle>
                <p className="text-sm text-muted-foreground">Tareas frecuentes</p>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-3">
                    {displayActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                            <Button
                                key={index}
                                variant={action.variant || 'outline'}
                                className="h-auto flex-col items-start p-4 gap-2"
                                onClick={action.onClick}
                            >
                                <Icon className="h-5 w-5" />
                                <div className="text-left">
                                    <p className="text-sm font-medium">{action.title}</p>
                                    <p className="text-xs text-muted-foreground font-normal">
                                        {action.description}
                                    </p>
                                </div>
                            </Button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

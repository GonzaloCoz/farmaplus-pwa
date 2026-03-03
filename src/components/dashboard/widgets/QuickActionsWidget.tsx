import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    FileText as FileSpreadsheet,
    Upload,
    Chart as BarChart3,
    AddCircle as Plus,
    Download,
    Settings
} from '@solar-icons/react';

import { useUser } from '@/contexts/UserContext';
import { notify } from '@/lib/notifications';

interface QuickAction {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary';
    comingSoon?: boolean;
}

interface QuickActionsWidgetProps {
    actions?: QuickAction[];
}

export function QuickActionsWidget({ actions = [] }: QuickActionsWidgetProps) {
    const { user } = useUser();
    const isAdmin = user?.role === 'admin';

    const defaultActions: QuickAction[] = [
        {
            title: 'Nuevo Colector',
            description: 'Iniciar captura de datos',
            icon: Plus,
            onClick: () => console.log('Nuevo Colector'),
            variant: 'default'
        },
        {
            title: 'Importar Inventario',
            description: 'Cargar desde Excel',
            icon: Upload,
            onClick: () => {
                if (!isAdmin) {
                    notify.info("Próximamente", "La herramienta de Importación estará disponible muy pronto.", { id: 'blocked-feature' });
                } else {
                    console.log('Importar');
                }
            },
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
        <div className="h-full">
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
        </div>
    );
}

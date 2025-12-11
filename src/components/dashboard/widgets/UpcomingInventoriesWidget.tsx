import { Card } from '@/components/ui/card';
import { CalendarClock, Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';

interface UpcomingInventory {
    branch: string;
    sector: string;
    date: string;
    iso: string;
}

interface UpcomingInventoriesWidgetProps {
    inventories: UpcomingInventory[];
    onDateClick: (iso: string) => void;
    onAddClick?: () => void;
    onViewCalendar?: () => void;
}

export function UpcomingInventoriesWidget({
    inventories,
    onDateClick,
    onAddClick,
    onViewCalendar
}: UpcomingInventoriesWidgetProps) {
    const { user } = useUser();
    const isAdmin = user?.role === 'admin';

    return (
        <Card className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">Próximos Inventarios</h2>
                <div className="flex gap-1">
                    {isAdmin && onAddClick && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddClick} title="Programar Nuevo">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                    {onViewCalendar && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onViewCalendar} title="Ver Calendario Completo">
                            <Calendar className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-4 flex-1">
                {inventories.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 border rounded-lg border-dashed bg-muted/20">
                        <p className="text-sm text-muted-foreground mb-3">No hay inventarios próximos</p>
                        {isAdmin && onAddClick && (
                            <Button variant="outline" size="sm" onClick={onAddClick}>
                                <Plus className="w-3 h-3 mr-2" />
                                Programar
                            </Button>
                        )}
                    </div>
                ) : (
                    inventories.map((inv, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                            <CalendarClock className="w-5 h-5 text-primary mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{inv.branch} - {inv.sector}</p>
                                <button
                                    onClick={() => onDateClick(inv.iso)}
                                    className="text-xs text-muted-foreground mt-1 hover:underline text-left block"
                                >
                                    {inv.date}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}

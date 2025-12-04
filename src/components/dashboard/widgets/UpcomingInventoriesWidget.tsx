import { Card } from '@/components/ui/card';
import { CalendarClock } from 'lucide-react';

interface UpcomingInventory {
    branch: string;
    sector: string;
    date: string;
    iso: string;
}

interface UpcomingInventoriesWidgetProps {
    inventories: UpcomingInventory[];
    onDateClick: (iso: string) => void;
}

export function UpcomingInventoriesWidget({ inventories, onDateClick }: UpcomingInventoriesWidgetProps) {
    return (
        <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-medium text-muted-foreground">Próximos Inventarios</h2>
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                    {inventories.length} Programados
                </span>
            </div>
            <div className="space-y-4">
                {inventories.map((inv, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                        <CalendarClock className="w-5 h-5 text-primary mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{inv.branch} - {inv.sector}</p>
                            <button
                                onClick={() => onDateClick(inv.iso)}
                                className="text-xs text-muted-foreground mt-1 hover:underline"
                            >
                                {inv.date}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

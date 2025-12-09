import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownWidgetProps {
    assignedDays?: number;
    daysRemaining?: number;
    totalProgress?: number;
    monthlyProgress?: number[];
    isEditable?: boolean;
    onEdit?: () => void;
}

export function CountdownWidget({
    assignedDays = 0,
    daysRemaining = 0,
    totalProgress = 0,
    monthlyProgress = [],
    isEditable = false,
    onEdit
}: CountdownWidgetProps) {

    // Calculate number of months (segments). Default to 3 (90 days) if 0 for visualization skeleton
    const numMonths = assignedDays > 0 ? Math.ceil(assignedDays / 30) : 3;
    const segments = Array.from({ length: numMonths });

    return (
        <Card className="h-full flex flex-col overflow-hidden relative group/card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pt-4 pb-2">
                <CardTitle className="text-sm font-medium">Plazo de Inventario</CardTitle>
                <div className="flex items-center gap-2">
                    {isEditable && (
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit?.();
                            }}
                            className="relative z-50 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover/card:opacity-100 cursor-pointer"
                            title="Configurar plazo"
                        >
                            <Calendar className="h-4 w-4" />
                        </button>
                    )}
                    {!isEditable && <Calendar className="h-4 w-4 text-muted-foreground" />}
                </div>
            </CardHeader>
            <CardContent className="flex flex-col justify-between flex-1 px-5 pb-4 pt-1 gap-4">

                {/* Days Info */}
                <div className="flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-3xl font-bold tracking-tight text-foreground">
                            {assignedDays > 0 ? assignedDays : '-'}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Días Asignados
                        </span>
                    </div>

                    <div className="h-8 w-px bg-border/60 mx-2 mb-1" />

                    <div className="flex flex-col items-end">
                        <span className="text-3xl font-bold tracking-tight text-foreground">
                            {assignedDays > 0 ? daysRemaining : '-'}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide text-right">
                            Días Restantes
                        </span>
                    </div>
                </div>

                {/* Progress Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Avance Global</span>
                        <span className="text-sm font-bold text-primary">{totalProgress}%</span>
                    </div>

                    {/* Segmented Bar */}
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${numMonths}, 1fr)` }}>
                        {segments.map((_, index) => {
                            const monthValue = monthlyProgress[index] || 0;
                            // Visualization: if assignedDays is 0, show empty state
                            const isEmpty = assignedDays === 0;

                            return (
                                <div key={index} className="space-y-1.5 group">
                                    {/* Bar Segment */}
                                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden relative">
                                        <div
                                            className={cn(
                                                "h-full bg-primary transition-all duration-500 rounded-full",
                                                isEmpty && "w-0" // Force 0 width if empty
                                            )}
                                            style={{ width: isEmpty ? '0%' : `${Math.min(monthValue, 100)}%` }}
                                        />
                                    </div>
                                    {/* Month Stat */}
                                    <div className="text-[10px] text-center text-muted-foreground font-medium">
                                        {isEmpty ? '-' : `${monthValue}%`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Month Labels (Optional, just 1, 2, 3...) */}
                    {/* <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${numMonths}, 1fr)` }}>
                        {segments.map((_, i) => (
                             <div key={i} className="text-[9px] text-center text-muted-foreground/50 uppercase">Mes {i+1}</div>
                        ))}
                    </div> */}
                </div>
            </CardContent>
        </Card>
    );
}

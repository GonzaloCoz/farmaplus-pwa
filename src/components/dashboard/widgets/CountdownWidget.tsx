import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, AlertCircle, CheckCircle2, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface CountdownWidgetProps {
    assignedDays: number;
    startDate?: string | null;
    totalProgress: number;
    isEditable?: boolean;
    onEdit?: () => void;
}

export function CountdownWidget({
    assignedDays = 0,
    startDate,
    totalProgress = 0,
    isEditable = false,
    onEdit
}: CountdownWidgetProps) {

    const stats = useMemo(() => {
        if (!startDate || assignedDays === 0) {
            return {
                daysRemaining: 0,
                daysElapsed: 0,
                timeProgress: 0,
                status: 'pending',
                expectedProgress: 0,
                isDelayed: false,
                segments: [0, 0, 0]
            };
        }

        const start = new Date(startDate);
        const today = new Date();
        const diffTime = today.getTime() - start.getTime();
        const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        const daysRemaining = Math.max(0, assignedDays - daysElapsed);
        const timeProgress = Math.min(100, (daysElapsed / assignedDays) * 100);

        // Expected progress is roughly equal to time progress
        const expectedProgress = Math.round(timeProgress);
        const isDelayed = totalProgress < expectedProgress - 5; // 5% tolerance
        const isWayAhead = totalProgress > expectedProgress + 15;

        let status: 'on-track' | 'behind' | 'ahead' | 'pending' = 'on-track';
        if (isDelayed) status = 'behind';
        else if (isWayAhead) status = 'ahead';

        // Calculate 3 segments (months usually)
        const numSegments = 3;
        const segmentSize = 100 / numSegments;
        const segments = Array.from({ length: numSegments }).map((_, i) => {
            const segmentEnd = (i + 1) * segmentSize;
            if (totalProgress >= segmentEnd) return 100;
            if (totalProgress <= i * segmentSize) return 0;
            return ((totalProgress - (i * segmentSize)) / segmentSize) * 100;
        });

        return {
            daysRemaining,
            daysElapsed,
            timeProgress,
            status,
            expectedProgress,
            isDelayed,
            segments
        };
    }, [startDate, assignedDays, totalProgress]);

    const getStatusColor = () => {
        if (assignedDays === 0) return 'text-muted-foreground';
        if (stats.status === 'behind') return 'text-destructive';
        if (stats.status === 'ahead') return 'text-blue-500';
        return 'text-green-500';
    };

    const getStatusLabel = () => {
        if (assignedDays === 0) return 'Sin configurar';
        if (stats.status === 'behind') return 'Retrasado';
        if (stats.status === 'ahead') return 'Adelantado';
        return 'Al día';
    };

    const getStatusIcon = () => {
        if (assignedDays === 0) return <Timer className="h-4 w-4" />;
        if (stats.status === 'behind') return <AlertCircle className="h-4 w-4" />;
        if (stats.status === 'ahead') return <CheckCircle2 className="h-4 w-4" />;
        return <CheckCircle2 className="h-4 w-4" />;
    };

    return (
        <Card className="h-full flex flex-col overflow-hidden relative group/card border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold tracking-tight">Plazo de Inventario</CardTitle>
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
            <CardContent className="flex flex-col justify-between flex-1 px-5 pb-5 pt-1 gap-4">

                {/* Days Info */}
                <div className="flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">
                            Asignados
                        </span>
                        <span className="text-3xl font-black tracking-tighter text-foreground leading-none">
                            {assignedDays > 0 ? assignedDays : '--'}
                        </span>
                    </div>

                    <div className="h-10 w-px bg-border/40 mx-2" />

                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">
                            Restantes
                        </span>
                        <span className={cn(
                            "text-3xl font-black tracking-tighter leading-none",
                            stats.daysRemaining < 7 && assignedDays > 0 ? "text-destructive" : "text-foreground"
                        )}>
                            {assignedDays > 0 ? stats.daysRemaining : '--'}
                        </span>
                    </div>
                </div>

                {/* Performance Logic */}
                <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                            <span className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider", getStatusColor())}>
                                {getStatusIcon()}
                                {getStatusLabel()}
                            </span>
                        </div>
                        <span className="text-xs font-bold">{totalProgress}% <span className="text-[10px] font-normal text-muted-foreground ml-1">real</span></span>
                    </div>

                    {/* Pace Bar */}
                    <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden relative">
                        {/* Expected Marker */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-foreground/20 z-10"
                            style={{ left: `${stats.expectedProgress}%` }}
                        />
                        {/* Real Progress */}
                        <div
                            className={cn(
                                "h-full transition-all duration-700 rounded-full",
                                stats.status === 'behind' ? 'bg-destructive' : 'bg-primary'
                            )}
                            style={{ width: `${totalProgress}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                        <span>Inicio</span>
                        <span style={{ marginLeft: `${stats.expectedProgress - 5}%` }}>Objetivo Hoy</span>
                        <span>Meta</span>
                    </div>
                </div>

                {/* Monthly Segments */}
                <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Avance por Periodos</span>
                    <div className="grid grid-cols-3 gap-2">
                        {stats.segments.map((val, i) => (
                            <div key={i} className="space-y-1">
                                <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-foreground/40 transition-all duration-1000"
                                        style={{ width: `${val}%` }}
                                    />
                                </div>
                                <div className="text-[9px] text-center font-bold text-muted-foreground/70">
                                    M{i + 1}: {Math.round(val)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


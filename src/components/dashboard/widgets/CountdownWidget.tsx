import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, AlertCircle, CheckCircle, Clock as Timer, Lock01 as Lock, LockUnlocked01 as Unlock } from '@untitledui/icons';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { Gauge } from '@/components/charts/gauge';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownTrigger, DropdownContent, MenuItem } from '@/components/ui/dropdown';
import { DotsHorizontal } from '@untitledui/icons';

interface CountdownWidgetProps {
    assignedDays: number;
    startDate?: string | null;
    totalProgress: number;
    isEditable?: boolean;
    onEdit?: () => void;
    isLocked?: boolean;
    lockReason?: 'manual' | 'deadline' | null;
    onToggleLock?: (isLocked: boolean) => void;
    canManageLock?: boolean; // Only admin/zonal can toggle lock
}

export function CountdownWidget({
    assignedDays = 0,
    startDate,
    totalProgress = 0,
    isEditable = false,
    onEdit,
    isLocked = false,
    lockReason = null,
    onToggleLock,
    canManageLock = false
}: CountdownWidgetProps) {
    const [timeframe, setTimeframe] = useState<'cycle' | 'month' | 'week'>('cycle');

    const stats = useMemo(() => {
        if (!startDate || assignedDays === 0) {
            return {
                daysRemaining: 0,
                daysElapsed: 0,
                activeAssigned: 0,
                activeRemaining: 0,
                activeProgress: 0,
                activeTarget: 0,
                deltaPercent: 0,
                status: 'pending' as const,
                footerText: 'PLAZO DE INVENTARIO SIN CONFIGURAR'
            };
        }

        const start = new Date(startDate);
        const today = new Date();
        const diffTime = today.getTime() - start.getTime();
        const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        const daysRemaining = Math.max(0, assignedDays - daysElapsed);

        let activeAssigned = assignedDays;
        let activeRemaining = daysRemaining;
        let activeProgress = totalProgress;
        
        // Expected progress is the percentage of time elapsed
        const totalExpected = Math.min(100, Math.round((daysElapsed / assignedDays) * 100));
        let activeTarget = totalExpected;

        if (timeframe === 'month') {
            const monthsInCycle = Math.max(1, Math.round(assignedDays / 30));
            const currentMonthIdx = Math.min(monthsInCycle - 1, Math.floor(daysElapsed / 30));
            const segmentSize = 100 / monthsInCycle;
            
            // Progress for current month (0 - 100)
            const monthStartProgress = currentMonthIdx * segmentSize;
            const monthEndProgress = (currentMonthIdx + 1) * segmentSize;
            
            if (totalProgress >= monthEndProgress) activeProgress = 100;
            else if (totalProgress <= monthStartProgress) activeProgress = 0;
            else activeProgress = Math.round(((totalProgress - monthStartProgress) / segmentSize) * 100);
            
            // Target for current month (0 - 100)
            const daysElapsedInCurrentMonth = Math.min(30, daysElapsed - (currentMonthIdx * 30));
            activeTarget = Math.round((daysElapsedInCurrentMonth / 30) * 100);
            
            activeAssigned = 30;
            activeRemaining = Math.max(0, 30 - daysElapsedInCurrentMonth);
        } else if (timeframe === 'week') {
            const weeksInCycle = Math.max(1, Math.round(assignedDays / 7));
            const currentWeekIdx = Math.min(weeksInCycle - 1, Math.floor(daysElapsed / 7));
            const weekSegmentSize = 100 / weeksInCycle;
            
            // Progress for current week (0 - 100)
            const weekStartProgress = currentWeekIdx * weekSegmentSize;
            const weekEndProgress = (currentWeekIdx + 1) * weekSegmentSize;
            
            if (totalProgress >= weekEndProgress) activeProgress = 100;
            else if (totalProgress <= weekStartProgress) activeProgress = 0;
            else activeProgress = Math.round(((totalProgress - weekStartProgress) / weekSegmentSize) * 100);
            
            // Target for current week (0 - 100)
            const daysElapsedInCurrentWeek = Math.min(7, daysElapsed - (currentWeekIdx * 7));
            activeTarget = Math.round((daysElapsedInCurrentWeek / 7) * 100);
            
            activeAssigned = 7;
            activeRemaining = Math.max(0, 7 - daysElapsedInCurrentWeek);
        }

        const deltaPercent = activeProgress - activeTarget;
        const isDelayed = activeProgress < activeTarget - 5;
        const isWayAhead = activeProgress > activeTarget + 10;

        let status: 'on-track' | 'behind' | 'ahead' = 'on-track';
        if (isDelayed) status = 'behind';
        else if (isWayAhead) status = 'ahead';

        // Generate prediction footer text
        let footerText = '';
        if (status === 'ahead') {
            footerText = `EL INVENTARIO AVANZA UN ${deltaPercent.toFixed(0)}% MÁS RÁPIDO QUE EL OBJETIVO`;
        } else if (status === 'behind') {
            footerText = `SE REQUIERE UN ${Math.abs(deltaPercent).toFixed(0)}% MÁS DE AVANCE PARA EVITAR EL RETRASO`;
        } else {
            footerText = 'EL RITMO ACTUAL ES ADECUADO PARA FINALIZAR EN EL PLAZO';
        }

        return {
            daysRemaining,
            daysElapsed,
            activeAssigned,
            activeRemaining,
            activeProgress,
            activeTarget,
            deltaPercent,
            status,
            footerText
        };
    }, [startDate, assignedDays, totalProgress, timeframe]);

    const showActionsMenu = isEditable || (canManageLock && !!onToggleLock);

    return (
        <div className="h-full flex flex-col overflow-hidden relative group/card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pt-4 pb-0 text-foreground">
                <CardTitle className="text-lg font-medium tracking-tight">
                    Plazo de Inventario
                </CardTitle>
                <div className="flex items-center gap-2">
                    {/* Timeframe Dropdown */}
                    {assignedDays > 0 && (
                        <div className="relative z-50">
                            <select 
                                value={timeframe} 
                                onChange={(e) => setTimeframe(e.target.value as any)}
                                onPointerDown={(e) => e.stopPropagation()} // Stop drag sensor propagation
                                className="appearance-none pr-7 pl-3 py-1 text-xs font-semibold bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-full text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <option value="cycle">Ciclo</option>
                                <option value="month">Este Mes</option>
                                <option value="week">Esta Semana</option>
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m6 9 6 6 6-6"/>
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* Lock Status Indicator */}
                    {isLocked && (
                        <div className="flex items-center text-destructive" title={lockReason === 'manual' ? 'Bloqueado manualmente' : 'Bloqueado por vencimiento'}>
                            <Lock className="h-4.5 w-4.5" />
                        </div>
                    )}

                    {/* Unified Actions Dropdown Menu */}
                    {showActionsMenu && (
                        <DropdownMenu>
                            <DropdownTrigger render={
                                <Button 
                                    variant="secondary" 
                                    size="icon-sm"
                                    onPointerDown={(e) => e.stopPropagation()} // Stop drag sensor propagation
                                    className="relative z-50 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                    title="Acciones de plazo"
                                >
                                    <DotsHorizontal />
                                </Button>
                            } />
                            <DropdownContent align="end">
                                {isEditable && (
                                    <MenuItem 
                                        index={0}
                                        icon={Calendar}
                                        label="Configurar plazo"
                                        onSelect={() => onEdit?.()}
                                    />
                                )}
                                {canManageLock && onToggleLock && (
                                    <MenuItem 
                                        index={isEditable ? 1 : 0}
                                        icon={isLocked ? Unlock : Lock}
                                        label={isLocked ? "Desbloquear inventario" : "Bloquear inventario"}
                                        onSelect={() => onToggleLock(!isLocked)}
                                    />
                                )}
                            </DropdownContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex flex-col justify-between flex-1 px-5 pb-3 pt-0.5 @sm:pb-3.5 @sm:pt-1 gap-1 @sm:gap-2">
                {/* Main value percentage and target indicators */}
                <div className="flex flex-col gap-0.5">
                    <Tooltip content="Porcentaje real de avance en la carga de inventario para el periodo seleccionado.">
                        <div className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 leading-none cursor-help w-max">
                            {assignedDays > 0 ? `${stats.activeProgress.toFixed(1)}%` : '--%'}
                        </div>
                    </Tooltip>
                    
                    <div className="flex justify-between items-center mt-0.5">
                        {/* Delta percentage VS expected target */}
                        <Tooltip content="Diferencia (desvío) entre tu progreso real actual y el progreso objetivo esperado para hoy. Un valor negativo indica retraso.">
                            <div className={cn(
                                "text-xs font-normal cursor-help",
                                stats.deltaPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                            )}>
                                {assignedDays > 0 ? (
                                    stats.deltaPercent >= 0 ? `+${stats.deltaPercent.toFixed(0)}% vs. objetivo` : `${stats.deltaPercent.toFixed(0)}% vs. objetivo`
                               ) : '-- vs. objetivo'}
                            </div>
                        </Tooltip>
                        
                        {/* Target badge */}
                        {assignedDays > 0 && (
                            <Tooltip content="Progreso objetivo esperado que se debió haber alcanzado hoy para cumplir la meta a tiempo.">
                                <div className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground cursor-help">
                                    <span className="hidden @xs:inline">{stats.deltaPercent >= 0 ? 'Sobre el objetivo' : 'Bajo el objetivo'}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white",
                                        stats.deltaPercent >= 0 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-red-600 dark:bg-red-500"
                                    )}>
                                        {stats.activeTarget}%
                                    </span>
                                </div>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Notched Gauge and Pointer */}
                <div className="relative w-full py-0.5">
                    {/* Dynamic Pointer Triangle */}
                    {assignedDays > 0 && stats.activeProgress > 0 && (
                        <div
                            className={cn(
                                "absolute top-[-5px] -translate-x-1/2 transition-all duration-700 pointer-events-none z-20",
                                stats.status === 'behind' ? 'text-red-500' : stats.status === 'ahead' ? 'text-blue-500' : 'text-emerald-500'
                            )}
                            style={{ left: `${stats.activeProgress}%` }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="rotate-180">
                                <path d="M12 3l10 18H2L12 3z" />
                            </svg>
                        </div>
                    )}
                    
                    {/* Bklit Gauge component */}
                    <Gauge
                        orientation="linear"
                        value={stats.activeProgress}
                        totalNotches={72}
                        spacing={20}
                        notchCornerRadius={1.5}
                        useGradient={true}
                        activeGradient={["#ef4444", "#22c55e"] as const}
                        inactiveFillOpacity={0.12}
                        linearHeight={12}
                    />

                    {/* Progress Labels */}
                    <div className="flex justify-between text-xs font-normal text-muted-foreground mt-1">
                        <span>Atrasado</span>
                        <span>Óptimo</span>
                    </div>
                </div>

                {/* Days remaining info / stats */}
                <Tooltip content="Días asignados totales para este periodo y días calendario que restan antes de que finalice.">
                    <div className="flex flex-col @sm:flex-row @sm:justify-between @sm:items-center gap-1 px-0.5 mt-0.5 cursor-help w-full">
                        <span className="text-muted-foreground text-xs font-normal text-left text-balance">Días de inventario:</span>
                        <div className="text-xs font-normal text-muted-foreground text-left @sm:text-right text-balance">
                            <span className="font-semibold text-gray-900 dark:text-gray-50">{stats.activeRemaining} restantes</span>
                            <span className="mx-1 text-gray-300 dark:text-zinc-700">/</span>
                            <span className="text-gray-500 dark:text-gray-400">{stats.activeAssigned} asignados</span>
                        </div>
                    </div>
                </Tooltip>
            </CardContent>
        </div>
    );
}

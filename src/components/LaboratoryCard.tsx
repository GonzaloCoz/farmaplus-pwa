import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CounterAnimation } from "./CounterAnimation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { DotsHorizontal, FileSearch02 } from '@untitledui/icons';
import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    MenuItem,
} from "@/components/ui/dropdown";
import { notify } from "@/lib/notifications";

export type LaboratoryStatus = "controlado" | "por_controlar" | "pendiente";

interface LaboratoryCardProps {
    name: string;
    negativeValue: number;
    positiveValue: number;
    differenceValue: number;
    status: LaboratoryStatus;
    progress?: number;
    onClick?: () => void;
    onMouseEnter?: () => void;
    className?: string;
    onRequestRemoval?: (labName: string) => void;
    disabled?: boolean;
    isDischarged?: boolean;
    hasPendingRemoval?: boolean;
    pendingRemovalReason?: string;
}

export function LaboratoryCard({
    name,
    negativeValue,
    positiveValue,
    differenceValue,
    status,
    progress = 0,
    onClick,
    onMouseEnter,
    className,
    onRequestRemoval,
    disabled,
    isDischarged,
    hasPendingRemoval = false,
    pendingRemovalReason,
}: LaboratoryCardProps) {
    const isInactive = disabled || isDischarged;
    const displayProgress = progress || 0;

    const totalAdjusted = positiveValue + Math.abs(negativeValue);
    let sobrantePct = 0;
    let faltantePct = 0;

    if (totalAdjusted > 0) {
        sobrantePct = Math.round((positiveValue / totalAdjusted) * 100);
        faltantePct = Math.round((Math.abs(negativeValue) / totalAdjusted) * 100);
        // Ajuste de precisión para que sumen 100%
        if (sobrantePct + faltantePct !== 100) {
            faltantePct = 100 - sobrantePct;
        }
    }

    const greenBarPct = totalAdjusted > 0 ? sobrantePct : displayProgress;
    const orangeBarPct = totalAdjusted > 0 ? faltantePct : 0;

    const getStatusConfig = (status: LaboratoryStatus) => {
        switch (status) {
            case "controlado":
                return {
                    color: "text-emerald-500",
                    dotColor: "bg-emerald-500",
                };
            case "por_controlar":
                return {
                    color: "text-blue-500",
                    dotColor: "bg-blue-500",
                };
            case "pendiente":
            default:
                return {
                    color: "text-muted-foreground",
                    dotColor: "bg-muted-foreground/60",
                };
        }
    };

    const statusConfig = getStatusConfig(status);

    const cleanName = name ? name.replace(/[\r\n]+/g, ' ').trim() : '';

    return (
        <Card
            className={cn(
                "group transition-all duration-200 flex flex-col gap-3 p-5",
                isInactive 
                    ? "opacity-55 grayscale-[25%] bg-muted/15 border-dashed border-border/60 hover:border-border/60 hover:shadow-none cursor-not-allowed select-none" 
                    : hasPendingRemoval
                    ? "cursor-pointer active:scale-[0.99] card-pending-removal"
                    : "cursor-pointer active:scale-[0.99] hover:border-border hover:shadow-md",
                className
            )}
            onClick={isInactive ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClick}
            onMouseEnter={isInactive ? undefined : onMouseEnter}
        >
            {/* Header: fixed baseline height so numbers across the grid align perfectly */}
            <div className="flex items-center justify-between gap-2 h-7">
                <h3
                    className={cn(
                        "font-semibold text-[13px] tracking-tight truncate flex-1 min-w-0 transition-colors whitespace-nowrap",
                        isInactive ? "text-muted-foreground/70 line-through" : "text-muted-foreground group-hover:text-primary"
                    )}
                    title={cleanName}
                >
                    {cleanName}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isInactive ? (
                        <Badge
                            variant="outline"
                            color="rose"
                            size="sm"
                            className="shrink-0 font-semibold border-rose-500/30 text-rose-500 bg-rose-500/10 text-[10px] uppercase"
                        >
                            Baja Aprobada
                        </Badge>
                    ) : (
                        <>
                            {hasPendingRemoval && (
                                <Tooltip
                                    content={
                                        <div className="flex flex-col gap-0.5 text-left max-w-[240px] py-0.5">
                                            <span className="font-semibold text-background">Solicitud de baja en trámite</span>
                                            <span className="text-[11px] opacity-85 leading-snug">
                                                {pendingRemovalReason
                                                    ? `Motivo: ${pendingRemovalReason}`
                                                    : "Se solicitó la baja de este laboratorio. Pendiente de aprobación administrativa."}
                                            </span>
                                        </div>
                                    }
                                    side="top"
                                    sideOffset={6}
                                >
                                    <Badge
                                        variant="solid"
                                        size="sm"
                                        color="blue"
                                        className="shrink-0 cursor-help"
                                    >
                                        Baja solicitada
                                    </Badge>
                                </Tooltip>
                            )}

                            <Badge
                                variant="dot"
                                size="sm"
                                color={status === "controlado" ? "green" : status === "por_controlar" ? "blue" : "gray"}
                                className="shrink-0 font-semibold"
                            >
                                {displayProgress}%
                            </Badge>
                        </>
                    )}

                    {onRequestRemoval && !isInactive && (
                        <DropdownMenu>
                            <DropdownTrigger render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
                                    title="Opciones"
                                >
                                    <DotsHorizontal className="size-4" />
                                </Button>
                            } />
                            <DropdownContent align="end" className="w-auto min-w-[260px] whitespace-nowrap">
                                <MenuItem
                                    index={0}
                                    icon={FileSearch02}
                                    label={hasPendingRemoval ? "Baja ya solicitada (En revisión)" : "Solicitar baja de laboratorio"}
                                    disabled={hasPendingRemoval}
                                    onSelect={() => {
                                        if (hasPendingRemoval) {
                                            notify.info("Solicitud en revisión", `La baja de ${cleanName} ya fue solicitada y está pendiente de evaluación.`);
                                        } else {
                                            onRequestRemoval(cleanName);
                                        }
                                    }}
                                />
                            </DropdownContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* Diferencia neta con cifras tabulares */}
            <CounterAnimation 
                value={Math.abs(differenceValue)} 
                decimals={0} 
                prefix={differenceValue < 0 ? "-$" : differenceValue > 0 ? "+$" : "$"}
                className={cn(
                    "text-3xl font-bold tracking-tight tabular-nums",
                    differenceValue < 0
                        ? "text-financial-negative"
                        : differenceValue > 0
                        ? "text-financial-positive"
                        : "text-foreground"
                )}
            />

            {/* Columnas sobrante / faltante + barra */}
            <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-3">
                    {/* Sobrante */}
                    <div className={cn(
                        "border-l-2 pl-2.5 transition-colors",
                        positiveValue > 0 ? "border-financial-positive" : "border-border/40"
                    )}>
                        <div className="flex flex-col">
                            <span className={cn(
                                "text-base font-bold tracking-tight tabular-nums",
                                positiveValue > 0 ? "text-card-foreground" : "text-muted-foreground/60"
                            )}>
                                <CounterAnimation value={positiveValue} prefix="+$" />
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">sobrante</span>
                        </div>
                        <div className={cn(
                            "text-[11px] font-medium flex items-center gap-0.5 tabular-nums",
                            positiveValue > 0 ? "text-financial-positive" : "text-muted-foreground/50"
                        )}>
                            <span>↑</span>
                            <span>{sobrantePct}%</span>
                            <span className="text-muted-foreground font-normal ml-0.5">del total</span>
                        </div>
                    </div>

                    {/* Faltante */}
                    <div className={cn(
                        "border-l-2 pl-2.5 transition-colors",
                        Math.abs(negativeValue) > 0 ? "border-financial-negative" : "border-border/40"
                    )}>
                        <div className="flex flex-col">
                            <span className={cn(
                                "text-base font-bold tracking-tight tabular-nums",
                                Math.abs(negativeValue) > 0 ? "text-card-foreground" : "text-muted-foreground/60"
                            )}>
                                <CounterAnimation value={Math.abs(negativeValue)} prefix="-$" />
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">faltante</span>
                        </div>
                        <div className={cn(
                            "text-[11px] font-medium flex items-center gap-0.5 tabular-nums",
                            Math.abs(negativeValue) > 0 ? "text-financial-negative" : "text-muted-foreground/50"
                        )}>
                            <span>↓</span>
                            <span>{faltantePct}%</span>
                            <span className="text-muted-foreground font-normal ml-0.5">del total</span>
                        </div>
                    </div>
                </div>

                {/* Barra de progreso */}
                <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-financial-positive transition-all duration-500"
                        style={{ width: `${greenBarPct}%`, backgroundColor: 'var(--financial-positive)' }}
                    />
                    <div
                        className="h-full transition-all duration-500 bg-financial-negative-subtle text-financial-negative"
                        style={{
                            width: `${orangeBarPct}%`,
                            backgroundImage:
                                "repeating-linear-gradient(90deg, currentColor, currentColor 2px, transparent 2px, transparent 6px)",
                        }}
                    />
                </div>
            </div>
        </Card>
    );
}

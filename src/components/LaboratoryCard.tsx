import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CounterAnimation } from "./CounterAnimation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DotsHorizontal, FileSearch02 } from '@untitledui/icons';
import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    MenuItem,
} from "@/components/ui/dropdown";

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

    return (
        <Card
            className={cn(
                "group transition-all duration-200 flex flex-col gap-3 p-5",
                isInactive 
                    ? "opacity-55 grayscale-[25%] bg-muted/15 border-dashed border-border/60 hover:border-border/60 hover:shadow-none cursor-not-allowed select-none" 
                    : "cursor-pointer active:scale-[0.99] hover:border-border hover:shadow-md",
                className
            )}
            onClick={isInactive ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClick}
            onMouseEnter={isInactive ? undefined : onMouseEnter}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <h3
                    className={cn(
                        "font-semibold text-[13px] tracking-tight truncate flex-1 min-w-0 transition-colors",
                        isInactive ? "text-muted-foreground/70 line-through" : "text-muted-foreground group-hover:text-primary"
                    )}
                    title={name}
                >
                    {name}
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
                        <Badge
                            variant="dot"
                            size="sm"
                            color={status === "controlado" ? "green" : status === "por_controlar" ? "blue" : "gray"}
                            className={cn(
                                "shrink-0 font-semibold",
                                status === "por_controlar" && "[&>span:first-child]:animate-pulse"
                            )}
                        >
                            {displayProgress}%
                        </Badge>
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
                            <DropdownContent align="end" className="w-56">
                                <MenuItem
                                    index={0}
                                    icon={FileSearch02}
                                    label="Solicitar baja de laboratorio"
                                    onSelect={() => {
                                        onRequestRemoval(name);
                                    }}
                                />
                            </DropdownContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* Diferencia neta */}
            <CounterAnimation 
                value={Math.abs(differenceValue)} 
                decimals={0} 
                prefix={differenceValue < 0 ? "-$" : differenceValue > 0 ? "+$" : "$"}
                className={cn(
                    "text-3xl font-bold tracking-tight",
                    differenceValue < 0
                        ? "text-red-500 dark:text-red-400"
                        : differenceValue > 0
                        ? "text-emerald-500"
                        : "text-foreground"
                )}
            />

            {/* Columnas sobrante / faltante + barra */}
            <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-3">
                    {/* Sobrante */}
                    <div className="border-l-2 border-emerald-500 pl-2.5">
                        <div className="flex flex-col">
                            <span className="text-base font-bold text-card-foreground tracking-tight">
                                <CounterAnimation value={positiveValue} prefix="+$" />
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">sobrante</span>
                        </div>
                        <div className="text-[11px] font-medium text-emerald-500 flex items-center gap-0.5">
                            <span>↑</span>
                            <span>{sobrantePct}%</span>
                            <span className="text-muted-foreground font-normal ml-0.5">del total</span>
                        </div>
                    </div>

                    {/* Faltante */}
                    <div className="border-l-2 border-orange-500 pl-2.5">
                        <div className="flex flex-col">
                            <span className="text-base font-bold text-card-foreground tracking-tight">
                                <CounterAnimation value={Math.abs(negativeValue)} prefix="-$" />
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">faltante</span>
                        </div>
                        <div className="text-[11px] font-medium text-orange-500 flex items-center gap-0.5">
                            <span>↓</span>
                            <span>{faltantePct}%</span>
                            <span className="text-muted-foreground font-normal ml-0.5">del total</span>
                        </div>
                    </div>
                </div>

                {/* Barra de progreso */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${greenBarPct}%` }}
                    />
                    <div
                        className="h-full text-orange-500 transition-all duration-500 bg-orange-500/20 dark:bg-orange-500/10"
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

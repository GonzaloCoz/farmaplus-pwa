import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CounterAnimation } from "./CounterAnimation";

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
}: LaboratoryCardProps) {
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
            className="group cursor-pointer transition-all duration-200 active:scale-[0.99] hover:border-border hover:shadow-md flex flex-col gap-3 p-5"
            onClick={onClick}
            onMouseEnter={onMouseEnter}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <h3
                    className="font-semibold text-[13px] text-muted-foreground tracking-tight truncate group-hover:text-primary transition-colors max-w-[60%]"
                    title={name}
                >
                    {name}
                </h3>
                <div className={cn("flex items-center gap-1.5 text-xs font-semibold shrink-0", statusConfig.color)}>
                    <span
                        className={cn(
                            "size-2 rounded-full",
                            statusConfig.dotColor,
                            status === "por_controlar" && "animate-pulse"
                        )}
                    />
                    <span>{displayProgress}%</span>
                </div>
            </div>

            {/* Diferencia neta */}
            <div
                className={cn(
                    "text-3xl font-bold tracking-tight flex items-baseline",
                    differenceValue < 0
                        ? "text-red-500 dark:text-red-400"
                        : differenceValue > 0
                        ? "text-emerald-500"
                        : "text-foreground"
                )}
            >
                {differenceValue < 0 ? "-" : differenceValue > 0 ? "+" : ""}
                <span className="text-xl font-light opacity-40 mr-0.5 align-baseline">$</span>
                <CounterAnimation value={Math.abs(differenceValue)} decimals={0} />
            </div>

            {/* Columnas sobrante / faltante + barra */}
            <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-3">
                    {/* Sobrante */}
                    <div className="border-l-2 border-emerald-500 pl-2.5">
                        <div className="flex flex-col">
                            <span className="text-base font-bold text-card-foreground tracking-tight">
                                +<CounterAnimation value={positiveValue} prefix="$" />
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
                                -<CounterAnimation value={Math.abs(negativeValue)} prefix="$" />
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

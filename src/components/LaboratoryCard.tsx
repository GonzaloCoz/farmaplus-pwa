import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CounterAnimation } from "./CounterAnimation";
import { CheckCircle2, Clock, AlertCircle, ChevronRight } from "lucide-react";

export type LaboratoryStatus = "controlado" | "por_controlar" | "pendiente";

interface LaboratoryCardProps {
    name: string;
    negativeValue: number;
    positiveValue: number;
    differenceValue: number;
    status: LaboratoryStatus;
    progress?: number;
    onClick?: () => void;
}

export function LaboratoryCard({
    name,
    negativeValue,
    positiveValue,
    differenceValue,
    status,
    progress = 0,
    onClick,
}: LaboratoryCardProps) {
    const getStatusConfig = (status: LaboratoryStatus) => {
        switch (status) {
            case "controlado":
                return {
                    color: "text-success",
                    bgColor: "bg-success/10",
                    borderColor: "border-success/20",
                    icon: CheckCircle2,
                    label: "Controlado",
                    barColor: "bg-success"
                };
            case "por_controlar":
                return {
                    color: "text-warning",
                    bgColor: "bg-warning/10",
                    borderColor: "border-warning/20",
                    icon: Clock,
                    label: "En Proceso",
                    barColor: "bg-warning"
                };
            case "pendiente":
                return {
                    color: "text-muted-foreground",
                    bgColor: "bg-muted",
                    borderColor: "border-muted",
                    icon: AlertCircle,
                    label: "Pendiente",
                    barColor: "bg-muted-foreground"
                };
        }
    };

    const config = getStatusConfig(status);
    const Icon = config.icon;

    // Simulate progress if not provided based on status
    const displayProgress = status === 'controlado' ? 100 : progress || 0;

    return (
        <Card
            className={`group hover:shadow-md transition-all duration-300 border border-border/50 cursor-pointer overflow-hidden relative rounded-2xl bg-card/40 dark:bg-card/20 backdrop-blur-sm active:scale-[0.98]`}
            onClick={onClick}
        >

            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`p-2.5 rounded-2xl ${config.bgColor} border ${config.borderColor} transition-transform group-hover:scale-105 duration-300`}>
                            <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h3 className="font-bold text-[15px] tracking-tight truncate pr-2 text-foreground group-hover:text-primary transition-colors" title={name}>
                                {name}
                            </h3>
                            <span className={`text-[9px] font-bold uppercase tracking-[0.05em] ${config.color} opacity-80`}>
                                {config.label}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-muted-foreground/50 font-black uppercase tracking-[0.15em]">Diferencia Neta</span>
                            <div className={`text-2xl font-black tracking-tighter ${differenceValue < 0 ? 'text-destructive' : differenceValue > 0 ? 'text-success' : 'text-foreground'}`}>
                                {differenceValue > 0 ? '+' : ''}<CounterAnimation value={differenceValue} prefix="$" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 items-end">
                            <span className="text-[10px] text-muted-foreground/50 font-black uppercase tracking-[0.15em]">Avance</span>
                            <div className="text-2xl font-black tracking-tighter text-foreground flex items-baseline gap-0.5">
                                <CounterAnimation value={displayProgress} />
                                <span className="text-xs font-bold opacity-30">%</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2.5 pt-2">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 px-3 py-2 rounded-xl bg-muted/30 border border-border/40 flex flex-col items-center">
                                <span className="text-[8px] font-bold text-destructive/60 uppercase tracking-widest">Negativo</span>
                                <span className="text-xs font-black text-destructive">
                                    <CounterAnimation value={negativeValue} prefix="$" />
                                </span>
                            </div>
                            <div className="flex-1 px-3 py-2 rounded-xl bg-muted/30 border border-border/40 flex flex-col items-center">
                                <span className="text-[8px] font-bold text-success/60 uppercase tracking-widest">Positivo</span>
                                <span className="text-xs font-black text-success">
                                    +<CounterAnimation value={positiveValue} prefix="$" />
                                </span>
                            </div>
                        </div>

                        <div className="relative h-1.5 w-full bg-muted/40 rounded-full overflow-hidden mt-2">
                            <Progress value={displayProgress} className="h-full w-full" indicatorClassName={`${config.barColor} rounded-full transition-all duration-1000`} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

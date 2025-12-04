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
    const displayProgress = status === 'controlado' ? 100 : status === 'pendiente' ? 0 : progress || 0;

    return (
        <Card
            className={`group hover:shadow-md transition-all duration-200 border cursor-pointer overflow-hidden relative`}
            onClick={onClick}
        >
            {/* Status Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.barColor}`} />

            <CardContent className="p-4 pl-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-full ${config.bgColor}`}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <h3 className="font-semibold text-base truncate" title={name}>
                            {name}
                        </h3>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valorizado (Diferencias)</span>

                        <div className="flex items-baseline gap-2">
                            {/* Difference (Sum) */}
                            <span className={`text-lg font-bold font-mono tracking-tight ${differenceValue < 0 ? 'text-destructive' : differenceValue > 0 ? 'text-success' : 'text-foreground'}`}>
                                {differenceValue > 0 ? '+' : ''}<CounterAnimation value={differenceValue} prefix="$" />
                            </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs font-mono mt-1">
                            {/* Negative */}
                            <span className="text-destructive flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-destructive mr-1"></span>
                                <CounterAnimation value={negativeValue} prefix="$" />
                            </span>

                            {/* Positive */}
                            <span className="text-success flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-success mr-1"></span>
                                +<CounterAnimation value={positiveValue} prefix="$" />
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`${config.color} ${config.borderColor} bg-transparent h-5 px-1.5 text-[10px]`}>
                                    {config.label}
                                </Badge>
                            </div>
                            <span>{displayProgress}%</span>
                        </div>
                        <Progress value={displayProgress} className="h-1.5" indicatorClassName={config.barColor} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

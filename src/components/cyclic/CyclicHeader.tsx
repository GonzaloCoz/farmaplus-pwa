import { ArrowLeft, MoreVertical, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CounterAnimation } from '@/components/CounterAnimation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useOnlineStatus } from '@/hooks/useOnlineStatus'; // Assuming this exists or I'll standard check

interface CyclicHeaderProps {
    labName: string;
    totalItems: number;
    controlledCount: number;
    adjustedCount: number;
    pendingCount: number;
    onBack: () => void;
}

export function CyclicHeader({ labName, totalItems, controlledCount, adjustedCount, pendingCount, onBack }: CyclicHeaderProps) {
    const isOnline = navigator.onLine; // Simple check for now
    const progress = totalItems > 0 ? Math.round(((controlledCount + adjustedCount) / totalItems) * 100) : 0;

    return (
        <div className="bg-background/80 backdrop-blur-md sticky top-0 z-40 border-b pb-4 pt-2 px-4 -mx-4 md:mx-auto md:px-0 md:pt-0 mb-6 space-y-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold leading-none">{labName}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">Inventario Cíclico</span>
                            {isOnline ? (
                                <Badge variant="outline" className="h-5 gap-1 text-[10px] px-1.5 bg-green-500/10 text-green-600 border-green-200">
                                    <Wifi className="w-3 h-3" /> Online
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="h-5 gap-1 text-[10px] px-1.5 bg-red-500/10 text-red-600 border-red-200">
                                    <WifiOff className="w-3 h-3" /> Offline
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Progress Circle (Compact) */}
                <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold leading-none text-primary">
                        <CounterAnimation value={progress} />%
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Avance</span>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted/30 rounded-lg p-2.5 flex flex-col items-center justify-center border">
                    <span className="text-lg font-bold text-foreground/80 leading-tight">{controlledCount}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">OK</span>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-2.5 flex flex-col items-center justify-center border border-blue-500/20">
                    <span className="text-lg font-bold text-blue-600 leading-tight">{adjustedCount}</span>
                    <span className="text-[10px] text-blue-600/80 uppercase font-medium">Ajustados</span>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-2.5 flex flex-col items-center justify-center border border-orange-500/20">
                    <span className="text-lg font-bold text-orange-600 leading-tight">{pendingCount}</span>
                    <span className="text-[10px] text-orange-600/80 uppercase font-medium">Pendientes</span>
                </div>
            </div>
        </div>
    );
}

import { cn } from '@/lib/utils';
import { WidgetSpan } from '@/types/dashboard';
import { Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WidgetSpanSelectorProps {
    currentSpan: WidgetSpan;
    onChange: (span: WidgetSpan) => void;
    maxSpan?: WidgetSpan;
}

const SPAN_CONFIG = {
    1: {
        label: '1 Casillero',
        icon: Minimize2,
        description: 'Tamaño estándar',
    },
    2: {
        label: '2 Casilleros',
        icon: Maximize2,
        description: 'Doble ancho',
    },
};

export function WidgetSpanSelector({
    currentSpan,
    onChange,
    maxSpan = 2,
}: WidgetSpanSelectorProps) {
    const CurrentIcon = SPAN_CONFIG[currentSpan].icon;

    const availableSpans: WidgetSpan[] = maxSpan === 2 ? [1, 2] : [1];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Cambiar expansión"
                >
                    <CurrentIcon className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {availableSpans.map((span) => {
                    const config = SPAN_CONFIG[span];
                    const Icon = config.icon;
                    return (
                        <DropdownMenuItem
                            key={span}
                            onClick={() => onChange(span)}
                            className={cn(
                                'flex items-center gap-2',
                                currentSpan === span && 'bg-accent'
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{config.label}</span>
                                <span className="text-xs text-muted-foreground">
                                    {config.description}
                                </span>
                            </div>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

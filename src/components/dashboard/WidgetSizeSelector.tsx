import { cn } from '@/lib/utils';
import { WidgetSize } from '@/types/dashboard';
import { Maximize2, Minimize2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WidgetSizeSelectorProps {
    currentSize: WidgetSize;
    onChange: (size: WidgetSize) => void;
    availableSizes?: WidgetSize[];
}

const SIZE_CONFIG = {
    small: {
        label: 'Pequeño',
        icon: Minimize2,
        description: '1/4 ancho (3 cols)',
    },
    medium: {
        label: 'Mediano',
        icon: Square,
        description: '1/2 ancho (6 cols)',
    },
    large: {
        label: 'Grande',
        icon: Maximize2,
        description: '1/3 ancho (4 cols)',
    },
    full: {
        label: 'Ancho completo',
        icon: Maximize2,
        description: 'Ancho completo (12 cols)',
    },
};

export function WidgetSizeSelector({
    currentSize,
    onChange,
    availableSizes = ['small', 'medium', 'large'],
}: WidgetSizeSelectorProps) {
    const CurrentIcon = SIZE_CONFIG[currentSize].icon;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Cambiar tamaño"
                >
                    <CurrentIcon className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {availableSizes.map((size) => {
                    const config = SIZE_CONFIG[size];
                    const Icon = config.icon;
                    return (
                        <DropdownMenuItem
                            key={size}
                            onClick={() => onChange(size)}
                            className={cn(
                                'flex items-center gap-2',
                                currentSize === size && 'bg-accent'
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

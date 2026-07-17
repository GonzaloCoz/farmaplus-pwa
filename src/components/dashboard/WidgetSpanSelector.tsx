import { cn } from '@/lib/utils';
import { WidgetSpan } from '@/types/dashboard';
import { Minimize01 as Minimize, Maximize01 as Maximize } from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    MenuItem,
} from '@/components/ui/dropdown';

interface WidgetSpanSelectorProps {
    currentSpan: WidgetSpan;
    onChange: (span: WidgetSpan) => void;
    maxSpan?: WidgetSpan;
}

const SPAN_CONFIG = {
    1: {
        label: '1 Casillero',
        icon: Minimize,
        description: 'Tamaño estándar',
    },
    2: {
        label: '2 Casilleros',
        icon: Maximize,
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
            <DropdownTrigger render={
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Cambiar expansión"
                >
                    <CurrentIcon className="h-4 w-4" />
                </Button>
            } />
            <DropdownContent align="end">
                {availableSpans.map((span, index) => {
                    const config = SPAN_CONFIG[span];
                    return (
                        <MenuItem
                            key={span}
                            index={index}
                            icon={config.icon}
                            label={config.label}
                            onSelect={() => onChange(span)}
                            checked={currentSpan === span}
                        />
                    );
                })}
            </DropdownContent>
        </DropdownMenu>
    );
}

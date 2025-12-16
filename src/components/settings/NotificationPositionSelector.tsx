import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationPosition } from '@/contexts/NotificationPreferencesContext';

interface PositionOption {
    value: NotificationPosition;
    label: string;
    preview: React.ReactNode;
}

interface NotificationPositionSelectorProps {
    value: NotificationPosition;
    onChange: (position: NotificationPosition) => void;
}

const PositionPreview = ({ position }: { position: NotificationPosition }) => {
    return (
        <div className="relative w-full h-32 bg-muted/30 rounded-lg border overflow-hidden">
            {/* Mini screen representation */}
            <div className="absolute inset-2 border-2 border-muted-foreground/20 rounded">
                {/* Header bar */}
                <div className="h-3 bg-muted-foreground/10 border-b border-muted-foreground/20 flex items-center px-1.5 gap-1">
                    <Bell className="w-2 h-2 text-muted-foreground/40" />
                    <div className="flex-1 flex gap-0.5">
                        <div className="h-1 w-8 bg-muted-foreground/20 rounded-full" />
                        <div className="h-1 w-6 bg-muted-foreground/20 rounded-full" />
                    </div>
                </div>

                {/* Content area with lines */}
                <div className="p-2 space-y-1">
                    <div className="h-1.5 w-full bg-muted-foreground/10 rounded" />
                    <div className="h-1.5 w-3/4 bg-muted-foreground/10 rounded" />
                    <div className="h-1.5 w-5/6 bg-muted-foreground/10 rounded" />
                    <div className="h-1.5 w-2/3 bg-muted-foreground/10 rounded" />
                </div>

                {/* Notification toast preview */}
                <div
                    className={cn(
                        "absolute w-16 h-6 bg-primary/90 rounded shadow-lg flex items-center justify-center",
                        position === 'top-right' && "top-2 right-2",
                        position === 'bottom-right' && "bottom-2 right-2",
                        position === 'bottom-center' && "bottom-2 left-1/2 -translate-x-1/2"
                    )}
                >
                    <div className="w-10 h-3 bg-background/90 rounded-sm" />
                </div>
            </div>
        </div>
    );
};

export function NotificationPositionSelector({ value, onChange }: NotificationPositionSelectorProps) {
    const positions: PositionOption[] = [
        {
            value: 'top-right',
            label: 'Arriba a la derecha',
            preview: <PositionPreview position="top-right" />,
        },
        {
            value: 'bottom-right',
            label: 'Abajo a la derecha',
            preview: <PositionPreview position="bottom-right" />,
        },
        {
            value: 'bottom-center',
            label: 'Abajo al centro',
            preview: <PositionPreview position="bottom-center" />,
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {positions.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border-2 transition-all hover:border-primary/50",
                        value === option.value
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background"
                    )}
                >
                    {option.preview}

                    <div className="flex items-center justify-center gap-2">
                        <div
                            className={cn(
                                "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                                value === option.value
                                    ? "border-primary"
                                    : "border-muted-foreground/30"
                            )}
                        >
                            {value === option.value && (
                                <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                        </div>
                        <span className={cn(
                            "text-sm font-medium transition-colors",
                            value === option.value ? "text-foreground" : "text-muted-foreground"
                        )}>
                            {option.label}
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}

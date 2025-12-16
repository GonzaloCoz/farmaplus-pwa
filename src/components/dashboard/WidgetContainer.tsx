import { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Widget, WidgetSize } from '@/types/dashboard';
import { WIDGET_SIZES, WIDGET_HEIGHTS } from '@/types/dashboard';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { WidgetSizeSelector } from './WidgetSizeSelector';

interface WidgetContainerProps {
    widget: Widget;
    isEditMode: boolean;
    onRemove?: () => void;
    onSizeChange?: (newSize: WidgetSize) => void;
    children: ReactNode;
}

export function WidgetContainer({ widget, isEditMode, onRemove, onSizeChange, children }: WidgetContainerProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: widget.id, disabled: !isEditMode });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                WIDGET_SIZES[widget.size],
                isDragging && 'opacity-50 z-50',
                isEditMode && 'cursor-move',
                WIDGET_HEIGHTS[widget.size] // Altura según el tamaño del widget
            )}
        >
            <AnimatedCard hoverEffect={isEditMode ? 'none' : 'lift'} className="h-full">
                <div className={cn(
                    'relative h-full transition-all rounded-lg',
                    isEditMode && 'ring-2 ring-primary/20 hover:ring-primary/40'
                )}>
                    {isEditMode && (
                        <div className="absolute top-2 right-2 z-10 flex gap-1">
                            {onSizeChange && (
                                <WidgetSizeSelector
                                    currentSize={widget.size}
                                    onChange={onSizeChange}
                                />
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 cursor-grab active:cursor-grabbing"
                                {...attributes}
                                {...listeners}
                            >
                                <GripVertical className="h-4 w-4" />
                            </Button>
                            {!widget.mandatory && onRemove && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={onRemove}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                    <div className="h-full">
                        {children}
                    </div>
                </div>
            </AnimatedCard>
        </div>
    );
}

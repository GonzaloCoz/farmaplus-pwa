import { ReactNode, memo } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Widget } from '@/types/dashboard';
import { WIDGET_SIZES, WIDGET_HEIGHTS } from '@/types/dashboard';

interface WidgetContainerProps {
    widget: Widget;
    children: ReactNode;
}

export const WidgetContainer = memo(({ widget, children }: WidgetContainerProps) => {
    return (
        <div
            className={cn(
                WIDGET_SIZES[widget.size],
                WIDGET_HEIGHTS[widget.size]
            )}
        >
            <Card className="h-full transition-all duration-300 overflow-hidden relative group/card hover:shadow-md @container">
                <div className="h-full no-scrollbar">
                    {children}
                </div>
            </Card>
        </div>
    );
});

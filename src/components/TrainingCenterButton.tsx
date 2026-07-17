import React from "react";
import { BookOpen01 as NotebookBookmark } from '@untitledui/icons';
import { cn } from "@/lib/utils";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { surfaceClasses } from "@/lib/surface-classes";
import { Button } from "@/components/ui/button";

interface TrainingCenterButtonProps {
    className?: string;
}

export function TrainingCenterButton({
    className
}: TrainingCenterButtonProps) {
    const { openWindow } = useWindowManager();
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    const handleOpenForo = () => {
        openWindow("/foro", "Centro de Capacitación");
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenForo}
            className={cn(
                "shrink-0 cursor-pointer",
                surfaceClasses(3),
                className
            )}
            style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
            title="Centro de Capacitación"
        >
            <NotebookBookmark className="w-5 h-5 text-current" />
        </Button>
    );
}

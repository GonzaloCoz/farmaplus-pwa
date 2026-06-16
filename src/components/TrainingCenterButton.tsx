import React from "react";
import { NotebookBookmark } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useWindowManager } from "@/contexts/WindowManagerContext";

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
        <button
            onClick={handleOpenForo}
            className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                className
            )}
            style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
            title="Centro de Capacitación"
        >
            <NotebookBookmark className="w-[18px] h-[18px] text-secondary-foreground" />
        </button>
    );
}

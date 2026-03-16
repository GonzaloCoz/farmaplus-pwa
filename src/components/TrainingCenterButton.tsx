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

    const handleOpenForo = () => {
        openWindow("/foro", "Centro de Capacitación");
    };

    return (
        <button
            onClick={handleOpenForo}
            className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 border border-border/40 hover:bg-muted/80 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                className
            )}
            title="Centro de Capacitación"
        >
            <NotebookBookmark className="w-5 h-5 text-muted-foreground" />
        </button>
    );
}

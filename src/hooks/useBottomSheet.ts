import { useState, useCallback, useEffect } from "react";

interface UseBottomSheetOptions {
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function useBottomSheet(options: UseBottomSheetOptions = {}) {
    const [isOpen, setIsOpen] = useState(options.defaultOpen ?? false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragY, setDragY] = useState(0);

    const open = useCallback(() => {
        setIsOpen(true);
        options.onOpenChange?.(true);
    }, [options]);

    const close = useCallback(() => {
        setIsOpen(false);
        setDragY(0);
        options.onOpenChange?.(false);
    }, [options]);

    const toggle = useCallback(() => {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }, [isOpen, open, close]);

    const handleDragStart = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleDrag = useCallback((y: number) => {
        if (y > 0) {
            setDragY(y);
        }
    }, []);

    const handleDragEnd = useCallback(
        (velocity: number) => {
            setIsDragging(false);

            // Close if dragged down significantly or with high velocity
            if (dragY > 100 || velocity > 500) {
                close();
            } else {
                setDragY(0);
            }
        },
        [dragY, close]
    );

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    return {
        isOpen,
        open,
        close,
        toggle,
        isDragging,
        dragY,
        handleDragStart,
        handleDrag,
        handleDragEnd,
    };
}

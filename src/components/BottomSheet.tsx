import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect } from "react";

export type BottomSheetVariant = "modal" | "standard";

interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    variant?: BottomSheetVariant;
    snapPoints?: number[]; // Percentage heights [50, 100]
    className?: string;
    showHandle?: boolean;
}

export function BottomSheet({
    open,
    onClose,
    children,
    title,
    variant = "modal",
    snapPoints = [100],
    className,
    showHandle = true,
}: BottomSheetProps) {
    const maxHeight = Math.max(...snapPoints);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    const handleDragEnd = (_: any, info: PanInfo) => {
        const shouldClose = info.velocity.y > 500 || info.offset.y > 100;
        if (shouldClose) {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    {variant === "modal" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/50 z-40"
                        />
                    )}

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.5 }}
                        onDragEnd={handleDragEnd}
                        transition={{ type: "spring", stiffness: 400, damping: 40 }}
                        className={cn(
                            "fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl elevation-5",
                            className
                        )}
                        style={{ maxHeight: `${maxHeight}vh` }}
                    >
                        {/* Drag Handle */}
                        {showHandle && (
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
                            </div>
                        )}

                        {/* Header */}
                        {title && (
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                <h2 className="text-title-large font-semibold">{title}</h2>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={onClose}
                                    className="p-2 hover:bg-secondary rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </motion.button>
                            </div>
                        )}

                        {/* Content */}
                        <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: `${maxHeight - 20}vh` }}>
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

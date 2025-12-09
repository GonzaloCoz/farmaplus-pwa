import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "primary" | "success" | "warning" | "destructive";
export type BadgeSize = "small" | "medium" | "large";

interface BadgeProps {
    content?: string | number;
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
    show?: boolean;
    max?: number;
    children?: React.ReactNode;
    className?: string;
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

export function Badge({
    content,
    variant = "default",
    size = "medium",
    dot = false,
    show = true,
    max = 99,
    children,
    className,
    position = "top-right",
}: BadgeProps) {
    const displayContent =
        typeof content === "number" && content > max ? `${max}+` : content;

    const sizeClasses = {
        small: dot ? "w-1.5 h-1.5" : "min-w-[16px] h-4 text-[10px] px-1",
        medium: dot ? "w-2 h-2" : "min-w-[20px] h-5 text-xs px-1.5",
        large: dot ? "w-2.5 h-2.5" : "min-w-[24px] h-6 text-sm px-2",
    };

    const variantClasses = {
        default: "bg-primary text-primary-foreground",
        primary: "bg-primary text-primary-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        destructive: "bg-destructive text-destructive-foreground",
    };

    const positionClasses = {
        "top-right": "top-0 right-0 translate-x-1/2 -translate-y-1/2",
        "top-left": "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
        "bottom-right": "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
        "bottom-left": "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    };

    if (!children) {
        return (
            <AnimatePresence>
                {show && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn(
                            "inline-flex items-center justify-center rounded-full font-medium",
                            sizeClasses[size],
                            variantClasses[variant],
                            className
                        )}
                    >
                        {!dot && displayContent}
                    </motion.span>
                )}
            </AnimatePresence>
        );
    }

    return (
        <div className="relative inline-flex">
            {children}
            <AnimatePresence>
                {show && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={cn(
                            "absolute inline-flex items-center justify-center rounded-full font-medium elevation-2",
                            sizeClasses[size],
                            variantClasses[variant],
                            positionClasses[position],
                            className
                        )}
                    >
                        {!dot && displayContent}
                    </motion.span>
                )}
            </AnimatePresence>
        </div>
    );
}

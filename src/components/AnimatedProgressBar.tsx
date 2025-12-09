import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedProgressBarProps {
    value?: number; // 0-100, undefined for indeterminate
    variant?: "default" | "primary" | "success" | "warning" | "destructive";
    size?: "small" | "medium" | "large";
    showLabel?: boolean;
    className?: string;
}

const variantColors = {
    default: "bg-foreground",
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
};

const sizeClasses = {
    small: "h-1",
    medium: "h-2",
    large: "h-3",
};

export function AnimatedProgressBar({
    value,
    variant = "primary",
    size = "medium",
    showLabel = false,
    className,
}: AnimatedProgressBarProps) {
    const isIndeterminate = value === undefined;
    const progress = isIndeterminate ? 0 : Math.min(100, Math.max(0, value));

    return (
        <div className={cn("w-full", className)}>
            {showLabel && !isIndeterminate && (
                <div className="flex justify-between items-center mb-1">
                    <span className="text-label-small text-muted-foreground">
                        {Math.round(progress)}%
                    </span>
                </div>
            )}

            <div
                className={cn(
                    "w-full bg-secondary rounded-full overflow-hidden",
                    sizeClasses[size]
                )}
            >
                {isIndeterminate ? (
                    <motion.div
                        className={cn("h-full rounded-full", variantColors[variant])}
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        style={{ width: "40%" }}
                    />
                ) : (
                    <motion.div
                        className={cn("h-full rounded-full", variantColors[variant])}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{
                            duration: 0.6,
                            ease: [0.4, 0.0, 0.2, 1],
                        }}
                    />
                )}
            </div>
        </div>
    );
}

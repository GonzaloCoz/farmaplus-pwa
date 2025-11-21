import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface AnimatedProgressBarProps {
    value: number;
    max?: number;
    className?: string;
    barClassName?: string;
    showLabel?: boolean;
    duration?: number;
}

export function AnimatedProgressBar({
    value,
    max = 100,
    className = "",
    barClassName = "",
    showLabel = false,
    duration = 0.5,
}: AnimatedProgressBarProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const percentage = Math.min((value / max) * 100, 100);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDisplayValue(percentage);
        }, 50);
        return () => clearTimeout(timer);
    }, [percentage]);

    return (
        <div className={`relative w-full ${className}`}>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div
                    className={`h-full bg-primary rounded-full ${barClassName}`}
                    initial={{ width: "0%" }}
                    animate={{ width: `${displayValue}%` }}
                    transition={{
                        duration,
                        ease: [0.2, 0.0, 0, 1.0],
                    }}
                />
            </div>
            {showLabel && (
                <motion.span
                    className="absolute right-0 -top-6 text-xs font-medium text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {Math.round(displayValue)}%
                </motion.span>
            )}
        </div>
    );
}

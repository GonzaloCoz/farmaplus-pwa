import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
    value?: number; // 0-100, undefined for indeterminate
    size?: "small" | "medium" | "large";
    variant?: "default" | "primary" | "success" | "warning" | "destructive";
    thickness?: number;
    className?: string;
    showLabel?: boolean;
}

const sizeConfig = {
    small: { dimension: 24, strokeWidth: 3 },
    medium: { dimension: 40, strokeWidth: 4 },
    large: { dimension: 56, strokeWidth: 5 },
};

const variantColors = {
    default: "stroke-foreground",
    primary: "stroke-primary",
    success: "stroke-success",
    warning: "stroke-warning",
    destructive: "stroke-destructive",
};

export function CircularProgress({
    value,
    size = "medium",
    variant = "primary",
    thickness,
    className,
    showLabel = false,
}: CircularProgressProps) {
    const { dimension, strokeWidth: defaultStrokeWidth } = sizeConfig[size];
    const strokeWidth = thickness ?? defaultStrokeWidth;
    const radius = (dimension - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const isIndeterminate = value === undefined;

    const strokeDashoffset = isIndeterminate
        ? circumference * 0.75
        : circumference - (value / 100) * circumference;

    return (
        <div className={cn("relative inline-flex items-center justify-center", className)}>
            <svg
                width={dimension}
                height={dimension}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={dimension / 2}
                    cy={dimension / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="opacity-20"
                />

                {/* Progress circle */}
                <motion.circle
                    cx={dimension / 2}
                    cy={dimension / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className={cn(variantColors[variant])}
                    initial={false}
                    animate={
                        isIndeterminate
                            ? {
                                rotate: 360,
                                strokeDashoffset: [
                                    circumference * 0.75,
                                    circumference * 0.25,
                                    circumference * 0.75,
                                ],
                            }
                            : { strokeDashoffset }
                    }
                    transition={
                        isIndeterminate
                            ? {
                                rotate: {
                                    duration: 1.4,
                                    repeat: Infinity,
                                    ease: "linear",
                                },
                                strokeDashoffset: {
                                    duration: 1.4,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                },
                            }
                            : {
                                duration: 0.6,
                                ease: [0.4, 0.0, 0.2, 1],
                            }
                    }
                />
            </svg>

            {showLabel && !isIndeterminate && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-label-small font-medium">{Math.round(value)}%</span>
                </div>
            )}
        </div>
    );
}

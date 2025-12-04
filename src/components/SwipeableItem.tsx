import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ReactNode, useState } from "react";
import { Trash2, Pencil, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";

export interface SwipeAction {
    label: string;
    icon: ReactNode;
    color: string; // Tailwind text color class (e.g., "text-green-500")
    bgColor: string; // CSS color for background interpolation (e.g., "rgba(34, 197, 94, 0.2)")
    onAction: () => void;
}

interface SwipeableItemProps {
    children: ReactNode;
    leftAction?: SwipeAction; // Action when swiping RIGHT (e.g., Confirm)
    rightAction?: SwipeAction; // Action when swiping LEFT (e.g., Delete/Edit)
    className?: string;
    threshold?: number;
    disabled?: boolean;
}

export function SwipeableItem({
    children,
    leftAction,
    rightAction,
    className,
    threshold = 60,
    disabled = false
}: SwipeableItemProps) {
    const x = useMotionValue(0);
    const [isDragging, setIsDragging] = useState(false);

    // Transform x value to background colors/opacity
    const leftOpacity = useTransform(x, [0, threshold], [0, 1]); // Visible when swiping right
    const rightOpacity = useTransform(x, [-threshold, 0], [1, 0]); // Visible when swiping left

    // Background color interpolation
    const backgroundColor = useTransform(
        x,
        [-threshold, 0, threshold],
        [
            rightAction?.bgColor || "rgba(0,0,0,0)",
            "rgba(0,0,0,0)",
            leftAction?.bgColor || "rgba(0,0,0,0)"
        ]
    );

    const { trigger } = useHaptic();
    const [hasTriggered, setHasTriggered] = useState(false);

    const handleDragEnd = (_: any, info: PanInfo) => {
        setIsDragging(false);
        setHasTriggered(false);

        if (disabled) return;

        if (info.offset.x < -threshold && rightAction) {
            rightAction.onAction();
        } else if (info.offset.x > threshold && leftAction) {
            leftAction.onAction();
        }
    };

    const handleDrag = (_: any, info: PanInfo) => {
        if (disabled) return;

        const offset = info.offset.x;
        if (!hasTriggered) {
            if ((offset < -threshold && rightAction) || (offset > threshold && leftAction)) {
                trigger('selection');
                setHasTriggered(true);
            }
        } else {
            if (offset > -threshold && offset < threshold) {
                setHasTriggered(false);
            }
        }
    };

    return (
        <div className={cn("relative overflow-hidden rounded-xl", className)}>
            {/* Background Actions Layer */}
            <motion.div
                className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none"
                style={{ backgroundColor }}
            >
                {/* Left Action (Visible when swiping RIGHT) */}
                <motion.div style={{ opacity: leftOpacity }} className={cn("flex items-center", leftAction?.color)}>
                    {leftAction?.icon}
                    <span className="font-medium ml-2">{leftAction?.label}</span>
                </motion.div>

                {/* Right Action (Visible when swiping LEFT) */}
                <motion.div style={{ opacity: rightOpacity }} className={cn("flex items-center", rightAction?.color)}>
                    <span className="font-medium mr-2">{rightAction?.label}</span>
                    {rightAction?.icon}
                </motion.div>
            </motion.div>

            {/* Foreground Content Layer */}
            <motion.div
                drag={disabled ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragStart={() => setIsDragging(true)}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                style={{ x, touchAction: "none" }}
                className="relative bg-card z-10"
                whileTap={{ cursor: disabled ? "default" : "grabbing" }}
            >
                {children}
            </motion.div>
        </div>
    );
}

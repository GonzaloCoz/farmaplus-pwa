import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ReactNode, useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";

interface SwipeableItemProps {
    children: ReactNode;
    onDelete?: () => void;
    onEdit?: () => void;
    className?: string;
    threshold?: number;
}

export function SwipeableItem({
    children,
    onDelete,
    onEdit,
    className,
    threshold = 60,
}: SwipeableItemProps) {
    const x = useMotionValue(0);
    const [isDragging, setIsDragging] = useState(false);

    // Transform x value to background colors/opacity
    const deleteOpacity = useTransform(x, [-threshold, 0], [1, 0]);
    const editOpacity = useTransform(x, [0, threshold], [0, 1]);

    // Background color interpolation
    const backgroundColor = useTransform(
        x,
        [-threshold, 0, threshold],
        ["rgba(239, 68, 68, 0.2)", "rgba(0,0,0,0)", "rgba(59, 130, 246, 0.2)"]
    );

    const { trigger } = useHaptic();
    const [hasTriggered, setHasTriggered] = useState(false);

    const handleDragEnd = (_: any, info: PanInfo) => {
        setIsDragging(false);
        setHasTriggered(false); // Reset trigger state
        if (info.offset.x < -threshold && onDelete) {
            onDelete();
        } else if (info.offset.x > threshold && onEdit) {
            onEdit();
        }
    };

    const handleDrag = (_: any, info: PanInfo) => {
        const offset = info.offset.x;
        if (!hasTriggered) {
            if (offset < -threshold || offset > threshold) {
                trigger('selection');
                setHasTriggered(true);
            }
        } else {
            // Reset if user goes back below threshold
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
                {/* Edit Action (Left side, visible when swiping right) */}
                <motion.div style={{ opacity: editOpacity }} className="flex items-center text-blue-500">
                    <Pencil className="w-5 h-5 mr-2" />
                    <span className="font-medium">Editar</span>
                </motion.div>

                {/* Delete Action (Right side, visible when swiping left) */}
                <motion.div style={{ opacity: deleteOpacity }} className="flex items-center text-red-500">
                    <span className="font-medium mr-2">Eliminar</span>
                    <Trash2 className="w-5 h-5" />
                </motion.div>
            </motion.div>

            {/* Foreground Content Layer */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragStart={() => setIsDragging(true)}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                style={{ x, touchAction: "none" }}
                className="relative bg-card z-10"
                whileTap={{ cursor: "grabbing" }}
            >
                {children}
            </motion.div>
        </div>
    );
}

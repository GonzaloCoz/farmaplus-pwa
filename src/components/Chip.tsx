import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipVariant = "filter" | "input" | "suggestion" | "assist";

interface ChipProps {
    label: string;
    variant?: ChipVariant;
    selected?: boolean;
    onSelect?: () => void;
    onDelete?: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    className?: string;
}

export function Chip({
    label,
    variant = "filter",
    selected = false,
    onSelect,
    onDelete,
    icon,
    disabled = false,
    className,
}: ChipProps) {
    const isClickable = variant === "filter" || variant === "suggestion";
    const isDeletable = variant === "input" && onDelete;

    return (
        <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={!disabled ? { scale: 1.05 } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
            onClick={isClickable ? onSelect : undefined}
            disabled={disabled}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-large transition-all duration-200",
                "border elevation-1 hover:elevation-2",
                selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-secondary",
                disabled && "opacity-50 cursor-not-allowed",
                !disabled && isClickable && "cursor-pointer",
                className
            )}
        >
            {icon && <span className="w-4 h-4">{icon}</span>}
            <span>{label}</span>
            {isDeletable && (
                <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.();
                    }}
                    className="ml-1 hover:bg-foreground/10 rounded-full p-0.5"
                >
                    <X className="w-3 h-3" />
                </motion.button>
            )}
        </motion.button>
    );
}

interface ChipGroupProps {
    children: React.ReactNode;
    className?: string;
}

export function ChipGroup({ children, className }: ChipGroupProps) {
    return (
        <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
    );
}

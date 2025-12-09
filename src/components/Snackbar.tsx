import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export type SnackbarVariant = "default" | "success" | "warning" | "error" | "info";

export interface SnackbarProps {
    open: boolean;
    onClose: () => void;
    message: string;
    variant?: SnackbarVariant;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
    position?: "bottom" | "top";
    className?: string;
}

const variantConfig = {
    default: {
        icon: Info,
        className: "bg-card text-card-foreground border-border",
    },
    success: {
        icon: CheckCircle,
        className: "bg-success/10 text-success border-success/20",
    },
    warning: {
        icon: AlertTriangle,
        className: "bg-warning/10 text-warning border-warning/20",
    },
    error: {
        icon: AlertCircle,
        className: "bg-destructive/10 text-destructive border-destructive/20",
    },
    info: {
        icon: Info,
        className: "bg-primary/10 text-primary border-primary/20",
    },
};

export function Snackbar({
    open,
    onClose,
    message,
    variant = "default",
    duration = 4000,
    action,
    position = "bottom",
    className,
}: SnackbarProps) {
    const config = variantConfig[variant];
    const Icon = config.icon;

    useEffect(() => {
        if (open && duration > 0) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [open, duration, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ y: position === "bottom" ? 100 : -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: position === "bottom" ? 100 : -100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    className={cn(
                        "fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border elevation-3 min-w-[300px] max-w-[500px]",
                        position === "bottom" ? "bottom-6" : "top-6",
                        config.className,
                        className
                    )}
                >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <p className="flex-1 text-body-medium">{message}</p>
                    {action && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                action.onClick();
                                onClose();
                            }}
                            className="text-label-large font-semibold hover:opacity-80 transition-opacity"
                        >
                            {action.label}
                        </motion.button>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onClose}
                        className="hover:bg-foreground/10 rounded-full p-1 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </motion.button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

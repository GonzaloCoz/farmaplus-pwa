import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export type FabVariant = "primary" | "secondary" | "tertiary" | "surface";
export type FabSize = "small" | "medium" | "large";

interface ExtendedFabProps {
    icon?: React.ReactNode;
    label?: string;
    onClick?: () => void;
    variant?: FabVariant;
    size?: FabSize;
    extended?: boolean;
    autoHide?: boolean; // Hide on scroll down, show on scroll up
    className?: string;
}

const variantClasses = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    tertiary: "bg-tertiary text-tertiary-foreground hover:bg-tertiary/90",
    surface: "bg-surface text-surface-foreground hover:bg-surface/90 border border-border",
};

const sizeClasses = {
    small: "w-10 h-10",
    medium: "w-14 h-14",
    large: "w-16 h-16",
};

export function ExtendedFab({
    icon = <Plus className="w-6 h-6" />,
    label,
    onClick,
    variant = "primary",
    size = "medium",
    extended = false,
    autoHide = false,
    className,
}: ExtendedFabProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [prevScrollY, setPrevScrollY] = useState(0);
    const { scrollY } = useScroll();

    useEffect(() => {
        if (!autoHide) return;

        const unsubscribe = scrollY.on("change", (latest) => {
            if (latest > prevScrollY && latest > 100) {
                setIsVisible(false);
            } else if (latest < prevScrollY) {
                setIsVisible(true);
            }
            setPrevScrollY(latest);
        });

        return () => unsubscribe();
    }, [scrollY, prevScrollY, autoHide]);

    const isExtended = extended && label;

    return (
        <motion.button
            initial={{ scale: 0 }}
            animate={{
                scale: isVisible ? 1 : 0,
                width: isExtended ? "auto" : undefined,
            }}
            whileHover={{ scale: isVisible ? 1.05 : 0 }}
            whileTap={{ scale: isVisible ? 0.95 : 0 }}
            onClick={onClick}
            className={cn(
                "fixed bottom-20 right-6 z-40 rounded-full elevation-3 hover:elevation-4 transition-all duration-200",
                "flex items-center justify-center gap-2 font-medium",
                variantClasses[variant],
                !isExtended && sizeClasses[size],
                isExtended && "px-4 py-3",
                className
            )}
        >
            <motion.span
                animate={{ rotate: isExtended ? 0 : 0 }}
                transition={{ duration: 0.2 }}
            >
                {icon}
            </motion.span>
            {isExtended && (
                <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="text-label-large whitespace-nowrap overflow-hidden"
                >
                    {label}
                </motion.span>
            )}
        </motion.button>
    );
}

// Mini FAB variant
interface MiniFabProps {
    icon?: React.ReactNode;
    onClick?: () => void;
    variant?: FabVariant;
    className?: string;
}

export function MiniFab({
    icon = <Plus className="w-5 h-5" />,
    onClick,
    variant = "primary",
    className,
}: MiniFabProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClick}
            className={cn(
                "w-10 h-10 rounded-full elevation-2 hover:elevation-3 transition-all duration-200",
                "flex items-center justify-center",
                variantClasses[variant],
                className
            )}
        >
            {icon}
        </motion.button>
    );
}

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Badge } from "./Badge";

export interface NavigationItem {
    id: string;
    label: string;
    icon: LucideIcon;
    badge?: number;
    disabled?: boolean;
}

interface NavigationRailProps {
    items: NavigationItem[];
    activeItem: string;
    onChange: (itemId: string) => void;
    fab?: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

export function NavigationRail({
    items,
    activeItem,
    onChange,
    fab,
    header,
    footer,
    className,
}: NavigationRailProps) {
    return (
        <motion.nav
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className={cn(
                "hidden md:flex flex-col w-20 bg-surface border-r border-border elevation-1",
                "fixed left-0 top-0 bottom-0 z-30",
                className
            )}
        >
            {/* Header */}
            {header && (
                <div className="flex items-center justify-center py-4 border-b border-border">
                    {header}
                </div>
            )}

            {/* FAB */}
            {fab && (
                <div className="flex items-center justify-center py-4">
                    {fab}
                </div>
            )}

            {/* Navigation Items */}
            <div className="flex-1 flex flex-col gap-3 py-4 overflow-y-auto">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeItem === item.id;

                    return (
                        <motion.button
                            key={item.id}
                            onClick={() => !item.disabled && onChange(item.id)}
                            disabled={item.disabled}
                            whileHover={!item.disabled ? { scale: 1.05 } : {}}
                            whileTap={!item.disabled ? { scale: 0.95 } : {}}
                            className={cn(
                                "relative flex flex-col items-center justify-center gap-1 py-3 px-2 mx-2 rounded-xl transition-colors",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                                item.disabled && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <motion.div
                                    layoutId="rail-indicator"
                                    className="absolute inset-0 bg-secondary rounded-xl"
                                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                                />
                            )}

                            <div className="relative z-10">
                                <Badge
                                    content={item.badge}
                                    variant="destructive"
                                    size="small"
                                    show={!!item.badge && item.badge > 0}
                                    position="top-right"
                                >
                                    <Icon className="w-6 h-6" />
                                </Badge>
                            </div>

                            <span className="relative z-10 text-label-small font-medium">
                                {item.label}
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            {/* Footer */}
            {footer && (
                <div className="flex items-center justify-center py-4 border-t border-border">
                    {footer}
                </div>
            )}
        </motion.nav>
    );
}

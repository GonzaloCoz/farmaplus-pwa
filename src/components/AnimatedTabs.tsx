import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface Tab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    badge?: number;
}

interface AnimatedTabsProps {
    tabs: Tab[];
    activeTab: string;
    onChange: (tabId: string) => void;
    variant?: "default" | "pills";
    className?: string;
}

export function AnimatedTabs({
    tabs,
    activeTab,
    onChange,
    variant = "default",
    className,
}: AnimatedTabsProps) {
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);

    return (
        <div
            className={cn(
                "relative flex gap-1",
                variant === "pills" ? "bg-secondary/50 p-1 rounded-lg" : "border-b border-border",
                className
            )}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const isHovered = hoveredTab === tab.id;

                return (
                    <motion.button
                        key={tab.id}
                        onClick={() => !tab.disabled && onChange(tab.id)}
                        onHoverStart={() => !tab.disabled && setHoveredTab(tab.id)}
                        onHoverEnd={() => setHoveredTab(null)}
                        disabled={tab.disabled}
                        whileHover={!tab.disabled ? { y: -2 } : {}}
                        whileTap={!tab.disabled ? { scale: 0.98 } : {}}
                        className={cn(
                            "relative px-4 py-2.5 text-label-large font-medium transition-colors",
                            variant === "pills" && "rounded-md",
                            isActive
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            tab.disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <div className="relative z-10 flex items-center gap-2">
                            {tab.icon && <span className="w-5 h-5">{tab.icon}</span>}
                            <span>{tab.label}</span>
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full"
                                >
                                    {tab.badge > 99 ? "99+" : tab.badge}
                                </motion.span>
                            )}
                        </div>

                        {/* Active indicator */}
                        {isActive && (
                            <motion.div
                                layoutId={`tab-indicator-${variant}`}
                                className={cn(
                                    "absolute",
                                    variant === "pills"
                                        ? "inset-0 bg-background rounded-md elevation-1"
                                        : "bottom-0 left-0 right-0 h-0.5 bg-primary"
                                )}
                                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                            />
                        )}

                        {/* Hover effect */}
                        {isHovered && !isActive && variant === "pills" && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-foreground/5 rounded-md"
                            />
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
}

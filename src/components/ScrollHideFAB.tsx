import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Action {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
}

interface ScrollHideFABProps {
    actions: Action[];
    className?: string;
}

export function ScrollHideFAB({ actions, className }: ScrollHideFABProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show when scrolling up or at the top, hide when scrolling down
            if (currentScrollY < lastScrollY || currentScrollY < 50) {
                setIsVisible(true);
            } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setIsVisible(false);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                        "fixed bottom-24 right-6 flex flex-col gap-3 z-40",
                        className
                    )}
                >
                    {actions.map((action, index) => (
                        <div key={index} className="flex items-center justify-end gap-2">
                            <span className="bg-background/80 backdrop-blur-sm text-foreground text-xs font-medium px-2 py-1 rounded-md shadow-sm">
                                {action.label}
                            </span>
                            <Button
                                variant={action.variant || "default"}
                                size="icon"
                                className="h-12 w-12 rounded-full shadow-lg"
                                onClick={action.onClick}
                            >
                                {action.icon}
                            </Button>
                        </div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

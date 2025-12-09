import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FabAction {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    color?: string; // Custom text/icon color class
    disabled?: boolean;
}

interface FabMenuProps {
    actions: FabAction[];
    mainIcon?: React.ReactNode;
    className?: string;
}

export function FabMenu({ actions, mainIcon = <Plus className="w-6 h-6" />, className }: FabMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const toggleMenu = () => setIsOpen(!isOpen);

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1,
                staggerDirection: -1 // Bottom to top
            }
        },
        exit: {
            opacity: 0,
            transition: {
                staggerChildren: 0.05,
                staggerDirection: 1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20, scale: 0.8 },
        show: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 20, scale: 0.8 }
    };

    return (
        <div ref={menuRef} className={cn("fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 flex flex-col items-end gap-4 transition-all duration-300", className)}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="flex flex-col items-end gap-3 mb-2"
                    >
                        {actions.map((action, index) => (
                            <motion.div
                                key={index}
                                variants={itemVariants}
                            >
                                <Button
                                    variant={action.variant || "secondary"}
                                    className={cn(
                                        "h-14 px-6 rounded-2xl shadow-lg transition-transform hover:scale-105 flex items-center gap-3 min-w-[140px] justify-start",
                                        action.color
                                    )}
                                    onClick={() => {
                                        action.onClick();
                                        setIsOpen(false);
                                    }}
                                    disabled={action.disabled}
                                >
                                    {action.icon}
                                    <span className="font-medium text-base">{action.label}</span>
                                </Button>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <Button
                size="icon"
                className={cn(
                    "h-14 w-14 rounded-2xl shadow-xl transition-all duration-300",
                    isOpen ? "rotate-45 bg-muted-foreground" : "bg-primary"
                )}
                onClick={toggleMenu}
            >
                {mainIcon}
            </Button>
        </div>
    );
}

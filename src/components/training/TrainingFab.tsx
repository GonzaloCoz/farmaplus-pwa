
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from "lucide-react";
import { Play as Publish, Diskette as Save, TrashBinTrash as Trash, CloseCircle as X } from "@solar-icons/react";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TrainingFabProps {
    onPublish: () => void;
    onSaveDraft: () => void;
    onDelete: () => void;
    isSaving?: boolean;
}

export function TrainingFab({ onPublish, onSaveDraft, onDelete, isSaving }: TrainingFabProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = () => setIsOpen(!isOpen);

    const menuItems = [
        { label: 'Publicar Ahora', icon: Publish, onClick: onPublish, color: 'bg-primary' },
        { label: 'Guardar Borrador', icon: Save, onClick: onSaveDraft, color: 'bg-zinc-600' },
        { label: 'Eliminar', icon: Trash, onClick: onDelete, color: 'bg-destructive' },
    ];

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            <AnimatePresence>
                {isOpen && (
                    <div className="flex flex-col items-end gap-3 mb-2">
                        {menuItems.map((item, index) => (
                            <motion.div
                                key={item.label}
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                                className="flex items-center gap-2"
                            >
                                <span className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm border border-border/50 text-foreground">
                                    {item.label}
                                </span>
                                <Button
                                    size="icon"
                                    disabled={isSaving}
                                    className={cn("h-11 w-11 rounded-2xl shadow-lg transition-all active:scale-90", item.color, "hover:brightness-110 text-white border-none")}
                                    onClick={() => {
                                        item.onClick();
                                        setIsOpen(false);
                                    }}
                                >
                                    <item.icon size={20} weight="Bold" />
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            <motion.button
                whileTap={{ scale: 0.9 }}
                disabled={isSaving}
                onClick={toggleOpen}
                className={cn(
                    "h-14 w-14 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-300",
                    isOpen ? "bg-zinc-200 dark:bg-zinc-800 text-foreground" : "bg-primary text-white"
                )}
            >
                <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                    <Plus className="h-6 w-6" />
                </motion.div>
            </motion.button>
        </div>
    );
}

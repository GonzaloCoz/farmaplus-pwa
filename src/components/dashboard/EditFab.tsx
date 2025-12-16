import { motion, AnimatePresence } from 'framer-motion';
import { Edit3, Check, Plus, Grid3x3, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditFabProps {
    isEditMode: boolean;
    onToggleEdit: () => void;
    onAddWidget?: () => void;
    onShowPresets?: () => void;
    onReset?: () => void;
    hasHiddenWidgets?: boolean;
}

export function EditFab({
    isEditMode,
    onToggleEdit,
    onAddWidget,
    onShowPresets,
    onReset,
    hasHiddenWidgets = true
}: EditFabProps) {
    const speedDialActions = [
        {
            icon: Plus,
            label: 'Agregar Widget',
            onClick: onAddWidget,
            disabled: !hasHiddenWidgets,
            color: 'bg-blue-500 hover:bg-blue-600'
        },
        {
            icon: Grid3x3,
            label: 'Presets',
            onClick: onShowPresets,
            color: 'bg-purple-500 hover:bg-purple-600'
        },
        {
            icon: RotateCcw,
            label: 'Resetear',
            onClick: onReset,
            color: 'bg-orange-500 hover:bg-orange-600'
        }
    ];

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* Speed Dial Actions - Only visible in edit mode */}
            <AnimatePresence>
                {isEditMode && (
                    <motion.div
                        className="flex flex-col items-end gap-2"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ staggerChildren: 0.05 }}
                    >
                        {speedDialActions.map((action, index) => (
                            <motion.div
                                key={action.label}
                                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center gap-3"
                            >
                                {/* Label */}
                                <motion.div
                                    className="bg-background/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-border"
                                    whileHover={{ scale: 1.05 }}
                                >
                                    <span className="text-xs font-medium text-foreground whitespace-nowrap">
                                        {action.label}
                                    </span>
                                </motion.div>

                                {/* Action Button */}
                                <motion.button
                                    onClick={action.onClick}
                                    disabled={action.disabled}
                                    className={cn(
                                        'w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all',
                                        action.color,
                                        action.disabled && 'opacity-50 cursor-not-allowed'
                                    )}
                                    whileHover={!action.disabled ? { scale: 1.1 } : {}}
                                    whileTap={!action.disabled ? { scale: 0.95 } : {}}
                                >
                                    <action.icon className="w-5 h-5" />
                                </motion.button>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main FAB */}
            <motion.button
                onClick={onToggleEdit}
                className={cn(
                    'w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all relative overflow-hidden',
                    isEditMode
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-primary hover:bg-primary/90'
                )}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1, boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.3)' }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
                {/* Ripple effect background */}
                <motion.div
                    className="absolute inset-0 bg-white/20 rounded-full"
                    initial={{ scale: 0, opacity: 0.5 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.5 }}
                />

                {/* Icon with rotation animation */}
                <AnimatePresence mode="wait">
                    {isEditMode ? (
                        <motion.div
                            key="check"
                            initial={{ rotate: -180, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 180, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Check className="w-6 h-6" strokeWidth={2.5} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="edit"
                            initial={{ rotate: 180, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -180, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Edit3 className="w-6 h-6" strokeWidth={2.5} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
}

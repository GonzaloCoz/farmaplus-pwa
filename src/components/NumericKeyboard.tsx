import { cn } from '@/lib/utils';
import { Delete, Check, Plus, Minus } from '@untitledui/icons';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface NumericKeyboardProps {
    value: number;
    onChange: (value: number) => void;
    onConfirm: () => void;
    onClose: () => void;
    productName?: string;
    productEAN?: string;
    className?: string;
}

const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['del', '0', 'confirm-key'],
];

export function NumericKeyboard({
    value,
    onChange,
    onConfirm,
    onClose,
    productName,
    productEAN,
    className,
}: NumericKeyboardProps) {
    const [dragY, setDragY] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleKey = (key: string) => {
        if (key === 'del') {
            const next = Math.floor(value / 10);
            onChange(next);
        } else if (key === 'confirm-key') {
            onConfirm();
        } else {
            const digit = parseInt(key, 10);
            const currentStr = value.toString();
            const next = parseInt(currentStr + key, 10);
            if (!isNaN(next) && next <= 9999) {
                onChange(next);
            }
        }
    };

    const handleIncrement = () => onChange(value + 1);
    const handleDecrement = () => onChange(Math.max(0, value - 1));

    // Calculate font size based on number of digits
    const getFontSize = (val: number) => {
        const len = val.toString().length;
        if (len <= 2) return 'text-7xl';
        if (len === 3) return 'text-6xl';
        return 'text-5xl';
    };

    return (
        <div className={cn('flex flex-col gap-0 select-none bg-background py-4', className)}>
            {/* Vertical Scroller / Display Section */}
            <div className="px-5 py-4 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center w-full max-w-sm gap-2">
                    {/* Minus Button */}
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={handleDecrement}
                        className="p-4 text-muted-foreground/40 hover:text-foreground active:text-foreground transition-colors"
                    >
                        <Minus className="size-8 stroke-[2.5px]" />
                    </motion.button>

                    {/* Quantity Picker (Vertical Wheel-like) */}
                    <div className="relative h-40 w-44 flex flex-col items-center justify-center overflow-hidden">
                        {/* Top Context Value */}
                        <div className="absolute top-0 h-10 flex items-center justify-center">
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.div
                                    key={`top-${value - 1}`}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 0.15, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="text-2xl font-bold text-muted-foreground tabular-nums"
                                >
                                    {value > 0 ? value - 1 : ''}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Center Value */}
                        <div className="flex items-center justify-center h-20">
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.div
                                    key={`center-${value}`}
                                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, y: -20 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
                                    className={cn(
                                        "font-black text-foreground tabular-nums tracking-tighter",
                                        getFontSize(value)
                                    )}
                                >
                                    {value}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Bottom Context Value */}
                        <div className="absolute bottom-0 h-10 flex items-center justify-center">
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.div
                                    key={`bottom-${value + 1}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 0.15, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-2xl font-bold text-muted-foreground tabular-nums"
                                >
                                    {value + 1}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        
                        {/* Decorative horizontal guidelines */}
                        <div className="absolute top-[30%] left-4 right-4 h-px bg-border/10" />
                        <div className="absolute bottom-[30%] left-4 right-4 h-px bg-border/10" />

                        {/* Swipe Area overlay to capture gestures */}
                        <motion.div
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.4}
                            onDragEnd={(_, info) => {
                                if (info.offset.y > 30) handleDecrement();
                                else if (info.offset.y < -30) handleIncrement();
                            }}
                            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
                        />
                    </div>

                    {/* Plus Button */}
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={handleIncrement}
                        className="p-4 text-muted-foreground/40 hover:text-foreground active:text-foreground transition-colors"
                    >
                        <Plus className="size-8 stroke-[2.5px]" />
                    </motion.button>
                </div>
            </div>

            {/* Keys Grid */}
            <div className="px-4 pb-8 grid grid-cols-3 gap-1">
                {KEYS.flat().map((key) => {
                    const isAction = key === 'del' || key === 'confirm-key';
                    
                    return (
                        <motion.button
                            key={key}
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.08 }}
                            onClick={() => handleKey(key)}
                            className={cn(
                                'flex items-center justify-center rounded-xl font-medium text-2xl transition-all',
                                'h-16 w-full bg-background border-none hover:bg-muted/50 active:bg-muted',
                                isAction ? 'text-muted-foreground/80' : 'text-foreground'
                            )}
                            aria-label={
                                key === 'del'
                                    ? 'Borrar último dígito'
                                    : key === 'confirm-key'
                                    ? 'Confirmar'
                                    : key
                            }
                        >
                            {key === 'del' ? (
                                <Delete className="size-6 stroke-[1.5px]" />
                            ) : key === 'confirm-key' ? (
                                <Check className="size-7 stroke-[2.5px] text-foreground" />
                            ) : (
                                key
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}

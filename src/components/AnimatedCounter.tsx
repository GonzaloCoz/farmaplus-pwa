import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedCounterProps {
    value: number;
    digits?: number; // Number of digits to display (e.g., 4 for "0000")
    className?: string;
}

export function AnimatedCounter({ value, digits = 4, className = '' }: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValue = useRef(value);

    useEffect(() => {
        if (value !== prevValue.current) {
            setDisplayValue(value);
            prevValue.current = value;
        }
    }, [value]);

    // Pad the number with leading zeros
    const paddedValue = String(displayValue).padStart(digits, '0');
    const digitArray = paddedValue.split('');

    return (
        <div className={`inline-flex items-center ${className}`}>
            {digitArray.map((digit, index) => (
                <DigitSlot key={index} digit={digit} isZero={displayValue === 0 || (index < digits - String(displayValue).length)} />
            ))}
        </div>
    );
}

interface DigitSlotProps {
    digit: string;
    isZero: boolean; // Whether this is a leading zero (should be dimmed)
}

function DigitSlot({ digit, isZero }: DigitSlotProps) {
    return (
        <div className="relative inline-block overflow-hidden h-[1.2em] w-[0.6em]" style={{ lineHeight: '1.2em' }}>
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={digit}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: '0%', opacity: isZero ? 0.2 : 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                        mass: 0.8
                    }}
                    className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums ${isZero ? 'text-white/20' : 'text-white'}`}
                >
                    {digit}
                </motion.span>
            </AnimatePresence>
        </div>
    );
}

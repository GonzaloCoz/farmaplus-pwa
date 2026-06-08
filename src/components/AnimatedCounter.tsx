import { memo } from "react";

interface AnimatedCounterProps {
    value: number;
    digits?: number; // Number of digits to display (e.g., 4 for "0000")
    className?: string;
}

export const AnimatedCounter = memo(function AnimatedCounter({ value, digits = 4, className = '' }: AnimatedCounterProps) {
    // Pad the number with leading zeros
    const paddedValue = String(value).padStart(digits, '0');
    const digitArray = paddedValue.split('');
    const valueStrLen = String(value).length;

    return (
        <span
            key={`${value}-${digits}`}
            className={`t-digit-group is-animating font-bold tabular-nums ${className}`}
        >
            {digitArray.map((digit, index) => {
                // Dim leading zeroes for polished visual presentation
                const isLeadingZero = value === 0 ? index < digits - 1 : index < digits - valueStrLen;
                const stagger = index > 0 ? index : undefined;

                return (
                    <span
                        key={index}
                        className={`t-digit ${isLeadingZero ? 'opacity-20' : ''}`}
                        data-stagger={stagger}
                    >
                        {digit}
                    </span>
                );
            })}
        </span>
    );
});

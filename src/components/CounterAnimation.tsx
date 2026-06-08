import { memo } from "react";

interface CounterAnimationProps {
    value: number;
    duration?: number; // Kept for backward compatibility with existing component signatures
    className?: string;
    prefix?: string;
    suffix?: string;
    decimals?: number;
}

export const CounterAnimation = memo(function CounterAnimation({
    value,
    className = "",
    prefix = "",
    suffix = "",
    decimals = 0,
}: CounterAnimationProps) {
    const formatNumber = (num: number) => {
        if (decimals === 0) {
            return Math.round(num).toLocaleString();
        }
        return num.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    const formattedValue = formatNumber(value);
    const fullString = `${prefix}${formattedValue}${suffix}`;
    const charArray = fullString.split("");

    return (
        <span
            key={fullString}
            className={`t-digit-group is-animating font-bold tabular-nums ${className}`}
        >
            {charArray.map((char, index) => {
                const stagger = index > 0 ? index : undefined;
                return (
                    <span
                        key={index}
                        className="t-digit"
                        data-stagger={stagger}
                    >
                        {char}
                    </span>
                );
            })}
        </span>
    );
});

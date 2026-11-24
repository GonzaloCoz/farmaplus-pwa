import { memo, type CSSProperties } from "react";

interface CounterAnimationProps {
    value: number;
    duration?: number; // Kept for backward compatibility with existing component signatures
    className?: string;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    style?: CSSProperties;
}

export const CounterAnimation = memo(function CounterAnimation({
    value,
    className = "",
    prefix = "",
    suffix = "",
    decimals = 0,
    style,
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
    const prefixLength = prefix.length;

    return (
        <span
            key={fullString}
            style={style}
            className={`t-digit-group is-animating tabular-nums [font-optical-sizing:auto] ${className}`}
        >
            {charArray.map((char, index) => {
                const stagger = index > 0 ? index : undefined;
                const isLastPrefixChar = prefixLength > 0 && index === prefixLength - 1;
                const isSeparator = char === "." || char === ",";

                return (
                    <span
                        key={index}
                        className={[
                            "t-digit",
                            isLastPrefixChar ? "mr-[0.04em]" : "",
                            isSeparator ? "[font-variant-numeric:normal] mx-[0.01em]" : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        data-stagger={stagger}
                    >
                        {char}
                    </span>
                );
            })}
        </span>
    );
});

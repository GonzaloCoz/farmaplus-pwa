import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface CounterAnimationProps {
    value: number;
    duration?: number;
    className?: string;
    prefix?: string;
    suffix?: string;
    decimals?: number;
}

export function CounterAnimation({
    value,
    duration = 1,
    className = "",
    prefix = "",
    suffix = "",
    decimals = 0,
}: CounterAnimationProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const spring = useSpring(0, { duration: duration * 1000 });
    const display = useTransform(spring, (latest) =>
        latest.toFixed(decimals)
    );

    useEffect(() => {
        spring.set(value);
    }, [spring, value]);

    useEffect(() => {
        const unsubscribe = display.on("change", (latest) => {
            setDisplayValue(parseFloat(latest));
        });
        return unsubscribe;
    }, [display]);

    const formatNumber = (num: number) => {
        if (decimals === 0) {
            return Math.round(num).toLocaleString();
        }
        return num.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    return (
        <motion.span className={className}>
            {prefix}
            {formatNumber(displayValue)}
            {suffix}
        </motion.span>
    );
}

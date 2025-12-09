import { motion, HTMLMotionProps } from "framer-motion";
import { useState, MouseEvent } from "react";

interface RippleButtonProps extends HTMLMotionProps<"button"> {
    children: React.ReactNode;
    className?: string;
}

interface Ripple {
    x: number;
    y: number;
    id: number;
}

export function RippleButton({ children, className = "", onClick, ...props }: RippleButtonProps) {
    const [ripples, setRipples] = useState<Ripple[]>([]);

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newRipple = {
            x,
            y,
            id: Date.now(),
        };

        setRipples((prev) => [...prev, newRipple]);

        setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
        }, 600);

        onClick?.(e);
    };

    return (
        <motion.button
            className={`relative overflow-hidden ${className}`}
            onClick={handleClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            {...props}
        >
            {children}
            {ripples.map((ripple) => (
                <motion.span
                    key={ripple.id}
                    className="absolute rounded-full bg-white/30 pointer-events-none"
                    style={{
                        left: ripple.x,
                        top: ripple.y,
                    }}
                    initial={{ width: 0, height: 0, x: 0, y: 0 }}
                    animate={{
                        width: 300,
                        height: 300,
                        x: -150,
                        y: -150,
                        opacity: [0.5, 0],
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                />
            ))}
        </motion.button>
    );
}

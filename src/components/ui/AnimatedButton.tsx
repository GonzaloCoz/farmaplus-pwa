import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedButtonProps extends HTMLMotionProps<'div'> {
    children: React.ReactNode;
    variant?: 'subtle' | 'prominent' | 'none';
    className?: string;
}

export function AnimatedButton({
    children,
    variant = 'subtle',
    className,
    ...props
}: AnimatedButtonProps) {
    const variants = {
        subtle: {
            tap: { scale: 0.98 },
            hover: { scale: 1.02 },
        },
        prominent: {
            tap: { scale: 0.95 },
            hover: { scale: 1.05, transition: { duration: 0.2 } },
        },
        none: {},
    };

    if (variant === 'none') {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={cn('inline-block', className)}
            whileTap={variants[variant].tap}
            whileHover={variants[variant].hover}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

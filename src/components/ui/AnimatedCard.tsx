import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
    children: React.ReactNode;
    hoverEffect?: 'lift' | 'glow' | 'scale' | 'none';
    className?: string;
}

export function AnimatedCard({
    children,
    hoverEffect = 'lift',
    className,
    ...props
}: AnimatedCardProps) {
    const hoverVariants = {
        lift: {
            y: -4,
            boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.15)',
            transition: { duration: 0.2, ease: 'easeOut' },
        },
        glow: {
            boxShadow: '0 0 20px rgba(var(--primary-rgb, 59, 130, 246), 0.3)',
            transition: { duration: 0.3 },
        },
        scale: {
            scale: 1.02,
            transition: { duration: 0.2 },
        },
        none: {},
    };

    if (hoverEffect === 'none') {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={cn('transition-shadow', className)}
            whileHover={hoverVariants[hoverEffect]}
            initial={{ y: 0 }}
            {...props}
        >
            {children}
        </motion.div>
    );
}

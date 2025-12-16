import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StaggerContainerProps {
    children: React.ReactNode;
    staggerDelay?: number;
    className?: string;
}

export function StaggerContainer({
    children,
    staggerDelay = 0.1,
    className
}: StaggerContainerProps) {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: staggerDelay,
            },
        },
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    };

    return (
        <motion.div
            className={cn(className)}
            variants={container}
            initial="hidden"
            animate="show"
        >
            {React.Children.map(children, (child) => (
                <motion.div variants={item}>{child}</motion.div>
            ))}
        </motion.div>
    );
}

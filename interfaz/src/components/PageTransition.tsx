import { motion } from "motion/react";
import { ReactNode } from "react";

interface PageTransitionProps {
    children: ReactNode;
}

const pageVariants = {
    initial: {
        opacity: 0,
    },
    in: {
        opacity: 1,
    },
    out: {
        opacity: 0,
    },
};

const pageTransition = {
    type: "tween",
    ease: "easeOut",
    duration: 0.2,
} as const;

export const PageTransition = ({ children }: PageTransitionProps) => {
    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="h-full w-full min-w-0"
        >
            {children}
        </motion.div>
    );
};

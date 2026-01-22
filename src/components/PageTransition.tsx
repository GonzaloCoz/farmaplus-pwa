import { motion } from "framer-motion";
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
};

export const PageTransition = ({ children }: PageTransitionProps) => {
    return (
        <div className="h-full w-full">
            {children}
        </div>
    );
};

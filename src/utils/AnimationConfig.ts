// Material Design 3 Expressive Animation Configuration
// Following M3 motion guidelines for fluid, fast, and expressive animations

import { Variants } from "framer-motion";

// Animation Durations (in seconds)
export const DURATION = {
    instant: 0.1,
    fast: 0.2,
    medium: 0.3,
    slow: 0.4,
    slower: 0.5,
} as const;

// Easing Functions (M3 Standard)
export const EASING = {
    standard: [0.2, 0.0, 0, 1.0],
    emphasized: [0.2, 0.0, 0, 1.0],
    decelerated: [0.0, 0.0, 0.2, 1.0],
    accelerated: [0.3, 0.0, 1.0, 1.0],
} as const;

// Page Transition Variants
export const pageVariants: Variants = {
    initial: {
        opacity: 0,
        y: 20,
        scale: 0.98,
    },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: DURATION.medium,
            ease: EASING.emphasized,
        },
    },
    exit: {
        opacity: 0,
        y: -20,
        scale: 0.98,
        transition: {
            duration: DURATION.fast,
            ease: EASING.accelerated,
        },
    },
};

// Stagger Container Variants
export const staggerContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1,
        },
    },
};

// Stagger Item Variants
export const staggerItemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: DURATION.medium,
            ease: EASING.emphasized,
        },
    },
};

// Card Hover Variants
export const cardHoverVariants: Variants = {
    rest: {
        scale: 1,
        y: 0,
    },
    hover: {
        scale: 1.02,
        y: -4,
        transition: {
            duration: DURATION.fast,
            ease: EASING.decelerated,
        },
    },
    tap: {
        scale: 0.98,
        transition: {
            duration: DURATION.instant,
        },
    },
};

// Button Variants
export const buttonVariants: Variants = {
    rest: { scale: 1 },
    hover: {
        scale: 1.05,
        transition: {
            duration: DURATION.instant,
            ease: EASING.decelerated,
        },
    },
    tap: {
        scale: 0.95,
        transition: {
            duration: DURATION.instant,
        },
    },
};

// Dialog/Modal Variants
export const dialogVariants: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.95,
        y: 20,
    },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            duration: DURATION.medium,
            ease: EASING.emphasized,
        },
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: 20,
        transition: {
            duration: DURATION.fast,
            ease: EASING.accelerated,
        },
    },
};

// Backdrop Variants
export const backdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: DURATION.fast,
        },
    },
    exit: {
        opacity: 0,
        transition: {
            duration: DURATION.fast,
        },
    },
};

// Icon Variants
export const iconVariants: Variants = {
    inactive: {
        scale: 1,
        rotate: 0,
    },
    active: {
        scale: 1.1,
        rotate: [0, -10, 10, 0],
        transition: {
            duration: DURATION.medium,
            ease: EASING.emphasized,
        },
    },
};

// Fade In Variants
export const fadeInVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: DURATION.medium,
            ease: EASING.decelerated,
        },
    },
};

// Slide In Variants (from bottom)
export const slideInVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 50,
    },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: DURATION.medium,
            ease: EASING.emphasized,
        },
    },
};

// Scale In Variants
export const scaleInVariants: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.8,
    },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: DURATION.medium,
            ease: EASING.emphasized,
        },
    },
};

// List Item Variants (for tables/lists)
export const listItemVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    show: {
        opacity: 1,
        x: 0,
        transition: {
            duration: DURATION.fast,
            ease: EASING.emphasized,
        },
    },
};

// Bottom Sheet Variants
export const bottomSheetVariants: Variants = {
    hidden: {
        y: "100%",
    },
    visible: {
        y: 0,
        transition: {
            type: "spring",
            stiffness: 400,
            damping: 40,
        },
    },
    exit: {
        y: "100%",
        transition: {
            type: "spring",
            stiffness: 400,
            damping: 40,
        },
    },
};

// Tab Indicator Variants
export const tabIndicatorVariants: Variants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
        opacity: 1,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 500,
            damping: 40,
        },
    },
};

// Chip Variants
export const chipVariants: Variants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
        scale: 1,
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 500,
            damping: 30,
        },
    },
    exit: {
        scale: 0,
        opacity: 0,
        transition: {
            duration: DURATION.fast,
        },
    },
};

// Badge Variants
export const badgeVariants: Variants = {
    hidden: { scale: 0 },
    visible: {
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 500,
            damping: 30,
        },
    },
    exit: {
        scale: 0,
        transition: {
            duration: DURATION.fast,
        },
    },
};

// Snackbar Variants
export const snackbarVariants: Variants = {
    hidden: { y: 100, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 500,
            damping: 40,
        },
    },
    exit: {
        y: 100,
        opacity: 0,
        transition: {
            duration: DURATION.fast,
        },
    },
};

// FAB Variants
export const fabVariants: Variants = {
    hidden: { scale: 0 },
    visible: {
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 500,
            damping: 30,
        },
    },
    hover: {
        scale: 1.05,
        transition: {
            duration: DURATION.instant,
        },
    },
    tap: {
        scale: 0.95,
        transition: {
            duration: DURATION.instant,
        },
    },
};

// Spring Configuration
export const springConfig = {
    type: "spring",
    stiffness: 300,
    damping: 30,
};

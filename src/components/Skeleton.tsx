import { motion } from "framer-motion";

interface SkeletonProps {
    className?: string;
    variant?: "text" | "circular" | "rectangular";
    width?: string | number;
    height?: string | number;
}

export function Skeleton({
    className = "",
    variant = "rectangular",
    width,
    height
}: SkeletonProps) {
    const baseClasses = "bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer bg-[length:200%_100%]";

    const variantClasses = {
        text: "h-4 rounded",
        circular: "rounded-full",
        rectangular: "rounded-md",
    };

    const style = {
        width: width || "100%",
        height: height || (variant === "text" ? "1rem" : variant === "circular" ? "40px" : "100%"),
    };

    return (
        <motion.div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
        />
    );
}

// Preset skeleton components
export function SkeletonCard() {
    return (
        <div className="p-6 space-y-4 border rounded-lg">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="rectangular" height="100px" />
            <div className="flex gap-2">
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="text" width="30%" />
            </div>
        </div>
    );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-2">
                    <Skeleton variant="text" width="40%" />
                    <Skeleton variant="text" width="80%" />
                </div>
            ))}
        </div>
    );
}

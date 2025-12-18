import { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type NotificationType = "success" | "error" | "warning" | "info";

interface NotificationToastProps {
    id: string | number;
    type: NotificationType;
    title: string;
    message?: string;
    onDismiss: (id: string | number) => void;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const colors = {
    success: {
        border: "border-l-green-500",
        icon: "text-green-500",
        progress: "bg-green-500",
        text_color: "text-green-500"
    },
    error: {
        border: "border-l-red-500",
        icon: "text-red-500",
        progress: "bg-red-500",
        text_color: "text-red-500"
    },
    warning: {
        border: "border-l-yellow-500",
        icon: "text-yellow-500",
        progress: "bg-yellow-500",
        text_color: "text-yellow-500"
    },
    info: {
        border: "border-l-blue-500",
        icon: "text-blue-500",
        progress: "bg-blue-500",
        text_color: "text-blue-500"
    },
};

export function NotificationToast({
    id,
    type,
    title,
    message,
    onDismiss,
    duration = 15000,
    action
}: NotificationToastProps) {
    const [expanded, setExpanded] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [remaining, setRemaining] = useState(duration);
    const [isVisible, setIsVisible] = useState(true);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const Icon = icons[type];
    const style = colors[type];

    const handleDismiss = () => {
        setIsVisible(false); // Visually hide immediately
        // Small delay to allow animation if we added one, checking removal
        setTimeout(() => onDismiss(id), 300);
    };

    // Logic to handle timer and pause
    useEffect(() => {
        if (isPaused || !isVisible) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        const intervalStart = Date.now();
        const initialRemaining = remaining;

        timerRef.current = setInterval(() => {
            const elapsed = Date.now() - intervalStart;
            const newRemaining = initialRemaining - elapsed;

            if (newRemaining <= 0) {
                setRemaining(0);
                handleDismiss(); // Use local handler
                if (timerRef.current) clearInterval(timerRef.current);
            } else {
                setRemaining(newRemaining);
            }
        }, 100);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [isPaused, isVisible]); // Removed id/onDismiss to prevent re-runs

    const secondsLeft = Math.ceil(remaining / 1000);
    const progressPercent = (remaining / duration) * 100;

    // Use motion.div for smoother entrance/exit animations
    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{
                opacity: isVisible ? 1 : 0,
                x: isVisible ? 0 : 20,
                scale: isVisible ? 1 : 0.95,
                height: isVisible ? "auto" : 0,
                marginBottom: isVisible ? 0 : -10 // Pull up subsequent toasts
            }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
                opacity: { duration: 0.2 },
                height: { duration: 0.3, delay: isVisible ? 0 : 0.1 } // Delay height collapse on exit
            }}
            className={cn(
                "pointer-events-auto relative flex flex-col overflow-hidden rounded-xl border bg-background shadow-lg",
                "w-[360px]"
            )}
        >
            <div className="flex w-full items-start gap-3 px-4 pt-3 pb-3">
                {/* Icon Wrapper */}
                <div className="flex-shrink-0 mt-0.5">
                    <Icon className={cn("h-5 w-5", style.icon)} />
                </div>

                <div className="flex-1 flex flex-col-reverse min-w-0">
                    <AnimatePresence initial={false}>
                        {expanded && message && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                    height: { duration: 0.3, ease: [0.4, 0.0, 0.2, 1] },
                                    opacity: { duration: 0.25, ease: "easeInOut" }
                                }}
                                className="overflow-hidden"
                            >
                                <motion.div
                                    initial={{ y: -10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -10, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: [0.4, 0.0, 0.2, 1], delay: 0.05 }}
                                    className="text-sm text-muted-foreground"
                                >
                                    <div className="pt-3 pb-1 leading-relaxed">
                                        {message}
                                        {action && (
                                            <div className="mt-3">
                                                <button
                                                    onClick={action.onClick}
                                                    className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                                                >
                                                    {action.label}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-[15px] leading-snug text-foreground flex-1 min-w-0 break-words">{title}</h3>
                        <div className="flex items-center gap-0.5 flex-shrink-0 -mt-1">
                            {message && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="rounded-full p-1.5 hover:bg-muted/80 text-muted-foreground transition-colors"
                                    aria-label={expanded ? "Contraer mensaje" : "Expandir mensaje"}
                                >
                                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                            )}
                            <button
                                onClick={handleDismiss}
                                className="rounded-full p-1.5 hover:bg-muted/80 text-muted-foreground transition-colors"
                                aria-label="Cerrar notificación"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer with Timer and Progress */}
            <div className="relative bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="tabular-nums">
                        Este mensaje se cerrará en <span className="font-semibold text-foreground inline-block min-w-[8px] text-center">{secondsLeft}</span> segundos.
                    </span>
                    <button
                        onClick={() => setIsPaused(true)}
                        disabled={isPaused}
                        className={cn(
                            "font-medium transition-all whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm px-1 -mx-1",
                            isPaused
                                ? "text-primary cursor-default"
                                : "text-foreground hover:underline decoration-foreground/50 underline-offset-2 cursor-pointer"
                        )}
                    >
                        {isPaused ? "Pausado" : "Clic para detener"}
                    </button>
                </div>

                {/* Progress Bar positioned at bottom of footer absolutely */}
                <div className="absolute bottom-0 left-0 h-[3px] w-full bg-transparent overflow-hidden">
                    <div
                        className={cn("h-full transition-all duration-100 ease-linear", style.progress)}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>
        </motion.div>
    );
}

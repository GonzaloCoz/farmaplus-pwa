import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AltArrowLeft as ChevronLeft, AltArrowRight as ChevronRight, InfoCircle as Info, CloseCircle as X } from "@solar-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { CounterAnimation } from "./CounterAnimation";

export interface MetricItem {
    id: string;
    label: string;
    value: number;
    color: string;
    icon?: React.ElementType;
    prefix?: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

interface MetricCarouselProps {
    items: MetricItem[];
    className?: string;
}

// Generate smooth chart data with guaranteed continuity and organic feel
const generateChartData = (isPositive: boolean, actualValue: number) => {
    const points: [number, number][] = [];
    const width = 100;
    const height = 50;
    const numPoints = 40;

    const baseline = height / 2;
    // Reduce amplitude for a more "stable" and professional look
    const amplitude = 8;

    for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * width;
        const progress = i / numPoints;

        // Controlled multi-frequency sine waves for organic but professional look
        const wave1 = Math.sin(progress * Math.PI * 3) * amplitude;
        const wave2 = Math.sin(progress * Math.PI * 6) * (amplitude / 4);

        // Very subtle noise
        const noise = (Math.random() - 0.5) * 1.5;

        // Directional trend: strictly follow the sign of the value at the end
        // Positive value -> ends above baseline, Negative value -> ends below
        const targetTrend = actualValue > 0 ? -12 : (actualValue < 0 ? 12 : 0);
        const trendFactor = Math.pow(progress, 1.5) * targetTrend;

        let y = baseline + wave1 + wave2 + noise + trendFactor;

        // Clamp to view with padding
        y = Math.max(5, Math.min(height - 5, y));
        points.push([x, y]);
    }

    return points;
};

// Generate SVG path using simple line segments (most reliable)
const generatePath = (points: [number, number][]) => {
    if (points.length === 0) return "";

    let path = `M ${points[0][0]} ${points[0][1]}`;

    for (let i = 1; i < points.length; i++) {
        const xc = (points[i - 1][0] + points[i][0]) / 2;
        const yc = (points[i - 1][1] + points[i][1]) / 2;
        path += ` Q ${points[i - 1][0]} ${points[i - 1][1]}, ${xc} ${yc}`;
    }

    return path;
};

// Generate fill path for gradient
const generateFillPath = (points: [number, number][]) => {
    if (points.length === 0) return "";
    const path = generatePath(points);
    return `${path} L ${points[points.length - 1][0]} 50 L 0 50 Z`;
};

export function MetricCarousel({ items, className }: MetricCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [chartPoints, setChartPoints] = useState<[number, number][]>([]);
    const [showInfo, setShowInfo] = useState(false);

    const currentItem = items[currentIndex];

    // Theme mapping for "Liquid Glass" style
    const themeConfig = {
        red: {
            color: "#ef4444",
            text: "text-red-500",
            bg: "bg-red-500/10",
            glassBg: "from-red-400/30 to-red-600/10",
            shadow: "shadow-red-500/20",
            glow: "bg-red-500/20"
        },
        green: {
            color: "#10b981",
            text: "text-emerald-500",
            bg: "bg-emerald-500/10",
            glassBg: "from-emerald-400/30 to-emerald-600/10",
            shadow: "shadow-emerald-500/20",
            glow: "bg-emerald-500/20"
        },
        violet: {
            color: "#c084fc", // More lila/lavender
            text: "text-purple-400",
            bg: "bg-purple-500/10",
            glassBg: "from-purple-300/30 to-purple-500/10",
            shadow: "shadow-purple-500/20",
            glow: "bg-purple-500/20"
        }
    };

    const colorKey = currentItem.color === "green" || currentItem.color.includes("success") ? "green" :
        currentItem.color === "red" || currentItem.color.includes("destructive") ? "red" :
            "violet";

    const activeTheme = themeConfig[colorKey as keyof typeof themeConfig] || themeConfig.violet;
    const themeColor = activeTheme.color;
    const themeClass = activeTheme.text;

    // Get trend data
    const trend = currentItem.trend || {
        value: (Math.random() * 15 + 5).toFixed(1) as any,
        isPositive: true
    };

    useEffect(() => {
        const points = generateChartData(trend.isPositive, currentItem.value);
        setChartPoints(points);
    }, [currentIndex, trend.isPositive, currentItem.value]);

    const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % items.length);
    const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);

    const Icon = currentItem.icon;

    return (
        <div className={`relative overflow-hidden group ${className} h-full min-h-[180px] flex flex-col rounded-[2rem] bg-card border-none shadow-sm`}>
            {/* Info Overlay */}
            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center p-6 text-center cursor-pointer"
                        initial={{ clipPath: "circle(0% at top right)" }}
                        animate={{ clipPath: "circle(150% at top right)" }}
                        exit={{ clipPath: "circle(0% at top right)" }}
                        transition={{ type: "spring", stiffness: 200, damping: 30 }}
                        onClick={() => setShowInfo(false)}
                    >
                        <div className="space-y-2 pointer-events-none">
                            <h4 className="font-semibold text-base">{currentItem.label}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Esta métrica representa el estado actual de {currentItem.label.toLowerCase()}.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Container */}
            <div className="p-6 flex flex-col h-full relative z-10">
                {/* Upper Section with Chart and Icon */}
                <div className="flex justify-between items-start mb-4">
                    {/* Professional Wave Chart with Baseline and Gradient */}
                    <div className="w-[70%] h-14 relative opacity-90 mt-1">
                        <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id={`grad-${currentIndex}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={themeColor} stopOpacity="0.3" />
                                    <stop offset="100%" stopColor={themeColor} stopOpacity="0" />
                                </linearGradient>
                            </defs>

                            {/* Horizontal Rule / Baseline */}
                            <line
                                x1="0" y1="25" x2="100" y2="25"
                                stroke="currentColor"
                                strokeWidth="0.5"
                                strokeDasharray="2,4"
                                className="text-muted-foreground/30"
                            />

                            <AnimatePresence mode="wait">
                                <motion.g key={`chart-group-${currentIndex}`}>
                                    {/* Fill Path */}
                                    <motion.path
                                        d={generateFillPath(chartPoints)}
                                        fill={`url(#grad-${currentIndex})`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 1 }}
                                    />

                                    {/* Line Path */}
                                    <motion.path
                                        d={generatePath(chartPoints)}
                                        fill="none"
                                        stroke={themeColor}
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ duration: 1.5, ease: "easeInOut" }}
                                        style={{ filter: `drop-shadow(0 2px 4px ${themeColor}44)` }}
                                    />
                                </motion.g>
                            </AnimatePresence>
                        </svg>
                    </div>

                    {/* Liquid Glass Icon on the right */}
                    <div className="relative">
                        <motion.div
                            key={`icon-bg-${currentIndex}`}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`w-12 h-12 rounded-full flex items-center justify-center relative z-10 shadow-lg ${activeTheme.shadow} bg-gradient-to-br ${activeTheme.glassBg} backdrop-blur-md border border-white/20`}
                        >
                            {Icon && (
                                <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                >
                                    <Icon className={`w-5 h-5 ${themeClass} stroke-[2.5px]`} />
                                </motion.div>
                            )}
                        </motion.div>
                        {/* Shadow/Glow behind icon */}
                        <div className={`absolute inset-0 blur-xl opacity-40 rounded-full ${activeTheme.bg}`} />
                    </div>
                </div>


                {/* Label and Value */}
                <div className="flex flex-col gap-0.5 mt-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground/80">
                            {currentItem.label}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full hover:bg-muted/50 p-0"
                            onClick={() => setShowInfo(!showInfo)}
                        >
                            <Info className="w-3 h-3 text-muted-foreground/30" />
                        </Button>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentItem.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-center gap-3"
                        >
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {currentItem.value > 0 && currentItem.prefix === "$" ? "+" : ""}
                                <CounterAnimation value={currentItem.value} prefix={currentItem.prefix} />
                            </div>

                            <div className={`text-[10px] font-bold ${themeClass}`}>
                                {trend.isPositive ? "+" : "-"}{trend.value}%
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Navigation Arrows */}
            <div className="absolute top-1/2 -translate-y-1/2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-background/20 backdrop-blur-md hover:bg-background/40"
                    onClick={(e) => {
                        e.stopPropagation();
                        prevSlide();
                    }}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-background/20 backdrop-blur-md hover:bg-background/40"
                    onClick={(e) => {
                        e.stopPropagation();
                        nextSlide();
                    }}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

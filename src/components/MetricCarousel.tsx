import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
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

// Generate smooth chart data with guaranteed continuity
const generateChartData = (isPositive: boolean) => {
    const points: [number, number][] = [];
    const width = 100;
    const height = 50;
    const numPoints = 30; // Many points for ultra-smooth curve

    for (let i = 0; i <= numPoints; i++) {
        const x = (i / numPoints) * width;
        const progress = i / numPoints;

        let y;
        if (isPositive) {
            // Upward trend
            y = height - (progress * height * 0.5) + Math.sin(progress * Math.PI * 3) * 4;
        } else {
            // Downward trend
            y = (height * 0.5) + (progress * height * 0.3) + Math.sin(progress * Math.PI * 3) * 4;
        }

        y = Math.max(10, Math.min(height - 10, y));
        points.push([x, y]);
    }

    return points;
};

// Generate SVG path using simple line segments (most reliable)
const generatePath = (points: [number, number][]) => {
    if (points.length === 0) return "";

    let path = `M ${points[0][0]} ${points[0][1]}`;

    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i][0]} ${points[i][1]}`;
    }

    return path;
};

export function MetricCarousel({ items, className }: MetricCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [chartPoints, setChartPoints] = useState<[number, number][]>([]);
    const [showInfo, setShowInfo] = useState(false);

    const currentItem = items[currentIndex];
    const isPositiveTheme = currentItem.color.includes("success") || (currentItem.value >= 0 && !currentItem.color.includes("destructive"));
    const themeColor = isPositiveTheme ? "#10b981" : "#ef4444";
    const themeClass = isPositiveTheme ? "text-emerald-500" : "text-red-500";

    // Get trend data
    const trend = currentItem.trend || {
        value: (Math.random() * 15 + 5).toFixed(1) as any,
        isPositive: isPositiveTheme
    };

    useEffect(() => {
        const points = generateChartData(isPositiveTheme);
        setChartPoints(points);
    }, [currentIndex, isPositiveTheme]);

    const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % items.length);
    const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);

    // Calculate highlight point (70% along the curve)
    const highlightIndex = Math.floor(chartPoints.length * 0.7);
    const highlightPoint = chartPoints[highlightIndex];

    return (
        <Card className={`relative overflow-hidden group ${className} h-full min-h-[160px] flex flex-col`}>
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
                                Utilice esta información para tomar decisiones informadas sobre su inventario.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content Container */}
            <div className="p-5 flex flex-col h-full relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between relative z-50">
                    <span className="text-sm font-medium text-muted-foreground tracking-tight">
                        {currentItem.label}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-muted transition-colors -mr-2 -mt-1"
                        onClick={() => setShowInfo(!showInfo)}
                    >
                        <AnimatePresence mode="wait">
                            {showInfo ? (
                                <motion.div
                                    key="close"
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <X className="w-4 h-4 text-foreground" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="info"
                                    initial={{ rotate: 90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: -90, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Info className="w-4 h-4 text-muted-foreground/40" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Button>
                </div>


                {/* Main Value */}
                <div className="mt-1 relative z-30">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentItem.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col gap-1"
                        >
                            <div className="flex items-baseline gap-2 flex-wrap">
                                {(() => {
                                    // Format the number to check its length
                                    const prefix = currentItem.prefix || "";
                                    const sign = currentItem.value > 0 && prefix === "$" ? "+" : "";
                                    const formattedValue = new Intl.NumberFormat('es-AR').format(Math.abs(currentItem.value));
                                    const fullText = `${sign}${prefix}${formattedValue}`;

                                    // Determine font size based on length
                                    let fontSize = "text-3xl";
                                    if (fullText.length > 15) {
                                        fontSize = "text-xl";
                                    } else if (fullText.length > 10) {
                                        fontSize = "text-2xl";
                                    }

                                    return (
                                        <div className={`${fontSize} font-bold tracking-tight text-foreground`}>
                                            {currentItem.value > 0 && currentItem.prefix === "$" ? "+" : ""}
                                            <CounterAnimation value={currentItem.value} prefix={currentItem.prefix} />
                                        </div>
                                    );
                                })()}
                                <div className="flex items-center gap-1">
                                    <span className={`text-sm font-bold flex items-center ${themeClass}`}>
                                        {isPositiveTheme ? "▲" : "▼"} {trend.value}%
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Chart Area - 42% height at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[42%] pointer-events-none z-20">
                <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id={`gradient-${currentIndex}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={themeColor} stopOpacity="0.15" />
                            <stop offset="100%" stopColor={themeColor} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Area fill */}
                    <motion.path
                        key={`area-${currentIndex}`}
                        d={`${generatePath(chartPoints)} L 100 50 L 0 50 Z`}
                        fill={`url(#gradient-${currentIndex})`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    />

                    {/* Line stroke */}
                    <motion.path
                        key={`line-${currentIndex}`}
                        d={generatePath(chartPoints)}
                        fill="none"
                        stroke={themeColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                    />
                </svg>

                {/* Guide lines and dot */}
                {highlightPoint && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute bottom-0 left-0 right-0 h-full">
                            {/* Vertical line */}
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "100%" }}
                                transition={{ delay: 0.8, duration: 0.4 }}
                                className="absolute border-l border-dashed border-primary/30 top-0"
                                style={{ left: `${highlightPoint[0]}%` }}
                            />

                            {/* Horizontal line */}
                            <motion.div
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "100%" }}
                                transition={{ delay: 0.8, duration: 0.4 }}
                                className="absolute border-t border-dashed border-primary/30 left-0"
                                style={{ top: `${(highlightPoint[1] / 50) * 100}%` }}
                            />

                            {/* Dot - Perfectly centered */}
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 1.2, type: "spring" }}
                                className="absolute bg-background border-2 rounded-full shadow-sm"
                                style={{
                                    left: `${highlightPoint[0]}%`,
                                    top: `${(highlightPoint[1] / 50) * 100}%`,
                                    width: '14px',
                                    height: '14px',
                                    marginLeft: '-7px',
                                    marginTop: '-7px',
                                    borderColor: themeColor
                                }}
                            >
                                <div className="absolute inset-0 rounded-full opacity-20 animate-pulse" style={{ backgroundColor: themeColor }} />
                            </motion.div>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Arrows */}
            <div className="absolute top-1/2 -translate-y-1/2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full shadow-sm bg-background/80 backdrop-blur-sm hover:bg-background"
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
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 rounded-full shadow-sm bg-background/80 backdrop-blur-sm hover:bg-background"
                    onClick={(e) => {
                        e.stopPropagation();
                        nextSlide();
                    }}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </Card>
    );
}

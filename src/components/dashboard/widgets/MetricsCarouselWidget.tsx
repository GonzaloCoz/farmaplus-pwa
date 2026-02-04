import { MetricCarousel } from '@/components/MetricCarousel';
import { Activity, ArrowDown, ArrowUp, ArrowUpRight } from 'lucide-react';

interface MetricsCarouselWidgetProps {
    metrics: {
        totalStock: number;
        negativeStock: number;
        positiveStock: number;
        // Units
        negativeUnits: number;
        positiveUnits: number;
        totalSystemUnits: number;
    };
}

export function MetricsCarouselWidget({ metrics }: MetricsCarouselWidgetProps) {
    const calculateTrend = (value: number, total: number) => {
        if (total === 0) return { value: 0, isPositive: true };
        const percentage = (value / total) * 100;
        return {
            value: Math.abs(Number(percentage.toFixed(1))),
            isPositive: percentage >= 0
        };
    };

    const netTrend = calculateTrend(metrics.negativeUnits + metrics.positiveUnits, metrics.totalSystemUnits);
    const negativeTrend = calculateTrend(metrics.negativeUnits, metrics.totalSystemUnits);
    const positiveTrend = calculateTrend(metrics.positiveUnits, metrics.totalSystemUnits);

    return (
        <MetricCarousel
            items={[
                {
                    id: "net",
                    label: "Diferencia Neta",
                    value: metrics.totalStock,
                    color: "violet",
                    icon: ArrowUpRight,
                    // Remove prefix as requested by user
                    trend: netTrend
                },
                {
                    id: "negative",
                    label: "Negativo Total",
                    value: metrics.negativeStock,
                    color: "red",
                    icon: ArrowDown,
                    prefix: "$",
                    trend: negativeTrend
                },
                {
                    id: "positive",
                    label: "Positivo Total",
                    value: metrics.positiveStock,
                    color: "green",
                    icon: ArrowUp,
                    prefix: "$",
                    trend: positiveTrend
                }
            ]}
        />
    );
}

import { MetricCarousel } from '@/components/MetricCarousel';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

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
                    color: metrics.totalStock < 0 ? "text-destructive" : metrics.totalStock > 0 ? "text-success" : "text-foreground",
                    icon: DollarSign,
                    prefix: "$",
                    trend: netTrend
                },
                {
                    id: "negative",
                    label: "Negativo Total",
                    value: metrics.negativeStock,
                    color: "text-destructive",
                    icon: TrendingDown,
                    prefix: "$",
                    trend: negativeTrend
                },
                {
                    id: "positive",
                    label: "Positivo Total",
                    value: metrics.positiveStock,
                    color: "text-success",
                    icon: TrendingUp,
                    prefix: "$",
                    trend: positiveTrend
                }
            ]}
        />
    );
}

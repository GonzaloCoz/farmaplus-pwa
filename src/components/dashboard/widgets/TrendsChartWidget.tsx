import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useState } from 'react';

interface TrendsChartWidgetProps {
    data?: Array<{
        date: string;
        negative: number;
        positive: number;
    }>;
}

export function TrendsChartWidget({ data = [] }: TrendsChartWidgetProps) {
    const [period, setPeriod] = useState<'7d' | '30d'>('7d');

    // Sample data if none provided
    const sampleData = [
        { date: '01/12', negative: -1200, positive: 800 },
        { date: '02/12', negative: -950, positive: 1100 },
        { date: '03/12', negative: -1500, positive: 900 },
        { date: '04/12', negative: -800, positive: 1300 },
        { date: '05/12', negative: -1100, positive: 950 },
        { date: '06/12', negative: -900, positive: 1200 },
        { date: '07/12', negative: -1300, positive: 1000 },
    ];

    const chartData = data.length > 0 ? data : sampleData;

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-lg font-semibold">Tendencias</CardTitle>
                <div className="flex gap-2">
                    <Button
                        variant={period === '7d' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod('7d')}
                    >
                        7 días
                    </Button>
                    <Button
                        variant={period === '30d' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPeriod('30d')}
                    >
                        30 días
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="negative"
                            stroke="hsl(var(--destructive))"
                            name="Negativo"
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="positive"
                            stroke="hsl(var(--success))"
                            name="Positivo"
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CategoryDistributionWidgetProps {
    data?: Array<{
        name: string;
        value: number;
        color: string;
    }>;
}

const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
];

export function CategoryDistributionWidget({ data = [] }: CategoryDistributionWidgetProps) {
    // Sample data if none provided
    const sampleData = [
        { name: 'Farmacia', value: 450, color: COLORS[0] },
        { name: 'Perfumería', value: 280, color: COLORS[1] },
        { name: 'Higiene', value: 180, color: COLORS[2] },
        { name: 'Bebés', value: 120, color: COLORS[3] },
        { name: 'Otros', value: 90, color: COLORS[4] },
    ];

    const chartData = data.length > 0 ? data : sampleData;
    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Distribución por Categoría</CardTitle>
                <p className="text-sm text-muted-foreground">Productos por categoría</p>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {chartData.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
                            />
                            <span className="text-xs text-muted-foreground">
                                {item.name}: {item.value} ({((item.value / total) * 100).toFixed(1)}%)
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

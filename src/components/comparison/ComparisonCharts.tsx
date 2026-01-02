import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface ComparisonData {
    branchName: string
    progress: number
    totalStockValue: number
    differenceValue: number
    netValue: number
}

interface ComparisonChartsProps {
    data: ComparisonData[]
}

export function ComparisonCharts({ data }: ComparisonChartsProps) {
    if (!data || data.length === 0) return null

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gráfico de Progreso */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Progreso (%)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis dataKey="branchName" type="category" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value: number) => [`${value}%`, 'Progreso']}
                            />
                            <Bar dataKey="progress" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Gráfico de Diferencias (Neto) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Diferencia de Stock ($)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="branchName" type="category" width={100} tick={{ fontSize: 12 }} />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value: number) => [formatCurrency(value), 'Diferencia']}
                            />
                            {/* Usamos Cell para colorear según positivo/negativo si fuera necesario, pero Recharts requiere mapeo manual */}
                            <Bar dataKey="differenceValue" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}

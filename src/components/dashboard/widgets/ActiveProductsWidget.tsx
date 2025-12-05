import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CounterAnimation } from '@/components/CounterAnimation';
import { Activity } from 'lucide-react';

interface ActiveProductsWidgetProps {
    activeProducts: number;
}

export function ActiveProductsWidget({ activeProducts }: ActiveProductsWidgetProps) {
    return (
        <Card className="h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {(() => {
                    // Format the number to check its length
                    const formattedValue = new Intl.NumberFormat('es-AR').format(activeProducts);

                    // Determine font size based on length
                    let fontSize = "text-3xl";
                    if (formattedValue.length > 8) {
                        fontSize = "text-xl";
                    } else if (formattedValue.length > 6) {
                        fontSize = "text-2xl";
                    }

                    return (
                        <div className={`${fontSize} font-bold`}>
                            <CounterAnimation value={activeProducts} />
                        </div>
                    );
                })()}
                <p className="text-xs text-muted-foreground">Total en base de datos</p>
            </CardContent>
        </Card>
    );
}

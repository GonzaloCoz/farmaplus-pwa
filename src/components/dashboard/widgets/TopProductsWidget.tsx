import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, Eye } from 'lucide-react';

interface TopProduct {
    name: string;
    ean: string;
    difference: number;
    value: number;
    type: 'negative' | 'positive';
}

interface TopProductsWidgetProps {
    products?: TopProduct[];
}

export function TopProductsWidget({ products = [] }: TopProductsWidgetProps) {
    // Sample data if none provided
    const sampleProducts: TopProduct[] = [
        { name: 'Ibuprofeno 600mg', ean: '7798140250685', difference: -45, value: -2250, type: 'negative' },
        { name: 'Paracetamol 500mg', ean: '7798140250692', difference: 32, value: 1600, type: 'positive' },
        { name: 'Amoxicilina 500mg', ean: '7798140250708', difference: -28, value: -1680, type: 'negative' },
        { name: 'Omeprazol 20mg', ean: '7798140250715', difference: 25, value: 1500, type: 'positive' },
        { name: 'Losartán 50mg', ean: '7798140250722', difference: -20, value: -1200, type: 'negative' },
    ];

    const displayProducts = products.length > 0 ? products : sampleProducts;

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold">Top Diferencias</CardTitle>
                <p className="text-sm text-muted-foreground">Productos con mayores discrepancias</p>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {displayProducts.map((product, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{product.name}</p>
                                    <Badge variant={product.type === 'negative' ? 'destructive' : 'default'} className="text-xs">
                                        {product.type === 'negative' ? 'Faltante' : 'Sobrante'}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">EAN: {product.ean}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className={`flex items-center gap-1 ${product.type === 'negative' ? 'text-destructive' : 'text-success'}`}>
                                        {product.type === 'negative' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                        <span className="text-sm font-semibold">{Math.abs(product.difference)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">${Math.abs(product.value)}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

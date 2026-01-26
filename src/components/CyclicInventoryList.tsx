import { useState, memo, CSSProperties } from 'react';
import { ProductImageHover } from '@/components/ProductImageHover';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Package, DollarSign, Pencil, Trash2, AlertTriangle, Calculator as CalculatorIcon, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SwipeableItem } from './SwipeableItem';
import { Calculator } from './Calculator';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

export interface CyclicItem {
    id: string;
    ean: string;
    name: string;
    systemQuantity: number;
    countedQuantity: number;
    cost: number;
    status: 'pending' | 'controlled' | 'adjusted';
    category?: string;
    wasReadjusted?: boolean;
    updatedAt?: string;
}

interface CyclicInventoryListProps {
    items: CyclicItem[];
    onUpdateQuantity: (id: string, quantity: number) => void;
    onCheck: (id: string) => void;
    onRevert?: (id: string) => void;
    readOnly?: boolean;
}

export const CyclicInventoryList = memo(function CyclicInventoryList({
    items,
    onUpdateQuantity,
    onCheck,
    onRevert,
    readOnly = false
}: CyclicInventoryListProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState('');
    const [showCalculator, setShowCalculator] = useState(false);

    const handleStartEdit = (item: CyclicItem) => {
        setEditingId(item.id);
        setEditQuantity(item.countedQuantity.toString());
        setShowCalculator(false);
    };

    const handleSaveEdit = () => {
        if (editingId) {
            const qty = parseInt(editQuantity, 10);
            if (!isNaN(qty) && qty >= 0) {
                onUpdateQuantity(editingId, qty);
                setEditingId(null);
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditQuantity('');
        setShowCalculator(false);
    };

    const handleCalculatorResult = (result: number) => {
        setEditQuantity(Math.floor(result).toString());
    };

    // Row component for react-window
    const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
        const item = items[index];
        const diff = item.countedQuantity - item.systemQuantity;
        const hasDiff = diff !== 0;
        const isControlled = item.status === 'controlled';

        const diffValue = diff * item.cost;

        return (
            <div style={style} className="px-4">
                <SwipeableItem
                    disabled={readOnly}
                    {...(!isControlled ? {
                        leftAction: {
                            label: "Confirmar",
                            icon: <CheckCircle2 className="w-5 h-5" />,
                            color: "text-green-600",
                            bgColor: "rgba(22, 163, 74, 0.2)",
                            onAction: () => onCheck(item.id)
                        },
                        rightAction: {
                            label: "Diferencia",
                            icon: <AlertTriangle className="w-5 h-5" />,
                            color: "text-orange-500",
                            bgColor: "rgba(249, 115, 22, 0.2)",
                            onAction: () => handleStartEdit(item)
                        }
                    } : {
                        leftAction: {
                            label: "Editar",
                            icon: <Pencil className="w-5 h-5" />,
                            color: "text-blue-500",
                            bgColor: "rgba(59, 130, 246, 0.2)",
                            onAction: () => handleStartEdit(item)
                        },
                        rightAction: onRevert ? {
                            label: "Revertir",
                            icon: <Trash2 className="w-5 h-5" />,
                            color: "text-red-500",
                            bgColor: "rgba(239, 68, 68, 0.2)",
                            onAction: () => onRevert(item.id)
                        } : undefined
                    })}
                >
                    <div
                        className="grid grid-cols-12 gap-4 h-full items-center border-b border-border/40 hover:bg-muted/10 transition-colors group cursor-pointer"
                        onClick={() => handleStartEdit(item)}
                    >
                        {/* Product Info */}
                        <div className="col-span-5 md:col-span-4 flex items-center gap-3 pl-2 min-w-0">
                            <div className={cn(
                                "p-2 rounded-lg shrink-0",
                                diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                            )}>
                                {diff < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                                <ProductImageHover ean={item.ean} name={item.name}>
                                    <p className="font-semibold text-sm text-foreground truncate" title={item.name}>{item.name}</p>
                                </ProductImageHover>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="outline" className="text-[10px] h-5 font-mono text-muted-foreground border-border/60 font-normal hidden sm:inline-flex">
                                        {item.ean}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground sm:hidden">{item.ean}</span>
                                    {item.wasReadjusted && (
                                        <Badge variant="outline" className="text-[10px] h-5 bg-purple-100/50 text-purple-700 border-purple-200 font-normal">
                                            Modif.
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Price */}
                        <div className="col-span-2 text-right hidden md:block self-center">
                            <p className="text-sm font-medium">${item.cost.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">Costo Unit.</p>
                        </div>

                        {/* Difference (Pill) */}
                        <div className="col-span-3 md:col-span-2 flex justify-center self-center">
                            <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold w-20 justify-center",
                                diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success',
                                diff === 0 && 'bg-muted text-muted-foreground'
                            )}>
                                {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : (diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : null)}
                                {diff > 0 ? '+' : ''}{diff}
                            </div>
                        </div>

                        {/* Physical / System */}
                        <div className="col-span-2 text-center hidden sm:block self-center">
                            <div className="flex items-center justify-center gap-1 text-sm relative">
                                <span className={cn(
                                    "font-bold",
                                    hasDiff ? "text-warning" : "text-success"
                                )}>{item.countedQuantity}</span>
                                <span className="text-muted-foreground mx-1">/</span>
                                <span className="text-muted-foreground">{item.systemQuantity}</span>
                            </div>
                        </div>

                        {/* Total Value */}
                        <div className="col-span-2 md:col-span-2 text-right pr-2 self-center">
                            <p className={cn(
                                "text-sm font-bold",
                                diffValue < 0 ? 'text-destructive' : 'text-success'
                            )}>
                                {diffValue > 0 ? '+' : ''}${Math.abs(diffValue).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </SwipeableItem>
            </div>
        );
    };

    if (items.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No se encontraron productos</p>
            </div>
        );
    }

    return (
        <Card className="border-muted/40 shadow-sm overflow-hidden bg-card">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5 md:col-span-4 pl-2">Producto</div>
                <div className="col-span-2 text-right hidden md:block">Precio</div>
                <div className="col-span-3 md:col-span-2 text-center">Diferencia</div>
                <div className="col-span-2 text-center hidden sm:block">Físico / Sistema</div>
                <div className="col-span-2 md:col-span-2 text-right pr-2">Total ($)</div>
            </div>

            <div className="h-[600px] w-full bg-card">
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            height={height}
                            itemCount={items.length}
                            itemSize={80}
                            width={width}
                            className="no-scrollbar"
                        >
                            {Row}
                        </List>
                    )}
                </AutoSizer>
            </div>

            <div className="p-4 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
                <span>Mostrando {items.length} registros</span>
            </div>

            <Dialog open={editingId !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Cantidad</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-sm font-medium text-foreground mb-2 block">
                                    Cantidad Física
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={editQuantity}
                                    onChange={(e) => setEditQuantity(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSaveEdit();
                                        }
                                    }}
                                    placeholder="Ingresa la cantidad"
                                    autoFocus
                                />
                            </div>
                            <Button
                                variant={showCalculator ? "secondary" : "outline"}
                                size="icon"
                                onClick={() => setShowCalculator(!showCalculator)}
                                title="Calculadora"
                            >
                                <CalculatorIcon className="w-4 h-4" />
                            </Button>
                        </div>

                        <AnimatePresence>
                            {showCalculator && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <Calculator
                                        onResult={handleCalculatorResult}
                                        onClose={() => setShowCalculator(false)}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancelEdit}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveEdit}>
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
});

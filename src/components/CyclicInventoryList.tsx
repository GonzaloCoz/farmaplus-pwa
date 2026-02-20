import { useState, memo, CSSProperties } from 'react';
import { ProductImageHover } from '@/components/ProductImageHover';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Package, DollarSign, Pencil, Trash2, AlertTriangle, Calculator as CalculatorIcon, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Copy, Hash } from 'lucide-react';
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
    shortageId?: string;
    surplusId?: string;
}

interface CyclicInventoryListProps {
    items: CyclicItem[];
    onUpdateQuantity: (id: string, quantity: number) => void;
    onCheck: (id: string) => void;
    onRevert?: (id: string) => void;
    readOnly?: boolean;
    isPending?: boolean;
    // IDs de ajuste del último cierre (para mostrar en la pestaña de Ajustados)
    lastAdjustmentIds?: {
        shortage: string; // ID Plex para Faltantes
        surplus: string;  // ID Plex para Sobrantes
    };
}

export const CyclicInventoryList = memo(function CyclicInventoryList({
    items,
    onUpdateQuantity,
    onCheck,
    onRevert,
    readOnly = false,
    isPending = false,
    lastAdjustmentIds
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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // We could add a notification here or local state feedback
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
                        className="grid grid-cols-12 gap-0 h-full items-center border-b border-border/40 hover:bg-muted/10 transition-colors group cursor-pointer"
                        onClick={() => handleStartEdit(item)}
                    >
                        {/* Product Info */}
                        <div className={cn(
                            "flex items-center gap-3 pl-2 pr-4 min-w-0 transition-all",
                            isPending ? "col-span-4" : "col-span-3"
                        )}>
                            <div className={cn(
                                "p-2 rounded-lg shrink-0",
                                diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                            )}>
                                {diff < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <ProductImageHover ean={item.ean} name={item.name}>
                                    <p className="font-semibold text-sm text-foreground line-clamp-2 leading-tight" title={item.name}>
                                        {item.name}
                                    </p>
                                </ProductImageHover>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {item.wasReadjusted && (
                                        <Badge variant="outline" className="text-[10px] h-5 bg-purple-100/50 text-purple-700 border-purple-200 font-normal">
                                            Modif.
                                        </Badge>
                                    )}
                                    {/* Badge con el ID de Ajuste Plex */}
                                    {item.status === 'adjusted' && diff !== 0 && (item.shortageId || item.surplusId) && (
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[10px] h-5 font-mono gap-1 font-semibold",
                                                diff < 0
                                                    ? "bg-destructive/10 text-destructive border-destructive/30"
                                                    : "bg-success/10 text-success border-success/30"
                                            )}
                                            title={diff < 0 ? `ID Ajuste Faltantes: ${item.shortageId}` : `ID Ajuste Sobrantes: ${item.surplusId}`}
                                        >
                                            <Hash className="w-2.5 h-2.5" />
                                            {diff < 0 ? (item.shortageId || '—') : (item.surplusId || '—')}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* EAN Column */}
                        <div className={cn(
                            "flex items-center gap-2 self-center transition-all px-2",
                            isPending ? "col-span-3" : "col-span-2"
                        )}>
                            <span className="text-sm font-mono text-muted-foreground truncate">{item.ean}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(item.ean);
                                }}
                            >
                                <Copy className="w-3 h-3" />
                            </Button>
                        </div>

                        {/* Price */}
                        <div className={cn(
                            "text-left self-center transition-all px-2",
                            isPending ? "col-span-2" : "hidden md:block md:col-span-1"
                        )}>
                            <p className="text-sm font-medium">${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>

                        {/* Physical / System */}
                        <div className={cn(
                            "text-left self-center transition-all pl-8 pr-2",
                            isPending ? "col-span-3 block" : "hidden sm:block sm:col-span-2"
                        )}>
                            <div className="flex items-center justify-start gap-1.5 text-sm relative">
                                {isPending ? (
                                    <div className="w-10 h-8 rounded-md bg-muted/20 border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/40 text-xs shadow-inner">
                                        -
                                    </div>
                                ) : (
                                    <span className={cn(
                                        "font-bold",
                                        hasDiff ? "text-warning" : "text-success"
                                    )}>{item.countedQuantity}</span>
                                )}
                                <span className="text-muted-foreground/60 mx-0.5">/</span>
                                <span className="text-muted-foreground font-medium">{item.systemQuantity}</span>
                            </div>
                        </div>

                        {/* Difference (Pill) */}
                        {!isPending && (
                            <div className="col-span-2 flex justify-start self-center px-2">
                                <div className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold w-full max-w-[80px] justify-center whitespace-nowrap",
                                    diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success',
                                    diff === 0 && 'bg-muted text-muted-foreground'
                                )}>
                                    {diff > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : (diff < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : null)}
                                    {diff > 0 ? '+' : ''}{diff}
                                </div>
                            </div>
                        )}

                        {/* Total Value */}
                        {!isPending && (
                            <div className="col-span-2 text-left pr-2 self-center">
                                <p className={cn(
                                    "text-sm font-bold",
                                    diffValue < 0 ? 'text-destructive' : 'text-success'
                                )}>
                                    {diffValue > 0 ? '+' : ''}${Math.abs(diffValue).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        )}
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
            <div className="grid grid-cols-12 gap-0 p-4 border-b bg-muted/30 text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider items-center">
                <div className={cn(
                    "pl-2 text-left pr-4",
                    isPending ? "col-span-4" : "col-span-3"
                )}>Producto</div>
                <div className={cn(
                    "text-left px-2",
                    isPending ? "col-span-3" : "col-span-2"
                )}>EAN</div>
                <div className={cn(
                    "text-left px-2",
                    isPending ? "col-span-2" : "hidden md:block md:col-span-1"
                )}>Precio</div>
                {!isPending && (
                    <>
                        <div className="col-span-2 text-left pl-8 pr-2">Físico / Sistema</div>
                        <div className="col-span-2 text-left px-2">Diferencia</div>
                        <div className="col-span-2 text-left pr-2 pl-2">Total ($)</div>
                    </>
                )}
                {isPending && (
                    <div className="col-span-3 text-left px-2">Físico / Sistema</div>
                )}
            </div>

            <div className="h-[600px] w-full bg-card">
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            height={height}
                            itemCount={items.length}
                            itemSize={90}
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

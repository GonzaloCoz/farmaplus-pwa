import { useState, memo } from 'react';
import { ProductImageHover } from '@/components/ProductImageHover';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Package, DollarSign, Pencil, Trash2, AlertTriangle, Calculator as CalculatorIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SwipeableItem } from './SwipeableItem';
import { Calculator } from './Calculator';
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

    if (items.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No hay productos en esta lista</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {items.map((item) => {
                        const diff = item.countedQuantity - item.systemQuantity;
                        const hasDiff = diff !== 0;
                        const isControlled = item.status === 'controlled';
                        const isExact = diff === 0;

                        return (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ duration: 0.2 }}
                            >
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
                                    <Card
                                        className={cn(
                                            "p-4 hover:shadow-md transition-shadow border-0 rounded-none sm:rounded-xl sm:border",
                                        )}
                                        onClick={() => handleStartEdit(item)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg flex-shrink-0 transition-colors",
                                                isControlled ? "bg-success/10" : "bg-primary/10"
                                            )}>
                                                {isControlled ? (
                                                    <CheckCircle2 className="w-5 h-5 text-success" />
                                                ) : (
                                                    <Package className="w-5 h-5 text-primary" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <ProductImageHover ean={item.ean} name={item.name}>
                                                    <h4 className="font-medium text-foreground truncate" title={item.name}>
                                                        {item.name}
                                                    </h4>
                                                </ProductImageHover>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                                                        {item.ean}
                                                    </span>
                                                    {item.cost > 0 && (
                                                        <span className="flex items-center text-muted-foreground">
                                                            <DollarSign className="w-3 h-3 mr-0.5" />
                                                            {item.cost.toFixed(2)}
                                                        </span>
                                                    )}
                                                    {(item.status === 'controlled' || item.status === 'adjusted') && item.category && (
                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 ml-auto">
                                                            {item.category}
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-4 mt-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold">Sistema</span>
                                                        <span className="text-sm font-medium">{item.systemQuantity}</span>
                                                    </div>

                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase text-muted-foreground font-semibold">Físico</span>
                                                        <span
                                                            className={cn(
                                                                "text-sm font-bold",
                                                                hasDiff ? "text-warning" : "text-success"
                                                            )}
                                                        >
                                                            {item.countedQuantity}
                                                        </span>
                                                    </div>

                                                    {hasDiff && (
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Diferencia</span>
                                                            <Badge variant={diff > 0 ? "default" : "destructive"} className="h-5 px-1.5 text-[10px]">
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </Badge>
                                                        </div>
                                                    )}

                                                    {item.wasReadjusted && (
                                                        <div className="flex flex-col" title="Este producto fue re-ajustado">
                                                            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Re-Ajuste</span>
                                                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-purple-100 text-purple-700 border-purple-200">
                                                                <CalculatorIcon className="w-3 h-3 mr-0.5" /> Modif.
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartEdit(item);
                                                    }}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>

                                                {item.status === 'pending' && (
                                                    <Button
                                                        size="icon"
                                                        variant={isExact ? "default" : "secondary"}
                                                        className={cn(
                                                            "h-10 w-10 rounded-full shadow-sm flex-shrink-0 transition-all ml-1",
                                                            isExact
                                                                ? "bg-success hover:bg-success/90 text-white"
                                                                : "hover:bg-warning/20 text-warning"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCheck(item.id);
                                                        }}
                                                    >
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    </Button>
                                                )}

                                                {item.status === 'controlled' && onRevert && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRevert(item.id);
                                                        }}
                                                        title="Volver a pendientes"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                </SwipeableItem>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
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
        </>
    );
});

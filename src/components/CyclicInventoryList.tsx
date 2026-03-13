import { useState, memo, CSSProperties } from 'react';
import { ProductImageHover } from '@/components/ProductImageHover';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ClockCircle as Clock,
    CheckCircle,
    Box as Package,
    Buildings as Building2,
    AltArrowRight as ChevronRight,
    Magnifer as Search,
    Calculator as CalculatorIcon,
    TrashBinMinimalistic as Trash2,
    Danger as AlertTriangle,
    Pen as Pencil,
    GraphDown as TrendingDown,
    GraphUp as TrendingUp,
    Hashtag as Hash,
    Copy,
    ArrowRightUp as ArrowUpRight,
    ArrowRightDown as ArrowDownRight
} from '@solar-icons/react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notifications';
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
    readjustmentReason?: string;
}

interface CyclicInventoryListProps {
    items: CyclicItem[];
    onUpdateQuantity: (id: string, quantity: number, reason?: string) => void;
    onCheck: (id: string) => void;
    onRevert?: (id: string) => void;
    readOnly?: boolean;
    isPending?: boolean;
    isExcelUploaded?: boolean;
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
    isExcelUploaded = false,
    lastAdjustmentIds
}: CyclicInventoryListProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState('');
    const [showCalculator, setShowCalculator] = useState(false);
    const [editReason, setEditReason] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleStartEdit = (item: CyclicItem) => {
        // REGLA DE NEGOCIO: Bloqueo de Re-ajuste si no hay Excel nuevo
        if (item.status === 'adjusted' && !isExcelUploaded) {
            notify.error(
                "Acción bloqueada", 
                "Para realizar un re-ajuste de productos ya finalizados, primero debes cargar el Excel de sistema actualizado."
            );
            return;
        }

        setEditingId(item.id);
        setEditQuantity(item.countedQuantity.toString());
        setEditReason(item.readjustmentReason || '');
        setShowCalculator(false);
    };

    const handleSaveEdit = () => {
        if (editingId) {
            const qty = parseInt(editQuantity, 10);
            if (!isNaN(qty) && qty >= 0) {
                const item = items.find(i => i.id === editingId);
                // Si estaba ajustado, el motivo es obligatorio
                if (item?.status === 'adjusted' && !editReason.trim()) {
                    // Import notify dynamically to avoid circular dependencies if any, or just use the local state.
                    // Wait, we need to import notify if not imported. I'll just use simple alert fallback or add notify import.
                    return; 
                }
                onUpdateQuantity(editingId, qty, editReason.trim());
                setEditingId(null);
                setEditReason('');
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditQuantity('');
        setEditReason('');
        setShowCalculator(false);
    };

    const handleCalculatorResult = (result: number) => {
        setEditQuantity(Math.floor(result).toString());
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
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
                            icon: <CheckCircle className="w-5 h-5" />,
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
                        className="h-full items-center border-b border-border/40 hover:bg-muted/10 transition-colors group cursor-pointer px-4"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isPending
                                ? '60px 2.5fr 1.5fr 1fr 1fr'
                                : '60px 2.5fr 1.5fr 1fr 1fr 0.8fr 0.8fr 1fr',
                            gap: '0 12px'
                        }}
                        onClick={() => handleStartEdit(item)}
                    >
                        {/* FECHA */}
                        <div className="flex flex-col justify-center py-1">
                            <span className="text-xs font-bold text-foreground/80 leading-tight">
                                {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium leading-none">
                                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' }) : '--/--'}
                            </span>
                        </div>

                        {/* PRODUCTO */}
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                            <div className={cn(
                                "p-1.5 rounded-lg shrink-0",
                                diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                            )}>
                                {diff < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <ProductImageHover ean={item.ean} name={item.name}>
                                    <p className="font-semibold text-sm text-foreground line-clamp-2 leading-tight" title={item.name}>
                                        {item.name}
                                    </p>
                                </ProductImageHover>
                                {item.wasReadjusted && (
                                    <Badge variant="outline" className="text-[10px] h-5 w-fit bg-primary/10 text-primary border-primary/20 font-semibold">
                                        Modif.
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* EAN with Copy functionality */}
                        <div 
                            className="flex items-center gap-2 self-center cursor-pointer group/ean"
                            onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.ean, item.id);
                            }}
                            title="Copiar EAN"
                        >
                            <span className="text-sm font-mono text-muted-foreground group-hover/ean:text-foreground transition-colors">
                                {item.ean}
                            </span>
                            <div className="w-4 h-4 flex items-center justify-center">
                                {copiedId === item.id ? (
                                    <CheckCircle className="w-3.5 h-3.5 text-success animate-bounce-in shrink-0" />
                                ) : (
                                    <Copy 
                                        className="w-3.5 h-3.5 text-primary opacity-0 group-hover/ean:opacity-100 transition-opacity shrink-0"
                                    />
                                )}
                            </div>
                        </div>

                        {/* PRECIO */}
                        <div className="self-center">
                            <p className="text-sm font-medium">${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>

                        {/* FÍSICO / SISTEMA */}
                        <div className="self-center">
                            <div className="flex items-center justify-start gap-1.5 text-sm">
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
                                <span className="text-muted-foreground/60">/</span>
                                <span className="text-muted-foreground font-medium">{item.systemQuantity}</span>
                            </div>
                        </div>

                        {/* ID (Badge style) - Only in non-pending */}
                        {!isPending && (
                            <div className="flex flex-col justify-center gap-0.5 self-center">
                                {item.status === 'adjusted' && (item.shortageId || item.surplusId) ? (
                                    <div className="flex flex-col gap-1">
                                        {item.shortageId && item.shortageId.split(',').map((id, idx) => (
                                            <Badge
                                                key={`shortage-${idx}`}
                                                variant="outline"
                                                className="text-[10px] h-5 font-mono gap-1 font-semibold bg-destructive/10 text-destructive border-destructive/30 w-fit"
                                            >
                                                <Hash className="w-2.5 h-2.5" />
                                                {id.trim()}
                                            </Badge>
                                        ))}
                                        {item.surplusId && item.surplusId.split(',').map((id, idx) => (
                                            <Badge
                                                key={`surplus-${idx}`}
                                                variant="outline"
                                                className="text-[10px] h-5 font-mono gap-1 font-semibold bg-success/10 text-success border-success/30 w-fit"
                                            >
                                                <Hash className="w-2.5 h-2.5" />
                                                {id.trim()}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground/30">—</span>
                                )}
                            </div>
                        )}

                        {/* DIFERENCIA (Pill) */}
                        {!isPending && (
                            <div className="flex justify-start self-center">
                                <div className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold justify-center whitespace-nowrap",
                                    diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success',
                                    diff === 0 && 'bg-muted text-muted-foreground'
                                )}>
                                    {diff > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : (diff < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : null)}
                                    {diff > 0 ? '+' : ''}{diff}
                                </div>
                            </div>
                        )}

                        {/* TOTAL ($) */}
                        {!isPending && (
                            <div className="self-center">
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
            <div
                className="px-4 py-3 border-b bg-muted/30 text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider items-center"
                style={{
                    display: 'grid',
                    gridTemplateColumns: isPending
                        ? '60px 2.5fr 1.5fr 1fr 1fr'
                        : '60px 2.5fr 1.5fr 1fr 1fr 0.8fr 0.8fr 1fr',
                    gap: '0 12px'
                }}
            >
                <div>Fecha</div>
                <div className="pl-9">Producto</div>
                <div>EAN</div>
                <div>Precio</div>
                <div>Físico / Sistema</div>
                {!isPending && (
                    <>
                        <div className="text-left">ID</div>
                        <div className="text-left">Diferencia</div>
                        <div>Total ($)</div>
                    </>
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
                    {editingId && (() => {
                        const currentItem = items.find(i => i.id === editingId);
                        if (!currentItem) return null;
                        return (
                            <div className="space-y-4 py-4">
                                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                                    <span className="font-mono text-xs text-muted-foreground">{currentItem.ean}</span>
                                    <h4 className="font-semibold text-sm leading-tight mt-1">{currentItem.name}</h4>
                                </div>
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className="text-sm font-medium text-foreground mb-2 block">
                                            Nueva Cantidad Física
                                        </label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={editQuantity}
                                            onChange={(e) => setEditQuantity(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    // Validar motivo si está ajustado
                                                    if (currentItem.status === 'adjusted' && !editReason.trim()) return;
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

                                {currentItem.status === 'adjusted' && (
                                    <div className="mt-4">
                                        <label className="text-sm font-medium text-destructive mb-2 block">
                                            Motivo de Re-ajuste *
                                        </label>
                                        <Input
                                            value={editReason}
                                            onChange={(e) => setEditReason(e.target.value)}
                                            placeholder="Ej. Se encontraron 2 más en el depósito..."
                                            className="border-warning focus-visible:ring-warning"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && editReason.trim()) {
                                                    handleSaveEdit();
                                                }
                                            }}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                                            Requerido para modificar ítems ya ajustados.
                                        </p>
                                    </div>
                                )}

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
                    );
                    })()}
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

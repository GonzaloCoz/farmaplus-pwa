import { useState, memo, useCallback, CSSProperties } from 'react';
import { ProductImageHover } from '@/components/ProductImageHover';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    CheckCircle,
    Box as Package,
    Magnifer as Search,
    Calculator as CalculatorIcon,
    Danger as AlertTriangle,
    JarOfPills,
    Perfume,
    Stethoscope,
    Pills3
} from '@solar-icons/react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import { Calculator } from './Calculator';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import CheckedIcon from '@/components/icons/CheckedIcon';
import {
    Dialog,
    DialogPopup,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Frame,
    FrameHeader,
    FrameTitle,
    FrameDescription,
    FramePanel,
    FrameFooter,
} from '@/components/ui/frame';


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
    onBulkCheck?: (ids: string[]) => void;
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
    onBulkCheck,
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

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelectedIds(prev => {
            if (prev.size === items.length) return new Set();
            return new Set(items.map(i => i.id));
        });
    }, [items]);

    const handleBulkConfirm = useCallback(() => {
        if (onBulkCheck && selectedIds.size > 0) {
            onBulkCheck(Array.from(selectedIds));
            setSelectedIds(new Set());
            setShowBulkConfirm(false);
        }
    }, [onBulkCheck, selectedIds]);

    // Grid layout constants for consistency (Matching Monitor de Sucursales feel)
    const GRID_TEMPLATE_PENDING = '56px 80px minmax(200px, 3fr) minmax(130px, 1.2fr) minmax(90px, 0.8fr) minmax(100px, 1fr)';
    const GRID_TEMPLATE_CONTROLLED = '56px 80px minmax(200px, 2.5fr) minmax(130px, 1.2fr) minmax(90px, 0.8fr) minmax(100px, 0.8fr) minmax(80px, 0.6fr) minmax(100px, 0.8fr) minmax(100px, 1fr)';

    const handleStartEdit = (item: any) => {
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
        const isSelected = selectedIds.has(item.id);

        const diffValue = diff * item.cost;

        return (
            <div style={style} className="px-0">
                <div
                    className={cn(
                        "h-full items-center border-t border-border/15 hover:bg-muted/30 transition-colors group cursor-pointer",
                        isSelected && "bg-primary/5 hover:bg-primary/10",
                        index === 0 && "border-t-0"
                    )}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isPending ? GRID_TEMPLATE_PENDING : GRID_TEMPLATE_CONTROLLED,
                        gap: '0'
                    }}
                    onClick={() => {
                        if (selectedIds.size > 0 && isSelected) {
                            setShowBulkConfirm(true);
                        } else {
                            handleStartEdit(item);
                        }
                    }}
                >
                    {/* CHECKBOX - TableCell style */}
                    <div 
                        className="flex items-center justify-center pl-5 pr-4 py-3 h-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(item.id)}
                            aria-label={`Seleccionar ${item.name}`}
                            className="size-4"
                        />
                    </div>

                    {/* FECHA */}
                    <div className="flex flex-col justify-center px-4 py-3 min-w-0 font-cal">
                        <span className="text-[13px] font-medium font-mono text-muted-foreground whitespace-nowrap">
                            {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '--/--'}
                        </span>
                    </div>

                    {/* PRODUCTO */}
                    <div className="flex items-center px-4 py-3 min-w-0">
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <ProductImageHover ean={item.ean} name={item.name}>
                                <div className="font-medium text-[14px]">
                                    {item.name}
                                </div>
                            </ProductImageHover>
                            {item.wasReadjusted && (
                                <span className="text-[10px] text-muted-foreground/60 font-medium whitespace-nowrap">
                                    Ajuste Anterior
                                </span>
                            )}
                        </div>
                    </div>

                    {/* EAN */}
                    <div 
                        className="px-4 py-3 flex flex-col justify-center font-mono tabular-nums cursor-copy select-none"
                        onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.ean, item.id);
                            notify.success("Código Copiado", `El EAN ${item.ean} se copió al portapapeles.`);
                        }}
                    >
                        <div className="flex items-center gap-1.5 group/ean">
                            <span className="text-[13px] text-muted-foreground/80 leading-tight group-hover/ean:text-primary group-hover/ean:underline transition-colors">
                                {item.ean}
                            </span>
                            {copiedId === item.id ? (
                                <CheckedIcon size={14} color="#10b981" strokeWidth={2.5} />
                            ) : null}
                        </div>
                    </div>

                    {/* PRECIO */}
                    <div className="px-4 py-3 flex flex-col justify-center tabular-nums">
                        <span className="text-[13px] font-medium text-foreground leading-tight">
                            ${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* FÍSICO / SISTEMA */}
                    <div className="flex items-center px-4 py-3 self-center font-cal">
                        <div className="flex items-center justify-start gap-1.5 text-[14px] tabular-nums">
                            {isPending ? (
                                <span className="text-muted-foreground/10">—</span>
                            ) : (
                                <span className={cn("font-medium", hasDiff && "text-destructive-foreground")}>
                                    {item.countedQuantity}
                                </span>
                            )}
                            <span className="text-muted-foreground/30 px-0.5">/</span>
                            <span className="text-muted-foreground/30 font-medium">{item.systemQuantity}</span>
                        </div>
                    </div>

                    {/* ID */}
                    {!isPending && (
                        <div className="px-4 py-3 flex items-center">
                            {item.status === 'adjusted' && (item.shortageId || item.surplusId) ? (
                                <Badge variant="outline" className="font-mono">
                                    {(item.shortageId || item.surplusId)?.split(',')[0]}
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground/10">—</span>
                            )}
                        </div>
                    )}

                    {/* DIFERENCIA */}
                    {!isPending && (
                        <div className="flex justify-start px-4 py-3 self-center">
                            {diff === 0 ? (
                                <span className="text-muted-foreground/30 text-[13px] pl-4 font-cal">–</span>
                            ) : (
                                <Badge variant="outline">
                                    <span
                                        aria-hidden="true"
                                        className={cn("size-1.5 rounded-full", diff > 0 ? "bg-emerald-500" : "bg-red-500")}
                                    />
                                    {diff > 0 ? '+' : ''}{diff}
                                </Badge>
                            )}
                        </div>
                    )}

                    {/* TOTAL ($) */}
                    {!isPending && (
                        <div className="flex items-center pl-4 pr-5 py-3 self-center first:pl-5 last:pr-5">
                            <p className={cn(
                                "text-[14px] font-medium tabular-nums font-cal",
                                diffValue === 0 ? "text-muted-foreground" : diffValue > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                                {diffValue < 0 && '-'}${Math.abs(diffValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    )}
                </div>
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
        <Frame className="w-full flex-1 relative font-cal">
            {/* Floating selection bar - Now inside Frame */}
            <div className="px-0 pb-1">
                <FramePanel className="p-0 overflow-hidden border-input bg-popover shadow-xs/5 dark:bg-input/20 flex flex-col h-[650px] w-full">
                    {/* Header Browser-native Perfect Alignment */}
                    <div
                        className="h-11 border-b border-input/30 bg-transparent text-[13px] font-semibold text-foreground items-center sticky top-0 z-10"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isPending ? GRID_TEMPLATE_PENDING : GRID_TEMPLATE_CONTROLLED,
                            gap: '0'
                        }}
                    >
                        <div className="flex items-center justify-center pl-5 pr-4 h-full">
                            <Checkbox
                                checked={selectedIds.size === 0 ? false : (selectedIds.size === items.length ? true : 'indeterminate')}
                                onCheckedChange={toggleSelectAll}
                                aria-label="Seleccionar todos"
                                className="size-4 translate-y-[2px]"
                            />
                        </div>
                        <div className="px-4">Fecha</div>
                        <div className="px-4">Producto</div>
                        <div className="px-4">Ean</div>
                        <div className="px-4 text-left">Precio</div>
                        <div className="px-4 text-left">Físico / Sistema</div>
                        {!isPending && (
                            <>
                                <div className="px-4">Id</div>
                                <div className="px-4">Diferencia</div>
                                <div className="px-4 pr-5 text-left">Total ($)</div>
                            </>
                        )}
                    </div>

                    <div className="flex-1 w-full bg-transparent">
                        <AutoSizer>
                            {({ height, width }) => (
                                <List
                                    height={height}
                                    itemCount={items.length}
                                    itemSize={82}
                                    width={width}
                                    className="no-scrollbar"
                                >
                                    {Row}
                                </List>
                            )}
                        </AutoSizer>
                    </div>

                    <AnimatePresence>
                        {selectedIds.size > 0 && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-input/40 bg-muted/5 font-cal"
                            >
                                <FrameFooter className="flex items-center justify-between px-6 py-3 h-14">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            {selectedIds.size} {selectedIds.size === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedIds(new Set())}
                                            className="text-xs font-medium hover:bg-muted/50"
                                        >
                                            Deseleccionar
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => setShowBulkConfirm(true)}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold gap-2 px-4 shadow-sm"
                                        >
                                            <CheckCircle className="size-3.5" />
                                            Confirmar sin diferencia
                                        </Button>
                                    </div>
                                </FrameFooter>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </FramePanel>
            </div>

            <Dialog open={editingId !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
                <DialogPopup className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Cantidad</DialogTitle>
                    </DialogHeader>
                    {editingId && (() => {
                        const currentItem = items.find(i => i.id === editingId);
                        if (!currentItem) return null;
                        return (
                            <Form
                                className="contents"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (currentItem.status === 'adjusted' && !editReason.trim()) return;
                                    handleSaveEdit();
                                }}
                            >
                                <div className="px-6 py-4 flex flex-col gap-6">
                                    <div className="p-3 bg-muted/30 rounded-xl border border-border/60">
                                        <span className="font-mono text-xs text-muted-foreground">{currentItem.ean}</span>
                                        <h4 className="font-semibold text-sm leading-tight mt-1">{currentItem.name}</h4>
                                    </div>
                                    <div className="flex gap-3 items-end">
                                        <Field className="flex-1">
                                            <FieldLabel>Nueva Cantidad Física</FieldLabel>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={editQuantity}
                                                onChange={(e) => setEditQuantity(e.target.value)}
                                                placeholder="Ej. 10"
                                                autoFocus
                                            />
                                        </Field>
                                        <Button
                                            type="button"
                                            variant={showCalculator ? "secondary" : "outline"}
                                            size="icon"
                                            onClick={() => setShowCalculator(!showCalculator)}
                                            title="Calculadora"
                                            className="h-10 w-10 shrink-0"
                                        >
                                            <CalculatorIcon className="w-5 h-5" />
                                        </Button>
                                    </div>

                                    {currentItem.status === 'adjusted' && (
                                        <Field>
                                            <FieldLabel className="text-destructive">
                                                Motivo de Re-ajuste <span className="text-destructive/80">*</span>
                                            </FieldLabel>
                                            <Input
                                                value={editReason}
                                                onChange={(e) => setEditReason(e.target.value)}
                                                placeholder="Ej. Se encontraron 2 más en depósito..."
                                                className="border-warning focus-visible:ring-warning"
                                            />
                                            {editReason.trim().length === 0 ? (
                                                <FieldError className="text-warning flex items-center gap-1 mt-1">
                                                    <AlertTriangle className="w-3 h-3" /> Requerido para modificar ítems ya ajustados.
                                                </FieldError>
                                            ) : null}
                                        </Field>
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
                                <DialogFooter>
                                    <DialogClose render={<Button type="button" variant="ghost" />}>
                                        Cancelar
                                    </DialogClose>
                                    <Button type="submit">
                                        Guardar
                                    </Button>
                                </DialogFooter>
                            </Form>
                        );
                    })()}
                </DialogPopup>
            </Dialog>

            {/* Bulk Confirmation Dialog */}
            <Dialog open={showBulkConfirm} onOpenChange={(open) => !open && setShowBulkConfirm(false)}>
                <DialogPopup className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Confirmar productos sin diferencia</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            ¿Confirmar que los siguientes <span className="font-bold text-foreground">{selectedIds.size} productos</span> no presentan diferencia con el sistema?
                        </p>
                        <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-2">
                            {items.filter(i => selectedIds.has(i.id)).map(item => (
                                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                                    <CheckCircle className="w-4 h-4 text-success shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{item.name}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{item.ean} · Sist: {item.systemQuantity}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                            <p className="text-xs text-success font-medium flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Todos pasarán a "Controlados" con cantidad física igual al sistema
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose render={<Button variant="outline" />}>
                            Cancelar
                        </DialogClose>
                        <Button className="bg-success hover:bg-success/90 text-white gap-1.5" onClick={handleBulkConfirm}>
                            <CheckCircle className="w-4 h-4" />
                            Guardar ({selectedIds.size})
                        </Button>
                    </DialogFooter>
                </DialogPopup>
            </Dialog>
        </Frame>
    );
});

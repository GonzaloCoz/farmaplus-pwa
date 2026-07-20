import { useState, memo, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle } from '@untitledui/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import { Table, type TableColumn } from '@/components/motion/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Frame, FramePanel, FrameFooter } from '@/components/ui/frame';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

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

interface PopoverRowCellProps {
    item: CyclicItem;
    isExcelUploaded: boolean;
    onUpdateQuantity: (id: string, quantity: number, reason?: string) => void;
}

const PopoverRowCell = memo(function PopoverRowCell({
    item,
    isExcelUploaded,
    onUpdateQuantity
}: PopoverRowCellProps) {
    const [open, setOpen] = useState(false);
    const [qty, setQty] = useState(item.countedQuantity.toString());
    const [reason, setReason] = useState(item.readjustmentReason || '');

    // Sync input value when item countedQuantity changes or popover opens
    useEffect(() => {
        if (open) {
            setQty(item.countedQuantity.toString());
            setReason(item.readjustmentReason || '');
        }
    }, [open, item.countedQuantity, item.readjustmentReason]);

    const handleSave = () => {
        // Business rule check
        if (item.status === 'adjusted' && !isExcelUploaded) {
            notify.error(
                "Acción bloqueada", 
                "Para realizar un re-ajuste de productos ya finalizados, primero debes cargar el Excel de sistema actualizado."
            );
            return;
        }

        const parsedQty = parseFloat(qty);
        if (isNaN(parsedQty) || parsedQty < 0) {
            notify.error("Cantidad Inválida", "Por favor ingresá un número válido mayor o igual a 0.");
            return;
        }

        const isReAdjustment = item.status === 'adjusted';
        const hasDiff = parsedQty !== item.systemQuantity;
        if (isReAdjustment && hasDiff && !reason) {
            notify.error("Motivo Requerido", "Por favor seleccioná el motivo del re-ajuste.");
            return;
        }

        onUpdateQuantity(item.id, parsedQty, hasDiff ? reason : undefined);
        setOpen(false);
        notify.success("Stock Guardado", `${item.name}: ${parsedQty} unidades.`);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger render={
                <div className="flex items-center min-w-0 cursor-pointer group/cell py-1 select-none">
                    <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="font-medium text-[14px] truncate max-w-[200px] sm:max-w-xs md:max-w-md group-hover/cell:text-primary transition-colors">
                                {item.name}
                            </div>
                        {item.wasReadjusted && (
                            <span className="text-[10px] text-muted-foreground/60 font-medium whitespace-nowrap">
                                Ajuste Anterior
                            </span>
                        )}
                    </div>
                </div>
            } />
            <PopoverContent 
                side="bottom" 
                align="start" 
                className="w-80 p-4 rounded-2xl bg-surface-5 border border-border/40 shadow-xl z-50"
            >
                <div className="space-y-4">
                    <div>
                        <p className="text-base font-semibold text-foreground truncate">
                            {item.name}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            EAN: {item.ean}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <label className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
                            <span className="text-muted-foreground">Stock Sistema</span>
                            <span className="font-semibold text-foreground bg-muted/40 px-3 py-1 rounded-lg w-32 text-right">
                                {item.systemQuantity} u.
                            </span>
                        </label>
                        <label className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
                            <span className="text-muted-foreground">Cantidad Física</span>
                            <input
                                type="number"
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSave();
                                    }
                                }}
                                autoFocus
                                className="h-8 w-32 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/20 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                                min="0"
                            />
                        </label>
                        {(() => {
                            const parsedVal = parseFloat(qty);
                            const hasDiff = !isNaN(parsedVal) && parsedVal !== item.systemQuantity;
                            const isReAdjustment = item.status === 'adjusted';
                            return (isReAdjustment && hasDiff) ? (
                                <div className="flex flex-col gap-1.5 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <span className="text-xs font-semibold text-muted-foreground text-left">Motivo del Ajuste</span>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer"
                                    >
                                        <option value="" disabled>Seleccionar motivo...</option>
                                        <option value="Error de ingreso/recepción">Error de ingreso/recepción</option>
                                        <option value="Mercadería vencida">Mercadería vencida</option>
                                        <option value="Rotura o daño">Rotura o daño</option>
                                        <option value="Hurto o pérdida">Hurto o pérdida</option>
                                        <option value="Error de conteo previo">Error de conteo previo</option>
                                        <option value="Otro motivo">Otro motivo</option>
                                    </select>
                                </div>
                            ) : null;
                        })()}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border/20">
                        <Button 
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            className="h-8 text-sm font-medium hover:bg-muted/50 rounded-lg"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="default"
                            onClick={handleSave}
                            className="h-8 text-sm font-semibold rounded-lg"
                        >
                            Guardar
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
});

interface CyclicInventoryListProps {
    items: CyclicItem[];
    onUpdateQuantity: (id: string, quantity: number, reason?: string) => void;
    onCheck: (id: string) => void;
    onBulkCheck?: (ids: string[]) => void;
    onRevert?: (id: string) => void;
    readOnly?: boolean;
    isPending?: boolean;
    isExcelUploaded?: boolean;
    lastAdjustmentIds?: {
        shortage: string;
        surplus: string;
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
    const [editReason, setEditReason] = useState('');

    // Multi-select state (BEUI Table uses string[])
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);

    const handleStartEdit = useCallback((item: CyclicItem) => {
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
    }, [isExcelUploaded]);

    const handleBulkConfirm = useCallback(() => {
        if (onBulkCheck && selectedIds.length > 0) {
            onBulkCheck(selectedIds);
            setSelectedIds([]);
            setShowBulkConfirm(false);
        }
    }, [onBulkCheck, selectedIds]);

    // Table Column Definitions
    const columns = useMemo(() => {
        const baseCols: TableColumn<CyclicItem>[] = [
            {
                key: 'updatedAt',
                header: 'Fecha',
                width: '100px',
                cell: (item) => (
                    <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '--/--'}
                    </span>
                )
            },
            {
                key: 'name',
                header: 'Producto',
                width: '320px',
                cell: (item) => readOnly ? (
                    <div className="flex items-center min-w-0 py-1 select-none">
                        <span className="font-medium text-[14px] truncate max-w-[200px] sm:max-w-xs md:max-w-md text-foreground">
                            {item.name}
                        </span>
                    </div>
                ) : (
                    <PopoverRowCell
                        item={item}
                        isExcelUploaded={isExcelUploaded}
                        onUpdateQuantity={onUpdateQuantity}
                    />
                )
            },
            {
                key: 'category',
                header: 'Rubro',
                width: '120px',
                cell: (item) => (
                    <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap uppercase">
                        {item.category || 'Varios'}
                    </span>
                )
            },
            {
                key: 'ean',
                header: 'Ean',
                width: '140px',
                cell: (item) => (
                    <div 
                        className="flex items-center gap-1.5 group/ean cursor-copy select-none text-[13px] text-muted-foreground/80 leading-tight hover:text-primary hover:underline transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(item.ean);
                            notify.success("Código Copiado", `El EAN ${item.ean} se copió al portapapeles.`);
                        }}
                    >
                        <span>{item.ean}</span>
                    </div>
                )
            },
            {
                key: 'cost',
                header: 'Precio',
                width: '110px',
                cell: (item) => (
                    <span className="text-[13px] font-medium text-foreground tabular-nums">
                        ${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                )
            },
            {
                key: 'countedQuantity',
                header: 'Físico / Sistema',
                width: '140px',
                cell: (item) => {
                    const hasDiff = item.countedQuantity - item.systemQuantity !== 0;
                    return (
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
                    );
                }
            }
        ];

        if (!isPending) {
            baseCols.push(
                {
                    key: 'id',
                    header: 'Id',
                    width: '100px',
                    cell: (item) => {
                        const diff = item.countedQuantity - item.systemQuantity;
                        const val = diff < 0 ? item.shortageId : diff > 0 ? item.surplusId : null;
                        return val ? (
                            <Badge variant="outline">
                                {val.split(',')[0]}
                            </Badge>
                        ) : (
                            <span className="text-muted-foreground/10">—</span>
                        );
                    }
                },
                {
                    key: 'difference',
                    header: 'Diferencia',
                    width: '120px',
                    cell: (item) => {
                        const diff = item.countedQuantity - item.systemQuantity;
                        return diff === 0 ? (
                            <span className="text-muted-foreground/30 text-[13px] pl-4">–</span>
                        ) : (
                            <Badge variant="outline">
                                <span
                                    aria-hidden="true"
                                    className={cn("size-1.5 rounded-full", diff > 0 ? "bg-emerald-500" : "bg-red-500")}
                                />
                                {diff > 0 ? '+' : ''}{diff}
                            </Badge>
                        );
                    }
                },
                {
                    key: 'totalValue',
                    header: 'Total ($)',
                    width: '130px',
                    cell: (item) => {
                        const diff = item.countedQuantity - item.systemQuantity;
                        const diffValue = diff * item.cost;
                        return (
                            <p className={cn(
                                "text-[14px] font-medium tabular-nums",
                                diffValue === 0 ? "text-muted-foreground" : diffValue > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                                {diffValue < 0 && '-'}${Math.abs(diffValue).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </p>
                        );
                    }
                }
            );
        }

        return baseCols;
    }, [isPending, isExcelUploaded, readOnly, onUpdateQuantity]);

    return (
        <>
            <div className="w-full flex-1 relative bg-surface-5 shadow-surface-5 rounded-2xl border border-border/40 overflow-hidden flex flex-col h-[650px]">
            <Table
                data={items}
                columns={columns}
                getRowId={(row) => row.id}
                selectable={!readOnly}
                selectedRowIds={selectedIds}
                onSelectionChange={setSelectedIds}
                height={600}
                rowHeight={56}
                onRowClick={readOnly ? undefined : handleStartEdit}
                className="border-none"
            />

            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-input/40 bg-muted/5"
                    >
                        <div className="flex items-center justify-between px-6 py-3 h-14">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground">
                                    {selectedIds.length} {selectedIds.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedIds([])}
                                    className="relative z-10 flex h-8 items-center justify-center px-3 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground bg-transparent hover:bg-hover active:scale-[0.98] transition-all duration-80 outline-none cursor-pointer"
                                >
                                    Deseleccionar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkConfirm(true)}
                                    className="relative z-10 flex h-8 items-center justify-center gap-1.5 px-3 rounded-lg text-[13px] font-semibold text-background bg-foreground hover:bg-foreground/90 active:scale-[0.98] transition-all duration-80 outline-none cursor-pointer shadow-sm"
                                >
                                    <CheckCircle className="size-3.5" />
                                    Confirmar sin diferencia
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

            <Dialog open={showBulkConfirm} onOpenChange={(open) => !open && setShowBulkConfirm(false)}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Confirmar acción</DialogTitle>
                        <DialogDescription>
                            ¿Confirmar que los siguientes {selectedIds.length} productos no presentan diferencia con el sistema?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose render={<Button variant="ghost" />}>
                            Cancelar
                        </DialogClose>
                        <Button onClick={handleBulkConfirm}>
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
});

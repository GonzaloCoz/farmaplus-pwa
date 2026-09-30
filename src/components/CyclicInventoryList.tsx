import React, { useState, memo, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FluidCheckbox } from '@/components/ui/fluid-checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Table, type TableColumn } from '@/components/motion/table';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import { Search, X, CheckCircle } from 'lucide-react';

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
    id_producto?: string;
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

    useEffect(() => {
        if (open) {
            setQty(item.countedQuantity.toString());
            setReason(item.readjustmentReason || '');
        }
    }, [open, item.countedQuantity, item.readjustmentReason]);

    const handleSave = () => {
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
                <div className="flex items-center min-w-0 cursor-pointer group/cell py-0.5 select-none">
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-medium text-xs truncate max-w-[200px] sm:max-w-xs md:max-w-md group-hover/cell:text-primary transition-colors">
                            {item.name}
                        </span>
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
                        <p className="text-sm font-semibold text-foreground truncate">
                            {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                            EAN: {item.ean}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <label className="flex items-center justify-between gap-3 text-xs font-medium text-foreground">
                            <span className="text-muted-foreground">Stock Sistema</span>
                            <span className="font-semibold text-foreground bg-muted/40 px-3 py-1 rounded-lg w-28 text-right">
                                {item.systemQuantity} u.
                            </span>
                        </label>
                        <label className="flex items-center justify-between gap-3 text-xs font-medium text-foreground">
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
                                className="h-8 w-28 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/20 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                        className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer"
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
                            className="h-7 text-xs font-medium hover:bg-muted/50 rounded-lg"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="default"
                            onClick={handleSave}
                            className="h-7 text-xs font-semibold rounded-lg"
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
    className?: string;
    actions?: React.ReactNode;
    tabsSlot?: React.ReactNode;
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
    lastAdjustmentIds,
    className,
    actions,
    tabsSlot
}: CyclicInventoryListProps) {
    const [searchValue, setSearchValue] = useState("");
    const deferredSearch = React.useDeferredValue(searchValue);
    const [selectedDiffFilter, setSelectedDiffFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);

    // O(1) set for selected ids
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    // Filter items
    const filteredItems = useMemo(() => {
        const term = deferredSearch.toLowerCase().trim();
        const hasTerm = term.length > 0;
        const filterDiff = selectedDiffFilter;

        // Fast path: avoid filtering if no conditions active
        if (!hasTerm && filterDiff === "all") return items;

        return items.filter(item => {
            // Search filter
            if (hasTerm) {
                const matchName = item.name.toLowerCase().includes(term);
                const matchEan = item.ean.includes(term);
                if (!matchName && !matchEan) return false;
            }

            // Difference filter
            const diff = item.countedQuantity - item.systemQuantity;
            if (filterDiff === "diff" && diff === 0) return false;
            if (filterDiff === "nodiff" && diff !== 0) return false;

            return true;
        });
    }, [items, deferredSearch, selectedDiffFilter]);

    // Multi-select handlers
    const isAllSelected = useMemo(() => {
        return filteredItems.length > 0 && filteredItems.every(i => selectedSet.has(i.id));
    }, [filteredItems, selectedSet]);

    const isSomeSelected = useMemo(() => {
        return selectedIds.length > 0 && !isAllSelected;
    }, [selectedIds.length, isAllSelected]);

    const handleToggleAll = useCallback(() => {
        if (isAllSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredItems.map(i => i.id));
        }
    }, [isAllSelected, filteredItems]);

    const handleToggleRow = useCallback((id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    }, []);

    const handleBulkConfirm = useCallback(() => {
        if (onBulkCheck && selectedIds.length > 0) {
            onBulkCheck(selectedIds);
            setSelectedIds([]);
            setShowBulkConfirm(false);
        }
    }, [onBulkCheck, selectedIds]);

    // Table Columns
    const columns = useMemo<TableColumn<CyclicItem>[]>(() => {
        const cols: TableColumn<CyclicItem>[] = [];

        // Checkbox column
        if (!readOnly) {
            cols.push({
                key: "select",
                header: (
                    <div className="flex items-center justify-center">
                        <FluidCheckbox
                            checked={isAllSelected}
                            indeterminate={isSomeSelected}
                            onToggle={handleToggleAll}
                            className="size-4"
                        />
                    </div>
                ),
                width: "44px",
                cell: (row) => (
                    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <FluidCheckbox
                            checked={selectedSet.has(row.id)}
                            onToggle={() => handleToggleRow(row.id)}
                            className="size-4"
                        />
                    </div>
                ),
            });
        }

        // EAN
        cols.push({
            key: "ean",
            header: "Código EAN",
            sortable: true,
            width: "130px",
            sortValue: (row) => row.ean,
            cell: (row) => (
                <div 
                    className="flex items-center gap-1.5 group/ean cursor-pointer select-none text-xs tabular-nums text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(row.ean);
                        notify.success("Código Copiado", `EAN ${row.ean}`);
                    }}
                    title="Clic para copiar EAN"
                >
                    <span>{row.ean}</span>
                </div>
            )
        });

        // Producto
        cols.push({
            key: "name",
            header: "Producto",
            sortable: true,
            width: "280px",
            sortValue: (row) => row.name,
            cell: (row) => readOnly ? (
                <div className="flex items-center min-w-0 py-0.5 select-none">
                    <span className="font-medium text-xs truncate max-w-[220px] sm:max-w-xs md:max-w-sm text-foreground">
                        {row.name}
                    </span>
                </div>
            ) : (
                <PopoverRowCell
                    item={row}
                    isExcelUploaded={isExcelUploaded}
                    onUpdateQuantity={onUpdateQuantity}
                />
            )
        });

        // Rubro
        cols.push({
            key: "category",
            header: "Rubro",
            sortable: true,
            width: "120px",
            sortValue: (row) => row.category || '',
            cell: (row) => (
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-tight truncate block">
                    {row.category || 'Varios'}
                </span>
            )
        });

        // Precio
        cols.push({
            key: "cost",
            header: "Precio",
            sortable: true,
            width: "100px",
            sortValue: (row) => row.cost,
            cell: (row) => (
                <span className="text-xs font-medium text-foreground tabular-nums">
                    ${row.cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )
        });

        // Cantidad (Físico)
        cols.push({
            key: "quantity",
            header: "Cantidad",
            sortable: true,
            width: "85px",
            sortValue: (row) => row.countedQuantity,
            cell: (row) => (
                <span className="text-xs font-semibold tabular-nums text-foreground">
                    {row.countedQuantity}
                </span>
            )
        });

        // Columnas exclusivas para vistas Controlados y Ajustados (ocultas en Pendientes)
        if (!isPending) {
            // Sist / Dif
            cols.push({
                key: "sistDif",
                header: "Sist / Dif",
                sortable: true,
                width: "115px",
                sortValue: (row) => row.countedQuantity - row.systemQuantity,
                cell: (row) => {
                    const diff = row.countedQuantity - row.systemQuantity;
                    const hasDiff = diff !== 0;

                    return (
                        <div className="flex items-center justify-start gap-1.5 text-xs tabular-nums">
                            <span className="text-muted-foreground font-medium">
                                {row.systemQuantity}
                            </span>
                            <span className="text-muted-foreground/60">/</span>
                            {hasDiff ? (
                                <Badge 
                                    variant="outline" 
                                    size="compact"
                                    color={diff > 0 ? "green" : "red"}
                                    className="font-bold tabular-nums"
                                >
                                    {diff > 0 ? `+${diff}` : diff}
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground/60 font-medium text-xs">–</span>
                            )}
                        </div>
                    );
                }
            });

            cols.push({
                key: "differenceValue",
                header: "Total ($)",
                sortable: true,
                width: "110px",
                sortValue: (row) => (row.countedQuantity - row.systemQuantity) * row.cost,
                cell: (row) => {
                    const diff = row.countedQuantity - row.systemQuantity;
                    const diffValue = diff * row.cost;
                    return (
                        <p className={cn(
                            "text-xs font-medium tabular-nums",
                            diffValue === 0 ? "text-muted-foreground/40" : diffValue > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"
                        )}>
                            {diffValue === 0 ? "–" : `${diffValue < 0 ? '-' : '+'}$${Math.abs(diffValue).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </p>
                    );
                }
            });

            cols.push({
                key: "idAjuste",
                header: "Id Ajuste",
                sortable: true,
                width: "100px",
                sortValue: (row) => row.shortageId || row.surplusId || '',
                cell: (row) => {
                    const diff = row.countedQuantity - row.systemQuantity;
                    const val = diff < 0 ? row.shortageId : diff > 0 ? row.surplusId : null;
                    return val ? (
                        <Badge variant="outline" size="default" className="text-xs font-medium tabular-nums">
                            {val.split(',')[0]}
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground/20 text-xs">—</span>
                    );
                }
            });
        }

        return cols;
    }, [
        readOnly, 
        isAllSelected, 
        isSomeSelected, 
        handleToggleAll, 
        selectedSet, 
        handleToggleRow, 
        isExcelUploaded, 
        onUpdateQuantity, 
        isPending
    ]);

    return (
        <div className={cn("w-full flex-1 flex flex-col min-h-0", className)}>
            {/* Contenedor exterior estilo Fluid */}
            <div className="w-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 shadow-xs">
                {/* Recuadro interior blanco/más claro */}
                <div className="w-full bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-2 sm:p-3 shadow-xs min-h-[560px] flex flex-col relative">
                    
                    {/* Barra de controles: Buscador + Filtros */}
                    <div className="sticky top-0 z-30 bg-white/95 dark:bg-surface-3/95 backdrop-blur-md -mx-2 sm:-mx-3 -mt-2 sm:-mt-3 px-3 sm:px-4 py-3 rounded-t-[22px] border-b border-border/40 flex flex-wrap items-center justify-between gap-3 transition-colors shadow-2xs">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Buscador */}
                            <InputGroup className="w-[180px] h-8 rounded-lg border border-border bg-transparent hover:bg-hover transition-all duration-80 focus-within:ring-1 focus-within:ring-[color:var(--focus-ring,#6B97FF)] shadow-none shrink-0">
                                <InputGroupAddon className="pl-2.5 pr-1.5 text-muted-foreground">
                                    <Search className="size-3.5 shrink-0" />
                                </InputGroupAddon>
                                <InputGroupInput
                                    placeholder="Buscar producto o EAN…"
                                    value={searchValue}
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    className="h-full text-xs font-sans pr-2 placeholder:text-muted-foreground"
                                />
                                {searchValue && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchValue("")}
                                        className="pr-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    >
                                        <X className="size-3 shrink-0" />
                                    </button>
                                )}
                            </InputGroup>


                            {/* Filtro por Diferencia */}
                            <div className="w-[140px]">
                                <Select value={selectedDiffFilter} onValueChange={setSelectedDiffFilter}>
                                    <SelectTrigger placeholder="Diferencia" className="w-full min-w-0 h-8 text-xs font-sans rounded-lg" />
                                    <SelectContent className="max-h-[220px]">
                                        <SelectItem index={0} value="all" className="font-sans text-xs">Todos los ítems</SelectItem>
                                        <SelectItem index={1} value="diff" className="font-sans text-xs">Solo con diferencia</SelectItem>
                                        <SelectItem index={2} value="nodiff" className="font-sans text-xs">Sin diferencia</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Tabs de estado (Pendientes, Controlados, Ajustados, Historial) al lado derecho del select */}
                            {tabsSlot}
                        </div>

                        {/* Botones de acción alineados a la derecha de la barra de la tabla */}
                        {actions && (
                            <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap justify-end">
                                {actions}
                            </div>
                        )}
                    </div>

                    {/* Tabla de Productos */}
                    <div className="flex-1 w-full overflow-hidden rounded-b-[18px]">
                        <Table
                            data={filteredItems}
                            columns={columns}
                            getRowId={(row) => row.id}
                            resizable
                            reorderable
                            defaultSort={null}
                            height={520}
                            rowHeight={40}
                            dense={true}
                            overscan={5}
                            headerClassName="bg-white dark:bg-[#252525] dark:bg-surface-3 shadow-2xs"
                            emptyState={
                                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs gap-1.5">
                                    <span className="font-semibold text-foreground text-sm">
                                        {searchValue ? "No se encontraron productos coincidentes" : "No hay productos registrados en este estado"}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {searchValue 
                                            ? "Probá ajustando la búsqueda o los filtros seleccionados." 
                                            : "Los productos cargados aparecerán en esta tabla."}
                                    </span>
                                </div>
                            }
                            className="rounded-xl border-none w-full bg-transparent"
                        />
                    </div>

                    {/* Barra de Acciones por Lote (Bottom Bar) */}
                    <AnimatePresence>
                        {selectedIds.length > 0 && !readOnly && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-border/40 mt-2 bg-muted/5 rounded-b-xl"
                            >
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {selectedIds.length} {selectedIds.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedIds([])}
                                            className="flex h-7 items-center justify-center px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-transparent hover:bg-hover active:scale-[0.98] transition-all outline-none cursor-pointer"
                                        >
                                            Deseleccionar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowBulkConfirm(true)}
                                            className="flex h-7 items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold text-background bg-foreground hover:bg-foreground/90 active:scale-[0.98] transition-all outline-none cursor-pointer shadow-sm"
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
            </div>

            {/* Modal de confirmación masiva */}
            <Dialog open={showBulkConfirm} onOpenChange={(open) => !open && setShowBulkConfirm(false)}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Confirmar acción</DialogTitle>
                        <DialogDescription>
                            ¿Confirmar que los {selectedIds.length} productos seleccionados no presentan diferencia con el sistema?
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
        </div>
    );
});

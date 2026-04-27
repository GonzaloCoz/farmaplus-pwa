import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pen as Pencil, TrashBinMinimalistic as Trash2, Widget as Package, Copy, CheckCircle as Check, Magnifer as SearchIcon, AltArrowRight as ArrowRight } from '@solar-icons/react';
import { cn } from '@/lib/utils';
import { UIPreCountItem } from '@/hooks/usePreCount';
import { ProductPreview } from '@/components/ProductPreview';
import { SwipeableItem } from '@/components/SwipeableItem';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Frame, FramePanel, FrameFooter } from "@/components/ui/frame";
import {
    Select,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectContent,
} from "@/components/ui/select";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    NumberField,
    NumberFieldDecrement,
    NumberFieldIncrement,
    NumberFieldInput,
} from '@/components/ui/number-field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    type PaginationState,
    useReactTable,
} from "@tanstack/react-table";
import { ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { MasterCatalogItem } from '@/services/preCountDB';

interface PreCountListProps {
    items: UIPreCountItem[];
    mode?: 'full' | 'restricted' | 'readonly';
    onUpdate: (id: string, quantity: number) => void;
    onDelete: (id: string) => void;
    onEditRequest?: (item: UIPreCountItem) => void;
    masterCatalog?: MasterCatalogItem[];
}

export function PreCountList({ items, mode = 'full', onUpdate, onDelete, onEditRequest, masterCatalog }: PreCountListProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState<number>(1);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 20,
    });
    
    const [sorting, setSorting] = useState<SortingState>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sort items by timestamp descending by default, then filter by search
    const filteredItems = useMemo(() => {
        const sortedByTime = [...items].sort((a, b) => b.timestamp - a.timestamp);
        if (!searchTerm.trim()) return sortedByTime;
        const term = searchTerm.toLowerCase().trim();
        return sortedByTime.filter(item =>
            (item.ean?.toLowerCase() || '').includes(term) ||
            (item.productName?.toLowerCase() || '').includes(term)
        );
    }, [items, searchTerm]);

    const handleStartEdit = (item: UIPreCountItem) => {
        setEditingId(item.id);
        setEditQuantity(item.quantity);
    };

    const handleSaveEdit = () => {
        if (editingId && editQuantity !== 0) {
            onUpdate(editingId, editQuantity);
            setEditingId(null);
            setEditQuantity(1);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditQuantity(1);
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const getDeviceColor = (deviceId?: string) => {
        if (!deviceId) return 'transparent';
        let hash = 0;
        for (let i = 0; i < deviceId.length; i++) {
            hash = deviceId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 45%)`;
    };

    const columns = useMemo<ColumnDef<UIPreCountItem>[]>(() => [
        {
            accessorKey: "productName",
            header: "Producto",
            size: 340,
            cell: ({ row }) => {
                const item = row.original;
                const isUnknown = (item.productName || '').startsWith('Producto ');
                const isUnknownToMaster = masterCatalog && masterCatalog.length > 0 
                    ? !masterCatalog.some(m => m.ean === item.ean)
                    : false;

                return (
                    <div className="flex items-center gap-3 pr-2">
                        <ProductPreview
                            ean={item.ean}
                            productName={item.productName}
                        />
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className={cn("font-semibold text-[13px] leading-tight text-foreground/90 line-clamp-2", isUnknown && "text-destructive", isUnknownToMaster && "text-blue-500")}>
                                {item.productName}
                            </span>
                            {isUnknown ? (
                                <span className="text-[9px] text-destructive flex w-fit items-center gap-1.5 font-bold bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                                    <span className="w-1 h-1 rounded-full bg-destructive" /> NO ENCONTRADO
                                </span>
                            ) : isUnknownToMaster ? (
                               <span className="text-[9px] text-blue-500 flex w-fit items-center gap-1.5 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                    <span className="w-1 h-1 rounded-full bg-blue-500" /> NUEVO
                                </span>
                            ) : item.synced === 0 && (
                                <span className="text-[9px] text-warning flex w-fit items-center gap-1.5 font-bold bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
                                    <span className="w-1 h-1 rounded-full bg-warning animate-pulse" /> SINCRONIZANDO
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "ean",
            header: "Código (EAN)",
            size: 160,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <button
                        onClick={() => copyToClipboard(item.ean, item.id)}
                        className="flex items-center gap-2 text-foreground/90 hover:bg-muted/50 px-2.5 py-1.5 rounded-md transition-all group/ean active:scale-95 text-left border border-transparent hover:border-border/50"
                        title="Copiar EAN"
                    >
                        <span className="text-xs font-mono tracking-wider font-medium">
                            {item.ean}
                        </span>
                        {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-success animate-bounce-in flex-shrink-0" />
                        ) : (
                            <Copy className="w-3.5 h-3.5 opacity-0 group-hover/ean:opacity-50 transition-opacity flex-shrink-0" />
                        )}
                    </button>
                );
            },
        },
        {
            accessorKey: "location_tag",
            header: "Sector",
            size: 100,
            cell: ({ row }) => {
                const tag = row.original.location_tag;
                if (!tag) return <span className="text-muted-foreground/50 text-xs">-</span>;
                return (
                    <Badge className="font-bold tabular-nums bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none hover:bg-amber-500/20" size="sm" variant="outline">
                        <MapPin className="size-3 mr-1" />
                        <span>{tag}</span>
                    </Badge>
                );
            },
        },
        {
            accessorKey: "quantity",
            header: "Cant.",
            size: 80,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div 
                        className={cn("flex justify-end transition-transform", mode === 'full' && "cursor-pointer active:scale-95")}
                        onClick={() => mode === 'full' && onEditRequest && onEditRequest(item)}
                    >
                        <span className={cn(
                            "text-base font-semibold tabular-nums px-2 py-1 rounded-md transition-colors",
                            mode === 'full' && "hover:bg-muted/50",
                            item.quantity < 0 ? "text-destructive" : "text-foreground"
                        )}>
                            {item.quantity}
                        </span>
                    </div>
                );
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right w-full">Acciones</div>,
            enableSorting: false,
            size: 90,
            cell: ({ row }) => {
                const item = row.original;
                if (mode === 'readonly') return null;
                return (
                    <div className="flex justify-end gap-1.5">
                        {mode === 'full' && (
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors h-8 w-8"
                                onClick={() => handleStartEdit(item)}
                                title="Editar"
                            >
                                <Pencil className="w-4 h-4" />
                            </Button>
                        )}
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors h-8 w-8"
                            onClick={() => mode === 'restricted' ? setDeleteConfirmId(item.id) : onDelete(item.id)}
                            title="Eliminar"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                );
            },
        },
    ], [copiedId, onDelete, mode]);

    const table = useReactTable({
        data: filteredItems,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        state: {
            pagination,
            sorting,
        },
    });

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground opacity-60">
                <Package className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg font-medium">No hay productos agregados aún</p>
                <p className="text-sm">Escanea o busca productos para comenzar</p>
            </div>
        );
    }

    return (
        <Frame className="w-full h-full flex flex-col border-none shadow-none rounded-none bg-transparent">
            <FramePanel className="p-0 overflow-y-auto border-none flex-1">
                    {isMobile ? (
                        <div className="flex flex-col w-full divide-y divide-border/40">
                            <AnimatePresence initial={false}>
                                {items.slice(pagination.pageIndex * pagination.pageSize, (pagination.pageIndex + 1) * pagination.pageSize).map((item) => (
                                    <SwipeableItem 
                                        key={item.id} 
                                        onDelete={mode !== 'readonly' ? () => {
                                            if (mode === 'restricted') {
                                                setDeleteConfirmId(item.id);
                                            } else {
                                                onDelete(item.id);
                                            }
                                        } : () => {}}
                                    >
                                        <div 
                                            className={cn(
                                                "w-full flex items-center justify-between p-4 bg-background transition-colors",
                                                mode === 'full' && "active:bg-muted/30"
                                            )}
                                            onClick={() => {
                                                if (mode === 'full' && onEditRequest) {
                                                    onEditRequest(item);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <ProductPreview
                                                    ean={item.ean}
                                                    productName={item.productName}
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-semibold text-xs text-foreground truncate">{item.productName}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] text-muted-foreground font-mono truncate">{item.ean}</span>
                                                        {item.location_tag && (
                                                            <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20 shrink-0">
                                                                {item.location_tag}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 ml-4">
                                                <span className="text-xl font-black text-foreground">{item.quantity}</span>
                                                <ArrowRight className="size-4 text-muted-foreground/30" />
                                            </div>
                                        </div>
                                    </SwipeableItem>
                                ))}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <Table className="lg:table-fixed border-separate border-spacing-0 w-full lg:min-w-[600px]">
                            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm shadow-sm">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow className="hover:bg-transparent border-none" key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => {
                                            const columnSize = header.column.getSize();
                                            return (
                                                <TableHead
                                                    key={header.id}
                                                    style={columnSize ? { width: `${columnSize}px` } : undefined}
                                                    className={cn(
                                                        "bg-transparent",
                                                        (header.id === 'ean' || header.id === 'actions') && "hidden lg:table-cell"
                                                    )}
                                                >
                                                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                                        <div
                                                            className={cn("flex h-full cursor-pointer select-none items-center gap-2", header.id === 'quantity' ? 'justify-end' : 'justify-start')}
                                                            onClick={header.column.getToggleSortingHandler()}
                                                            role="button"
                                                            tabIndex={0}
                                                        >
                                                            {flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}
                                                            {{
                                                                asc: <ChevronUpIcon className="size-4 shrink-0 opacity-80" />,
                                                                desc: <ChevronDownIcon className="size-4 shrink-0 opacity-80" />,
                                                            }[header.column.getIsSorted() as string] ?? null}
                                                        </div>
                                                    ) : (
                                                        flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )
                                                    )}
                                                </TableHead>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence initial={false}>
                                    {table.getRowModel().rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className="transition-colors hover:bg-muted/30 border-b border-border/40 group relative"
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell 
                                                    key={cell.id} 
                                                    className={cn(
                                                        (cell.column.id === 'ean' || cell.column.id === 'actions') && "hidden lg:table-cell"
                                                    )}
                                                >
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </AnimatePresence>
                            </TableBody>
                        </Table>
                    )}
            </FramePanel>
            
            <FrameFooter className="hidden lg:flex p-2 border-t border-border/20 bg-card/80 backdrop-blur shrink-0 min-h-[50px] items-center">
                <div className="flex items-center justify-between gap-2 w-full">
                    {/* Search filter */}
                    <InputGroup className="h-8 w-40 lg:w-52 bg-popover border-input shadow-xs shrink-0">
                        <InputGroupAddon className="bg-transparent border-none">
                            <SearchIcon className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                        </InputGroupAddon>
                        <InputGroupInput
                            aria-label="Buscar"
                            placeholder="Buscar EAN o descripción..."
                            type="search"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPagination(prev => ({ ...prev, pageIndex: 0 }));
                            }}
                            className="bg-transparent border-none focus-visible:ring-0 text-xs h-full"
                        />
                    </InputGroup>

                    <div className="flex items-center gap-2 whitespace-nowrap px-2">
                        <p className="text-muted-foreground text-[13px]">Viendo</p>
                        <Select
                            items={Array.from({ length: table.getPageCount() }, (_, i) => {
                                const start = i * table.getState().pagination.pageSize + 1;
                                const end = Math.min(
                                    (i + 1) * table.getState().pagination.pageSize,
                                    table.getRowCount()
                                );
                                const pageNum = i + 1;
                                return { label: `${start}-${end}`, value: pageNum.toString() };
                            })}
                            onValueChange={(value) => {
                                table.setPageIndex((parseInt(value.toString())) - 1);
                            }}
                            value={(table.getState().pagination.pageIndex + 1).toString()}
                        >
                            <SelectTrigger
                                aria-label="Seleccionar rango de resultados"
                                className="w-fit"
                                size="sm"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: table.getPageCount() }, (_, i) => {
                                    const start = i * table.getState().pagination.pageSize + 1;
                                    const end = Math.min(
                                        (i + 1) * table.getState().pagination.pageSize,
                                        table.getRowCount()
                                    );
                                    const pageNum = i + 1;
                                    return (
                                        <SelectItem key={pageNum} value={pageNum.toString()} className="text-xs">
                                            {`${start}-${end}`}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-[13px]">
                            de <strong className="font-medium text-foreground">{table.getRowCount()}</strong>
                        </p>
                    </div>

                    <Pagination className="justify-end px-2">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    children="Ant."
                                    className="sm:*:[svg]:hidden"
                                    render={
                                        <Button
                                            disabled={!table.getCanPreviousPage()}
                                            onClick={() => table.previousPage()}
                                            size="sm"
                                            variant="outline"
                                            className="border-border/40 text-xs font-medium hover:bg-muted/50 h-8"
                                        >
                                            Ant.
                                        </Button>
                                    }
                                />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationNext
                                    children="Sig."
                                    className="sm:*:[svg]:hidden"
                                    render={
                                        <Button
                                            disabled={!table.getCanNextPage()}
                                            onClick={() => table.nextPage()}
                                            size="sm"
                                            variant="outline"
                                            className="border-border/40 text-xs font-medium hover:bg-muted/50 h-8"
                                        >
                                            Sig.
                                        </Button>
                                    }
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            </FrameFooter>

            {/* Dialog de edición */}
            <Dialog open={editingId !== null} onOpenChange={(open) => !open && handleCancelEdit()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Cantidad</DialogTitle>
                    </DialogHeader>
                    <div className="px-6 py-4">
                        <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">
                                Nueva cantidad
                            </label>
                            <NumberField
                                value={editQuantity}
                                onValueChange={(val) => setEditQuantity(val ?? 1)}
                                min={1}
                                className="w-full relative"
                            >
                                <div className="relative">
                                    <NumberFieldDecrement />
                                    <NumberFieldInput
                                        className="h-11 text-base font-semibold"
                                        autoFocus
                                        inputMode="none"
                                        onKeyDown={(e: React.KeyboardEvent) => {
                                            if (e.key === 'Enter') handleSaveEdit();
                                        }}
                                    />
                                    <NumberFieldIncrement />
                                </div>
                            </NumberField>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancelEdit}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={editQuantity === 0}>
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmación de eliminación (modo restricted) */}
            <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Eliminación</DialogTitle>
                    </DialogHeader>
                    <div className="px-6 py-4">
                        <p className="text-sm text-muted-foreground">
                            ¿Estás seguro de que deseas eliminar{' '}
                            <span className="font-bold text-foreground">
                                {items.find(i => i.id === deleteConfirmId)?.productName}
                            </span>
                            {' '}({items.find(i => i.id === deleteConfirmId)?.ean})?
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-2">
                            Para modificar la cantidad, abrí nuevamente el sector correspondiente.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                            Cancelar
                        </Button>
                        <Button 
                            variant="destructive"
                            onClick={() => {
                                if (deleteConfirmId) {
                                    onDelete(deleteConfirmId);
                                    setDeleteConfirmId(null);
                                }
                            }}
                        >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Frame>
    );
}

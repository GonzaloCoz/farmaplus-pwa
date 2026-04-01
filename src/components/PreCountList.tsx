import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pen as Pencil, TrashBinMinimalistic as Trash2, Widget as Package, Copy, CheckCircle as Check, Magnifer as SearchIcon } from '@solar-icons/react';
import { cn } from '@/lib/utils';
import { UIPreCountItem } from '@/hooks/usePreCount';
import { ProductPreview } from '@/components/ProductPreview';
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
    type PaginationState,
    useReactTable,
} from "@tanstack/react-table";

import { MasterCatalogItem } from '@/services/preCountDB';

interface PreCountListProps {
    items: UIPreCountItem[];
    onUpdate: (id: string, quantity: number) => void;
    onDelete: (id: string) => void;
    masterCatalog?: MasterCatalogItem[];
}

export function PreCountList({ items, onUpdate, onDelete, masterCatalog }: PreCountListProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQuantity, setEditQuantity] = useState<number>(1);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 20,
    });

    const [searchTerm, setSearchTerm] = useState('');

    // Reverse items so newest (last added) appear first, then filter by search
    const filteredItems = useMemo(() => {
        const reversed = [...items].reverse();
        if (!searchTerm.trim()) return reversed;
        const term = searchTerm.toLowerCase().trim();
        return reversed.filter(item =>
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
                            <span className={cn("font-semibold text-[13px] leading-tight text-foreground/90 truncate", isUnknown && "text-destructive", isUnknownToMaster && "text-blue-500")}>
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
                            ) : item.synced === 0 ? (
                                <span className="text-[9px] text-warning flex w-fit items-center gap-1.5 font-bold bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
                                    <span className="w-1 h-1 rounded-full bg-warning animate-pulse" /> SINCRONIZANDO
                                </span>
                            ) : (
                                <span className="text-[11px] font-mono text-muted-foreground/60 tracking-wider">
                                    {item.ean}
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
            accessorKey: "quantity",
            header: () => <div className="text-right">Cant.</div>,
            size: 80,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex justify-end pr-2">
                        <span className={cn(
                            "text-lg font-black tracking-tighter",
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
            header: () => <div className="text-right w-full pr-2">Acciones</div>,
            size: 90,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex justify-end gap-1.5 pr-2">
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors h-8 w-8"
                            onClick={() => handleStartEdit(item)}
                            title="Editar"
                        >
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors h-8 w-8"
                            onClick={() => onDelete(item.id)}
                            title="Eliminar"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                );
            },
        },
    ], [copiedId, onDelete]);

    const table = useReactTable({
        data: filteredItems,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onPaginationChange: setPagination,
        state: {
            pagination,
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
                <Table className="table-fixed border-separate border-spacing-0 w-full min-w-[600px]">
                    <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm shadow-sm">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow className="hover:bg-transparent border-none" key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const columnSize = header.column.getSize();
                                    return (
                                        <TableHead
                                            key={header.id}
                                            style={columnSize ? { width: `${columnSize}px` } : undefined}
                                            className="h-10 border-b border-border/50 bg-transparent text-[11px] font-bold tracking-wider uppercase text-muted-foreground"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef.header,
                                                      header.getContext()
                                                  )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        <AnimatePresence>
                            {table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className="transition-colors hover:bg-muted/30 border-b border-border/40 group relative"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-2.5 align-middle">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </AnimatePresence>
                    </TableBody>
                </Table>
            </FramePanel>
            
            <FrameFooter className="p-2 border-t border-border/20 bg-card/80 backdrop-blur shrink-0 min-h-[50px] flex items-center">
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
        </Frame>
    );
}

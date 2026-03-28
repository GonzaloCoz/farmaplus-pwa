import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notify } from "@/lib/notifications";
import { Plus, Check, ChevronUpIcon, ChevronDownIcon } from "lucide-react";
import { Restart as Loader2, Diskette as Save, TrashBinMinimalistic as Trash2, Calendar } from "@solar-icons/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";
import { PageLayout } from "@/components/layout/PageLayout";
import { useQueryClient } from "@tanstack/react-query";
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type PaginationState,
    type SortingState,
    useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface Branch {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    config: any;
}

export default function AdminBranches() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
    const [bulkDays, setBulkDays] = useState<number>(30);
    const [bulkStartDate, setBulkStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isSavingBulk, setIsSavingBulk] = useState(false);
    const [rowSelection, setRowSelection] = useState({});

    const { user } = useUser();
    const queryClient = useQueryClient();

    // New Branch State
    const [newName, setNewName] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newAddress, setNewAddress] = useState("");

    useEffect(() => {
        loadBranches();
    }, []);

    const loadBranches = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('branches')
            .select('*')
            .order('name');

        if (error) {
            notify.error("Error de carga", "No se pudieron cargar las sucursales");
            console.error(error);
        } else {
            setBranches(data || []);
        }
        setIsLoading(false);
    };

    const handleCreate = async () => {
        if (!newName || !newSlug) {
            notify.error("Datos incompletos", "Nombre y Slug son requeridos");
            return;
        }

        const { error } = await supabase.from('branches').insert({
            name: newName,
            slug: newSlug,
            address: newAddress
        });

        if (error) {
            notify.error("Error al crear", "No se pudo crear la sucursal: " + error.message);
        } else {
            notify.success("Sucursal creada", "La sucursal se creó exitosamente");
            setNewName("");
            setNewSlug("");
            setNewAddress("");
            setIsCreating(false);
            loadBranches();
        }
    };

    const generateSlug = (name: string) => {
        return name.toLowerCase().trim().replace(/\s+/g, '');
    };

    const handleBulkSave = async (selectedBranchNames: string[]) => {
        if (selectedBranchNames.length === 0) return;

        setIsSavingBulk(true);
        try {
            await cyclicInventoryService.saveBulkBranchConfig(
                selectedBranchNames,
                bulkDays,
                bulkStartDate
            );
            notify.success("Configuración actualizada", `Se actualizaron ${selectedBranchNames.length} sucursales`);

            // Invalidate monitor summaries to force refresh when user returns to dashboard
            queryClient.invalidateQueries({ queryKey: ['branch-summaries-lite'] });

            setIsBulkDialogOpen(false);
            setRowSelection({});
        } catch (error) {
            notify.error("Error al actualizar", "No se pudo realizar la asignación masiva");
        } finally {
            setIsSavingBulk(false);
        }
    };

    const columns: ColumnDef<Branch>[] = [
        {
            id: "select",
            size: 28,
            header: ({ table }) => (
                <Checkbox
                    aria-label="Seleccionar todas"
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    aria-label="Seleccionar fila"
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                />
            ),
            enableSorting: false,
        },
        {
            accessorKey: "name",
            header: "Nombre",
            size: 220,
            cell: ({ row }) => <div className="font-semibold text-foreground/90">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "slug",
            header: "Slug (Usuario)",
            size: 180,
            cell: ({ row }) => <div className="font-mono text-[11px] text-muted-foreground">{row.getValue("slug")}</div>,
        },
        {
            accessorKey: "address",
            header: "Dirección",
            size: 280,
            cell: ({ row }) => <div className="text-sm text-muted-foreground/80">{row.getValue("address") || '-'}</div>,
        },
        {
            id: "actions",
            header: () => <div className="text-right w-full pr-2">Acciones</div>,
            size: 80,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <Button variant="ghost" size="icon-sm" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            ),
            enableSorting: false,
        },
    ];

    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    const [sorting, setSorting] = useState<SortingState>([
        {
            desc: false,
            id: "name",
        },
    ]);

    const table = useReactTable({
        columns,
        data: branches,
        enableSortingRemoval: false,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        state: {
            pagination,
            sorting,
            rowSelection,
        },
    });

    const selectedBranchNames = table.getSelectedRowModel().rows.map(r => r.original.name);

    return (
        <PageLayout>
            <PageHeader
                title="Administración de Sucursales"
                subtitle="Gestiona las sucursales del sistema"
                actions={
                    <div className="flex gap-2">
                        {selectedBranchNames.length > 0 && (
                            <Button
                                variant="outline"
                                className="border-primary text-primary hover:bg-primary/10 transition-all font-medium h-9"
                                onClick={() => setIsBulkDialogOpen(true)}
                            >
                                <Calendar className="mr-2 size-4" /> Asignar Plazo ({selectedBranchNames.length})
                            </Button>
                        )}
                        <Button className="h-9 shadow-xs" onClick={() => setIsCreating(!isCreating)}>
                            {isCreating ? 'Cancelar' : <><Plus className="mr-2 size-4" /> Nueva Sucursal</>}
                        </Button>
                    </div>
                }
            />

            {isCreating && (
                <Card className="mb-6">
                    <CardHeader><CardTitle>Nueva Sucursal</CardTitle></CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input
                                    placeholder="Nombre (ej: Belgrano X)"
                                    value={newName}
                                    onChange={(e) => {
                                        setNewName(e.target.value);
                                        if (!newSlug) setNewSlug(generateSlug(e.target.value));
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug (Usuario)</Label>
                                <Input
                                    placeholder="Slug (ej: belgranox)"
                                    value={newSlug}
                                    onChange={(e) => setNewSlug(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Dirección</Label>
                                <Input
                                    placeholder="Dirección"
                                    value={newAddress}
                                    onChange={(e) => setNewAddress(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button onClick={handleCreate} className="w-fit"><Save className="mr-2 h-4 w-4" /> Guardar</Button>
                    </CardContent>
                </Card>
            )}

            <Frame className="w-full">
                <FramePanel className="p-0 overflow-hidden border-border/30">
                    <Table className="table-fixed border-separate border-spacing-0">
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow className="hover:bg-transparent border-none" key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        const columnSize = header.column.getSize();
                                        return (
                                            <TableHead
                                                key={header.id}
                                                style={columnSize ? { width: `${columnSize}px` } : undefined}
                                                className="h-10 border-none bg-transparent"
                                            >
                                                {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                                    <div
                                                        className="flex h-full cursor-pointer select-none items-center justify-between gap-2"
                                                        onClick={header.column.getToggleSortingHandler()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                e.preventDefault();
                                                                header.column.getToggleSortingHandler()?.(e);
                                                            }
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                    >
                                                        {flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext(),
                                                        )}
                                                        {{
                                                            asc: (
                                                                <ChevronUpIcon
                                                                    aria-hidden="true"
                                                                    className="size-4 shrink-0 opacity-80"
                                                                />
                                                            ),
                                                            desc: (
                                                                <ChevronDownIcon
                                                                    aria-hidden="true"
                                                                    className="size-4 shrink-0 opacity-80"
                                                                />
                                                            ),
                                                        }[header.column.getIsSorted() as string] ?? null}
                                                    </div>
                                                ) : (
                                                    flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext(),
                                                    )
                                                )}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-32 text-center">
                                        <div className="flex justify-center items-center h-full">
                                            <Loader2 className="size-6 animate-spin text-muted-foreground/50" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        data-selected={row.getIsSelected() || undefined}
                                        key={row.id}
                                        className="transition-colors hover:bg-muted/30 border-t border-border/40"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="py-3">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell className="h-32 text-center text-muted-foreground/60 italic" colSpan={columns.length}>
                                        No hay sucursales registradas.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </FramePanel>
                {branches.length > 0 && (
                    <FrameFooter className="p-2 border-t border-border/20">
                        <div className="flex items-center justify-between gap-2 w-full">
                            <div className="flex items-center gap-2 whitespace-nowrap px-2">
                                <p className="text-muted-foreground text-[13px]">Viendo</p>
                                <Select
                                    items={Array.from({ length: table.getPageCount() }, (_, i) => {
                                        const start = i * table.getState().pagination.pageSize + 1;
                                        const end = Math.min(
                                            (i + 1) * table.getState().pagination.pageSize,
                                            table.getRowCount(),
                                        );
                                        const pageNum = i + 1;
                                        return { label: `${start}-${end}`, value: pageNum };
                                    })}
                                    onValueChange={(value) => {
                                        table.setPageIndex((value as number) - 1);
                                    }}
                                    value={table.getState().pagination.pageIndex + 1}
                                >
                                    <SelectTrigger
                                        aria-label="Seleccionar rango de resultados"
                                        className="w-fit min-w-none h-8 text-xs border-border/50 bg-transparent px-2"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: table.getPageCount() }, (_, i) => {
                                            const start = i * table.getState().pagination.pageSize + 1;
                                            const end = Math.min(
                                                (i + 1) * table.getState().pagination.pageSize,
                                                table.getRowCount(),
                                            );
                                            const pageNum = i + 1;
                                            return (
                                                <SelectItem key={pageNum} value={pageNum} className="text-xs">
                                                    {`${start}-${end}`}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                <p className="text-muted-foreground text-[13px]">
                                    de{" "}
                                    <strong className="font-medium text-foreground">
                                        {table.getRowCount()}
                                    </strong>{" "}
                                    resultados
                                </p>
                            </div>

                            <Pagination className="justify-end px-2">
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            children="Anterior"
                                            className="sm:*:[svg]:hidden"
                                            render={
                                                <Button
                                                    disabled={!table.getCanPreviousPage()}
                                                    onClick={() => table.previousPage()}
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-border/40 text-xs font-medium hover:bg-muted/50 h-8"
                                                >
                                                    Anterior
                                                </Button>
                                            }
                                        />
                                    </PaginationItem>
                                    <PaginationItem>
                                        <PaginationNext
                                            children="Siguiente"
                                            className="sm:*:[svg]:hidden"
                                            render={
                                                <Button
                                                    disabled={!table.getCanNextPage()}
                                                    onClick={() => table.nextPage()}
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-border/40 text-xs font-medium hover:bg-muted/50 h-8"
                                                >
                                                    Siguiente
                                                </Button>
                                            }
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    </FrameFooter>
                )}
            </Frame>

            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Asignación Masiva de Plazo</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="days">Días para el Inventario Cíclico</Label>
                            <Input
                                id="days"
                                type="number"
                                value={bulkDays}
                                onChange={(e) => setBulkDays(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Las sucursales seleccionadas se bloquearán automáticamente al pasar estos días.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Fecha de Inicio del Ciclo</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={bulkStartDate}
                                onChange={(e) => setBulkStartDate(e.target.value)}
                            />
                        </div>
                        <div className="bg-muted/30 p-3 rounded-xl border border-border/50 shadow-xs/5">
                            <p className="text-[11px] font-semibold text-foreground/80 mb-1 uppercase tracking-wider">Sucursales seleccionadas ({selectedBranchNames.length}):</p>
                            <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {selectedBranchNames.join(', ')}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => handleBulkSave(selectedBranchNames)} disabled={isSavingBulk}>
                            {isSavingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Aplicar a {selectedBranchNames.length} sucursales
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageLayout>
    );
}


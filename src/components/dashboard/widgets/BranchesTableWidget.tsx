import { useState, useMemo } from 'react';
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type PaginationState,
    type SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Frame, FrameHeader, FrameTitle, FrameDescription, FramePanel, FrameFooter } from '@/components/ui/frame';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Magnifer as Search, AltArrowUp as ChevronUp, AltArrowDown as ChevronDown, Download, GraphUp as TrendingUp } from '@solar-icons/react';
import * as XLSX from 'xlsx';
import { cn, normalizeString } from '@/lib/utils';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { useUser } from '@/contexts/UserContext';
import { useUserBranches } from '@/hooks/useUserBranches';
import { useQuery } from '@tanstack/react-query';

interface BranchSummary {
    branchName: string;
    deploymentDate: string;
    assignedDays: number;
    remainingDays: number;
    cyclicRound: number;
    monthlyGoal: number;
    elapsedDays: number;
    progress: number;
    inventoryUnits: number;
    differenceUnits: number;
    adjustmentsValue: number;
    status: 'controlado' | 'por_controlar' | 'pendiente';
}

// Status dot color mapping (matching p-table-4 flights pattern)
const getStatusColor = (status: BranchSummary['status']) => {
    switch (status) {
        case 'controlado':
            return 'bg-emerald-500';
        case 'por_controlar':
            return 'bg-blue-500';
        case 'pendiente':
            return 'bg-amber-500';
        default:
            return 'bg-muted-foreground/64';
    }
};

const getStatusLabel = (status: BranchSummary['status']) => {
    switch (status) {
        case 'controlado':
            return 'Controlado';
        case 'por_controlar':
            return 'En Proceso';
        case 'pendiente':
            return 'Pendiente';
        default:
            return status;
    }
};

// Column definitions (matching p-table-4 structure exactly)
const columns: ColumnDef<BranchSummary>[] = [
    {
        id: 'select',
        size: 28,
        enableSorting: false,
        header: ({ table }) => {
            const isAllSelected = table.getIsAllPageRowsSelected();
            const isSomeSelected = table.getIsSomePageRowsSelected();
            return (
                <div className="flex items-center justify-center h-full" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        aria-label="Select all rows"
                        checked={isAllSelected ? true : isSomeSelected ? "indeterminate" as const : false}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    />
                </div>
            );
        },
        cell: ({ row }) => (
            <div className="flex items-center justify-center h-full" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    aria-label="Select row"
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                />
            </div>
        ),
    },
    {
        accessorKey: 'branchName',
        header: 'Sucursal',
        size: 180,
        cell: ({ row }) => (
            <div className="font-medium">
                {row.getValue('branchName')}
            </div>
        ),
    },
    {
        accessorKey: 'deploymentDate',
        header: 'Fecha Inicio',
        size: 120,
        cell: ({ row }) => (
            <div className="font-medium font-mono text-muted-foreground whitespace-nowrap">
                {row.getValue('deploymentDate')}
            </div>
        ),
    },
    {
        accessorKey: 'remainingDays',
        header: 'Días',
        size: 100,
        cell: ({ row }) => {
            const remaining = row.original.remainingDays;
            const assigned = row.original.assignedDays;
            return (
                <div className="tabular-nums">
                    <span className={cn("font-medium", remaining <= 5 && "text-destructive-foreground")}>
                        {remaining}
                    </span>
                    <span className="text-muted-foreground"> / {assigned}</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'cyclicRound',
        header: 'Vuelta',
        size: 60,
        cell: ({ row }) => (
            <div className="text-muted-foreground tabular-nums">
                {row.getValue('cyclicRound')}ª
            </div>
        ),
    },
    {
        accessorKey: 'progress',
        header: '% Avance',
        size: 90,
        cell: ({ row }) => {
            const progress = row.getValue('progress') as number;
            return (
                <div className="font-medium tabular-nums">
                    {progress.toFixed(1)}%
                </div>
            );
        },
    },
    {
        accessorKey: 'inventoryUnits',
        header: 'Unidades',
        size: 90,
        cell: ({ row }) => (
            <div className="text-muted-foreground tabular-nums">
                {(row.getValue('inventoryUnits') as number).toLocaleString('es-AR')}
            </div>
        ),
    },
    {
        accessorKey: 'differenceUnits',
        header: 'Diferencia',
        size: 100,
        cell: ({ row }) => {
            const diff = row.getValue('differenceUnits') as number;
            if (diff === 0) return <span className="text-muted-foreground">–</span>;
            return (
                <Badge variant="outline">
                    <span
                        aria-hidden="true"
                        className={cn("size-1.5 rounded-full", diff > 0 ? "bg-emerald-500" : "bg-red-500")}
                    />
                    {diff > 0 ? '+' : ''}{diff}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'adjustmentsValue',
        header: 'Ajustes',
        size: 140,
        cell: ({ row }) => {
            const value = row.getValue('adjustmentsValue') as number;
            return (
                <div className={cn(
                    "font-medium tabular-nums text-left",
                    value === 0 ? "text-muted-foreground" : value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                    {value < 0 && '-'}${Math.abs(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
            );
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        size: 120,
        cell: ({ row }) => {
            const status = row.getValue('status') as BranchSummary['status'];
            return (
                <Badge variant="outline">
                    <span
                        aria-hidden="true"
                        className={cn("size-1.5 rounded-full", getStatusColor(status))}
                    />
                    {getStatusLabel(status)}
                </Badge>
            );
        },
    },
];

interface BranchesTableWidgetProps {
    branches?: any[];
}

export function BranchesTableWidget({ branches: initialBranches }: BranchesTableWidgetProps) {
    const { selectBranch, clearBranchSelection, user } = useUser();
    const { availableBranches } = useUserBranches();
    const [searchTerm, setSearchTerm] = useState('');
    const pageSize = 10;

    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: pageSize,
    });

    const [sorting, setSorting] = useState<SortingState>([
        { id: 'progress', desc: true },
    ]);

    const { data: branchSummaries = [], isLoading: loading } = useQuery({
        queryKey: ['branch-summaries-lite', availableBranches],
        queryFn: async () => {
            const data = await cyclicInventoryService.getBranchesSummaryLite();
            return data.filter(branch => {
                if (!availableBranches || availableBranches.length === 0) return true;
                const normalizedBranch = normalizeString(branch.branchName);
                return availableBranches.some(ab => normalizeString(ab) === normalizedBranch);
            });
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    });

    const filteredData = useMemo(() => {
        if (!searchTerm) return branchSummaries;
        return branchSummaries.filter(
            (branch) => branch.branchName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [branchSummaries, searchTerm]);

    const table = useReactTable({
        columns,
        data: filteredData,
        enableSortingRemoval: false,
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

    const handleRowClick = (branchName: string) => {
        if (user?.branchName === branchName) {
            clearBranchSelection?.();
        } else if (selectBranch) {
            selectBranch(branchName);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const exportToExcel = () => {
        const exportData = filteredData.map(branch => ({
            'Sucursal': branch.branchName,
            'Fecha Inicio': branch.deploymentDate,
            'Días (Pte / Asig)': `${branch.remainingDays} / ${branch.assignedDays}`,
            'Progreso %': branch.progress,
            'Diferencia Neta (Unidades)': branch.differenceUnits,
            'Valor de Ajustes': branch.adjustmentsValue,
            'Estado': branch.status,
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Monitor de Sucursales');
        XLSX.writeFile(wb, `monitor_sucursales_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Generate page range options for the Select
    const pageRangeOptions = useMemo(() => {
        return Array.from({ length: table.getPageCount() }, (_, i) => {
            const start = i * pageSize + 1;
            const end = Math.min((i + 1) * pageSize, table.getRowCount());
            return { label: `${start}-${end}`, value: String(i + 1) };
        });
    }, [table.getPageCount(), table.getRowCount()]);

    return (
        <Frame className="w-full flex-1">
            {/* Header section with Title and Controls */}
            <FrameHeader className="gap-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
                    <div className="flex flex-col gap-0.5">
                        <FrameTitle className="text-2xl flex items-center gap-2">
                            <TrendingUp className="size-6 text-primary" />
                            Monitor de Sucursales
                        </FrameTitle>
                        <FrameDescription>
                            Estado en tiempo real de inventarios cíclicos.
                        </FrameDescription>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar sucursal..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-9 bg-background/40 border-border/30 rounded-xl"
                            />
                        </div>
                        <Button onClick={exportToExcel} variant="outline" size="sm" className="h-9 gap-2 shadow-xs ring-offset-background">
                            <Download className="size-4 opacity-50" aria-hidden="true" />
                            <span className="hidden sm:inline">Exportar</span>
                        </Button>
                    </div>
                </div>
            </FrameHeader>

            {/* Unified Table - Browser-native Perfect Alignment */}
            <div className="w-full flex-1 px-0 pb-1">
                <FramePanel className="p-0 overflow-hidden border-border/10 bg-background/30 backdrop-blur-xs flex flex-col h-full">
                    <Table className="table-fixed">
                        <TableHeader className="bg-transparent">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow className="hover:bg-transparent border-none" key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        const columnSize = header.column.getSize();
                                        return (
                                            <TableHead
                                                key={header.id}
                                                style={columnSize ? { width: `${columnSize}px` } : undefined}
                                                className="h-11 border-none bg-transparent"
                                            >
                                                {header.isPlaceholder ? null : header.column.getCanSort() ? (
                                                    <div
                                                        className="flex h-full cursor-pointer select-none items-center justify-between gap-2"
                                                        onClick={header.column.getToggleSortingHandler()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                header.column.getToggleSortingHandler()?.(e);
                                                            }
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                    >
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        {{
                                                            asc: <ChevronUp aria-hidden="true" className="size-4 shrink-0 opacity-80" />,
                                                            desc: <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-80" />,
                                                        }[header.column.getIsSorted() as string] ?? null}
                                                    </div>
                                                ) : (
                                                    flexRender(header.column.columnDef.header, header.getContext())
                                                )}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {columns.map((_, colIdx) => (
                                            <TableCell key={colIdx}>
                                                <div className="h-4 w-full max-w-[80px] rounded bg-muted animate-pulse" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-selected={row.getIsSelected() || undefined}
                                        onClick={() => handleRowClick(row.original.branchName)}
                                        className="cursor-pointer border-t border-border/15 transition-colors hover:bg-muted/30 first:border-t-0"
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
                                    <TableCell className="h-24 text-center" colSpan={columns.length}>
                                        {searchTerm ? `No se encontraron sucursales para "${searchTerm}"` : 'Sin resultados.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </FramePanel>
            </div>

            {/* Footer with Pagination */}
            <FrameFooter className="p-4 border-none mt-0">
                <div className="flex items-center justify-between w-full gap-2 px-1">
                    {/* Results range selector */}
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <p className="text-muted-foreground text-[13px]">Viendo</p>
                        <Select
                            value={String(pagination.pageIndex + 1)}
                            onValueChange={(value) => {
                                table.setPageIndex(Number(value) - 1);
                            }}
                        >
                            <SelectTrigger 
                                aria-label="Select result range"
                                className="w-fit"
                                size="sm"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="min-w-[5rem]">
                                {pageRangeOptions.map((option) => (
                                    <SelectItem 
                                        key={option.value} 
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-[13px]">
                            de{' '}
                            <strong className="font-semibold text-foreground">
                                {table.getRowCount()}
                            </strong>{' '}
                            resultados
                        </p>
                    </div>

                    {/* Pagination buttons */}
                    <Pagination className="justify-end w-auto mx-0">
                        <PaginationContent className="gap-2">
                            <PaginationItem>
                                <PaginationPrevious
                                    className="sm:*:[svg]:hidden"
                                    render={
                                        <Button
                                            disabled={!table.getCanPreviousPage()}
                                            onClick={() => table.previousPage()}
                                            size="sm"
                                            variant="outline"
                                            className="h-8 border-border/20 text-[13px] font-medium transition-all hover:bg-muted active:scale-95"
                                        >
                                            Anterior
                                        </Button>
                                    }
                                />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationNext
                                    className="sm:*:[svg]:hidden"
                                    render={
                                        <Button
                                            disabled={!table.getCanNextPage()}
                                            onClick={() => table.nextPage()}
                                            size="sm"
                                            variant="outline"
                                            className="h-8 border-border/20 text-[13px] font-medium transition-all hover:bg-muted active:scale-95"
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
        </Frame>
    );
}

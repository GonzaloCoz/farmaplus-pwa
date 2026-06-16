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
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/contexts/UserContext';
import { useUserBranches } from '@/hooks/useUserBranches';
import { useQuery } from '@tanstack/react-query';
import { ZONALES, getBranchesByZonales, type Zonal } from '@/config/zonales';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Combobox,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxPopup,
    ComboboxTrigger,
} from '@/components/ui/combobox';
import { Group, GroupSeparator, GroupText } from '@/components/ui/group';
import { 
    Search as SearchIcon, 
    Filter as FilterIcon, 
    X as XIcon, 
    ChevronDown as ChevronDownIcon,
    ChevronsUpDown as ChevronsUpDownIcon,
    Download as DownloadIcon,
    TrendingUp as TrendingUpIcon
} from 'lucide-react';

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
    positiveDiffUnits: number;
    negativeDiffUnits: number;
    adjustmentsValue: number;
    status: 'controlado' | 'por_controlar' | 'pendiente';
}

// Branch awards system - each branch can have multiple awards
interface BranchAward {
    emoji: string;
    tooltip: string;
}

const BRANCH_AWARDS: Record<string, BranchAward[]> = {
    "DEVOTO III": [
        { emoji: "🏆", tooltip: "Doble mérito: 1.º en finalizar y menor diferencia de stock. ¡Felicitaciones!" },
    ],
    "BOEDO": [
        { emoji: "🥈", tooltip: "2.º Puesto en finalización. ¡Gracias por su excelente compromiso y trabajo!" },
        { emoji: "🥉", tooltip: "3.º Puesto en menor diferencia de stock. ¡Gran precisión!" },
    ],
    "VILLA BALLESTER II": [
        { emoji: "🥉", tooltip: "3.º Puesto en finalización. ¡Gracias por su excelente compromiso y trabajo!" },
    ],
    "BELGRANO VIII": [
        { emoji: "🥈", tooltip: "2.º Puesto en menor diferencia de stock. ¡Gran precisión!" },
    ],
    "RECOLETA IV": [
        { emoji: "🏅", tooltip: "4.º Puesto en menor diferencia de stock. ¡Excelente control de inventario!" },
    ],
    "PALERMO III": [
        { emoji: "🏅", tooltip: "5.º Puesto en menor diferencia de stock. ¡Excelente control de inventario!" },
    ],
};

const getBranchAwards = (branchName: string): BranchAward[] => {
    const normalized = normalizeString(branchName || '');
    return BRANCH_AWARDS[normalized] || [];
};

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

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0]?.charAt(0).toUpperCase() ?? "";
    }
    const first = parts[0]?.charAt(0) ?? "";
    const last = parts[parts.length - 1]?.charAt(0) ?? "";
    return (first + last).toUpperCase();
}

function MemberAvatar({
    name,
    avatarUrl,
    className,
}: {
    name: string;
    avatarUrl?: string;
    className?: string;
}) {
    return (
        <Avatar className={cn("size-5", className)}>
            {avatarUrl ? <AvatarImage alt={name} src={avatarUrl} /> : null}
            <AvatarFallback className="text-[0.5rem] font-bold">
                {getInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

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
        cell: ({ row }) => {
            const branchName = row.getValue('branchName') as string;
            const awards = getBranchAwards(branchName);

            return (
                <div className="font-medium flex items-center gap-1">
                    <span>{branchName}</span>
                    {awards.map((award, idx) => (
                        <Tooltip key={idx}>
                            <TooltipTrigger render={
                                <span 
                                    className="text-base cursor-help select-none"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {award.emoji}
                                </span>
                            } />
                            <TooltipContent>
                                <p className="text-xs font-normal">
                                    {award.tooltip}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            );
        },
    },
    {
        accessorKey: 'deploymentDate',
        header: 'Fecha Inicio',
        size: 120,
        cell: ({ row }) => {
            const date = row.getValue('deploymentDate') as string;
            const shortDate = date && date.includes('/') ? date.split('/').slice(0, 2).join('/') : date;
            return (
                <div className="font-light text-muted-foreground tabular-nums whitespace-nowrap">
                    {shortDate}
                </div>
            );
        },
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
            <div className="text-muted-foreground/70 font-light tabular-nums">
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
            <div className="text-muted-foreground/80 font-light tabular-nums">
                {(row.getValue('inventoryUnits') as number).toLocaleString('es-AR')}
            </div>
        ),
    },
    {
        accessorKey: 'positiveDiffUnits',
        header: 'Sobrantes',
        size: 90,
        cell: ({ row }) => {
            const pos = Number(row.original.positiveDiffUnits || 0);
            if (pos === 0) return <span className="text-muted-foreground/40 font-light ml-4">–</span>;
            return (
                <Badge variant="outline" className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5 ml-1">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="tabular-nums">+{pos.toLocaleString('es-AR')}</span>
                </Badge>
            );
        },
    },
    {
        accessorKey: 'negativeDiffUnits',
        header: 'Faltantes',
        size: 90,
        cell: ({ row }) => {
            const neg = Number(row.original.negativeDiffUnits || 0);
            if (neg === 0) return <span className="text-muted-foreground/40 font-light ml-4">–</span>;
            return (
                <Badge variant="outline" className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5 ml-1">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-red-500" />
                    <span className="tabular-nums">{neg.toLocaleString('es-AR')}</span>
                </Badge>
            );
        },
    },
    {
        accessorKey: 'differenceUnits',
        header: 'Diferencia Neta',
        size: 110,
        cell: ({ row }) => {
            const diff = row.getValue('differenceUnits') as number;
            if (diff === 0) return <span className="text-muted-foreground/45 font-light ml-4">–</span>;
            return (
                <Badge variant="outline" className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5">
                    <span
                        aria-hidden="true"
                        className={cn("size-1.5 rounded-full", diff > 0 ? "bg-emerald-500" : "bg-red-500")}
                    />
                    <span className="tabular-nums">{diff > 0 ? '+' : ''}{diff.toLocaleString('es-AR')}</span>
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
        header: 'Estado',
        size: 110,
        cell: ({ row }) => {
            const status = row.getValue('status') as BranchSummary['status'];
            return (
                <Badge variant="outline" className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5 py-0">
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
    const [selectedZonales, setSelectedZonales] = useState<Zonal[]>([]);
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
        let data = branchSummaries;

        // Filter by Zonales
        if (selectedZonales.length > 0) {
            const allowedBranches = getBranchesByZonales(selectedZonales.map(z => z.id));
            const normalizedAllowed = allowedBranches.map(b => normalizeString(b));
            data = data.filter(branch => 
                normalizedAllowed.includes(normalizeString(branch.branchName))
            );
        }

        // Filter by search term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(
                (branch) => branch.branchName.toLowerCase().includes(searchLower)
            );
        }

        return data;
    }, [branchSummaries, searchTerm, selectedZonales]);

    const renderZonalesTrigger = () => {
        if (selectedZonales.length === 0) return "Todos";
        const firstMember = selectedZonales[0];
        const remainingCount = selectedZonales.length - 1;

        return (
            <div className="flex items-center gap-2">
                <MemberAvatar
                    avatarUrl={firstMember?.avatar}
                    name={firstMember?.label ?? ""}
                />
                <span className="truncate max-w-[100px]">{firstMember?.label}</span>
                {remainingCount > 0 && (
                    <Badge className="tabular-nums h-4 px-1 text-[10px]" variant="secondary">
                        +{remainingCount}
                    </Badge>
                )}
            </div>
        );
    };

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
                            <TrendingUpIcon className="size-6 text-primary" />
                            Monitor de Sucursales
                        </FrameTitle>
                        <FrameDescription>
                            Estado en tiempo real de inventarios cíclicos.
                        </FrameDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 min-w-[200px] md:w-48 lg:w-64">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar sucursal..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-9 bg-background/40 border-border/30 rounded-xl"
                            />
                        </div>

                        <Group className="items-center">
                            <GroupText
                                className={cn(
                                    buttonVariants({ size: "sm", variant: "outline" }),
                                    "pointer-events-none h-9 px-3 gap-2 border-border/40"
                                )}
                            >
                                <FilterIcon className="size-3.5 opacity-60" />
                                <span className="text-[13px] font-medium">Zonal</span>
                            </GroupText>
                            <GroupSeparator className="bg-border/40" />
                            <Combobox
                                autoHighlight
                                items={ZONALES}
                                multiple
                                onValueChange={(value) => {
                                    if (Array.isArray(value)) {
                                        setSelectedZonales(value);
                                    }
                                }}
                                value={selectedZonales}
                            >
                                <ComboboxTrigger
                                    render={
                                        <Button
                                            className={cn(
                                                "h-9 min-w-[100px] lg:min-w-[120px] transition-all border-border/40 shadow-none",
                                                selectedZonales.length === 0 ? "justify-between" : undefined
                                            )}
                                            size="sm"
                                            variant="outline"
                                        />
                                    }
                                >
                                    {renderZonalesTrigger()}
                                    {selectedZonales.length === 0 && (
                                        <ChevronsUpDownIcon className="size-3.5 opacity-50 ml-1" />
                                    )}
                                </ComboboxTrigger>
                                <ComboboxPopup aria-label="Select zonal" className="rounded-xl shadow-2xl border-border/40">
                                    <div className="border-b border-border/40 p-2">
                                        <ComboboxInput
                                            className="rounded-lg ps-9"
                                            placeholder="Buscar zonal..."
                                            showTrigger={false}
                                            startAddon={<SearchIcon className="size-4 opacity-50" />}
                                        />
                                    </div>
                                    <ComboboxEmpty>No se encontraron zonales.</ComboboxEmpty>
                                    <ComboboxList>
                                        {(option: Zonal) => (
                                            <ComboboxItem key={option.id} value={option}>
                                                <div className="flex items-center gap-2">
                                                    <MemberAvatar avatarUrl={option.avatar} name={option.label} />
                                                    <span>{option.label}</span>
                                                </div>
                                            </ComboboxItem>
                                        )}
                                    </ComboboxList>
                                </ComboboxPopup>
                            </Combobox>
                            <GroupSeparator className="bg-border/40" />
                            <Button
                                aria-label="Remove filter"
                                onClick={() => setSelectedZonales([])}
                                size="icon-sm"
                                variant="outline"
                                className="h-9 w-9 border-border/40 shadow-none"
                                disabled={selectedZonales.length === 0}
                            >
                                <XIcon className="size-3.5 opacity-50" />
                            </Button>
                        </Group>

                        <Button onClick={exportToExcel} variant="outline" size="sm" className="h-9 gap-2 shadow-sm border-border/40">
                            <DownloadIcon className="size-4 opacity-60" aria-hidden="true" />
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
                                                className="h-10 border-none bg-transparent text-muted-foreground font-medium text-[13px]"
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

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Frame, FrameHeader, FrameTitle, FrameDescription, FramePanel } from '@/components/ui/frame';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { cn, normalizeString } from '@/lib/utils';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/contexts/UserContext';
import { useUserBranches } from '@/hooks/useUserBranches';
import { useQuery } from '@tanstack/react-query';
import { SearchLg as SearchIcon, Download01 as DownloadIcon, TrendUp01 as TrendingUpIcon } from '@untitledui/icons';
import { Table as MotionTable, type TableColumn } from "@/components/motion/table";
import * as XLSX from 'xlsx';

interface BranchSummary {
    branchName: string;
    deploymentDate: string;
    assignedDays: number;
    remainingDays: number;
    cyclicRound: number;
    rounds?: Record<string, number>;
    monthlyGoal: number;
    elapsedDays: number;
    progress: number;
    inventoryUnits: number;
    differenceUnits: number;
    positiveDiffUnits: number;
    negativeDiffUnits: number;
    adjustmentsValue: number;
    absoluteDeviationValue: number;
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

// Status dot color mapping
const getStatusColor = (status: BranchSummary['status']) => {
    switch (status) {
        case 'controlado':
            return 'green';
        case 'por_controlar':
            return 'blue';
        case 'pendiente':
            return 'amber';
        default:
            return 'gray';
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

// Column definitions for beUI Motion Table
const columns: TableColumn<BranchSummary>[] = [
    {
        key: 'branchName',
        header: 'Sucursal',
        width: '180px',
        sortable: true,
        cell: (row) => {
            const branchName = row.branchName;
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
        key: 'deploymentDate',
        header: 'Fecha Inicio',
        width: '120px',
        sortable: true,
        cell: (row) => {
            const date = row.deploymentDate;
            const shortDate = date && date.includes('/') ? date.split('/').slice(0, 2).join('/') : date;
            return (
                <div className="font-light text-muted-foreground tabular-nums whitespace-nowrap">
                    {shortDate}
                </div>
            );
        },
    },
    {
        key: 'remainingDays',
        header: 'Días',
        width: '100px',
        sortable: true,
        cell: (row) => {
            const remaining = row.remainingDays;
            const assigned = row.assignedDays;
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
        key: 'cyclicRound',
        header: 'Vuelta',
        width: '100px',
        sortable: true,
        cell: (row) => {
            const specialRounds = Object.entries(row.rounds || {})
                .filter(([key, val]) => key !== 'GENERAL' && val !== row.cyclicRound);
            return (
                <div className="flex flex-col text-left py-0.5">
                    <span className="font-semibold text-foreground text-sm tabular-nums">
                        {row.cyclicRound}ª
                    </span>
                    {specialRounds.length > 0 && (
                        <span className="text-[10px] text-muted-foreground font-light leading-tight truncate max-w-[90px]">
                            {specialRounds.map(([key, val]) => `${key === 'MEDICAMENTOS' ? 'Med' : 'Perf'}: ${val}ª`).join(', ')}
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        key: 'progress',
        header: '% Avance',
        width: '90px',
        sortable: true,
        cell: (row) => {
            const progress = row.progress;
            return (
                <div className="font-medium tabular-nums">
                    {progress.toFixed(1)}%
                </div>
            );
        },
    },
    {
        key: 'inventoryUnits',
        header: 'Unidades',
        width: '90px',
        sortable: true,
        cell: (row) => (
            <div className="text-muted-foreground/80 font-light tabular-nums">
                {(row.inventoryUnits || 0).toLocaleString('es-AR')}
            </div>
        ),
    },
    {
        key: 'positiveDiffUnits',
        header: 'Sobrantes',
        width: '95px',
        sortable: true,
        cell: (row) => {
            const pos = Number(row.positiveDiffUnits || 0);
            if (pos === 0) return <span className="text-muted-foreground/40 font-light ml-4">–</span>;
            return (
                <Badge variant="dot" color="green" className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5 ml-1">
                    <span className="tabular-nums">+{pos.toLocaleString('es-AR')}</span>
                </Badge>
            );
        },
    },
    {
        key: 'negativeDiffUnits',
        header: 'Faltantes',
        width: '95px',
        sortable: true,
        cell: (row) => {
            const neg = Number(row.negativeDiffUnits || 0);
            if (neg === 0) return <span className="text-muted-foreground/40 font-light ml-4">–</span>;
            return (
                <Badge variant="dot" color="red" className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5 ml-1">
                    <span className="tabular-nums">{neg.toLocaleString('es-AR')}</span>
                </Badge>
            );
        },
    },
    {
        key: 'deviationUnits',
        header: 'Desvío en Unidades',
        width: '130px',
        sortable: true,
        sortValue: (row) => Number(row.positiveDiffUnits || 0) + Number(row.negativeDiffUnits || 0),
        cell: (row) => {
            const dev = Number(row.positiveDiffUnits || 0) + Number(row.negativeDiffUnits || 0);
            if (dev === 0) return <span className="text-muted-foreground/45 font-light ml-4">–</span>;
            return (
                <Badge variant="dot" color="amber" className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5">
                    <span className="tabular-nums">{dev.toLocaleString('es-AR')}</span>
                </Badge>
            );
        },
    },
    {
        key: 'differenceUnits',
        header: 'Diferencia Neta',
        width: '110px',
        sortable: true,
        cell: (row) => {
            const diff = row.differenceUnits || 0;
            if (diff === 0) return <span className="text-muted-foreground/45 font-light ml-4">–</span>;
            return (
                <Badge variant="dot" color={diff > 0 ? 'green' : 'red'} className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5">
                    <span className="tabular-nums">{diff > 0 ? '+' : ''}{diff.toLocaleString('es-AR')}</span>
                </Badge>
            );
        },
    },
    {
        key: 'adjustmentsValue',
        header: 'Ajustes',
        width: '140px',
        sortable: true,
        cell: (row) => {
            const value = row.adjustmentsValue || 0;
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
        key: 'absoluteDeviationValue',
        header: 'Desvío Absoluto',
        width: '145px',
        sortable: true,
        cell: (row) => {
            const value = row.absoluteDeviationValue || 0;
            return (
                <div className={cn(
                    "font-medium tabular-nums text-left",
                    value === 0 ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"
                )}>
                    ${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
            );
        },
    },
    {
        key: 'status',
        header: 'Estado',
        width: '110px',
        sortable: true,
        cell: (row) => {
            const status = row.status;
            return (
                <Badge variant="dot" color={getStatusColor(status) as any} className="font-normal bg-background/50 border-border/40 px-1.5 h-5 gap-1.5 py-0">
                    {getStatusLabel(status)}
                </Badge>
            );
        },
    },
];

interface BranchesTableWidgetProps {
    branches?: any[];
    cycleFilter?: 'current' | 'previous';
    onCycleFilterChange?: (filter: 'current' | 'previous') => void;
}

export function BranchesTableWidget({
    branches: initialBranches,
    cycleFilter: propCycleFilter,
    onCycleFilterChange
}: BranchesTableWidgetProps) {
    const { selectBranch, clearBranchSelection, user } = useUser();
    const { availableBranches } = useUserBranches();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZonal, setSelectedZonal] = useState<string>('all');

    const [timeframeFilter, setTimeframeFilter] = useState<'all' | 'yesterday' | 'day' | 'week' | 'month'>('all');
    const [localCycleFilter, setLocalCycleFilter] = useState<'current' | 'previous'>('current');

    const cycleFilter = propCycleFilter !== undefined ? propCycleFilter : localCycleFilter;
    const setCycleFilter = onCycleFilterChange !== undefined ? onCycleFilterChange : setLocalCycleFilter;

    const isSingleBranchView = user?.role === 'branch';

    const { data: branchSummaries = [], isLoading: loading } = useQuery({
        queryKey: ['branch-summaries-lite', availableBranches, timeframeFilter, cycleFilter],
        queryFn: async () => {
            const data = await cyclicInventoryService.getBranchesSummaryLite(
                cycleFilter === 'previous' ? 'all' : timeframeFilter,
                cycleFilter === 'previous'
            );
            return data.filter(branch => {
                if (!availableBranches || availableBranches.length === 0) return true;
                const normalizedBranch = normalizeString(branch.branchName);
                return availableBranches.some(ab => normalizeString(ab) === normalizedBranch);
            });
        },
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    });

    const { data: zonales = [] } = useQuery({
        queryKey: ['zonales'],
        queryFn: () => cyclicInventoryService.getZonales(),
        staleTime: 1000 * 60 * 10,
    });

    const filteredData = useMemo(() => {
        let data = branchSummaries;

        // If it's a single branch view, filter to show ONLY their own branch
        if (isSingleBranchView && user?.branchName) {
            const normalizedUserBranch = normalizeString(user.branchName);
            return data.filter(branch =>
                normalizeString(branch.branchName) === normalizedUserBranch
            );
        }

        // Filter by Zonal
        if (selectedZonal && selectedZonal !== 'all') {
            const zonal = zonales.find(z => z.id === selectedZonal);
            if (zonal) {
                const normalizedAllowed = zonal.branches.map(b => normalizeString(b));
                data = data.filter(branch =>
                    normalizedAllowed.includes(normalizeString(branch.branchName))
                );
            }
        }

        // Filter by search term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            data = data.filter(
                (branch) => branch.branchName.toLowerCase().includes(searchLower)
            );
        }

        return data;
    }, [branchSummaries, searchTerm, selectedZonal, zonales, user, isSingleBranchView]);

    const handleRowClick = (branchName: string) => {
        const canSwitch = user?.role === 'admin' || user?.role === 'mod';
        if (!canSwitch) return;
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
            'Unidades de Inventario': branch.inventoryUnits,
            'Sobrantes (Unidades)': branch.positiveDiffUnits,
            'Faltantes (Unidades)': branch.negativeDiffUnits,
            'Desvío en Unidades': Number(branch.positiveDiffUnits || 0) + Number(branch.negativeDiffUnits || 0),
            'Diferencia Neta (Unidades)': branch.differenceUnits,
            'Valor de Ajustes': branch.adjustmentsValue,
            'Desvío Absoluto': branch.absoluteDeviationValue,
            'Estado': branch.status,
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Monitor de Sucursales');
        XLSX.writeFile(wb, `monitor_sucursales_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <Frame className="w-full flex-1">
            {/* Header section with Title and Controls */}
            <FrameHeader className="gap-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
                    <div className="flex flex-col gap-0.5">
                        <FrameTitle className="text-2xl">
                            Monitor de Sucursales
                        </FrameTitle>
                        <FrameDescription>
                            Estado en tiempo real de inventarios cíclicos.
                        </FrameDescription>
                    </div>
                    {!isSingleBranchView && (
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

                            <Select value={selectedZonal} onValueChange={setSelectedZonal}>
                                <SelectTrigger placeholder="Zonal" className="h-9 w-[130px] bg-background/40 border-border/30 rounded-xl shadow-none" />
                                <SelectContent className="rounded-xl shadow-2xl border-border/40 min-w-[130px]">
                                    <SelectItem index={0} value="all">Todos</SelectItem>
                                    {zonales.map((zonal, idx) => (
                                        <SelectItem key={zonal.id} index={idx + 1} value={zonal.id}>
                                            {zonal.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={cycleFilter === 'previous' ? 'all' : timeframeFilter}
                                onValueChange={(val: any) => setTimeframeFilter(val)}
                                disabled={cycleFilter === 'previous'}
                            >
                                <SelectTrigger placeholder="Período" className="h-9 w-[130px] bg-background/40 border-border/30 rounded-xl shadow-none" />
                                <SelectContent className="rounded-xl shadow-2xl border-border/40 min-w-[130px]">
                                    <SelectItem index={0} value="all">Ciclo Completo</SelectItem>
                                    <SelectItem index={1} value="day">Hoy</SelectItem>
                                    <SelectItem index={2} value="yesterday">Ayer</SelectItem>
                                    <SelectItem index={3} value="week">Esta Semana</SelectItem>
                                    <SelectItem index={4} value="month">Este Mes</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={cycleFilter}
                                onValueChange={(val: any) => {
                                    setCycleFilter(val);
                                    if (val === 'previous') {
                                        setTimeframeFilter('all');
                                    }
                                }}
                            >
                                <SelectTrigger placeholder="Ciclo" className="h-9 w-[130px] bg-background/40 border-border/30 rounded-xl shadow-none" />
                                <SelectContent className="rounded-xl shadow-2xl border-border/40 min-w-[130px]">
                                    <SelectItem index={0} value="current">Ciclo Actual</SelectItem>
                                    <SelectItem index={1} value="previous">Ciclo Anterior</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button onClick={exportToExcel} variant="tertiary" size="sm" className="h-9 gap-2 bg-background/40 border-border/30 rounded-xl shadow-none">
                                <DownloadIcon className="size-4 opacity-60" aria-hidden="true" />
                                <span className="hidden sm:inline">Exportar</span>
                            </Button>
                        </div>
                    )}
                </div>
            </FrameHeader>

            {/* Unified Motion Table Panel */}
            <div className="w-full flex-1 px-0 pb-1">
                <FramePanel className={cn(
                    "p-0 overflow-hidden border-border/10 bg-background/30 backdrop-blur-xs flex flex-col",
                    isSingleBranchView ? "h-auto min-h-[100px]" : "h-[500px]"
                )}>
                    <MotionTable
                        data={filteredData}
                        columns={columns}
                        getRowId={(row) => row.branchName}
                        selectedRowIds={user?.branchName && user.branchName !== 'Casa Central' ? [user.branchName] : []}
                        height={isSingleBranchView ? 100 : 500}
                        loading={loading}
                        defaultSort={{ key: "progress", direction: "desc" }}
                        onRowClick={(user?.role === 'admin' || user?.role === 'mod') ? (row) => handleRowClick(row.branchName) : undefined}
                        className="border-none bg-transparent"
                        emptyState={
                            searchTerm
                                ? `No se encontraron sucursales para "${searchTerm}"`
                                : 'Sin resultados.'
                        }
                    />
                </FramePanel>
            </div>
        </Frame>
    );
}

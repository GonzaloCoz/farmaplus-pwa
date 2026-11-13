import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, type TableColumn } from '@/components/motion/table';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchLg as Search } from '@untitledui/icons';
import { X, ArrowUpRight, ChevronDown } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import Xls01Icon from '@hugeicons/core-free-icons/Xls01Icon';
import Layers01Icon from '@hugeicons/core-free-icons/Layers01Icon';
import ArrowUpRight03Icon from '@hugeicons/core-free-icons/ArrowUpRight03Icon';
import ArrowDownRight01Icon from '@hugeicons/core-free-icons/ArrowDownRight01Icon';
import ArrowUp02Icon from '@hugeicons/core-free-icons/ArrowUp02Icon';
import ArrowDown02Icon from '@hugeicons/core-free-icons/ArrowDown02Icon';
import PieChart09Icon from '@hugeicons/core-free-icons/PieChart09Icon';
import { cn, normalizeString } from '@/lib/utils';
import { OFFICIAL_71_BRANCHES } from '@/lib/branchNetworkMap';
import { cyclicInventoryService, type BranchCategoryStats } from '@/services/cyclicInventoryService';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DatePicker, type DateRange } from '@/components/ui/fluid-date-picker';
import { Gauge } from '@/components/charts/gauge';
import { useUser } from '@/contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { BranchCategoriesAccordion } from './BranchCategoriesAccordion';
import { ReportExporter } from '@/lib/reportExporter';
import { notify as toast } from '@/lib/notifications';

export interface DailyActivityPoint {
    date: string;
    shortDate: string;
    count: number;
    units: number;
}

export interface BranchMonitorRow {
    id: string;
    branchId?: number;
    branchCode?: string;
    branchName: string;
    deploymentDate?: string;
    days?: number;
    daysRemaining?: number;
    assignedDays?: number;
    round?: number;
    progress?: number;
    units?: number;
    surplus?: number;
    shortage?: number;
    unitDeviation?: number;
    netDiff?: number;
    adjustments?: number;
    absDeviation?: number;
    status?: 'active' | 'completed' | 'delayed' | 'pending';
    activity?: string;
    activityData?: DailyActivityPoint[];
    lastAdjustment?: {
        createdAt: string;
        laboratory?: string;
        units?: number;
    };
    categories?: Record<string, BranchCategoryStats>;
}

interface BranchAward {
    emoji: string;
    tooltip: string;
}

const BRANCH_AWARDS: Record<string, BranchAward[]> = {
    "devotoiii": [
        { emoji: "🏆", tooltip: "Doble mérito: 1.º en finalizar y menor diferencia de stock. ¡Felicitaciones!" },
    ],
    "boedo": [
        { emoji: "🥈", tooltip: "2.º Puesto en finalización. ¡Gracias por su excelente compromiso y trabajo!" },
        { emoji: "🥉", tooltip: "3.º Puesto en menor diferencia de stock. ¡Gran precisión!" },
    ],
    "villaballesterii": [
        { emoji: "🥉", tooltip: "3.º Puesto en finalización. ¡Gracias por su excelente compromiso y trabajo!" },
    ],
    "belgranoviii": [
        { emoji: "🥈", tooltip: "2.º Puesto en menor diferencia de stock. ¡Gran precisión!" },
    ],
    "recoletaiv": [
        { emoji: "🏅", tooltip: "4.º Puesto en menor diferencia de stock. ¡Excelente control de inventario!" },
    ],
    "palermoiii": [
        { emoji: "🏅", tooltip: "5.º Puesto en menor diferencia de stock. ¡Excelente control de inventario!" },
    ],
};

function getBranchAwards(branchName: string): BranchAward[] {
    const normalized = normalizeString(branchName || '');
    return BRANCH_AWARDS[normalized] || [];
}

// Sucursales excluidas del monitor (no son farmacias operativas)
const EXCLUDED_BRANCH_IDS = new Set([1, 34, 50, 51, 52]); // FP ADM, Loreal G.Pac, Isdin G.Pac, Loreal Alto Palermo, Isdin Palermo

function formatBranchName(raw: string): string {
    if (!raw) return '';
    const romanNumerals = new Set(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']);
    const acronyms = new Set(['FP', 'ADM']);
    
    // Quitar sufijo " - DANESA" antes de formatear
    let cleaned = raw.trim().replace(/\s*-\s*DANESA$/i, '');
    
    return cleaned
        .trim()
        .split(/\s+/)
        .map(word => {
            const clean = word.replace(/[().,]/g, '').toUpperCase();
            if (romanNumerals.has(clean)) return word.toUpperCase();
            if (acronyms.has(clean)) return word.toUpperCase();
            if (word.startsWith('(') && word.length > 1) {
                return '(' + word.charAt(1).toUpperCase() + word.slice(2).toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
}

function getStatusBadge(status?: BranchMonitorRow['status']) {
    if (!status) return null;
    switch (status) {
        case 'active':
            return { color: 'blue' as BadgeColor, label: 'En Proceso' };
        case 'completed':
            return { color: 'emerald' as BadgeColor, label: 'Finalizado' };
        case 'delayed':
            return { color: 'rose' as BadgeColor, label: 'Demorado' };
        case 'pending':
        default:
            return { color: 'amber' as BadgeColor, label: 'Pendiente' };
    }
}

function getFinancialBadgeStyle(val: number) {
    if (val === 0) {
        return {
            backgroundColor: "color-mix(in oklab, var(--foreground) 5%, transparent)",
            color: "var(--muted-foreground)",
            borderColor: "color-mix(in oklab, var(--foreground) 10%, transparent)",
        };
    }
    if (val > 0) {
        return {
            backgroundColor: "var(--financial-positive-bg)",
            color: "var(--financial-positive)",
            borderColor: "var(--financial-positive-border)",
        };
    }
    return {
        backgroundColor: "var(--financial-negative-bg)",
        color: "var(--financial-negative)",
        borderColor: "var(--financial-negative-border)",
    };
}

interface BranchMonitorWidgetProps {
    className?: string;
    assignedDays?: number;
    cycleStartDate?: string | null;
}

export function BranchMonitorWidget({
    className,
    assignedDays: fallbackAssignedDays = 0,
    cycleStartDate: fallbackStartDate = null
}: BranchMonitorWidgetProps) {
    const [searchValue, setSearchValue] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [selectedRound, setSelectedRound] = useState("all");
    const [selectedZonal, setSelectedZonal] = useState("all");
    const [stay, setStay] = useState<DateRange | undefined>(undefined);
    const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);

    const today = useMemo(() => new Date(), []);
    const defaultCalendarMonth = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d;
    }, []);

    const { dateFrom, dateTo } = useMemo(() => {
        if (!stay?.from) return { dateFrom: null, dateTo: null };
        const dFrom = new Date(stay.from);
        dFrom.setHours(0, 0, 0, 0);
        const dTo = stay.to ? new Date(stay.to) : new Date(stay.from);
        dTo.setHours(23, 59, 59, 999);
        return {
            dateFrom: dFrom.toISOString(),
            dateTo: dTo.toISOString(),
        };
    }, [stay]);

    const toggleRowExpand = (id: string) => {
        setExpandedRowIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // Consulta de zonales y sus sucursales asignadas
    const { data: zonales = [] } = useQuery({
        queryKey: ['zonales-list'],
        queryFn: () => cyclicInventoryService.getZonales(),
        staleTime: 1000 * 60 * 15,
    });

    const { user, selectBranch, clearBranchSelection } = useUser();
    const navigate = useNavigate();
    const isAdminOrMod = user?.role === 'admin' || user?.role === 'mod';

    // Consulta consolidada de todas las sucursales (1 sola petición a Supabase)
    const { data: monitorMap = new Map(), isLoading: isMonitorLoading } = useQuery({
        queryKey: ['all-branches-monitor-summary', selectedRound, dateFrom, dateTo],
        queryFn: async () => {
            const r = selectedRound === 'all' ? 2 : (Number(selectedRound) || 2);
            return await cyclicInventoryService.getBranchMonitorSummary(r, 12, dateFrom, dateTo);
        },
        staleTime: 1000 * 60 * 5,
    });

    // Lista de todas las sucursales con métricas consolidadas
    const rawBranches: BranchMonitorRow[] = useMemo(() => {
        return OFFICIAL_71_BRANCHES
            .filter(b => !EXCLUDED_BRANCH_IDS.has(b.branchId))
            .map(b => {
                const cleanName = b.name.replace(/\s*-\s*DANESA$/i, '');
                const normName = normalizeString(cleanName);
                const summary = monitorMap.get(normName);

                const assigned = summary?.assigned_days || fallbackAssignedDays || 150;
                const remaining = summary?.days_remaining !== undefined ? summary.days_remaining : assigned;
                const deploymentDate = summary?.deployment_date || (fallbackStartDate
                    ? fallbackStartDate.split('T')[0].split('-').reverse().slice(0, 2).join('/')
                    : '21/07');

                const isDateFiltered = Boolean(dateFrom && dateTo);
                const unitsCount = summary
                    ? (isDateFiltered
                        ? (summary.controlled_items !== undefined ? summary.controlled_items : 0)
                        : (summary.total_system_units > 0
                            ? summary.total_system_units
                            : (summary.controlled_items > 0 ? summary.controlled_items : summary.total_items)))
                    : undefined;

                return {
                    id: `branch-${b.branchId}`,
                    branchId: b.branchId,
                    branchCode: b.code,
                    branchName: formatBranchName(b.name),
                    deploymentDate,
                    days: assigned > 0 ? assigned : undefined,
                    daysRemaining: assigned > 0 ? remaining : undefined,
                    assignedDays: assigned > 0 ? assigned : undefined,
                    round: summary?.round || 2,
                    progress: summary?.progress,
                    units: unitsCount,
                    surplus: summary?.positive_units,
                    shortage: summary?.negative_units,
                    unitDeviation: summary?.total_deviation_units,
                    netDiff: summary?.net_units,
                    adjustments: summary?.adjustments_value,
                    absDeviation: summary?.balance_value,
                    status: summary?.status,
                    activityData: summary?.activity_data || [],
                    lastAdjustment: summary?.last_adjustment,
                    categories: summary?.categories,
                };
            });
    }, [monitorMap, fallbackAssignedDays, fallbackStartDate, dateFrom, dateTo]);

    // Filtrado por buscador y selectores, ordenado por % de avance descendente
    const filteredItems = useMemo(() => {
        return rawBranches
            .filter(item => {
                if (searchValue.trim()) {
                    const q = searchValue.trim().toLowerCase();
                    const nameMatch = item.branchName.toLowerCase().includes(q);
                    const codeMatch = item.branchCode?.toLowerCase().includes(q);
                    if (!nameMatch && !codeMatch) return false;
                }

                if (selectedStatus !== "all" && item.status !== selectedStatus) {
                    return false;
                }

                if (selectedRound !== "all" && String(item.round) !== selectedRound) {
                    return false;
                }

                if (selectedZonal !== "all") {
                    const currentZonal = zonales.find(z => z.id === selectedZonal || z.label === selectedZonal);
                    if (currentZonal) {
                        const normName = normalizeString(item.branchName);
                        const normClean = normalizeString(item.branchName.replace(/\s*-\s*DANESA$/i, ''));
                        const matches = currentZonal.branches.some(b => {
                            const nb = normalizeString(b);
                            return nb === normName || nb === normClean;
                        });
                        if (!matches) return false;
                    }
                }

                return true;
            })
            .sort((a, b) => {
                const pA = a.progress !== undefined ? a.progress : -1;
                const pB = b.progress !== undefined ? b.progress : -1;
                if (pB !== pA) return pB - pA;
                return a.branchName.localeCompare(b.branchName, 'es');
            });
    }, [rawBranches, searchValue, selectedStatus, selectedRound, selectedZonal, zonales]);

    const handleRowClick = (row: BranchMonitorRow) => {
        if (!isAdminOrMod) return;
        const currentNorm = user?.branchName ? normalizeString(user.branchName) : '';
        const targetNorm = normalizeString(row.branchName);
        if (currentNorm === targetNorm && user?.branchName !== 'Casa Central') {
            clearBranchSelection?.();
        } else if (selectBranch) {
            selectBranch(row.branchName);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleEnterCyclic = async (branchName: string) => {
        if (!isAdminOrMod) return;
        if (selectBranch) {
            await selectBranch(branchName);
        }
        navigate('/inventario-ciclico');
    };

    const handleExportExcel = () => {
        try {
            const count = filteredItems.length;
            if (count === 0) {
                toast.warning("Sin datos", "No hay sucursales para exportar con los filtros actuales.");
                return;
            }
            toast.info("Generando Excel", `Exportando avance de ${count} sucursales...`);
            ReportExporter.exportBranchMonitorToExcel(filteredItems);
            toast.success("Excel generado", "El archivo de avance de stock se descargó correctamente.");
        } catch (err) {
            console.error("Error al exportar monitor a Excel:", err);
            toast.error("Error al exportar", "No se pudo generar el archivo Excel.");
        }
    };

    const selectedRowIds = useMemo(() => {
        if (!isAdminOrMod || !user?.branchName || user.branchName === 'Casa Central') return [];
        const norm = normalizeString(user.branchName);
        const found = rawBranches.find(b => normalizeString(b.branchName) === norm);
        return found ? [found.id] : [];
    }, [isAdminOrMod, user?.branchName, rawBranches]);

    const columns = useMemo<TableColumn<BranchMonitorRow>[]>(
        () => [
            {
                key: "branchName",
                header: "Sucursal",
                sortable: true,
                width: "220px",
                cell: (row) => {
                    const awards = getBranchAwards(row.branchName);
                    const isSelected = isAdminOrMod && user?.branchName && normalizeString(user.branchName) === normalizeString(row.branchName);
                    return (
                        <div className="font-normal text-foreground text-sm tracking-normal flex items-center justify-between gap-1.5 select-text truncate w-full group/cell">
                            <div className="flex items-center gap-1.5 truncate">
                                <span className={cn("truncate", isSelected && "font-semibold text-primary")}>
                                    {row.branchName}
                                </span>
                                {awards.length > 0 && (
                                    <span className="inline-flex items-center gap-0.5 shrink-0 select-none">
                                        {awards.map((award, idx) => (
                                            <Tooltip
                                                key={idx}
                                                content={
                                                    <span className="text-xs font-normal">
                                                        {award.tooltip}
                                                    </span>
                                                }
                                            >
                                                <span className="text-base cursor-help select-none">
                                                    {award.emoji}
                                                </span>
                                            </Tooltip>
                                        ))}
                                    </span>
                                )}
                            </div>

                            {isAdminOrMod && (
                                <Tooltip
                                    content={
                                        <span className="text-xs">
                                            Entrar a Inventario Cíclico
                                        </span>
                                    }
                                >
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEnterCyclic(row.branchName);
                                        }}
                                        className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 transition-opacity p-1 rounded-md hover:bg-hover text-muted-foreground hover:text-foreground cursor-pointer shrink-0 ml-1"
                                        title={`Entrar al Inventario Cíclico de ${row.branchName}`}
                                        aria-label={`Entrar al Inventario Cíclico de ${row.branchName}`}
                                    >
                                        <ArrowUpRight className="size-3.5" />
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    );
                },
            },
            {
                key: "days",
                header: "Días",
                sortable: true,
                sortValue: (row) => (row.daysRemaining !== undefined ? row.daysRemaining : (row.days !== undefined ? row.days : -1)),
                width: "105px",
                align: "left",
                cell: (row) => {
                    if (row.daysRemaining !== undefined && row.assignedDays !== undefined) {
                        return (
                            <div className="flex items-center justify-start gap-1 font-sans text-sm tabular-nums">
                                <span className="font-normal text-foreground">{row.daysRemaining}</span>
                                <span className="text-muted-foreground/40 font-normal select-none">/</span>
                                <span className="font-normal text-muted-foreground">{row.assignedDays}</span>
                            </div>
                        );
                    }
                    if (row.days !== undefined) {
                        return (
                            <span className="font-normal text-muted-foreground text-sm tabular-nums">
                                {row.days} d
                            </span>
                        );
                    }
                    return (
                        <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>
                    );
                },
            },

            {
                key: "progress",
                header: "% Avance",
                sortable: true,
                sortValue: (row) => (row.progress !== undefined ? row.progress : -1),
                width: "155px",
                align: "left",
                cell: (row) => {
                    if (row.progress === undefined) {
                        return <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>;
                    }
                    const val = Math.min(100, Math.max(0, row.progress));
                    const isRowExpanded = expandedRowIds.includes(row.id);
                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(row.id);
                            }}
                            title="Clic para ver desglose por rubro (Medicamentos, Perfumería, Accesorios, Varios)"
                            className={cn(
                                "flex items-center gap-1.5 group/prog cursor-pointer py-1 px-1.5 -ml-1.5 rounded-lg transition-colors border border-transparent select-none",
                                isRowExpanded
                                    ? "bg-primary/10 border-primary/25"
                                    : "hover:bg-hover hover:border-border/40"
                            )}
                        >
                            <Gauge
                                orientation="linear"
                                value={val}
                                totalNotches={16}
                                spacing={20}
                                notchCornerRadius={2}
                                notchLengthPercent={90}
                                inactiveFill="currentColor"
                                inactiveFillOpacity={0.12}
                                activeGradient={["#ef4444", "#22c55e"]}
                                useGradient
                                width={72}
                                linearHeight={14}
                            />
                            <span className="font-normal text-foreground text-sm tabular-nums min-w-[40px] text-right">
                                {row.progress.toFixed(1)}%
                            </span>
                            <ChevronDown className={cn(
                                "size-3 text-muted-foreground/60 transition-transform duration-200 group-hover/prog:text-foreground shrink-0",
                                isRowExpanded && "rotate-180 text-primary"
                            )} />
                        </button>
                    );
                },
            },
            {
                key: "activity",
                header: "Actividad",
                sortable: false,
                width: "125px",
                align: "left",
                cell: (row) => {
                    const data = row.activityData;
                    const lastAdj = row.lastAdjustment;

                    let dateStr = '';
                    let timeStr = '';
                    if (lastAdj?.createdAt) {
                        const d = new Date(lastAdj.createdAt);
                        if (!isNaN(d.getTime())) {
                            dateStr = d.toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            });
                            timeStr = d.toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            }) + ' hs';
                        }
                    }

                    const tooltipContent = (
                        <div className="flex flex-col gap-1 py-0.5">
                            <span className="font-semibold text-background">Último ajuste</span>
                            {dateStr ? (
                                <>
                                    <span className="text-xs tabular-nums text-background/80">
                                        {dateStr} a las {timeStr}
                                    </span>
                                    {lastAdj?.laboratory && (
                                        <span className="text-[11px] truncate max-w-[200px] text-background/70 font-normal">
                                            {lastAdj.laboratory} {lastAdj.units ? `(${lastAdj.units} u)` : ''}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs text-background/70 font-normal">
                                    Sin ajustes registrados
                                </span>
                            )}
                        </div>
                    );

                    if (!data || data.length === 0 || data.reduce((acc, d) => acc + d.count, 0) === 0) {
                        return (
                            <Tooltip content={tooltipContent}>
                                <button
                                    type="button"
                                    tabIndex={0}
                                    className="text-muted-foreground/40 text-sm font-normal tabular-nums cursor-default inline-block py-1 bg-transparent border-0 p-0 focus:outline-none"
                                >
                                    –
                                </button>
                            </Tooltip>
                        );
                    }

                    const maxUnits = Math.max(...data.map(d => d.units || d.count || 0), 1);

                    return (
                        <Tooltip content={tooltipContent}>
                            <button
                                type="button"
                                tabIndex={0}
                                className="flex items-end justify-start gap-[2.5px] h-[20px] px-1 select-none cursor-pointer py-0.5 bg-transparent border-0 p-0 focus:outline-none text-left"
                            >
                                {data.map((item, idx) => {
                                    const val = item.units || item.count || 0;
                                    const heightPercent = val > 0
                                        ? Math.max(22, Math.min(100, Math.round((val / maxUnits) * 100)))
                                        : 10;
                                    const isActive = val > 0;
                                    const isHigh = heightPercent >= 50;

                                    return (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "w-[4px] rounded-t-[1.5px] transition-colors duration-150 pointer-events-none",
                                                !isActive && "bg-muted-foreground/20 dark:bg-muted-foreground/15"
                                            )}
                                            style={{
                                                height: `${heightPercent}%`,
                                                backgroundColor: isActive ? 'var(--focus-ring, #10B981)' : undefined,
                                                opacity: isActive ? (isHigh ? 1 : 0.55) : undefined,
                                            }}
                                        />
                                    );
                                })}
                            </button>
                        </Tooltip>
                    );
                },
            },
            {
                key: "units",
                header: "Unidades",
                sortable: true,
                sortValue: (row) => row.units ?? -1,
                width: "120px",
                align: "left",
                cell: (row) => (
                    row.units !== undefined ? (
                        <div className="flex items-center gap-1.5 font-normal text-foreground text-sm tabular-nums">
                            <HugeiconsIcon icon={Layers01Icon} size={15} strokeWidth={1.8} className="text-muted-foreground/70 shrink-0" />
                            <span>{row.units.toLocaleString('es-AR')}</span>
                        </div>
                    ) : (
                        <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>
                    )
                ),
            },
            {
                key: "surplus",
                header: "Sobrantes",
                sortable: true,
                sortValue: (row) => row.surplus ?? -1,
                width: "120px",
                align: "left",
                cell: (row) => {
                    if (row.surplus === undefined) {
                        return <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>;
                    }
                    const val = row.surplus;
                    const hasValue = val > 0;
                    return (
                        <div className="flex items-center gap-1.5 font-normal text-foreground text-sm tabular-nums">
                            <HugeiconsIcon
                                icon={ArrowUp02Icon}
                                size={15}
                                strokeWidth={2}
                                className={cn(
                                    "shrink-0",
                                    hasValue ? "text-financial-positive" : "text-muted-foreground/40"
                                )}
                            />
                            <span>{val.toLocaleString('es-AR')}</span>
                        </div>
                    );
                },
            },
            {
                key: "shortage",
                header: "Faltantes",
                sortable: true,
                sortValue: (row) => (row.shortage !== undefined ? -Math.abs(row.shortage) : 0),
                width: "120px",
                align: "left",
                cell: (row) => {
                    if (row.shortage === undefined) {
                        return <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>;
                    }
                    const val = row.shortage;
                    const hasValue = val !== 0;
                    return (
                        <div className="flex items-center gap-1.5 font-normal text-foreground text-sm tabular-nums">
                            <HugeiconsIcon
                                icon={ArrowDown02Icon}
                                size={15}
                                strokeWidth={2}
                                className={cn(
                                    "shrink-0",
                                    hasValue ? "text-financial-negative" : "text-muted-foreground/40"
                                )}
                            />
                            <span>{Math.abs(val).toLocaleString('es-AR')}</span>
                        </div>
                    );
                },
            },
            {
                key: "netDiff",
                header: "Neto",
                sortable: true,
                sortValue: (row) => row.netDiff ?? 0,
                width: "110px",
                align: "left",
                cell: (row) => {
                    if (row.netDiff === undefined) {
                        return <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>;
                    }
                    const val = row.netDiff;
                    return (
                        <div className="flex items-center gap-1.5 font-normal text-foreground text-sm tabular-nums">
                            {val > 0 && (
                                <HugeiconsIcon
                                    icon={ArrowUpRight03Icon}
                                    size={15}
                                    strokeWidth={2}
                                    className="shrink-0 text-financial-positive"
                                />
                            )}
                            {val < 0 && (
                                <HugeiconsIcon
                                    icon={ArrowDownRight01Icon}
                                    size={15}
                                    strokeWidth={2}
                                    className="shrink-0 text-financial-negative"
                                />
                            )}
                            <span>{val > 0 ? `+${val.toLocaleString('es-AR')}` : (val < 0 ? `-${Math.abs(val).toLocaleString('es-AR')}` : '0')}</span>
                        </div>
                    );
                },
            },
            {
                key: "unitDeviation",
                header: "Desvío",
                sortable: true,
                sortValue: (row) => row.unitDeviation ?? -1,
                width: "110px",
                align: "left",
                cell: (row) => {
                    if (row.unitDeviation === undefined) {
                        return <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>;
                    }
                    const val = row.unitDeviation;
                    return (
                        <div className="flex items-center gap-1.5 font-normal text-foreground text-sm tabular-nums">
                            <HugeiconsIcon
                                icon={PieChart09Icon}
                                size={15}
                                strokeWidth={1.8}
                                className={cn("shrink-0", val > 0 ? "text-muted-foreground/80" : "text-muted-foreground/40")}
                            />
                            <span>{val.toLocaleString('es-AR')}</span>
                        </div>
                    );
                },
            },
            {
                key: "adjustments",
                header: "Ajustes",
                sortable: true,
                sortValue: (row) => row.adjustments ?? -1,
                width: "145px",
                align: "left",
                cell: (row) => (
                    row.adjustments !== undefined ? (
                        <span className="font-normal text-foreground text-sm tabular-nums">
                            ${row.adjustments.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    ) : (
                        <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>
                    )
                ),
            },
            {
                key: "absDeviation",
                header: "Balance $",
                sortable: true,
                sortValue: (row) => row.absDeviation ?? 0,
                width: "145px",
                align: "left",
                cell: (row) => (
                    row.absDeviation !== undefined ? (
                        <span className="font-normal text-foreground text-sm tabular-nums">
                            {row.absDeviation < 0 ? `-$` : `$`}{Math.abs(row.absDeviation).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    ) : (
                        <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>
                    )
                ),
            },
        ],
        [isAdminOrMod, user?.branchName]
    );

    return (
        <div className={cn("w-full flex-1 flex flex-col min-h-0 reveal-product-subtle", className)}>
            {/* Contenedor exterior estilo Fluid: 2px de padding, bordes redondeados y sombra sutil */}
            <div className="w-full flex-1 flex flex-col min-h-0 bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 shadow-xs">
                {/* Recuadro interior blanco/más claro que alberga la tabla */}
                <div className="w-full flex-1 flex flex-col min-h-0 bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-2 sm:p-3 shadow-xs overflow-hidden">
                    
                    {/* Barra de controles: Buscador + Selectores a la izquierda, y Acciones a la derecha */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-3 shrink-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <InputGroup className="w-[180px] h-8 rounded-lg border border-border bg-transparent hover:bg-hover transition-all duration-80 focus-within:ring-1 focus-within:ring-[color:var(--focus-ring,#6B97FF)] shadow-none shrink-0">
                                <InputGroupAddon className="pl-2.5 pr-1.5 text-muted-foreground">
                                    <Search className="size-3.5 shrink-0" />
                                </InputGroupAddon>
                                <InputGroupInput
                                    placeholder="Buscar sucursal…"
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

                            <div className="w-[185px]">
                                <Select value={selectedRound} onValueChange={setSelectedRound}>
                                    <SelectTrigger placeholder="Vuelta" className="w-full min-w-0 h-8 text-xs font-sans rounded-lg whitespace-nowrap" />
                                    <SelectContent className="max-h-[220px]">
                                        <SelectItem index={0} value="all" className="font-sans text-xs">Todas las vueltas</SelectItem>
                                        <SelectItem index={1} value="2" className="font-sans text-xs">Vuelta 2 (Activa)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-[185px]">
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger placeholder="Estado" className="w-full min-w-0 h-8 text-xs font-sans rounded-lg whitespace-nowrap" />
                                    <SelectContent className="max-h-[220px]">
                                        <SelectItem index={0} value="all" className="font-sans text-xs">Todos los estados</SelectItem>
                                        <SelectItem index={1} value="active" className="font-sans text-xs">En Progreso</SelectItem>
                                        <SelectItem index={2} value="completed" className="font-sans text-xs">Finalizado</SelectItem>
                                        <SelectItem index={3} value="delayed" className="font-sans text-xs">Demorado</SelectItem>
                                        <SelectItem index={4} value="pending" className="font-sans text-xs">Pendiente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-[190px]">
                                <Select value={selectedZonal} onValueChange={setSelectedZonal}>
                                    <SelectTrigger placeholder="Zonal" className="w-full min-w-0 h-8 text-xs font-sans rounded-lg whitespace-nowrap" />
                                    <SelectContent className="max-h-[220px]">
                                        <SelectItem index={0} value="all" className="font-sans text-xs">Todos los zonales</SelectItem>
                                        {zonales.map((z, idx) => (
                                            <SelectItem key={z.id} index={idx + 1} value={z.id} className="font-sans text-xs">
                                                {z.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Botón de acción del monitor */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <DatePicker
                                mode="range"
                                value={stay}
                                onValueChange={setStay}
                                placeholder="Desde → Hasta"
                                calendarProps={{
                                    disabled: { after: today },
                                    endMonth: today,
                                    defaultMonth: defaultCalendarMonth,
                                }}
                                size="compact"
                                className="h-8 text-xs font-sans rounded-lg"
                            />
                            <Tooltip content="Exportar Excel" side="top" sideOffset={6}>
                                <Button
                                    variant="tertiary"
                                    size="icon"
                                    type="button"
                                    onClick={handleExportExcel}
                                    aria-label="Exportar Excel"
                                    className="h-8 w-8 rounded-lg border border-border bg-transparent hover:bg-hover text-muted-foreground hover:text-foreground transition-all duration-80 cursor-pointer"
                                >
                                    <HugeiconsIcon icon={Xls01Icon} size={16} strokeWidth={1.8} />
                                </Button>
                            </Tooltip>
                        </div>
                    </div>

                    <div className="w-full flex flex-col min-h-[520px]">
                        <Table
                            data={filteredItems}
                            columns={columns}
                            getRowId={(row) => row.id}
                            selectedRowIds={selectedRowIds}
                            onRowClick={isAdminOrMod ? handleRowClick : undefined}
                            resizable
                            reorderable
                            defaultSort={{ key: "progress", direction: "desc" }}
                            height={520}
                            rowHeight={48}
                            dense={false}
                            overscan={15}
                            headerClassName="bg-white dark:bg-[#252525] dark:bg-surface-3 shadow-2xs"
                            renderExpandedRow={(row) => (
                                <BranchCategoriesAccordion
                                    branchName={row.branchName}
                                    categories={row.categories}
                                />
                            )}
                            expandedRowIds={expandedRowIds}
                            expandedRowHeight={170}
                            emptyState={
                                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs gap-1.5 min-h-[280px]">
                                    <span className="font-semibold text-foreground text-sm">
                                        No se encontraron sucursales
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        Probá ajustando la búsqueda o los filtros.
                                    </span>
                                </div>
                            }
                            className="rounded-xl border-none w-full bg-transparent"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

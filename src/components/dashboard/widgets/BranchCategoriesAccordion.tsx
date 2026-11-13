import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import CornerDownRightIcon from '@hugeicons/core-free-icons/CornerDownRightIcon';
import Layers01Icon from '@hugeicons/core-free-icons/Layers01Icon';
import ArrowUpRight03Icon from '@hugeicons/core-free-icons/ArrowUpRight03Icon';
import ArrowDownRight01Icon from '@hugeicons/core-free-icons/ArrowDownRight01Icon';
import ArrowUp02Icon from '@hugeicons/core-free-icons/ArrowUp02Icon';
import ArrowDown02Icon from '@hugeicons/core-free-icons/ArrowDown02Icon';
import PieChart09Icon from '@hugeicons/core-free-icons/PieChart09Icon';
import { Gauge } from '@/components/charts/gauge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BranchCategoryStats } from '@/services/cyclicInventoryService';

interface BranchCategoriesAccordionProps {
    branchName: string;
    categories?: Record<string, BranchCategoryStats>;
}

const CATEGORIES = [
    { key: 'MEDICAMENTOS', label: 'Medicamentos' },
    { key: 'PERFUMERIA', label: 'Perfumería' },
    { key: 'ACCESORIOS', label: 'Accesorios' },
    { key: 'VARIOS', label: 'Varios' },
];

function normalizeCat(s: string): string {
    return (s || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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

export function BranchCategoriesAccordion({
    branchName: _branchName,
    categories = {}
}: BranchCategoriesAccordionProps) {
    return (
        <div className="w-full bg-zinc-500/[0.04] dark:bg-white/[0.02] border-l-2 border-l-primary/60">
            <table
                className="w-full border-collapse"
                style={{ tableLayout: "fixed" }}
            >
                <colgroup>
                    <col style={{ width: "220px" }} />
                    <col style={{ width: "105px" }} />
                    <col style={{ width: "155px" }} />
                    <col style={{ width: "125px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "145px" }} />
                    <col style={{ width: "145px" }} />
                </colgroup>
                <tbody className="reveal-items">
                    {CATEGORIES.map((cat, idx) => {
                        const target = normalizeCat(cat.key);
                        const stats = Object.entries(categories).find(([k]) => normalizeCat(k) === target)?.[1] || {
                            category: cat.key,
                            totalLabs: 0,
                            controlledLabs: 0,
                            inProgressLabs: 0,
                            pendingLabs: 0,
                            progress: 0,
                            totalItems: 0,
                            controlledItems: 0,
                            positiveUnits: 0,
                            negativeUnits: 0,
                            netUnits: 0,
                            totalDeviationUnits: 0,
                            totalSystemUnits: 0,
                            adjustmentsValue: 0,
                            negativeValue: 0,
                            positiveValue: 0,
                            balanceValue: 0,
                        };

                        const units = stats.totalSystemUnits > 0
                            ? stats.totalSystemUnits
                            : (stats.controlledItems > 0 ? stats.controlledItems : stats.totalItems);

                        return (
                            <tr
                                key={cat.key}
                                className={cn(
                                    "h-[42px] transition-colors border-border/25",
                                    idx < CATEGORIES.length - 1 && "border-b",
                                    "hover:bg-zinc-500/8 dark:hover:bg-white/5"
                                )}
                            >
                                {/* 1. Rubro (en vez de Sucursal) */}
                                <td className="pl-5 pr-2.5 truncate" style={{ width: "220px" }}>
                                    <div className="flex items-center gap-2 font-normal text-sm tracking-normal truncate">
                                        <HugeiconsIcon
                                            icon={CornerDownRightIcon}
                                            size={14}
                                            strokeWidth={2}
                                            className="text-muted-foreground/60 shrink-0"
                                        />
                                        <span className="font-medium text-foreground/90 truncate">
                                            {cat.label}
                                        </span>
                                    </div>
                                </td>

                                {/* 2. Días / Laboratorios (controlados / total) */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "105px" }}>
                                    {stats.totalLabs > 0 ? (
                                        <div className="flex items-center justify-start gap-1 font-sans text-sm tabular-nums">
                                            <span className="font-normal text-foreground/90">{stats.controlledLabs}</span>
                                            <span className="text-muted-foreground/40 font-normal select-none">/</span>
                                            <span className="font-normal text-muted-foreground/75">{stats.totalLabs}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>
                                    )}
                                </td>

                                {/* 3. % Avance */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "155px" }}>
                                    <div className="flex items-center gap-1.5 py-1 px-1.5 -ml-1.5 select-none">
                                        <Gauge
                                            orientation="linear"
                                            value={Math.min(100, Math.max(0, stats.progress))}
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
                                        <span className="font-normal text-foreground/90 text-sm tabular-nums min-w-[40px] text-right">
                                            {stats.progress.toFixed(1)}%
                                        </span>
                                    </div>
                                </td>

                                {/* 4. Actividad */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "125px" }}>
                                    <span className="text-muted-foreground/35 text-sm font-normal tabular-nums pl-1">–</span>
                                </td>

                                {/* 5. Unidades */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "120px" }}>
                                    {units > 0 ? (
                                        <div className="flex items-center gap-1.5 font-normal text-foreground/90 text-sm tabular-nums">
                                            <HugeiconsIcon icon={Layers01Icon} size={15} strokeWidth={1.8} className="text-muted-foreground/70 shrink-0" />
                                            <span>{units.toLocaleString('es-AR')}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground/40 text-sm font-normal tabular-nums">–</span>
                                    )}
                                </td>

                                {/* 6. Sobrantes */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "120px" }}>
                                    <div className="flex items-center gap-1.5 font-normal text-foreground/90 text-sm tabular-nums">
                                        <HugeiconsIcon
                                            icon={ArrowUp02Icon}
                                            size={15}
                                            strokeWidth={2}
                                            className={cn("shrink-0", stats.positiveUnits > 0 ? "text-financial-positive" : "text-muted-foreground/40")}
                                        />
                                        <span>{stats.positiveUnits.toLocaleString('es-AR')}</span>
                                    </div>
                                </td>

                                {/* 7. Faltantes */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "120px" }}>
                                    <div className="flex items-center gap-1.5 font-normal text-foreground/90 text-sm tabular-nums">
                                        <HugeiconsIcon
                                            icon={ArrowDown02Icon}
                                            size={15}
                                            strokeWidth={2}
                                            className={cn("shrink-0", stats.negativeUnits !== 0 ? "text-financial-negative" : "text-muted-foreground/40")}
                                        />
                                        <span>{Math.abs(stats.negativeUnits).toLocaleString('es-AR')}</span>
                                    </div>
                                </td>

                                {/* 8. Neto */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "110px" }}>
                                    <div className="flex items-center gap-1.5 font-normal text-foreground/90 text-sm tabular-nums">
                                        {stats.netUnits > 0 && (
                                            <HugeiconsIcon
                                                icon={ArrowUpRight03Icon}
                                                size={15}
                                                strokeWidth={2}
                                                className="shrink-0 text-financial-positive"
                                            />
                                        )}
                                        {stats.netUnits < 0 && (
                                            <HugeiconsIcon
                                                icon={ArrowDownRight01Icon}
                                                size={15}
                                                strokeWidth={2}
                                                className="shrink-0 text-financial-negative"
                                            />
                                        )}
                                        <span>{stats.netUnits > 0 ? `+${stats.netUnits.toLocaleString('es-AR')}` : (stats.netUnits < 0 ? `-${Math.abs(stats.netUnits).toLocaleString('es-AR')}` : '0')}</span>
                                    </div>
                                </td>

                                {/* 9. Desvío */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "110px" }}>
                                    <div className="flex items-center gap-1.5 font-normal text-foreground/90 text-sm tabular-nums">
                                        <HugeiconsIcon
                                            icon={PieChart09Icon}
                                            size={15}
                                            strokeWidth={1.8}
                                            className={cn("shrink-0", stats.totalDeviationUnits > 0 ? "text-muted-foreground/80" : "text-muted-foreground/40")}
                                        />
                                        <span>{stats.totalDeviationUnits.toLocaleString('es-AR')}</span>
                                    </div>
                                </td>

                                {/* 10. Ajustes */}
                                <td className="pl-2.5 pr-2.5 truncate text-left" style={{ width: "145px" }}>
                                    <span className="font-normal text-foreground/90 text-sm tabular-nums">
                                        ${stats.adjustmentsValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </td>

                                {/* 11. Balance $ */}
                                <td className="pl-2.5 pr-6 truncate text-left" style={{ width: "145px" }}>
                                    <span className="font-normal text-foreground/90 text-sm tabular-nums">
                                        {stats.balanceValue < 0 ? `-$` : `$`}{Math.abs(stats.balanceValue).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

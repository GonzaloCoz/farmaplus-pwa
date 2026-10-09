import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PieChart } from '@/components/charts/pie-chart';
import { PieSlice } from '@/components/charts/pie-slice';
import { Legend, LegendItemComponent, LegendMarker, LegendLabel, LegendValue } from '@/components/charts/legend';
import { SankeyChart, SankeyLink, SankeyNode } from '@/components/charts/sankey';
import { BarChart } from '@/components/charts/bar-chart';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { Grid } from '@/components/charts/grid';
import { ReferenceArea } from '@/components/charts/reference-area';
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip';

// Paleta OKLCH calibrada para flujos y auditoría de inventario (tonos luminosos y vivos fieles al gráfico del diagrama)
const OKLCH_PALETTE = {
    primerConteo: "oklch(0.68 0.105 264)", // Índigo suave iluminado (origen principal)
    recontados: "oklch(0.73 0.145 282)",   // Lavanda / violeta vibrante (auditados)
    sinContar: "oklch(0.62 0.085 265)",    // Pizarra grafito luminoso / steel slate
    exactos: "oklch(0.76 0.135 162)",      // Menta / verde esmeralda brillante (éxito)
    ajustePos: "oklch(0.77 0.145 204)",    // Turquesa / cian eléctrico (sobrante)
    ajusteNeg: "oklch(0.72 0.135 25)",     // Coral / terracota encendido (faltante)
    pendientes: "oklch(0.60 0.065 255)",   // Azul pizarra sereno (pendiente)
    amber: "oklch(0.78 0.155 65)",         // Ámbar dorado luminoso
    pink: "oklch(0.70 0.185 345)",         // Rosa magenta vibrante
};

type SectorKey = "perfumeria" | "farmacia" | "mixto";

// 8 Sub-rubros por sector con % de exactitud / coincidencia física vs sistema
const SECTOR_SUBRUBROS: Record<SectorKey, { label: string; value: number; color: string }[]> = {
    perfumeria: [
        { label: "Capilares", value: 92, color: OKLCH_PALETTE.exactos },
        { label: "Cremas Belleza", value: 68, color: OKLCH_PALETTE.primerConteo },
        { label: "Dentales", value: 35, color: OKLCH_PALETTE.amber },
        { label: "Desodorantes", value: 82, color: OKLCH_PALETTE.recontados },
        { label: "Fragancias", value: 88, color: OKLCH_PALETTE.ajustePos },
        { label: "Make Up", value: 24, color: OKLCH_PALETTE.ajusteNeg },
        { label: "Higiene Pers.", value: 54, color: OKLCH_PALETTE.pink },
        { label: "Infantiles", value: 44, color: OKLCH_PALETTE.sinContar },
    ],
    farmacia: [
        { label: "Éticos", value: 94, color: OKLCH_PALETTE.exactos },
        { label: "Venta Libre", value: 78, color: OKLCH_PALETTE.primerConteo },
        { label: "Suplementos", value: 42, color: OKLCH_PALETTE.amber },
        { label: "Accesorios", value: 65, color: OKLCH_PALETTE.recontados },
        { label: "Nutrición", value: 86, color: OKLCH_PALETTE.ajustePos },
        { label: "Dermomed.", value: 31, color: OKLCH_PALETTE.ajusteNeg },
        { label: "Fraccionados", value: 52, color: OKLCH_PALETTE.pink },
        { label: "Equipos/Test", value: 70, color: OKLCH_PALETTE.sinContar },
    ],
    mixto: [
        { label: "Medicamentos", value: 91, color: OKLCH_PALETTE.exactos },
        { label: "Capilares", value: 84, color: OKLCH_PALETTE.primerConteo },
        { label: "Dentales", value: 38, color: OKLCH_PALETTE.amber },
        { label: "Cremas", value: 72, color: OKLCH_PALETTE.recontados },
        { label: "OTC Libre", value: 87, color: OKLCH_PALETTE.ajustePos },
        { label: "Make Up", value: 28, color: OKLCH_PALETTE.ajusteNeg },
        { label: "Higiene", value: 58, color: OKLCH_PALETTE.pink },
        { label: "Accesorios", value: 49, color: OKLCH_PALETTE.sinContar },
    ],
};

// Flujo del Inventario Nocturno en 2 columnas verticales con montos valorizados
const nocturnoData = {
    nodes: [
        // Columna 1 (Conteo Nocturno)
        { name: "1er Conteo", color: OKLCH_PALETTE.primerConteo },    // 0
        { name: "Recontados", color: OKLCH_PALETTE.recontados },      // 1
        { name: "Sin Contar", color: OKLCH_PALETTE.sinContar },        // 2
        
        // Columna 2 (Resolución Final)
        { name: "Exactos", color: OKLCH_PALETTE.exactos },            // 3
        { name: "Ajuste (+)", color: OKLCH_PALETTE.ajustePos },       // 4
        { name: "Ajuste (-)", color: OKLCH_PALETTE.ajusteNeg },       // 5
        { name: "Pendientes", color: OKLCH_PALETTE.pendientes },      // 6
    ],
    links: [
        // 1er Conteo -> Resolución (310 + 65 + 45 = 420)
        { source: 0, target: 3, value: 310, amount: 162300000, formattedAmount: "$162,3M" },
        { source: 0, target: 4, value: 65, amount: 14200000, formattedAmount: "$14,2M" },
        { source: 0, target: 5, value: 45, amount: 8900000, formattedAmount: "$8,9M" },
        
        // Recontados -> Resolución (35 + 35 + 30 = 100)
        { source: 1, target: 3, value: 35, amount: 34500000, formattedAmount: "$34,5M" },
        { source: 1, target: 4, value: 35, amount: 37400000, formattedAmount: "$37,4M" },
        { source: 1, target: 5, value: 30, amount: 26800000, formattedAmount: "$26,8M" },

        // Sin Contar -> Pendientes (90)
        { source: 2, target: 6, value: 90, amount: 45300000, formattedAmount: "$45,3M" },
    ],
};

// Datos reales de Auditoría Nocturna (Primer Conteo)
const AUDITORIA_DATA = {
    eans: {
        totales: 5052,
        sinDiferencia: 4298,
        conDiferencia: 754,
        pctPerfecto: 85.08,
    },
    unidades: {
        sobrante: 2242,
        faltante: 1110,
        diferenciaNeta: 1132,
        absoluto: 3352,
        sobranteFormatted: "+2.242",
        faltanteFormatted: "-1.110",
        netaFormatted: "+1.132",
        absolutoFormatted: "3.352",
    },
    monto: {
        sobrante: 32540302.93,
        faltante: 10125637.65,
        diferenciaNeta: 22414665.28,
        absoluto: 42665940.58,
        sobranteFormatted: "+$ 32,54M",
        faltanteFormatted: "-$ 10,13M",
        netaFormatted: "+$ 22,41M",
        absolutoFormatted: "$ 42,67M",
    },
};

const sankeyLegendItems = [
    { name: "1er Conteo", color: OKLCH_PALETTE.primerConteo, index: 0 },
    { name: "Recontados", color: OKLCH_PALETTE.recontados, index: 1 },
    { name: "Sin Contar", color: OKLCH_PALETTE.sinContar, index: 2 },
    { name: "Exactos", color: OKLCH_PALETTE.exactos, index: 3 },
    { name: "Ajuste (+)", color: OKLCH_PALETTE.ajustePos, index: 4 },
    { name: "Ajuste (-)", color: OKLCH_PALETTE.ajusteNeg, index: 5 },
    { name: "Pendientes", color: OKLCH_PALETTE.pendientes, index: 6 },
];

export function PreCountSummaryView() {
    const [selectedSector, setSelectedSector] = useState<SectorKey>("perfumeria");
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [hoveredSankeyNode, setHoveredSankeyNode] = useState<number | null>(null);
    const [auditMode, setAuditMode] = useState<"unidades" | "monto">("unidades");

    const currentPieData = SECTOR_SUBRUBROS[selectedSector];
    const legendItems = currentPieData.map((d) => ({
        label: d.label,
        value: d.value,
        color: d.color,
    }));

    return (
        <ScrollArea orientation="vertical" viewportClassName="scroll-fade pr-1 pb-6 [&>div]:!w-full" className="flex-1 min-h-0 w-full">
            <div className="flex flex-col gap-4 w-full pb-6">
                {/* Fila superior: 3 recuadros de auditoría ejecutiva */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    {/* Recuadro 1 (Izquierda - Inventario Perfecto & Cobertura de EANs) */}
                    <div className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md">
                        <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-4 sm:p-5 shadow-xs flex-1 min-h-[240px] flex flex-col justify-between gap-3">
                            {/* Cabecera */}
                            <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Inventario Perfecto
                                </span>
                                <span className="px-2 py-0.5 text-[11px] font-bold rounded-[6px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    85,08% EANs OK
                                </span>
                            </div>

                            {/* KPI Central y Gauge */}
                            <div className="flex items-center justify-between gap-3 flex-1 min-h-0">
                                <div className="flex flex-col justify-center flex-1 min-w-0">
                                    <div className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-foreground leading-none">
                                        85,08%
                                    </div>
                                    <div className="text-xs font-medium text-muted-foreground mt-1.5 leading-snug">
                                        <span className="font-bold text-foreground">4.298</span> de {AUDITORIA_DATA.eans.totales.toLocaleString()} EANs sin desvío
                                    </div>

                                    <div className="mt-3.5 flex flex-col gap-2">
                                        <div className="flex items-center justify-between text-[11px] sm:text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: OKLCH_PALETTE.exactos }} />
                                                <span className="text-foreground/80 font-medium">Sin Diferencia (Exactos)</span>
                                            </div>
                                            <span className="font-bold text-foreground">4.298</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] sm:text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: OKLCH_PALETTE.ajusteNeg }} />
                                                <span className="text-foreground/80 font-medium">Con Desvío (Ajuste)</span>
                                            </div>
                                            <span className="font-bold text-foreground">754</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Medidor Donut / Gauge Semicircular */}
                                <div className="shrink-0 flex items-center justify-center">
                                    <svg viewBox="0 0 120 120" className="w-[105px] h-[105px]">
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="45"
                                            fill="none"
                                            stroke="currentColor"
                                            className="text-border/30"
                                            strokeWidth="11"
                                        />
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="45"
                                            fill="none"
                                            stroke={OKLCH_PALETTE.exactos}
                                            strokeWidth="11"
                                            strokeDasharray="240.6 283"
                                            strokeDashoffset="0"
                                            strokeLinecap="round"
                                            transform="rotate(-90 60 60)"
                                        />
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="45"
                                            fill="none"
                                            stroke={OKLCH_PALETTE.ajusteNeg}
                                            strokeWidth="11"
                                            strokeDasharray="42.4 283"
                                            strokeDashoffset="-240.6"
                                            strokeLinecap="round"
                                            transform="rotate(-90 60 60)"
                                        />
                                        <text x="60" y="58" textAnchor="middle" className="text-[17px] font-black fill-foreground">
                                            85%
                                        </text>
                                        <text x="60" y="71" textAnchor="middle" className="text-[9px] font-bold fill-muted-foreground uppercase tracking-wider">
                                            Perfecto
                                        </text>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recuadro 2 (Medio - Gráfico Polar de Sub-rubros con selector de sector) */}
                    <div className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md">
                        <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-4 sm:p-5 shadow-xs flex-1 min-h-[240px] flex flex-col justify-between gap-3">
                            {/* Selector de Rubro en pills minimalistas */}
                            <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Sub-rubros (% Inv. Perfecto)
                                </span>
                                <div className="flex items-center bg-surface-2 dark:bg-surface-1/60 p-0.5 rounded-lg border border-border/40">
                                    {(["perfumeria", "farmacia", "mixto"] as SectorKey[]).map((sector) => (
                                        <button
                                            key={sector}
                                            type="button"
                                            onClick={() => {
                                                setSelectedSector(sector);
                                                setHoveredIndex(null);
                                            }}
                                            className={`px-2 py-0.5 text-[11px] font-medium rounded-[6px] transition-all duration-150 capitalize cursor-pointer ${
                                                selectedSector === sector
                                                    ? "bg-white dark:bg-surface-3 text-foreground shadow-xs"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {sector === "perfumeria" ? "Perfumería" : sector === "farmacia" ? "Farmacia" : "Mixto"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Contenedor: Leyenda a la izquierda y Gráfico a la derecha */}
                            <div className="flex items-center justify-between gap-3 flex-1 min-h-0">
                                <Legend
                                    hoveredIndex={hoveredIndex}
                                    items={legendItems}
                                    onHoverChange={setHoveredIndex}
                                    className="flex flex-col gap-y-0.5 flex-1 min-w-0"
                                >
                                    <LegendItemComponent className="py-0.5 px-1 hover:bg-muted/40 rounded transition-colors justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <LegendMarker className="h-2 w-2 shrink-0" />
                                            <LegendLabel className="text-xs truncate" />
                                        </div>
                                        <LegendValue suffix="%" className="text-[11px] font-semibold text-muted-foreground ml-auto pl-2" />
                                    </LegendItemComponent>
                                </Legend>

                                <div className="flex items-center justify-center shrink-0">
                                    <PieChart
                                        data={currentPieData}
                                        hoveredIndex={hoveredIndex}
                                        onHoverChange={setHoveredIndex}
                                        size={170}
                                        innerRadius={15}
                                        cornerRadius={7}
                                        padAngle={0.04}
                                        startAngle={-Math.PI / 2}
                                        endAngle={(3 * Math.PI) / 2}
                                        equalAngle={true}
                                        variant="rose"
                                        showTrack={true}
                                        maxValue={100}
                                    >
                                        {currentPieData.map((_, i) => (
                                            <PieSlice index={i} key={`${selectedSector}-${i}`} />
                                        ))}
                                    </PieChart>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recuadro 3 (Derecha - Desvío Físico & Monetario: Sobrantes, Faltantes, Absoluto, Neto) */}
                    <div className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md">
                        <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-4 sm:p-5 shadow-xs flex-1 min-h-[240px] flex flex-col justify-between gap-3 overflow-hidden">
                            {/* Cabecera con selector interactivo Unidades vs Monto $$ */}
                            <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-2">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Desvío Físico & Monetario
                                </span>
                                <div className="flex items-center bg-surface-2 dark:bg-surface-1/60 p-0.5 rounded-lg border border-border/40">
                                    <button
                                        type="button"
                                        onClick={() => setAuditMode("unidades")}
                                        className={`px-2 py-0.5 text-[11px] font-medium rounded-[6px] transition-all duration-150 cursor-pointer ${
                                            auditMode === "unidades"
                                                ? "bg-white dark:bg-surface-3 text-foreground shadow-xs font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Unidades
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAuditMode("monto")}
                                        className={`px-2 py-0.5 text-[11px] font-medium rounded-[6px] transition-all duration-150 cursor-pointer ${
                                            auditMode === "monto"
                                                ? "bg-white dark:bg-surface-3 text-foreground shadow-xs font-semibold"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        Monto $$
                                    </button>
                                </div>
                            </div>

                            {/* Contenido: Absoluto/Neto a la izquierda y 2 Barras de 52px a la derecha */}
                            <div className="flex items-center justify-between gap-3 flex-1 min-h-0">
                                {/* Columna Izquierda: Absoluto y Neto */}
                                <div className="flex flex-col justify-between h-full py-0.5 flex-1 min-w-0">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Diferencia Absoluta
                                        </div>
                                        <div className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground leading-tight">
                                            {auditMode === "unidades" ? "3.352 u." : "$ 42,67M"}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            Volumen total de desvío
                                        </div>
                                    </div>

                                    <div className="mt-2 pt-2 border-t border-border/30">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Diferencia Neta
                                        </div>
                                        <div className="text-xl sm:text-[22px] font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
                                            {auditMode === "unidades" ? "+1.132 u." : "+$ 22,41M"}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            Balance patrimonial final
                                        </div>
                                    </div>
                                </div>

                                {/* Columna Derecha: Gráfico de 2 Barras (52px de ancho sincronizado) */}
                                <div className="shrink-0 flex items-center justify-center">
                                    <svg viewBox="0 0 170 170" className="w-[170px] h-[170px] select-none">
                                        <defs>
                                            <clipPath id="audit-bar-sob">
                                                <rect x="22" y="24" width="52" height="116" rx="10" />
                                            </clipPath>
                                            <clipPath id="audit-bar-falt">
                                                {/* Proporción exacta: 1110 / 2242 = ~50% de 116 = 58px. y=82 a 140 */}
                                                <rect x="96" y="82" width="52" height="58" rx="10" />
                                            </clipPath>
                                        </defs>

                                        {/* Líneas guía horizontales */}
                                        <line x1="14" y1="24" x2="162" y2="24" stroke="currentColor" className="text-border/25" strokeWidth="1" />
                                        <line x1="14" y1="82" x2="162" y2="82" stroke="currentColor" className="text-border/25" strokeWidth="1" />
                                        <line x1="14" y1="140" x2="162" y2="140" stroke="currentColor" className="text-border/35" strokeWidth="1" />

                                        {/* Encabezados superiores */}
                                        <text x="48" y="14" textAnchor="middle" className="text-[11px] font-bold fill-muted-foreground">Sobrante</text>
                                        <text x="122" y="14" textAnchor="middle" className="text-[11px] font-bold fill-muted-foreground">Faltante</text>

                                        {/* BARRA SOBRANTE */}
                                        <g clipPath="url(#audit-bar-sob)">
                                            <rect x="22" y="24" width="52" height="116" fill={OKLCH_PALETTE.recontados} />
                                            <g transform="translate(24, 30)">
                                                <rect width="48" height="19" rx="5" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                                                <text x="24" y="13" textAnchor="middle" fill="#ffffff" fontWeight="800" fontSize="10">
                                                    {auditMode === "unidades" ? "+2.242" : "+$32,5M"}
                                                </text>
                                            </g>
                                        </g>

                                        {/* BARRA FALTANTE */}
                                        <g clipPath="url(#audit-bar-falt)">
                                            <rect x="96" y="82" width="52" height="58" fill={OKLCH_PALETTE.ajusteNeg} />
                                            <g transform="translate(98, 88)">
                                                <rect width="48" height="19" rx="5" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                                                <text x="24" y="13" textAnchor="middle" fill="#ffffff" fontWeight="800" fontSize="10">
                                                    {auditMode === "unidades" ? "-1.110" : "-$10,1M"}
                                                </text>
                                            </g>
                                        </g>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fila inferior: 2 recuadros */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    {/* Recuadro Inferior 1 (Izquierda - Vacío / En blanco) */}
                    <div className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md">
                        <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-5 sm:p-6 shadow-xs flex-1 min-h-[460px]" />
                    </div>

                    {/* Recuadro Inferior 2 (Derecha - Sankey Chart) */}
                    <div className="bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md">
                        <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-4 sm:p-6 shadow-xs flex-1 min-h-[460px] flex items-center justify-between gap-4 overflow-hidden">
                            {/* Leyenda vertical de estados (exactamente al estilo del gráfico original) */}
                            <div className="w-[30%] sm:w-[32%] shrink-0 flex flex-col justify-center pl-2 sm:pl-6 pr-2">
                                <div className="flex flex-col gap-3.5">
                                    {sankeyLegendItems.map((item, idx) => (
                                        <React.Fragment key={item.name}>
                                            {idx === 3 && <div className="h-px bg-border/40 my-1 w-36" />}
                                            <div
                                                onMouseEnter={() => setHoveredSankeyNode(item.index)}
                                                onMouseLeave={() => setHoveredSankeyNode(null)}
                                                className={`flex items-center gap-3 cursor-pointer transition-all duration-150 select-none ${
                                                    hoveredSankeyNode !== null && hoveredSankeyNode !== item.index
                                                        ? "opacity-35"
                                                        : "opacity-100"
                                                }`}
                                            >
                                                <span
                                                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs transition-transform duration-150"
                                                    style={{
                                                        backgroundColor: item.color,
                                                        transform: hoveredSankeyNode === item.index ? "scale(1.25)" : "scale(1)",
                                                    }}
                                                />
                                                <span className="text-sm sm:text-[15px] font-normal tracking-tight text-foreground/90 dark:text-zinc-200">
                                                    {item.name}
                                                </span>
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* Gráfico Sankey compactado a la derecha */}
                            <div className="flex-1 w-[70%] sm:w-[68%] h-full min-h-[400px] max-h-[430px] flex items-center justify-center">
                                <SankeyChart
                                    data={nocturnoData}
                                    margin={{ top: 12, right: 16, bottom: 12, left: 16 }}
                                    nodePadding={6}
                                    nodeWidth={52}
                                    justifyBounds={true}
                                    hoveredNodeIndex={hoveredSankeyNode}
                                    onNodeHoverChange={setHoveredSankeyNode}
                                >
                                    <SankeyLink strokeOpacity={0.88} />
                                    <SankeyNode lineCap={10} showBadge={true} showLabels={false} showValueLabels={false} />
                                </SankeyChart>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
}

export default PreCountSummaryView;

import { useRef, useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronUp, InfoCircle as Info, DotsHorizontal as MoreHorizontal, Download01 as DownloadSquare } from '@untitledui/icons';
import { WidgetSkeleton } from '../WidgetSkeleton';
import { cn, normalizeString } from '@/lib/utils';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { getLaboratoriesForBranch } from '@/services/preCountDB';
import { useUser } from '@/contexts/UserContext';
import { notify } from '@/lib/notifications';
import { hasPermission } from '@/config/permissions';
import { motion, AnimatePresence } from 'framer-motion';
import * as htmlToImage from 'html-to-image';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { BarChart } from '@/components/charts/bar-chart';
import { Grid } from '@/components/charts/grid';
import { Bar } from '@/components/charts/bar';
import { BarXAxis } from '@/components/charts/bar-x-axis';
import { ChartTooltip } from '@/components/charts/tooltip/chart-tooltip';
import { BarDepthBack, BarDepthFront, BarDepthProvider } from '@/components/charts/bar-depth';
import { useChart } from '@/components/charts/chart-context';

function HoverListener({ onChange }: { onChange: (index: number | null) => void }) {
    const { hoveredBarIndex } = useChart();
    useEffect(() => {
        onChange(hoveredBarIndex);
    }, [hoveredBarIndex, onChange]);
    return null;
}

interface CategoryData {
    name: string;
    totalItems: number;
    controlledItems: number;
    percentage: number;
    previousPercentage: number; // For the hatched/striped part
}

interface CategoryProgressWidgetProps {
    showPrevious?: boolean;
}

export function CategoryProgressWidget({ showPrevious = false }: CategoryProgressWidgetProps) {
    const { user } = useUser();
    const { inventories, config, assignedDays, cycleStartDate, isLoading: metricsLoading } = useDashboardMetrics();
    const canvaRef = useRef<HTMLDivElement>(null);
    const [closures, setClosures] = useState<Record<string, number>>({});
    const [closuresLoading, setClosuresLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const loading = metricsLoading || closuresLoading;

    // Load historical closures once per branch change
    useEffect(() => {
        const loadClosures = async () => {
            if (!user?.branchSheet) {
                setClosuresLoading(false);
                return;
            }
            const branchName = user.branchSheet.trim();
            try {
                setClosuresLoading(true);
                const closuresRaw = await cyclicInventoryService.getCycleClosures(branchName, 1);
                // Normalizar llaves de cierres para comparación sin acentos
                const normalizedClosures: Record<string, number> = {};
                Object.entries(closuresRaw).forEach(([k, v]) => {
                    const normalizedKey = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                    normalizedClosures[normalizedKey] = v;
                });
                setClosures(normalizedClosures);
            } catch (err) {
                console.error("Error loading closures:", err);
            } finally {
                setClosuresLoading(false);
            }
        };

        loadClosures();
    }, [user?.branchSheet]);

    // Process categories reactively
    const categories = useMemo(() => {
        if (!inventories || inventories.length === 0) return [];

        const cats: Record<string, { total: number, controlled: number }> = {
            'Medicamentos': { total: 0, controlled: 0 },
            'Perfumería': { total: 0, controlled: 0 },
            'Accesorios': { total: 0, controlled: 0 },
            'Varios': { total: 0, controlled: 0 }
        };

        // Aggregate Data
        inventories.forEach(inv => {
            const catNorm = (inv.category || 'VARIOS').toUpperCase();
            const activeRound = (config as any).rounds?.[catNorm] || (config as any).rounds?.GENERAL || 1;
            const targetRound = showPrevious ? Math.max(1, activeRound - 1) : activeRound;

            // Filtrar por la ronda objetivo de esta categoría
            if ((inv.round || 1) !== targetRound) return;

            let catKey = 'Varios';
            const labCat = catNorm.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 

            if (labCat === 'MEDICAMENTOS') catKey = 'Medicamentos';
            else if (labCat === 'PERFUMERIA') catKey = 'Perfumería';
            else if (labCat === 'ACCESORIOS') catKey = 'Accesorios';

            // Numerator: Count labs that are either finished (controlado) OR in progress (por_controlar)
            const isTouched = inv.status === 'controlado' || inv.status === 'por_controlar';

            cats[catKey].total += 1;
            if (isTouched) cats[catKey].controlled += 1;
        });

        // Map to final data structure
        return Object.entries(cats).map(([name, stats]) => {
            const percentage = stats.total > 0 ? Math.round((stats.controlled / stats.total) * 100) : 0;
            const lookupName = name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const prevPerc = closures[lookupName] || 0;
            return {
                name,
                totalItems: stats.total,
                controlledItems: stats.controlled,
                percentage,
                previousPercentage: Math.min(prevPerc, percentage) // Cannot be more than current
            };
        });
    }, [inventories, config, closures, showPrevious]);

    // Handle background auto-closures side-effect when categories change
    useEffect(() => {
        if (loading || !user?.branchSheet || categories.length === 0) return;

        const checkAndRunAutoClosures = async () => {
            const branchName = user.branchSheet.trim();
            // Calculate Days Elapsed
            let daysElapsed = 0;
            const startDate = (config as any)?.startDate;
            if (startDate) {
                const start = new Date(startDate);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - start.getTime());
                daysElapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            const checkAndRun = async (period: number, dayThreshold: number) => {
                if (daysElapsed >= dayThreshold) {
                    const existingClosure = await cyclicInventoryService.getCycleClosures(branchName, period);
                    const hasClosure = Object.keys(existingClosure).length > 0;

                    if (!hasClosure) {
                        console.log(`Auto-closing Period ${period} (Day ${dayThreshold} reached)`);
                        const dataToSave = categories.map(c => ({
                            name: c.name,
                            percentage: c.percentage
                        }));

                        await cyclicInventoryService.saveCycleClosure(branchName, period, dataToSave);
                        notify.success(`Cierre automático del Periodo ${period} completado.`);
                        // Refresh closures
                        const closuresRaw = await cyclicInventoryService.getCycleClosures(branchName, 1);
                        const normalizedClosures: Record<string, number> = {};
                        Object.entries(closuresRaw).forEach(([k, v]) => {
                            const normalizedKey = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                            normalizedClosures[normalizedKey] = v;
                        });
                        setClosures(normalizedClosures);
                    }
                }
            };

            try {
                await checkAndRun(1, 30);
                await checkAndRun(2, 60);
            } catch (err) {
                console.warn('[ProgressWidget] Background closure check failed', err);
            }
        };

        checkAndRunAutoClosures();
    }, [categories, loading, config, user?.branchSheet]);

    const activeStats = useMemo(() => {
        if (selectedCategory) {
            return categories.find(c => c.name === selectedCategory) || null;
        }
        // Global Stats
        const totalLabs = categories.reduce((acc, c) => acc + c.totalItems, 0);
        const controlledLabs = categories.reduce((acc, c) => acc + c.controlledItems, 0);
        const avgPercentage = totalLabs > 0 ? Math.round((controlledLabs / totalLabs) * 100) : 0;
        return {
            name: 'Avance Global',
            percentage: avgPercentage,
            totalItems: totalLabs,
            controlledItems: controlledLabs
        };
    }, [categories, selectedCategory]);

    const displayedStats = useMemo(() => {
        if (hoveredIndex !== null) {
            const hoveredCat = categories[hoveredIndex];
            if (hoveredCat) {
                return {
                    percentage: hoveredCat.percentage,
                    label: `Avance en ${hoveredCat.name}`
                };
            }
        }
        
        // Base state
        if (selectedCategory) {
            const cat = categories.find(c => c.name === selectedCategory);
            return {
                percentage: cat?.percentage ?? 0,
                label: `Avance en ${selectedCategory}`
            };
        }
        
        return {
            percentage: activeStats?.percentage ?? 0,
            label: 'Avance total acumulado'
        };
    }, [categories, selectedCategory, hoveredIndex, activeStats]);

    const exportToCanva = async () => {
        if (!canvaRef.current) return;
        
        try {
            // Apply correct theme context for the cloned SVG rendering
            const isDark = document.documentElement.classList.contains('dark');
            if (isDark) {
                canvaRef.current.classList.add('dark');
            } else {
                canvaRef.current.classList.remove('dark');
            }

            const dataUrl = await htmlToImage.toPng(canvaRef.current, {
                pixelRatio: 2, // High DPI quality
                skipFonts: true, // Prevents hanging on webfonts
                style: { opacity: '1', transform: 'scale(1)' }
            });
            const link = document.createElement('a');
            const dateStr = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
            link.download = `Inventario_${user?.branchName || 'Sucursal'}_${dateStr}.png`;
            link.href = dataUrl;
            link.click();
            notify.success('Exito', 'Imagen del reporte descargada exitosamente.');
        } catch (error) {
            console.error('Error exporting canva:', error);
            notify.error('Error', 'Hubo un error al generar la imagen.');
        }
    };

    if (loading) {
        return <WidgetSkeleton variant="progress" />;
    }

    return (
        <>
            <div className="h-full flex flex-col">
            <CardHeader className="pb-0 pt-4 px-5 flex flex-row items-center justify-between space-y-0 text-foreground">
                <CardTitle className="text-lg font-medium tracking-tight">
                    {selectedCategory ? `Rubro: ${selectedCategory}` : 'Progreso de Inventario'}
                </CardTitle>
                <div className="flex items-center gap-1">
                    <button
                        onClick={exportToCanva}
                        className={cn(
                            "p-2 rounded-xl transition-all duration-300",
                            "hover:bg-foreground/5 text-muted-foreground hover:text-foreground",
                            "active:scale-95"
                        )}
                        title="Descargar reporte a canva PNG"
                    >
                        <DownloadSquare size={20} className="hover:animate-pulse" />
                    </button>
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                        title="Ver Avance Global"
                    >
                        <ChevronUp className={cn("h-4 w-4 transition-transform", !selectedCategory && "rotate-180")} />
                    </button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 px-5 pt-2 pb-2 flex flex-col gap-3 min-h-0">
                {/* Metrics Header */}
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={displayedStats.percentage}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-6xl font-bold tracking-tighter"
                            >
                                {displayedStats.percentage}%
                            </motion.span>
                        </AnimatePresence>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                        {displayedStats.label}
                    </p>
                </div>

                {/* Bars Chart - Bklit BarChart */}
                <div className="flex-1 min-h-0 light">
                    <BarDepthProvider
                        segmentsAccessor={(d) => [
                            { value: d["controlled"] as number, color: "var(--chart-1)" },
                            { value: d["pending"] as number, color: "var(--chart-3)" },
                        ]}
                    >
                        <BarChart
                            margin={{ top: 24, right: 8, bottom: 40, left: 8 }}
                            data={categories.map((cat) => ({
                                name: cat.name,
                                controlled: cat.controlledItems,
                                pending: cat.totalItems - cat.controlledItems,
                            }))}
                            xDataKey="name"
                            aspectRatio="auto"
                            className="h-full w-full"
                            stacked
                        >
                            <Grid horizontal />
                            <BarDepthBack dataKey="controlled" />
                            <Bar dataKey="controlled" fill="var(--chart-1)" perspective />
                            <Bar dataKey="pending" fill="var(--chart-3)" perspective />
                            <BarDepthFront dataKey="controlled" />
                            <BarXAxis />
                            <HoverListener onChange={setHoveredIndex} />
                            <ChartTooltip
                                showCrosshair={false}
                                showDots={false}
                                content={({ point }) => (
                                    <div className="light bg-white text-gray-900 rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-xs min-w-[150px]">
                                        <div className="font-semibold mb-1">{String(point.name)}</div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-gray-800 inline-block" />
                                                    <span className="text-gray-500">Hechos</span>
                                                </div>
                                                <span className="font-bold">{String(point.controlled)}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                                                    <span className="text-gray-500">Pendientes</span>
                                                </div>
                                                <span className="font-bold">{String(point.pending)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            />
                        </BarChart>
                    </BarDepthProvider>
                </div>
            </CardContent>

        </div>

        {/* Off-screen Canva Template */}
        <div ref={canvaRef} className="fixed top-0 left-0 w-[800px] pointer-events-none" style={{ zIndex: -9999, opacity: 0 }}>
            <div className="w-full h-full p-8 rounded-lg flex flex-col gap-6 bg-[#f8f9fb] dark:bg-[#161618] text-[#262626] dark:text-[#f5f5f5]">
                {/* Header info */}
                <div className="flex justify-between items-center border-b pb-4 border-[#e5e5e5] dark:border-[#3f3f46]">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight uppercase text-[#737373] dark:text-[#a1a1aa]">SUCURSAL {user?.branchName || ''}</h2>
                        <p className="text-lg text-[#737373] dark:text-[#a1a1aa]">Reporte de Avance - Inventario Cíclico</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex flex-col items-end">
                            <span className="font-medium uppercase tracking-wider text-xs text-[#737373] dark:text-[#a1a1aa]">Fecha Inicio</span>
                            <span className="font-semibold text-lg">{cycleStartDate ? new Date(cycleStartDate).toLocaleDateString('es-AR', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '-'}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="font-medium uppercase tracking-wider text-xs text-[#737373] dark:text-[#a1a1aa]">Días Asignados</span>
                            <span className="font-semibold text-lg">{assignedDays ? `${assignedDays}` : '-'}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="font-medium uppercase tracking-wider text-xs text-[#737373] dark:text-[#a1a1aa]">Vuelta</span>
                            <span className="font-semibold text-lg">1ª</span>
                        </div>
                    </div>
                </div>

                {/* Categories Table */}
                <div className="grid grid-cols-5 rounded-xl font-medium text-center divide-x mt-4 shadow-sm bg-[#ffffff] dark:bg-[#27272a] border border-[#e5e5e5] dark:border-[#3f3f46] divide-[#e5e5e5] dark:divide-[#3f3f46]">
                    {['Medicamentos', 'Perfumería', 'Accesorios', 'Varios'].map((catName) => {
                        const catData = categories.find(c => c.name === catName);
                        const pct = catData ? (catData.percentage || 0) : 0;
                        return (
                            <div key={catName} className="flex flex-col">
                                <div className="p-4 text-sm uppercase tracking-wider border-b border-[#e5e5e5] dark:border-[#3f3f46] text-[#737373] dark:text-[#a1a1aa] font-bold">{catName}</div>
                                <div className="p-8 text-4xl font-bold">{pct}%</div>
                            </div>
                        );
                    })}
                    <div className="flex flex-col rounded-r-xl">
                        <div className="p-4 text-sm uppercase tracking-wider font-bold border-b border-[#e5e5e5] dark:border-[#3f3f46] text-[#737373] dark:text-[#a1a1aa]">Avance</div>
                        <div className="p-8 text-4xl font-black text-[#3b82f6] dark:text-[#60a5fa]">{activeStats?.name === 'Avance Global' ? (activeStats.percentage || 0) : 0}%</div>
                    </div>
                </div>
            </div>
        </div>
        {/* End Canva Template */}
        </>
    );
} 


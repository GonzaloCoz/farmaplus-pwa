import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronUp, Info, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { getLaboratoriesForBranch } from '@/services/preCountDB';
import { useUser } from '@/contexts/UserContext';
import { notify } from '@/lib/notifications';
import { hasPermission } from '@/config/permissions';
import { motion, AnimatePresence } from 'framer-motion';

interface CategoryData {
    name: string;
    totalItems: number;
    controlledItems: number;
    percentage: number;
    previousPercentage: number; // For the hatched/striped part
}

export function CategoryProgressWidget() {
    const { user } = useUser();
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!user?.branchSheet) {
                setLoading(false);
                return;
            }

            try {
                // 1. Get Master List of Labs
                const allLabs = await getLaboratoriesForBranch(user.branchSheet);

                // 2. Get Current Statuses
                const inventories = await cyclicInventoryService.getAllCyclicInventories(user.branchSheet) || [];
                const labStatusMap = new Map(inventories.map(i => [i.labName, i.status]));

                // 3. Get Configuration & Historical Closures
                const config = await cyclicInventoryService.getBranchConfig(user.branchSheet);

                // Calculate Days Elapsed
                let daysElapsed = 0;
                if (config.startDate) {
                    const start = new Date(config.startDate);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - start.getTime());
                    daysElapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                // Check & Auto-Execute Closures (Every 30 days)
                // We check Period 1 (Day 30), Period 2 (Day 60), etc.
                const checkAndRunAutoClosure = async (period: number, dayThreshold: number, currentCats: Record<string, { total: number, controlled: number }>) => {
                    // Check if we passed the threshold
                    if (daysElapsed >= dayThreshold) {
                        // Check if closure already exists
                        const existingClosure = await cyclicInventoryService.getCycleClosures(user.branchSheet!, period);
                        const hasClosure = Object.keys(existingClosure).length > 0;

                        if (!hasClosure) {
                            console.log(`Auto-closing Period ${period} (Day ${dayThreshold} reached)`);
                            // Prepare Data
                            const dataToSave = Object.entries(currentCats).map(([name, stats]) => ({
                                name,
                                percentage: stats.total > 0 ? Math.round((stats.controlled / stats.total) * 100) : 0
                            }));

                            await cyclicInventoryService.saveCycleClosure(user.branchSheet!, period, dataToSave);
                            notify.success(`Cierre automático del Periodo ${period} completado.`);
                            return true; // We performed a save
                        }
                    }
                    return false;
                };

                // Initialize categories temp structure
                const cats: Record<string, { total: number, controlled: number }> = {
                    'Medicamentos': { total: 0, controlled: 0 },
                    'Perfumería': { total: 0, controlled: 0 },
                    'Accesorios': { total: 0, controlled: 0 },
                    'Varios': { total: 0, controlled: 0 }
                };

                // Aggregate Data
                allLabs.forEach(lab => {
                    let catKey = 'Varios';
                    const labCat = (lab.category || '').toUpperCase();

                    if (labCat === 'MEDICAMENTOS') catKey = 'Medicamentos';
                    else if (labCat === 'PERFUMERIA') catKey = 'Perfumería';
                    else if (labCat === 'ACCESORIOS') catKey = 'Accesorios';

                    const status = labStatusMap.get(lab.name);
                    const isControlled = status === 'controlado';

                    cats[catKey].total += 1;
                    if (isControlled) cats[catKey].controlled += 1;
                });

                // Execute Auto-Closures if needed
                // We check existing closures AGAIN after potentially saving to get the data for display
                await checkAndRunAutoClosure(1, 30, cats);
                await checkAndRunAutoClosure(2, 60, cats);

                // Reload closures for display (Period 1 is currently the base for the chart)
                const closures = await cyclicInventoryService.getCycleClosures(user.branchSheet || '', 1);

                // Map to final data structure
                const categoryData: CategoryData[] = Object.entries(cats).map(([name, stats]) => {
                    const percentage = stats.total > 0 ? Math.round((stats.controlled / stats.total) * 100) : 0;
                    const prevPerc = closures[name.toUpperCase()] || 0;
                    return {
                        name,
                        totalItems: stats.total,
                        controlledItems: stats.controlled,
                        percentage,
                        previousPercentage: Math.min(prevPerc, percentage) // Cannot be more than current
                    };
                });

                setCategories(categoryData);
            } catch (error) {
                console.error('Error loading category progress:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user]);

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

    if (loading) {
        return (
            <Card className="h-full border-none shadow-none flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-0 pt-4 px-5 flex flex-row items-center justify-between space-y-0 text-foreground">
                <CardTitle className="text-xl font-medium tracking-tight">
                    {selectedCategory ? `Rubro: ${selectedCategory}` : 'Progreso de Inventario'}
                </CardTitle>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                        title="Ver Avance Global"
                    >
                        <ChevronUp className={cn("h-4 w-4 transition-transform", !selectedCategory && "rotate-180")} />
                    </button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-5 pt-4 flex flex-col gap-6">
                {/* Metrics Header */}
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={activeStats?.percentage}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-6xl font-bold tracking-tighter"
                            >
                                {activeStats?.percentage}%
                            </motion.span>
                        </AnimatePresence>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                        {selectedCategory ? `Avance en ${selectedCategory}` : 'Avance total acumulado'}
                    </p>
                </div>

                {/* Bars Chart */}
                <div className="flex-1 flex flex-col justify-end">
                    <div className="flex items-end justify-between gap-3 h-48 mb-2 px-1">
                        {categories.map((cat) => {
                            const isSelected = selectedCategory === cat.name;
                            const hasPrevious = cat.previousPercentage > 0;

                            // Calculate relative height based on total items (Volume)
                            const maxTotal = Math.max(...categories.map(c => c.totalItems));
                            // Ensure clickable and visible even if small (min 20%)
                            const relativeHeight = maxTotal > 0
                                ? Math.max(20, (cat.totalItems / maxTotal) * 100)
                                : 20;

                            return (
                                <div
                                    key={cat.name}
                                    className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end"
                                    onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                                >
                                    {/* Total Items Count Label (New) */}
                                    <span className={cn(
                                        "text-[10px] font-bold transition-colors mb-1",
                                        isSelected ? "text-primary" : "text-muted-foreground/70"
                                    )}>
                                        {cat.totalItems}
                                    </span>

                                    {/* Bar Container (Height = Volume relative to largest category) */}
                                    <motion.div
                                        className={cn(
                                            "w-full rounded-2xl overflow-hidden flex flex-col justify-end relative transition-all duration-300 bg-secondary dark:bg-muted/20",
                                            isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:bg-secondary/80 dark:hover:bg-muted/30"
                                        )}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${relativeHeight}%` }}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    >
                                        {/* Tooltip on Hover */}
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-lg pointer-events-none">
                                            {cat.percentage}% ({cat.controlledItems}/{cat.totalItems})
                                        </div>

                                        {/* Solid Part (Current Progress % of THIS bar's volume) */}
                                        <motion.div
                                            className={cn(
                                                "w-full absolute bottom-0 left-0 right-0 z-10 transition-colors duration-300",
                                                isSelected ? "bg-primary" : "bg-muted-foreground/40 group-hover:bg-muted-foreground/50"
                                            )}
                                            initial={{ height: 0 }}
                                            animate={{ height: `${cat.percentage}%` }}
                                            transition={{ duration: 0.5, delay: 0.1 }}
                                        />

                                        {/* Hatched/Patterned Part (Previous Closure) */}
                                        {hasPrevious && (
                                            <div
                                                className="absolute bottom-0 left-0 right-0 z-20 opacity-30 pointer-events-none"
                                                style={{
                                                    height: `${cat.previousPercentage}%`,
                                                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, currentColor 4px, currentColor 8px)`,
                                                    color: isSelected ? 'white' : 'inherit'
                                                }}
                                            />
                                        )}

                                        {/* Indicator Dot (At the top of the progress) */}
                                        {cat.percentage > 0 && (
                                            <motion.div
                                                className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full z-30 shadow-sm"
                                                style={{ bottom: `calc(${cat.percentage}% - 3px)` }}
                                            />
                                        )}
                                    </motion.div>

                                    <span className={cn(
                                        "text-[10px] font-bold uppercase tracking-wider transition-colors",
                                        isSelected ? "text-foreground" : "text-muted-foreground"
                                    )}>
                                        {cat.name.substring(0, 3)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Details */}
                <div className="pt-2 border-t border-border/40 flex justify-between items-center h-10">
                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Hechos</span>
                            <span className="text-sm font-bold">{activeStats?.controlledItems}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Pendientes</span>
                            <span className="text-sm font-bold">{(activeStats?.totalItems || 0) - (activeStats?.controlledItems || 0)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded-full border border-border/50">
                        <Info className="h-3 w-3" />
                        Refresca cada 30 min
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

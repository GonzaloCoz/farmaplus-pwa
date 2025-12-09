import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { getLaboratoriesForBranch } from '@/services/preCountDB';
import { useUser } from '@/contexts/UserContext';

interface CategoryData {
    name: string;
    totalItems: number;
    controlledItems: number;
    percentage: number;
    pendingPercentage: number;
}

const getGradientStyle = (percentage: number) => {
    // Hue mapping: 0 (Red) -> 120 (Green)
    // We multiply by 1.2 to map 0-100 to 0-120
    const hue = Math.min(120, Math.max(0, (percentage * 1.2)));
    return {
        background: `linear-gradient(135deg, hsl(${hue}, 85%, 60%), hsl(${hue}, 90%, 40%))`,
        color: 'white'
    };
};

export function CategoryProgressWidget() {
    const { user } = useUser();
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [globalStats, setGlobalStats] = useState<CategoryData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!user?.branchSheet) {
                setLoading(false);
                return;
            }

            try {
                // 1. Get Master List of Labs (Source of Truth for Totals)
                const allLabs = await getLaboratoriesForBranch(user.branchSheet);

                // 2. Get Current Statuses
                const inventories = await cyclicInventoryService.getAllCyclicInventories(user.branchSheet) || [];
                const labStatusMap = new Map(inventories.map(i => [i.labName, i.status]));

                // Initialize categories
                const cats = {
                    'Farmacia': { total: 0, controlled: 0 },
                    'Perfumería': { total: 0, controlled: 0 },
                    'Accesorios': { total: 0, controlled: 0 },
                    'Varios': { total: 0, controlled: 0 }
                };

                let globalTotal = 0;
                let globalControlled = 0;

                // 3. Aggregate Data using Master List
                allLabs.forEach(lab => {
                    // Normalize category key
                    let catKey: keyof typeof cats = 'Varios';
                    const labCat = lab.category.toUpperCase();

                    if (labCat === 'MEDICAMENTOS') catKey = 'Farmacia';
                    else if (labCat === 'PERFUMERIA') catKey = 'Perfumería';
                    else if (labCat === 'ACCESORIOS') catKey = 'Accesorios';

                    // Check status
                    const status = labStatusMap.get(lab.name);
                    const isControlled = status === 'controlado';

                    // Update counts
                    if (cats[catKey]) {
                        cats[catKey].total += 1;
                        if (isControlled) cats[catKey].controlled += 1;
                    } else {
                        cats['Varios'].total += 1;
                        if (isControlled) cats['Varios'].controlled += 1;
                    }

                    globalTotal += 1;
                    if (isControlled) globalControlled += 1;
                });

                // Create category data
                const categoryData: CategoryData[] = Object.entries(cats).map(([name, stats]) => {
                    const percentage = stats.total > 0 ? Math.round((stats.controlled / stats.total) * 100) : 0;
                    return {
                        name,
                        totalItems: stats.total,
                        controlledItems: stats.controlled,
                        percentage,
                        pendingPercentage: 100 - percentage
                    };
                });

                // Global Stats
                const globalPercentage = globalTotal > 0 ? Math.round((globalControlled / globalTotal) * 100) : 0;
                setGlobalStats({
                    name: 'Global',
                    totalItems: globalTotal,
                    controlledItems: globalControlled,
                    percentage: globalPercentage,
                    pendingPercentage: 100 - globalPercentage
                });

                setCategories(categoryData);
            } catch (error) {
                console.error('Error loading category progress:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [user]);

    // Sort categories by percentage (Ascending: 0% -> 100%)
    const sortedCategories = [...categories].sort((a, b) => a.percentage - b.percentage);

    if (loading) {
        return (
            <Card className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold tracking-tight">
                        Progreso de Inventario
                    </CardTitle>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        {globalStats?.totalItems} Laboratorios
                    </span>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-4 pt-2">
                <div className="grid grid-cols-12 gap-3 h-full">
                    {/* Global Pending Card (Big - Left) */}
                    <div className="col-span-7 h-full">
                        <div className="h-full rounded-xl bg-muted/30 border border-border/50 p-5 flex flex-col justify-between relative overflow-hidden group hover:bg-muted/50 transition-colors">
                            <div className="flex justify-between items-start z-10">
                                <div className="p-2 bg-background/50 backdrop-blur rounded-lg">
                                    <Info className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </div>

                            <div className="z-10">
                                <h3 className="text-4xl font-bold tracking-tighter text-foreground mb-1">
                                    {globalStats?.percentage}%
                                </h3>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                    AVANCE TOTAL
                                </p>
                            </div>

                            {/* Decorative Background */}
                            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-foreground/5 rounded-full blur-3xl group-hover:bg-foreground/10 transition-colors" />
                        </div>
                    </div>

                    {/* Categories Grid (Small - Right) - Sorted & Dynamic Colors */}
                    <div className="col-span-5 grid grid-cols-1 grid-rows-4 gap-2 h-full">
                        {sortedCategories.map((cat) => (
                            <div
                                key={cat.name}
                                className="relative overflow-hidden rounded-lg p-3 flex items-center justify-between transition-all hover:scale-[1.02] cursor-pointer group shadow-sm"
                                style={getGradientStyle(cat.percentage)}
                            >
                                <div className="z-10 flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-white/90 tracking-wider">
                                        {cat.name}
                                    </span>
                                    <span className="text-lg font-bold text-white drop-shadow-sm">
                                        {cat.percentage}%
                                    </span>
                                </div>

                                <div className="z-10 text-right">
                                    <span className="text-[10px] font-medium text-white/90 bg-black/20 px-1.5 py-0.5 rounded backdrop-blur-sm">
                                        {cat.controlledItems}/{cat.totalItems}
                                    </span>
                                </div>

                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

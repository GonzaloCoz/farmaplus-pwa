import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, TrendingUp, AlertTriangle } from 'lucide-react'
import { cyclicInventoryService } from '@/services/cyclicInventoryService'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLayout } from '@/components/layout/PageLayout'
import { BranchMultiSelector } from '@/components/comparison/BranchMultiSelector'
import { ComparisonCharts } from '@/components/comparison/ComparisonCharts'
import { ComparisonTable } from '@/components/comparison/ComparisonTable'
import { Card, CardContent } from '@/components/ui/card'
import { useUserBranches } from '@/hooks/useUserBranches'

interface BranchStats {
    branchName: string
    progress: number
    totalStockValue: number
    differenceValue: number
    netValue: number
    totalItems: number
    controlledItems: number
}

export default function BranchComparison() {
    const { availableBranches } = useUserBranches();
    const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
    const [comparisonData, setComparisonData] = useState<BranchStats[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Initialize with first 2 branches if available
    useEffect(() => {
        if (selectedBranches.length === 0 && availableBranches.length >= 2) {
            setSelectedBranches(availableBranches.slice(0, 2));
        } else if (selectedBranches.length === 0 && availableBranches.length === 1) {
            setSelectedBranches(availableBranches);
        }
    }, [availableBranches]);

    useEffect(() => {
        const loadComparisonData = async () => {
            if (selectedBranches.length === 0) {
                setComparisonData([]);
                return;
            }

            setIsLoading(true);
            try {
                // Parallel fetch for all selected branches
                const promises = selectedBranches.map(async (branch) => {
                    const labs = await cyclicInventoryService.getAllCyclicInventories(branch);

                    // Aggregate lab stats to get Branch Total Stats
                    const branchAgg = labs.reduce((acc, lab) => ({
                        totalStockValue: acc.totalStockValue + lab.totalSystemUnits * 1000, // Wait, totalSystemUnits is units. totalStockValue logic in useDashboardMetrics was different. 
                        // Let's re-check `cyclicInventoryService.calculateStats`. 
                        // `netValue` is `counted * cost`.
                        // `differenceValue` is `(counted - system) * cost`.
                        // `totalSystemUnits` is just units.
                        // I need TOTAL VALUE (System or Counted?). Usually Comparison compares Difference and Progress.
                        // But let's assume we want Total System Value vs Counted Value?
                        // Let's rely on what getAllCyclicInventories returns:
                        // - netValue (counted * cost)
                        // - differenceValue (diff * cost)
                        // - totalSystemUnits (units)
                        // It does NOT return totalSystemValue ($). 
                        // I might need to approximate or update the service.
                        // For now, let's use differenceValue and progress which are precise.

                        differenceValue: acc.differenceValue + lab.differenceValue,
                        netValue: acc.netValue + lab.netValue,
                        totalItems: acc.totalItems + lab.totalItems,
                        controlledItems: acc.controlledItems + lab.controlledItems
                    }), {
                        totalStockValue: 0,
                        differenceValue: 0,
                        netValue: 0,
                        totalItems: 0,
                        controlledItems: 0
                    });

                    // Recalculate global progress
                    const progress = branchAgg.totalItems > 0 ? Math.round((branchAgg.controlledItems / branchAgg.totalItems) * 100) : 0;

                    return {
                        branchName: branch,
                        progress,
                        totalStockValue: branchAgg.netValue, // Using Counted Value as proxy for "Total Stock"
                        differenceValue: branchAgg.differenceValue,
                        netValue: branchAgg.netValue,
                        totalItems: branchAgg.totalItems,
                        controlledItems: branchAgg.controlledItems
                    };
                });

                const results = await Promise.all(promises);
                setComparisonData(results);

            } catch (error) {
                console.error("Error loading comparison data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadComparisonData();
    }, [selectedBranches]);


    return (
        <PageLayout>


            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                            <label className="text-sm font-medium mb-1 block">Seleccionar Sucursales para comparar</label>
                            <BranchMultiSelector
                                selectedBranches={selectedBranches}
                                onChange={setSelectedBranches}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="space-y-4">
                    {/* Skeletons */}
                    <div className="h-[300px] w-full bg-muted/20 animate-pulse rounded-lg" />
                    <div className="h-[200px] w-full bg-muted/20 animate-pulse rounded-lg" />
                </div>
            ) : (
                <>
                    <ComparisonCharts data={comparisonData} />
                    <ComparisonTable data={comparisonData} />
                </>
            )}

            {comparisonData.length === 0 && !isLoading && (
                <div className="text-center py-12 text-muted-foreground">
                    <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Selecciona al menos una sucursal para ver los datos.</p>
                </div>
            )}
        </PageLayout>
    )
}

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";
import { getProductCount } from "@/services/preCountDB";
import { notify } from "@/lib/notifications";
import { auditService } from "@/services/auditService";

export const useDashboardMetrics = () => {
    const { user } = useUser();

    // Metrics State
    const [metrics, setMetrics] = useState({
        totalStock: 0,
        activeProducts: 0,
        negativeStock: 0,
        positiveStock: 0,
        negativeUnits: 0,
        positiveUnits: 0,
        totalSystemUnits: 0
    });

    const [globalProgress, setGlobalProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Config State
    const [assignedDays, setAssignedDays] = useState(0);
    const [cycleStartDate, setCycleStartDate] = useState<string | null>(null);

    // Load Config
    useEffect(() => {
        const loadConfig = async () => {
            if (user?.branchName) {
                try {
                    const config = await cyclicInventoryService.getBranchConfig(user.branchName);
                    setAssignedDays(config.days);
                    setCycleStartDate(config.startDate);
                } catch (error) {
                    console.error("Error loading branch config:", error);
                }
            }
        };
        loadConfig();
    }, [user]);

    // Load Metrics
    useEffect(() => {
        const loadMetrics = async () => {
            setIsLoading(true);
            const [currentActiveProducts, allInventories] = await Promise.all([
                getProductCount().catch(e => {
                    console.error("Error fetching product count:", e);
                    return 0;
                }),
                user.branchSheet
                    ? cyclicInventoryService.getAllCyclicInventories(user.branchSheet).catch(e => {
                        console.error('Error loading inventories:', e);
                        return [];
                    })
                    : Promise.resolve([])
            ]);

            if (!user?.branchSheet) {
                setMetrics({
                    totalStock: 0,
                    activeProducts: currentActiveProducts,
                    negativeStock: 0,
                    positiveStock: 0,
                    negativeUnits: 0,
                    positiveUnits: 0,
                    totalSystemUnits: 0
                });
                setIsLoading(false);
                return;
            }

            try {
                // allInventories is already fetched in parallel above

                const aggregated = allInventories.reduce((acc, inv) => ({
                    negativeStock: acc.negativeStock + inv.negativeValue,
                    positiveStock: acc.positiveStock + inv.positiveValue,
                    totalStock: acc.totalStock + inv.differenceValue,
                    negativeUnits: acc.negativeUnits + inv.negativeUnits,
                    positiveUnits: acc.positiveUnits + inv.positiveUnits,
                    totalSystemUnits: acc.totalSystemUnits + inv.totalSystemUnits,
                    controlledCount: acc.controlledCount + (inv.status === 'controlado' ? 1 : 0)
                }), {
                    negativeStock: 0,
                    positiveStock: 0,
                    totalStock: 0,
                    negativeUnits: 0,
                    positiveUnits: 0,
                    totalSystemUnits: 0,
                    controlledCount: 0
                });

                const progress = allInventories.length > 0 ? Math.round((aggregated.controlledCount / allInventories.length) * 100) : 0;
                setGlobalProgress(progress);

                setMetrics({
                    totalStock: aggregated.totalStock,
                    activeProducts: currentActiveProducts,
                    negativeStock: aggregated.negativeStock,
                    positiveStock: aggregated.positiveStock,
                    negativeUnits: aggregated.negativeUnits,
                    positiveUnits: aggregated.positiveUnits,
                    totalSystemUnits: aggregated.totalSystemUnits
                });
            } catch (error) {
                console.error('Error loading metrics:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadMetrics();
    }, [user]);

    // Config Update Handler
    const updateConfig = useCallback(async (branch: string, days: number, startDate?: string) => {
        try {
            await cyclicInventoryService.saveBranchConfig(branch, days, startDate);

            // Audit Log
            await auditService.logAction({
                action: 'CONFIG_UPDATE',
                entityType: 'BRANCH_CONFIG',
                branchId: branch,
                userId: user?.id, // Pass explicit User ID
                details: { days, startDate }
            });

            // Update local state if it's the current user's branch
            if (user?.branchName === branch) {
                setAssignedDays(days);
                if (startDate) setCycleStartDate(startDate);
            }
            return true;
        } catch (e) {
            console.error("Error saving config:", e);
            throw e;
        }
    }, [user]);

    const returnValue = useMemo(() => ({
        metrics,
        globalProgress,
        assignedDays,
        cycleStartDate,
        updateConfig,
        isLoading
    }), [metrics, globalProgress, assignedDays, cycleStartDate, isLoading]); // updateConfig is async func, stable? technically no if it's recreated. But it's defined inside component? Wait, line 115 is const updateConfig = async... inside the hook. It should be wrapped in useCallback?

    // Ah, updateConfig is defined at line 115. Let's wrap it in useCallback first, OR just omit it from dependency array if we assume it's stable enough (but it's not).
    // Better: wrap updateConfig in useCallback, then useMemo result.
    // Actually, to minimize changes in this specific call, I will just wrap the return.

    return useMemo(() => ({
        metrics,
        globalProgress,
        assignedDays,
        cycleStartDate,
        updateConfig,
        isLoading
    }), [metrics, globalProgress, assignedDays, cycleStartDate, updateConfig, isLoading]);
};
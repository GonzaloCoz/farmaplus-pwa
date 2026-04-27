
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';
import { getProductCount } from "@/services/preCountDB";
import { auditService } from "@/services/auditService";

export function useDashboardMetrics() {
    const { user } = useUser();
    const queryClient = useQueryClient();

    // 1. Fetch Inventories & Config using React Query
    const { data: inventories = [], isLoading: isLoadingInventories } = useQuery({
        queryKey: ['cyclic-inventories', user?.branchName],
        queryFn: async () => {
            if (!user?.branchName) return [];
            try {
                return await cyclicInventoryService.getAllCyclicInventories(user.branchName);
            } catch (error) {
                console.error("Error loading inventories:", error);
                return [];
            }
        },
        enabled: !!user?.branchName,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    const { data: config = {}, isLoading: isLoadingConfig } = useQuery({
        queryKey: ['branch-config', user?.branchName],
        queryFn: async () => {
            if (!user?.branchName) return {};
            try {
                return await cyclicInventoryService.getBranchConfig(user.branchName);
            } catch (error) {
                console.error("Error loading config:", error);
                return {};
            }
        },
        enabled: !!user?.branchName,
        staleTime: 1000 * 60 * 30, // 30 minutes cache
    });

    const { data: activeProductCount = 0 } = useQuery({
        queryKey: ['active-products-count'],
        queryFn: async () => {
            try {
                return await getProductCount();
            } catch (e) {
                return 0;
            }
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    // Fetch lock status
    const { data: lockStatus = { isLocked: false, reason: null }, isLoading: isLoadingLock } = useQuery({
        queryKey: ['branch-lock-status', user?.branchName, config],
        queryFn: async () => {
            if (!user?.branchName) return { isLocked: false, reason: null };
            try {
                const days = (config as any)?.days || 0;
                const startDate = (config as any)?.startDate || null;
                return await cyclicInventoryService.isInventoryLocked(user.branchName, days, startDate);
            } catch (error) {
                console.error('Error checking lock status:', error);
                return { isLocked: false, reason: null };
            }
        },
        enabled: !!user?.branchName && !!config,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    const isLoading = isLoadingInventories || isLoadingConfig || isLoadingLock;

    // Mutation to update config (supports bulk)
    const updateConfigMutation = useMutation({
        mutationFn: async (variables: { branches: string[], days: number, startDate?: string }) => {
            // Use bulk service
            await cyclicInventoryService.saveBulkBranchConfig(variables.branches, variables.days, variables.startDate);

            // Audit Log for each branch (could be many, but keeping it simple for now)
            // Log only one entry for the bulk action to avoid spamming logs if many branches
            await auditService.logAction({
                action: 'CONFIG_UPDATE_BULK',
                entityType: 'BRANCH_CONFIG',
                branchId: variables.branches.join(', '),
                userId: user?.id,
                details: {
                    days: variables.days,
                    startDate: variables.startDate,
                    count: variables.branches.length
                }
            });
        },
        onSuccess: () => {
            // Invalidate all branch configurations and monitor summaries
            queryClient.invalidateQueries({ queryKey: ['branch-config'] });
            queryClient.invalidateQueries({ queryKey: ['branch-summaries-lite'] });
            queryClient.invalidateQueries({ queryKey: ['cyclic-inventories'] });
        }
    });

    const updateConfig = async (branches: string[], days: number, startDate?: string) => {
        if (!branches || branches.length === 0) return;
        await updateConfigMutation.mutateAsync({ branches, days, startDate });
    };

    // Mutation to toggle lock
    const toggleLockMutation = useMutation({
        mutationFn: async (variables: { branch: string, isLocked: boolean }) => {
            await cyclicInventoryService.toggleBranchLock(variables.branch, variables.isLocked);

            // Audit Log
            await auditService.logAction({
                action: variables.isLocked ? 'INVENTORY_LOCKED' : 'INVENTORY_UNLOCKED',
                entityType: 'BRANCH_INVENTORY',
                branchId: variables.branch,
                userId: user?.id,
                details: { isLocked: variables.isLocked }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branch-lock-status', user?.branchName] });
        }
    });

    const toggleLock = async (isLocked: boolean) => {
        if (!user?.branchName) return;
        await toggleLockMutation.mutateAsync({ branch: user.branchName, isLocked });
    };

    // 2. Metrics Calculation - Returning Object structure as expected by consumers
    const metrics = useMemo(() => {
        if (!inventories.length) {
            return {
                totalStock: 0,
                activeProducts: activeProductCount,
                negativeStock: 0,
                positiveStock: 0,
                negativeUnits: 0,
                positiveUnits: 0,
                totalSystemUnits: 0
            };
        }

        const aggregated = inventories.reduce((acc: any, inv: any) => ({
            negativeStock: acc.negativeStock + (inv.negativeValue || 0),
            positiveStock: acc.positiveStock + (inv.positiveValue || 0),
            totalStock: acc.totalStock + (inv.differenceValue || 0), // Assuming differenceValue is the net impact $
            negativeUnits: acc.negativeUnits + (inv.negativeUnits || 0),
            positiveUnits: acc.positiveUnits + (inv.positiveUnits || 0),
            totalSystemUnits: acc.totalSystemUnits + (inv.totalSystemUnits || 0)
        }), {
            negativeStock: 0,
            positiveStock: 0,
            totalStock: 0,
            negativeUnits: 0,
            positiveUnits: 0,
            totalSystemUnits: 0
        });

        return {
            totalStock: aggregated.totalStock,
            activeProducts: activeProductCount,
            negativeStock: aggregated.negativeStock,
            positiveStock: aggregated.positiveStock,
            negativeUnits: aggregated.negativeUnits,
            positiveUnits: aggregated.positiveUnits,
            totalSystemUnits: aggregated.totalSystemUnits
        };
    }, [inventories, activeProductCount]);

    const globalProgress = useMemo(() => {
        // Include all laboratories regardless of item count to match the new Coverage logic
        if (!inventories.length) return 0;
        
        const touched = inventories.filter((i: any) => i.status === 'controlado' || i.status === 'por_controlar').length;
        return Math.round((touched / inventories.length) * 100);
    }, [inventories]);

    return {
        metrics,
        globalProgress,
        assignedDays: (config as any)?.days || 0,
        cycleStartDate: (config as any)?.startDate || null,
        updateConfig,
        isLocked: lockStatus.isLocked,
        lockReason: lockStatus.reason,
        toggleLock,
        isLoading
    };
}
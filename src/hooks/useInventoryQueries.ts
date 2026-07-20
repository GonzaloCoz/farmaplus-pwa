import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cyclicInventoryService } from '@/services/cyclicInventoryService';

export const INVENTORY_KEYS = {
    all: ['inventory'] as const,
    lab: (branchName: string, labName: string, round?: number) => [...INVENTORY_KEYS.all, 'lab', branchName, labName, round] as const,
    stats: (branchName: string, labName: string, category: string) => [...INVENTORY_KEYS.all, 'stats', branchName, labName, category] as const,
    summary: () => [...INVENTORY_KEYS.all, 'summary'] as const,
    history: (branchName: string, labName: string) => [...INVENTORY_KEYS.all, 'history', branchName, labName] as const,
};

export function useLabInventoryQuery(branchName: string, labName: string, round?: number) {
    return useQuery({
        queryKey: INVENTORY_KEYS.lab(branchName, labName, round),
        queryFn: () => cyclicInventoryService.getLabInventory(branchName, labName, round),
        enabled: !!labName && branchName !== 'Sucursal Desconocida',
        staleTime: 1000 * 60 * 5, // 5 minutos de caché
    });
}

export function usePrefetchLabInventory() {
    const queryClient = useQueryClient();

    const prefetch = (branchName: string, labName: string, round?: number) => {
        if (!labName || branchName === 'Sucursal Desconocida') return;

        queryClient.prefetchQuery({
            queryKey: INVENTORY_KEYS.lab(branchName, labName, round),
            queryFn: () => cyclicInventoryService.getLabInventory(branchName, labName, round),
            staleTime: 1000 * 60 * 5,
        });
    };

    return prefetch;
}

export function useLabStatsQuery(branchName: string, labName: string, category: string) {
    return useQuery({
        queryKey: INVENTORY_KEYS.stats(branchName, labName, category),
        queryFn: () => cyclicInventoryService.getLabStats(branchName, labName, category),
        enabled: !!labName && !!branchName && !!category && branchName !== 'Sucursal Desconocida',
        staleTime: 1000 * 60 * 1, // 1 minuto de caché
    });
}

export function usePrefetchAllLabStats() {
    const queryClient = useQueryClient();
    const categories = ["Medicamentos", "Perfumería", "Accesorios", "Varios"];

    const prefetchAll = (branchName: string, labName: string) => {
        if (!labName || branchName === 'Sucursal Desconocida') return;

        categories.forEach(category => {
            queryClient.prefetchQuery({
                queryKey: INVENTORY_KEYS.stats(branchName, labName, category),
                queryFn: () => cyclicInventoryService.getLabStats(branchName, labName, category),
                staleTime: 1000 * 60 * 1,
            });
        });
    };

    return prefetchAll;
}
export function useAdjustmentHistoryQuery(branchName: string, labName: string) {
    return useQuery({
        queryKey: INVENTORY_KEYS.history(branchName, labName),
        queryFn: () => cyclicInventoryService.getAdjustmentHistory(branchName, labName),
        enabled: !!labName && branchName !== 'Sucursal Desconocida',
        staleTime: 1000 * 60 * 2, // 2 minutos de caché (más volátil que el inventario)
    });
}

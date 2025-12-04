import { LaboratoryStatus } from "@/components/LaboratoryCard";

export interface CyclicInventoryStats {
    labName: string;
    category: string;
    status: LaboratoryStatus;
    totalItems: number;
    controlledItems: number;
    progress: number;

    // Financials
    negativeValue: number; // Cost of missing items (System > Physical)
    positiveValue: number; // Cost of surplus items (Physical > System)
    netValue: number;      // Total value (Physical * Cost)
    differenceValue: number; // The "Sum" of negative and positive differences.

    // Units
    totalSystemUnits: number; // Total units expected in controlled items
    negativeUnits: number; // Count of missing units
    positiveUnits: number; // Count of surplus units
    netUnits: number; // Net difference in units
}

export interface CyclicItem {
    id: string;
    ean: string;
    name: string;
    systemQuantity: number;
    countedQuantity: number;
    cost: number;
    status: 'pending' | 'controlled' | 'adjusted';
    category?: string;
}

export const cyclicInventoryService = {
    getLabInventory: (labName: string): CyclicItem[] => {
        try {
            const key = `cyclic_inventory_${labName}`;
            const data = localStorage.getItem(key);
            if (!data) return [];
            return JSON.parse(data);
        } catch (e) {
            console.error(`Error loading inventory for ${labName}`, e);
            return [];
        }
    },

    calculateStats: (items: CyclicItem[]): {
        negative: number, positive: number, net: number, progress: number, status: LaboratoryStatus,
        negativeUnits: number, positiveUnits: number, netUnits: number, totalSystemUnits: number
    } => {
        let negative = 0;
        let positive = 0;
        let controlledCount = 0;

        // Unit stats
        let negativeUnits = 0;
        let positiveUnits = 0;
        let totalSystemUnits = 0;

        items.forEach(item => {
            if (item.status === 'controlled' || item.status === 'adjusted') {
                controlledCount++;
                const diff = item.countedQuantity - item.systemQuantity;
                const value = diff * item.cost;

                totalSystemUnits += item.systemQuantity;

                if (diff < 0) {
                    negative += value;
                    negativeUnits += diff;
                } else if (diff > 0) {
                    positive += value;
                    positiveUnits += diff;
                }
            }
        });

        const totalItems = items.length;
        const progress = totalItems > 0 ? Math.round((controlledCount / totalItems) * 100) : 0;

        let status: LaboratoryStatus = 'pendiente';
        if (progress === 100) status = 'controlado';
        else if (progress > 0) status = 'por_controlar';

        return {
            negative,
            positive,
            net: negative + positive,
            progress,
            status,
            negativeUnits,
            positiveUnits,
            netUnits: negativeUnits + positiveUnits,
            totalSystemUnits
        };
    },

    getAllCyclicInventories: (): CyclicInventoryStats[] => {
        const stats: CyclicInventoryStats[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cyclic_inventory_') && !key.startsWith('cyclic_inventory_status_')) {
                const labName = key.replace('cyclic_inventory_', '');
                const items = cyclicInventoryService.getLabInventory(labName);

                if (items.length === 0) continue;

                const calc = cyclicInventoryService.calculateStats(items);

                // Try to get category from first item or status
                const category = items[0]?.category || 'Varios';

                stats.push({
                    labName,
                    category,
                    status: calc.status,
                    totalItems: items.length,
                    controlledItems: Math.round((calc.progress / 100) * items.length),
                    progress: calc.progress,
                    negativeValue: calc.negative,
                    positiveValue: calc.positive,
                    netValue: items.reduce((acc, i) => acc + (i.countedQuantity * i.cost), 0), // Total Physical Value
                    differenceValue: calc.net, // Net Difference

                    // Units
                    totalSystemUnits: calc.totalSystemUnits,
                    negativeUnits: calc.negativeUnits,
                    positiveUnits: calc.positiveUnits,
                    netUnits: calc.netUnits
                });
            }
        }
        return stats;
    }
};

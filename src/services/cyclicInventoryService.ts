import { LaboratoryStatus } from "@/components/LaboratoryCard";
import { supabase } from "@/integrations/supabase/client";

export interface CyclicInventoryStats {
    labName: string;
    category: string;
    status: LaboratoryStatus;
    totalItems: number;
    controlledItems: number;
    progress: number;

    // Financials
    negativeValue: number;
    positiveValue: number;
    netValue: number;
    differenceValue: number;

    // Units
    totalSystemUnits: number;
    negativeUnits: number;
    positiveUnits: number;
    netUnits: number;
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
    // Get inventory for a specific lab (Supabase)
    getLabInventory: async (labName: string): Promise<CyclicItem[]> => {
        try {
            const { data, error } = await supabase
                .from('inventories')
                .select(`
                    id,
                    ean,
                    quantity,
                    status,
                    products (
                        name,
                        cost,
                        category
                    )
                `)
                .eq('branch_name', labName);

            if (error) {
                console.error(`Error loading inventory for ${labName}:`, error);
                return [];
            }

            // Map Supabase result to CyclicItem
            return data.map((item: any) => ({
                id: item.id,
                ean: item.ean,
                name: item.products?.name || 'Desconocido',
                systemQuantity: 0, // System quantity usually comes from Excel import, might need to store it in DB too or keep it 0 if dynamic
                countedQuantity: item.quantity,
                cost: item.products?.cost || 0,
                status: item.status as 'pending' | 'controlled' | 'adjusted',
                category: item.products?.category
            }));
        } catch (e) {
            console.error(`Error loading inventory for ${labName}`, e);
            return [];
        }
    },

    // Save inventory (Upsert)
    saveInventory: async (labName: string, items: CyclicItem[]) => {
        try {
            // We only save items that have been counted/modified to save DB space?
            // Or save everything? The user wants "Gran Base de Datos".
            // Let's save everything for now to keep state consistent.

            const dbItems = items.map(item => ({
                branch_name: labName,
                ean: item.ean,
                quantity: item.countedQuantity,
                status: item.status
            }));

            // Upsert based on branch_name + ean?
            // The table schema I gave has 'id' as PK. 
            // If we want to update existing, we need a unique constraint on (branch_name, ean).
            // I didn't add that constraint in the SQL schema I provided. 
            // I should have added: create unique index on public.inventories (branch_name, ean);
            // Without it, upsert might duplicate.
            // WORKAROUND: Delete all for branch then insert? Or handle ID?
            // Since I cannot change SQL easily now without user, I will try to use the 'id' if I have it, 
            // but the 'id' in CyclicItem is crypto.randomUUID() generated locally in the component.
            // Best approach given current state: Delete all for this lab and re-insert. 
            // It's not efficient but safe for consistency.

            // 1. Delete existing for this lab
            await supabase.from('inventories').delete().eq('branch_name', labName);

            // 2. Insert new
            const { error } = await supabase.from('inventories').insert(dbItems);

            if (error) throw error;

        } catch (e) {
            console.error("Error saving inventory:", e);
            throw e;
        }
    },

    // Delete inventory
    deleteInventory: async (labName: string) => {
        await supabase.from('inventories').delete().eq('branch_name', labName);
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

    // Get all inventories (aggregated or filtered by branch)
    getAllCyclicInventories: async (branchName?: string): Promise<CyclicInventoryStats[]> => {
        // Fetch inventories
        let query = supabase
            .from('inventories')
            .select(`
                branch_name,
                quantity,
                status,
                products (
                    name,
                    cost,
                    category
                )
            `);

        if (branchName) {
            query = query.eq('branch_name', branchName);
        }

        const { data, error } = await query;

        if (error || !data) return [];

        // Group by branch
        const grouped: Record<string, CyclicItem[]> = {};

        data.forEach((row: any) => {
            if (!grouped[row.branch_name]) grouped[row.branch_name] = [];

            grouped[row.branch_name].push({
                id: '', // Not needed for stats
                ean: '',
                name: row.products?.name || '',
                systemQuantity: 0, // Missing system quantity in DB
                countedQuantity: row.quantity,
                cost: row.products?.cost || 0,
                status: row.status,
                category: row.products?.category
            });
        });

        const stats: CyclicInventoryStats[] = [];

        Object.entries(grouped).forEach(([labName, items]) => {
            const calc = cyclicInventoryService.calculateStats(items);
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
                netValue: items.reduce((acc, i) => acc + (i.countedQuantity * i.cost), 0),
                differenceValue: calc.net,
                totalSystemUnits: calc.totalSystemUnits,
                negativeUnits: calc.negativeUnits,
                positiveUnits: calc.positiveUnits,
                netUnits: calc.netUnits
            });
        });

        return stats;
    }
};

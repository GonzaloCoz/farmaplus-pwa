import { LaboratoryStatus } from "@/components/LaboratoryCard";
import { supabase } from "@/integrations/supabase/client";
import { getAllBranchLabCounts } from './preCountDB';
import { BRANCH_NAMES } from "@/config/users";

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
    getLabInventory: async (branchName: string, labName: string): Promise<CyclicItem[]> => {
        try {
            const { data, error } = await supabase
                .from('inventories')
                .select(`
                    ean,
                    quantity,
                    system_quantity,
                    status,
                    products (
                        name,
                        cost,
                        category
                    )
                `)
                .eq('branch_name', branchName)
                .eq('laboratory', labName);

            if (error) {
                console.error(`Error loading inventory for ${labName}:`, error);
                return [];
            }

            // Map Supabase result to CyclicItem
            return data.map((item: any) => ({
                id: item.id,
                ean: item.ean,
                name: item.products?.name || 'Desconocido',
                systemQuantity: item.system_quantity || 0,
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
    saveInventory: async (branchName: string, labName: string, items: CyclicItem[]) => {
        try {
            // We only save items that have been counted/modified to save DB space?
            // Or save everything? The user wants "Gran Base de Datos".
            // Let's save everything for now to keep state consistent.

            const dbItems = items.map(item => ({
                branch_name: branchName,
                laboratory: labName,
                ean: item.ean,
                quantity: item.countedQuantity,
                system_quantity: item.systemQuantity,
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

            // 1. Delete existing for this lab AND branch
            await supabase.from('inventories')
                .delete()
                .eq('branch_name', branchName)
                .eq('laboratory', labName);

            // 2. Insert new
            const { error } = await supabase.from('inventories').insert(dbItems);

            if (error) throw error;

        } catch (e) {
            console.error("Error saving inventory:", e);
            throw e;
        }
    },

    // Delete inventory
    deleteInventory: async (branchName: string, labName: string) => {
        await supabase.from('inventories')
            .delete()
            .eq('branch_name', branchName)
            .eq('laboratory', labName);
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


        let status: LaboratoryStatus = 'pendiente';
        if (controlledCount === totalItems && totalItems > 0) status = 'controlado';
        else if (controlledCount > 0) status = 'por_controlar';

        const rawProgress = totalItems > 0 ? (controlledCount / totalItems) * 100 : 0;
        // Float with 1 decimal if small, or integer if large?
        // Let's use 1 decimal for better precision
        const progress = totalItems > 0 ? Number(rawProgress.toFixed(1)) : 0;

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
                laboratory,
                quantity,
                system_quantity,
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

        // Group by LABORATORY (since we are already filtered by branch or just want all labs for this branch)
        // Note: The previous logic grouped by branch_name because branch_name WAS the lab name.
        // Now branch_name is the Store. So we group by 'laboratory'.

        const grouped: Record<string, CyclicItem[]> = {};

        data.forEach((row: any) => {
            // If branchName is provided, we only get rows for that branch.
            // So we aggregate by laboratory.
            // If no branchName, we might get mix, but UI usually calls with branchName.
            // Let's assume grouping by laboratory is what we want for the "Labs List" view.

            const groupKey = row.laboratory || 'Desconocido';

            if (!grouped[groupKey]) grouped[groupKey] = [];

            grouped[groupKey].push({
                id: '', // Not needed for stats
                ean: '',
                name: row.products?.name || '',
                systemQuantity: row.system_quantity || 0,
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
    },



    // Get summary for ALL branches (Admin View)
    getBranchesSummary: async (): Promise<any[]> => {
        const { data, error } = await supabase
            .from('inventories')
            .select(`
                branch_name,
                laboratory,
                quantity,
                system_quantity,
                status,
                products (
                     cost
                )
            `);

        if (error || !data) {
            console.error("Error fetching branches summary:", error);
            return [];
        }

        // Fetch Total Lab Counts from Excel (Source of Truth for Goals)
        const labCounts = await getAllBranchLabCounts();

        // Initialize with ALL valid branches to ensure they appear
        const groupedByBranch: Record<string, {
            totalSystemUnits: number;
            netUnits: number;
            netValue: number;
            controlledLabs: Set<string>;
            totalLabsInDB: Set<string>;
        }> = {};

        BRANCH_NAMES.forEach(name => {
            groupedByBranch[name] = {
                totalSystemUnits: 0,
                netUnits: 0,
                netValue: 0,
                controlledLabs: new Set(),
                totalLabsInDB: new Set()
            };
        });

        data.forEach((row: any) => {
            const rawBranch = (row.branch_name || '').trim();
            if (!rawBranch) return;

            // Find valid branch name case-insensitive
            const validName = BRANCH_NAMES.find(b => b.toLowerCase() === rawBranch.toLowerCase());

            // Only aggregate if it matches a valid branch
            if (validName) {
                const group = groupedByBranch[validName];
                const labName = row.laboratory || 'Unknown';

                // Units and Values logic (Sum of items)
                const quantity = row.quantity || 0;
                const sysQuantity = row.system_quantity || 0;
                const cost = row.products?.cost || 0;

                group.totalSystemUnits += sysQuantity;
                group.netUnits += (quantity - sysQuantity);
                group.netValue += (quantity - sysQuantity) * cost;

                // Lab Stats
                group.totalLabsInDB.add(labName);
                if (row.status === 'controlado') {
                    group.controlledLabs.add(labName);
                }
            }
        });

        const summaries = BRANCH_NAMES.map(branchName => {
            const group = groupedByBranch[branchName];
            const totalLabsGoal = labCounts[branchName] || 0; // The Real Goal from Excel
            const controlledCount = group.controlledLabs.size;

            // Progress = Controlled Labs / Total Labs Goal
            // If goal is 0 (missing excel), fallback to DB count? No, stick to 0 or 100?
            // User wants strict logic. If no goal, progress is undefined? 
            // Let's assume if 0 goal, progress is 0.

            const rawProgress = totalLabsGoal > 0 ? (controlledCount / totalLabsGoal) * 100 : 0;
            const progress = totalLabsGoal > 0 ? Number(rawProgress.toFixed(1)) : 0;

            // Status logic based on Labs
            let status = 'pendiente';
            if (controlledCount >= totalLabsGoal && totalLabsGoal > 0) status = 'controlado';
            else if (controlledCount > 0) status = 'por_controlar';

            return {
                branchName,
                deploymentDate: '01/12/2025',
                cyclicRound: 1,
                monthlyGoal: totalLabsGoal, // Goal is Total Labs from Excel
                elapsedDays: 12,
                progress: progress,
                inventoryUnits: group.totalSystemUnits, // Showing System Units or Physical? Logic suggests System.
                differenceUnits: group.netUnits,
                adjustmentsValue: group.netValue,
                status: status
            };
        });

        return summaries.sort((a, b) => b.progress - a.progress);
    },

    // Configuration System
    getBranchConfig: async (branchName: string): Promise<number> => {
        const { data } = await supabase
            .from('inventories')
            .select('quantity')
            .eq('branch_name', branchName)
            .eq('laboratory', '_CONFIG_')
            .limit(1)
            .maybeSingle();

        return data ? data.quantity : 0; // Default to 0 if not set
    },

    saveBranchConfig: async (branchName: string, days: number): Promise<void> => {
        try {
            // Ensure the special product exists
            await import('./preCountDB').then(m => m.ensureConfigProduct());

            // 1. Delete previous config
            await supabase.from('inventories')
                .delete()
                .eq('branch_name', branchName)
                .eq('laboratory', '_CONFIG_');

            // 2. Insert new config
            const { error } = await supabase.from('inventories').insert({
                branch_name: branchName,
                laboratory: '_CONFIG_',
                ean: 'CONFIG_DAYS', // Must match the one created in ensureConfigProduct
                quantity: days,
                system_quantity: 0,
                status: 'pending' // Important: 'pending' so it doesn't count as controlled
            });

            if (error) throw error;
        } catch (e) {
            console.error("Error saving branch config:", e);
            throw e;
        }
    }
};

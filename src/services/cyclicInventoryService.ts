
import { LaboratoryStatus } from "@/components/LaboratoryCard";
import { supabase } from "@/integrations/supabase/client";
import { getAllBranchLabCounts } from './preCountDB';
import { getProductCountByLab } from './productService';
import { BRANCH_NAMES } from "@/config/users";
import { normalizeString } from "@/lib/utils";
import {
    CyclicItemSchema,
    CyclicInventoryStatsSchema,
    BranchSummaryLiteSchema
} from "@/lib/schemas/inventory";

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
    wasReadjusted?: boolean;
    updatedAt?: string;
}

export const cyclicInventoryService = {
    // Get inventory for a specific lab (Supabase)
    getLabInventory: async (branchName: string, labName: string): Promise<CyclicItem[]> => {
        try {
            const { data, error } = await supabase
                .from('inventories')
                .select(`
                    id,
                    ean,
                    quantity,
                    system_quantity,
                    status,
                    was_readjusted,
                    status,
                    was_readjusted,
                    category,
                    updated_at,
                    products (
                        name,
                        cost,
                        category
                    )
                `)
                .ilike('branch_name', branchName.trim())
                .eq('laboratory', labName);

            if (error) {
                console.error(`Error loading inventory for ${labName}:`, error);
                return [];
            }

            // Map Supabase result to CyclicItem
            return data.map((item: any) => {
                const mappedItem = {
                    id: item.id,
                    ean: item.ean,
                    name: item.products?.name || 'Desconocido',
                    systemQuantity: item.system_quantity || 0,
                    countedQuantity: item.quantity,
                    cost: item.products?.cost || 0,
                    status: item.status as 'pending' | 'controlled' | 'adjusted',
                    category: item.category || item.products?.category, // Prefer category from inventory record
                    wasReadjusted: item.was_readjusted,
                    updatedAt: item.updated_at
                };

                // Enterprise Validation
                const result = CyclicItemSchema.safeParse(mappedItem);
                if (!result.success) {
                    console.error("Zod Validation Error (Item):", result.error.format());
                    return mappedItem as CyclicItem; // Fallback to raw data if it fails but log it
                }
                return result.data as CyclicItem;
            });
        } catch (e) {
            console.error(`Error loading inventory for ${labName}`, e);
            return [];
        }
    },

    // Save inventory (Upsert)
    saveInventory: async (branchName: string, labName: string, items: CyclicItem[]) => {
        try {
            // Prepare items payload for the RPC function
            const rpcItems = items.map(item => ({
                ean: item.ean,
                name: item.name,
                category: item.category,
                cost: item.cost || 0,
                countedQuantity: item.countedQuantity,
                systemQuantity: item.systemQuantity,
                status: item.status,
                wasReadjusted: item.wasReadjusted || false
            }));

            // Call the database function (RPC V2)
            // This handles BOTH product creation/update and inventory upsert atomically
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any).rpc('save_cyclic_inventory_v2', {
                p_branch_name: branchName,
                p_laboratory: labName,
                p_items: rpcItems as any
            });

            if (error) {
                console.error('Error calling save_cyclic_inventory_v2 RPC:', error);
                throw error;
            }

            // Update metadata table for real-time monitoring
            await cyclicInventoryService.updateLabMetadata(branchName, labName, items);

        } catch (e) {
            console.error("Error saving inventory:", e);
            throw e;
        }
    },

    // Delete inventory
    deleteInventory: async (branchName: string, labName: string) => {
        // 1. Delete from inventories
        const { error: invError } = await supabase.from('inventories')
            .delete()
            .ilike('branch_name', branchName.trim())
            .eq('laboratory', labName);

        if (invError) {
            console.error("Error deleting inventory:", invError);
            throw invError;
        }

        // 2. Delete from metadata (branch_laboratories) to prevent ghost data
        const { error: metaError } = await supabase.from('branch_laboratories')
            .delete()
            .ilike('branch_name', branchName.trim())
            .eq('laboratory', labName);

        if (metaError) {
            console.error("Error deleting lab metadata:", metaError);
            // Don't throw, just log. The main delete succeeded.
        }
    },

    // Delete adjustment history for a laboratory
    deleteAdjustmentHistory: async (branchName: string, labName: string) => {
        const { error } = await supabase.from('inventory_adjustments')
            .delete()
            .ilike('branch_name', branchName.trim())
            .eq('laboratory', labName);

        if (error) {
            console.error("Error deleting adjustment history:", error);
            throw error;
        }
    },

    // Clear pending residues for specific categories
    clearPendingResidue: async (branchName: string, labName: string, categories: string[]) => {
        const { error } = await (supabase as any).rpc('clear_lab_pending_residue', {
            p_branch_name: branchName,
            p_laboratory: labName,
            p_categories: categories
        });

        if (error) {
            console.error("Error clearing pending residue:", error);
            throw error;
        }
    },

    // Clear ALL pending residues for a laboratory (ignore category)
    clearAllLabResidue: async (branchName: string, labName: string) => {
        const { error } = await supabase.from('inventories')
            .delete()
            .ilike('branch_name', branchName.trim())
            .eq('laboratory', labName)
            .eq('status', 'pending');

        if (error) {
            console.error("Error clearing all lab residues:", error);
            throw error;
        }
    },

    /**
     * Algoritmo de Sincronización de Hierro (Ironclad Sync)
     * Borra TODO el laboratorio de la base de datos y guarda los nuevos items.
     * Esto elimina cualquier residuo de cualquier rubro que no esté en el archivo.
     */
    purgeAndSaveLabInventory: async (branchName: string, labName: string, items: CyclicItem[]) => {
        try {
            // 1. Borrado TOTAL preventivo del laboratorio para esta sucursal
            const { error: deleteError } = await (supabase as any)
                .from('inventories')
                .delete()
                .ilike('branch_name', branchName.trim())
                .eq('laboratory', labName);

            if (deleteError) {
                console.error("Error purging lab inventory:", deleteError);
                throw deleteError;
            }

            // 2. Guardado de los nuevos items (Insert masivo)
            if (items.length > 0) {
                await cyclicInventoryService.saveInventory(branchName, labName, items);
            }

            console.log(`Ironclad Sync completado para ${labName}: Purga total e inserción de ${items.length} items.`);
        } catch (error) {
            console.error("Error in purgeAndSaveLabInventory:", error);
            throw error;
        }
    },

    // Update laboratory metadata for real-time monitoring
    updateLabMetadata: async (branchName: string, labName: string, items: CyclicItem[]): Promise<void> => {
        try {
            // Group items by category to split metadata records
            const grouped: Record<string, CyclicItem[]> = {};
            items.forEach(item => {
                const cat = normalizeString(item.category || 'Varios');
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
            });

            // --- GLOBAL PROGRESS CALCULATION (Forced Consistency) ---
            // Calculate progress based on the ENTIRE passed inventory list (which represents the full Lab).
            // This ensures that the percentage stored in 'branch_laboratories' matches exactly what the user sees
            // in the Detail View (28%), instead of a partial category progress (e.g. 39%).
            const globalTotal = items.length;
            const globalProcessed = items.filter(i => i.status === 'controlled' || i.status === 'adjusted').length;

            let globalProgress = 0;
            if (globalTotal > 0) {
                globalProgress = Number(((globalProcessed / globalTotal) * 100).toFixed(1));
                if (globalProgress > 100) globalProgress = 100;
            }
            // -------------------------------------------------------

            // Iterate each category and upsert its own stats
            const upsertPromises = Object.entries(grouped).map(async ([category, catItems]) => {
                const stats = cyclicInventoryService.calculateStats(catItems);

                // Count items by status
                const controlledItems = catItems.filter(i => i.status === 'controlled').length;
                const adjustedItems = catItems.filter(i => i.status === 'adjusted').length;
                const pendingItems = catItems.filter(i => i.status === 'pending').length;

                // Category-specific counts (for accurate data)
                const totalInventoryItems = catItems.length;

                // Determine overall status based on GLOBAL progress
                let status: 'pending' | 'in_progress' | 'completed' = 'pending';
                if (globalProgress === 100) status = 'completed';
                else if (globalProgress > 0) status = 'in_progress';

                // Upsert to metadata table with composite key (Branch + Lab + Category)
                return supabase
                    .from('branch_laboratories')
                    .upsert({
                        branch_name: branchName,
                        laboratory: labName,
                        category: category,
                        total_items: totalInventoryItems, // Correct Category Count
                        controlled_items: controlledItems + adjustedItems, // Correct Category Processed
                        adjusted_items: adjustedItems,
                        pending_items: pendingItems,
                        progress_percentage: globalProgress, // <--- FORCED GLOBAL PROGRESS (28%)
                        total_system_units: stats.totalSystemUnits,
                        net_units: stats.netUnits,
                        net_value: stats.net,
                        negative_value: stats.negative,
                        positive_value: stats.positive,
                        status: status
                    }, {
                        onConflict: 'branch_name,laboratory,category'
                    });
            });

            const results = await Promise.all(upsertPromises);

            // Log any errors
            results.forEach(({ error }) => {
                if (error) console.error('Error updating lab metadata chunk:', error);
            });

        } catch (e) {
            console.error('Error in updateLabMetadata:', e);
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
            const isControlled = item.status === 'controlled' || item.status === 'adjusted';

            if (isControlled) {
                controlledCount++;
            }

            // Include in financials if it's controlled OR if it's pending but has a difference (user input)
            // This ensures real-time visibility of potential adjustments
            const diff = item.countedQuantity - item.systemQuantity;

            if (diff !== 0) {
                const value = diff * item.cost;

                // Only add to system units if we consider this item "processed" or if we want total inventory value?
                // Actually totalSystemUnits is usually sum of all system quantities regardless of count.
                // But here we are summing inside the loop. Let's make sure we sum system units for ALL items if desired, 
                // or just keep the logic consistent. 
                // The original code only summed totalSystemUnits if controlled.
                // Let's sum totalSystemUnits for ALL items to be safe, or at least consistent with financials.

                // However, to keep it simple and safe:
                // We calculate financials for ANYTHING with a diff.

                if (diff < 0) {
                    negative += value;
                    negativeUnits += diff;
                } else {
                    positive += value;
                    positiveUnits += diff;
                }
            }

            // Create a separate loop or logic for totalSystemUnits if needed, 
            // but original code only added to totalSystemUnits if controlled. 
            // Let's stick to adding to totals if it contributes to the diff or is controlled.
            if (isControlled || diff !== 0) {
                totalSystemUnits += item.systemQuantity;
            }
        });

        const totalItems = items.length;


        let status: LaboratoryStatus = 'pendiente';
        if (controlledCount === totalItems && totalItems > 0) status = 'controlado';
        else if (controlledCount > 0) status = 'por_controlar';

        const rawProgress = totalItems > 0 ? (controlledCount / totalItems) * 100 : 0;
        // ¿Decimal con 1 lugar si es pequeño, o entero si es grande?
        // Usemos 1 decimal para mejor precisión
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

    // Obtener todos los inventarios (agregados o filtrados por sucursal)
    // Ayudante para obtener el estado de un solo laboratorio para la Vista Detallada
    getLabStats: async (branchName: string, labName: string, category: string) => {
        try {
            const { data, error } = await supabase
                .from('branch_laboratories')
                .select('*')
                .eq('branch_name', branchName)
                .ilike('laboratory', labName.trim())
                .ilike('category', normalizeString(category))
                .maybeSingle();

            if (error) {
                console.error('Error fetching lab stats:', error);
                return null;
            }

            if (!data) return null;

            const total = Number(data.total_items) || 0;
            const controlled = Number(data.controlled_items) || 0;
            const adjusted = Number(data.adjusted_items) || 0;
            const progress = Number(data.progress_percentage) || 0;

            return {
                totalItems: total,
                controlledItems: controlled,
                adjustedItems: adjusted,
                // Calcular Pendientes desde el Total (Maestro) - Procesados
                pendingItems: Math.max(0, total - (controlled + adjusted)),
                progress: progress
            };
        } catch (error) {
            console.error('Unexpected error in getLabStats:', error);
            return null;
        }
    },

    // Get all inventories (aggregated from branch_laboratories metadata)
    getAllCyclicInventories: async (branchName?: string): Promise<CyclicInventoryStats[]> => {
        // 1. First, identify ACTIVE laboratories (the "open session")
        let activeLabsQuery = supabase
            .from('inventories')
            .select('laboratory')
            .neq('laboratory', '_CONFIG_');

        if (branchName) {
            activeLabsQuery = activeLabsQuery.ilike('branch_name', branchName.trim());
        }

        const { data: activeLabsData, error: activeError } = await activeLabsQuery;

        if (activeError) {
            console.error("Error fetching active labs:", activeError);
        }

        // Normalize for the set
        const activeLabsSet = new Set((activeLabsData || []).map(row =>
            (row.laboratory || '').toUpperCase().trim()
        ));

        // 2. Fetch metadata
        let query = supabase
            .from('branch_laboratories')
            .select(`*`);

        if (branchName) {
            query = query.ilike('branch_name', branchName.trim());
        }

        const { data, error } = await query;

        if (error || !data) return [];

        // 3. Filter metadata by active labs to exclude GHOST records
        return data
            .filter((row: any) => activeLabsSet.has((row.laboratory || '').toUpperCase().trim()))
            .map((row: any) => {
                // Map DB status to UI Status
                let status: LaboratoryStatus = 'pendiente';
                if (row.status === 'completed') status = 'controlado';
                else if (row.status === 'in_progress') status = 'por_controlar';

                const mappedStats = {
                    labName: row.laboratory,
                    category: row.category,
                    status: status,
                    totalItems: row.total_items,
                    controlledItems: row.controlled_items,
                    progress: row.progress_percentage, // Retrieve persisted REAL progress

                    // Financials
                    negativeValue: row.negative_value,
                    positiveValue: row.positive_value,
                    netValue: row.net_value, // Map net_value to netValue
                    differenceValue: row.net_value, // Using net_value as differenceValue or sum of abs? usually net_value

                    // Units
                    totalSystemUnits: row.total_system_units,
                    negativeUnits: row.net_units < 0 ? row.net_units : 0,
                    positiveUnits: row.net_units > 0 ? row.net_units : 0,
                    netUnits: row.net_units
                };

                // Enterprise Validation
                const result = CyclicInventoryStatsSchema.safeParse(mappedStats);
                if (!result.success) {
                    console.error(`Validation Error for lab ${row.laboratory}:`, result.error.format());
                    return mappedStats as CyclicInventoryStats;
                }
                return result.data as CyclicInventoryStats;
            });
    },

    // Get Super-Lite summary for ALL branches (Admin View)
    // This is the fastest method, as it uses the pre-calculated branch_summaries table.
    getBranchesSummaryLite: async (): Promise<any[]> => {
        try {
            // 1. Fetch pre-calculated summaries
            const { data: summaries, error: sumError } = await (supabase as any)
                .from('branch_summaries')
                .select('*');

            if (sumError) throw sumError;

            // 2. Fetch Goals
            let labCounts: Record<string, number> = {};
            const { data: goalsData, error: goalsError } = await supabase
                .from('branch_goals')
                .select('branch_name, total_labs_goal');

            if (!goalsError && goalsData) {
                goalsData.forEach(g => {
                    labCounts[g.branch_name] = g.total_labs_goal;
                });
            } else {
                labCounts = await getAllBranchLabCounts();
            }

            // 3. Map to UI format
            return BRANCH_NAMES.map(branchName => {
                const rawSummary = summaries?.find(s =>
                    (s.branch_name || '').toLowerCase().trim() === branchName.toLowerCase().trim()
                );

                // Enterprise Validation of DB Record
                let summary = rawSummary;
                if (rawSummary) {
                    const result = BranchSummaryLiteSchema.safeParse({
                        branchName: rawSummary.branch_name,
                        inventoryUnits: rawSummary.inventory_units,
                        differenceUnits: rawSummary.difference_units,
                        adjustmentsValue: rawSummary.adjustments_value,
                        controlledLabsCount: rawSummary.controlled_labs_count,
                        updatedAt: rawSummary.updated_at
                    });
                    if (result.success) {
                        summary = result.data;
                    } else {
                        console.error(`Validation Error for branch ${branchName}:`, result.error.format());
                    }
                }

                const totalLabsGoal = labCounts[branchName] || 0;
                const controlledCount = summary?.controlledLabsCount || 0;
                const progress = totalLabsGoal > 0 ? Number(((controlledCount / totalLabsGoal) * 100).toFixed(1)) : 0;

                let status = 'pendiente';
                if (controlledCount >= totalLabsGoal && totalLabsGoal > 0) status = 'controlado';
                else if (controlledCount > 0) status = 'por_controlar';

                return {
                    branchName,
                    deploymentDate: '01/12/2025',
                    cyclicRound: 1,
                    monthlyGoal: totalLabsGoal,
                    elapsedDays: 12,
                    progress: progress,
                    inventoryUnits: summary?.inventoryUnits || 0,
                    differenceUnits: summary?.differenceUnits || 0,
                    adjustmentsValue: Math.round((summary?.adjustmentsValue || 0) * 100) / 100,
                    status: status,
                    lastUpdated: summary?.updatedAt
                };
            }).sort((a, b) => b.progress - a.progress);

        } catch (error) {
            console.error("Error fetching Lite summary:", error);
            return [];
        }
    },



    // Get summary for ALL branches (Admin View)
    getBranchesSummary: async (): Promise<any[]> => {
        // 1. Fetch metadata for ALL metrics with pagination
        // Total metadata should be a few thousand rows (fast), unlike inventories (millions)
        let allMetaData: any[] = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        let hasMore = true;

        try {
            while (hasMore) {
                const { data, error } = await supabase
                    .from('branch_laboratories')
                    .select('*')
                    .range(from, from + PAGE_SIZE - 1);

                if (error) throw error;
                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allMetaData = [...allMetaData, ...data];
                    if (data.length < PAGE_SIZE) {
                        hasMore = false;
                    } else {
                        from += PAGE_SIZE;
                    }
                }
            }
        } catch (metaError) {
            console.error("Error fetching branches metadata with pagination:", metaError);
        }

        // --- Fetch Goals ---
        let labCounts: Record<string, number> = {};
        const { data: goalsData, error: goalsError } = await supabase
            .from('branch_goals')
            .select('branch_name, total_labs_goal');

        if (!goalsError && goalsData && goalsData.length > 0) {
            goalsData.forEach(g => {
                labCounts[g.branch_name] = g.total_labs_goal;
            });
        } else {
            labCounts = await getAllBranchLabCounts();
        }

        // --- Optimized Aggregation Logic ---
        const summarizedBranches = BRANCH_NAMES.map(branchName => {
            const cleanName = branchName.toLowerCase().trim();

            // Filter meta for this branch
            // We TRUST branch_laboratories now, as we added cleanup to delete/purge functions.
            // Also, we filter out records with total_items === 0 to avoid ghost data from empty labs.
            const branchMeta = allMetaData.filter(m => {
                const mBranch = (m.branch_name || '').toLowerCase().trim();
                return mBranch === cleanName && (m.total_items > 0);
            });

            let inventoryUnits = 0;
            let differenceUnits = 0;
            let adjustmentsValue = 0;
            const controlledLabs = new Set<string>();

            // Aggregate data from all rubros/categories found in the metadata
            branchMeta.forEach(m => {
                inventoryUnits += (m.total_system_units || 0);
                differenceUnits += (m.net_units || 0);
                adjustmentsValue += (m.net_value || 0);

                // Count lab as complete if ANY of its rubros is marked as completed/100%
                if (m.status === 'completed' || m.progress_percentage >= 100) {
                    controlledLabs.add(m.laboratory);
                }
            });

            const totalLabsGoal = labCounts[branchName] || 0;
            const controlledCount = controlledLabs.size;
            const progress = totalLabsGoal > 0 ? Number(((controlledCount / totalLabsGoal) * 100).toFixed(1)) : 0;

            let status = 'pendiente';
            if (controlledCount >= totalLabsGoal && totalLabsGoal > 0) status = 'controlado';
            else if (controlledCount > 0) status = 'por_controlar';

            return {
                branchName,
                deploymentDate: '01/12/2025',
                cyclicRound: 1,
                monthlyGoal: totalLabsGoal,
                elapsedDays: 12,
                progress: progress,
                inventoryUnits: inventoryUnits,
                differenceUnits: differenceUnits,
                adjustmentsValue: Math.round(adjustmentsValue * 100) / 100,
                status: status
            };
        });

        return summarizedBranches.sort((a, b) => b.progress - a.progress);
    },



    // Configuration System
    getBranchConfig: async (branchName: string): Promise<{ days: number, startDate: string | null }> => {
        const cleanBranch = normalizeString(branchName);
        const { data } = await supabase
            .from('inventories')
            .select('ean, quantity')
            .eq('branch_name', cleanBranch)
            .eq('laboratory', '_CONFIG_');

        if (!data || (data as any).length === 0) return { days: 0, startDate: null };

        const configData = data as any[];
        const daysRecord = configData.find(r => r.ean === 'CONFIG_DAYS');
        const startDateRecord = configData.find(r => r.ean === 'CONFIG_START_DATE');

        // If it's the old format (only one record with ean 'CONFIG_DAYS' or generic)
        const days = daysRecord ? daysRecord.quantity : (configData[0]?.ean === 'CONFIG_DAYS' ? configData[0].quantity : 0);

        let startDate = null;
        if (startDateRecord && startDateRecord.quantity) {
            // Convert back to ms (stored as seconds to fit in 32-bit integer)
            startDate = new Date(startDateRecord.quantity * 1000).toISOString();
        }

        return { days, startDate };
    },

    saveBranchConfig: async (branchName: string, days: number, startDate?: string): Promise<void> => {
        try {
            await import('./preCountDB').then(m => m.ensureConfigProduct());

            // Convert date to seconds
            const seconds = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : null;

            // Use the NEW ROBUST RPC to avoid 409 Conflicts and handle normalization on the server
            const { error } = await (supabase as any).rpc('save_branch_config', {
                p_branch_name: branchName,
                p_days: days,
                p_start_date_seconds: seconds
            });

            if (error) {
                console.error("Error calling save_branch_config RPC:", error);
                throw error;
            }
        } catch (e) {
            console.error("Error in saveBranchConfig:", e);
            throw e;
        }
    },

    // Lock System
    getBranchLockStatus: async (branchName: string): Promise<boolean> => {
        const cleanBranch = normalizeString(branchName);
        const { data } = await supabase
            .from('inventories')
            .select('quantity')
            .eq('branch_name', cleanBranch)
            .eq('laboratory', '_CONFIG_')
            .eq('ean', 'CONFIG_LOCK')
            .maybeSingle();

        // If no lock record exists, branch is unlocked (0 or null = unlocked, 1 = locked)
        return data?.quantity === 1;
    },

    toggleBranchLock: async (branchName: string, isLocked: boolean): Promise<void> => {
        try {
            const { error } = await (supabase as any).rpc('toggle_branch_lock', {
                p_branch_name: branchName,
                p_is_locked: isLocked
            });

            if (error) {
                console.error('Error calling toggle_branch_lock RPC:', error);
                throw error;
            }
        } catch (e) {
            console.error('Error in toggleBranchLock:', e);
            throw e;
        }
    },

    isInventoryLocked: async (branchName: string, assignedDays: number, startDate: string | null): Promise<{ isLocked: boolean, reason: 'manual' | 'deadline' | null }> => {
        // Check manual lock first
        const manuallyLocked = await cyclicInventoryService.getBranchLockStatus(branchName);
        if (manuallyLocked) {
            return { isLocked: true, reason: 'manual' };
        }

        // Check automatic lock (deadline expired)
        if (startDate && assignedDays > 0) {
            const start = new Date(startDate);
            const today = new Date();
            const diffTime = today.getTime() - start.getTime();
            const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            const daysRemaining = Math.max(0, assignedDays - daysElapsed);

            if (daysRemaining <= 0) {
                return { isLocked: true, reason: 'deadline' };
            }
        }

        return { isLocked: false, reason: null };
    },

    // History System
    saveAdjustmentHistory: async (
        branchName: string,
        labName: string,
        data: {
            adjustment_id_shortage: string;
            adjustment_id_surplus: string;
            shortage_value: number;
            surplus_value: number;
            total_units_adjusted: number;
            user_name?: string;
            user_id?: string; // New param
            // Optional: Pass full items snapshot if available
            items_snapshot?: CyclicItem[];
            category?: string;
        }
    ): Promise<void> => {
        try {
            // 1. Save to legacy adjustment table (for backward compat or simple history)
            const { error: error1 } = await supabase.from('inventory_adjustments').insert({
                branch_name: branchName,
                laboratory: labName,
                category: data.category ? normalizeString(data.category) : null, // Normalización
                adjustment_id_shortage: data.adjustment_id_shortage,
                adjustment_id_surplus: data.adjustment_id_surplus,
                shortage_value: data.shortage_value,
                surplus_value: data.surplus_value,
                total_units_adjusted: data.total_units_adjusted,
                user_name: data.user_name || 'Desconocido'
            } as any); // cast as any in case Typescript Definitions aren't updated in IDE yet

            if (error1) throw error1;

            // 2. Save to NEW Full Report Table (Immutable Snapshot)
            if (data.items_snapshot) {
                const financialSummary = {
                    net_value: data.adjustment_id_surplus ? data.surplus_value : -data.shortage_value, // Simplification
                    shortage_value: data.shortage_value,
                    surplus_value: data.surplus_value,
                    adjustment_ids: {
                        shortage: data.adjustment_id_shortage,
                        surplus: data.adjustment_id_surplus
                    }
                };

                const { error: error2 } = await supabase.from('inventory_reports').insert({
                    branch_name: branchName,
                    laboratory: labName,
                    category: data.category || null, // NEW: Save Category here too if column exists, otherwise it might be in snapshot_data
                    snapshot_data: data.items_snapshot, // Guarda todo el JSON
                    financial_summary: financialSummary,
                    user_name: data.user_name || 'Desconocido'
                } as any);

                if (error2) console.error("Error saving advanced report snapshot:", error2);
            }

            // 3. Audit Log
            try {
                await import('./auditService').then(({ auditService }) => {
                    auditService.logAction({
                        action: 'INVENTORY_ADJUSTMENT',
                        entityType: 'INVENTORY',
                        branchId: branchName,
                        userId: data.user_id, // Pass explicit ID
                        details: {
                            lab: labName,
                            netValue: data.surplus_value - data.shortage_value,
                            unitsAdjusted: data.total_units_adjusted
                        }
                    });
                });
            } catch (ignore) { }

        } catch (e) {
            console.error("Error saving history:", e);
            throw e;
        }
    },

    getAdjustmentHistory: async (branchName: string, labName: string): Promise<any[]> => {
        const { data, error } = await supabase
            .from('inventory_adjustments')
            .select('*')
            .eq('branch_name', branchName)
            .eq('laboratory', labName)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching history:", error);
            return [];
        }
        return data;
    },

    // Closure System (Snapshots for UI Visualization)
    saveCycleClosure: async (branchName: string, period: number, categories: { name: string, percentage: number }[]): Promise<void> => {
        try {
            await import('./preCountDB').then(m => m.ensureConfigProduct());

            const insertData = categories.map(cat => ({
                laboratory: '_CONFIG_',
                branch_name: branchName,
                ean: `CLOSURE_${period}_${cat.name.toUpperCase()}`,
                quantity: Math.round(cat.percentage),
                system_quantity: 0,
                status: 'pending' as const
            }));

            // Delete previous closures for this period and branch to avoid duplicates
            await supabase.from('inventories')
                .delete()
                .eq('branch_name', branchName)
                .eq('laboratory', '_CONFIG_')
                .ilike('ean', `CLOSURE_${period}_%`);

            const { error } = await supabase.from('inventories').insert(insertData);
            if (error) throw error;

            // Audit
            try {
                await import('./auditService').then(({ auditService }) => {
                    auditService.logAction({
                        action: 'CYCLE_CLOSURE',
                        entityType: 'SYSTEM',
                        branchId: branchName,
                        details: { period, categories }
                    });
                });
            } catch (ignore) { }

        } catch (e) {
            console.error(`Error saving closure for period ${period}:`, e);
            throw e;
        }
    },

    getCycleClosures: async (branchName: string, period: number = 1): Promise<Record<string, number>> => {
        const { data, error } = await supabase
            .from('inventories')
            .select('ean, quantity')
            .eq('branch_name', branchName.trim())
            .eq('laboratory', '_CONFIG_')
            .ilike('ean', `CLOSURE_${period}_%`);

        if (error || !data) return {};

        const result: Record<string, number> = {};
        data.forEach((row: any) => {
            const catName = row.ean.replace(`CLOSURE_${period}_`, '');
            result[catName] = row.quantity;
        });
        return result;
    },

    // Migration Tool
    migrateGoalsFromExcel: async (): Promise<void> => {
        try {
            console.log("Starting migration...");
            const counts = await getAllBranchLabCounts();
            const updates = Object.entries(counts).map(([branch, count]) => ({
                branch_name: branch,
                total_labs_goal: count,
                updated_at: new Date().toISOString()
            }));

            if (updates.length > 0) {
                // @ts-ignore
                const { error } = await supabase.from('branch_goals').upsert(updates, { onConflict: 'branch_name' });
                if (error) throw error;
                console.log(`Migrated ${updates.length} branch goals to Supabase.`);
            }
        } catch (error) {
            console.error("Migration failed:", error);
            throw error;
        }
    },

    /**
     * Purga TODO el avance de inventarios, metadatos y ajustes de una sucursal.
     * Acción crítica para administradores.
     */
    purgeBranchProgress: async (branchName: string): Promise<void> => {
        try {
            const cleanName = branchName.trim();

            // 1. Inventories
            await supabase.from('inventories')
                .delete()
                .ilike('branch_name', cleanName)
                .neq('laboratory', '_CONFIG_');

            // 2. Adjustments
            await supabase.from('inventory_adjustments')
                .delete()
                .ilike('branch_name', cleanName);

            // 3. Metadata (branch_laboratories)
            await supabase.from('branch_laboratories')
                .delete()
                .ilike('branch_name', cleanName);

            // 4. Reports
            await supabase.from('inventory_reports')
                .delete()
                .ilike('branch_name', cleanName);

            console.log(`Purga completa para sucursal: ${branchName}`);
        } catch (error) {
            console.error("Error en purgeBranchProgress:", error);
            throw error;
        }
    },

    // Get Super-Lite summary for a SINGLE branch
    getBranchSummaryLite: async (branchName: string): Promise<any | null> => {
        try {
            const { data, error } = await (supabase as any)
                .from('branch_summaries')
                .select('*')
                .ilike('branch_name', branchName.trim())
                .single();

            if (error) return null;
            return data;
        } catch (error) {
            return null;
        }
    }
};

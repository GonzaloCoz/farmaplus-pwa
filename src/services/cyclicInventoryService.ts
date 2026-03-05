
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
    shortageId?: string;
    surplusId?: string;
}

export const cyclicInventoryService = {
    getLabInventory: async (branchName: string, labName: string): Promise<CyclicItem[]> => {
        try {
            const cleanBranch = normalizeString(branchName);
            const { data, error } = await supabase
                .from('inventories')
                .select(`
                    id,
                    ean,
                    quantity,
                    system_quantity,
                    status,
                    was_readjusted,
                    category,
                    adjustment_id_shortage,
                    adjustment_id_surplus,
                    updated_at,
                    products (
                        name,
                        cost,
                        category
                    )
                `)
                .eq('branch_name', cleanBranch)
                .ilike('laboratory', normalizeString(labName))
                .order('name', { foreignTable: 'products', ascending: true }); // Order by product name correctly

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
                    updatedAt: item.updated_at,
                    shortageId: item.adjustment_id_shortage,
                    surplusId: item.adjustment_id_surplus
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
                wasReadjusted: item.wasReadjusted || false,
                shortageId: item.shortageId,
                surplusId: item.surplusId
            }));

            // Call the database function (RPC V2)
            // This handles BOTH product creation/update and inventory upsert atomically
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any).rpc('save_cyclic_inventory_v2', {
                p_branch_name: normalizeString(branchName),
                p_laboratory: normalizeString(labName),
                p_items: rpcItems as any
            });

            if (error) {
                console.error('Error calling save_cyclic_inventory_v2 RPC:', error);
                throw error;
            }

            // Update metadata table for real-time monitoring
            await cyclicInventoryService.updateLabMetadata(branchName, labName, items);
            // Congelar progreso real desde DB (evita 100% fantasma)
            await cyclicInventoryService.recomputeLabProgress(branchName, labName);

        } catch (e) {
            console.error("Error saving inventory:", e);
            throw e;
        }
    },

    // Variante para finalizar: Invoca al Motor Ferrari (finalize_cyclic_inventory)
    saveInventoryForFinalize: async (
        branchName: string,
        labName: string,
        items: CyclicItem[],
        userId: string,
        shortageId: string | null,
        surplusId: string | null
    ) => {
        try {
            // "El Snap": Finalización atómica en base de datos.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any).rpc('finalize_cyclic_inventory', {
                p_branch_name: normalizeString(branchName),
                p_laboratory: normalizeString(labName),
                p_shortage_id: shortageId,
                p_surplus_id: surplusId,
                p_user_id: userId
            });

            if (error) {
                console.error('Error calling finalize_cyclic_inventory RPC:', error);
                throw error;
            }

            // Ya no es necesario re-computar aquí en el frontend porque el RPC `finalize_cyclic_inventory`
            // hace el PERFORM `recompute_lab_progress` internamente en la DB.

        } catch (e) {
            console.error("Error saving inventory (finalize):", e);
            throw e;
        }
    },

    // Delete inventory (Reiniciar) - Usa RPC para garantizar borrado total (ajustados incluidos)
    deleteInventory: async (branchName: string, labName: string) => {
        const { error } = await (supabase as any).rpc('purge_lab_inventory', {
            p_branch_name: normalizeString(branchName),
            p_laboratory: normalizeString(labName)
        });
        if (error) {
            console.error("Error purging lab inventory:", JSON.stringify(error, null, 2));
            throw error;
        }
    },

    // Purga masiva de TODO el sistema (Admin gcoz only)
    purgeAllInventoryData: async () => {
        const { error } = await (supabase as any).rpc('purge_all_inventory_data');
        if (error) {
            console.error("Error in global purge:", error);
            throw error;
        }
    },

    // Delete adjustment history (ya incluido en purge_lab_inventory RPC; mantener por compatibilidad)
    deleteAdjustmentHistory: async (branchName: string, labName: string) => {
        const { error } = await supabase.from('inventory_adjustments')
            .delete()
            .ilike('branch_name', branchName.trim())
            .ilike('laboratory', labName.trim());

        if (error) {
            console.error("Error deleting adjustment history:", error);
            throw error;
        }
    },

    /**
     * Corrige el progreso en branch_laboratories DESPUÉS de finalizar.
     *
     * Por qué se necesita: `saveInventory` → `updateLabMetadata` sobreescribe `total_items`
     * con sólo la cantidad de items ajustados (denominador = numerador = 100%).
     *
     * Este método usa:
     *   - masterTotal: el total REAL antes de que se borraran los pendientes (leído ANTES de saveInventory)
     *   - dbAdjustedCount: cuenta TODOS los ajustados acumulados para este branch+lab en Supabase
     *
     * El avance es INDEPENDIENTE por sucursal (filtro por branch_name + laboratory).
     */
    correctProgressAfterFinalize: async (
        branchName: string,
        labName: string,
        masterTotal: number   // Total leído de DB ANTES de que updateLabMetadata lo pise
    ): Promise<void> => {
        try {
            if (masterTotal === 0) return;

            // 1. Contar TODOS los items ajustados acumulados en Supabase para este branch+lab
            //    (incluye ajustes de sesiones anteriores, no sólo el batch actual)
            const { count: dbAdjustedCount, error: countError } = await supabase
                .from('inventories')
                .select('*', { count: 'exact', head: true })
                .ilike('branch_name', branchName.trim())
                .eq('laboratory', labName)
                .eq('status', 'adjusted');

            if (countError) {
                console.error('[Progress] Error counting adjusted items:', countError);
            }

            const cumulativeAdjusted = dbAdjustedCount || 0;

            // 2. Calcular el % real acumulado
            const realProgress = Math.min(
                100,
                Number(((cumulativeAdjusted / masterTotal) * 100).toFixed(1))
            );

            // Status real: completed solo si llegamos genuinamente al 100%
            const realStatus = realProgress >= 100 ? 'completed' : 'in_progress';

            // 3. Persistir en branch_laboratories con el denominador correcto
            const { error } = await supabase
                .from('branch_laboratories')
                .update({
                    total_items: masterTotal,
                    controlled_items: cumulativeAdjusted,
                    progress_percentage: realProgress,  // % real (nunca 100% falso)
                    status: realStatus
                })
                .eq('branch_name', normalizeString(branchName))
                .eq('laboratory', normalizeString(labName));

            if (error) {
                console.error('[Progress] Error persisting real progress:', error);
            } else {
                console.log(`[Progress] ${labName} (${branchName}): ${realProgress}% (${cumulativeAdjusted}/${masterTotal})`);
            }
        } catch (e) {
            console.error('[Progress] Unexpected error in correctProgressAfterFinalize:', e);
        }
    },

    /**
     * Recalcula el progreso desde inventarios (fuente de verdad en DB).
     * Evita el 100% falso cuando hay pendientes descartados al finalizar.
     * Requiere que exista la función SQL recompute_lab_progress en Supabase.
     */
    recomputeLabProgress: async (branchName: string, labName: string): Promise<void> => {
        try {
            const { error } = await (supabase as any).rpc('recompute_lab_progress', {
                p_branch_name: normalizeString(branchName),
                p_laboratory: normalizeString(labName)
            });
            if (error) throw error;
        } catch (error) {
            console.error('Error recomputing lab progress:', error);
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
     * Usa RPC para purga garantizada, luego guarda los nuevos items.
     * Evita residuos de ajustados y rubros fantasmas.
     */
    purgeAndSaveLabInventory: async (branchName: string, labName: string, items: CyclicItem[]): Promise<void> => {
        try {
            const cleanBranch = normalizeString(branchName);
            const cleanLab = normalizeString(labName);

            // 1. Purga SELECTIVA: Borrar todo EXCEPTO los ya ajustados
            // Esto permite que el nuevo Excel rellene los huecos sin pisar lo ya hecho.
            await supabase.from('inventories')
                .delete()
                .eq('branch_name', cleanBranch)
                .eq('laboratory', cleanLab)
                .neq('status', 'adjusted');

            if (items.length > 0) {
                await cyclicInventoryService.saveInventory(branchName, labName, items);
            }

            console.log(`Ironclad Sync completado para ${labName}: ${items.length} items.`);
        } catch (error) {
            console.error("Error in purgeAndSaveLabInventory:", error);
            throw error;
        }
    },

    // Update laboratory metadata for real-time monitoring
    // totalDenominator: cuando se finaliza con pendientes, items solo tiene controlados+ajustados.
    // Pasar el total real para evitar 100% falso.
    updateLabMetadata: async (
        branchName: string,
        labName: string,
        items?: CyclicItem[],
        totalDenominator?: number
    ): Promise<void> => {
        const cleanBranch = normalizeString(branchName);
        const cleanLab = normalizeString(labName);
        try {
            // Re-fetch ALL items from DB to ensure metadata reflects truth (including previously adjusted items)
            // If items are passed, we could use them, but fetching from DB is safer for "Ironclad Sync"
            const dbItems = await cyclicInventoryService.getLabInventory(branchName, labName);
            const itemsToProcess = dbItems.length > 0 ? dbItems : (items || []);

            if (itemsToProcess.length === 0 && !totalDenominator) return;

            // Group items by category to split metadata records
            const grouped: Record<string, CyclicItem[]> = {};
            itemsToProcess.forEach(item => {
                const cat = normalizeString(item.category || 'Varios');
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
            });

            // --- GLOBAL PROGRESS CALCULATION ---
            const globalProcessed = items.filter(i => i.status === 'controlled' || i.status === 'adjusted').length;
            const globalTotal = totalDenominator ?? items.length; // totalDenominator evita 100% falso al finalizar

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

                // Upsert to metadata table with composite key (Branch + Lab + Category)
                return supabase
                    .from('branch_laboratories')
                    .upsert({
                        branch_name: cleanBranch,
                        laboratory: cleanLab,
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
                        status: globalProgress >= 100 ? 'completed' : globalProgress > 0 ? 'in_progress' : 'pending'
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
        if (branchName && labName && category) {
            const { data, error } = await supabase
                .from('branch_laboratories')
                .select('*')
                .eq('branch_name', normalizeString(branchName))
                .eq('laboratory', normalizeString(labName))
                .eq('category', normalizeString(category))
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
        }
    },

    // Get all inventories (aggregated from branch_laboratories metadata)
    getAllCyclicInventories: async (branchName?: string): Promise<CyclicInventoryStats[]> => {
        // Fetch metadata from branch_laboratories.
        // Note: We no longer filter by "active" inventories here because labs that were
        // reset/finalized should still appear in the list as "pendiente". The source of
        // truth for the master lab list is branch_laboratories, which is now reset (not deleted)
        // when a lab is cleared. This fixes the bug where labs disappeared after reset/finalize.
        let query = supabase
            .from('branch_laboratories')
            .select(`*`);

        if (branchName) {
            query = query.eq('branch_name', normalizeString(branchName));
        }

        const { data, error } = await query;

        if (error || !data) return [];

        return data
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

            // 3. Fetch Configs for Start Date and Days
            const { data: configData } = await supabase
                .from('inventories')
                .select('branch_name, ean, quantity')
                .eq('laboratory', '_CONFIG_')
                .in('ean', ['CONFIG_START_DATE', 'CONFIG_DAYS']);

            const branchConfigs: Record<string, { startDate: string | null, days: number }> = {};
            if (configData) {
                configData.forEach(c => {
                    const normalized = normalizeString(c.branch_name || '');
                    if (!branchConfigs[normalized]) {
                        branchConfigs[normalized] = { startDate: null, days: 0 };
                    }
                    if (c.ean === 'CONFIG_START_DATE') {
                        branchConfigs[normalized].startDate = new Date(c.quantity * 1000).toISOString();
                    } else if (c.ean === 'CONFIG_DAYS') {
                        branchConfigs[normalized].days = c.quantity;
                    }
                });
            }

            // 4. Map to UI format
            return BRANCH_NAMES.map(branchName => {
                const normalizedSearch = normalizeString(branchName);
                const rawSummary = summaries?.find(s =>
                    normalizeString(s.branch_name || '') === normalizedSearch
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

                const cleanName = branchName.toLowerCase().trim();

                let status = 'pendiente';
                if (controlledCount >= totalLabsGoal && totalLabsGoal > 0) status = 'controlado';
                else if (controlledCount > 0) status = 'por_controlar';

                // Dynamic date calculation
                const config = branchConfigs[normalizeString(branchName)] || { startDate: null, days: 0 };
                const startDateIso = config.startDate;
                const assignedDays = config.days;
                const deploymentDate = startDateIso
                    ? new Date(startDateIso).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        timeZone: 'UTC'
                    })
                    : 'sin fecha asignada';

                let elapsedDays = 0;
                let remainingDays = 0;
                if (startDateIso) {
                    const start = new Date(startDateIso);
                    const today = new Date();
                    const diffTime = today.getTime() - start.getTime();
                    elapsedDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                    remainingDays = Math.max(0, assignedDays - elapsedDays);
                } else if (assignedDays > 0) {
                    // If no start date but has assigned days, count all as remaining? 
                    // Or 0? User wants "Pte / Asig". If not started, Pte = Asig.
                    remainingDays = assignedDays;
                }

                return {
                    branchName,
                    deploymentDate,
                    assignedDays: Number(assignedDays) || 0,
                    remainingDays: Number(remainingDays) || 0,
                    cyclicRound: 1,
                    monthlyGoal: totalLabsGoal,
                    elapsedDays,
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






    // Configuration System
    getBranchConfig: async (branchName: string): Promise<{ days: number, startDate: string | null }> => {
        const cleanBranch = normalizeString(branchName);
        const { data, error } = await supabase
            .from('inventories')
            .select('ean, quantity')
            .eq('branch_name', cleanBranch)
            .eq('laboratory', '_CONFIG_');

        if (error || !data || data.length === 0) return { days: 0, startDate: null };

        const configData = data as any[];
        const daysRecord = configData.find(r => r.ean === 'CONFIG_DAYS');
        const startDateRecord = configData.find(r => r.ean === 'CONFIG_START_DATE');

        const days = Number(daysRecord?.quantity || 0);

        let startDate = null;
        if (startDateRecord && startDateRecord.quantity) {
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

    saveBulkBranchConfig: async (branchNames: string[], days: number, startDate?: string): Promise<void> => {
        try {
            await import('./preCountDB').then(m => m.ensureConfigProduct());

            // Convert date to seconds
            const seconds = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : null;

            const { error } = await (supabase as any).rpc('save_bulk_branch_config', {
                p_branch_names: branchNames,
                p_days: days,
                p_start_date_seconds: seconds
            });

            if (error) {
                console.error("Error calling save_bulk_branch_config RPC:", error);
                throw error;
            }
        } catch (e) {
            console.error("Error in saveBulkBranchConfig:", e);
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
                branch_name: normalizeString(branchName),
                laboratory: normalizeString(labName),
                category: data.category ? normalizeString(data.category) : null,
                adjustment_id_shortage: data.adjustment_id_shortage,
                adjustment_id_surplus: data.adjustment_id_surplus,
                shortage_value: data.shortage_value,
                surplus_value: data.surplus_value,
                total_units_adjusted: data.total_units_adjusted,
                user_name: data.user_name || 'Desconocido'
            } as any);

            if (error1) throw error1;

            // 2. SAP-Style Ledger Recording (Transactional Audit Trail)
            // Create a professional header and detailed line items
            if (data.items_snapshot && data.items_snapshot.length > 0) {
                // Filter items that were actually adjusted in this session
                const adjustedItems = data.items_snapshot.filter(item =>
                    item.status === 'adjusted' &&
                    (item.shortageId === data.adjustment_id_shortage ||
                        item.surplusId === data.adjustment_id_surplus)
                );

                if (adjustedItems.length > 0) {
                    const { data: ledgerHeader, error: ledgerError } = await supabase
                        .from('inventory_ledger')
                        .insert({
                            branch_name: normalizeString(branchName),
                            laboratory: normalizeString(labName),
                            category: data.category || 'Varios',
                            user_id: data.user_id,
                            user_name: data.user_name || 'Desconocido',
                            adjustment_id_shortage: data.adjustment_id_shortage,
                            adjustment_id_surplus: data.adjustment_id_surplus,
                            total_shortage_value: data.shortage_value,
                            total_surplus_value: data.surplus_value,
                            total_net_value: data.surplus_value - data.shortage_value,
                            total_items_adjusted: adjustedItems.length
                        })
                        .select()
                        .single();

                    if (!ledgerError && ledgerHeader) {
                        const ledgerItems = adjustedItems.map(item => ({
                            ledger_id: ledgerHeader.id,
                            ean: item.ean,
                            product_name: item.name,
                            category: item.category || 'Varios',
                            system_quantity: item.systemQuantity,
                            counted_quantity: item.countedQuantity,
                            difference: item.countedQuantity - item.systemQuantity,
                            unit_cost: item.cost,
                            total_diff_value: (item.countedQuantity - item.systemQuantity) * item.cost
                        }));

                        const { error: itemsError } = await supabase
                            .from('inventory_ledger_items')
                            .insert(ledgerItems);

                        if (itemsError) console.error("Error creating Ledger items:", itemsError);
                    } else {
                        console.error("Error creating Ledger header:", ledgerError);
                    }
                }
            }

            // 3. Save to Full Report Table (Immutable Snapshot - legacy support)
            if (data.items_snapshot) {
                const financialSummary = {
                    net_value: data.surplus_value - data.shortage_value,
                    shortage_value: data.shortage_value,
                    surplus_value: data.surplus_value,
                    adjustment_ids: {
                        shortage: data.adjustment_id_shortage,
                        surplus: data.adjustment_id_surplus
                    }
                };

                const { error: error2 } = await supabase.from('inventory_reports').insert({
                    branch_name: normalizeString(branchName),
                    laboratory: normalizeString(labName),
                    category: data.category || null,
                    snapshot_data: data.items_snapshot,
                    financial_summary: financialSummary,
                    user_name: data.user_name || 'Desconocido'
                } as any);

                if (error2) console.error("Error saving advanced report snapshot:", error2);
            }

            // 4. Audit Log
            try {
                await import('./auditService').then(({ auditService }) => {
                    auditService.logAction({
                        action: 'INVENTORY_ADJUSTMENT',
                        entityType: 'INVENTORY',
                        branchId: branchName,
                        userId: data.user_id,
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
        // Try to fetch from professional SAP-style Ledger first
        const { data: ledgerData, error: ledgerError } = await supabase
            .from('inventory_ledger')
            .select('*')
            .eq('branch_name', normalizeString(branchName))
            .eq('laboratory', normalizeString(labName))
            .order('created_at', { ascending: false });

        if (!ledgerError && ledgerData && ledgerData.length > 0) {
            return ledgerData;
        }

        // Fallback to legacy inventory_adjustments for old data
        const { data, error } = await supabase
            .from('inventory_adjustments')
            .select('*')
            .eq('branch_name', normalizeString(branchName))
            .eq('laboratory', normalizeString(labName))
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
                branch_name: normalizeString(branchName),
                ean: `CLOSURE_${period}_${cat.name.toUpperCase()}`,
                quantity: Math.round(cat.percentage),
                system_quantity: 0,
                status: 'pending' as const
            }));

            // Delete previous closures for this period and branch to avoid duplicates
            await supabase.from('inventories')
                .delete()
                .eq('branch_name', normalizeString(branchName))
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
            .eq('branch_name', normalizeString(branchName))
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
            const cleanName = normalizeString(branchName);

            // 1. Inventories
            await supabase.from('inventories')
                .delete()
                .eq('branch_name', cleanName)
                .neq('laboratory', '_CONFIG_');

            // 2. Adjustments (Legacy)
            await supabase.from('inventory_adjustments')
                .delete()
                .eq('branch_name', cleanName);

            // 3. Metadata (branch_laboratories)
            await supabase.from('branch_laboratories')
                .delete()
                .eq('branch_name', cleanName);

            // 4. Reports (Legacy)
            await supabase.from('inventory_reports')
                .delete()
                .eq('branch_name', cleanName);

            // 5. SAP Ledger (Headers and details will cascade delete if schema permits, 
            // but usually we want to keep the Ledger. If explicit branch purge is requested 
            // by admin, we might want to clean it too, but with caution.)
            // await supabase.from('inventory_ledger').delete().eq('branch_name', cleanName);

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
    },

    /**
     * Limpia la "Mesa de Trabajo" (inventories) tras finalizar,
     * pero PRESERVA los ajustados para que sigan visibles en su pestaña.
     */
    clearInventoryWorkspace: async (branchName: string, labName: string): Promise<void> => {
        try {
            const cleanBranch = normalizeString(branchName);
            const cleanLab = normalizeString(labName);
            await supabase.from('inventories')
                .delete()
                .eq('branch_name', cleanBranch)
                .eq('laboratory', cleanLab)
                .neq('laboratory', '_CONFIG_')
                .neq('status', 'adjusted'); // <--- SMART ARCHIVE: No borrar ajustados

            console.log(`Mesa de trabajo limpia (preservando ajustados) para ${labName} en ${branchName}`);
        } catch (error) {
            console.error("Error en clearInventoryWorkspace:", error);
            throw error;
        }
    }
};

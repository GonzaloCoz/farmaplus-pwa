
import { LaboratoryStatus } from "@/components/LaboratoryCard";
import { supabase } from "@/integrations/supabase/client";
import { getAllBranchLabCounts } from './preCountDB';
import { getProductCountByLab } from './productService';
import { Zonal } from "@/config/zonales";
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

    // Extra computed metrics
    adjustmentCount?: number;
    ira?: number;
    systemValue?: number;
    round?: number;
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
    readjustmentReason?: string;
    id_producto?: string;
}

export const cyclicInventoryService = {
    getLabInventory: async (branchName: string, labName: string, round?: number): Promise<CyclicItem[]> => {
        try {
            console.log(`[CyclicService] getLabInventory (v2 RPC) for ${labName} at ${branchName}, round: ${round}`);
            
            // Use the NEW ROBUST RPC for accent-insensitive and case-insensitive matching
            const { data, error } = await (supabase as any).rpc('get_lab_inventory_v2', {
                p_branch_name: branchName,
                p_laboratory: labName,
                p_round: round !== undefined ? round : null
            });

            if (error) {
                console.error(`Error loading inventory for ${labName}:`, error);
                return [];
            }

            console.log(`[CyclicService] Found ${data?.length || 0} rows in DB (v2)`);

            // Map RPC result to CyclicItem
            return data.map((item: any) => {
                 const mappedItem = {
                    id: item.id,
                    ean: item.ean,
                    name: item.product_name,
                    quantity: item.quantity,
                    systemQuantity: item.system_quantity,
                    countedQuantity: item.quantity,
                    status: item.status as any,
                    wasReadjusted: item.was_readjusted,
                    readjustmentReason: item.readjustment_reason,
                    category: item.category || 'Varios',
                    shortageId: item.adjustment_id_shortage,
                    surplusId: item.adjustment_id_surplus,
                    cost: item.product_cost || 0,
                    updatedAt: item.updated_at,
                    id_producto: item.id_producto || undefined
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
                readjustmentReason: item.readjustmentReason,
                shortageId: item.shortageId,
                surplusId: item.surplusId,
                id_producto: item.id_producto
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
        surplusId: string | null,
        branchId?: string
    ) => {
        try {
            // "El Snap": Finalización atómica en base de datos.
            // Validar que el userId sea un UUID válido para evitar error 400
            const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);

            // Obtener la ronda correspondiente al laboratorio/categoría actual
            let round = 1;
            try {
                const config = await cyclicInventoryService.getBranchConfig(branchName);
                const activeItems = items.filter(i => i.status === 'controlled' || i.status === 'adjusted');
                const cat = activeItems[0]?.category || 'GENERAL';
                const normCat = cat.toUpperCase();
                round = config.rounds?.[normCat] || config.rounds?.GENERAL || 1;
            } catch (err) {
                console.warn("No se pudo obtener la ronda del config, usando default 1:", err);
            }

            const plexId = shortageId && surplusId
                ? `${shortageId}, ${surplusId}`
                : (shortageId || surplusId || '');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any).rpc('finalize_cyclic_inventory', {
                p_branch_name: normalizeString(branchName),
                p_laboratory: normalizeString(labName),
                p_plex_id: plexId,
                p_user_id: isValidUUID ? userId : null,
                p_round: round
            });

            if (error) {
                console.error('Error calling finalize_cyclic_inventory RPC:', JSON.stringify(error, null, 2));
                throw error;
            }

            // Ya no es necesario re-computar aquí en el frontend porque el RPC `finalize_cyclic_inventory`
            // hace el PERFORM `recompute_lab_progress` internamente en la DB.

            // Cerrar/Eliminar sesiones de precount (Colector de Datos) abiertas para este sector
            if (branchId) {
                const { error: sessionError } = await (supabase as any)
                    .from('precount_sessions')
                    .delete()
                    .eq('branch_id', branchId)
                    .eq('sector', labName);
                
                if (sessionError) {
                    console.error('Error deleting precount sessions after finalize:', sessionError);
                } else {
                    console.log(`[CyclicService] Deleted open precount sessions for ${labName} at branch ${branchId}`);
                }
            }

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

        // Resetea automáticamente los metadatos de todas las categorías de este laboratorio a 0% y pendiente
        await cyclicInventoryService.updateLabMetadata(branchName, labName);
    },

    async adminPurgeLabInventory(branchName: string, labName: string, password: string, userId: string) {
        const { data, error } = await (supabase as any).rpc('admin_purge_lab_inventory_v1', {
            p_branch_name: normalizeString(branchName),
            p_lab_name: normalizeString(labName),
            p_password: password,
            p_user_id: userId
        });
        if (error) throw error;
        return data as { success: boolean, message: string, deleted_items?: number };
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
        masterTotal: number,   // Total leído de DB ANTES de que updateLabMetadata lo pise
        category?: string
    ): Promise<void> => {
        try {
            if (masterTotal === 0) return;

            // 1. Contar TODOS los items ajustados acumulados en Supabase para este branch+lab (+category si existe)
            let query = supabase
                .from('inventories')
                .select('*', { count: 'exact', head: true })
                .ilike('branch_name', branchName.trim())
                .eq('laboratory', labName)
                .eq('status', 'adjusted');

            if (category) {
                query = query.eq('category', category);
            }

            const { count: dbAdjustedCount, error: countError } = await query;

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
            let updateQuery = supabase
                .from('branch_laboratories')
                .update({
                    total_items: masterTotal,
                    controlled_items: cumulativeAdjusted,
                    progress_percentage: realProgress,  // % real (nunca 100% falso)
                    status: realStatus
                })
                .eq('branch_name', normalizeString(branchName))
                .eq('laboratory', normalizeString(labName));

            if (category) {
                updateQuery = updateQuery.eq('category', normalizeString(category));
            }

            const { error } = await updateQuery;

            if (error) {
                console.error('[Progress] Error persisting real progress:', error);
            } else {
                console.log(`[Progress] ${labName} (${category || 'ALL'}) (${branchName}): ${realProgress}% (${cumulativeAdjusted}/${masterTotal})`);
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
    recomputeLabProgress: async (branchName: string, labName: string, round?: number): Promise<void> => {
        try {
            await cyclicInventoryService.updateLabMetadata(branchName, labName);
        } catch (e) {
            console.error('[Progress] Error in recomputeLabProgress:', e);
        }
    },

    /**
     * Marks a laboratory as controlled in the branch_laboratories table.
     * Used by PreCount to sync its status with the global dashboard progress.
     */
    markLabAsControlled: async (branchName: string, labName: string): Promise<void> => {
        try {
            const cleanBranch = normalizeString(branchName);
            const cleanLab = normalizeString(labName);

            console.log(`[Sync] Marking ${cleanLab} as Controlled for branch ${cleanBranch}`);

            // 1. Update the status in branch_laboratories
            // Note: We set progress to 100 on the basis that PreCount finished the sector.
            const { error } = await supabase
                .from('branch_laboratories')
                .update({ 
                    status: 'completed',
                    progress_percentage: 100
                })
                .eq('branch_name', cleanBranch)
                .eq('laboratory', cleanLab);

            if (error) {
                console.error('[Sync] Error marking lab as controlled:', error);
                throw error;
            }
        } catch (error) {
            console.error('[Sync] Failed to mark lab as controlled:', error);
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

            // 1. Guardar/Actualizar (Upsert) los nuevos ítems
            // Ya no realizamos una purga destructiva (.delete().neq('status', 'adjusted'))
            // para permitir que el nuevo Excel sume productos sin borrar los anteriores
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

            // Fetch all assigned categories for this lab in branch_laboratories
            const { data: existingBranchLabs } = await (supabase as any)
                .from('branch_laboratories')
                .select('category')
                .or(`branch_name.eq.${cleanBranch},branch_name.eq.${branchName.trim()}`)
                .eq('laboratory', cleanLab);

            const assignedCategories = new Set<string>();
            existingBranchLabs?.forEach(l => {
                if (l.category) assignedCategories.add(normalizeString(l.category));
            });
            Object.keys(grouped).forEach(cat => assignedCategories.add(cat));

            // Obtener el config de la sucursal para resolver las rondas activas por categoría
            const config = await cyclicInventoryService.getBranchConfig(branchName);

            // Iterate ALL assigned categories and upsert their own stats (or reset if empty)
            const upsertPromises = Array.from(assignedCategories).map(async (category) => {
                const catItems = grouped[category] || [];
                const stats = cyclicInventoryService.calculateStats(catItems);

                const normCat = category.toUpperCase();
                const round = config.rounds?.[normCat] || config.rounds?.GENERAL || 1;

                // Count items by status
                const controlledItems = catItems.filter(i => i.status === 'controlled').length;
                const adjustedItems = catItems.filter(i => i.status === 'adjusted').length;
                const pendingItems = catItems.filter(i => i.status === 'pending').length;

                // Category-specific counts
                const totalInventoryItems = catItems.length;

                let catProgress = 0;
                if (totalInventoryItems > 0) {
                    catProgress = Number((((controlledItems + adjustedItems) / totalInventoryItems) * 100).toFixed(1));
                    if (catProgress > 100) catProgress = 100;
                }

                const catStatus = totalInventoryItems === 0 ? 'pending' : (catProgress >= 100 ? 'completed' : catProgress > 0 ? 'in_progress' : 'pending');

                // Upsert to metadata table with composite key (Branch + Lab + Category + Round)
                return supabase
                    .from('branch_laboratories')
                    .upsert({
                        branch_name: cleanBranch,
                        laboratory: cleanLab,
                        category: category,
                        round: round,
                        total_items: totalInventoryItems, // Correct Category Count
                        controlled_items: controlledItems + adjustedItems, // Correct Category Processed
                        adjusted_items: adjustedItems,
                        pending_items: pendingItems,
                        progress_percentage: catProgress, // % real por categoría (0% si no hay items)
                        total_system_units: stats.totalSystemUnits,
                        net_units: stats.netUnits,
                        net_value: stats.net,
                        negative_value: stats.negative,
                        positive_value: stats.positive,
                        negative_units: stats.negativeUnits,
                        positive_units: stats.positiveUnits,
                        status: catStatus
                    }, {
                        onConflict: 'branch_name,laboratory,category,round'
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

            // Include in financials ONLY if it's controlled or adjusted (user input)
            // ponytail: ignore pending items to prevent massive false shortages
            const diff = isControlled ? (item.countedQuantity - item.systemQuantity) : 0;

            if (diff !== 0) {
                const value = diff * item.cost;

                if (diff < 0) {
                    negative += value;
                    negativeUnits += diff;
                } else {
                    positive += value;
                    positiveUnits += diff;
                }
            }

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
    },    // Get all inventories (aggregated from branch_laboratories metadata)
    getAllCyclicInventories: async (branchName?: string): Promise<CyclicInventoryStats[]> => {
        // Fetch metadata from branch_laboratories.
        // Note: We no longer filter by "active" inventories here because labs that were
        // reset/finalized should still appear in the list as "pendiente". The source of
        // truth for the master lab list is branch_laboratories, which is now reset (not deleted)
        // when a lab is cleared. This fixes the bug where labs disappeared after reset/finalize.
        let allData: any[] = [];
        let page = 0;
        const limit = 1000;

        while (true) {
            let query = supabase.from('branch_laboratories').select('*');
            if (branchName) {
                const cleanBranch = normalizeString(branchName);
                query = query.or(`branch_name.eq.${cleanBranch},branch_name.eq.${branchName.trim()}`);
            }

            const { data, error } = await query.range(page * limit, (page + 1) * limit - 1);

            if (error) {
                console.error('Error fetching cyclic inventories:', error);
                return [];
            }
            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            if (data.length < limit) break;
            page++;
        }

        return allData
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
                    negativeUnits: row.negative_units || 0,
                    positiveUnits: row.positive_units || 0,
                    netUnits: row.net_units,
                    round: row.round || 1
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
    getBranchesSummaryLite: async (timeframe: string = 'all', showPrevious: boolean = false): Promise<any[]> => {
        try {
            const { data: dbBranches, error: branchesError } = await supabase
                .from('branches')
                .select('name');

            let branchNames: string[] = [];
            if (dbBranches && dbBranches.length > 0) {
                branchNames = dbBranches.map(b => b.name);
            } else {
                console.warn("[Monitor] Warning fetching branches list:", branchesError);
                const { data: labBranches } = await supabase.from('branch_laboratories').select('branch_name');
                if (labBranches && labBranches.length > 0) {
                    branchNames = Array.from(new Set(labBranches.map((b: any) => b.branch_name).filter(Boolean)));
                }
            }

            // 1. Fetch dynamic summaries
            let summaries: any[] = [];
            const { data: rpcSummaries, error: sumError } = await (supabase as any)
                .rpc('get_branch_monitor_summaries', {
                    p_timeframe: timeframe,
                    p_show_previous: showPrevious
                });

            if (sumError) {
                console.warn("[Monitor] Warning calling get_branch_monitor_summaries RPC:", sumError);
            } else if (rpcSummaries) {
                summaries = rpcSummaries;
            }

            // 3. Fetch Configs for Start Date, Days, and Rounds
            const { data: configData } = await supabase
                .from('inventories')
                .select('branch_name, ean, quantity, round')
                .eq('laboratory', '_CONFIG_')
                .or('ean.eq.CONFIG_DAYS,ean.eq.CONFIG_START_DATE,ean.like.CONFIG_ROUND%');

            const branchConfigs: Record<string, { startDate: string | null, days: number, rounds: Record<string, number> }> = {};
            if (configData) {
                // First pass: Resolve rounds for each branch
                configData.forEach(c => {
                    const normalized = normalizeString(c.branch_name || '');
                    if (!branchConfigs[normalized]) {
                        branchConfigs[normalized] = { startDate: null, days: 0, rounds: { GENERAL: 1 } };
                    }
                    if (c.ean && c.ean.startsWith('CONFIG_ROUND')) {
                        if (c.ean === 'CONFIG_ROUND') {
                            branchConfigs[normalized].rounds.GENERAL = c.quantity;
                        } else {
                            const cat = c.ean.replace('CONFIG_ROUND_', '').toUpperCase();
                            branchConfigs[normalized].rounds[cat] = c.quantity;
                        }
                    }
                });

                // Second pass: Load CONFIG_DAYS and CONFIG_START_DATE matching the target round
                configData.forEach(c => {
                    const normalized = normalizeString(c.branch_name || '');
                    const rounds = branchConfigs[normalized]?.rounds || { GENERAL: 1 };
                    const activeRound = rounds.GENERAL || 1;
                    const targetRound = showPrevious ? Math.max(1, activeRound - 1) : activeRound;

                    if (c.round === targetRound) {
                        if (c.ean === 'CONFIG_START_DATE') {
                            branchConfigs[normalized].startDate = new Date(c.quantity * 1000).toISOString();
                        } else if (c.ean === 'CONFIG_DAYS') {
                            branchConfigs[normalized].days = c.quantity;
                        }
                    }
                });
            }

            const finalResult = branchNames.map(branchName => {
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
                        activeLabsCount: rawSummary.active_labs_count,
                        totalLabsCount: rawSummary.total_labs_count,
                        totalControlledItems: rawSummary.total_controlled_items,
                        totalItemsSum: rawSummary.total_items_sum,
                        weightedProgressSum: rawSummary.weighted_progress_sum,
                        positiveDiffUnits: rawSummary.positive_diff_units || 0,
                        negativeDiffUnits: rawSummary.negative_diff_units || 0,
                        absoluteDeviationValue: rawSummary.absolute_deviation_value || 0,
                        updatedAt: rawSummary.updated_at
                    });
                    if (result.success) {
                        summary = result.data as any;
                    } else {
                        console.error(`Validation Error for branch ${branchName}:`, result.error.format());
                    }
                }

                const controlledLabsCount = summary?.controlledLabsCount || 0;
                const activeCount = summary?.activeLabsCount || 0;
                const totalLabsMaster = summary?.totalLabsCount || 0;

                // --- PROGRESS CALCULATION (COMPLETED LABS COVERAGE) ---
                // Matches CategoryProgressWidget.tsx logic for consistency
                let progress = 0;
                if (totalLabsMaster > 0) {
                    progress = Number(((controlledLabsCount / totalLabsMaster) * 100).toFixed(1));
                } else if (summary?.totalItemsSum > 0) {
                    // Fallback to item-based if no labs defined
                    progress = Number(((summary.totalControlledItems / summary.totalItemsSum) * 100).toFixed(1));
                }

                // Indicators of activity
                const hasActivity = activeCount > 0 ||
                    (summary?.differenceUnits !== 0 && summary?.differenceUnits !== undefined) ||
                    (summary?.inventoryUnits > 0);

                if (progress === 0 && hasActivity) {
                    progress = 0.1;
                }

                if (progress > 100) progress = 100;
                // -------------------------------------------------------

                let status = 'pendiente';
                // Finalized only if all labs in goal are finished
                if (controlledLabsCount >= totalLabsMaster && totalLabsMaster > 0) {
                    status = 'controlado';
                }
                // In Process if any lab is being worked on OR if there are already units/adjustments registered
                else if (controlledLabsCount > 0 || activeCount > 0 || (summary?.differenceUnits !== 0 && summary?.differenceUnits !== undefined) || (summary?.inventoryUnits > 0)) {
                    status = 'por_controlar';
                }

                // Dynamic date calculation
                const config = branchConfigs[normalizeString(branchName)] || { startDate: null, days: 0, rounds: {} };
                const startDateIso = config.startDate;
                const assignedDays = config.days;
                const deploymentDate = startDateIso
                    ? startDateIso.split('T')[0].split('-').reverse().slice(0, 2).join('/')
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

                const activeRound = config.rounds?.GENERAL || 1;
                const displayRound = showPrevious ? Math.max(1, activeRound - 1) : activeRound;
                const displayRounds: Record<string, number> = {};
                if (config.rounds) {
                    Object.entries(config.rounds).forEach(([key, val]) => {
                        displayRounds[key] = showPrevious ? Math.max(1, val - 1) : val;
                    });
                }

                return {
                    branchName,
                    deploymentDate,
                    assignedDays: Number(assignedDays) || 0,
                    remainingDays: Number(remainingDays) || 0,
                    cyclicRound: displayRound,
                    rounds: displayRounds,
                    monthlyGoal: totalLabsMaster, // Using Total Labs Count instead of Goal
                    elapsedDays,
                    progress: progress,
                    inventoryUnits: summary?.inventoryUnits || 0,
                    differenceUnits: summary?.differenceUnits || 0,
                    positiveDiffUnits: Number(rawSummary?.positive_diff_units || 0),
                    negativeDiffUnits: Number(rawSummary?.negative_diff_units || 0),
                    adjustmentsValue: Math.round((summary?.adjustmentsValue || 0) * 100) / 100,
                    absoluteDeviationValue: Math.round((summary?.absoluteDeviationValue || rawSummary?.absolute_deviation_value || 0) * 100) / 100,
                    status: status,
                    lastUpdated: summary?.updatedAt
                };
            }).sort((a, b) => b.progress - a.progress);

            console.log(`[Monitor] Returning ${finalResult.length} branches to UI.`);
            return finalResult;
        } catch (error) {
            console.error("Error fetching Lite summary:", error);
            return [];
        }
    },






    // Configuration System
    getBranchConfig: async (branchName: string): Promise<{ days: number, startDate: string | null, rounds?: Record<string, number> }> => {
        const cleanBranch = normalizeString(branchName);
        const { data, error } = await supabase
            .from('inventories')
            .select('branch_name, ean, quantity, round')
            .eq('laboratory', '_CONFIG_')
            .or('ean.eq.CONFIG_DAYS,ean.eq.CONFIG_START_DATE,ean.like.CONFIG_ROUND%');

        if (error || !data || data.length === 0) return { days: 0, startDate: null, rounds: {} };

        // Normalize and filter in JS to bypass any spacing/accent differences between DB and client
        const configData = (data as any[]).filter(r => normalizeString(r.branch_name || '') === cleanBranch);

        if (configData.length === 0) return { days: 0, startDate: null, rounds: {} };

        const rounds: Record<string, number> = {};
        // Default rounds to 1
        rounds['GENERAL'] = 1;

        configData.forEach(r => {
            if (r.ean && r.ean.startsWith('CONFIG_ROUND')) {
                if (r.ean === 'CONFIG_ROUND') {
                    rounds['GENERAL'] = Number(r.quantity || 1);
                } else {
                    const categoryName = r.ean.replace('CONFIG_ROUND_', '').toUpperCase();
                    rounds[categoryName] = Number(r.quantity || 1);
                }
            }
        });

        const activeRound = rounds['GENERAL'] || 1;
        
        // Find days config with active round, falling back to round 1 if not set
        let daysRecord = configData.find(r => r.ean === 'CONFIG_DAYS' && r.round === activeRound);
        if (!daysRecord && activeRound > 1) {
            daysRecord = configData.find(r => r.ean === 'CONFIG_DAYS' && r.round === 1);
        }

        // Find start date config with active round, falling back to round 1 if not set
        let startDateRecord = configData.find(r => r.ean === 'CONFIG_START_DATE' && r.round === activeRound);
        if (!startDateRecord && activeRound > 1) {
            startDateRecord = configData.find(r => r.ean === 'CONFIG_START_DATE' && r.round === 1);
        }

        const days = Number(daysRecord?.quantity || 0);

        let startDate = null;
        if (startDateRecord && startDateRecord.quantity) {
            startDate = new Date(startDateRecord.quantity * 1000).toISOString();
        }

        return { days, startDate, rounds };
    },

    resetCategoryRound: async (branchName: string, category: string, nextRound: number): Promise<void> => {
        try {
            const { error } = await (supabase as any).rpc('reset_category_round', {
                p_branch_name: branchName,
                p_category: category,
                p_next_round: nextRound
            });

            if (error) {
                console.error("Error calling reset_category_round RPC:", error);
                throw error;
            }
        } catch (error) {
            console.error("Error in resetCategoryRound:", error);
            throw error;
        }
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
            round?: number; // New param
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
                    ((data.adjustment_id_shortage && item.shortageId?.includes(data.adjustment_id_shortage)) ||
                        (data.adjustment_id_surplus && item.surplusId?.includes(data.adjustment_id_surplus)))
                );

                // Filter items that were physically counted (adjusted or controlled)
                const countedItems = data.items_snapshot.filter(item =>
                    item.status === 'adjusted' || item.status === 'controlled'
                );

                if (countedItems.length > 0) {
                    const totalCountedItems = countedItems.reduce((acc, item) => acc + (item.countedQuantity || 0), 0);

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
                            total_items_adjusted: adjustedItems.length,
                            total_counted_items: totalCountedItems,
                            round: data.round || 1
                        })
                        .select()
                        .single();

                    if (!ledgerError && ledgerHeader) {
                        // Insert only adjusted items into the ledger detail to avoid database bloat
                        const ledgerItems = adjustedItems.map(item => ({
                            ledger_id: ledgerHeader.id,
                            ean: item.ean,
                            product_name: item.name || 'Producto Desconocido',
                            category: item.category || 'Varios',
                            system_quantity: item.systemQuantity || 0,
                            counted_quantity: item.countedQuantity || 0,
                            difference: (item.countedQuantity || 0) - (item.systemQuantity || 0),
                            unit_cost: item.cost || 0,
                            total_diff_value: ((item.countedQuantity || 0) - (item.systemQuantity || 0)) * (item.cost || 0)
                        }));

                        if (ledgerItems.length > 0) {
                            const { error: itemsError } = await supabase
                                .from('inventory_ledger_items')
                                .insert(ledgerItems);

                            if (itemsError) console.error("Error creating Ledger items:", itemsError);
                        }
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

    getAdjustmentHistory: async (branchName: string, labName: string, limit: number = 50): Promise<any[]> => {
        // Try to fetch from professional SAP-style Ledger first
        const { data: ledgerData, error: ledgerError } = await supabase
            .from('inventory_ledger')
            .select(`
                *,
                inventory_ledger_items (
                    counted_quantity
                )
            `)
            .eq('branch_name', normalizeString(branchName))
            .eq('laboratory', normalizeString(labName))
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!ledgerError && ledgerData && ledgerData.length > 0) {
            // Normalize ledger field names to match the UI's expected schema
            return ledgerData.map((row: any) => {
                const items = row.inventory_ledger_items || [];
                const total_stock_counted = row.total_counted_items ?? items.reduce((sum: number, item: any) => sum + (item.counted_quantity || 0), 0);
                return {
                    ...row,
                    shortage_value: row.shortage_value ?? row.total_shortage_value ?? 0,
                    surplus_value: row.surplus_value ?? row.total_surplus_value ?? 0,
                    total_units_adjusted: row.total_units_adjusted ?? row.total_items_adjusted ?? 0,
                    total_stock_counted
                };
            });
        }

        // Fallback to legacy inventory_adjustments for old data
        const { data, error } = await supabase
            .from('inventory_adjustments')
            .select('*')
            .eq('branch_name', normalizeString(branchName))
            .eq('laboratory', normalizeString(labName))
            .order('created_at', { ascending: false })
            .limit(limit);

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

            // Upsert dummy products to satisfy foreign key constraint (inventories -> products)
            const dummyProducts = categories.map(cat => ({
                ean: `CLOSURE_${period}_${cat.name.toUpperCase()}`,
                name: `[SYSTEM] Closure P${period} - ${cat.name}`,
                laboratory: '_CONFIG_',
                cost: 0
            }));
            await supabase.from('products').upsert(dummyProducts, { onConflict: 'ean' });

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
    },

    /**
     * Registra un evento de escaneo en el sistema 24hs.
     * Permite auditoría en tiempo real de qué se está escaneando y por quién.
     */
    logScanEvent: async (branchName: string, labName: string, ean: string, userId?: string, userName?: string): Promise<void> => {
        try {
            await (supabase as any).from('scan_events').insert({
                branch_name: normalizeString(branchName),
                laboratory: normalizeString(labName),
                ean: ean,
                user_id: userId,
                user_name: userName || 'Desconocido',
                scanned_at: new Date().toISOString()
            });
        } catch (error) {
            // Silencioso para no bloquear la UI si el log falla
            console.warn("[ScanLog] Error logging event:", error);
        }
    },

    updateAdjustmentIds: async (
        branchName: string,
        labName: string,
        newShortageId: string,
        newSurplusId: string
    ): Promise<void> => {
        try {
            const cleanBranch = normalizeString(branchName);
            const cleanLab = normalizeString(labName);

            // 1. Update inventories items
            const { error: err1 } = await supabase
                .from('inventories')
                .update({
                    adjustment_id_shortage: newShortageId || null,
                    adjustment_id_surplus: newSurplusId || null
                } as any)
                .eq('branch_name', cleanBranch)
                .eq('laboratory', cleanLab)
                .eq('status', 'adjusted');

            if (err1) throw err1;

            // 2. Update inventory_adjustments
            const { error: err2 } = await supabase
                .from('inventory_adjustments')
                .update({
                    adjustment_id_shortage: newShortageId || null,
                    adjustment_id_surplus: newSurplusId || null
                } as any)
                .eq('branch_name', cleanBranch)
                .eq('laboratory', cleanLab);

            if (err2) throw err2;

            // 3. Update inventory_ledger
            const { error: err3 } = await supabase
                .from('inventory_ledger')
                .update({
                    adjustment_id_shortage: newShortageId || null,
                    adjustment_id_surplus: newSurplusId || null
                } as any)
                .eq('branch_name', cleanBranch)
                .eq('laboratory', cleanLab);

            if (err3) throw err3;

            console.log(`[CyclicService] Adjustment IDs updated successfully for ${labName} at ${branchName}`);
        } catch (error) {
            console.error("Error in updateAdjustmentIds:", error);
            throw error;
        }
    },

    updateSessionAdjustmentIds: async (
        branchName: string,
        labName: string,
        sessionId: string,
        newShortageId: string,
        newSurplusId: string,
        sessionCreatedAt: string
    ): Promise<void> => {
        try {
            const cleanBranch = normalizeString(branchName);
            const cleanLab = normalizeString(labName);

            console.log(`[CyclicService] Starting updateSessionAdjustmentIds for session: ${sessionId}`);

            // 1. Update inventory_ledger by ID (Standard Mode)
            const { data: ledgerUpdateData, error: ledgerErr } = await supabase
                .from('inventory_ledger')
                .update({
                    adjustment_id_shortage: newShortageId || null,
                    adjustment_id_surplus: newSurplusId || null
                } as any)
                .eq('id', sessionId)
                .select();

            if (ledgerErr) {
                console.warn("[CyclicService] ledger update error:", ledgerErr);
            } else {
                console.log(`[CyclicService] Ledger direct update completed. Rows affected: ${ledgerUpdateData?.length || 0}`);
            }

            // 2. Update inventory_adjustments directly by ID (Fallback Mode - where sessionId is the adjustment ID)
            const { data: adjDirectData, error: adjDirectErr } = await supabase
                .from('inventory_adjustments')
                .update({
                    adjustment_id_shortage: newShortageId || null,
                    adjustment_id_surplus: newSurplusId || null
                } as any)
                .eq('id', sessionId)
                .select();

            let adjustmentsUpdatedCount = adjDirectData?.length || 0;

            if (adjDirectErr) {
                console.warn("[CyclicService] inventory_adjustments direct ID update error:", adjDirectErr);
            } else {
                console.log(`[CyclicService] inventory_adjustments direct ID update completed. Rows affected: ${adjustmentsUpdatedCount}`);
            }

            // If direct ID update didn't find any row in inventory_adjustments, it means sessionId is the ledger ID.
            // In that case, we fall back to updating inventory_adjustments by created_at date range.
            if (adjustmentsUpdatedCount === 0) {
                console.log("[CyclicService] No adjustments updated by direct ID. Trying date-range matching...");
                const timeLimit = 60000; // Increase to 60 seconds for robustness
                const sessionDate = new Date(sessionCreatedAt);
                const minTime = new Date(sessionDate.getTime() - timeLimit).toISOString();
                const maxTime = new Date(sessionDate.getTime() + timeLimit).toISOString();

                const { data: adjData, error: selectErr } = await supabase
                    .from('inventory_adjustments')
                    .select('id')
                    .eq('branch_name', cleanBranch)
                    .eq('laboratory', cleanLab)
                    .gte('created_at', minTime)
                    .lte('created_at', maxTime);

                if (!selectErr && adjData && adjData.length > 0) {
                    const adjIds = adjData.map(a => a.id);
                    const { error: updateAdjErr } = await supabase
                        .from('inventory_adjustments')
                        .update({
                            adjustment_id_shortage: newShortageId || null,
                            adjustment_id_surplus: newSurplusId || null
                        } as any)
                        .in('id', adjIds);

                    if (updateAdjErr) {
                        console.error("Error updating inventory_adjustments by date-range:", updateAdjErr);
                    } else {
                        console.log(`[CyclicService] inventory_adjustments updated by date-range. Rows: ${adjIds.length}`);
                    }
                } else if (selectErr) {
                    console.error("Error selecting adjustments for date-range:", selectErr);
                }
            }

            // 3. Update inventories items
            // First try to fetch EANs from inventory_ledger_items
            const { data: itemsData, error: itemsErr } = await supabase
                .from('inventory_ledger_items')
                .select('ean')
                .eq('ledger_id', sessionId);

            let eans: string[] = [];
            if (!itemsErr && itemsData && itemsData.length > 0) {
                eans = itemsData.map(i => i.ean);
            }

            if (eans.length > 0) {
                // Update inventories status adjusted items matching those EANs
                const { error: invErr } = await supabase
                    .from('inventories')
                    .update({
                        adjustment_id_shortage: newShortageId || null,
                        adjustment_id_surplus: newSurplusId || null
                    } as any)
                    .eq('branch_name', cleanBranch)
                    .eq('laboratory', cleanLab)
                    .eq('status', 'adjusted')
                    .in('ean', eans);

                if (invErr) console.error("Error updating inventories items by EAN:", invErr);
            } else {
                // Fallback: If no EANs found in ledger (e.g. because ledger is empty in fallback mode),
                // we update ALL adjusted items in inventories for this lab. This is extremely safe because
                // only the active/recent adjusted session's items are kept in inventories anyway.
                console.log("[CyclicService] No EANs found in ledger. Falling back to updating all adjusted items in inventories...");
                const { error: invErr } = await supabase
                    .from('inventories')
                    .update({
                        adjustment_id_shortage: newShortageId || null,
                        adjustment_id_surplus: newSurplusId || null
                    } as any)
                    .eq('branch_name', cleanBranch)
                    .eq('laboratory', cleanLab)
                    .eq('status', 'adjusted');

                if (invErr) console.error("Error updating all adjusted inventories items:", invErr);
            }

            console.log(`[CyclicService] Session IDs updated successfully for session ${sessionId}`);
        } catch (error) {
            console.error("Error in updateSessionAdjustmentIds:", error);
            throw error;
        }
    },

    hideLaboratory: async (branchName: string, labName: string, isHidden: boolean): Promise<void> => {
        try {
            const cleanBranch = normalizeString(branchName);
            const cleanLabName = labName.trim().toUpperCase();
            const eanKey = `HIDDEN_LAB_${cleanLabName}`;

            if (isHidden) {
                // Upsert dummy product first to satisfy foreign key constraint on ean -> products
                const { error: prodError } = await supabase.from('products').upsert({
                    ean: eanKey,
                    name: `[SYSTEM] Hidden Lab - ${cleanLabName}`,
                    laboratory: '_CONFIG_',
                    cost: 0,
                    sale_price: 0,
                    stock: 0
                }, { onConflict: 'ean' });

                if (prodError) throw prodError;

                // Upsert inventories config
                const { error: invError } = await supabase.from('inventories').upsert({
                    branch_name: cleanBranch,
                    laboratory: '_CONFIG_',
                    ean: eanKey,
                    quantity: 1,
                    system_quantity: 0,
                    status: 'pending'
                }, { onConflict: 'branch_name,laboratory,ean' });

                if (invError) throw invError;
            } else {
                // Delete config from inventories
                const { error: delError } = await supabase.from('inventories')
                    .delete()
                    .eq('branch_name', cleanBranch)
                    .eq('laboratory', '_CONFIG_')
                    .eq('ean', eanKey);

                if (delError) throw delError;
            }
            console.log(`[CyclicService] Lab ${labName} hidden status set to ${isHidden} at ${branchName}`);
        } catch (error) {
            console.error("Error in hideLaboratory:", error);
            throw error;
        }
    },

    getZonales: async (): Promise<Zonal[]> => {
        try {
            const { data, error } = await (supabase as any)
                .from('profiles')
                .select(`
                    id,
                    full_name,
                    username,
                    zonal_branches (
                        branches (
                            name
                        )
                    )
                `)
                .eq('role', 'mod')
                .eq('active', true);

            if (error) {
                console.error("[CyclicService] Error fetching zonales:", error);
                return [];
            }

            return (data || []).map((profile: any) => ({
                id: profile.username || profile.id,
                label: profile.full_name || profile.username || 'Coordinador Zonal',
                branches: (profile.zonal_branches || [])
                    .map((zb: any) => zb.branches?.name)
                    .filter(Boolean)
            }));
        } catch (error) {
            console.error("[CyclicService] getZonales exception:", error);
            return [];
        }
    }
};

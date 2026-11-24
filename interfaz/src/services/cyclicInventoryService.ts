
import { LaboratoryStatus } from "@/components/LaboratoryCard";
import { supabase } from "@/integrations/supabase/client";
import { getAllBranchLabCounts } from './preCountDB';
import { getProductCountByLab } from './productService';
import { Zonal, DEFAULT_ZONALES } from "@/config/zonales";
import { normalizeString } from "@/lib/utils";
import { requestsService } from './requestsService';
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

    adjustmentCount?: number;
    ira?: number;
    systemValue?: number;
    round?: number;
    isDischarged?: boolean;
    hasPendingRemoval?: boolean;
    pendingRemovalReason?: string;
}

export interface BranchCategoryStats {
    category: string;
    totalLabs: number;
    controlledLabs: number;
    inProgressLabs: number;
    pendingLabs: number;
    progress: number;
    totalItems: number;
    controlledItems: number;
    positiveUnits: number;
    negativeUnits: number;
    netUnits: number;
    totalDeviationUnits: number;
    totalSystemUnits: number;
    adjustmentsValue: number;
    negativeValue: number;
    positiveValue: number;
    balanceValue: number;
}

export interface BranchMonitorSummaryItem {
    norm_branch: string;
    branch_name: string;
    round: number;
    assigned_days: number;
    days_elapsed: number;
    days_remaining: number;
    start_date: string | null;
    deployment_date: string;
    total_labs: number;
    controlled_labs: number;
    progress: number;
    total_items: number;
    controlled_items: number;
    positive_units: number;
    negative_units: number;
    net_units: number;
    total_deviation_units: number;
    total_system_units: number;
    adjustments_value: number;
    balance_value: number;
    status: 'active' | 'completed' | 'delayed' | 'pending';
    activity_data: Array<{ date: string; shortDate: string; count: number; units: number }>;
    last_adjustment?: {
        createdAt: string;
        laboratory?: string;
        units?: number;
    };
    categories?: Record<string, BranchCategoryStats>;
    last_updated?: string;
}

export interface CyclicItem {
    id: string;
    ean: string;
    name: string;
    systemQuantity: number;
    countedQuantity: number;
    cost: number;
    price?: number;
    status: 'pending' | 'controlled' | 'adjusted';
    category?: string;
    wasReadjusted?: boolean;
    updatedAt?: string;
    shortageId?: string;
    surplusId?: string;
    readjustmentReason?: string;
    id_producto?: string;
    is_hidden?: boolean;
    troquel?: string;
    minimo?: number;
}

let cachedAllData: any[] | null = null;
let lastAllDataFetch = 0;
const ALL_DATA_CACHE_TTL = 1000 * 60 * 3; // 3 minutos de caché en memoria

export const cyclicInventoryService = {
    invalidateBranchMonitorCache: () => {
        cachedAllData = null;
        lastAllDataFetch = 0;
    },
    getLabInventory: async (branchName: string, labName: string, round?: number): Promise<CyclicItem[]> => {
        try {
            console.log(`[CyclicService] getLabInventory (v2 RPC) for ${labName} at ${branchName}, round: ${round}`);
            
            // Loop with pagination to retrieve ALL items regardless of PostgREST 1000 max-rows limit
            let allData: any[] = [];
            let page = 0;
            const limit = 1000;

            while (true) {
                const { data, error } = await (supabase as any).rpc('get_lab_inventory_v2', {
                    p_branch_name: branchName,
                    p_laboratory: labName,
                    p_round: round !== undefined ? round : null
                }).range(page * limit, (page + 1) * limit - 1);

                if (error) {
                    console.error(`Error loading inventory page ${page} for ${labName}:`, error);
                    break;
                }

                if (!data || data.length === 0) break;

                allData = allData.concat(data);
                if (data.length < limit) break;
                page++;
            }

            console.log(`[CyclicService] Found ${allData.length} total rows in DB (v2)`);

            // Enrich items with sale_price (PVP) from products table
            const eans = allData.map(i => i.ean).filter(Boolean);
            const priceMap = new Map<string, number>();
            if (eans.length > 0) {
                try {
                    for (let i = 0; i < eans.length; i += 500) {
                        const chunkEans = eans.slice(i, i + 500);
                        const { data: prods } = await (supabase.from('products') as any)
                            .select('ean, id_producto, sale_price')
                            .in('ean', chunkEans);
                        (prods || []).forEach((p: any) => {
                            if (p.sale_price && Number(p.sale_price) > 0) {
                                if (p.ean) priceMap.set(p.ean, Number(p.sale_price));
                                if (p.id_producto) priceMap.set(p.id_producto, Number(p.sale_price));
                            }
                        });
                    }
                } catch (pe) {
                    console.warn('[CyclicService] Error fetching product sale_prices:', pe);
                }
            }

            // Map RPC result to CyclicItem
            return allData.map((item: any) => {
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
                    price: priceMap.get(item.ean) || (item.id_producto ? priceMap.get(item.id_producto) : 0) || item.product_price || item.sale_price || 0,
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
            // Deduplicate items using IDProducto / EAN to preserve all products with EAN 0
            const uniqueMap = new Map<string, CyclicItem>();
            for (const item of items) {
                let cleanEan = String(item.ean || '').trim();
                const cleanIdProd = String(item.id_producto || '').trim();

                // Si el EAN es 0, vacío o s/n, usamos el IDProducto como identificador único
                if (!cleanEan || cleanEan === '0' || cleanEan === '00' || cleanEan.toLowerCase() === 's/n') {
                    if (cleanIdProd) {
                        cleanEan = cleanIdProd;
                    }
                }
                if (!cleanEan) continue;

                const uniqueKey = cleanIdProd ? `IDP_${cleanIdProd}` : cleanEan;

                if (!uniqueMap.has(uniqueKey)) {
                    uniqueMap.set(uniqueKey, { ...item, ean: cleanEan });
                } else {
                    const existing = uniqueMap.get(uniqueKey)!;
                    uniqueMap.set(uniqueKey, {
                        ...existing,
                        ...item,
                        ean: cleanEan,
                        systemQuantity: item.systemQuantity ?? existing.systemQuantity,
                        countedQuantity: item.countedQuantity ?? existing.countedQuantity,
                        status: existing.status !== 'pending' ? existing.status : (item.status || existing.status)
                    });
                }
            }
            const dedupedItems = Array.from(uniqueMap.values());

            // Prepare items payload for the RPC function with dual casing for bulletproof SQL matching
            const rpcItems = dedupedItems.map(item => {
                const counted = (item.countedQuantity !== undefined && item.countedQuantity !== null)
                    ? item.countedQuantity 
                    : (item.systemQuantity ?? 0);
                const system = item.systemQuantity ?? 0;

                return {
                    ean: item.ean,
                    name: item.name,
                    category: item.category,
                    cost: item.cost || 0,
                    price: item.price || 0,
                    countedQuantity: counted,
                    counted_quantity: counted,
                    systemQuantity: system,
                    system_quantity: system,
                    status: item.status || 'pending',
                    wasReadjusted: item.wasReadjusted || false,
                    was_readjusted: item.wasReadjusted || false,
                    readjustmentReason: item.readjustmentReason,
                    readjustment_reason: item.readjustmentReason,
                    shortageId: item.shortageId,
                    shortage_id: item.shortageId,
                    surplusId: item.surplusId,
                    surplus_id: item.surplusId,
                    id_producto: item.id_producto
                };
            });

            // Call the database function (RPC V2) in chunks to avoid Postgres statement timeouts on large datasets (e.g. L'Oreal)
            const CHUNK_SIZE = 250;
            for (let i = 0; i < rpcItems.length; i += CHUNK_SIZE) {
                const chunk = rpcItems.slice(i, i + CHUNK_SIZE);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error } = await (supabase as any).rpc('save_cyclic_inventory_v2', {
                    p_branch_name: normalizeString(branchName),
                    p_laboratory: normalizeString(labName),
                    p_items: chunk as any
                });

                if (error) {
                    console.error('Error calling save_cyclic_inventory_v2 RPC on chunk:', error);
                    throw error;
                }
            }

            // Update metadata and progress in DB via atomic SQL RPC
            await cyclicInventoryService.recomputeLabProgress(branchName, labName);

            // Persistir PVP (sale_price) y costo en la tabla products de Supabase
            const productsWithPrice = dedupedItems
                .filter(i => (i.price && i.price > 0) || (i.cost && i.cost > 0))
                .map(i => ({
                    ean: i.ean,
                    sale_price: i.price || 0,
                    cost: i.cost || 0,
                    name: i.name || 'Sin Nombre',
                    laboratory: labName,
                    category: i.category || 'Varios',
                    id_producto: i.id_producto || null
                }));

            if (productsWithPrice.length > 0) {
                try {
                    for (let i = 0; i < productsWithPrice.length; i += 250) {
                        const chunk = productsWithPrice.slice(i, i + 250);
                        await (supabase.from('products') as any).upsert(chunk, { onConflict: 'ean' });
                    }
                } catch (pe) {
                    console.warn('[CyclicService] Error persisting sale_prices in products table:', pe);
                }
            }

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

            // Sincronizar de inmediato los resultados del cierre a cyclic_labs
            await cyclicInventoryService.syncBranchLabToCyclicLabs(branchName, labName, round);

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

            // 3. Persistir con el denominador correcto
            if (normalizeString(branchName).toLowerCase() === 'saladillo') {
                let updateQuery = (supabase as any).from('cyclic_labs')
                    .update({
                        total_items: masterTotal,
                        controlled_items: cumulativeAdjusted,
                        progress_percentage: realProgress,
                        status: realStatus,
                        last_counted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('branch_slug', 'saladillo')
                    .ilike('laboratory', labName.trim());

                if (category) {
                    updateQuery = updateQuery.eq('category', category.trim().toUpperCase());
                }
                const { error } = await updateQuery;
                if (error) console.error('[Progress] Error persisting cyclic_labs progress:', error);
                return;
            }

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
            let activeRound = round;
            if (!activeRound) {
                const config = await cyclicInventoryService.getBranchConfig(branchName);
                activeRound = config.rounds?.GENERAL || 1;
            }
            const { error } = await (supabase as any).rpc('recompute_lab_progress', {
                p_branch_name: normalizeString(branchName),
                p_laboratory: normalizeString(labName),
                p_round: activeRound
            });
            if (error) {
                console.error('[Progress] Error calling recompute_lab_progress RPC:', error);
            } else {
                // Sincronizar automáticamente a cyclic_labs para Saladillo
                await cyclicInventoryService.syncBranchLabToCyclicLabs(branchName, labName, activeRound);
            }
        } catch (e) {
            console.error('[Progress] Error in recomputeLabProgress:', e);
        }
    },

    /**
     * Sincroniza las métricas recalculadas en tiempo real hacia cyclic_labs (Piloto Saladillo)
     */
    syncBranchLabToCyclicLabs: async (branchName: string, labName: string, round?: number): Promise<void> => {
        try {
            const cleanBranch = normalizeString(branchName).toLowerCase();
            if (cleanBranch !== 'saladillo') return;

            let activeRound = round;
            if (!activeRound) {
                const config = await cyclicInventoryService.getBranchConfig(branchName);
                activeRound = config.rounds?.GENERAL || 1;
            }

            const { data: blRows, error: blError } = await (supabase as any)
                .from('branch_laboratories')
                .select('*')
                .ilike('branch_name', branchName.trim())
                .ilike('laboratory', labName.trim())
                .eq('round', activeRound);

            if (blError || !blRows || blRows.length === 0) return;

            for (const bl of blRows) {
                const category = (bl.category || 'VARIOS').trim().toUpperCase();
                await (supabase as any).from('cyclic_labs')
                    .update({
                        controlled_items: bl.controlled_items || 0,
                        adjusted_items: bl.adjusted_items || 0,
                        progress_percentage: bl.progress_percentage || 0,
                        status: bl.status || 'pending',
                        surplus_units: bl.positive_units || 0,
                        shortage_units: Math.abs(bl.negative_units || 0),
                        net_units: bl.net_units || 0,
                        adjustment_value: Number(bl.positive_value || 0) + Math.abs(Number(bl.negative_value || 0)),
                        balance_value: Number(bl.net_value || 0),
                        last_counted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('branch_slug', cleanBranch)
                    .ilike('laboratory', bl.laboratory.trim())
                    .eq('category', category)
                    .eq('round', activeRound);
            }
        } catch (e) {
            console.error('[CyclicService] Error syncing to cyclic_labs:', e);
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

            // Enrutamiento aislado para Saladillo a cyclic_labs
            if (cleanBranch.toLowerCase() === 'saladillo') {
                await (supabase as any).from('cyclic_labs')
                    .update({
                        status: 'completed',
                        progress_percentage: 100,
                        last_counted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('branch_slug', 'saladillo')
                    .ilike('laboratory', cleanLab);
                return;
            }

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
    updateLabMetadata: async (
        branchName: string,
        labName: string,
        _items?: CyclicItem[],
        _totalDenominator?: number
    ): Promise<void> => {
        try {
            await cyclicInventoryService.recomputeLabProgress(branchName, labName);
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
            const cleanBranch = normalizeString(branchName);

            // Enrutamiento aislado para Saladillo a cyclic_labs
            if (cleanBranch.toLowerCase() === 'saladillo') {
                const { data, error } = await (supabase as any).from('cyclic_labs')
                    .select('*')
                    .eq('branch_slug', 'saladillo')
                    .ilike('laboratory', labName.trim())
                    .eq('category', category.trim().toUpperCase())
                    .maybeSingle();

                if (error || !data) return null;

                const total = Number(data.total_items) || 0;
                const controlled = Number(data.controlled_items) || 0;
                const adjusted = Number(data.adjusted_items) || 0;
                const progress = Number(data.progress_percentage) || 0;

                return {
                    totalItems: total,
                    controlledItems: controlled,
                    adjustedItems: adjusted,
                    pendingItems: Math.max(0, total - (controlled + adjusted)),
                    progress: progress
                };
            }

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
        // Enrutamiento aislado para Saladillo a cyclic_labs
        if (branchName && normalizeString(branchName).toLowerCase() === 'saladillo') {
            const { data, error } = await (supabase as any).from('cyclic_labs')
                .select('*')
                .eq('branch_slug', 'saladillo')
                .neq('state', 'hibernated');

            if (error) {
                console.error('[CyclicService] Error fetching cyclic_labs for saladillo:', error);
                return [];
            }

            return (data || []).map((row: any) => {
                let status: LaboratoryStatus = 'pendiente';
                if (row.status === 'completed') status = 'controlado';
                else if (row.status === 'in_progress') status = 'por_controlar';

                return {
                    labName: row.laboratory,
                    category: row.category,
                    status: status,
                    totalItems: row.total_items || 0,
                    controlledItems: row.controlled_items || 0,
                    progress: row.progress_percentage || 0,
                    negativeValue: row.adjustment_value < 0 ? Math.abs(Number(row.adjustment_value)) : 0,
                    positiveValue: row.adjustment_value > 0 ? Number(row.adjustment_value) : 0,
                    netValue: Number(row.balance_value) || 0,
                    differenceValue: Number(row.adjustment_value) || 0,
                    totalSystemUnits: row.system_units || 0,
                    negativeUnits: row.shortage_units || 0,
                    positiveUnits: row.surplus_units || 0,
                    netUnits: row.net_units || 0,
                    round: row.round || 1
                } as CyclicInventoryStats;
            });
        }

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
            .filter((row: any) => row.laboratory !== '_CONFIG_')
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

                return mappedStats as CyclicInventoryStats;
            });
    },








    // Configuration System
    getBranchConfig: async (branchName: string): Promise<{ days: number, startDate: string | null, rounds?: Record<string, number> }> => {
        const cleanBranch = normalizeString(branchName);
        const upperBranch = (branchName || '').trim().toUpperCase();
        const { data, error } = await supabase
            .from('inventories')
            .select('branch_name, ean, quantity, round')
            .eq('laboratory', '_CONFIG_')
            .or(`branch_name.eq.${cleanBranch},branch_name.eq.${branchName.trim()},branch_name.eq.${upperBranch}`)
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

    /**
     * Obtiene el consolidado completo del Monitor de Sucursales en 1 sola consulta RPC de alta velocidad (~25ms).
     * Si la función RPC aún no está creada en Supabase, recurre automáticamente al fallback existente.
     */
    getBranchMonitorSummary: async (
        round: number = 2,
        daysCount: number = 12,
        dateFrom?: string | null,
        dateTo?: string | null
    ): Promise<Map<string, BranchMonitorSummaryItem>> => {
        const summaryMap = new Map<string, BranchMonitorSummaryItem>();
        if (!dateFrom && !dateTo) {
            try {
                const { data, error } = await (supabase as any).rpc('get_branch_monitor_summary', {
                p_round: round,
                p_days_count: daysCount
            });

            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach((row: any) => {
                    const norm = normalizeString(row.norm_branch || row.branch_name || '');
                    if (norm) {
                        summaryMap.set(norm, {
                            norm_branch: norm,
                            branch_name: row.branch_name,
                            round: row.round || round,
                            assigned_days: Number(row.assigned_days) || 150,
                            days_elapsed: Number(row.days_elapsed) || 0,
                            days_remaining: Number(row.days_remaining) || 0,
                            start_date: row.start_date,
                            deployment_date: row.deployment_date || '21/07',
                            total_labs: Number(row.total_labs) || 0,
                            controlled_labs: Number(row.controlled_labs) || 0,
                            progress: Number(row.progress) || 0,
                            total_items: Number(row.total_items) || 0,
                            controlled_items: Number(row.controlled_items) || 0,
                            positive_units: Number(row.positive_units) || 0,
                            negative_units: Number(row.negative_units) || 0,
                            net_units: Number(row.net_units) || 0,
                            total_deviation_units: Number(row.total_deviation_units) || 0,
                            total_system_units: Number(row.total_system_units) || 0,
                            adjustments_value: Number(row.adjustments_value) || 0,
                            balance_value: Number(row.balance_value) || 0,
                            status: row.status as any,
                            activity_data: Array.isArray(row.activity_data) ? row.activity_data : [],
                            last_adjustment: row.last_adjustment || undefined,
                            categories: row.categories || {},
                            last_updated: row.last_updated
                        });
                    }
                });
                return summaryMap;
            }
                } catch (e) {
            console.warn('[cyclicInventoryService] Fallback to legacy queries for branch monitor:', e);
        }
        }

        // Fallback: Ejecución concurrente si el RPC no existe aún en la base de datos
        const [configsMap, progressMap, activityMap] = await Promise.all([
            cyclicInventoryService.getAllBranchesConfigs(),
            cyclicInventoryService.getAllBranchesProgress(round, dateFrom, dateTo),
            cyclicInventoryService.getAllBranchesDailyActivity(daysCount, dateFrom, dateTo)
        ]);

        progressMap.forEach((prog, norm) => {
            const cfg = configsMap.get(norm);
            const act = activityMap.get(norm);
            const assigned = cfg?.assignedDays || 150;
            const remaining = cfg?.daysRemaining !== undefined ? cfg.daysRemaining : assigned;
            const elapsed = Math.max(0, assigned - remaining);
            const start = cfg?.startDate || '2026-07-21T03:00:00.000Z';
            const depDate = start.split('T')[0].split('-').reverse().slice(0, 2).join('/');

            let status: BranchMonitorSummaryItem['status'] = 'pending';
            if (prog.progress >= 100) status = 'completed';
            else if (remaining <= 0 && assigned > 0) status = 'delayed';
            else if (prog.progress > 0) status = 'active';

            summaryMap.set(norm, {
                norm_branch: norm,
                branch_name: norm,
                round,
                assigned_days: assigned,
                days_elapsed: elapsed,
                days_remaining: remaining,
                start_date: start,
                deployment_date: depDate,
                total_labs: prog.totalLabs,
                controlled_labs: prog.controlledLabs,
                progress: prog.progress,
                total_items: prog.totalItems,
                controlled_items: prog.controlledItems,
                positive_units: prog.positiveUnits,
                negative_units: prog.negativeUnits,
                net_units: prog.netUnits,
                total_deviation_units: prog.totalDeviationUnits,
                total_system_units: prog.totalSystemUnits,
                adjustments_value: prog.adjustmentsValue,
                balance_value: prog.netDeviationValue,
                status,
                activity_data: Array.isArray(act) ? act : (act?.points || []),
                last_adjustment: Array.isArray(act) ? undefined : act?.lastAdjustment,
                categories: (prog as any).categories || {},
            });
        });

        return summaryMap;
    },

    getAllBranchesConfigs: async (): Promise<Map<string, { days: number, daysRemaining: number, assignedDays: number, startDate: string | null, round: number }>> => {
        const configMap = new Map<string, { days: number, daysRemaining: number, assignedDays: number, startDate: string | null, round: number }>();
        try {
            const { data, error } = await supabase
                .from('inventories')
                .select('branch_name, ean, quantity, round')
                .eq('laboratory', '_CONFIG_')
                .or('ean.eq.CONFIG_DAYS,ean.eq.CONFIG_START_DATE,ean.like.CONFIG_ROUND%');

            if (error || !data) return configMap;

            const grouped = new Map<string, any[]>();
            data.forEach((r: any) => {
                const norm = normalizeString(r.branch_name || '');
                if (!grouped.has(norm)) grouped.set(norm, []);
                grouped.get(norm)!.push(r);
            });

            grouped.forEach((records, normBranch) => {
                const generalRound = 2; // Estrictamente Ronda 2
                let daysRec = records.find((r: any) => r.ean === 'CONFIG_DAYS' && r.round === 2) || records.find((r: any) => r.ean === 'CONFIG_DAYS');
                let startRec = records.find((r: any) => r.ean === 'CONFIG_START_DATE' && r.round === 2) || records.find((r: any) => r.ean === 'CONFIG_START_DATE');

                const assignedDays = Number(daysRec?.quantity || 0);
                let startDate: string | null = null;
                let daysRemaining = assignedDays;

                if (startRec && startRec.quantity) {
                    startDate = new Date(startRec.quantity * 1000).toISOString();
                    if (assignedDays > 0) {
                        const daysElapsed = Math.max(0, Math.floor((new Date().getTime() - (startRec.quantity * 1000)) / (1000 * 60 * 60 * 24)));
                        daysRemaining = Math.max(0, assignedDays - daysElapsed);
                    }
                }

                configMap.set(normBranch, {
                    days: assignedDays,
                    daysRemaining,
                    assignedDays,
                    startDate,
                    round: generalRound,
                });
            });
        } catch (err) {
            console.error("Error loading all branch configs:", err);
        }
        return configMap;
    },

    /**
     * Obtiene el avance y las unidades declaradas (sobrantes, faltantes, desvío, diferencia neta)
     * EXCLUSIVAMENTE DE LA RONDA 2 de cada sucursal.
     * Calcula el porcentaje de avance por laboratorios (controlados o en proceso / total)
     * idéntico al widget de Progreso de Inventario.
     */
    getAllBranchesProgress: async (
        round: number = 2,
        dateFrom?: string | null,
        dateTo?: string | null
    ): Promise<Map<string, {
        total: number;
        controlled: number;
        progress: number;
        positiveUnits: number;
        negativeUnits: number;
        netUnits: number;
        totalDeviationUnits: number;
        totalSystemUnits: number;
        totalLabs: number;
        controlledLabs: number;
        totalItems: number;
        controlledItems: number;
        adjustmentsValue: number;
        netDeviationValue: number;
    }>> => {
        const progressMap = new Map<string, {
            total: number;
            controlled: number;
            progress: number;
            positiveUnits: number;
            negativeUnits: number;
            netUnits: number;
            totalDeviationUnits: number;
            totalSystemUnits: number;
            totalLabs: number;
            controlledLabs: number;
            totalItems: number;
            controlledItems: number;
            adjustmentsValue: number;
            netDeviationValue: number;
        }>();
        try {
            let allData: any[] = [];
            let page = 0;
            const limit = 1000;

            // 1. Cargar bajas aprobadas completas de todas las sucursales (Criterio B)
            let approvedBajas: { targetName: string; category?: string; branchName?: string }[] = [];
            try {
                approvedBajas = await requestsService.getApprovedBajas();
            } catch (err) {
                console.warn('Error fetching approved bajas in getAllBranchesProgress:', err);
            }

            const bajasMap = new Map<string, Map<string, Set<string> | true>>();
            approvedBajas.forEach((b) => {
                const normB = b.branchName ? normalizeString(b.branchName) : '*';
                if (!bajasMap.has(normB)) bajasMap.set(normB, new Map());
                const labMap = bajasMap.get(normB)!;
                const lab = (b.targetName || '').trim().toUpperCase();
                const cat = (b.category || '').trim().toUpperCase();
                if (!cat || cat === 'BAJA TOTAL' || cat === 'TODOS' || cat === 'GENERAL') {
                    labMap.set(lab, true);
                } else {
                    const cats = cat.split(',').map((c) => c.trim().toUpperCase());
                    const existing = labMap.get(lab);
                    if (existing !== true) {
                        if (existing instanceof Set) {
                            cats.forEach(c => existing.add(c));
                        } else {
                            labMap.set(lab, new Set(cats));
                        }
                    }
                }
            });

            // 2. Filtro estricto por round = 2 directamente en Supabase (con caché en memoria)
            if (cachedAllData && (Date.now() - lastAllDataFetch < ALL_DATA_CACHE_TTL)) {
                allData = cachedAllData;
            } else {
                while (true) {
                    const { data, error } = await (supabase as any)
                        .from('branch_laboratories')
                        .select('branch_name, laboratory, category, status, progress_percentage, total_items, controlled_items, adjusted_items, round, positive_units, negative_units, net_units, total_system_units, positive_value, negative_value, net_value, last_updated')
                        .eq('round', 2)
                        .range(page * limit, (page + 1) * limit - 1);

                    if (error) {
                        console.error('Error fetching branch progress:', error);
                        break;
                    }
                    if (!data || data.length === 0) break;
                    allData = allData.concat(data);
                    if (data.length < limit) break;
                    page++;
                }
                cachedAllData = allData;
                lastAllDataFetch = Date.now();
            }

            // Agrupar por branch_name para la Ronda 2 (Criterio B: deduciendo bajas aprobadas)
            const grouped = new Map<string, {
                totalLabs: number;
                controlledLabs: number;
                totalItems: number;
                controlledItems: number;
                positiveUnits: number;
                negativeUnits: number;
                netUnits: number;
                totalSystemUnits: number;
                totalAdjustmentsValue: number;
                netDeviationValue: number;
            }>();
            const branchCategoryMap = new Map<string, Record<string, BranchCategoryStats>>();

            const hasDateFilter = Boolean(dateFrom && dateTo);
            const fromTime = hasDateFilter ? new Date(dateFrom!).getTime() : null;
            const toTime = hasDateFilter ? new Date(dateTo!).getTime() : null;

            allData.forEach((row: any) => {
                const norm = normalizeString(row.branch_name || '');
                if (!norm) return;
                // Omitir fila de configuración del sistema
                if (row.laboratory === '_CONFIG_') return;

                // Descontar laboratorios con baja aprobada (sucursal específica o global)
                const checkBaja = (mapBranch: string) => {
                    const labMap = bajasMap.get(mapBranch);
                    if (!labMap) return false;
                    const normLab = (row.laboratory || '').trim().toUpperCase();
                    const normCat = (row.category || '').trim().toUpperCase();
                    const match = labMap.get(normLab);
                    if (match === true) return true;
                    if (match instanceof Set && match.has(normCat)) return true;
                    return false;
                };

                if (checkBaja(norm) || checkBaja('*')) return;

                const current = grouped.get(norm) || {
                    totalLabs: 0,
                    controlledLabs: 0,
                    totalItems: 0,
                    controlledItems: 0,
                    positiveUnits: 0,
                    negativeUnits: 0,
                    netUnits: 0,
                    totalSystemUnits: 0,
                    totalAdjustmentsValue: 0,
                    netDeviationValue: 0,
                };

                // El total de laboratorios asignados es siempre la base del ciclo
                current.totalLabs += 1;

                let inDateRange = true;
                if (hasDateFilter) {
                    if (!row.last_updated) {
                        inDateRange = false;
                    } else {
                        const rowTime = new Date(row.last_updated).getTime();
                        inDateRange = (rowTime >= fromTime && rowTime <= toTime);
                    }
                }

                const isTouched = row.status === 'completed' || row.status === 'in_progress' || row.status === 'controlado' || row.status === 'por_controlar' || (Number(row.progress_percentage) > 0);
                
                if (inDateRange) {
                    if (isTouched) {
                        current.controlledLabs += 1;
                    }

                    current.totalItems += Number(row.total_items || 0);
                    current.controlledItems += Number(row.controlled_items || 0) + Number(row.adjusted_items || 0);
                    current.positiveUnits += Number(row.positive_units || 0);
                    current.negativeUnits += Number(row.negative_units || 0);
                    current.netUnits += Number(row.net_units !== undefined && row.net_units !== null
                        ? row.net_units
                        : (Number(row.positive_units || 0) + Number(row.negative_units || 0)));
                    current.totalSystemUnits += Number(row.total_system_units || 0);

                    const posVal = Number(row.positive_value || 0);
                    const negVal = Number(row.negative_value || 0);
                    const netVal = Number(row.net_value !== undefined && row.net_value !== null ? row.net_value : (posVal + negVal));
                    current.totalAdjustmentsValue += (posVal + Math.abs(negVal));
                    current.netDeviationValue += netVal;
                }

                grouped.set(norm, current);

                // Desglose por los 4 rubros
                const rawCat = (row.category || 'VARIOS').trim().toUpperCase();
                let normCat = 'VARIOS';
                if (rawCat.includes('MEDIC')) normCat = 'MEDICAMENTOS';
                else if (rawCat.includes('PERF')) normCat = 'PERFUMERIA';
                else if (rawCat.includes('ACCES')) normCat = 'ACCESORIOS';

                if (!branchCategoryMap.has(norm)) {
                    branchCategoryMap.set(norm, {});
                }
                const cats = branchCategoryMap.get(norm)!;
                if (!cats[normCat]) {
                    cats[normCat] = {
                        category: normCat,
                        totalLabs: 0,
                        controlledLabs: 0,
                        inProgressLabs: 0,
                        pendingLabs: 0,
                        progress: 0,
                        totalItems: 0,
                        controlledItems: 0,
                        positiveUnits: 0,
                        negativeUnits: 0,
                        netUnits: 0,
                        totalDeviationUnits: 0,
                        totalSystemUnits: 0,
                        adjustmentsValue: 0,
                        negativeValue: 0,
                        positiveValue: 0,
                        balanceValue: 0,
                    };
                }
                const c = cats[normCat];
                c.totalLabs += 1;

                if (inDateRange) {
                    if (isTouched) {
                        c.controlledLabs += 1;
                    }
                    if (row.status === 'completed' || row.status === 'controlado' || (Number(row.progress_percentage) >= 100)) {
                        // completed
                    } else if (row.status === 'in_progress' || row.status === 'por_controlar' || (Number(row.progress_percentage) > 0)) {
                        c.inProgressLabs += 1;
                    } else {
                        c.pendingLabs += 1;
                    }
                    c.totalItems += Number(row.total_items || 0);
                    c.controlledItems += Number(row.controlled_items || 0) + Number(row.adjusted_items || 0);
                    c.positiveUnits += Number(row.positive_units || 0);
                    c.negativeUnits += Number(row.negative_units || 0);
                    c.netUnits += Number(row.net_units !== undefined && row.net_units !== null
                        ? row.net_units
                        : (Number(row.positive_units || 0) + Number(row.negative_units || 0)));
                    c.totalSystemUnits += Number(row.total_system_units || 0);
                    const catPosVal = Number(row.positive_value || 0);
                    const catNegVal = Number(row.negative_value || 0);
                    c.positiveValue += catPosVal;
                    c.negativeValue += catNegVal;
                    c.balanceValue += Number(row.net_value !== undefined && row.net_value !== null ? row.net_value : (catPosVal + catNegVal));
                } else {
                    c.pendingLabs += 1;
                }
            });

            grouped.forEach((val, key) => {
                // Métrica unificada: % de laboratorios controlados/iniciados sobre total asignado (con 1 decimal)
                const progress = val.totalLabs > 0
                    ? Math.min(100, Number(((val.controlledLabs / val.totalLabs) * 100).toFixed(1)))
                    : 0;

                const cats = branchCategoryMap.get(key) || {};
                Object.values(cats).forEach(c => {
                    c.progress = c.totalLabs > 0 ? Number(((c.controlledLabs / c.totalLabs) * 100).toFixed(1)) : 0;
                    c.adjustmentsValue = Math.round((c.positiveValue + Math.abs(c.negativeValue)) * 100) / 100;
                    c.totalDeviationUnits = c.positiveUnits + Math.abs(c.negativeUnits);
                });

                progressMap.set(key, {
                    total: val.totalLabs,
                    controlled: val.controlledLabs,
                    progress,
                    positiveUnits: val.positiveUnits,
                    negativeUnits: val.negativeUnits,
                    netUnits: val.netUnits,
                    totalDeviationUnits: val.positiveUnits + Math.abs(val.negativeUnits),
                    totalSystemUnits: val.totalSystemUnits,
                    totalLabs: val.totalLabs,
                    controlledLabs: val.controlledLabs,
                    totalItems: val.totalItems,
                    controlledItems: val.controlledItems,
                    adjustmentsValue: Math.round(val.totalAdjustmentsValue * 100) / 100,
                    netDeviationValue: Math.round(val.netDeviationValue * 100) / 100,
                    categories: cats,
                } as any);
            });
        } catch (err) {
            console.error('Error loading all branches progress:', err);
        }
        return progressMap;
    },

    /**
     * Obtiene la actividad diaria de ajustes de inventario de los últimos N días para todas las sucursales.
     */
    getAllBranchesDailyActivity: async (
        daysCount: number = 12,
        dateFrom?: string | null,
        dateTo?: string | null
    ): Promise<Map<string, {
        points: Array<{ date: string; shortDate: string; count: number; units: number }>;
        lastAdjustment?: { createdAt: string; laboratory?: string; units?: number };
    }>> => {
        const resultMap = new Map<string, {
            points: Array<{ date: string; shortDate: string; count: number; units: number }>;
            lastAdjustment?: { createdAt: string; laboratory?: string; units?: number };
        }>();
        try {
            const hasDateFilter = Boolean(dateFrom && dateTo);
            let startDate: Date;
            let endDate: Date;

            if (hasDateFilter) {
                startDate = new Date(dateFrom!);
                endDate = new Date(dateTo!);
            } else {
                const today = new Date();
                endDate = today;
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - (daysCount - 1));
                startDate.setHours(0, 0, 0, 0);
            }

            // Generar lista de días
            const dateBuckets: Array<{ isoDate: string; shortDate: string }> = [];
            const diffMs = endDate.getTime() - startDate.getTime();
            const bucketCount = Math.max(1, Math.min(31, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1));

            for (let i = 0; i < bucketCount; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const isoDate = `${yyyy}-${mm}-${dd}`;
                const shortDate = `${dd}/${mm}`;
                dateBuckets.push({ isoDate, shortDate });
            }

            // Paginación segura para obtener todos los ajustes del período
            let allAdjustments: any[] = [];
            let page = 0;
            const limit = 1000;
            while (true) {
                let query = supabase
                    .from('inventory_adjustments')
                    .select('branch_name, created_at, total_units_adjusted, laboratory')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: true })
                    .range(page * limit, (page + 1) * limit - 1);

                if (hasDateFilter) {
                    query = query.lte('created_at', endDate.toISOString());
                }

                const { data, error } = await query;
                if (error || !data || data.length === 0) break;
                allAdjustments = allAdjustments.concat(data);
                if (data.length < limit) break;
                page++;
            }

            const lastAdjMap = new Map<string, { createdAt: string; laboratory?: string; units?: number }>();

            // Agrupar por sucursal normalizada y por fecha
            const branchDailyMap = new Map<string, Map<string, { count: number; units: number }>>();
            allAdjustments.forEach(row => {
                const norm = normalizeString(row.branch_name || '');
                if (!norm) return;

                // Actualizar último ajuste dentro del período
                lastAdjMap.set(norm, {
                    createdAt: row.created_at,
                    laboratory: row.laboratory,
                    units: Math.abs(Number(row.total_units_adjusted) || 0),
                });

                const rowDate = new Date(row.created_at);
                const yyyy = rowDate.getFullYear();
                const mm = String(rowDate.getMonth() + 1).padStart(2, '0');
                const dd = String(rowDate.getDate()).padStart(2, '0');
                const isoDate = `${yyyy}-${mm}-${dd}`;

                if (!branchDailyMap.has(norm)) {
                    branchDailyMap.set(norm, new Map());
                }
                const daysMap = branchDailyMap.get(norm)!;
                const current = daysMap.get(isoDate) || { count: 0, units: 0 };
                daysMap.set(isoDate, {
                    count: current.count + 1,
                    units: current.units + Math.abs(Number(row.total_units_adjusted) || 1),
                });
            });

            // Obtener actividad de auditoría en vivo desde branch_laboratories (laboratorios controlados / en curso)
            try {
                let labRows = [];
                if (cachedAllData && cachedAllData.length > 0) {
                    const fromTime = startDate.getTime();
                    const toTime = endDate.getTime();
                    labRows = cachedAllData.filter(r => {
                        if (!r.last_updated) return false;
                        const t = new Date(r.last_updated).getTime();
                        return t >= fromTime && t <= toTime;
                    });
                } else {
                    const { data: dbLabs } = await (supabase as any)
                        .from('branch_laboratories')
                        .select('branch_name, laboratory, last_updated, controlled_items, adjusted_items, positive_units, negative_units, status, progress_percentage')
                        .eq('round', 2)
                        .gte('last_updated', startDate.toISOString())
                        .lte('last_updated', endDate.toISOString());
                    labRows = dbLabs || [];
                }

                labRows.forEach((row) => {
                    const norm = normalizeString(row.branch_name || '');
                    if (!norm || row.laboratory === '_CONFIG_') return;
                    const isTouched = row.status === 'completed' || row.status === 'in_progress' || row.status === 'controlado' || row.status === 'por_controlar' || (Number(row.progress_percentage) > 0);
                    if (!isTouched) return;

                    const units = Number(row.controlled_items || 0) + Number(row.adjusted_items || 0) || Math.abs(Number(row.positive_units || 0)) + Math.abs(Number(row.negative_units || 0)) || 1;

                    // Si la sucursal no tiene un ajuste más reciente, actualizar último registro con este laboratorio
                    const existing = lastAdjMap.get(norm);
                    if (!existing || new Date(row.last_updated).getTime() > new Date(existing.createdAt).getTime()) {
                        lastAdjMap.set(norm, {
                            createdAt: row.last_updated,
                            laboratory: row.laboratory,
                            units,
                        });
                    }

                    const rowDate = new Date(row.last_updated);
                    const yyyy = rowDate.getFullYear();
                    const mm = String(rowDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(rowDate.getDate()).padStart(2, '0');
                    const isoDate = `${yyyy}-${mm}-${dd}`;

                    if (!branchDailyMap.has(norm)) {
                        branchDailyMap.set(norm, new Map());
                    }
                    const daysMap = branchDailyMap.get(norm);
                    const current = daysMap.get(isoDate) || { count: 0, units: 0 };
                    daysMap.set(isoDate, {
                        count: current.count + 1,
                        units: current.units + units,
                    });
                });
            } catch (errLabs) {
                console.warn('Error fetching live lab activity for sparklines:', errLabs);
            }

            // Si no hay filtro de fecha, obtener los ajustes más recientes históricos para cubrir sucursales que no ajustaron en los últimos 12 días
            if (!hasDateFilter) {
                let p = 0;
                while (p < 5) {
                    const { data: recent, error: rErr } = await supabase
                        .from('inventory_adjustments')
                        .select('branch_name, created_at, laboratory, total_units_adjusted')
                        .order('created_at', { ascending: false })
                        .range(p * 1000, (p + 1) * 1000 - 1);
                    if (rErr || !recent || recent.length === 0) break;
                    recent.forEach((r: any) => {
                        const norm = normalizeString(r.branch_name || '');
                        if (norm && !lastAdjMap.has(norm)) {
                            lastAdjMap.set(norm, {
                                createdAt: r.created_at,
                                laboratory: r.laboratory,
                                units: Math.abs(Number(r.total_units_adjusted) || 0),
                            });
                        }
                    });
                    p++;
                }
            }

            // Construir el mapa final con serie de puntos y último ajuste
            const allBranchKeys = new Set([...branchDailyMap.keys(), ...lastAdjMap.keys()]);
            allBranchKeys.forEach(normBranch => {
                const daysMap = branchDailyMap.get(normBranch);
                const series = dateBuckets.map(b => {
                    const dayData = daysMap?.get(b.isoDate) || { count: 0, units: 0 };
                    return {
                        date: b.isoDate,
                        shortDate: b.shortDate,
                        count: dayData.count,
                        units: dayData.units,
                    };
                });
                resultMap.set(normBranch, {
                    points: series,
                    lastAdjustment: lastAdjMap.get(normBranch),
                });
            });

        } catch (err) {
            console.error('Error fetching all branches daily activity:', err);
        }
        return resultMap;
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
            // Filter items that were actually adjusted in this session (used to compute fallback financial totals)
            const adjustedItems = (data.items_snapshot || []).filter(item =>
                item.status === 'adjusted' &&
                ((data.adjustment_id_shortage && item.shortageId?.includes(data.adjustment_id_shortage)) ||
                    (data.adjustment_id_surplus && item.surplusId?.includes(data.adjustment_id_surplus)))
            );

            const calcShortageValue = Math.round(adjustedItems
                .filter(i => (i.countedQuantity || 0) < (i.systemQuantity || 0))
                .reduce((acc, i) => acc + (((i.systemQuantity || 0) - (i.countedQuantity || 0)) * (i.cost || 0)), 0) * 100) / 100;

            const calcSurplusValue = Math.round(adjustedItems
                .filter(i => (i.countedQuantity || 0) > (i.systemQuantity || 0))
                .reduce((acc, i) => acc + (((i.countedQuantity || 0) - (i.systemQuantity || 0)) * (i.cost || 0)), 0) * 100) / 100;

            const finalShortageValue = data.shortage_value > 0 ? data.shortage_value : calcShortageValue;
            const finalSurplusValue = data.surplus_value > 0 ? data.surplus_value : calcSurplusValue;
            const finalUnitsAdjusted = data.total_units_adjusted > 0 ? data.total_units_adjusted : adjustedItems.length;

            // 1. Save to legacy adjustment table (for backward compat or simple history)
            const { error: error1 } = await supabase.from('inventory_adjustments').insert({
                branch_name: normalizeString(branchName),
                laboratory: normalizeString(labName),
                category: data.category ? normalizeString(data.category) : null,
                adjustment_id_shortage: data.adjustment_id_shortage,
                adjustment_id_surplus: data.adjustment_id_surplus,
                shortage_value: finalShortageValue,
                surplus_value: finalSurplusValue,
                total_units_adjusted: finalUnitsAdjusted,
                user_name: data.user_name || 'Desconocido'
            } as any);

            if (error1) throw error1;

            // 2. SAP-Style Ledger Recording (Transactional Audit Trail)
            // Create a professional header and detailed line items
            if (data.items_snapshot && data.items_snapshot.length > 0) {
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
                            total_shortage_value: finalShortageValue,
                            total_surplus_value: finalSurplusValue,
                            total_net_value: Math.round((finalSurplusValue - finalShortageValue) * 100) / 100,
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

            // Sincronizar ajuste a cyclic_labs
            await cyclicInventoryService.syncBranchLabToCyclicLabs(branchName, labName, data.round);

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
                    counted_quantity,
                    total_diff_value
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
                const calcShortage = Math.round(items.filter((i: any) => (i.total_diff_value || 0) < 0).reduce((s: number, i: any) => s + Math.abs(i.total_diff_value || 0), 0) * 100) / 100;
                const calcSurplus = Math.round(items.filter((i: any) => (i.total_diff_value || 0) > 0).reduce((s: number, i: any) => s + (i.total_diff_value || 0), 0) * 100) / 100;
                const rawShortage = row.shortage_value ?? row.total_shortage_value ?? 0;
                const rawSurplus = row.surplus_value ?? row.total_surplus_value ?? 0;
                return {
                    ...row,
                    shortage_value: rawShortage > 0 ? rawShortage : calcShortage,
                    surplus_value: rawSurplus > 0 ? rawSurplus : calcSurplus,
                    total_units_adjusted: (row.total_units_adjusted ?? row.total_items_adjusted) || items.length,
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
                    role,
                    zonal_branches (
                        branches (
                            name
                        )
                    )
                `);

            if (error) {
                console.error("[CyclicService] Error fetching zonales:", error);
                return [];
            }

            const zonales = (data || [])
                .filter((profile: any) => {
                    const r = (profile.role || '').toLowerCase();
                    const hasBranches = Array.isArray(profile.zonal_branches) && profile.zonal_branches.some((zb: any) => zb.branches?.name);
                    return r === 'mod' || r === 'zonal' || hasBranches;
                })
                .map((profile: any) => ({
                    id: profile.username || profile.id,
                    label: profile.full_name || profile.username || 'Coordinador Zonal',
                    branches: (profile.zonal_branches || [])
                        .map((zb: any) => zb.branches?.name)
                        .filter(Boolean)
                }));

            return zonales.length > 0 ? zonales : DEFAULT_ZONALES;
        } catch (error) {
            console.error("[CyclicService] getZonales exception:", error);
            return DEFAULT_ZONALES;
        }
    }
};

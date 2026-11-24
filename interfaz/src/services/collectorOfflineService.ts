import Dexie, { Table } from 'dexie';
import { supabase } from '@/integrations/supabase/client';
import { normalizeString } from '@/lib/utils';
import {
    chunkArray,
    fetchAllSupabasePages,
    isNetworkOnline,
    registerReconnectWakeup,
    withNetworkRetry
} from './supabaseHelpers';

export interface LocalProduct {
    ean: string;
    name: string;
    cost: number;
    category?: string;
    laboratory?: string;
    id_producto?: string;
}

export interface LocalInventoryItem {
    id: string;
    branch_name: string;
    laboratory: string;
    ean: string;
    name: string;
    systemQuantity: number;
    countedQuantity: number;
    cost: number;
    category?: string;
    id_producto?: string;
    status: 'pending' | 'controlled' | 'adjusted';
    updatedAt: string;
    isSynced: boolean;
}

export interface CollectorSession {
    key: string; // branchName_laboratory
    branchName: string;
    laboratory: string;
    lastDownloadedAt: string;
    lastSyncedAt?: string;
    totalItemsCount: number;
}

class CollectorDatabase extends Dexie {
    products!: Table<LocalProduct, string>;
    inventories!: Table<LocalInventoryItem, string>;
    sessions!: Table<CollectorSession, string>;

    constructor() {
        super('ZebraCollectorDB');
        this.version(1).stores({
            products: 'ean, name, category, laboratory',
            inventories: 'id, [branch_name+laboratory], ean, status, isSynced',
            sessions: 'key, branchName, laboratory'
        });
    }
}

export const collectorDb = new CollectorDatabase();

export const collectorOfflineService = {
    // 1. Descargar catálogo y estado actual del laboratorio desde Supabase a IndexedDB
    async downloadLabData(branchName: string, laboratory: string): Promise<{ success: boolean; itemCount: number; message?: string }> {
        try {
            const normBranch = normalizeString(branchName);
            const normLab = normalizeString(laboratory);
            const sessionKey = `${normBranch}_${normLab}`;

            if (!isNetworkOnline()) {
                return { success: false, itemCount: 0, message: "Sin conexión para descargar catálogo actualizado." };
            }

            // A. Traer catálogo completo de productos desde Supabase (paginado >1000 filas)
            let dbProducts: any[] = [];
            try {
                dbProducts = await fetchAllSupabasePages<any>(
                    (from, to) => supabase
                        .from('products')
                        .select('ean, name, cost, category, laboratory, id_producto')
                        .ilike('laboratory', `%${laboratory}%`)
                        .order('ean', { ascending: true })
                        .range(from, to),
                    1000,
                    'downloadLabData:products'
                );
            } catch (prodErr) {
                console.warn("[CollectorDB] Warning fetching products:", prodErr);
            }

            const productMap = new Map<string, LocalProduct>();
            if (dbProducts.length > 0) {
                const mappedProducts: LocalProduct[] = dbProducts.map(p => {
                    const prod: LocalProduct = {
                        ean: p.ean,
                        name: p.name,
                        cost: Number(p.cost || 0),
                        category: p.category || undefined,
                        laboratory: p.laboratory || undefined,
                        id_producto: p.id_producto || undefined
                    };
                    if (p.ean) {
                        productMap.set(p.ean, prod);
                    }
                    return prod;
                });
                await collectorDb.products.bulkPut(mappedProducts);
            }

            // B. Traer inventario cíclico completo desde Supabase (abortar reemplazo si falla la red)
            const items = await fetchAllSupabasePages<any>(
                (from, to) => supabase
                    .from('inventories')
                    .select('*')
                    .eq('branch_name', branchName)
                    .eq('laboratory', laboratory)
                    .order('id', { ascending: true })
                    .range(from, to),
                1000,
                'downloadLabData:inventories'
            );

            // Reemplazar solo ítems ya sincronizados, preservando escaneos offline pendientes
            let mergedCount = 0;
            await collectorDb.transaction('rw', collectorDb.inventories, collectorDb.sessions, async () => {
                const existing = await collectorDb.inventories
                    .where('[branch_name+laboratory]')
                    .equals([branchName, laboratory])
                    .toArray();

                const unsyncedByEan = new Map<string, LocalInventoryItem>();
                const syncedIdsToRemove: string[] = [];

                for (const row of existing) {
                    if (!row.isSynced) {
                        unsyncedByEan.set(row.ean, row);
                    } else {
                        syncedIdsToRemove.push(row.id);
                    }
                }

                if (syncedIdsToRemove.length > 0) {
                    await collectorDb.inventories.bulkDelete(syncedIdsToRemove);
                }

                const itemsToPut: LocalInventoryItem[] = [];
                for (const item of items) {
                    // No pisar escaneos locales que todavía no se subieron
                    if (unsyncedByEan.has(item.ean)) {
                        continue;
                    }
                    const prod = productMap.get(item.ean);
                    itemsToPut.push({
                        id: item.id || crypto.randomUUID(),
                        branch_name: branchName,
                        laboratory: laboratory,
                        ean: item.ean,
                        name: item.name || prod?.name || 'Producto sin nombre',
                        systemQuantity: Number(item.system_quantity ?? item.quantity ?? 0),
                        countedQuantity: Number(item.counted_quantity ?? item.quantity ?? 0),
                        cost: Number(item.cost ?? prod?.cost ?? 0),
                        category: item.category || prod?.category || 'Varios',
                        id_producto: item.id_producto || prod?.id_producto || undefined,
                        status: (item.status as any) || 'pending',
                        updatedAt: item.created_at || new Date().toISOString(),
                        isSynced: true
                    });
                }

                if (itemsToPut.length > 0) {
                    await collectorDb.inventories.bulkPut(itemsToPut);
                }

                mergedCount = itemsToPut.length + unsyncedByEan.size;
                await collectorDb.sessions.put({
                    key: sessionKey,
                    branchName,
                    laboratory,
                    lastDownloadedAt: new Date().toISOString(),
                    totalItemsCount: mergedCount
                });
            });

            return { success: true, itemCount: mergedCount };
        } catch (err: any) {
            console.error("[CollectorDB] Error downloading lab data:", err);
            return { success: false, itemCount: 0, message: err.message || "Error al descargar datos" };
        }
    },

    // 2. Buscar producto en IndexedDB local por EAN o ID de Producto
    async findLocalProduct(ean: string): Promise<LocalProduct | null> {
        const cleanCode = String(ean).trim();
        let prod = await collectorDb.products.get(cleanCode);
        if (prod) return prod;

        // Buscar por id_producto en products
        prod = await collectorDb.products.filter(p => p.id_producto === cleanCode || String(p.id_producto).trim() === cleanCode).first();
        if (prod) return prod;

        // Si no está en products, buscar si ya existe en inventories local por EAN o ID
        let inv = await collectorDb.inventories.where('ean').equals(cleanCode).first();
        if (!inv) {
            inv = await collectorDb.inventories.filter(x => x.id_producto === cleanCode || String(x.id_producto).trim() === cleanCode).first();
        }
        if (inv) {
            return {
                ean: inv.ean,
                name: inv.name,
                cost: inv.cost,
                category: inv.category,
                id_producto: inv.id_producto
            };
        }

        return null;
    },

    // 3. Registrar escaneo de producto en IndexedDB local
    async recordScan(params: {
        branchName: string;
        laboratory: string;
        ean: string;
        quantity: number;
        mode: 'add' | 'set';
    }): Promise<{ success: boolean; item: LocalInventoryItem; isNew: boolean }> {
        const { branchName, laboratory, ean, quantity, mode } = params;
        const cleanEan = String(ean).trim();
        const nowIso = new Date().toISOString();

        // Buscar producto maestro local por EAN o ID
        const localProd = await collectorOfflineService.findLocalProduct(cleanEan);
        const resolvedEan = localProd?.ean || cleanEan;

        let existingItem = await collectorDb.inventories
            .where('[branch_name+laboratory]')
            .equals([branchName, laboratory])
            .and(x => x.ean === resolvedEan || (localProd?.id_producto && x.id_producto === localProd.id_producto))
            .first();

        let isNew = false;
        let updatedItem: LocalInventoryItem;

        if (existingItem) {
            const newCounted = mode === 'add' 
                ? existingItem.countedQuantity + quantity 
                : quantity;

            updatedItem = {
                ...existingItem,
                countedQuantity: Math.max(0, newCounted),
                status: 'controlled',
                updatedAt: nowIso,
                isSynced: false
            };
        } else {
            isNew = true;
            updatedItem = {
                id: crypto.randomUUID(),
                branch_name: branchName,
                laboratory: laboratory,
                ean: cleanEan,
                name: localProd?.name || `Producto ${cleanEan}`,
                systemQuantity: 0,
                countedQuantity: Math.max(0, quantity),
                cost: localProd?.cost || 0,
                category: localProd?.category || 'Varios',
                id_producto: localProd?.id_producto,
                status: 'controlled',
                updatedAt: nowIso,
                isSynced: false
            };
        }

        await collectorDb.inventories.put(updatedItem);

        return { success: true, item: updatedItem, isNew };
    },

    // 4. Obtener todos los ítems locales de un laboratorio
    async getLocalLabItems(branchName: string, laboratory: string): Promise<LocalInventoryItem[]> {
        return await collectorDb.inventories
            .where('[branch_name+laboratory]')
            .equals([branchName, laboratory])
            .toArray();
    },

    // 5. Sincronizar solo ítems pendientes con Supabase en lotes acotados y con reintentos
    async syncPendingScans(
        branchName: string,
        laboratory: string,
        options?: { forceAll?: boolean }
    ): Promise<{ success: boolean; syncedCount: number; message?: string }> {
        try {
            const items = await collectorOfflineService.getLocalLabItems(branchName, laboratory);
            const targetItems = options?.forceAll ? items : items.filter(item => !item.isSynced);

            if (targetItems.length === 0) {
                return { success: true, syncedCount: 0, message: "No hay ítems pendientes para sincronizar" };
            }

            if (!isNetworkOnline()) {
                return {
                    success: false,
                    syncedCount: 0,
                    message: `${targetItems.length} ítems resguardados offline; se enviarán al recuperar conexión.`
                };
            }

            let syncedTotal = 0;
            const chunks = chunkArray(targetItems, 100);

            for (const batch of chunks) {
                if (!isNetworkOnline()) break;

                const dbPayload = batch.map(item => ({
                    id: item.id,
                    branch_name: branchName,
                    laboratory: laboratory,
                    ean: item.ean,
                    name: item.name,
                    quantity: item.systemQuantity,
                    counted_quantity: item.countedQuantity,
                    cost: item.cost,
                    category: item.category || 'Varios',
                    status: item.status,
                    id_producto: item.id_producto,
                    created_at: item.updatedAt
                }));

                await withNetworkRetry(async () => {
                    const { error } = await (supabase as any)
                        .from('inventories')
                        .upsert(dbPayload, { onConflict: 'branch_name,laboratory,ean' });
                    if (error) throw error;
                }, { maxAttempts: 2, label: `collectorSync:${branchName}/${laboratory}` });

                // Confirmar en IndexedDB chunk por chunk para preservar progreso parcial si cae la red
                await collectorDb.inventories.bulkPut(batch.map(it => ({ ...it, isSynced: true })));
                syncedTotal += batch.length;
            }

            const sessionKey = `${normalizeString(branchName)}_${normalizeString(laboratory)}`;
            await collectorDb.sessions.update(sessionKey, { lastSyncedAt: new Date().toISOString() }).catch(() => {});

            if (syncedTotal < targetItems.length) {
                return {
                    success: false,
                    syncedCount: syncedTotal,
                    message: `Sincronizados ${syncedTotal}/${targetItems.length}; los restantes se enviarán al reconectar.`
                };
            }

            return { success: true, syncedCount: syncedTotal };
        } catch (err: any) {
            console.error("[CollectorDB] Sync failed:", err);
            return { success: false, syncedCount: 0, message: err.message || "Error al conectar con Supabase" };
        }
    },

    // 6. Cantidad de escaneos offline pendientes de envío (opcionalmente filtrado)
    async getPendingCount(branchName?: string, laboratory?: string): Promise<number> {
        const all = branchName && laboratory
            ? await collectorDb.inventories.where('[branch_name+laboratory]').equals([branchName, laboratory]).toArray()
            : await collectorDb.inventories.toArray();
        return all.filter(it => !it.isSynced).length;
    },

    // 7. Vaciar automáticamente todos los escaneos pendientes al volver la conexión
    async syncAllPendingScans(): Promise<{ totalSynced: number; failedLabs: number }> {
        if (!isNetworkOnline()) return { totalSynced: 0, failedLabs: 0 };

        const allItems = await collectorDb.inventories.toArray();
        const pendingPairs = new Map<string, { branchName: string; laboratory: string }>();

        for (const item of allItems) {
            if (!item.isSynced) {
                const key = `${item.branch_name}\0${item.laboratory}`;
                if (!pendingPairs.has(key)) {
                    pendingPairs.set(key, { branchName: item.branch_name, laboratory: item.laboratory });
                }
            }
        }

        let totalSynced = 0;
        let failedLabs = 0;
        for (const pair of pendingPairs.values()) {
            const res = await collectorOfflineService.syncPendingScans(pair.branchName, pair.laboratory);
            totalSynced += res.syncedCount;
            if (!res.success) failedLabs++;
        }

        return { totalSynced, failedLabs };
    }
};

if (typeof window !== 'undefined') {
    registerReconnectWakeup(() => {
        void collectorOfflineService.syncAllPendingScans();
    });
}

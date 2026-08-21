import Dexie, { Table } from 'dexie';
import { supabase } from '@/integrations/supabase/client';
import { normalizeString } from '@/lib/utils';

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

            // A. Traer catálogo de productos desde Supabase
            const { data: dbProducts, error: prodErr } = await supabase
                .from('products')
                .select('ean, name, cost, category, laboratory, id_producto')
                .ilike('laboratory', `%${laboratory}%`);

            if (prodErr) {
                console.warn("[CollectorDB] Warning fetching products:", prodErr);
            }

            const productMap = new Map<string, LocalProduct>();
            if (dbProducts && dbProducts.length > 0) {
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

            // B. Traer inventario cíclico activo desde Supabase
            const { data: dbItems, error: invErr } = await supabase
                .from('inventories')
                .select('*')
                .eq('branch_name', branchName)
                .eq('laboratory', laboratory);

            if (invErr) {
                console.error("[CollectorDB] Error fetching inventories:", invErr);
            }

            const items = dbItems || [];
            const mappedItems: LocalInventoryItem[] = items.map((item: any) => {
                const prod = productMap.get(item.ean);
                return {
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
                };
            });

            // Reemplazar inventario local para este laboratorio
            await collectorDb.transaction('rw', collectorDb.inventories, collectorDb.sessions, async () => {
                // Borrar datos anteriores de esta sucursal y laboratorio
                const existing = await collectorDb.inventories
                    .where('[branch_name+laboratory]')
                    .equals([branchName, laboratory])
                    .toArray();
                
                const idsToRemove = existing.map(x => x.id);
                if (idsToRemove.length > 0) {
                    await collectorDb.inventories.bulkDelete(idsToRemove);
                }

                if (mappedItems.length > 0) {
                    await collectorDb.inventories.bulkPut(mappedItems);
                }

                await collectorDb.sessions.put({
                    key: sessionKey,
                    branchName,
                    laboratory,
                    lastDownloadedAt: new Date().toISOString(),
                    totalItemsCount: mappedItems.length
                });
            });

            return { success: true, itemCount: mappedItems.length };
        } catch (err: any) {
            console.error("[CollectorDB] Error downloading lab data:", err);
            return { success: false, itemCount: 0, message: err.message || "Error al descargar datos" };
        }
    },

    // 2. Buscar producto en IndexedDB local
    async findLocalProduct(ean: string): Promise<LocalProduct | null> {
        const cleanEan = String(ean).trim();
        const prod = await collectorDb.products.get(cleanEan);
        if (prod) return prod;

        // Si no está en products, buscar si ya existe en inventories local
        const inv = await collectorDb.inventories.where('ean').equals(cleanEan).first();
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

        // Buscar producto maestro local
        const localProd = await collectorOfflineService.findLocalProduct(cleanEan);

        let existingItem = await collectorDb.inventories
            .where('[branch_name+laboratory]')
            .equals([branchName, laboratory])
            .and(x => x.ean === cleanEan)
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

    // 5. Sincronizar ítems pendientes con Supabase
    async syncPendingScans(branchName: string, laboratory: string): Promise<{ success: boolean; syncedCount: number; message?: string }> {
        try {
            const items = await collectorOfflineService.getLocalLabItems(branchName, laboratory);
            if (items.length === 0) {
                return { success: true, syncedCount: 0, message: "No hay ítems para sincronizar" };
            }

            // Convertir a formato del backend
            const dbPayload = items.map(item => ({
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

            const { error } = await supabase
                .from('inventories')
                .upsert(dbPayload, { onConflict: 'branch_name,laboratory,ean' });

            if (error) {
                throw error;
            }

            // Marcar todos los ítems locales como sincronizados
            const updatedItems = items.map(it => ({ ...it, isSynced: true }));
            await collectorDb.inventories.bulkPut(updatedItems);

            const sessionKey = `${normalizeString(branchName)}_${normalizeString(laboratory)}`;
            await collectorDb.sessions.update(sessionKey, { lastSyncedAt: new Date().toISOString() });

            return { success: true, syncedCount: items.length };
        } catch (err: any) {
            console.error("[CollectorDB] Sync failed:", err);
            return { success: false, syncedCount: 0, message: err.message || "Error al conectar con Supabase" };
        }
    }
};

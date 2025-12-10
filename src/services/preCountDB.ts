import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { BRANCH_NAMES } from '@/config/users';

// Interfaces para los datos
export interface Product {
    ean: string;
    name: string;
    cost: number;
    salePrice: number;
    category?: string;
    laboratory?: string;
    stock: number;
}

// ============ PRODUCTOS (Supabase) ============

// Agregar productos a Supabase (Batch Insert)
export async function addProducts(products: Product[]): Promise<void> {
    const { error } = await supabase
        .from('products')
        .upsert(products.map(p => ({
            ean: p.ean,
            name: p.name,
            laboratory: p.laboratory,
            category: p.category,
            cost: p.cost,
            sale_price: p.salePrice
        })), { onConflict: 'ean' });

    if (error) {
        console.error('Error adding products to Supabase:', error);
        throw error;
    }
}

export async function ensureConfigProduct(): Promise<void> {
    const { data } = await supabase.from('products').select("id").eq('ean', 'CONFIG_DAYS').single();
    if (!data) {
        await addProducts([{
            ean: 'CONFIG_DAYS',
            name: 'Configuración de Días',
            laboratory: '_CONFIG_',
            category: 'SYSTEM',
            cost: 0, salePrice: 0, stock: 0
        }]);
    }
}

// Buscar productos por nombre o EAN (Supabase ILIKE)
export async function searchProducts(query: string, limit: number = 10): Promise<Product[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${normalizedQuery}%,ean.eq.${normalizedQuery}`)
        .limit(limit);

    if (error) {
        console.error('Error searching products:', error);
        return [];
    }

    return data.map(p => ({
        ean: p.ean,
        name: p.name,
        cost: p.cost || 0,
        salePrice: p.sale_price || 0,
        category: p.category || undefined,
        laboratory: p.laboratory || undefined,
        stock: 0
    }));
}

// Obtener producto por EAN
export async function getProductByEAN(ean: string): Promise<Product | undefined> {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('ean', ean)
        .single();

    if (error || !data) return undefined;

    return {
        ean: data.ean,
        name: data.name,
        cost: data.cost || 0,
        salePrice: data.sale_price || 0,
        category: data.category || undefined,
        laboratory: data.laboratory || undefined,
        stock: 0
    };
}

// Obtener todos los productos
export async function getAllProducts(): Promise<Product[]> {
    const { data, error } = await supabase
        .from('products')
        .select('*');

    if (error) {
        console.error('Error getting all products:', error);
        return [];
    }

    return data.map(p => ({
        ean: p.ean,
        name: p.name,
        cost: p.cost || 0,
        salePrice: p.sale_price || 0,
        category: p.category || undefined,
        laboratory: p.laboratory || undefined,
        stock: 0
    }));
}

export async function getProductCount(): Promise<number> {
    const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error getting product count:', error);
        return 0;
    }

    return count || 0;
}

// Cargar datos por defecto si la base de datos está vacía
export async function loadDefaultData(): Promise<boolean> {
    try {
        // Check if products exist in Supabase
        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        if (count !== null && count > 0) {
            return false; // Ya hay datos
        }

        console.log("Intentando cargar datos por defecto a Supabase...");
        const response = await fetch('default_products.xlsx');

        if (!response.ok) {
            console.log("No se encontró default_products.xlsx");
            return false;
        }

        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A" });
        const products: Product[] = [];

        for (let i = 1; i < jsonData.length; i++) {
            const row: any = jsonData[i];
            const rawName = row["D"];
            const rawLab = row["O"];
            const rawEans = row["Q"];
            const rawCategory = row["J"];

            if (!rawName || !rawEans) continue;

            const name = String(rawName).trim();
            const laboratory = rawLab ? String(rawLab).trim() : undefined;

            let category = '';
            if (rawCategory) {
                category = String(rawCategory).trim().toUpperCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            }

            const eanString = String(rawEans).trim();
            const eanList = eanString.split('-').map(e => e.trim()).filter(e => e.length > 0);

            eanList.forEach(ean => {
                products.push({
                    ean: ean,
                    name: name,
                    cost: 0,
                    salePrice: 0,
                    laboratory: laboratory,
                    category: category,
                    stock: 0
                });
            });
        }

        if (products.length > 0) {
            // Insert in chunks to avoid payload limit
            const chunkSize = 1000;
            for (let i = 0; i < products.length; i += chunkSize) {
                const chunk = products.slice(i, i + chunkSize);
                await addProducts(chunk);
                console.log(`Uploaded chunk ${i} - ${i + chunkSize}`);
            }
            console.log(`${products.length} productos cargados a Supabase.`);
            return true;
        }

    } catch (error) {
        console.error("Error cargando datos por defecto:", error);
    }
    return false;
}

// Helper to parse labs from a worksheet
function parseSheetLabs(worksheet: XLSX.WorkSheet): { name: string, category: string }[] {
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    if (jsonData.length < 2) return [];

    const headers = jsonData[1];
    const result: { name: string, category: string }[] = [];

    for (let c = 0; c < headers.length; c++) {
        const category = String(headers[c]).trim();
        if (!category) continue;

        for (let r = 2; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (row && row[c]) {
                const labName = String(row[c]).trim();
                if (labName.length > 0) {
                    result.push({
                        name: labName.toUpperCase(),
                        category: category.toUpperCase()
                    });
                }
            }
        }
    }
    return result;
}

// Obtener laboratorios permitidos para una sucursal desde Supabase (branch_laboratories)
export async function getLaboratoriesForBranch(branchName: string): Promise<{ name: string, category: string }[]> {
    try {
        const { data, error } = await supabase
            .from('branch_laboratories')
            .select('laboratory, category')
            .eq('branch_name', branchName);

        if (error) {
            console.error("Error loading laboratories from Supabase:", error);
            return [];
        }

        if (!data) return [];

        return data.map(row => ({
            name: row.laboratory.toUpperCase(),
            category: (row.category || 'SIN CLASIFICAR').toUpperCase()
        })).sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
        console.error("Critical error loading laboratories:", error);
        return [];
    }
}

// Obtener conteo de laboratorios para TODAS las sucursales (Batch)
export async function getAllBranchLabCounts(): Promise<Record<string, number>> {
    try {
        const response = await fetch('lab_sucu.xlsx');
        if (!response.ok) return {};

        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data);
        const counts: Record<string, number> = {};

        // Normalization map for sheet names
        const sheetMap = new Map<string, string>();
        workbook.SheetNames.forEach(s => sheetMap.set(s.toLowerCase().trim(), s));

        for (const branch of BRANCH_NAMES) {
            const sheetName = sheetMap.get(branch.toLowerCase().trim());

            if (sheetName) {
                const labs = parseSheetLabs(workbook.Sheets[sheetName]);
                counts[branch] = labs.length;
            } else {
                counts[branch] = 0;
            }
        }
        return counts;
    } catch (error) {
        console.error("Error getting all branch counts:", error);
        return {};
    }
}

// ============ PRE-CONTEO (IndexedDB - Offline First) ============

interface PreCountDB extends DBSchema {
    sessions: {
        key: string;
        value: PreCountSession;
        indexes: { 'by-status': string };
    };
    items: {
        key: string;
        value: PreCountItem;
        indexes: { 'by-session': string; 'by-ean': string };
    };
}

export interface PreCountSession {
    id: string;
    sector: string;
    startTime: number;
    endTime?: number;
    status: 'active' | 'completed';
    totalProducts: number;
    totalUnits: number;
}

export interface PreCountItem {
    id: string;
    sessionId: string;
    ean: string;
    productName: string;
    quantity: number;
    timestamp: number;
    synced: number; // 0: no, 1: yes
}

let dbPromise: Promise<IDBPDatabase<PreCountDB>>;

// Singleton init
function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<PreCountDB>('farmaplus-precount', 1, {
            upgrade(db) {
                // Store de Sesiones
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                sessionStore.createIndex('by-status', 'status');

                // Store de Items
                const itemStore = db.createObjectStore('items', { keyPath: 'id' });
                itemStore.createIndex('by-session', 'sessionId');
                itemStore.createIndex('by-ean', 'ean');
            },
        });
    }
    return dbPromise;
}

// Ensure initDB is available if explicitly needed, but getDB is preferred
export async function initDB() {
    return getDB();
}

// --- Sesiones ---

export async function createSession(sector: string): Promise<PreCountSession> {
    const db = await getDB();
    const session: PreCountSession = {
        id: crypto.randomUUID(),
        sector,
        startTime: Date.now(),
        status: 'active',
        totalProducts: 0,
        totalUnits: 0,
    };
    await db.put('sessions', session);
    return session;
}

export async function getActiveSession(): Promise<PreCountSession | null> {
    const db = await getDB();
    const activeSessions = await db.getAllFromIndex('sessions', 'by-status', 'active');
    return activeSessions.length > 0 ? activeSessions[0] : null;
}

export async function updateSession(id: string, updates: Partial<PreCountSession>): Promise<void> {
    const db = await getDB();
    const session = await db.get('sessions', id);
    if (session) {
        await db.put('sessions', { ...session, ...updates });
    }
}

export async function endSession(id: string): Promise<void> {
    await updateSession(id, { status: 'completed', endTime: Date.now() });
}

// --- Items ---

export async function addPreCountItem(item: Omit<PreCountItem, 'id' | 'sessionId' | 'timestamp' | 'synced'> & { sector: string }): Promise<PreCountItem> {
    const db = await getDB();
    const activeSession = await getActiveSession();

    if (!activeSession) throw new Error("No active session");

    const newItem: PreCountItem = {
        id: crypto.randomUUID(),
        sessionId: activeSession.id,
        ean: item.ean,
        productName: item.productName,
        quantity: item.quantity,
        timestamp: Date.now(),
        synced: 0
    };

    await db.put('items', newItem);
    return newItem;
}

export async function updatePreCountItem(id: string, updates: Partial<PreCountItem>): Promise<void> {
    const db = await getDB();
    const item = await db.get('items', id);
    if (item) {
        await db.put('items', { ...item, ...updates });
    }
}

export async function deletePreCountItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('items', id);
}

export async function getPreCountItemsBySector(sector: string): Promise<PreCountItem[]> {
    const db = await getDB();
    const activeSession = await getActiveSession();

    if (!activeSession || activeSession.sector !== sector) return [];

    return db.getAllFromIndex('items', 'by-session', activeSession.id);
}

export async function getUnsyncedItems(): Promise<PreCountItem[]> {
    const db = await getDB();
    const allItems = await db.getAll('items');
    return allItems.filter(item => item.synced === 0);
}

export async function markItemsAsSynced(itemIds: string[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('items', 'readwrite');
    const store = tx.objectStore('items');

    for (const id of itemIds) {
        const item = await store.get(id);
        if (item) {
            item.synced = 1;
            await store.put(item);
        }
    }
    await tx.done;
}

export async function clearProducts(): Promise<void> {
    // Better approach for "Replace Database" feature:
    // We actually want to delete all products.
    const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
        console.error('Error clearing products:', deleteError);
        throw deleteError;
    }
}

export async function clearAllData(): Promise<void> {
    try {
        const db = await getDB();
        await db.clear('sessions');
        await db.clear('items');
    } catch (e) {
        console.warn("Error clearing IndexedDB:", e);
    }

    localStorage.removeItem('farmaplus_user');
}

export async function getAllSessions(): Promise<PreCountSession[]> {
    const db = await getDB();
    return db.getAll('sessions');
}

export async function getSessionItems(session: PreCountSession): Promise<PreCountItem[]> {
    const db = await getDB();
    return db.getAllFromIndex('items', 'by-session', session.id);
}

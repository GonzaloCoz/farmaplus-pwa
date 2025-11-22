import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Interfaces para los datos
export interface Product {
    ean: string;
    name: string;
    cost: number;
    salePrice: number;
    category?: string;
}

export interface PreCountItem {
    id: string;
    sector: string;
    ean: string;
    productName: string;
    quantity: number;
    timestamp: number;
    synced: boolean;
}

export interface PreCountSession {
    id: string;
    sector: string;
    startTime: number;
    endTime?: number;
    totalProducts: number;
    totalUnits: number;
    synced: boolean;
}

// Schema de la base de datos
interface PreCountDBSchema extends DBSchema {
    products: {
        key: string;
        value: Product;
        indexes: { 'by-name': string };
    };
    preCountItems: {
        key: string;
        value: PreCountItem;
        indexes: { 'by-sector': string; 'by-synced': boolean };
    };
    sessions: {
        key: string;
        value: PreCountSession;
        indexes: { 'by-synced': boolean };
    };
}

const DB_NAME = 'farmaplus-precount';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<PreCountDBSchema> | null = null;

// Inicializar la base de datos
export async function initDB(): Promise<IDBPDatabase<PreCountDBSchema>> {
    if (dbInstance) {
        return dbInstance;
    }

    dbInstance = await openDB<PreCountDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Store de productos
            if (!db.objectStoreNames.contains('products')) {
                const productStore = db.createObjectStore('products', { keyPath: 'ean' });
                productStore.createIndex('by-name', 'name');
            }

            // Store de items de pre-conteo
            if (!db.objectStoreNames.contains('preCountItems')) {
                const itemStore = db.createObjectStore('preCountItems', { keyPath: 'id' });
                itemStore.createIndex('by-sector', 'sector');
                itemStore.createIndex('by-synced', 'synced');
            }

            // Store de sesiones
            if (!db.objectStoreNames.contains('sessions')) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                sessionStore.createIndex('by-synced', 'synced');
            }
        },
    });

    return dbInstance;
}

// ============ PRODUCTOS ============

// Agregar productos a la base de datos local
export async function addProducts(products: Product[]): Promise<void> {
    const db = await initDB();
    const tx = db.transaction('products', 'readwrite');

    await Promise.all([
        ...products.map(product => tx.store.put(product)),
        tx.done,
    ]);
}

// Buscar productos por nombre (búsqueda predictiva)
export async function searchProducts(query: string, limit: number = 10): Promise<Product[]> {
    const db = await initDB();
    const allProducts = await db.getAll('products');

    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
        return allProducts.slice(0, limit);
    }

    const results = allProducts.filter(product =>
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.ean.includes(query)
    );

    return results.slice(0, limit);
}

// Obtener producto por EAN
export async function getProductByEAN(ean: string): Promise<Product | undefined> {
    const db = await initDB();
    return db.get('products', ean);
}

// Obtener todos los productos
export async function getAllProducts(): Promise<Product[]> {
    const db = await initDB();
    return db.getAll('products');
}

// ============ PRE-CONTEO ITEMS ============

// Agregar item de pre-conteo
export async function addPreCountItem(item: Omit<PreCountItem, 'id' | 'timestamp' | 'synced'>): Promise<PreCountItem> {
    const db = await initDB();

    const newItem: PreCountItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        synced: false,
    };

    await db.add('preCountItems', newItem);
    return newItem;
}

// Actualizar item de pre-conteo
export async function updatePreCountItem(id: string, updates: Partial<PreCountItem>): Promise<void> {
    const db = await initDB();
    const item = await db.get('preCountItems', id);

    if (!item) {
        throw new Error('Item not found');
    }

    const updatedItem = { ...item, ...updates, synced: false };
    await db.put('preCountItems', updatedItem);
}

// Eliminar item de pre-conteo
export async function deletePreCountItem(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('preCountItems', id);
}

// Obtener items por sector
export async function getPreCountItemsBySector(sector: string): Promise<PreCountItem[]> {
    const db = await initDB();
    return db.getAllFromIndex('preCountItems', 'by-sector', sector);
}

// Obtener todos los items de pre-conteo
export async function getAllPreCountItems(): Promise<PreCountItem[]> {
    const db = await initDB();
    return db.getAll('preCountItems');
}

// Obtener items no sincronizados
export async function getUnsyncedItems(): Promise<PreCountItem[]> {
    const db = await initDB();
    return db.getAllFromIndex('preCountItems', 'by-synced', false);
}

// Marcar items como sincronizados
export async function markItemsAsSynced(ids: string[]): Promise<void> {
    const db = await initDB();
    const tx = db.transaction('preCountItems', 'readwrite');

    await Promise.all([
        ...ids.map(async (id) => {
            const item = await tx.store.get(id);
            if (item) {
                item.synced = true;
                await tx.store.put(item);
            }
        }),
        tx.done,
    ]);
}

// ============ SESIONES ============

// Crear sesión de pre-conteo
export async function createSession(sector: string): Promise<PreCountSession> {
    const db = await initDB();

    const session: PreCountSession = {
        id: `session-${Date.now()}`,
        sector,
        startTime: Date.now(),
        totalProducts: 0,
        totalUnits: 0,
        synced: false,
    };

    await db.add('sessions', session);
    return session;
}

// Actualizar sesión
export async function updateSession(id: string, updates: Partial<PreCountSession>): Promise<void> {
    const db = await initDB();
    const session = await db.get('sessions', id);

    if (!session) {
        throw new Error('Session not found');
    }

    const updatedSession = { ...session, ...updates };
    await db.put('sessions', updatedSession);
}

// Obtener sesión activa
export async function getActiveSession(): Promise<PreCountSession | undefined> {
    const db = await initDB();
    const sessions = await db.getAll('sessions');
    return sessions.find(s => !s.endTime);
}

// Finalizar sesión
export async function endSession(id: string): Promise<void> {
    const db = await initDB();
    const session = await db.get('sessions', id);

    if (!session) {
        throw new Error('Session not found');
    }

    session.endTime = Date.now();
    await db.put('sessions', session);
}

// Obtener todas las sesiones
export async function getAllSessions(): Promise<PreCountSession[]> {
    const db = await initDB();
    return db.getAll('sessions');
}

// ============ UTILIDADES ============

// Limpiar datos sincronizados antiguos
export async function clearSyncedData(olderThanDays: number = 30): Promise<void> {
    const db = await initDB();
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

    const items = await db.getAll('preCountItems');
    const tx = db.transaction('preCountItems', 'readwrite');

    await Promise.all([
        ...items
            .filter(item => item.synced && item.timestamp < cutoffTime)
            .map(item => tx.store.delete(item.id)),
        tx.done,
    ]);
}

// Exportar datos para sincronización
export async function exportPreCountData() {
    const items = await getAllPreCountItems();
    const sessions = await getAllSessions();

    return {
        items,
        sessions,
        exportTime: Date.now(),
    };
}

// Limpiar toda la base de datos (para testing)
export async function clearAllData(): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(['products', 'preCountItems', 'sessions'], 'readwrite');

    await Promise.all([
        tx.objectStore('products').clear(),
        tx.objectStore('preCountItems').clear(),
        tx.objectStore('sessions').clear(),
        tx.done,
    ]);
}

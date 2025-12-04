import { openDB, DBSchema, IDBPDatabase } from 'idb';
import * as XLSX from 'xlsx';

// Interfaces para los datos
export interface Product {
    ean: string;
    name: string;
    cost: number;
    salePrice: number;
    category?: string;
    laboratory?: string;
    stock: number; // New field
}

export interface PreCountItem {
    id: string;
    sector: string;
    ean: string;
    productName: string;
    quantity: number;
    timestamp: number;
    synced: number;
}

export interface PreCountSession {
    id: string;
    sector: string;
    startTime: number;
    endTime?: number;
    totalProducts: number;
    totalUnits: number;
    synced: number;
}

// Schema de la base de datos
interface PreCountDBSchema extends DBSchema {
    products: {
        key: string;
        value: Product;
        indexes: { 'by-name': string; 'by-laboratory': string }; // New index
    };
    preCountItems: {
        key: string;
        value: PreCountItem;
        indexes: { 'by-sector': string; 'by-synced': number };
    };
    sessions: {
        key: string;
        value: PreCountSession;
        indexes: { 'by-synced': number };
    };
}

const DB_NAME = 'farmaplus-precount';
const DB_VERSION = 2; // Bump version

let dbInstance: IDBPDatabase<PreCountDBSchema> | null = null;

// Inicializar la base de datos
export async function initDB(): Promise<IDBPDatabase<PreCountDBSchema>> {
    if (dbInstance) {
        return dbInstance;
    }

    dbInstance = await openDB<PreCountDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Store de productos
            if (!db.objectStoreNames.contains('products')) {
                const productStore = db.createObjectStore('products', { keyPath: 'ean' });
                productStore.createIndex('by-name', 'name');
                productStore.createIndex('by-laboratory', 'laboratory');
            } else {
                // Upgrade logic for version 2
                const productStore = transaction.objectStore('products');
                if (!productStore.indexNames.contains('by-laboratory')) {
                    productStore.createIndex('by-laboratory', 'laboratory');
                }
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

// Limpiar base de datos de productos
export async function clearProducts(): Promise<void> {
    const db = await initDB();
    const tx = db.transaction('products', 'readwrite');
    await tx.store.clear();
    await tx.done;
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
        product.ean.includes(normalizedQuery)
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

// Cargar datos por defecto si la base de datos está vacía
export async function loadDefaultData(): Promise<boolean> {
    try {
        const db = await initDB();
        const count = await db.count('products');

        if (count > 0) {
            // Verificar si los productos tienen categoría cargada
            const sample = await db.getAll('products', undefined, 1);
            if (sample.length > 0 && sample[0].category !== undefined && sample[0].category !== '') {
                return false; // Ya tienen categoría, no recargar
            }
            console.log("Detectada base de datos antigua (sin categorías). Recargando...");
            await db.clear('products');
        }

        console.log("Intentando cargar datos por defecto...");
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
            const rawCategory = row["J"]; // Columna J es Rubro/Categoría

            if (!rawName || !rawEans) continue;

            const name = String(rawName).trim();
            const laboratory = rawLab ? String(rawLab).trim() : undefined;

            // Normalizar categoría: Mayúsculas y sin acentos para coincidir con lab_sucu
            let category = '';
            if (rawCategory) {
                category = String(rawCategory).trim().toUpperCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Eliminar acentos
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
                    category: category, // Asignar categoría normalizada
                    stock: 0
                });
            });
        }

        if (products.length > 0) {
            await addProducts(products);
            console.log(`${products.length} productos cargados.`);
            return true;
        }

    } catch (error) {
        console.error("Error cargando datos por defecto:", error);
    }
    return false;
}

// Obtener laboratorios permitidos para una sucursal desde lab_sucu.xlsx
export async function getLaboratoriesForBranch(sheetName: string): Promise<{ name: string, category: string }[]> {
    try {
        const response = await fetch('lab_sucu.xlsx');
        if (!response.ok) {
            console.error("No se encontró lab_sucu.xlsx");
            return [];
        }

        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data);

        // Buscar la hoja que coincida con el nombre de la sucursal (case insensitive)
        const targetSheet = workbook.SheetNames.find(s => s.toLowerCase() === sheetName.toLowerCase());

        if (!targetSheet) {
            console.error(`Hoja para sucursal '${sheetName}' no encontrada.`);
            return [];
        }

        const worksheet = workbook.Sheets[targetSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
            return [];
        }

        // Fila 1 (índice 1) contiene los encabezados de categoría: ACCESORIOS, MEDICAMENTOS, PERFUMERIA, VARIOS
        const headers = jsonData[1];
        const result: { name: string, category: string }[] = [];

        // Iterar por columnas
        for (let c = 0; c < headers.length; c++) {
            const category = String(headers[c]).trim();
            if (!category) continue;

            // Iterar filas desde la 2 (índice 2)
            for (let r = 2; r < jsonData.length; r++) {
                const row = jsonData[r];
                if (row && row[c]) {
                    const labName = String(row[c]).trim();
                    if (labName.length > 0) {
                        result.push({
                            name: labName.toUpperCase(),
                            category: category.toUpperCase() // Normalizar a mayúsculas
                        });
                    }
                }
            }
        }

        return result.sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
        console.error("Error cargando laboratorios de sucursal:", error);
        return [];
    }
}



// ============ PRE-CONTEO ITEMS ============

// Agregar item de pre-conteo
export async function addPreCountItem(item: Omit<PreCountItem, 'id' | 'timestamp' | 'synced'>): Promise<PreCountItem> {
    const db = await initDB();

    const newItem: PreCountItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        synced: 0,
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

    const updatedItem = { ...item, ...updates, synced: 0 };
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
    return db.getAllFromIndex('preCountItems', 'by-synced', 0);
}

// Marcar items como sincronizados
export async function markItemsAsSynced(ids: string[]): Promise<void> {
    const db = await initDB();
    const tx = db.transaction('preCountItems', 'readwrite');

    await Promise.all([
        ...ids.map(async (id) => {
            const item = await tx.store.get(id);
            if (item) {
                item.synced = 1;
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
        synced: 0,
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

// Obtener items de una sesión específica
export async function getSessionItems(session: PreCountSession): Promise<PreCountItem[]> {
    const db = await initDB();
    // Obtener todos los items del sector
    const sectorItems = await db.getAllFromIndex('preCountItems', 'by-sector', session.sector);

    // Filtrar por rango de tiempo
    // Margen de error de 1 segundo para asegurar inclusión
    const startTime = session.startTime - 1000;
    const endTime = session.endTime ? session.endTime + 1000 : Date.now() + 1000;

    return sectorItems.filter(item =>
        item.timestamp >= startTime && item.timestamp <= endTime
    );
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

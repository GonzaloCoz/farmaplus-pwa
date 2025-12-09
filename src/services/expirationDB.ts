import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ExpirationDB extends DBSchema {
    sessions: {
        key: string;
        value: ExpirationSession;
        indexes: { 'by-status': string; 'by-branch': string };
    };
    items: {
        key: string; // ID único del item
        value: ExpirationItem;
        indexes: { 'by-session': string; 'by-ean': string };
    };
}

export interface ExpirationSession {
    id: string;
    sector: string;
    branchName: string; // Sucursal propietaria de la sesión
    startTime: number;
    endTime?: number;
    status: 'active' | 'completed';
    totalProducts: number; // Cantidad de SKUs distintos
    totalUnits: number; // Cantidad total de unidades (suma de batches)
}

export interface BatchInfo {
    batchNumber: string;
    expirationDate: string; // Guardamos como string DD/MM/AAAA o MM/AAAA para flexibilidad
    quantity: number;
}

export interface ExpirationItem {
    id: string;
    sessionId: string;
    ean: string;
    productName: string;
    batches: BatchInfo[];
    totalQuantity: number;
    timestamp: number;
    synced: number; // 0: no, 1: yes (para futuro sync)
}

let dbPromise: Promise<IDBPDatabase<ExpirationDB>>;

export async function initExpirationDB() {
    dbPromise = openDB<ExpirationDB>('farmaplus-expiration', 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Version 1 setup
            if (oldVersion < 1) {
                const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                sessionStore.createIndex('by-status', 'status');

                const itemStore = db.createObjectStore('items', { keyPath: 'id' });
                itemStore.createIndex('by-session', 'sessionId');
                itemStore.createIndex('by-ean', 'ean');
            }

            // Version 2 upgrade: Add branch index to sessions
            if (oldVersion < 2) {
                const sessionStore = transaction.objectStore('sessions');
                if (!sessionStore.indexNames.contains('by-branch')) {
                    sessionStore.createIndex('by-branch', 'branchName');
                }
            }
        },
    });
    return dbPromise;
}

// --- Sesiones ---

export async function createExpirationSession(sector: string, branchName: string): Promise<ExpirationSession> {
    const db = await initExpirationDB();
    const session: ExpirationSession = {
        id: crypto.randomUUID(),
        sector,
        branchName,
        startTime: Date.now(),
        status: 'active',
        totalProducts: 0,
        totalUnits: 0,
    };
    await db.put('sessions', session);
    return session;
}

export async function getActiveExpirationSession(branchName: string): Promise<ExpirationSession | null> {
    const db = await initExpirationDB();
    const activeSessions = await db.getAllFromIndex('sessions', 'by-status', 'active');
    // Filter by branch
    const branchSession = activeSessions.find(s => s.branchName === branchName);
    return branchSession || null;
}

export async function updateExpirationSession(id: string, updates: Partial<ExpirationSession>): Promise<void> {
    const db = await initExpirationDB();
    const session = await db.get('sessions', id);
    if (session) {
        await db.put('sessions', { ...session, ...updates });
    }
}

export async function endExpirationSession(id: string): Promise<void> {
    await updateExpirationSession(id, { status: 'completed', endTime: Date.now() });
}

// --- Items ---

export async function addExpirationItem(
    itemData: Omit<ExpirationItem, 'id' | 'sessionId' | 'timestamp' | 'synced'>,
    branchName: string
): Promise<ExpirationItem> {
    const db = await initExpirationDB();
    const activeSession = await getActiveExpirationSession(branchName);

    if (!activeSession) throw new Error("No active expiration session");

    // Verificar si ya existe este EAN en la sesión actual
    const existingItems = await db.getAllFromIndex('items', 'by-session', activeSession.id);
    const existingItem = existingItems.find(i => i.ean === itemData.ean);

    if (existingItem) {
        // Si existe, actualizamos agregando los nuevos lotes (aunque la UI probablemente maneje edición)
        // Por simplicidad del "Add", reemplazaremos lógica o sumaremos batches?
        // Asumiremos que la UI pasa el estado final de los batches para este producto si ya existe.
        // Pero para ser robustos: Si Add se llama de nuevo, es un nuevo registro?
        // En Pre-Conteo, cada escaneo es una línea. Aquí, agrupamos por lotes.
        // Mejor estrategia: La UI carga el item existente, edita batches, y llama update.
        // Esta función 'add' crea uno NUEVO.
        throw new Error("Item already exists in session. Use update.");
    }

    const newItem: ExpirationItem = {
        id: crypto.randomUUID(),
        sessionId: activeSession.id,
        ean: itemData.ean,
        productName: itemData.productName,
        batches: itemData.batches,
        totalQuantity: itemData.batches.reduce((acc, b) => acc + b.quantity, 0),
        timestamp: Date.now(),
        synced: 0
    };

    await db.put('items', newItem);

    // Actualizar totales de sesión
    await updateSessionTotals(activeSession.id);

    return newItem;
}

export async function updateExpirationItem(id: string, updates: Partial<ExpirationItem>): Promise<void> {
    const db = await initExpirationDB();
    const item = await db.get('items', id);
    if (item) {
        const updatedItem = { ...item, ...updates };
        // Recalcular total si cambiaron los batches
        if (updates.batches) {
            updatedItem.totalQuantity = updates.batches.reduce((acc, b) => acc + b.quantity, 0);
        }
        await db.put('items', updatedItem);
        await updateSessionTotals(item.sessionId);
    }
}

export async function deleteExpirationItem(id: string): Promise<void> {
    const db = await initExpirationDB();
    const item = await db.get('items', id);
    if (item) {
        await db.delete('items', id);
        await updateSessionTotals(item.sessionId);
    }
}

export async function getExpirationItemsBySession(sessionId: string): Promise<ExpirationItem[]> {
    const db = await initExpirationDB();
    return db.getAllFromIndex('items', 'by-session', sessionId);
}

// Helper para actualizar totales de la sesión
async function updateSessionTotals(sessionId: string) {
    const items = await getExpirationItemsBySession(sessionId);
    const db = await initExpirationDB();

    const totalProducts = items.length;
    const totalUnits = items.reduce((acc, item) => acc + item.totalQuantity, 0);

    const session = await db.get('sessions', sessionId);
    if (session) {
        await db.put('sessions', {
            ...session,
            totalProducts,
            totalUnits
        });
    }
}

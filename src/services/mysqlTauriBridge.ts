import { MasterCatalogItem } from './preCountDB';

export interface MysqlConfig {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
}

export interface MysqlTestResult {
    success: boolean;
    message: string;
    server_version?: string;
    current_database?: string;
    tables_count: number;
}

export interface MysqlColumnInfo {
    name: string;
    data_type: string;
    is_nullable: string;
    column_key: string;
}

export interface MysqlProductRecord {
    id: string;
    name: string;
    ean: string;
    stock: number;
    cost: number;
    sale_price: number;
    troquel?: string;
    category?: string;
    laboratory?: string;
    secondary_eans: string[];
}

export interface MysqlStockResult {
    success: boolean;
    message: string;
    total_products: number;
    products: MysqlProductRecord[];
    logs: string[];
}

export interface MysqlQueryResult {
    columns: string[];
    rows: any[][];
    total_rows: number;
}

/**
 * Check if the application is running inside the Tauri native runtime
 */
export function isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * Test direct MySQL connection and retrieve metadata
 */
export async function testMysqlConnection(config: MysqlConfig): Promise<MysqlTestResult> {
    if (!isTauriEnvironment()) {
        return {
            success: false,
            message: 'La conexión directa a MySQL requiere la aplicación de escritorio (Tauri).',
            tables_count: 0,
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<MysqlTestResult>('test_mysql_connection', { config });
    } catch (err: any) {
        return {
            success: false,
            message: err?.toString() || 'Error al conectar con el servidor MySQL',
            tables_count: 0,
        };
    }
}

/**
 * List all tables in the specified MySQL database
 */
export async function listMysqlTables(config: MysqlConfig): Promise<string[]> {
    if (!isTauriEnvironment()) {
        throw new Error('La conexión a MySQL requiere la app de escritorio Tauri.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string[]>('list_mysql_tables', { config });
}

/**
 * Describe columns for a table in MySQL
 */
export async function describeMysqlTable(config: MysqlConfig, tableName: string): Promise<MysqlColumnInfo[]> {
    if (!isTauriEnvironment()) {
        throw new Error('La conexión a MySQL requiere la app de escritorio Tauri.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<MysqlColumnInfo[]>('describe_mysql_table', { config, tableName });
}

/**
 * Execute a read-only SELECT query for exploration
 */
export async function executeMysqlRawQuery(
    config: MysqlConfig,
    query: string,
    limit: number = 50
): Promise<MysqlQueryResult> {
    if (!isTauriEnvironment()) {
        throw new Error('La conexión a MySQL requiere la app de escritorio Tauri.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<MysqlQueryResult>('execute_mysql_raw_query', { config, query, limit });
}

/**
 * Fetch stock catalog directly from MySQL
 */
export async function fetchMysqlStockDirect(
    config: MysqlConfig,
    customQuery?: string,
    onLog?: (log: string) => void
): Promise<MysqlStockResult> {
    if (!isTauriEnvironment()) {
        throw new Error('La importación directa por MySQL requiere la app de escritorio Tauri.');
    }

    onLog?.(`[MySQL] Conectando a ${config.host}:${config.port}/${config.database}...`);
    const { invoke } = await import('@tauri-apps/api/core');

    const result = await invoke<MysqlStockResult>('fetch_mysql_stock', {
        config,
        customQuery: customQuery?.trim() ? customQuery : null
    });

    if (result.logs && onLog) {
        result.logs.forEach(l => onLog(l));
    }

    return result;
}

export const fetchMysqlStock = fetchMysqlStockDirect;

/**
 * Converts MySQL records into Farmaplus MasterCatalogItem format
 */
export function convertMysqlToMasterCatalog(products: MysqlProductRecord[]): MasterCatalogItem[] {
    const catalog: MasterCatalogItem[] = [];

    for (const p of products) {
        const primaryEan = p.ean || p.id;
        const allEans = [primaryEan, ...(p.secondary_eans || [])];

        catalog.push({
            ean: primaryEan,
            eans: allEans,
            isPrimaryEan: true,
            id_producto: p.id,
            name: p.name,
            systemStock: p.stock,
            cost: p.cost || 0,
            salePrice: p.sale_price || 0,
            laboratory: p.laboratory || undefined,
        });

        // Add secondary EAN entries if present
        for (const secEan of (p.secondary_eans || [])) {
            if (secEan && secEan !== primaryEan) {
                catalog.push({
                    ean: secEan,
                    eans: allEans,
                    isPrimaryEan: false,
                    id_producto: p.id,
                    name: p.name,
                    systemStock: p.stock,
                    cost: p.cost || 0,
                    salePrice: p.sale_price || 0,
                    laboratory: p.laboratory || undefined,
                });
            }
        }
    }

    return catalog;
}

/**
 * Direct MySQL synchronization for a Laboratory in Cyclic Inventory.
 * Zero-disk temporary overhead: processes in-memory, preserves existing user counts,
 * and formats directly into CyclicItem[] compatible with the cyclic inventory module.
 */
export async function fetchCyclicLabStockFromMysql(
    branchName: string,
    labName: string,
    currentItems: any[] = []
): Promise<{
    success: boolean;
    items: any[];
    addedCount: number;
    updatedCount: number;
    message: string;
    totalUnits: number;
}> {
    const { getBranchMysqlHostConfig } = await import('@/lib/branchNetworkMap');
    const { normalizeString } = await import('@/lib/utils');

    const hostConfig = getBranchMysqlHostConfig(branchName);
    const config: MysqlConfig = {
        host: hostConfig.primaryIp,
        port: hostConfig.port,
        user: hostConfig.user,
        password: 'm@st3rpl3x0nz3',
        database: hostConfig.database,
    };

    const cleanLab = labName.trim();
    const safeLabEscaped = cleanLab.replace(/'/g, "''");

    // Fast indexed SQL query with READ UNCOMMITTED (Zero table locks)
    // 1. Exact match on laboratory name to prevent '%ALCON%' matching 'EL BALCON'
    // 2. INNER JOIN stock to only bring products that exist in the branch inventory catalog (100% Plex export behavior)
    const customQuery = `
        SELECT 
            p.IDProducto AS id_producto,
            p.Troquel AS troquel,
            p.Codebar AS ean,
            CONCAT(p.Producto, ' ', IFNULL(p.Presentacion, '')) AS producto,
            r.Nombre AS rubro,
            l.Nombre AS laboratorio,
            IFNULL(s.Cantidad, 0) AS stock,
            p.UltimoPrecio AS precio,
            p.Costo AS costo,
            p.Activo AS activo
        FROM productos p
        JOIN laboratorios l ON l.IDLaboratorio = p.IDLaboratorio
        LEFT JOIN rubros r ON r.IDRubro = p.IDRubro
        INNER JOIN stock s ON s.IDProducto = p.IDProducto
        WHERE TRIM(l.Nombre) = '${safeLabEscaped}'
        ORDER BY r.Nombre ASC, p.Producto ASC
    `.trim();

    const result = await fetchMysqlStockDirect(config, customQuery);

    if (!result.success || !result.products || result.products.length === 0) {
        return {
            success: false,
            items: currentItems,
            addedCount: 0,
            updatedCount: 0,
            message: result.message || `No se encontraron productos para "${labName}" en el servidor MySQL de ${branchName}.`,
            totalUnits: 0,
        };
    }

    // Build lookup maps to preserve existing counts and status
    const existingByIdProd = new Map<string, any>();
    const existingByEan = new Map<string, any>();
    const existingByName = new Map<string, any>();

    (currentItems || []).forEach((item: any) => {
        const itemEan = String(item.ean || '').trim();
        const itemIdProd = String(item.id_producto || '').trim();
        const itemName = normalizeString(item.name || '').toUpperCase();

        if (itemIdProd) existingByIdProd.set(itemIdProd, item);
        if (itemEan && itemEan !== '0' && itemEan !== '00') existingByEan.set(itemEan, item);
        if (itemName) existingByName.set(itemName, item);
    });

    const finalItems: any[] = [];
    let addedCount = 0;
    let updatedCount = 0;
    let totalUnits = 0;

    for (const p of result.products) {
        const id_producto = String(p.id || '').trim();
        const ean = String(p.ean || id_producto).trim();
        const name = String(p.name || 'Sin Nombre').trim();
        const category = p.category || 'Varios';
        const systemQty = Number(p.stock) || 0;
        const price = Math.round((Number(p.sale_price) || Number(p.cost) || 0) * 100) / 100;

        totalUnits += systemQty;

        // Check if item already exists in current list to preserve physical counts
        let existing: any = null;
        if (id_producto && existingByIdProd.has(id_producto)) {
            existing = existingByIdProd.get(id_producto);
        } else if (ean && existingByEan.has(ean)) {
            existing = existingByEan.get(ean);
        } else if (name && existingByName.has(normalizeString(name).toUpperCase())) {
            existing = existingByName.get(normalizeString(name).toUpperCase());
        }

        if (existing) {
            updatedCount++;
            finalItems.push({
                ...existing,
                id_producto,
                ean,
                name,
                category: category || existing.category || 'Varios',
                systemQuantity: systemQty,
                cost: price || existing.cost || 0,
                // Preserve user count and status if already controlled
                countedQuantity: existing.countedQuantity ?? 0,
                status: existing.status ?? 'pending',
                troquel: p.troquel || existing.troquel,
                updatedAt: new Date().toISOString(),
            });
        } else {
            addedCount++;
            finalItems.push({
                id: crypto.randomUUID ? crypto.randomUUID() : `item_${id_producto}_${Date.now()}_${Math.random()}`,
                id_producto,
                ean,
                name,
                category,
                systemQuantity: systemQty,
                countedQuantity: 0,
                cost: price,
                status: 'pending',
                troquel: p.troquel,
                updatedAt: new Date().toISOString(),
            });
        }
    }

    return {
        success: true,
        items: finalItems,
        addedCount,
        updatedCount,
        message: `Sincronización exitosa: ${result.products.length} productos importados desde el Servidor Plex (${totalUnits} unidades en stock).`,
        totalUnits,
    };
}

export interface CreatePlexInventoryResult {
    success: boolean;
    message: string;
    id_inventario?: number;
}

/**
 * Creates a new inventory session in Plex MySQL (`inventarios` table)
 */
export async function createPlexInventorySession(
    config: MysqlConfig,
    description: string,
    userId: number = 1590, // Gonzalo Coz
    terminalId: number = 168
): Promise<CreatePlexInventoryResult> {
    if (!isTauriEnvironment()) {
        console.warn('createPlexInventorySession: Entorno web/PWA simulado.');
        return {
            success: true,
            message: `[Simulación PWA] Sesión "${description}" registrada para usuario #${userId}.`,
            id_inventario: Math.floor(100 + Math.random() * 900),
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<CreatePlexInventoryResult>('create_plex_inventory_session', {
            config,
            description,
            userId,
            terminalId,
        });
    } catch (err: any) {
        console.error('Error al crear sesión en Plex:', err);
        return {
            success: false,
            message: err?.toString() || 'Error al crear la sesión en el servidor Plex.',
        };
    }
}

export interface PlexOpenSession {
    id_inventario: number;
    fecha: string;
    hora: string;
    descripcion: string;
    id_estado: number;
    id_terminal?: number;
    id_usuario?: number;
    usuario: string;
}

export interface GetPlexOpenSessionsResult {
    success: boolean;
    message: string;
    sessions: PlexOpenSession[];
}

/**
 * Retrieves open inventory sessions from Plex MySQL (`inventarios` table with IDEstado = 1)
 */
export async function getPlexOpenInventorySessions(
    config: MysqlConfig
): Promise<GetPlexOpenSessionsResult> {
    if (!isTauriEnvironment()) {
        console.warn('getPlexOpenInventorySessions: Entorno web/PWA simulado.');
        return {
            success: true,
            message: 'Simulación PWA: Sesiones simuladas.',
            sessions: [
                {
                    id_inventario: 24,
                    fecha: '2026-09-18',
                    hora: '10:16:34',
                    descripcion: 'Inventario Fp Adm (pruebas)',
                    id_estado: 1,
                    id_terminal: 168,
                    id_usuario: 1590,
                    usuario: 'COZ GONZALO HERNAN'
                }
            ],
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<GetPlexOpenSessionsResult>('get_plex_open_inventory_sessions', {
            config,
        });
    } catch (err: any) {
        console.error('Error al obtener sesiones abiertas en Plex:', err);
        return {
            success: false,
            message: err?.toString() || 'Error al obtener sesiones abiertas en Plex.',
            sessions: [],
        };
    }
}

export interface PlexBatchItemInput {
    id_producto?: number;
    codebar: string;
    cantidad: number;
}

export interface SendPlexApiBatchResult {
    success: boolean;
    message: string;
    id_registro?: number;
    total_items?: number;
    total_units?: number;
    host?: string;
}

/**
 * Sends counted inventory items to Plex MySQL API tables (`inventario_ws` & `inventario_ws_det`)
 */
export async function sendPlexInventoryApiBatch(
    config: MysqlConfig,
    items: PlexBatchItemInput[],
    userId?: number,
    tipoInventario?: number
): Promise<SendPlexApiBatchResult> {
    if (!items || items.length === 0) {
        return {
            success: false,
            message: 'No hay productos para enviar a Plex.',
        };
    }

    if (!isTauriEnvironment()) {
        console.warn('sendPlexInventoryApiBatch: Entorno web/PWA simulado.');
        const totalUnits = items.reduce((sum, it) => sum + (it.cantidad || 1), 0);
        return {
            success: true,
            message: `[Simulación PWA] Lote registrado en Plex con ${items.length} SKUs (${totalUnits} un.)`,
            id_registro: Math.floor(1000 + Math.random() * 9000),
            total_items: items.length,
            total_units: totalUnits,
            host: config.host,
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<SendPlexApiBatchResult>('send_plex_inventory_api_batch', {
            config,
            items,
            userId,
            tipoInventario,
        });
    } catch (err: any) {
        console.error('Error al enviar lote API a Plex:', err);
        return {
            success: false,
            message: err?.toString() || 'Error al enviar el lote a Plex.',
        };
    }
}



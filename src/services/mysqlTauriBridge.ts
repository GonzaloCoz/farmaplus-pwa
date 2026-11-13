import { MasterCatalogItem } from './preCountDB';

export interface MysqlConfig {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
    include_catalog_eans?: boolean;
    include_hidden_inactive?: boolean;
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
    subrubro?: string;
    laboratory?: string;
    secondary_eans: string[];
    is_hidden?: boolean;
    is_traceable?: boolean;
    gtin?: string;
    id_producto_padre?: string;
    unidades_padre?: number;
    parent_ean?: string;
    parent_name?: string;
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
 * Checks whether Plex Sandbox (Dry-Run) mode is active.
 * Disabled: operations execute directly against the Plex server in Tauri Desktop.
 */
export function isPlexSandboxMode(): boolean {
    return false;
}

export async function ensureConfigPassword(config: MysqlConfig): Promise<MysqlConfig> {
    if (config.password && config.password.trim().length > 0) {
        return config;
    }
    const { getSessionToken } = await import('@/services/vault');
    const token = await getSessionToken();
    return {
        ...config,
        password: token,
    };
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
        const readyConfig = await ensureConfigPassword(config);
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke<MysqlTestResult>('test_mysql_connection', { config: readyConfig });
        return {
            ...res,
            message: res.message ? sanitizeMysqlError(res.message) : 'Conexión exitosa al servidor de Plex.',
        };
    } catch (err: any) {
        return {
            success: false,
            message: sanitizeMysqlError(err?.toString() || 'Error al conectar con el servidor MySQL'),
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

    const readyConfig = await ensureConfigPassword(config);
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string[]>('list_mysql_tables', { config: readyConfig });
}

/**
 * Describe columns for a table in MySQL
 */
export async function describeMysqlTable(config: MysqlConfig, tableName: string): Promise<MysqlColumnInfo[]> {
    if (!isTauriEnvironment()) {
        throw new Error('La conexión a MySQL requiere la app de escritorio Tauri.');
    }

    const readyConfig = await ensureConfigPassword(config);
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<MysqlColumnInfo[]>('describe_mysql_table', { config: readyConfig, tableName });
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

    const readyConfig = await ensureConfigPassword(config);
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<MysqlQueryResult>('execute_mysql_raw_query', { config: readyConfig, query, limit });
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

    const readyConfig = await ensureConfigPassword(config);
    onLog?.(`[MySQL] Conectando a ${readyConfig.host}:****/${readyConfig.database}...`);
    const { invoke } = await import('@tauri-apps/api/core');

    const result = await invoke<MysqlStockResult>('fetch_mysql_stock', {
        config: readyConfig,
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
    const parentIds = new Set<string>();
    const byId = new Map<string, MysqlProductRecord>();
    for (const p of products) {
        if (p.id) byId.set(p.id, p);
        if (p.id_producto_padre && (p.unidades_padre || 0) > 1) {
            parentIds.add(String(p.id_producto_padre));
        }
    }

    for (const p of products) {
        const primaryEan = p.ean || p.id;
        const allEans = [primaryEan, ...(p.secondary_eans || [])];
        const parentRec = p.id_producto_padre ? byId.get(String(p.id_producto_padre)) : undefined;
        const parentFields = {
            id_producto_padre: p.id_producto_padre || undefined,
            unidades_padre: p.unidades_padre && p.unidades_padre > 1 ? p.unidades_padre : undefined,
            parent_ean: p.parent_ean || parentRec?.ean || undefined,
            parent_name: p.parent_name || parentRec?.name || undefined,
            is_parent: parentIds.has(String(p.id)),
        };

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
            rubro: p.category || undefined,
            subrubro: p.subrubro || undefined,
            is_hidden: p.is_hidden ?? false,
            is_traceable: p.is_traceable ?? false,
            gtin: p.gtin || undefined,
            ...parentFields,
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
                    rubro: p.category || undefined,
                    subrubro: p.subrubro || undefined,
                    is_hidden: p.is_hidden ?? false,
                    is_traceable: p.is_traceable ?? false,
                    gtin: p.gtin || undefined,
                    ...parentFields,
                });
            }
        }
    }

    return catalog;
}

/**
 * Formats low-level MySQL / driver errors into clear, friendly messages without exposing IPs or internal driver dumps.
 */
export function formatSyncErrorMessage(rawError?: string, defaultMsg: string = "No se pudo conectar con el servidor local de Plex."): string {
    if (!rawError) return defaultMsg;

    const err = String(rawError).toLowerCase();

    if (
        err.includes("connection timeout") ||
        err.includes("could not connect") ||
        err.includes("timed out") ||
        err.includes("timeout") ||
        err.includes("os error 10060") ||
        err.includes("os error 10061") ||
        err.includes("host unreachable") ||
        err.includes("no route to host") ||
        err.includes("drivererror") ||
        err.includes("connection refused") ||
        err.includes("connection reset")
    ) {
        return "No se pudo conectar con el servidor local de Plex. Verifique que la terminal esté conectada a la red de la sucursal y reintente.";
    }

    if (
        err.includes("access denied") ||
        err.includes("using password") ||
        err.includes("authentication failed") ||
        err.includes("auth")
    ) {
        return "Error de autenticación con el servidor de Plex. Verifique las credenciales de acceso.";
    }

    if (err.includes("unknown database") || err.includes("base de datos")) {
        return "La base de datos de Plex no está disponible en el servidor de la sucursal.";
    }

    if (err.includes("no se encontraron productos")) {
        return rawError
            .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '')
            .replace(/\(\s*\)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    // Quitar IPs, puertos y volcados de DriverError
    const sanitized = rawError
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '')
        .replace(/DriverError\s*\{[^}]*\}/gi, '')
        .replace(/Error de configuración para\s*:?/gi, '')
        .replace(/Error al conectar a\s*:?/gi, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (sanitized && sanitized.length > 5 && !sanitized.includes('{')) {
        return sanitized;
    }

    return defaultMsg;
}

export function sanitizeMysqlError(rawError?: string | null): string {
    return formatSyncErrorMessage(rawError || undefined);
}

/**
 * Direct MySQL synchronization for a Laboratory in Cyclic Inventory.
 * Zero-disk temporary overhead: processes in-memory, preserves existing user counts,
 * and formats directly into CyclicItem[] compatible with the cyclic inventory module.
 */
export async function resolveBranchConfig(branchName: string): Promise<{ config: MysqlConfig; branchId: number }> {
    const { getBranchMysqlHostConfig } = await import('@/lib/branchNetworkMap');
    const { getSessionToken } = await import('@/services/vault');
    const hostConfig = getBranchMysqlHostConfig(branchName);
    const key = await getSessionToken();
    return {
        branchId: hostConfig.branchId || 0,
        config: {
            host: hostConfig.primaryIp,
            port: hostConfig.port,
            user: hostConfig.user,
            password: hostConfig.password || key,
            database: hostConfig.database,
        }
    };
}

export async function fetchCyclicLabStockFromMysql(
    branchName: string,
    labName: string,
    currentItems: any[] = [],
    onlyRefreshExisting: boolean | 'refresh' | 'only_new' = false,
    labId?: number
): Promise<{
    success: boolean;
    items: any[];
    addedCount: number;
    updatedCount: number;
    changedCount?: number;
    message: string;
    totalUnits: number;
}> {
    const { normalizeString } = await import('@/lib/utils');
    const { config } = await resolveBranchConfig(branchName);

    const cleanLab = labName.trim();
    const safeLabEscaped = cleanLab.replace(/'/g, "''");
    const safeLabNoDot = safeLabEscaped.replace(/\.+$/, '');
    const safeLabWithDot = safeLabNoDot + '.';
    const normLab = normalizeString(cleanLab);

    const whereLabClause = labId && Number(labId) > 0
        ? `l.IDLaboratorio = ${Number(labId)}`
        : `(TRIM(l.Nombre) = '${safeLabEscaped}' 
            OR TRIM(l.Nombre) = '${safeLabNoDot}' 
            OR TRIM(l.Nombre) = '${safeLabWithDot}'
            OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(TRIM(l.Nombre)), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U') = '${normLab}'
        )`;

    // Fast indexed SQL query con estándar sucursal:
    // 1. INNER JOIN stock: solo productos que existen en la tabla de stock de la sucursal (descarta los del catálogo que nunca tuvieron movimiento)
    // 2. Trae tanto productos visibles como ocultos con ficha en sucursal (para que el usuario pueda auditar y ajustar stock físico de ítems ocultos en Plex)
    // 3. Filtro de productos activos y no-servicios: (p.Activo = 'S' | '1') AND (p.servicio = 0 | NULL)
    // 4. Códigos de barra alternativos vía productoscodebars para soporte total de escaneo
    // 5. Soporte directo por IDLaboratorio numérico (cero fallas de tildes/espacios) con fallback a texto
    const customQuery = `
        SELECT 
            p.IDProducto AS id_producto,
            p.Troquel AS troquel,
            p.Codebar AS ean,
            CONCAT(p.Producto, ' ', IFNULL(p.Presentacion, '')) AS producto,
            r.Nombre AS rubro,
            l.Nombre AS laboratorio,
            s.Cantidad AS stock,
            p.UltimoPrecio AS precio,
            IFNULL(NULLIF(p.costoPPP, 0), p.Costo) AS costo,
            IFNULL(p.visible, 1) AS visible,
            IFNULL(p.trazable, 0) AS trazable,
            IFNULL(p.gtin, '') AS gtin,
            GROUP_CONCAT(DISTINCT pc.codebar SEPARATOR ', ') AS codigos_barra_alternativos,
            p.Activo AS activo
        FROM productos p
        JOIN laboratorios l ON l.IDLaboratorio = p.IDLaboratorio
        JOIN stock s ON s.IDProducto = p.IDProducto
        LEFT JOIN rubros r ON r.IDRubro = p.IDRubro
        LEFT JOIN productoscodebars pc ON pc.IDProducto = p.IDProducto
        WHERE ${whereLabClause}
          AND (p.Activo = 'S' OR p.Activo = '1' OR p.Activo = 1 OR p.Activo = 's')
          AND (p.servicio = 0 OR p.servicio IS NULL OR p.servicio = '0')
        GROUP BY p.IDProducto
        ORDER BY r.Nombre ASC, p.Producto ASC
    `.trim();

    const result = await fetchMysqlStockDirect(config, customQuery);

    if (!result.success || !result.products || result.products.length === 0) {
        return {
            success: false,
            items: currentItems,
            addedCount: 0,
            updatedCount: 0,
            message: result.message
                ? formatSyncErrorMessage(result.message)
                : `No se encontraron productos para "${labName}" en el servidor de ${branchName}.`,
            totalUnits: 0,
        };
    }

    // Normalizador de categoría para asegurar coincidencia con pestañas del inventario cíclico
    const mapCategory = (rawCat?: string): string => {
        if (!rawCat) return 'Varios';
        const norm = normalizeString(rawCat).toUpperCase();
        if (norm.includes('MEDICAM')) return 'Medicamentos';
        if (norm.includes('PERFUM')) return 'Perfumería';
        if (norm.includes('ACCESOR')) return 'Accesorios';
        return 'Varios';
    };

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

    if (onlyRefreshExisting === 'only_new') {
        const newItems: any[] = [];
        let newUnits = 0;

        for (const p of result.products) {
            const id_producto = String(p.id || '').trim();
            let ean = String(p.ean || '').trim();
            if (!ean || ean === '0' || ean === '00') {
                if (p.secondary_eans && p.secondary_eans.length > 0) {
                    ean = p.secondary_eans[0].trim();
                } else if (id_producto) {
                    ean = id_producto;
                }
            }
            const name = String(p.name || 'Sin Nombre').trim();

            const existing = (id_producto && existingByIdProd.has(id_producto)) ||
                             (ean && existingByEan.has(ean)) ||
                             (name && existingByName.has(normalizeString(name).toUpperCase()));

            if (!existing) {
                const category = mapCategory(p.category);
                const systemQty = Number(p.stock) || 0;
                const pvp = Math.round((Number(p.sale_price) || 0) * 100) / 100;
                const cost = Math.round((Number(p.cost) || 0) * 100) / 100;

                newUnits += systemQty;
                newItems.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : `item_${id_producto}_${Date.now()}_${Math.random()}`,
                    id_producto,
                    ean,
                    name,
                    category,
                    systemQuantity: systemQty,
                    countedQuantity: 0,
                    price: pvp,
                    cost: cost,
                    status: 'pending',
                    troquel: p.troquel,
                    is_hidden: p.is_hidden ?? false,
                    updatedAt: new Date().toISOString(),
                });
            }
        }

        const totalCurrentUnits = (currentItems || []).reduce((acc: number, it: any) => acc + (Number(it.systemQuantity) || 0), 0);

        return {
            success: true,
            items: [...(currentItems || []), ...newItems],
            addedCount: newItems.length,
            updatedCount: 0,
            changedCount: 0,
            message: newItems.length > 0
                ? `Se incorporaron ${newItems.length} nuevo(s) SKU(s) desde el servidor.`
                : `No se encontraron SKUs nuevos para "${labName}" en el servidor.`,
            totalUnits: totalCurrentUnits + newUnits,
        };
    }

    if (onlyRefreshExisting === true || onlyRefreshExisting === 'refresh') {
        // Fast in-memory map of Plex results for matching
        const plexByProdId = new Map<string, any>();
        const plexByEan = new Map<string, any>();
        const plexByName = new Map<string, any>();

        for (const p of result.products) {
            const pId = String(p.id || '').trim();
            const ean = String(p.ean || '').trim();
            const name = normalizeString(p.name || '').toUpperCase();
            if (pId) plexByProdId.set(pId, p);
            if (ean && ean !== '0' && ean !== '00') plexByEan.set(ean, p);
            for (const secEan of (p.secondary_eans || [])) {
                if (secEan) plexByEan.set(String(secEan).trim(), p);
            }
            if (name) plexByName.set(name, p);
        }

        const finalItems: any[] = [];
        let updatedCount = 0;
        let changedCount = 0;
        let refreshedTotalUnits = 0;

        for (const item of (currentItems || [])) {
            const pId = String(item.id_producto || '').trim();
            const ean = String(item.ean || '').trim();
            const name = normalizeString(item.name || '').toUpperCase();

            const p = (pId && plexByProdId.get(pId)) ||
                      (ean && plexByEan.get(ean)) ||
                      (name && plexByName.get(name));

            if (p) {
                const systemQty = Number(p.stock) || 0;
                if (systemQty !== item.systemQuantity) {
                    changedCount++;
                }
                refreshedTotalUnits += systemQty;
                updatedCount++;
                const pvp = Math.round((Number(p.sale_price) || 0) * 100) / 100;
                const cost = Math.round((Number(p.cost) || 0) * 100) / 100;

                finalItems.push({
                    ...item,
                    systemQuantity: systemQty,
                    price: pvp || item.price || 0,
                    cost: cost || item.cost || 0,
                    troquel: p.troquel || item.troquel,
                    updatedAt: new Date().toISOString(),
                });
            } else {
                refreshedTotalUnits += (item.systemQuantity || 0);
                finalItems.push(item);
            }
        }

        return {
            success: true,
            items: finalItems,
            addedCount: 0,
            updatedCount,
            changedCount,
            message: `Stock refrescado: ${updatedCount} productos actualizados (${changedCount} con variación).`,
            totalUnits: refreshedTotalUnits,
        };
    }

    const finalItems: any[] = [];
    let addedCount = 0;
    let updatedCount = 0;
    let totalUnits = 0;

    for (const p of result.products) {
        const id_producto = String(p.id || '').trim();
        let ean = String(p.ean || '').trim();
        if (!ean || ean === '0' || ean === '00') {
            if (p.secondary_eans && p.secondary_eans.length > 0) {
                ean = p.secondary_eans[0].trim();
            } else if (id_producto) {
                ean = id_producto;
            }
        }
        const name = String(p.name || 'Sin Nombre').trim();
        const category = mapCategory(p.category);
        const systemQty = Number(p.stock) || 0;
        const pvp = Math.round((Number(p.sale_price) || 0) * 100) / 100;
        const cost = Math.round((Number(p.cost) || 0) * 100) / 100;

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
                price: pvp || existing.price || 0,
                cost: cost || existing.cost || 0,
                // Preserve user count and status if already controlled
                countedQuantity: existing.countedQuantity ?? 0,
                status: existing.status ?? 'pending',
                troquel: p.troquel || existing.troquel,
                shortageId: existing.shortageId,
                surplusId: existing.surplusId,
                wasReadjusted: existing.wasReadjusted,
                readjustmentReason: existing.readjustmentReason,
                is_hidden: p.is_hidden ?? existing.is_hidden ?? false,
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
                price: pvp,
                cost: cost,
                status: 'pending',
                troquel: p.troquel,
                is_hidden: p.is_hidden ?? false,
                updatedAt: new Date().toISOString(),
            });
        }
    }

    // Preservar ítems que ya fueron auditados si no vinieron en la consulta de Plex
    (currentItems || []).forEach((item: any) => {
        const alreadyIncluded = finalItems.some(f => 
            (item.id_producto && f.id_producto === item.id_producto) ||
            (item.ean && f.ean === item.ean)
        );
        if (!alreadyIncluded && (item.status === 'controlled' || item.status === 'adjusted' || (item.countedQuantity && item.countedQuantity > 0))) {
            finalItems.push(item);
        }
    });

    console.log(`[CyclicSync] Sincronización MySQL ${labName} (${branchName}): ${finalItems.length} items (${totalUnits} unidades de stock). Productos con stock > 0:`, 
        finalItems.filter(i => i.systemQuantity > 0).map(i => `${i.name} (EAN: ${i.ean}, Stock: ${i.systemQuantity})`)
    );

    return {
        success: true,
        items: finalItems,
        addedCount,
        updatedCount,
        message: `Sincronización exitosa: ${result.products.length} productos importados desde Plex (${totalUnits} unidades en stock).`,
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
        const readyConfig = await ensureConfigPassword(config);
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<CreatePlexInventoryResult>('create_plex_inventory_session', {
            config: readyConfig,
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
        const readyConfig = await ensureConfigPassword(config);
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<GetPlexOpenSessionsResult>('get_plex_open_inventory_sessions', {
            config: readyConfig,
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
    bypassed_trazables?: number[];
}

/**
 * Sends counted inventory items to Plex MySQL API tables (`inventario_ws` & `inventario_ws_det`)
 * Automatically detects and bypasses trazable=1 products to allow Plex import, recording them in bypassed_trazables.
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
            bypassed_trazables: [],
        };
    }

    try {
        const readyConfig = await ensureConfigPassword(config);
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<SendPlexApiBatchResult>('send_plex_inventory_api_batch', {
            config: readyConfig,
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

/**
 * Restores trazable=1 for product IDs that were temporarily bypassed for import
 */
export async function restorePlexTrazables(
    config: MysqlConfig,
    productIds: number[]
): Promise<boolean> {
    if (!productIds || productIds.length === 0) {
        return true;
    }

    if (!isTauriEnvironment()) {
        console.log('[Simulación PWA] Trazabilidad restaurada para:', productIds);
        return true;
    }

    try {
        const readyConfig = await ensureConfigPassword(config);
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<boolean>('restore_plex_trazables', {
            config: readyConfig,
            productIds,
        });
    } catch (err: any) {
        console.error('Error al restaurar trazabilidad en Plex:', err);
        return false;
    }
}

/**
 * Checks current batch status in Plex inventario_ws ('PENDIENTE', 'INGRESADO', etc.)
 */
export async function checkPlexBatchStatus(
    config: MysqlConfig,
    idRegistro: number
): Promise<string> {
    if (!isTauriEnvironment()) {
        return 'INGRESADO';
    }

    try {
        const readyConfig = await ensureConfigPassword(config);
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('check_plex_batch_status', {
            config: readyConfig,
            idRegistro,
        });
    } catch (err: any) {
        console.error('Error al consultar estado de lote en Plex:', err);
        return 'ERROR';
    }
}

export interface PlexAdjustmentStatus {
    id_inventario: number | null;
    id_estado: number | null;
    estado_desc: string;
    tipo_ajuste: string | null;
    is_adjusted: boolean;
}

/**
 * Checks whether the inventory session containing the bypassed items has been adjusted in Plex
 * (IDEstado = 4 or TipoAjuste = 'CONCILIACION', etc.)
 */
export async function checkPlexInventoryAdjustment(
    config: MysqlConfig,
    productIds: number[],
    idInventario?: number | null
): Promise<PlexAdjustmentStatus> {
    if (!isTauriEnvironment()) {
        return {
            id_inventario: idInventario || 1,
            id_estado: 4,
            estado_desc: 'PROCESADO',
            tipo_ajuste: 'CONCILIACION',
            is_adjusted: true,
        };
    }

    try {
        const readyConfig = await ensureConfigPassword(config);
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<PlexAdjustmentStatus>('check_plex_inventory_adjustment', {
            config: readyConfig,
            productIds,
            idInventario: idInventario || null,
        });
    } catch (err: any) {
        console.error('Error al consultar estado de ajuste de inventario en Plex:', err);
        return {
            id_inventario: idInventario || null,
            id_estado: null,
            estado_desc: 'ERROR',
            tipo_ajuste: null,
            is_adjusted: false,
        };
    }
}

export interface PlexSessionStatus {
    running: boolean;
    logged_in: boolean;
    user: string | null;
    screen: string | null;
    pid: number | null;
    terminal: string | null;
    config_path: string | null;
}

export interface PlexOperatorVerification {
    is_authorized: boolean;
    id_usuario: number | null;
    user_name: string;
    full_name: string;
    profile: string;
    is_admin: boolean;
    message: string;
}

export interface PlexAdjustmentResult {
    success: boolean;
    alta_id: number | null;
    baja_id: number | null;
    total_altas: number;
    total_bajas: number;
    message: string;
    logs: string[];
}

/**
 * Checks in real time whether Plex 25 is running, unlocked, and which user is logged in
 */
export async function checkPlexSession(): Promise<PlexSessionStatus> {
    if (!isTauriEnvironment()) {
        return {
            running: true,
            logged_in: true,
            user: 'COZGONZALOHER',
            screen: 'TFormPrincipal (Web Simulator)',
            pid: 1234,
            terminal: '168',
            config_path: 'C:\\Plex 25\\Gestion\\Config.ini',
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<PlexSessionStatus>('check_plex_session');
    } catch (err: any) {
        console.error('Error checking Plex session:', err);
        return {
            running: false,
            logged_in: false,
            user: null,
            screen: null,
            pid: null,
            terminal: null,
            config_path: null,
        };
    }
}

/**
 * Verifies whether the detected Plex user has the role of Encargado/Subencargado/Adm in this branch
 */
export async function verifyPlexOperator(
    branchName: string,
    userName: string
): Promise<PlexOperatorVerification> {
    if (!isTauriEnvironment()) {
        return {
            is_authorized: true,
            id_usuario: 1590,
            user_name: userName,
            full_name: 'COZ GONZALO HERNAN',
            profile: 'ADM INVENTARIOS',
            is_admin: true,
            message: `Operador autorizado: ${userName} (ADM INVENTARIOS)`,
        };
    }

    try {
        const { config } = await resolveBranchConfig(branchName);

        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<PlexOperatorVerification>('verify_plex_operator', {
            config,
            userName,
        });
    } catch (err: any) {
        console.error('Error verifying Plex operator:', err);
        return {
            is_authorized: false,
            id_usuario: null,
            user_name: userName,
            full_name: '',
            profile: 'ERROR',
            is_admin: false,
            message: err?.message || 'Error al conectar con la base de datos de la sucursal',
        };
    }
}

export interface NextAdjustmentIdsResult {
    next_shortage_id: number | null;
    next_surplus_id: number | null;
}

/**
 * Pre-fetches the predicted adjustment IDs that Plex will assign for bajas/altas
 */
export async function getNextPlexAdjustmentIds(
    branchName: string,
    hasShortage: boolean,
    hasSurplus: boolean
): Promise<NextAdjustmentIdsResult> {
    if (!isTauriEnvironment()) {
        const { getBranchMysqlHostConfig } = await import('@/lib/branchNetworkMap');
        const hostConfig = getBranchMysqlHostConfig(branchName);
        const bId = hostConfig.branchId || 70;
        const base = bId * 10_000_000;
        return {
            next_shortage_id: hasShortage ? base + 38 : null,
            next_surplus_id: hasSurplus ? (hasShortage ? base + 39 : base + 38) : null,
        };
    }

    try {
        const { config, branchId } = await resolveBranchConfig(branchName);

        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<NextAdjustmentIdsResult>('get_next_plex_adjustment_ids', {
            config,
            branchId,
            hasShortage,
            hasSurplus,
        });
    } catch (err) {
        console.error('Error fetching next Plex adjustment IDs:', err);
        return { next_shortage_id: null, next_surplus_id: null };
    }
}

/**
 * Executes cyclic inventory stock adjustments (Altas y Bajas) directly in branch Plex DB
 */
export async function executePlexCyclicAdjustments(
    branchName: string,
    operatorId: number,
    operatorName: string,
    labName: string,
    shortages: { id_producto?: string; ean: string; quantity: number }[],
    surpluses: { id_producto?: string; ean: string; quantity: number }[]
): Promise<PlexAdjustmentResult> {
    const { config, branchId } = await resolveBranchConfig(branchName);

    if (!isTauriEnvironment()) {
        return {
            success: true,
            alta_id: surpluses.length > 0 ? 9991 : null,
            baja_id: shortages.length > 0 ? 9992 : null,
            total_altas: surpluses.length,
            total_bajas: shortages.length,
            message: `[Simulación Web] Ajustes aplicados: ${surpluses.length} Altas, ${shortages.length} Bajas`,
            logs: ['Ajuste simulado correctamente en entorno web.'],
        };
    }

    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<PlexAdjustmentResult>('execute_plex_cyclic_adjustments', {
        config,
        operatorId,
        operatorName,
        branchId,
        labName,
        shortages,
        surpluses,
    });
}

/**
 * Gets all authorized operators (Encargados, Subencargados, Admins) for the branch from MySQL
 */
export async function getPlexBranchOperators(
    branchName: string
): Promise<PlexOperatorVerification[]> {
    if (!isTauriEnvironment()) {
        return [
            {
                is_authorized: true,
                id_usuario: 1590,
                user_name: 'COZGONZALOHER',
                full_name: 'COZ GONZALO HERNAN',
                profile: 'ADM INVENTARIOS',
                is_admin: true,
                message: 'Operador autorizado',
            },
            {
                is_authorized: true,
                id_usuario: 1204,
                user_name: 'EMANUEL',
                full_name: 'DIAZ EMANUEL',
                profile: 'ENCARGADO',
                is_admin: false,
                message: 'Operador autorizado',
            }
        ];
    }

    try {
        const { config } = await resolveBranchConfig(branchName);

        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<PlexOperatorVerification[]>('get_plex_branch_operators', {
            config,
        });
    } catch (err: any) {
        console.error('Error fetching Plex branch operators:', err);
        return [];
    }
}

import { isTauriEnvironment } from './mysqlTauriBridge';
import type { MysqlConfig } from './mysqlTauriBridge';
import { getBranchMysqlHostConfig } from '@/lib/branchNetworkMap';

export interface LocalProductRecord {
    id_producto: string;
    troquel?: string;
    name: string;
    stock: number;
    sale_price: number;
    cost: number;
    category?: string;
    subrubro?: string;
    laboratory?: string;
    barcode: string;
}

export interface LocalProductInput {
    id_producto: string;
    troquel?: string;
    name: string;
    stock: number;
    sale_price: number;
    cost: number;
    category?: string;
    subrubro?: string;
    laboratory?: string;
    eans: string[];
}

export interface LocalDbStats {
    success: boolean;
    db_path: string;
    total_products: number;
    total_barcodes: number;
}

export interface SyncSummary {
    success: boolean;
    message: string;
    total_products_synced: number;
    total_barcodes_indexed: number;
    duration_ms: number;
}

export interface LocalLocationStat {
    code: string;
    units_count: number;
}

export interface LocalSessionSummary {
    session_id: string;
    total_units: number;
    total_skus: number;
    total_products?: number;
    locations: LocalLocationStat[];
    last_scan_at?: string;
}

export interface LocalScanResult {
    success: boolean;
    ean: string;
    product_name: string;
    quantity: number;
    location_tag: string;
    location_total_units: number;
    session_total_units: number;
    session_total_skus: number;
}

/**
 * Inicializa el archivo stock_local.db en %APPDATA%/com.farmaplus.desktop/data
 * Crea tablas e índices si no existen y devuelve estadísticas actuales.
 */
export async function initLocalStockDb(): Promise<LocalDbStats> {
    if (!isTauriEnvironment()) {
        return {
            success: false,
            db_path: 'Web / Modo Navegador (Sin SQLite en disco)',
            total_products: 0,
            total_barcodes: 0,
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<LocalDbStats>('init_local_stock_db');
    } catch (err: any) {
        console.error('[TauriLocalDb] Error al inicializar base SQLite local:', err);
        throw new Error(err?.toString() || 'Error inicializando stock_local.db');
    }
}

/**
 * Descarga el catálogo desde el servidor MySQL de la sucursal y lo inserta masivamente
 * dentro de stock_local.db en una sola transacción ultra-rápida.
 */
export async function syncMysqlToLocalDb(
    configOrBranch?: MysqlConfig | string,
    customQuery?: string
): Promise<SyncSummary> {
    if (!isTauriEnvironment()) {
        throw new Error('La sincronización local a SQLite requiere la app de escritorio Tauri.');
    }

    let config: MysqlConfig;
    if (typeof configOrBranch === 'string') {
        const branchConfig = getBranchMysqlHostConfig(configOrBranch);
        config = {
            host: branchConfig.primaryIp,
            port: branchConfig.port,
            user: branchConfig.user,
            password: branchConfig.password || '',
            database: branchConfig.database,
        };
    } else if (configOrBranch && typeof configOrBranch === 'object') {
        config = {
            host: configOrBranch.host || '127.0.0.1',
            port: configOrBranch.port || 3306,
            user: configOrBranch.user || 'root',
            password: configOrBranch.password || '',
            database: configOrBranch.database || 'plex',
        };
    } else {
        config = {
            host: '127.0.0.1',
            port: 3306,
            user: 'root',
            password: '',
            database: 'plex',
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<SyncSummary>('sync_mysql_to_local_db', {
            config,
            customQuery: customQuery || null,
        });
    } catch (err: any) {
        console.error('[TauriLocalDb] Error sincronizando MySQL a SQLite local:', err);
        throw new Error(err?.toString() || 'Fallo la sincronización a stock_local.db');
    }
}

/**
 * Importa un catálogo parseado (ej: desde Excel) directamente a stock_local.db en una sola transacción.
 */
export async function importCatalogToLocalDb(
    products: LocalProductInput[]
): Promise<SyncSummary> {
    if (!isTauriEnvironment()) {
        return {
            success: true,
            message: 'Entorno Web / Navegador: Los productos se guardan en IndexedDB.',
            total_products_synced: products.length,
            total_barcodes_indexed: products.reduce((acc, p) => acc + (p.eans?.length || 1), 0),
            duration_ms: 0,
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<SyncSummary>('import_catalog_to_local_db', {
            products,
        });
    } catch (err: any) {
        console.error('[TauriLocalDb] Error importando catálogo a SQLite:', err);
        throw new Error(err?.toString() || 'Fallo la importación a stock_local.db');
    }
}

/**
 * Búsqueda instantánea en SQLite local por Código de Barras, Troquel o IDProducto (< 1 ms).
 * Usado por la PC de Salón y Admin al pistolear con lector USB / teclado.
 */
export async function searchLocalBarcode(barcode: string): Promise<LocalProductRecord | null> {
    if (!isTauriEnvironment()) {
        return null;
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<LocalProductRecord | null>('search_local_barcode', {
            barcode: barcode.trim(),
        });
    } catch (err: any) {
        console.error('[TauriLocalDb] Error buscando código de barra local:', err);
        return null;
    }
}

/**
 * Registra un escaneo en stock_local.db (tabla scanned_items).
 * Persistencia a 0 ms garantizada ante reinicios o cortes de energía.
 */
export async function recordLocalScan(
    sessionId: string,
    ean: string,
    qty: number = 1,
    locationTag?: string
): Promise<LocalScanResult | null> {
    if (!isTauriEnvironment()) {
        return null;
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<LocalScanResult>('record_local_scan', {
            sessionId,
            ean: ean.trim(),
            quantity: qty,
            locationTag: locationTag || null,
        });
    } catch (err: any) {
        console.error('[TauriLocalDb] Error registrando escaneo local:', err);
        return null;
    }
}

/**
 * Obtiene el resumen de la sesión local (unidades, SKUs, ubicaciones)
 * para emitir la telemetría ligera hacia la PC Admin.
 */
export async function getLocalSessionSummary(sessionId: string): Promise<LocalSessionSummary> {
    if (!isTauriEnvironment()) {
        return {
            session_id: sessionId,
            total_units: 0,
            total_skus: 0,
            total_products: 0,
            locations: [],
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke<LocalSessionSummary>('get_local_session_summary', { sessionId });
        return {
            ...res,
            total_products: res.total_skus,
        };
    } catch (err: any) {
        console.error('[TauriLocalDb] Error obteniendo resumen de sesión local:', err);
        return {
            session_id: sessionId,
            total_units: 0,
            total_skus: 0,
            total_products: 0,
            locations: [],
        };
    }
}

/**
 * Exporta todos los EANs contados en la sesión a un archivo de texto en %APPDATA%/exports
 * Formato estándar de integración con Plex25 / SAP.
 */
export async function exportLocalSessionToFile(
    sessionId: string,
    filename?: string
): Promise<string | null> {
    if (!isTauriEnvironment()) {
        return null;
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<string>('export_local_session_to_file', {
            sessionId,
            filename: filename || null,
        });
    } catch (err: any) {
        console.error('[TauriLocalDb] Error exportando archivo de conteo local:', err);
        throw new Error(err?.toString() || 'No se pudo generar el archivo de exportación');
    }
}
